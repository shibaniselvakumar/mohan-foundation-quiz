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

    // Find or create active session
    console.log('Looking for active session for quiz ID:', quiz.id);
    let sessionResult = await pool.query(
      'SELECT id FROM quiz_sessions WHERE quiz_id = $1 AND status IN ($2, $3) ORDER BY created_at DESC LIMIT 1',
      [quiz.id, 'waiting', 'active']
    );

    console.log('Session search result:', sessionResult.rows);

    let sessionId;
    if (sessionResult.rows.length === 0) {
      // Create a new session automatically
      console.log('No active session found, creating new session for quiz ID:', quiz.id);
      const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const newSessionResult = await pool.query(
        'INSERT INTO quiz_sessions (quiz_id, session_code, status) VALUES ($1, $2, $3) RETURNING id',
        [quiz.id, sessionCode, 'waiting']
      );
      
      sessionId = newSessionResult.rows[0].id;
      console.log('Created new session with ID:', sessionId);

      // Clear any old participants from previous sessions of this quiz
      await pool.query(
        'DELETE FROM participants WHERE session_id IN (SELECT id FROM quiz_sessions WHERE quiz_id = $1 AND id != $2)',
        [quiz.id, sessionId]
      );

      // Also clear participants from the current session to ensure clean slate
      await pool.query(
        'DELETE FROM participants WHERE session_id = $1',
        [sessionId]
      );
    } else {
      sessionId = sessionResult.rows[0].id;
      console.log('Using existing session with ID:', sessionId);
    }

    // Check if participant already exists in this session
    const existingParticipant = await pool.query(
      'SELECT id FROM participants WHERE session_id = $1 AND name = $2',
      [sessionId, participantName]
    );

    if (existingParticipant.rows.length > 0) {
      return res.status(400).json({ error: 'Participant name already taken in this session' });
    }

    // Also check if participant exists in any active session for this quiz
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
            'DELETE FROM participants WHERE session_id IN (SELECT id FROM quiz_sessions WHERE quiz_id = $1 AND id != $2)',
            [quizId, sessionId]
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

// Get quiz by ID with questions
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

    res.json({
      quiz: quizResult.rows[0],
      questions: questionsResult.rows
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
    
    try {
      if (req.body.options) {
        options = JSON.parse(req.body.options);
      }
      if (req.body.correctAnswers) {
        correctAnswers = JSON.parse(req.body.correctAnswers);
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return res.status(400).json({ error: 'Invalid JSON data in options or correctAnswers' });
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

    const result = await pool.query(
      `INSERT INTO questions (
        quiz_id, question_text, question_type, options, correct_answers, 
        time_limit, points, negative_points, image_url, order_index
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        quizId, questionText, questionType,
        options ? JSON.stringify(options) : null,
        correctAnswers ? JSON.stringify(correctAnswers) : null,
        timeLimit || 30, points || 1, negativePoints || 0, imageUrl, orderIndex
      ]
    );

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
    
    try {
      if (req.body.options) {
        options = JSON.parse(req.body.options);
      }
      if (req.body.correctAnswers) {
        correctAnswers = JSON.parse(req.body.correctAnswers);
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return res.status(400).json({ error: 'Invalid JSON data in options or correctAnswers' });
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
      values.push(correctAnswers ? JSON.stringify(correctAnswers) : null);
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

    // Generate session code
    const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create session
    const sessionResult = await pool.query(
      'INSERT INTO quiz_sessions (quiz_id, session_code, status) VALUES ($1, $2, $3) RETURNING *',
      [quizId, sessionCode, 'waiting']
    );

    // Clear any old participants from previous sessions of this quiz
    await pool.query(
      'DELETE FROM participants WHERE session_id IN (SELECT id FROM quiz_sessions WHERE quiz_id = $1 AND id != $2)',
      [quizId, sessionResult.rows[0].id]
    );

    // Also clear participants from the current session to ensure clean slate
    await pool.query(
      'DELETE FROM participants WHERE session_id = $1',
      [sessionResult.rows[0].id]
    );

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
       GROUP BY q.id, q.question_text, q.question_type
       ORDER BY q.order_index`,
      [sessionId, quizId]
    );

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

module.exports = router; 