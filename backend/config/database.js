const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create quizzes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id SERIAL PRIMARY KEY,
        creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        access_code VARCHAR(10) UNIQUE NOT NULL,
        status VARCHAR(20) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create questions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        question_type VARCHAR(50) NOT NULL,
        options JSONB,
        correct_answers JSONB NOT NULL,
        time_limit INTEGER DEFAULT 30,
        points INTEGER DEFAULT 1,
        negative_points INTEGER DEFAULT 0,
        image_url VARCHAR(500),
        order_index INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create quiz_sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_sessions (
        id SERIAL PRIMARY KEY,
        quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
        session_code VARCHAR(20) UNIQUE NOT NULL,
        status VARCHAR(20) DEFAULT 'waiting',
        current_question_index INTEGER DEFAULT 0,
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create participants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES quiz_sessions(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        socket_id VARCHAR(100),
        total_score INTEGER DEFAULT 0,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create responses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS responses (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
        question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
        session_id INTEGER REFERENCES quiz_sessions(id) ON DELETE CASCADE,
        answer JSONB NOT NULL,
        is_correct BOOLEAN NOT NULL,
        points_earned INTEGER DEFAULT 0,
        time_taken INTEGER,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_quizzes_creator_id ON quizzes(creator_id);
      CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
      CREATE INDEX IF NOT EXISTS idx_quiz_sessions_quiz_id ON quiz_sessions(quiz_id);
      CREATE INDEX IF NOT EXISTS idx_participants_session_id ON participants(session_id);
      CREATE INDEX IF NOT EXISTS idx_responses_participant_id ON responses(participant_id);
      CREATE INDEX IF NOT EXISTS idx_responses_question_id ON responses(question_id);
      CREATE INDEX IF NOT EXISTS idx_responses_session_id ON responses(session_id);
    `);

    // Update existing question_type column if it exists
    try {
      await client.query(`
        ALTER TABLE questions 
        ALTER COLUMN question_type TYPE VARCHAR(50)
      `);
      console.log('Updated question_type column to VARCHAR(50)');
    } catch (error) {
      // Column might not exist yet or already be the right size
      console.log('Question_type column update skipped (might already be correct)');
    }

    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initializeDatabase
}; 