const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Store active sessions and their states
const activeSessions = new Map();
const participantSockets = new Map();

// In-memory storage for draft answers: { [sessionId]: { [participantId]: { questionId, answer } } }
const draftAnswers = {};

function socketHandler(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join quiz session (for participants)
    socket.on('join-quiz', async (data) => {
      try {
        const { sessionId, participantName, participantId } = data;

        // Verify session exists
        const sessionResult = await pool.query(
          'SELECT * FROM quiz_sessions WHERE id = $1',
          [sessionId]
        );

        if (sessionResult.rows.length === 0) {
          socket.emit('error', { message: 'Invalid session' });
          return;
        }

        const session = sessionResult.rows[0];

        // Get or update participant
        let participant;
        if (participantId) {
          // Use the participant ID from the join request
          const participantResult = await pool.query(
            'SELECT * FROM participants WHERE id = $1 AND session_id = $2 AND name = $3',
            [participantId, sessionId, participantName]
          );

          if (participantResult.rows.length === 0) {
            socket.emit('error', { message: 'Invalid participant' });
            return;
          }

          participant = participantResult.rows[0];
          // Update socket ID for existing participant
          await pool.query(
            'UPDATE participants SET socket_id = $1 WHERE id = $2',
            [socket.id, participant.id]
          );
        } else {
          // Fallback: check if participant exists in this session
          const participantResult = await pool.query(
            'SELECT * FROM participants WHERE session_id = $1 AND name = $2',
            [sessionId, participantName]
          );

          if (participantResult.rows.length === 0) {
            socket.emit('error', { message: 'Participant not found. Please join again.' });
            return;
          }

          participant = participantResult.rows[0];
          // Update socket ID for existing participant
          await pool.query(
            'UPDATE participants SET socket_id = $1 WHERE id = $2',
            [socket.id, participant.id]
          );
        }

        // Join socket room
        socket.join(`session-${sessionId}`);
        participantSockets.set(socket.id, {
          sessionId,
          participantId: participant.id,
          participantName
        });

        // Initialize session state if not exists
        if (!activeSessions.has(sessionId)) {
          activeSessions.set(sessionId, {
            quizId: session.quiz_id,
            status: session.status,
            currentQuestionIndex: session.current_question_index,
            participants: new Map(),
            questionTimer: null,
            currentQuestion: null
          });
        }

        const sessionState = activeSessions.get(sessionId);
        sessionState.participants.set(participant.id, {
          id: participant.id,
          name: participant.name,
          socketId: socket.id,
          score: participant.total_score
        });

        // Send current session state to participant
        socket.emit('joined-session', {
          sessionId,
          participantId: participant.id,
          participantName,
          currentState: sessionState.status,
          currentQuestionIndex: sessionState.currentQuestionIndex
        });

        // Get updated participants list
        const participantsResult = await pool.query(
          'SELECT id, name, total_score, joined_at FROM participants WHERE session_id = $1',
          [sessionId]
        );

        const participants = participantsResult.rows.map(p => ({
          id: p.id,
          name: p.name,
          total_score: p.total_score,
          joined_at: p.joined_at
        }));

        // Notify creator about new participant
        console.log(`Emitting participant-joined to session ${sessionId}:`, {
          participantId: participant.id,
          participantName,
          totalParticipants: sessionState.participants.size,
          participantsCount: participants.length
        });
        
        socket.to(`session-${sessionId}`).emit('participant-joined', {
          participantId: participant.id,
          participantName,
          totalParticipants: sessionState.participants.size,
          participants
        });

        console.log(`Participant ${participantName} joined session ${sessionId}`);
      } catch (error) {
        console.error('Join quiz error:', error);
        socket.emit('error', { message: 'Failed to join quiz' });
      }
    });

    // Join quiz session as creator
    socket.on('join-session-creator', async (data) => {
      try {
        const { sessionId } = data;

        // Verify session exists
        const sessionResult = await pool.query(
          'SELECT * FROM quiz_sessions WHERE id = $1',
          [sessionId]
        );

        if (sessionResult.rows.length === 0) {
          socket.emit('error', { message: 'Invalid session' });
          return;
        }

        const session = sessionResult.rows[0];

        // Join socket room
        socket.join(`session-${sessionId}`);

        // Initialize session state if not exists
        if (!activeSessions.has(sessionId)) {
          activeSessions.set(sessionId, {
            quizId: session.quiz_id,
            status: session.status,
            currentQuestionIndex: session.current_question_index,
            participants: new Map(),
            questionTimer: null,
            currentQuestion: null
          });
        }

        const sessionState = activeSessions.get(sessionId);

        // Get current participants
        const participantsResult = await pool.query(
          'SELECT id, name, total_score, joined_at FROM participants WHERE session_id = $1',
          [sessionId]
        );

        const participants = participantsResult.rows.map(p => ({
          id: p.id,
          name: p.name,
          total_score: p.total_score,
          joined_at: p.joined_at
        }));

        // Send current session state to creator
        socket.emit('creator-joined', {
          sessionId,
          sessionState: sessionState.status,
          currentQuestionIndex: sessionState.currentQuestionIndex,
          participants,
          totalParticipants: participants.length
        });

        console.log(`Creator joined session ${sessionId}`);
      } catch (error) {
        console.error('Join session creator error:', error);
        socket.emit('error', { message: 'Failed to join as creator' });
      }
    });

    // Creator starts quiz
    socket.on('start-quiz', async (data) => {
      try {
        const { sessionId } = data;
        const sessionState = activeSessions.get(sessionId);

        if (!sessionState) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        // Update session status
        await pool.query(
          'UPDATE quiz_sessions SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['active', sessionId]
        );

        sessionState.status = 'active';
        sessionState.currentQuestionIndex = 0;

        // Get first question
        const questionResult = await pool.query(
          'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY order_index LIMIT 1',
          [sessionState.quizId]
        );

        if (questionResult.rows.length === 0) {
          socket.emit('error', { message: 'No questions found' });
          return;
        }

        const question = questionResult.rows[0];
        // Parse correct_answers and options from JSON if needed
        if (question.correct_answers && typeof question.correct_answers === 'string') {
          try {
            question.correct_answers = JSON.parse(question.correct_answers);
          } catch (e) {
            // fallback or error handling
          }
        }
        if (question.options && typeof question.options === 'string') {
          try {
            question.options = JSON.parse(question.options);
          } catch (e) {
            // fallback or error handling
          }
        }
        // Fetch match_pairs for match questions
        if (question.question_type === 'match') {
          const pairsResult = await pool.query(
            'SELECT id, prompt, match_text FROM match_pairs WHERE question_id = $1',
            [question.id]
          );
          question.match_pairs = pairsResult.rows;
        }
        sessionState.currentQuestion = question;

        // Broadcast quiz start to all participants
        io.to(`session-${sessionId}`).emit('quiz-started', {
          question: {
            id: question.id,
            text: question.question_text,
            type: question.question_type,
            options: question.options,
            timeLimit: question.time_limit,
            imageUrl: question.image_url,
            match_pairs: question.match_pairs || []
          },
          questionIndex: 0
        });

        // Start timer
        startQuestionTimer(sessionId, question.time_limit, io);

        console.log(`Quiz started for session ${sessionId}`);
      } catch (error) {
        console.error('Start quiz error:', error);
        socket.emit('error', { message: 'Failed to start quiz' });
      }
    });

    // Creator moves to next question
    socket.on('next-question', async (data) => {
      try {
        const { sessionId } = data;
        const sessionState = activeSessions.get(sessionId);

        if (!sessionState) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        // Clear current timer
        if (sessionState.questionTimer) {
          clearTimeout(sessionState.questionTimer);
        }

        // Get next question
        const nextQuestionIndex = sessionState.currentQuestionIndex + 1;
        const questionResult = await pool.query(
          'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY order_index OFFSET $2 LIMIT 1',
          [sessionState.quizId, nextQuestionIndex]
        );

        if (questionResult.rows.length === 0) {
          // Quiz finished
          await endQuiz(sessionId, io);
          return;
        }

        const question = questionResult.rows[0];
        // Parse correct_answers and options from JSON if needed
        if (question.correct_answers && typeof question.correct_answers === 'string') {
          try {
            question.correct_answers = JSON.parse(question.correct_answers);
          } catch (e) {}
        }
        if (question.options && typeof question.options === 'string') {
          try {
            question.options = JSON.parse(question.options);
          } catch (e) {}
        }
        // Fetch match_pairs for match questions
        if (question.question_type === 'match') {
          const pairsResult = await pool.query(
            'SELECT id, prompt, match_text FROM match_pairs WHERE question_id = $1',
            [question.id]
          );
          question.match_pairs = pairsResult.rows;
        }
        sessionState.currentQuestion = question;
        sessionState.currentQuestionIndex = nextQuestionIndex;

        // Update session in database
        await pool.query(
          'UPDATE quiz_sessions SET current_question_index = $1 WHERE id = $2',
          [nextQuestionIndex, sessionId]
        );

        // Broadcast next question using 'show-question' event
        io.to(`session-${sessionId}`).emit('show-question', {
          question: {
            id: question.id,
            text: question.question_text,
            type: question.question_type,
            options: question.options,
            timeLimit: question.time_limit,
            imageUrl: question.image_url,
            match_pairs: question.match_pairs || []
          },
          questionIndex: nextQuestionIndex
        });

        // Start timer for the new question
        startQuestionTimer(sessionId, question.time_limit, io);

        // (No auto-advance logic here; admin controls pacing)
        console.log(`Next question (${nextQuestionIndex}) for session ${sessionId} (admin-paced)`);
      } catch (error) {
        console.error('Next question error:', error);
        socket.emit('error', { message: 'Failed to move to next question' });
      }
    });

    // Creator ends current question early
    socket.on('end-question', async (data) => {
      try {
        const { sessionId } = data;
        const sessionState = activeSessions.get(sessionId);

        if (!sessionState || !sessionState.currentQuestion) {
          socket.emit('error', { message: 'No active question' });
          return;
        }

        // Clear current timer
        if (sessionState.questionTimer) {
          clearTimeout(sessionState.questionTimer);
          sessionState.questionTimer = null;
        }

        // Always auto-submit and show stats, even for the last question
        const participants = Array.from(sessionState.participants.values());
        for (const participant of participants) {
          const responseResult = await pool.query(
            'SELECT id FROM responses WHERE participant_id = $1 AND question_id = $2',
            [participant.id, sessionState.currentQuestion.id]
        );
          if (responseResult.rows.length === 0) {
            // Use draft answer if available
            let answer = null;
            if (
              draftAnswers[sessionId] &&
              draftAnswers[sessionId][participant.id] &&
              draftAnswers[sessionId][participant.id].questionId === sessionState.currentQuestion.id
            ) {
              answer = draftAnswers[sessionId][participant.id].answer;
            }
            console.log('Inserting auto-submit for', participant.id, 'Answer:', answer);
            const isCorrect = answer != null ? checkAnswer(answer, sessionState.currentQuestion) : false;
            const pointsEarned = isCorrect ? sessionState.currentQuestion.points : sessionState.currentQuestion.negative_points;
            await pool.query(
              `INSERT INTO responses (
                participant_id, question_id, session_id, answer, 
                is_correct, points_earned, time_taken
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                participant.id, sessionState.currentQuestion.id, sessionId,
                JSON.stringify(answer ?? null), isCorrect, pointsEarned, sessionState.currentQuestion.time_limit
              ]
            );
            await pool.query(
              'UPDATE participants SET total_score = total_score + $1 WHERE id = $2',
              [pointsEarned, participant.id]
            );
            participant.score += pointsEarned;
          }
        }
        // After all auto-submits, show stats (do NOT advance or finish quiz automatically)
        const results = await getQuestionResults(sessionId, sessionState.currentQuestion.id);
        socket.to(`session-${sessionId}`).emit('question-ended', { ...results, endedEarly: true });
        socket.emit('question-ended-creator', { ...results, endedEarly: true });
        console.log(`Question ended early for session ${sessionId}`);
      } catch (error) {
        console.error('End question error:', error);
        socket.emit('error', { message: 'Failed to end question' });
      }
    });

    // Participant submits answer
    socket.on('submit-answer', async (data) => {
      try {
        const { answer, timeTaken } = data;
        const participantInfo = participantSockets.get(socket.id);

        if (!participantInfo) {
          socket.emit('error', { message: 'Not connected to a session' });
          return;
        }

        const { sessionId, participantId } = participantInfo;
        const sessionState = activeSessions.get(sessionId);

        if (!sessionState || !sessionState.currentQuestion) {
          socket.emit('error', { message: 'No active question' });
          return;
        }

        const question = sessionState.currentQuestion;

        // Check if answer is correct
        const isCorrect = checkAnswer(answer, question);
        const pointsEarned = isCorrect ? question.points : question.negative_points;

        // Save response to database
        await pool.query(
          `INSERT INTO responses (
            participant_id, question_id, session_id, answer, 
            is_correct, points_earned, time_taken
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            participantId, question.id, sessionId, JSON.stringify(answer),
            isCorrect, pointsEarned, timeTaken
          ]
        );

        // Update participant score
        await pool.query(
          'UPDATE participants SET total_score = total_score + $1 WHERE id = $2',
          [pointsEarned, participantId]
        );

        // Update session state
        const participant = sessionState.participants.get(participantId);
        if (participant) {
          participant.score += pointsEarned;
        }

        // Acknowledge answer submission
        socket.emit('answer-submitted', {
          isCorrect,
          pointsEarned,
          totalScore: participant.score
        });

        console.log(`Answer submitted by participant ${participantId} for question ${question.id}`);

        // === NEW: Check if all participants have answered ===
        const totalParticipants = sessionState.participants.size;
        const responsesResult = await pool.query(
          'SELECT COUNT(DISTINCT participant_id) AS count FROM responses WHERE session_id = $1 AND question_id = $2',
          [sessionId, question.id]
        );
        const responsesCount = parseInt(responsesResult.rows[0].count, 10);
        if (responsesCount === totalParticipants) {
          // All participants have answered: clear timer and show results
          if (sessionState.questionTimer) {
            clearTimeout(sessionState.questionTimer);
            sessionState.questionTimer = null;
          }
          const results = await getQuestionResults(sessionId, question.id);
          io.to(`session-${sessionId}`).emit('question-results', results);
          console.log(`All participants answered for question ${question.id}, results shown immediately.`);
        }
        // === END NEW ===
      } catch (error) {
        console.error('Submit answer error:', error);
        socket.emit('error', { message: 'Failed to submit answer' });
      }
    });

    // Show question results
    socket.on('show-results', async (data) => {
      try {
        const { sessionId } = data;
        const sessionState = activeSessions.get(sessionId);

        if (!sessionState || !sessionState.currentQuestion) {
          socket.emit('error', { message: 'No active question' });
          return;
        }

        // Get question results
        const results = await getQuestionResults(sessionId, sessionState.currentQuestion.id);

        // Broadcast results to all participants
        io.to(`session-${sessionId}`).emit('question-results', results);

        console.log(`Results shown for question ${sessionState.currentQuestion.id}`);
      } catch (error) {
        console.error('Show results error:', error);
        socket.emit('error', { message: 'Failed to show results' });
      }
    });

    // Listen for finish-quiz event from creator
    socket.on('finish-quiz', async (data) => {
      try {
        const { sessionId } = data;
        await endQuiz(sessionId, io);
      } catch (error) {
        console.error('Finish quiz error:', error);
        socket.emit('error', { message: 'Failed to finish quiz' });
      }
    });

    // Creator requests current stats for the active question
    socket.on('get-current-stats', async (data) => {
      try {
        const { sessionId } = data;
        const sessionState = activeSessions.get(sessionId);
        if (!sessionState || !sessionState.currentQuestion) {
          socket.emit('error', { message: 'No active question' });
          return;
        }
        const results = await getQuestionResults(sessionId, sessionState.currentQuestion.id);
        socket.emit('current-stats', results);
      } catch (error) {
        console.error('Get current stats error:', error);
        socket.emit('error', { message: 'Failed to get current stats' });
      }
    });

    // Save draft answer from taker
    socket.on('save-draft-answer', (data) => {
      const { sessionId, participantId, questionId, answer } = data;
      if (!sessionId || !participantId || !questionId) return;
      if (!draftAnswers[sessionId]) draftAnswers[sessionId] = {};
      draftAnswers[sessionId][participantId] = { questionId, answer };
      console.log('DRAFT ANSWER RECEIVED:', data);
      console.log('Current draftAnswers:', JSON.stringify(draftAnswers));
    });

    // Disconnect handling
    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      
      const participantInfo = participantSockets.get(socket.id);
      if (participantInfo) {
        const { sessionId, participantId } = participantInfo;
        
        // Remove from session state
        const sessionState = activeSessions.get(sessionId);
        if (sessionState) {
          sessionState.participants.delete(participantId);
        }

        // Remove socket mapping
        participantSockets.delete(socket.id);

        // Get updated participants list
        const participantsResult = await pool.query(
          'SELECT id, name, total_score, joined_at FROM participants WHERE session_id = $1',
          [sessionId]
        );

        const participants = participantsResult.rows.map(p => ({
          id: p.id,
          name: p.name,
          total_score: p.total_score,
          joined_at: p.joined_at
        }));

        // Notify other participants
        socket.to(`session-${sessionId}`).emit('participant-left', {
          participantId,
          totalParticipants: sessionState ? sessionState.participants.size : 0,
          participants
        });
      }
    });
  });
}

