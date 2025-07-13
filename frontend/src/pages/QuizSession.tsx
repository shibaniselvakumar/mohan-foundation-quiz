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
  text: string;
  type: string;
  options?: string[];
  timeLimit: number;
  imageUrl?: string;
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

interface LeaderboardEntry {
  name: string;
  total_score: number;
  joined_at: string;
}

const QuizSession: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  
  const [sessionState, setSessionState] = useState<'waiting' | 'active' | 'results' | 'ended'>('waiting');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [participantCount, setParticipantCount] = useState(0);
  const [myAnswer, setMyAnswer] = useState<any>(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [questionResults, setQuestionResults] = useState<QuestionResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myScore, setMyScore] = useState(0);
  const [participantInfo, setParticipantInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultsCountdown, setResultsCountdown] = useState(5);

  useEffect(() => {
    // Get participant info from session storage
    const storedInfo = sessionStorage.getItem('participantInfo');
    if (storedInfo) {
      const info = JSON.parse(storedInfo);
      setParticipantInfo(info);
      
      // Join the quiz session
      if (socket && sessionId) {
        socket.emit('join-quiz', {
          sessionId: parseInt(sessionId),
          participantName: info.name,
          participantId: info.participantId
        });
      }
    } else {
      navigate('/join');
    }
  }, [socket, sessionId, navigate]);

  useEffect(() => {
    if (!socket) return;

    // Socket event listeners
    socket.on('joined-session', (data) => {
      console.log('Joined session:', data);
    });

    socket.on('participant-joined', (data) => {
      setParticipantCount(data.totalParticipants);
    });

    socket.on('participant-left', (data) => {
      setParticipantCount(data.totalParticipants);
    });

    socket.on('quiz-started', (data) => {
      setSessionState('active');
      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setTimeLeft(data.question.timeLimit);
      setMyAnswer(null);
      setAnswerSubmitted(false);
      setQuestionResults(null);
    });

    socket.on('next-question', (data) => {
      setSessionState('active');
      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setTimeLeft(data.question.timeLimit);
      setMyAnswer(null);
      setAnswerSubmitted(false);
      setQuestionResults(null);
    });

    socket.on('time-up', () => {
      setTimeLeft(0);
      setAnswerSubmitted(true);
    });

    socket.on('question-results', (results) => {
      setSessionState('results');
      setQuestionResults(results);
      setResultsCountdown(5);
      
      // Start countdown for next question
      const countdownInterval = setInterval(() => {
        setResultsCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on('quiz-ended', (data) => {
      console.log('=== QUIZ ENDED EVENT RECEIVED ===');
      console.log('Data received:', data);
      console.log('Current session state:', sessionState);
      setSessionState('ended');
      setLeaderboard(data.leaderboard);
      console.log('Session state set to ended, leaderboard updated');
    });

    socket.on('answer-submitted', (data) => {
      setMyScore(data.totalScore);
    });

    socket.on('error', (data) => {
      setError(data.message);
    });

    return () => {
      socket.off('joined-session');
      socket.off('participant-joined');
      socket.off('participant-left');
      socket.off('quiz-started');
      socket.off('next-question');
      socket.off('time-up');
      socket.off('question-results');
      socket.off('quiz-ended');
      socket.off('answer-submitted');
      socket.off('error');
    };
  }, [socket]);

  // Timer effect
  useEffect(() => {
    if (timeLeft <= 0 || sessionState !== 'active') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setAnswerSubmitted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, sessionState]);

  const handleAnswerSubmit = () => {
    if (!socket || !currentQuestion || answerSubmitted) return;

    const timeTaken = currentQuestion.timeLimit - timeLeft;
    socket.emit('submit-answer', {
      answer: myAnswer,
      timeTaken
    });
    setAnswerSubmitted(true);
  };

  const handleOptionSelect = (option: string) => {
    if (answerSubmitted) return;

    if (currentQuestion?.type === 'multiple_choice_single') {
      setMyAnswer(option);
    } else if (currentQuestion?.type === 'multiple_choice_multiple') {
    setMyAnswer((prev: string[] | null) => {
        if (!prev) return [option];
        if (Array.isArray(prev)) {
          if (prev.includes(option)) {
            return prev.filter(o => o !== option);
          } else {
            return [...prev, option];
          }
        }
        return [option];
      });
    } else if (currentQuestion?.type === 'true_false') {
      setMyAnswer(option === 'True');
    }
  };

  const handleTypedAnswer = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (answerSubmitted) return;
    setMyAnswer(e.target.value);
  };

  const handleMatchAnswer = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (answerSubmitted) return;
    const value = e.target.value;
    setMyAnswer(value.split(',').map(item => item.trim()));
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
          backgroundColor: [
            'rgba(37, 99, 235, 0.8)',
            'rgba(220, 38, 38, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(139, 92, 246, 0.8)',
          ],
          borderColor: [
            'rgba(37, 99, 235, 1)',
            'rgba(220, 38, 38, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(139, 92, 246, 1)',
          ],
          borderWidth: 1,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  if (!isConnected) {
    return (
      <div className="container">
        <div className="waiting-screen">
          <div className="waiting-icon">🔌</div>
          <div className="waiting-text">Connecting to server...</div>
          <div className="waiting-subtext">Please wait while we establish a connection</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="card text-center">
          <div className="alert alert-error">
            {error}
          </div>
          <button
            onClick={() => navigate('/join')}
            className="btn btn-primary"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      {/* Header */}
      <div className="quiz-header">
        <h1 className="quiz-title">
          {participantInfo?.name ? `${participantInfo.name}'s Quiz` : 'Live Quiz'}
        </h1>
        <p className="quiz-subtitle">
          {sessionState === 'waiting' && 'Waiting for quiz to start...'}
          {sessionState === 'active' && `Question ${questionIndex + 1}`}
          {sessionState === 'results' && 'Question Results'}
          {sessionState === 'ended' && 'Quiz Complete'}
        </p>
      </div>

      {/* Waiting Screen */}
      {sessionState === 'waiting' && (
        <div className="waiting-screen">
          <div className="waiting-icon">⏳</div>
          <div className="waiting-text">Waiting for quiz to start</div>
          <div className="waiting-subtext">
            {participantCount > 0 ? `${participantCount} participant(s) joined` : 'No participants yet'}
          </div>
        </div>
      )}

      {/* Active Question */}
      {sessionState === 'active' && currentQuestion && (
        <div className="question-card">
          {/* Timer */}
          <div className={`timer-container ${timeLeft <= 10 ? 'timer-warning' : ''}`}>
            {formatTime(timeLeft)}
          </div>

          {/* Question Image */}
          {currentQuestion.imageUrl && (
            <img
              src={currentQuestion.imageUrl}
              alt="Question"
              className="question-image"
            />
          )}

          {/* Question Text */}
          <div className="question-text">
            {currentQuestion.text}
          </div>

          {/* Question Options */}
          {currentQuestion.type === 'multiple_choice_single' && currentQuestion.options && (
            <div className="question-options">
              {currentQuestion.options.map((option, index) => (
                <div
                  key={index}
                  className={`option-item ${myAnswer === option ? 'selected' : ''}`}
                  onClick={() => handleOptionSelect(option)}
                >
                  <input
                    type="radio"
                    name="answer"
                    checked={myAnswer === option}
                    onChange={() => handleOptionSelect(option)}
                    className="option-checkbox"
                    disabled={answerSubmitted}
                  />
                  <span className="option-text">{option}</span>
                </div>
              ))}
            </div>
          )}

          {currentQuestion.type === 'multiple_choice_multiple' && currentQuestion.options && (
            <div className="question-options">
              {currentQuestion.options.map((option, index) => (
                <div
                  key={index}
                  className={`option-item ${Array.isArray(myAnswer) && myAnswer.includes(option) ? 'selected' : ''}`}
                  onClick={() => handleOptionSelect(option)}
                >
                  <input
                    type="checkbox"
                    checked={Array.isArray(myAnswer) && myAnswer.includes(option)}
                    onChange={() => handleOptionSelect(option)}
                    className="option-checkbox"
                    disabled={answerSubmitted}
                  />
                  <span className="option-text">{option}</span>
                </div>
              ))}
            </div>
          )}

          {currentQuestion.type === 'true_false' && (
            <div className="question-options">
              <div
                className={`option-item ${myAnswer === true ? 'selected' : ''}`}
                onClick={() => handleOptionSelect('True')}
              >
                <input
                  type="radio"
                  name="answer"
                  checked={myAnswer === true}
                  onChange={() => handleOptionSelect('True')}
                  className="option-checkbox"
                  disabled={answerSubmitted}
                />
                <span className="option-text">True</span>
              </div>
              <div
                className={`option-item ${myAnswer === false ? 'selected' : ''}`}
                onClick={() => handleOptionSelect('False')}
              >
                <input
                  type="radio"
                  name="answer"
                  checked={myAnswer === false}
                  onChange={() => handleOptionSelect('False')}
                  className="option-checkbox"
                  disabled={answerSubmitted}
                />
                <span className="option-text">False</span>
              </div>
            </div>
          )}

          {currentQuestion.type === 'typed_answer' && (
            <div>
              <input
                type="text"
                value={myAnswer || ''}
                onChange={handleTypedAnswer}
                className="answer-input"
                placeholder="Type your answer..."
                disabled={answerSubmitted}
              />
            </div>
          )}

          {currentQuestion.type === 'match' && (
            <div>
              <input
                type="text"
                value={Array.isArray(myAnswer) ? myAnswer.join(', ') : ''}
                onChange={handleMatchAnswer}
                className="answer-input"
                placeholder="Enter matching items separated by commas..."
                disabled={answerSubmitted}
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleAnswerSubmit}
            className="submit-btn"
            disabled={
              answerSubmitted || 
              (myAnswer === null || myAnswer === undefined) || 
              (Array.isArray(myAnswer) && myAnswer.length === 0) ||
              (currentQuestion.type === 'typed_answer' && !myAnswer)
            }
          >
            {answerSubmitted ? 'Answer Submitted' : 'Submit Answer'}
          </button>
        </div>
      )}

      {/* Question Results */}
      {sessionState === 'results' && questionResults && (
        <div className="stats-container">
          <div className="stats-header">
            <h2 className="stats-title">Question Results</h2>
            {resultsCountdown > 0 && (
              <div className="results-countdown">
                Next question in {resultsCountdown} seconds...
              </div>
            )}
          </div>

          <div className="stats-summary">
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
              <Bar data={getChartData()!} options={chartOptions} />
            </div>
          )}

          {/* Participant Results */}
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: 'var(--gray-800)',
              marginBottom: '1rem'
            }}>
              Participant Results
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {questionResults.participants.map((participant, index) => (
                <span
                  key={index}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '2rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    backgroundColor: participant.isCorrect ? '#d1fae5' : '#fee2e2',
                    color: participant.isCorrect ? '#065f46' : '#991b1b'
                  }}
                >
                  {participant.name} {participant.isCorrect ? '✓' : '✗'}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Final Leaderboard */}
      {sessionState === 'ended' && (
        <div className="leaderboard-container">
          <div className="leaderboard-header">
            <h2 className="leaderboard-title">Final Results</h2>
            <p style={{ color: 'var(--gray-600)' }}>
              Your final score: {myScore} points
            </p>
          </div>

          <div>
            {leaderboard.map((entry, index) => (
              <div key={index} className="leaderboard-item">
                <div className={`leaderboard-rank rank-${index + 1 <= 3 ? index + 1 : 'other'}`}>
                  {index + 1}
                </div>
                <div className="leaderboard-name">{entry.name}</div>
                <div className="leaderboard-score">{entry.total_score} pts</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate('/join')}
                className="btn btn-primary"
              >
                Join Another Quiz
              </button>
              <button
                onClick={() => {
                  // Clear session storage and go back to join page
                  sessionStorage.removeItem('participantInfo');
                  navigate('/join');
                }}
                className="btn btn-outline"
              >
                Join Different Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizSession; 