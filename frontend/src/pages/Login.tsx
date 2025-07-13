import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, error, clearError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      return;
    }

    setIsSubmitting(true);
    try {
      await login(formData.username, formData.password);
      navigate('/dashboard');
    } catch (error) {
      // Error is handled by the auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="flex items-center justify-center" style={{ minHeight: '80vh' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div className="card">
            <div className="card-header">
              <h1 style={{
                fontSize: '2rem',
                fontWeight: '700',
                color: 'var(--primary-blue)',
                textAlign: 'center',
                marginBottom: '0.5rem'
              }}>
                Welcome Back
              </h1>
              <p style={{
                textAlign: 'center',
                color: 'var(--gray-600)',
                fontSize: '1rem'
              }}>
                Sign in to your account to continue
              </p>
            </div>

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="username" className="form-label">
                  Username or Email
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter your username or email"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter your password"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={isSubmitting || !formData.username || !formData.password}
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div style={{
              textAlign: 'center',
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid var(--gray-200)'
            }}>
              <p style={{ color: 'var(--gray-600)', marginBottom: '1rem' }}>
                Don't have an account?
              </p>
              <Link
                to="/register"
                className="btn btn-outline"
                style={{ width: '100%' }}
              >
                Create Account
              </Link>
            </div>
          </div>

          <div style={{
            textAlign: 'center',
            marginTop: '2rem',
            padding: '1.5rem',
            backgroundColor: 'var(--light-blue)',
            borderRadius: '0.75rem',
            border: '1px solid var(--primary-blue)'
          }}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: 'var(--primary-blue)',
              marginBottom: '0.5rem'
            }}>
              Want to join a quiz?
            </h3>
            <p style={{
              color: 'var(--gray-600)',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              If you have an access code, you can join without creating an account.
            </p>
            <Link
              to="/join"
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              Join Quiz
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login; 