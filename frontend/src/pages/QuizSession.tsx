import React, { useState, useEffect, useRef } from 'react';
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
import QuizTopbar from '../components/QuizTopbar';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import { useMemo } from 'react';
import { useCallback } from 'react';

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
  totalQuestions?: number;
  match_pairs?: { prompt: string; match_text: string }[]; // <-- add this line
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

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

  // Add state for match drag-and-drop
  const [matchPairs, setMatchPairs] = useState<{ prompt: string; match_text: string }[]>([]);
  const [rightOptions, setRightOptions] = useState<string[]>([]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const myAnswerRef = useRef<any>(myAnswer);
  useEffect(() => {
    myAnswerRef.current = myAnswer;
  }, [myAnswer]);

  // Calculate total steps (questions) if available
  // If you have totalQuestions in props or context, use it; otherwise, fallback to 0
  const totalSteps = currentQuestion && typeof currentQuestion.totalQuestions === 'number'
    ? currentQuestion.totalQuestions
    : undefined;

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

    // Listen for show-question event (admin-paced)
    socket.on('show-question', (data) => {
      setSessionState('active');
      setCurrentQuestion({
        id: data.question.id,
        text: data.question.text,
        type: data.question.type,
        options: data.question.options,
        timeLimit: data.question.timeLimit,
        match_pairs: data.question.match_pairs
      });
      setQuestionIndex(data.questionIndex);
      setTimeLeft(data.question.timeLimit);
      setMyAnswer(null);
      setAnswerSubmitted(false);
      setQuestionResults(null);
    });

    socket.on('quiz-started', (data) => {
      setSessionState('active');
      setCurrentQuestion({
        id: data.question.id,
        text: data.question.text,
        type: data.question.type,
        options: data.question.options,
        timeLimit: data.question.timeLimit,
        match_pairs: data.question.match_pairs
      });
      setQuestionIndex(data.questionIndex);
      setTimeLeft(data.question.timeLimit);
      setMyAnswer(null);
      setAnswerSubmitted(false);
      setQuestionResults(null);
    });

    socket.on('next-question', (data) => {
      setSessionState('active');
      setCurrentQuestion({
        id: data.question.id,
        text: data.question.text,
        type: data.question.type,
        options: data.question.options,
        timeLimit: data.question.timeLimit,
        match_pairs: data.question.match_pairs
      });
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
      setSessionState('ended');
      setLeaderboard(data.leaderboard);
    });

    socket.on('answer-submitted', (data) => {
      setMyScore(data.totalScore);
    });

    socket.on('error', (data) => {
      setError(data.message);
    });

    socket.on('question-ended', (data) => {
      setSessionState('results');
      setQuestionResults(data);
      setTimeLeft(0);
      if (data.endedEarly) {
        alert('This question was ended early by the host.');
      }
    });

    socket.on('auto-submit-request', (data) => {
      // Auto-submit the latest answer if present, otherwise submit null
      let answerToSubmit = myAnswerRef.current;
      if (
        answerToSubmit === undefined ||
        answerToSubmit === null ||
        (Array.isArray(answerToSubmit) && answerToSubmit.length === 0)
      ) {
        answerToSubmit = null;
      }
      const timeTaken = currentQuestion && currentQuestion.timeLimit ? currentQuestion.timeLimit - timeLeft : 0;
      socket.emit('submit-answer', {
        answer: answerToSubmit,
        timeTaken
      });
    });

    return () => {
      socket.off('joined-session');
      socket.off('participant-joined');
      socket.off('participant-left');
      socket.off('show-question');
      socket.off('quiz-started');
      socket.off('next-question');
      socket.off('time-up');
      socket.off('question-results');
      socket.off('quiz-ended');
      socket.off('answer-submitted');
      socket.off('error');
      socket.off('question-ended');
      socket.off('auto-submit-request');
    };
  }, [socket, timeLeft, currentQuestion]);

  // When a match question is shown, initialize matchPairs (ordered prompts, empty match_text) and rightOptions (shuffled matches)
  useEffect(() => {
    if (currentQuestion?.type === 'match' && (currentQuestion as any).match_pairs) {
      // Left: prompts in order, right: matches shuffled
      const pairs = (currentQuestion as any).match_pairs as { prompt: string; match_text: string }[];
      setMatchPairs(pairs.map(p => ({ prompt: p.prompt, match_text: '' })));
      setRightOptions(shuffleArray(pairs.map(p => p.match_text)));
    } else {
      setMatchPairs([]);
      setRightOptions([]);
    }
  }, [currentQuestion]);

  // Emit save-draft-answer on blur and visibility change
  useEffect(() => {
    if (!socket || !participantInfo || !currentQuestion) return;
    const handler = () => {
      socket.emit('save-draft-answer', {
        sessionId: participantInfo.sessionId,
        participantId: participantInfo.participantId,
        questionId: currentQuestion.id,
        answer: myAnswer
      });
    };
    window.addEventListener('blur', handler);
    document.addEventListener('visibilitychange', handler);
    return () => {
      window.removeEventListener('blur', handler);
      document.removeEventListener('visibilitychange', handler);
    };
  }, [socket, participantInfo, currentQuestion, myAnswer]);

  // Emit save-draft-answer on unmount
  useEffect(() => {
    return () => {
      if (!socket || !participantInfo || !currentQuestion) return;
      socket.emit('save-draft-answer', {
        sessionId: participantInfo.sessionId,
        participantId: participantInfo.participantId,
        questionId: currentQuestion.id,
        answer: myAnswer
      });
    };
  }, [socket, participantInfo, currentQuestion, myAnswer]);

  // Fallback: emit save-draft-answer when timer is low (2 seconds or less)
  useEffect(() => {
    if (!socket || !participantInfo || !currentQuestion) return;
    if (timeLeft <= 2 && timeLeft > 0) {
      socket.emit('save-draft-answer', {
        sessionId: participantInfo.sessionId,
        participantId: participantInfo.participantId,
        questionId: currentQuestion.id,
        answer: myAnswer
      });
    }
  }, [timeLeft, socket, participantInfo, currentQuestion, myAnswer]);

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

  // When submitting, collect the user's matches as an array of {prompt, match_text}
  const handleMatchSubmit = useCallback(() => {
    if (!socket || !currentQuestion || answerSubmitted) return;
    // Only submit if all matches are filled
    if (matchPairs.some(p => !p.match_text)) return;
    const answer = matchPairs.map(p => ({ prompt: p.prompt, match_text: p.match_text }));
    const timeTaken = currentQuestion.timeLimit - timeLeft;
    socket.emit('submit-answer', { answer, timeTaken });
    setAnswerSubmitted(true);
  }, [socket, currentQuestion, answerSubmitted, matchPairs, timeLeft]);

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
    <>
      <QuizTopbar
        participantName={participantInfo?.name}
        timer={sessionState === 'active' ? timeLeft : undefined}
        step={sessionState === 'active' ? questionIndex : undefined}
        totalSteps={sessionState === 'active' && totalSteps ? totalSteps : undefined}
      />
      <div className="quiz-container">
        <div className="quiz-header">
          <div className="header-accent-bar" style={{ background: 'var(--accent)', height: 8, width: 48, borderRadius: 4, margin: '0 auto 16px auto' }} />
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

            {currentQuestion.type === 'match' && matchPairs.length > 0 && (
  <div style={{ display: 'flex', gap: 48, justifyContent: 'center', alignItems: 'flex-start', margin: '2rem 0' }}>
    {/* LHS: Prompts as drop targets */}
    <div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Prompt</div>
      {matchPairs.map((pair, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ minWidth: 120, fontWeight: 500 }}>{pair.prompt}</div>
          <div
            style={{
              minWidth: 120,
              minHeight: 36,
              background: pair.match_text ? '#6C38FF' : '#F5F3FF',
              border: '2px dashed #6C38FF',
              borderRadius: 8,
              marginLeft: 16,
              padding: '6px 12px',
              color: pair.match_text ? '#fff' : '#4B1FA6',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: answerSubmitted ? 'not-allowed' : 'pointer',
              opacity: answerSubmitted ? 0.6 : 1,
              transition: 'background 0.2s',
            }}
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => {
              if (answerSubmitted) return;
              const matchText = e.dataTransfer.getData('text/plain');
              if (!rightOptions.includes(matchText)) return;
              setMatchPairs(prev => prev.map((p, i) => i === idx ? { ...p, match_text: matchText } : p));
              setRightOptions(prev => prev.filter(opt => opt !== matchText));
            }}
          >
            {pair.match_text ? (
              <span>{pair.match_text}</span>
            ) : (
              <span style={{ color: '#BDBDBD' }}>Drop here</span>
            )}
          </div>
          {pair.match_text && !answerSubmitted && (
            <button
              type="button"
              style={{ marginLeft: 8, background: 'none', border: 'none', color: '#D81B60', cursor: 'pointer', fontWeight: 700 }}
              onClick={() => {
                setRightOptions(prev => [...prev, pair.match_text]);
                setMatchPairs(prev => prev.map((p, i) => i === idx ? { ...p, match_text: '' } : p));
              }}
            >✕</button>
          )}
        </div>
      ))}
    </div>
    {/* RHS: Matches as draggable items */}
    <div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Match</div>
      {rightOptions.map((opt, idx) => (
        <div
          key={opt}
          draggable={!answerSubmitted}
          onDragStart={e => {
            e.dataTransfer.setData('text/plain', opt);
          }}
          style={{
            minWidth: 120,
            minHeight: 36,
            background: '#F5F3FF',
            color: '#4B1FA6',
            borderRadius: 8,
            marginBottom: 16,
            padding: '6px 12px',
            fontWeight: 700,
            opacity: answerSubmitted ? 0.6 : 1,
            cursor: answerSubmitted ? 'not-allowed' : 'grab',
            userSelect: 'none',
            border: '2px solid #6C38FF',
            transition: 'background 0.2s',
          }}
        >
          {opt}
        </div>
      ))}
    </div>
  </div>
)}

            {/* Submit Button */}
            {currentQuestion.type === 'match' ? (
              <button
                onClick={handleMatchSubmit}
                className="submit-btn"
                disabled={
                  answerSubmitted ||
                  matchPairs.some(p => !p.match_text)
                }
              >
                {answerSubmitted ? 'Answer Submitted' : 'Submit Answer'}
              </button>
            ) : (
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
            )}
          </div>
        )}

        {/* Question Results */}
        {sessionState === 'results' && questionResults && (
          <Box sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            bgcolor: 'var(--surface)',
            color: 'var(--text)',
            zIndex: 1300,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 1, md: 4 },
            boxShadow: 12,
            borderRadius: 4,
            overflowY: 'auto',
          }}>
            <div className="stats-header">
              <h2 className="stats-title">Question Results</h2>
              {/* Removed resultsCountdown display */}
            </div>

            <div className="stats-summary" style={{ width: '100%', maxWidth: 900, display: 'flex', justifyContent: 'center', gap: '2rem', margin: '2rem 0' }}>
              <div className="stat-card" style={{ flex: 1, minWidth: 120, textAlign: 'center' }}>
                <div className="stat-number">{questionResults.totalResponses}</div>
                <div className="stat-label">Total Responses</div>
              </div>
              <div className="stat-card" style={{ flex: 1, minWidth: 120, textAlign: 'center' }}>
                <div className="stat-number">{questionResults.correctResponses}</div>
                <div className="stat-label">Correct Answers</div>
              </div>
              <div className="stat-card" style={{ flex: 1, minWidth: 120, textAlign: 'center' }}>
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
              <div className="chart-container" style={{ width: '100%', maxWidth: 1000, height: 320, margin: '2rem 0' }}>
                <Bar data={getChartData()!} options={chartOptions} height={320} />
              </div>
            )}

            {/* Participant Results */}
            <div style={{ marginTop: '1.5rem', width: '100%', maxWidth: 900 }}>
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
          </Box>
        )}

        {/* Final Leaderboard */}
        {sessionState === 'ended' && (
          <div className="leaderboard-container" style={{ background: '#1E1532', borderRadius: 20, boxShadow: '0 8px 32px 0 #864DFF44', padding: 32, margin: '2rem auto', maxWidth: 700, fontFamily: 'Inter, Poppins, sans-serif' }}>
            <div className="leaderboard-header" style={{ marginBottom: 32 }}>
              <h2 className="leaderboard-title" style={{ background: '#864DFF', color: '#fff', borderRadius: 12, padding: '0.75rem 2rem', fontWeight: 800, fontSize: 32, textAlign: 'center', boxShadow: '0 2px 12px #864DFF33' }}>Leaderboard</h2>
            </div>
            {/* Podium for top 3 */}
            {leaderboard.length >= 3 && (
              <Box display="flex" justifyContent="center" alignItems="end" gap={4} mb={6}>
                {[1, 0, 2].map((podiumIdx, i) => (
                  <Box key={podiumIdx} display="flex" flexDirection="column" alignItems="center" justifyContent="end">
                    <Box
                      sx={{
                        width: 80,
                        height: [90, 120, 70][i],
                        background: ['#B39DFF', '#864DFF', '#5B3FA6'][i],
                        borderRadius: 4,
                        boxShadow: '0 4px 16px #864DFF55',
                        display: 'flex',
                        alignItems: 'end',
                        justifyContent: 'center',
                        mb: 1,
                        transition: 'all 0.3s',
                      }}
                    >
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: 28 }}>{podiumIdx + 1}</span>
                    </Box>
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>{leaderboard[podiumIdx]?.name}</span>
                    <span style={{ color: '#864DFF', fontWeight: 700, fontSize: 16 }}>{leaderboard[podiumIdx]?.total_score} pts</span>
                  </Box>
                ))}
              </Box>
            )}
            {/* DataGrid Table for leaderboard */}
            <div style={{ width: '100%', background: '#231A3A', borderRadius: 16, boxShadow: '0 2px 12px #864DFF22', margin: '0 auto', overflow: 'hidden' }}>
              <DataGrid
                autoHeight
                rows={leaderboard.map((entry, idx) => ({ id: idx + 1, ...entry, rank: idx + 1 }))}
                columns={[
                  { field: 'rank', headerName: 'Rank', width: 80, headerAlign: 'center', align: 'center', renderCell: (params: GridRenderCellParams) => <b>{params.value}</b> },
                  { field: 'name', headerName: 'Username', flex: 1, minWidth: 120, headerAlign: 'center', align: 'center', renderCell: (params: GridRenderCellParams) => <span>{params.value}</span> },
                  { field: 'total_score', headerName: 'Points', width: 100, headerAlign: 'center', align: 'center', renderCell: (params: GridRenderCellParams) => <b style={{ color: '#864DFF' }}>{params.value}</b> },
                ]}
                initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                pagination={true}
                hideFooterSelectedRowCount
                sx={{
                  background: 'transparent',
                  color: '#000',
                  border: 'none',
                  fontFamily: 'Satoshi, Inter, Poppins, sans-serif',
                  '& .MuiDataGrid-columnHeaders': {
                    background: '#6C38FF !important',
                    color: '#fff !important',
                    fontWeight: 800,
                    fontFamily: 'Satoshi, Inter, Poppins, sans-serif',
                    fontSize: 18,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                  },
                  '& .MuiDataGrid-columnHeaderTitle': {
                    color: '#fff !important',
                    fontWeight: 800,
                    fontFamily: 'Satoshi, Inter, Poppins, sans-serif',
                  },
                  '& .MuiDataGrid-row': {
                    background: '#fff !important',
                    color: '#18122B !important',
                    fontWeight: 600,
                    fontFamily: 'Satoshi, Inter, Poppins, sans-serif',
                    transition: 'background 0.2s',
                    '&:nth-of-type(even)': { background: '#F5F3FF !important' },
                    '&:hover': { background: '#E0D7FF !important' },
                  },
                  '& .MuiDataGrid-cell': {
                    border: 'none',
                    fontSize: 16,
                    color: '#18122B !important',
                  },
                  '& .MuiDataGrid-virtualScroller': {
                    background: 'transparent',
                  },
                  '& .MuiDataGrid-footerContainer': {
                    display: 'none',
                  },
                }}
              />
            </div>
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => navigate('/join')}
                  className="btn btn-primary"
                >
                  Join Another Quiz
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default QuizSession; 