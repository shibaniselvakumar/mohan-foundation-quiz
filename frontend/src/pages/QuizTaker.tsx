import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const QuizTaker: React.FC = () => {
  const [formData, setFormData] = useState({
    accessCode: '',
    participantName: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.accessCode || !formData.participantName) {
      setError('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post('/api/quiz/join', {
        accessCode: formData.accessCode.toUpperCase(),
        participantName: formData.participantName.trim()
      });

      // Store participant info in session storage
      sessionStorage.setItem('participantInfo', JSON.stringify({
        name: formData.participantName.trim(),
        sessionId: response.data.sessionId,
        quizId: response.data.quiz.id,
        participantId: response.data.participantId
      }));

      // Navigate to quiz session
      navigate(`/session/${response.data.sessionId}`);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to join quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="flex items-center justify-center" style={{ minHeight: '80vh' }}>
        <div style={{ width: '100%', maxWidth: '500px' }}>
          <div className="card">
            <div className="card-header">
              <h1 style={{
                fontSize: '2.5rem',
                fontWeight: '700',
                color: 'var(--primary-blue)',
                textAlign: 'center',
                marginBottom: '0.5rem'
              }}>
                Join Quiz
              </h1>
              <p style={{
                textAlign: 'center',
                color: 'var(--gray-600)',
                fontSize: '1.125rem'
              }}>
                Enter the access code provided by your quiz creator
              </p>
            </div>

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="accessCode" className="form-label">
                  Access Code
                </label>
                <input
                  type="text"
                  id="accessCode"
                  name="accessCode"
                  value={formData.accessCode}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter the 6-character access code"
                  maxLength={6}
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.5rem',
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    textAlign: 'center'
                  }}
                  required
                  disabled={isSubmitting}
                />
                <div style={{
                  fontSize: '0.875rem',
                  color: 'var(--gray-500)',
                  marginTop: '0.5rem',
                  textAlign: 'center'
                }}>
                  Example: ABC123
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="participantName" className="form-label">
                  Your Name
                </label>
                <input
                  type="text"
                  id="participantName"
                  name="participantName"
                  value={formData.participantName}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter your name to display on the leaderboard"
                  maxLength={50}
                  required
                  disabled={isSubmitting}
                />
                <div style={{
                  fontSize: '0.875rem',
                  color: 'var(--gray-500)',
                  marginTop: '0.5rem'
                }}>
                  This name will be displayed on the leaderboard
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={isSubmitting || !formData.accessCode || !formData.participantName}
              >
                {isSubmitting ? 'Joining Quiz...' : 'Join Quiz'}
              </button>
            </form>

            <div style={{
              textAlign: 'center',
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid var(--gray-200)'
            }}>
              <p style={{ color: 'var(--gray-600)', marginBottom: '1rem' }}>
                Are you a quiz creator?
              </p>
              <a
                href="/login"
                className="btn btn-outline"
                style={{ width: '100%' }}
              >
                Sign In to Create Quizzes
              </a>
            </div>
          </div>

          {/* Information Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div style={{
              backgroundColor: 'var(--light-blue)',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--primary-blue)'
            }}>
              <div style={{
                fontSize: '2rem',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>
                ⏱️
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: 'var(--primary-blue)',
                marginBottom: '0.5rem',
                textAlign: 'center'
              }}>
                Timed Questions
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: 'var(--gray-600)',
                textAlign: 'center',
                margin: 0
              }}>
                Answer questions within the time limit for maximum points
              </p>
            </div>

            <div style={{
              backgroundColor: 'var(--light-red)',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--primary-red)'
            }}>
              <div style={{
                fontSize: '2rem',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>
                📊
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: 'var(--primary-red)',
                marginBottom: '0.5rem',
                textAlign: 'center'
              }}>
                Live Statistics
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: 'var(--gray-600)',
                textAlign: 'center',
                margin: 0
              }}>
                See real-time results and compare with other participants
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div style={{
            backgroundColor: 'var(--white)',
            padding: '1.5rem',
            borderRadius: '0.75rem',
            boxShadow: 'var(--shadow)',
            marginTop: '1.5rem'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: 'var(--gray-800)',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              How it works
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-blue)',
                  color: 'var(--white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  flexShrink: 0
                }}>
                  1
                </div>
                <div>
                  <h4 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: 'var(--gray-800)',
                    marginBottom: '0.25rem'
                  }}>
                    Join with Access Code
                  </h4>
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--gray-600)',
                    margin: 0
                  }}>
                    Enter the access code provided by your quiz creator
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-blue)',
                  color: 'var(--white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  flexShrink: 0
                }}>
                  2
                </div>
                <div>
                  <h4 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: 'var(--gray-800)',
                    marginBottom: '0.25rem'
                  }}>
                    Wait for Quiz to Start
                  </h4>
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--gray-600)',
                    margin: 0
                  }}>
                    The quiz creator will start the session when ready
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-blue)',
                  color: 'var(--white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  flexShrink: 0
                }}>
                  3
                </div>
                <div>
                  <h4 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: 'var(--gray-800)',
                    marginBottom: '0.25rem'
                  }}>
                    Answer Questions
                  </h4>
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--gray-600)',
                    margin: 0
                  }}>
                    Answer questions within the time limit and see live results
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizTaker; 