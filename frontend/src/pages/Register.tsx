import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { register, error, clearError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    clearError();
  }, [clearError]);

  const validateForm = () => {
    const errors: string[] = [];

    if (formData.username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }

    if (!formData.email.includes('@')) {
      errors.push('Please enter a valid email address');
    }

    if (formData.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    if (formData.password !== formData.confirmPassword) {
      errors.push('Passwords do not match');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await register(formData.username, formData.email, formData.password);
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
                Create Account
              </h1>
              <p style={{
                textAlign: 'center',
                color: 'var(--gray-600)',
                fontSize: '1rem'
              }}>
                Join us to start creating amazing quizzes
              </p>
            </div>

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            {validationErrors.length > 0 && (
              <div className="alert alert-warning">
                <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="username" className="form-label">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Choose a username"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter your email address"
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
                  placeholder="Create a password"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Confirm your password"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={isSubmitting || !formData.username || !formData.email || !formData.password || !formData.confirmPassword}
              >
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            <div style={{
              textAlign: 'center',
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid var(--gray-200)'
            }}>
              <p style={{ color: 'var(--gray-600)', marginBottom: '1rem' }}>
                Already have an account?
              </p>
              <Link
                to="/login"
                className="btn btn-outline"
                style={{ width: '100%' }}
              >
                Sign In
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

export default Register; 