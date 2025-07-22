const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Generate unique access code
function generateAccessCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Join quiz (for participants - no auth required) - MUST BE FIRST
router.post('/join', async (req, res) => {
  try {
    console.log('Join quiz request received:', req.body);
    const { accessCode, participantName } = req.body;

    if (!accessCode || !participantName) {
      console.log('Missing required fields:', { accessCode, participantName });
      return res.status(400).json({ error: 'Access code and participant name are required' });
    }

    // Find quiz
    console.log('Looking for quiz with access code:', accessCode);
    const quizResult = await pool.query(
      'SELECT id, title, status FROM quizzes WHERE access_code = $1',
      [accessCode]
    );

    console.log('Quiz search result:', quizResult.rows);

    if (quizResult.rows.length === 0) {
      console.log('No quiz found with access code:', accessCode);
      return res.status(404).json({ error: 'Invalid access code' });
    }

    const quiz = quizResult.rows[0];
    console.log('Found quiz:', quiz);

    if (quiz.status !== 'active') {
      console.log('Quiz is not active, status:', quiz.status);
      return res.status(400).json({ error: 'Quiz is not active' });
    }

    // Find the latest waiting or active session for this quiz
    const sessionResult = await pool.query(
      'SELECT id FROM quiz_sessions WHERE quiz_id = $1 AND status IN ($2, $3) ORDER BY created_at DESC LIMIT 1',
      [quiz.id, 'waiting', 'active']
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'No available session for this quiz. Please wait for the host to start a new session.' });
    }

    const sessionId = sessionResult.rows[0].id;

    // Check if participant already exists in this session
    const existingParticipant = await pool.query(
      'SELECT id FROM participants WHERE session_id = $1 AND name = $2',
      [sessionId, participantName]
    );

    if (existingParticipant.rows.length > 0) {
      return res.status(400).json({ error: 'Participant name already taken in this session' });
    }

    // Also check if participant exists in any active session for this quiz (should not happen, but keep for safety)
    const existingParticipantInQuiz = await pool.query(
      `SELECT p.id, p.name, qs.id as session_id 
       FROM participants p 
       JOIN quiz_sessions qs ON p.session_id = qs.id 
       WHERE qs.quiz_id = $1 AND qs.status IN ('waiting', 'active') AND p.name = $2`,
      [quiz.id, participantName]
    );

    if (existingParticipantInQuiz.rows.length > 0) {
      return res.status(400).json({ error: 'Participant name already taken in an active session' });
    }

    // Create the participant in the database
    const participantResult = await pool.query(
      'INSERT INTO participants (session_id, name) VALUES ($1, $2) RETURNING id',
      [sessionId, participantName]
    );

    const participantId = participantResult.rows[0].id;

    res.json({
      message: 'Successfully joined quiz',
      quiz: {
        id: quiz.id,
        title: quiz.title
      },
      sessionId,
      participantId
    });
  } catch (error) {
    console.error('Join quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new quiz
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description } = req.body;
    const creatorId = req.user.id;

    if (!title) {
      return res.status(400).json({ error: 'Quiz title is required' });
    }

    // Generate unique access code
    let accessCode;
    let isUnique = false;
    while (!isUnique) {
      accessCode = generateAccessCode();
      const existing = await pool.query('SELECT id FROM quizzes WHERE access_code = $1', [accessCode]);
      if (existing.rows.length === 0) {
        isUnique = true;
      }
    }

    const result = await pool.query(
      'INSERT INTO quizzes (creator_id, title, description, access_code) VALUES ($1, $2, $3, $4) RETURNING *',
      [creatorId, title, description, accessCode]
    );

    res.status(201).json({
      message: 'Quiz created successfully',
      quiz: result.rows[0]
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all quizzes for creator
router.get('/', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.id;
    
    const result = await pool.query(
      'SELECT * FROM quizzes WHERE creator_id = $1 ORDER BY created_at DESC',
      [creatorId]
    );

    res.json({ quizzes: result.rows });
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Update quiz
router.put('/:quizId', authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    const creatorId = req.user.id;
    const { title, description, status } = req.body;

    // Verify quiz ownership
    const quizResult = await pool.query(
      'SELECT id FROM quizzes WHERE id = $1 AND creator_id = $2',
      [quizId, creatorId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updateFields.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (status !== undefined) {
      updateFields.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add quizId to values
    values.push(quizId);

    const result = await pool.query(
      `UPDATE quizzes SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount++} RETURNING *`,
      values
    );

    // If status is being set to 'active', create a session automatically
    if (status === 'active') {
      try {
        // Check if there's already an active session
        const existingSession = await pool.query(
          'SELECT id FROM quiz_sessions WHERE quiz_id = $1 AND status IN ($2, $3)',
          [quizId, 'waiting', 'active']
        );

        if (existingSession.rows.length === 0) {
          // Generate session code
          const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          
          // Create session
          const sessionResult = await pool.query(
            'INSERT INTO quiz_sessions (quiz_id, session_code, status) VALUES ($1, $2, $3) RETURNING id',
            [quizId, sessionCode, 'waiting']
          );
          
          const sessionId = sessionResult.rows[0].id;
          
          // Clear any old participants from previous sessions of this quiz
          await pool.query(
            'DELETE FROM participants WHERE session_id = $1',
            [sessionId]
          );

          // Also clear participants from the current session to ensure clean slate
          await pool.query(
            'DELETE FROM participants WHERE session_id = $1',
            [sessionId]
          );
          
          console.log(`Auto-created session for quiz ${quizId} with code ${sessionCode} and ID ${sessionId}`);
        }
      } catch (sessionError) {
        console.error('Error creating auto-session:', sessionError);
        // Don't fail the quiz update if session creation fails
      }
    }

    res.json({
      message: 'Quiz updated successfully',
      quiz: result.rows[0]
    });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get quiz by ID with questions (include match pairs)
router.get('/:quizId', authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    const creatorId = req.user.id;

    // Get quiz
    const quizResult = await pool.query(
      'SELECT * FROM quizzes WHERE id = $1 AND creator_id = $2',
      [quizId, creatorId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Get questions
    const questionsResult = await pool.query(
      'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY order_index',
      [quizId]
    );
    const questions = questionsResult.rows;

    // For match questions, fetch match pairs
    for (const q of questions) {
      if (q.question_type === 'match') {
        const pairsResult = await pool.query(
          'SELECT id, prompt, match_text FROM match_pairs WHERE question_id = $1',
          [q.id]
        );
        q.match_pairs = pairsResult.rows;
      }
    }

    res.json({
      quiz: quizResult.rows[0],
      questions
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add question to quiz
router.post('/:quizId/questions', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { quizId } = req.params;
    const creatorId = req.user.id;
    const {
      questionText,
      questionType,
      timeLimit,
      points,
      negativePoints
    } = req.body;

    // Parse JSON strings from FormData
    let options = null;
    let correctAnswers = null;
    let matchPairs = null;
    try {
      if (req.body.options) {
        options = JSON.parse(req.body.options);
      }
      if (req.body.correctAnswers) {
        correctAnswers = JSON.parse(req.body.correctAnswers);
        if (!Array.isArray(correctAnswers) && typeof correctAnswers !== 'object') {
          correctAnswers = null;
        }
      }
      if (req.body.matchPairs) {
        matchPairs = JSON.parse(req.body.matchPairs);
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return res.status(400).json({ error: 'Invalid JSON data in options, correctAnswers, or matchPairs' });
    }

    console.log('Question creation request received:', {
      quizId,
      creatorId,
      questionText,
      questionType,
      options,
      correctAnswers,
      timeLimit,
      points,
      negativePoints,
      body: req.body
    });

    // Verify quiz ownership
    const quizResult = await pool.query(
      'SELECT id FROM quizzes WHERE id = $1 AND creator_id = $2',
      [quizId, creatorId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Get next order index
    const orderResult = await pool.query(
      'SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM questions WHERE quiz_id = $1',
      [quizId]
    );
    const orderIndex = orderResult.rows[0].next_order;

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    console.log('About to insert question with data:', {
      quizId,
      questionText,
      questionType,
      options,
      correctAnswers,
      timeLimit: timeLimit || 30,
      points: points || 1,
      negativePoints: negativePoints || 0,
      imageUrl,
      orderIndex
    });

    if (!correctAnswers) {
      if (questionType === 'match' && Array.isArray(matchPairs)) {
        correctAnswers = matchPairs;
      } else {
        return res.status(400).json({ error: 'correctAnswers is required for this question type.' });
      }
    }

    // Debug logs
    console.log('correctAnswers:', correctAnswers);
    console.log('Serialized:', JSON.stringify(correctAnswers));

    // In both POST and PUT /:quizId/questions endpoints, after setting options, before DB insert/update:
    console.log('options (to be saved):', options);
    // In the DB insert/update, always use options ? JSON.stringify(options) : null for the options field.
    if (questionType === 'true_false') {
      options = ["true", "false"];
    }
    if ((questionType === 'multiple_choice_single' || questionType === 'multiple_choice_multiple') && (!Array.isArray(options) || options.length === 0)) {
      return res.status(400).json({ error: 'Options are required for MCQ questions.' });
    }

    const result = await pool.query(
      `INSERT INTO questions (
        quiz_id, question_text, question_type, options, correct_answers, 
        time_limit, points, negative_points, image_url, order_index
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        quizId, questionText, questionType,
        options ? JSON.stringify(options) : null,
        JSON.stringify(correctAnswers),
        timeLimit || 30, points || 1, negativePoints || 0, imageUrl, orderIndex
      ]
    );

    const questionId = result.rows[0].id;

    // Insert match pairs if match question
    if (questionType === 'match' && Array.isArray(matchPairs)) {
      for (const pair of matchPairs) {
        await pool.query(
          'INSERT INTO match_pairs (question_id, prompt, match_text) VALUES ($1, $2, $3)',
          [questionId, pair.prompt, pair.match_text]
        );
      }
    }

    console.log('Question inserted successfully:', result.rows[0]);

    res.status(201).json({
      message: 'Question added successfully',
      question: result.rows[0]
    });
  } catch (error) {
    console.error('Add question error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update question
router.put('/:quizId/questions/:questionId', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { quizId, questionId } = req.params;
    const creatorId = req.user.id;
    const {
      questionText,
      questionType,
      timeLimit,
      points,
      negativePoints
    } = req.body;

    // Parse JSON strings from FormData
    let options = null;
    let correctAnswers = null;
    let matchPairs = null;
    try {
      if (req.body.options) {
        options = JSON.parse(req.body.options);
      }
      if (req.body.correctAnswers) {
        correctAnswers = JSON.parse(req.body.correctAnswers);
        if (!Array.isArray(correctAnswers) && typeof correctAnswers !== 'object') {
          correctAnswers = null;
        }
      }
      if (req.body.matchPairs) {
        matchPairs = JSON.parse(req.body.matchPairs);
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return res.status(400).json({ error: 'Invalid JSON data in options, correctAnswers, or matchPairs' });
    }

    // Verify quiz ownership
    const quizResult = await pool.query(
      'SELECT id FROM quizzes WHERE id = $1 AND creator_id = $2',
      [quizId, creatorId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (questionText !== undefined) {
      updateFields.push(`question_text = $${paramCount++}`);
      values.push(questionText);
    }
    if (questionType !== undefined) {
      updateFields.push(`question_type = $${paramCount++}`);
      values.push(questionType);
    }
    if (options !== undefined) {
      updateFields.push(`options = $${paramCount++}`);
      values.push(options ? JSON.stringify(options) : null);
    }
    if (correctAnswers !== undefined) {
      updateFields.push(`correct_answers = $${paramCount++}`);
      values.push(JSON.stringify(correctAnswers));
    }
    if (timeLimit !== undefined) {
      updateFields.push(`time_limit = $${paramCount++}`);
      values.push(timeLimit);
    }
    if (points !== undefined) {
      updateFields.push(`points = $${paramCount++}`);
      values.push(points);
    }
    if (negativePoints !== undefined) {
      updateFields.push(`negative_points = $${paramCount++}`);
      values.push(negativePoints);
    }
    if (imageUrl !== null) {
      updateFields.push(`image_url = $${paramCount++}`);
      values.push(imageUrl);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(questionId, quizId);
    const result = await pool.query(
      `UPDATE questions SET ${updateFields.join(', ')} WHERE id = $${paramCount++} AND quiz_id = $${paramCount++} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Update match pairs if match question
    if (questionType === 'match') {
      await pool.query('DELETE FROM match_pairs WHERE question_id = $1', [questionId]);
      if (Array.isArray(matchPairs)) {
        for (const pair of matchPairs) {
          await pool.query(
            'INSERT INTO match_pairs (question_id, prompt, match_text) VALUES ($1, $2, $3)',
            [questionId, pair.prompt, pair.match_text]
          );
        }
      }
    }

    res.json({
      message: 'Question updated successfully',
      question: result.rows[0]
    });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete question
router.delete('/:quizId/questions/:questionId', authenticateToken, async (req, res) => {
  try {
    const { quizId, questionId } = req.params;
    const creatorId = req.user.id;

    // Verify quiz ownership
    const quizResult = await pool.query(
      'SELECT id FROM quizzes WHERE id = $1 AND creator_id = $2',
      [quizId, creatorId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const result = await pool.query(
      'DELETE FROM questions WHERE id = $1 AND quiz_id = $2 RETURNING *',
      [questionId, quizId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Get active session for quiz
router.get('/:quizId/active-session', authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    const creatorId = req.user.id;

    // Verify quiz ownership
    const quizResult = await pool.query(
      'SELECT id FROM quizzes WHERE id = $1 AND creator_id = $2',
      [quizId, creatorId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Find active session
    const sessionResult = await pool.query(
      'SELECT * FROM quiz_sessions WHERE quiz_id = $1 AND status IN ($2, $3) ORDER BY created_at DESC LIMIT 1',
      [quizId, 'waiting', 'active']
    );

    res.json({
      session: sessionResult.rows[0] || null
    });
  } catch (error) {
    console.error('Get active session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create quiz session
router.post('/:quizId/session', authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    const creatorId = req.user.id;

    // Verify quiz ownership
    const quizResult = await pool.query(
      'SELECT id, title FROM quizzes WHERE id = $1 AND creator_id = $2',
      [quizId, creatorId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Always create a new session, regardless of existing sessions
    const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const sessionResult = await pool.query(
      'INSERT INTO quiz_sessions (quiz_id, session_code, status) VALUES ($1, $2, $3) RETURNING *',
      [quizId, sessionCode, 'waiting']
    );

    // Do NOT delete participants from previous sessions or the new session here.
    // Each new session starts with no participants by default.

    res.status(201).json({
      message: 'Session created successfully',
      session: sessionResult.rows[0]
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session info and questions (for creator)
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const creatorId = req.user.id;

    // Get session info
    const sessionResult = await pool.query(
      `SELECT qs.*, q.title, q.description, q.creator_id
       FROM quiz_sessions qs
       JOIN quizzes q ON qs.quiz_id = q.id
       WHERE qs.id = $1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Verify quiz ownership
    if (session.creator_id !== creatorId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get questions for this quiz
    const questionsResult = await pool.query(
      'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY order_index',
      [session.quiz_id]
    );

    res.json({
      session,
      questions: questionsResult.rows
    });
  } catch (error) {
    console.error('Get session info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get detailed analytics for a session
router.get('/:quizId/analytics/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { quizId, sessionId } = req.params;
    const creatorId = req.user.id;

    // Verify quiz ownership
    const quizResult = await pool.query(
      'SELECT id, title FROM quizzes WHERE id = $1 AND creator_id = $2',
      [quizId, creatorId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Get question analytics for this specific session
    const questionsResult = await pool.query(
      `SELECT 
        q.id,
        q.question_text,
        q.question_type,
        q.options,
        q.correct_answers,
        COUNT(r.id) as total_responses,
        COUNT(CASE WHEN r.is_correct THEN 1 END) as correct_responses,
        AVG(r.time_taken) as average_time,
        CASE 
          WHEN COUNT(r.id) > 0 
          THEN ROUND((COUNT(CASE WHEN r.is_correct THEN 1 END)::numeric / COUNT(r.id)::numeric) * 100, 1)
          ELSE 0 
        END as success_rate
       FROM questions q
       LEFT JOIN responses r ON q.id = r.question_id AND r.session_id = $1
       WHERE q.quiz_id = $2
       GROUP BY q.id, q.question_text, q.question_type, q.options, q.correct_answers
       ORDER BY q.order_index`,
      [sessionId, quizId]
    );

    // For each question, add a breakdown of answers
    for (const q of questionsResult.rows) {
      // Get all responses for this question in this session
      const responsesResult = await pool.query(
        'SELECT answer, is_correct FROM responses WHERE question_id = $1 AND session_id = $2',
        [q.id, sessionId]
      );
      const responses = responsesResult.rows;
      // Always parse options
      let options = q.options;
      if (typeof options === 'string') {
        try { options = JSON.parse(options); } catch { options = []; }
      }
      // Always parse and include correct_answers
      let correctAnswers = q.correct_answers;
      if (typeof correctAnswers === 'string') {
        try { correctAnswers = JSON.parse(correctAnswers); } catch { correctAnswers = []; }
      }
      q.correct_answers = correctAnswers;
      // Fallback for true/false
      if (q.question_type === 'true_false' && (!Array.isArray(options) || options.length === 0)) {
        options = ["true", "false"];
      }
      // Fallback for MCQ: if options missing, use all unique answers from responses
      if ((q.question_type === 'multiple_choice_single' || q.question_type === 'multiple_choice_multiple') && (!Array.isArray(options) || options.length === 0)) {
        const uniqueAnswers = new Set();
        responses.forEach(r => {
          let ans = r.answer;
          if (typeof ans === 'string') {
            try { ans = JSON.parse(ans); } catch {}
          }
          if (Array.isArray(ans)) {
            ans.forEach(a => uniqueAnswers.add(a));
          } else if (ans !== undefined && ans !== null) {
            uniqueAnswers.add(ans);
          }
        });
        options = Array.from(uniqueAnswers);
      }
      // Always include options in the question object
      q.options = options;
      if (q.question_type === 'multiple_choice_single' || q.question_type === 'multiple_choice_multiple' || q.question_type === 'true_false') {
        // Count answers per option
        let optionCounts = {};
        if (q.question_type === 'true_false') {
          optionCounts = { true: 0, false: 0 };
        } else if (Array.isArray(options)) {
          options.forEach(opt => { optionCounts[opt] = 0; });
        }
        responses.forEach(r => {
          let ans = r.answer;
          if (typeof ans === 'string') {
            try { ans = JSON.parse(ans); } catch {}
          }
          if (q.question_type === 'true_false') {
            if (Array.isArray(ans)) {
              ans.forEach(a => {
                console.log('TF Analytics: raw:', a, 'typeof:', typeof a); // Debug log
                const norm = (
                  a === true || a === 'true' || a === 'True' || a === 1 || a === '1'
                ) ? 'true' : 'false';
                if (optionCounts[norm] !== undefined) optionCounts[norm]++;
              });
            } else {
              console.log('TF Analytics: raw:', ans, 'typeof:', typeof ans); // Debug log
              const norm = (
                ans === true || ans === 'true' || ans === 'True' || ans === 1 || ans === '1'
              ) ? 'true' : 'false';
              if (optionCounts[norm] !== undefined) optionCounts[norm]++;
            }
          } else {
            if (Array.isArray(ans)) {
              ans.forEach(a => { if (optionCounts[a] !== undefined) optionCounts[a]++; });
            } else if (optionCounts[ans] !== undefined) {
              optionCounts[ans]++;
            }
          }
        });
        // --- Ensure true/false always has both keys ---
        if (q.question_type === 'true_false') {
          optionCounts = { true: optionCounts['true'] || 0, false: optionCounts['false'] || 0 };
        }
        q.breakdown = { option_counts: optionCounts };
      } else if (q.question_type === 'typed_answer') {
        // Count all answers entered, case-insensitive
        let answerCounts = {};
        responses.forEach(r => {
          let ans = r.answer;
          if (typeof ans === 'string') {
            try { ans = JSON.parse(ans); } catch {}
          }
          if (typeof ans === 'string') {
            const norm = ans.trim().toLowerCase();
            answerCounts[norm] = (answerCounts[norm] || 0) + 1;
          } else if (Array.isArray(ans)) {
            ans.forEach(a => {
              const norm = (a || '').trim().toLowerCase();
              answerCounts[norm] = (answerCounts[norm] || 0) + 1;
            });
          }
        });
        q.breakdown = { answer_counts: answerCounts };
      } else if (q.question_type === 'match') {
        // Per-pair and per-question analytics for match questions
        // Fetch match pairs for this question
        const matchPairsResult = await pool.query(
          'SELECT prompt, match_text FROM match_pairs WHERE question_id = $1',
          [q.id]
        );
        const matchPairs = matchPairsResult.rows;
        // Initialize per-pair correct counts
        let pairCorrectCounts = {};
        matchPairs.forEach(pair => {
          pairCorrectCounts[pair.prompt] = 0;
        });
        let allPairsCorrectCount = 0;
        responses.forEach(r => {
          let ans = r.answer;
          if (typeof ans === 'string') {
            try { ans = JSON.parse(ans); } catch {}
          }
          // ans should be array of {prompt, match_text}
          if (Array.isArray(ans)) {
            let allCorrect = true;
            matchPairs.forEach(pair => {
              const userPair = ans.find(a => a.prompt === pair.prompt);
              if (userPair && userPair.match_text === pair.match_text) {
                pairCorrectCounts[pair.prompt]++;
              } else {
                allCorrect = false;
              }
            });
            if (allCorrect) allPairsCorrectCount++;
          }
        });
        q.breakdown = {
          pair_correct_counts: pairCorrectCounts,
          all_pairs_correct_count: allPairsCorrectCount
        };
      } else {
        q.breakdown = {};
      }
    }

    // Get participant analytics for this specific session
    const participantsResult = await pool.query(
      `SELECT 
        p.id,
        p.name,
        p.total_score,
        COUNT(r.id) as questions_answered,
        COUNT(CASE WHEN r.is_correct THEN 1 END) as correct_answers,
        AVG(r.time_taken) as average_time,
        p.joined_at
       FROM participants p
       LEFT JOIN responses r ON p.id = r.participant_id AND r.session_id = $1
       WHERE p.session_id = $1
       GROUP BY p.id, p.name, p.total_score, p.joined_at
       ORDER BY p.total_score DESC`,
      [sessionId]
    );

    // Calculate summary statistics
    const totalParticipants = participantsResult.rows.length;
    const totalQuestions = questionsResult.rows.length;
    const averageScore = totalParticipants > 0 
      ? participantsResult.rows.reduce((sum, p) => sum + p.total_score, 0) / totalParticipants 
      : 0;
    
    const totalResponses = questionsResult.rows.reduce((sum, q) => sum + parseInt(q.total_responses), 0);
    const totalCorrect = questionsResult.rows.reduce((sum, q) => sum + parseInt(q.correct_responses), 0);
    const overallSuccessRate = totalResponses > 0 ? (totalCorrect / totalResponses) * 100 : 0;

    res.json({
      questions: questionsResult.rows,
      participants: participantsResult.rows,
      summary: {
        totalParticipants,
        totalQuestions,
        averageScore,
        overallSuccessRate,
        totalResponses,
        totalCorrect
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get quiz statistics (for creator)
router.get('/:quizId/stats', authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    const creatorId = req.user.id;

    // Verify quiz ownership
    const quizResult = await pool.query(
      'SELECT id, title FROM quizzes WHERE id = $1 AND creator_id = $2',
      [quizId, creatorId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Get the most recent active session for this quiz
    const activeSessionResult = await pool.query(
      `SELECT id FROM quiz_sessions 
       WHERE quiz_id = $1 AND status IN ('waiting', 'active')
       ORDER BY created_at DESC LIMIT 1`,
      [quizId]
    );

    let participantsResult;
    if (activeSessionResult.rows.length > 0) {
      const activeSessionId = activeSessionResult.rows[0].id;
      // Get participants and their scores for the current active session
      participantsResult = await pool.query(
        `SELECT p.name, p.total_score, p.joined_at
         FROM participants p
         WHERE p.session_id = $1
         ORDER BY p.total_score DESC, p.joined_at ASC`,
        [activeSessionId]
      );
    } else {
      // No active session found
      participantsResult = { rows: [] };
    }

    // Get question statistics for the current active session
    let questionsResult;
    if (activeSessionResult.rows.length > 0) {
      const activeSessionId = activeSessionResult.rows[0].id;
      questionsResult = await pool.query(
        `SELECT q.id, q.question_text, q.question_type, q.points,
                COUNT(r.id) as total_responses,
                COUNT(CASE WHEN r.is_correct THEN 1 END) as correct_responses
         FROM questions q
         LEFT JOIN responses r ON q.id = r.question_id AND r.session_id = $1
         WHERE q.quiz_id = $2
         GROUP BY q.id, q.question_text, q.question_type, q.points
         ORDER BY q.order_index`,
        [activeSessionId, quizId]
      );
    } else {
      // No active session found, show questions without responses
      questionsResult = await pool.query(
        `SELECT q.id, q.question_text, q.question_type, q.points,
                0 as total_responses,
                0 as correct_responses
         FROM questions q
         WHERE q.quiz_id = $1
         ORDER BY q.order_index`,
        [quizId]
      );
    }

    res.json({
      quiz: quizResult.rows[0],
      participants: participantsResult.rows,
      questions: questionsResult.rows
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all sessions for a quiz
router.get('/:quizId/sessions', authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    const creatorId = req.user.id;

    // Verify quiz ownership
    const quizResult = await pool.query(
      'SELECT id FROM quizzes WHERE id = $1 AND creator_id = $2',
      [quizId, creatorId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Get all sessions for this quiz
    const sessionsResult = await pool.query(
      `SELECT id, session_code, status, created_at, started_at, ended_at
       FROM quiz_sessions
       WHERE quiz_id = $1
       ORDER BY created_at DESC`,
      [quizId]
    );

    res.json({ sessions: sessionsResult.rows });
  } catch (error) {
    console.error('Get quiz sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 