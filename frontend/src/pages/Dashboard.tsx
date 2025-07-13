import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

interface Quiz {
  id: number;
  title: string;
  description: string;
  access_code: string;
  status: string;
  created_at: string;
}

const Dashboard: React.FC = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            color: 'var(--gray-800)',
            marginBottom: '0.5rem'
          }}>
            My Quizzes
          </h1>
          <p style={{
            fontSize: '1.125rem',
            color: 'var(--gray-600)'
          }}>
            Create and manage your interactive quizzes
          </p>
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
              <div className="card-header">
                <div className="flex items-center justify-between mb-2">
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    color: 'var(--gray-800)',
                    margin: 0
                  }}>
                    {quiz.title}
                  </h3>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '1rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    backgroundColor: getStatusColor(quiz.status) + '20',
                    color: getStatusColor(quiz.status)
                  }}>
                    {getStatusText(quiz.status)}
                  </span>
                </div>
                {quiz.description && (
                  <p style={{
                    color: 'var(--gray-600)',
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
                  className="btn btn-outline"
                  style={{ flex: 1 }}
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
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={async () => {
                      try {
                        // Get or create active session
                        const response = await axios.get(`/api/quiz/${quiz.id}/active-session`);
                        let sessionId;
                        
                        if (response.data.session) {
                          sessionId = response.data.session.id;
                        } else {
                          // Create a new session
                          const createResponse = await axios.post(`/api/quiz/${quiz.id}/session`);
                          sessionId = createResponse.data.session.id;
                        }
                        
                        // Navigate to the creator session view
                        window.location.href = `/session/${sessionId}/creator`;
                      } catch (error: any) {
                        setError(error.response?.data?.error || 'Failed to start session');
                      }
                    }}
                  >
                    Manage Quiz Session
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
    </div>
  );
};

export default Dashboard; 