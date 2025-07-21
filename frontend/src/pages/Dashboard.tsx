import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import QuizAnalytics from '../components/QuizAnalytics';
import Modal from '@mui/material/Modal';

interface Quiz {
  id: number;
  title: string;
  description: string;
  access_code: string;
  status: string;
  created_at: string;
  latestSessionId?: string; // Added for analytics link
}

const Dashboard: React.FC = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/quiz');
      setQuizzes(response.data.quizzes);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to fetch quizzes');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'var(--gray-500)';
      case 'active':
        return 'var(--primary-blue)';
      case 'completed':
        return '#10b981';
      default:
        return 'var(--gray-500)';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewAnalytics = async (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setAnalyticsModalOpen(true);
    setSelectedSessionId(null);
    setLoadingSessions(true);
    setSessionsError(null);
    try {
      const response = await axios.get(`/api/quiz/${quiz.id}/sessions`);
      setSessions(response.data.sessions);
    } catch (error: any) {
      setSessionsError(error.response?.data?.error || 'Failed to fetch sessions');
    } finally {
      setLoadingSessions(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
          <div className="text-center">
            <div className="pulse" style={{ fontSize: '2rem', color: 'var(--primary-blue)' }}>Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container dashboard-container">
      <div className="dashboard-header">
        <div className="header-accent-bar" style={{ background: 'var(--accent)', height: 8, width: 8, borderRadius: 4, marginRight: 24 }} />
        <div>
          <h1 className="dashboard-title">My Quizzes</h1>
          <p className="dashboard-subtitle">Create and manage your interactive quizzes</p>
        </div>
        <Link to="/quiz/create" className="btn btn-primary btn-lg">
          Create New Quiz
        </Link>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {quizzes.length === 0 ? (
        <div className="card text-center">
          <div style={{
            fontSize: '4rem',
            color: 'var(--gray-400)',
            marginBottom: '1rem'
          }}>
            📝
          </div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            color: 'var(--gray-700)',
            marginBottom: '0.5rem'
          }}>
            No quizzes yet
          </h2>
          <p style={{
            color: 'var(--gray-600)',
            marginBottom: '2rem'
          }}>
            Create your first quiz to get started
          </p>
          <Link to="/quiz/create" className="btn btn-primary btn-lg">
            Create Your First Quiz
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="card" style={{ height: 'fit-content' }}>
              <div className="card-header" style={{ background: '#6C38FF', borderRadius: '0.75rem 0.75rem 0 0', padding: '1.25rem 1.5rem', margin: '-1.5rem -1.5rem 1rem -1.5rem' }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    color: '#fff',
                    margin: 0
                  }}>
                    {quiz.title}
                  </h3>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '1rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    color: '#fff'
                  }}>
                    {getStatusText(quiz.status)}
                  </span>
                </div>
                {quiz.description && (
                  <p style={{
                    color: '#fff',
                    fontSize: '0.875rem',
                    margin: 0
                  }}>
                    {quiz.description}
                  </p>
                )}
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem'
                }}>
                  <span style={{
                    fontSize: '0.875rem',
                    color: 'var(--gray-500)',
                    fontWeight: '500'
                  }}>
                    Access Code:
                  </span>
                  <code style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: 'var(--gray-100)',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--primary-blue)'
                  }}>
                    {quiz.access_code}
                  </code>
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: 'var(--gray-500)'
                }}>
                  Created: {formatDate(quiz.created_at)}
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  to={`/quiz/${quiz.id}`}
                  className="btn dashboard-action-btn"
                  style={{ flex: 1, background: '#6C38FF', color: '#fff', border: '2px solid #fff', transition: 'background 0.2s, color 0.2s', fontFamily: 'Satoshi, Inter, Poppins, sans-serif' }}
                >
                  Edit Quiz
                </Link>
                {quiz.status === 'draft' && (
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={async () => {
                      try {
                        await axios.put(`/api/quiz/${quiz.id}`, { status: 'active' });
                        fetchQuizzes();
                      } catch (error: any) {
                        setError(error.response?.data?.error || 'Failed to activate quiz');
                      }
                    }}
                  >
                    Activate
                  </button>
                )}
                {quiz.status === 'active' && (
                  <button
                    className="btn dashboard-action-btn"
                    style={{ flex: 1, background: '#6C38FF', color: '#fff', border: '2px solid #fff', transition: 'background 0.2s, color 0.2s', fontFamily: 'Satoshi, Inter, Poppins, sans-serif' }}
                    onClick={() => handleViewAnalytics(quiz)}
                  >
                    View Analytics
                  </button>
                )}
                {quiz.status === 'active' && (
                  <button
                    className="btn dashboard-action-btn"
                    style={{ flex: 1, background: '#6C38FF', color: '#fff', border: '2px solid #fff', transition: 'background 0.2s, color 0.2s', fontFamily: 'Satoshi, Inter, Poppins, sans-serif' }}
                    onClick={async () => {
                      try {
                        // Always create a new session
                        const createResponse = await axios.post(`/api/quiz/${quiz.id}/session`);
                        const sessionId = createResponse.data.session.id;
                        // Navigate to the creator session view
                        window.location.href = `/session/${sessionId}/creator`;
                      } catch (error: any) {
                        setError(error.response?.data?.error || 'Failed to start session');
                      }
                    }}
                  >
                    Start Quiz Session
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Stats */}
      {quizzes.length > 0 && (
        <div className="card mt-6">
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            color: 'var(--gray-800)',
            marginBottom: '1.5rem'
          }}>
            Quick Stats
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="stat-number">{quizzes.length}</div>
              <div className="stat-label">Total Quizzes</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">
                {quizzes.filter(q => q.status === 'active').length}
              </div>
              <div className="stat-label">Active Quizzes</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">
                {quizzes.filter(q => q.status === 'completed').length}
              </div>
              <div className="stat-label">Completed Quizzes</div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      <Modal
        open={analyticsModalOpen}
        onClose={() => setAnalyticsModalOpen(false)}
        aria-labelledby="analytics-modal-title"
        aria-describedby="analytics-modal-description"
      >
        <div className="modal-content" style={{ background: '#18122B', color: '#fff', fontFamily: 'Satoshi, Inter, Poppins, sans-serif', padding: 32, borderRadius: 12, maxWidth: 900, margin: '4rem auto', outline: 'none', maxHeight: '80vh', overflowY: 'auto' }}>
          <h2 id="analytics-modal-title" style={{ marginBottom: 24 }}>
            {selectedQuiz ? `Analytics for: ${selectedQuiz.title}` : 'Analytics'}
          </h2>
          {loadingSessions ? (
            <div>Loading sessions...</div>
          ) : sessionsError ? (
            <div className="alert alert-error">{sessionsError}</div>
          ) : (
            <>
              {selectedSessionId ? (
                <>
                  <button className="btn btn-secondary" style={{ marginBottom: 16 }} onClick={() => setSelectedSessionId(null)}>
                    Back to Sessions
                  </button>
                  <QuizAnalytics quizId={selectedQuiz!.id} sessionId={selectedSessionId} />
                </>
              ) : (
                <>
                  <h3 style={{ marginBottom: 16 }}>Quiz Sessions</h3>
                  {sessions.length === 0 ? (
                    <div>No sessions found for this quiz.</div>
                  ) : (
                    <table className="analytics-table" style={{ width: '100%', marginBottom: 24 }}>
                      <thead>
                        <tr>
                          <th>Session Code</th>
                          <th>Status</th>
                          <th>Created At</th>
                          <th>Started At</th>
                          <th>Ended At</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map(session => (
                          <tr key={session.id}>
                            <td>{session.session_code}</td>
                            <td>{session.status}</td>
                            <td>{session.created_at ? new Date(session.created_at).toLocaleString() : '-'}</td>
                            <td>{session.started_at ? new Date(session.started_at).toLocaleString() : '-'}</td>
                            <td>{session.ended_at ? new Date(session.ended_at).toLocaleString() : '-'}</td>
                            <td>
                              <button
                                className="btn btn-sm dashboard-action-btn"
                                style={{ background: '#6C38FF', color: '#fff', border: '2px solid #fff', transition: 'background 0.2s, color 0.2s', fontFamily: 'Satoshi, Inter, Poppins, sans-serif' }}
                                onClick={() => setSelectedSessionId(session.id)}
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </>
          )}
          <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => setAnalyticsModalOpen(false)}>
            Close
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard; 