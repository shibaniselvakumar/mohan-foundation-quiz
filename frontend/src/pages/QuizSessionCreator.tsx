import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import axios from 'axios';
import QuizAnalytics from '../components/QuizAnalytics';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  options?: string[];
  time_limit: number;
  points: number;
  negative_points: number;
  order_index: number;
}

interface Participant {
  id: number;
  name: string;
  total_score: number;
  joined_at: string;
}

interface QuestionResult {
  totalResponses: number;
  correctResponses: number;
  statistics: Array<{
    option: string;
    count: number;
    percentage: number;
  }>;
  participants: Array<{
    name: string;
    isCorrect: boolean;
  }>;
}

const QuizSessionCreator: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  
  const [sessionState, setSessionState] = useState<'waiting' | 'active' | 'results' | 'ended'>('waiting');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [participantCount, setParticipantCount] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionResults, setQuestionResults] = useState<QuestionResult | null>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<Participant[]>([]);

  useEffect(() => {
    if (!sessionId) return;

    // Join as creator
    if (socket) {
      socket.emit('join-session-creator', {
        sessionId: parseInt(sessionId)
      });
    }

    // Fetch session info and questions
    fetchSessionInfo();
  }, [sessionId, socket]);

  const fetchSessionInfo = async () => {
    try {
      const response = await axios.get(`/api/quiz/session/${sessionId}`);
      setSessionInfo(response.data.session);
      setQuestions(response.data.questions);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to fetch session info');
    }
  };

  useEffect(() => {
    if (!socket) return;

    // Socket event listeners for creator
    socket.on('creator-joined', (data) => {
      console.log('Creator joined session:', data);
    });

    socket.on('participant-joined', (data) => {
      setParticipantCount(data.totalParticipants);
      setParticipants(data.participants);
    });

    socket.on('participant-left', (data) => {
      setParticipantCount(data.totalParticipants);
      setParticipants(data.participants);
    });

    socket.on('question-started', (data) => {
      setSessionState('active');
      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setTimeLeft(data.question.time_limit);
      setQuestionResults(null);
    });

    socket.on('question-ended', (results) => {
      setSessionState('results');
      setQuestionResults(results);
      setTimeLeft(0);
    });

    socket.on('quiz-ended', (data) => {
      console.log('Creator: Quiz ended event received:', data);
      setSessionState('ended');
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
      }
    });

    socket.on('error', (data) => {
      setError(data.message);
    });

    return () => {
      socket.off('creator-joined');
      socket.off('participant-joined');
      socket.off('participant-left');
      socket.off('question-started');
      socket.off('question-ended');
      socket.off('quiz-ended');
      socket.off('error');
    };
  }, [socket]);

  // Timer effect
  useEffect(() => {
    if (timeLeft <= 0 || sessionState !== 'active') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, sessionState]);

  const startQuiz = () => {
    if (!socket || questions.length === 0) return;
    
    socket.emit('start-quiz', {
      sessionId: parseInt(sessionId!)
    });
  };

  const startQuestion = () => {
    if (!socket || questionIndex >= questions.length) return;
    
    socket.emit('start-question', {
      sessionId: parseInt(sessionId!),
      questionIndex
    });
  };

  const nextQuestion = () => {
    if (!socket || questionIndex >= questions.length - 1) return;
    
    socket.emit('next-question', {
      sessionId: parseInt(sessionId!),
      questionIndex: questionIndex + 1
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getChartData = () => {
    if (!questionResults) return null;

    return {
      labels: questionResults.statistics.map(stat => stat.option),
      datasets: [
        {
          label: 'Responses',
          data: questionResults.statistics.map(stat => stat.count),
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
      ],
    };
  };

  if (error) {
    return (
      <div className="container">
        <div className="alert alert-error">
          {error}
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn btn-primary"
        >
          Go Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <Box sx={{ width: '100vw', minHeight: '100vh', bgcolor: '#e3f0ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', p: 0, m: 0, overflowX: 'hidden' }}>
      <Paper elevation={8} sx={{
        width: '100%',
        maxWidth: 1200,
        mx: 'auto',
        my: 4,
        borderRadius: 8,
        boxShadow: '0 8px 32px 0 rgba(37,99,235,0.18), 0 1.5px 8px 0 #e11d48cc',
        p: { xs: 2, md: 4 },
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.85) 60%, #e0e7ff 100%)',
        border: '2.5px solid #e0e7ff',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Decorative accent bar */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 10,
          background: 'linear-gradient(90deg, #2563eb 60%, #e11d48 100%)',
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          zIndex: 2,
          boxShadow: '0 2px 8px 0 #2563eb33',
        }} />
        <div className="quiz-header" style={{ width: '100%', padding: '2.5rem 0 1.5rem 0', zIndex: 3 }}>
          <h1 className="quiz-title" style={{ fontWeight: 800, letterSpacing: 1, color: '#2563eb', textShadow: '0 2px 8px #e0e7ff' }}>Session Control</h1>
          <p className="quiz-subtitle" style={{ color: '#e11d48', fontWeight: 600, fontSize: '1.15rem' }}>Manage your live quiz session</p>
        </div>

        {/* Session Info */}
        <div className="session-info" style={{ width: '100%' }}>
          <div className="info-card">
            <h3>Session Info</h3>
            <p>Session ID: {sessionId}</p>
            <p>Status: {sessionState}</p>
            <p>Participants: {participantCount}</p>
            <p>Questions: {questions.length}</p>
            {sessionState === 'active' && (
              <p>Time Left: {formatTime(timeLeft)}</p>
            )}
          </div>
        </div>

        {/* Control Panel */}
        <div className="control-panel" style={{ width: '100%' }}>
          <h3>Quiz Controls</h3>
          
          {sessionState === 'waiting' && (
            <div className="control-buttons">
              <Button
                onClick={startQuiz}
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={participantCount === 0 || questions.length === 0 || sessionState !== 'waiting'}
                sx={{
                  fontWeight: 700,
                  borderRadius: 2,
                  boxShadow: 3,
                  transition: 'background 0.3s, box-shadow 0.3s',
                  ...(sessionState !== 'waiting' && {
                    backgroundColor: 'success.main',
                    color: 'white',
                    boxShadow: 6,
                    pointerEvents: 'none',
                    opacity: 0.8,
                  })
                }}
                startIcon={sessionState !== 'waiting' ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {sessionState === 'waiting'
                  ? `Start Quiz (${participantCount} participants)`
                  : 'Session Started'}
              </Button>
            </div>
          )}

          {sessionState === 'active' && (
            <div className="control-buttons">
              <button
                onClick={() => socket?.emit('end-question', { sessionId: parseInt(sessionId!) })}
                className="btn btn-secondary"
              >
                End Question Early
              </button>
            </div>
          )}

          {sessionState === 'results' && (
            <div className="control-buttons">
              {questionIndex < questions.length - 1 && (
                <button
                  onClick={nextQuestion}
                  className="btn btn-primary"
                >
                  Next Question
                </button>
              )}
            </div>
          )}
        </div>

        {/* Participants List */}
        <div className="participants-list" style={{ width: '100%' }}>
          <h3>Participants ({participantCount})</h3>
          <div className="participants-grid">
            {participants.map((participant) => (
              <div key={participant.id} className="participant-card">
                <div className="participant-name">{participant.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Current Question */}
        {currentQuestion && sessionState === 'active' && (
          <div className="current-question" style={{ width: '100%' }}>
            <h3>Current Question</h3>
            <div className="question-card">
              <div className="question-text">{currentQuestion.question_text}</div>
              <div className="question-type">Type: {currentQuestion.question_type}</div>
              <div className="question-time">Time Limit: {currentQuestion.time_limit}s</div>
              {currentQuestion.options && (
                <div className="question-options">
                  <h4>Options:</h4>
                  {currentQuestion.options.map((option, index) => (
                    <div key={index} className="option-item">
                      {option}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Question Results */}
        {sessionState === 'results' && questionResults && (
          <Box className="question-results" sx={{ width: '100vw', minHeight: 'calc(100vh - 120px)', position: 'relative', left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: { xs: 1, md: 6 }, py: 4, overflow: 'visible' }}>
            <h3 style={{ width: '100%', textAlign: 'center', marginBottom: '2rem' }}>Question Results</h3>
            <Box className="results-summary" sx={{ display: 'flex', justifyContent: 'center', gap: 4, width: '100%', maxWidth: 900, mb: 4 }}>
              <Box className="stat-card" sx={{ flex: 1, minWidth: 120, textAlign: 'center' }}>
                <div className="stat-number">{questionResults.totalResponses}</div>
                <div className="stat-label">Total Responses</div>
              </Box>
              <Box className="stat-card" sx={{ flex: 1, minWidth: 120, textAlign: 'center' }}>
                <div className="stat-number">{questionResults.correctResponses}</div>
                <div className="stat-label">Correct Answers</div>
              </Box>
              <Box className="stat-card" sx={{ flex: 1, minWidth: 120, textAlign: 'center' }}>
                <div className="stat-number">
                  {questionResults.totalResponses > 0 
                    ? Math.round((questionResults.correctResponses / questionResults.totalResponses) * 100)
                    : 0}%
                </div>
                <div className="stat-label">Success Rate</div>
              </Box>
            </Box>

            {/* Chart */}
            {getChartData() && (
              <Box className="chart-container" sx={{ width: '100%', maxWidth: 1000, height: { xs: 240, md: 400 }, mb: 4 }}>
                <Bar data={getChartData()!} options={{ responsive: true, maintainAspectRatio: false, aspectRatio: 3 }} height={400} />
              </Box>
            )}

            {/* Participant Results */}
            <Box className="participant-results" sx={{ width: '100%', maxWidth: 900, mt: 2 }}>
              <h4>Participant Results</h4>
              {questionResults.participants.map((participant, index) => (
                <div key={index} className={`participant-result ${participant.isCorrect ? 'correct' : 'incorrect'}`}> 
                  <span className="participant-name">{participant.name}</span>
                  <span className="result-status">{participant.isCorrect ? '✓ Correct' : '✗ Incorrect'}</span>
                </div>
              ))}
            </Box>
          </Box>
        )}

        {/* Quiz Complete */}
        {sessionState === 'ended' && (
          <div className="quiz-complete" style={{ width: '100%' }}>
            <h3>Quiz Complete!</h3>
            
            {/* Analytics Section */}
            {sessionInfo && (
              <QuizAnalytics 
                sessionId={parseInt(sessionId!)} 
                quizId={sessionInfo.quiz_id} 
              />
            )}
            
            {/* Final Leaderboard */}
            <div className="final-leaderboard">
              <h4>Final Leaderboard</h4>
              {leaderboard.length > 0 ? (
                leaderboard.map((participant, index) => (
                  <div key={participant.id || index} className="leaderboard-item">
                    <span className="rank">#{index + 1}</span>
                    <span className="name">{participant.name}</span>
                    <span className="score">{participant.total_score} points</span>
                  </div>
                ))
              ) : (
                <div>No leaderboard data available.</div>
              )}
            </div>
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="btn btn-primary"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </Paper>
    </Box>
  );
};

export default QuizSessionCreator; 