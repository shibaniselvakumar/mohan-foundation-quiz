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
    <div className="quiz-creator-container">
      {/* Header */}
      <div className="quiz-header">
        <h1 className="quiz-title">Quiz Session Control</h1>
        <p className="quiz-subtitle">
          {sessionState === 'waiting' && 'Waiting for participants...'}
          {sessionState === 'active' && `Question ${questionIndex + 1} of ${questions.length}`}
          {sessionState === 'results' && 'Question Results'}
          {sessionState === 'ended' && 'Quiz Complete'}
        </p>
      </div>

      {/* Session Info */}
      <div className="session-info">
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
      <div className="control-panel">
        <h3>Quiz Controls</h3>
        
        {sessionState === 'waiting' && (
          <div className="control-buttons">
            <button
              onClick={startQuiz}
              className="btn btn-primary"
              disabled={participantCount === 0 || questions.length === 0}
            >
              Start Quiz ({participantCount} participants)
            </button>
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
      <div className="participants-list">
        <h3>Participants ({participantCount})</h3>
        <div className="participants-grid">
          {participants.map((participant) => (
            <div key={participant.id} className="participant-card">
              <div className="participant-name">{participant.name}</div>
              <div className="participant-score">Score: {participant.total_score}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Question */}
      {currentQuestion && sessionState === 'active' && (
        <div className="current-question">
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
        <div className="question-results">
          <h3>Question Results</h3>
          <div className="results-summary">
            <div className="stat-card">
              <div className="stat-number">{questionResults.totalResponses}</div>
              <div className="stat-label">Total Responses</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{questionResults.correctResponses}</div>
              <div className="stat-label">Correct Answers</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">
                {questionResults.totalResponses > 0 
                  ? Math.round((questionResults.correctResponses / questionResults.totalResponses) * 100)
                  : 0}%
              </div>
              <div className="stat-label">Success Rate</div>
            </div>
          </div>

          {/* Chart */}
          {getChartData() && (
            <div className="chart-container">
              <Bar data={getChartData()!} />
            </div>
          )}

          {/* Participant Results */}
          <div className="participant-results">
            <h4>Participant Results</h4>
            {questionResults.participants.map((participant, index) => (
              <div key={index} className={`participant-result ${participant.isCorrect ? 'correct' : 'incorrect'}`}>
                <span className="participant-name">{participant.name}</span>
                <span className="result-status">{participant.isCorrect ? '✓ Correct' : '✗ Incorrect'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quiz Complete */}
      {sessionState === 'ended' && (
        <div className="quiz-complete">
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
            {participants
              .sort((a, b) => b.total_score - a.total_score)
              .map((participant, index) => (
                <div key={participant.id} className="leaderboard-item">
                  <span className="rank">#{index + 1}</span>
                  <span className="name">{participant.name}</span>
                  <span className="score">{participant.total_score} points</span>
                </div>
              ))}
          </div>
          
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-primary"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => {
                // Reset session state and go back to waiting
                setSessionState('waiting');
                setQuestionIndex(0);
                setCurrentQuestion(null);
                setQuestionResults(null);
                setTimeLeft(0);
              }}
              className="btn btn-outline"
            >
              Start New Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizSessionCreator; 