// Helper functions
function startQuestionTimer(sessionId, timeLimit, io) {
  const sessionState = activeSessions.get(sessionId);
  if (!sessionState) return;

  console.log(`Timer started for session ${sessionId} for question ${sessionState.currentQuestion.id} for ${timeLimit} seconds`);

  sessionState.questionTimer = setTimeout(async () => {
    try {
      // For each participant who hasn't submitted, use their draft answer if available
      const participants = Array.from(sessionState.participants.values());
      for (const participant of participants) {
        const responseResult = await pool.query(
          'SELECT id FROM responses WHERE participant_id = $1 AND question_id = $2',
          [participant.id, sessionState.currentQuestion.id]
        );
        if (responseResult.rows.length === 0) {
          // Use draft answer if available
          let answer = null;
          if (
            draftAnswers[sessionId] &&
            draftAnswers[sessionId][participant.id] &&
            draftAnswers[sessionId][participant.id].questionId === sessionState.currentQuestion.id
          ) {
            answer = draftAnswers[sessionId][participant.id].answer;
          }
          console.log('Inserting auto-submit for', participant.id, 'Answer:', answer);
          // Defensive: checkAnswer(null) is always false
          const isCorrect = answer != null ? checkAnswer(answer, sessionState.currentQuestion) : false;
          const pointsEarned = isCorrect ? sessionState.currentQuestion.points : sessionState.currentQuestion.negative_points;
          await pool.query(
            `INSERT INTO responses (
              participant_id, question_id, session_id, answer, 
              is_correct, points_earned, time_taken
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              participant.id, sessionState.currentQuestion.id, sessionId,
              JSON.stringify(answer ?? null), isCorrect, pointsEarned, timeLimit
            ]
          );
          // Update score
          await pool.query(
            'UPDATE participants SET total_score = total_score + $1 WHERE id = $2',
            [pointsEarned, participant.id]
          );
          participant.score += pointsEarned;
        }
      }
      // After all auto-submits, show stats
      const results = await getQuestionResults(sessionId, sessionState.currentQuestion.id);
      io.to(`session-${sessionId}`).emit('question-ended', results);
      console.log(`Time's up for question in session ${sessionId}. Results shown, waiting for admin to advance.`);
    } catch (error) {
      console.error('Timer error:', error);
    }
  }, timeLimit * 1000);
}

function checkAnswer(answer, question) {
  console.log('DEBUG checkAnswer:', {
    question_type: question.question_type,
    correct_answers: question.correct_answers,
    correct_answers_type: Array.isArray(question.correct_answers) ? 'array' : typeof question.correct_answers,
    answer,
    answer_type: typeof answer
  });
  switch (question.question_type) {
    case 'multiple_choice_single':
      return Array.isArray(question.correct_answers)
        ? answer === question.correct_answers[0]
        : answer === question.correct_answers;
    case 'multiple_choice_multiple':
      if (!Array.isArray(answer) || !Array.isArray(question.correct_answers)) {
        return false;
      }
      return answer.length === question.correct_answers.length &&
             answer.every(a => question.correct_answers.includes(a));
    case 'true_false':
      return Array.isArray(question.correct_answers)
        ? answer === question.correct_answers[0]
        : answer === question.correct_answers;
    case 'typed_answer':
      return Array.isArray(question.correct_answers)
        ? answer.toLowerCase().trim() === question.correct_answers[0].toLowerCase().trim()
        : answer.toLowerCase().trim() === question.correct_answers.toLowerCase().trim();
    case 'match':
      if (!Array.isArray(answer) || !Array.isArray(question.correct_answers)) {
        return false;
      }
      return JSON.stringify(answer.sort()) === JSON.stringify(question.correct_answers.sort());
    default:
      return false;
  }
}

async function getQuestionResults(sessionId, questionId) {
  const result = await pool.query(
    `SELECT 
      r.answer,
      r.is_correct,
      p.name
     FROM responses r
     JOIN participants p ON r.participant_id = p.id
     WHERE r.session_id = $1 AND r.question_id = $2`,
    [sessionId, questionId]
  );

  const responses = result.rows;
  const totalResponses = responses.length;
  const correctResponses = responses.filter(r => r.is_correct).length;

  // Calculate statistics based on question type
  const questionResult = await pool.query(
    'SELECT question_type, options, correct_answers FROM questions WHERE id = $1',
    [questionId]
  );

  const question = questionResult.rows[0];
  // Defensive: parse options/correct_answers if needed
  if (typeof question.options === 'string') {
    try { question.options = JSON.parse(question.options); } catch (e) { question.options = []; }
  }
  if (typeof question.correct_answers === 'string') {
    try { question.correct_answers = JSON.parse(question.correct_answers); } catch (e) { question.correct_answers = []; }
  }
  let statistics = {};

  switch (question.question_type) {
    case 'multiple_choice_single':
    case 'multiple_choice_multiple':
      const optionCounts = {};
      question.options.forEach(option => {
        optionCounts[option] = 0;
      });
      
      responses.forEach(response => {
        if (Array.isArray(response.answer)) {
          response.answer.forEach(ans => {
            if (optionCounts.hasOwnProperty(ans)) {
              optionCounts[ans]++;
            }
          });
        } else if (optionCounts.hasOwnProperty(response.answer)) {
          optionCounts[response.answer]++;
        }
      });

      statistics = Object.keys(optionCounts).map(option => ({
        option,
        count: optionCounts[option],
        percentage: totalResponses > 0 ? Math.round((optionCounts[option] / totalResponses) * 100) : 0
      }));
      break;

    case 'true_false':
      const trueCount = responses.filter(r => r.answer === true).length;
      const falseCount = responses.filter(r => r.answer === false).length;
      
      statistics = [
        { option: 'True', count: trueCount, percentage: totalResponses > 0 ? Math.round((trueCount / totalResponses) * 100) : 0 },
        { option: 'False', count: falseCount, percentage: totalResponses > 0 ? Math.round((falseCount / totalResponses) * 100) : 0 }
      ];
      break;

    case 'typed_answer':
      statistics = [
        { option: 'Correct', count: correctResponses, percentage: totalResponses > 0 ? Math.round((correctResponses / totalResponses) * 100) : 0 },
        { option: 'Incorrect', count: totalResponses - correctResponses, percentage: totalResponses > 0 ? Math.round(((totalResponses - correctResponses) / totalResponses) * 100) : 0 }
      ];
      break;

    case 'match':
      statistics = [
        { option: 'Correct', count: correctResponses, percentage: totalResponses > 0 ? Math.round((correctResponses / totalResponses) * 100) : 0 },
        { option: 'Incorrect', count: totalResponses - correctResponses, percentage: totalResponses > 0 ? Math.round(((totalResponses - correctResponses) / totalResponses) * 100) : 0 }
      ];
      break;
  }

  return {
    totalResponses,
    correctResponses,
    statistics,
    participants: responses.map(r => ({
      name: r.name,
      isCorrect: r.is_correct
    }))
  };
}

async function endQuiz(sessionId, io) {
  console.log(`=== END QUIZ FUNCTION STARTED FOR SESSION ${sessionId} ===`);
  try {
    console.log(`Updating session status to completed for session ${sessionId}...`);
    // Update session status
    await pool.query(
      'UPDATE quiz_sessions SET status = $1, ended_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['completed', sessionId]
    );
    console.log(`Session status updated successfully for session ${sessionId}`);

    console.log(`Getting final leaderboard for session ${sessionId}...`);
    // Get final leaderboard
    const leaderboardResult = await pool.query(
      `SELECT p.name, p.total_score, p.joined_at
       FROM participants p
       JOIN quiz_sessions qs ON p.session_id = qs.id
       WHERE qs.id = $1
       ORDER BY p.total_score DESC, p.joined_at ASC`,
      [sessionId]
    );
    console.log(`Leaderboard retrieved for session ${sessionId}:`, leaderboardResult.rows);

    // Broadcast quiz end and leaderboard
    console.log(`Broadcasting quiz-ended event to session ${sessionId} with leaderboard:`, leaderboardResult.rows);
    io.to(`session-${sessionId}`).emit('quiz-ended', {
      leaderboard: leaderboardResult.rows
    });
    console.log(`Quiz-ended event broadcasted successfully for session ${sessionId}`);

    // Clean up session state
    console.log(`Cleaning up session state for session ${sessionId}...`);
    activeSessions.delete(sessionId);
    
    console.log(`=== SESSION ${sessionId} CLEANED UP AND QUIZ ENDED SUCCESSFULLY ===`);
  } catch (error) {
    console.error('=== END QUIZ ERROR ===:', error);
  }
}

module.exports = socketHandler; 