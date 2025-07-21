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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#18122B' }}>
      <div style={{ maxWidth: 400, width: '100%', borderRadius: 12, background: '#4B1FA6', color: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        {/* Top section: Create Account and subtitle */}
        <div style={{ background: '#6C38FF', color: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 24, textAlign: 'center' }}>
          <h2 style={{ color: '#fff', margin: 0 }}>Create Account</h2>
          <p style={{ color: '#fff', margin: 0 }}>Join us to start creating amazing quizzes</p>
        </div>
        <div style={{ padding: 24, paddingBottom: 0 }}>
          {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
          {validationErrors.length > 0 && (
            <ul style={{ color: 'orange', marginBottom: 8 }}>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          )}
          <form onSubmit={handleSubmit} autoComplete="off">
            <div>
              <label>Username</label><br />
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            <div>
              <label>Email</label><br />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label>Password</label><br />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label>Confirm Password</label><br />
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !formData.username || !formData.email || !formData.password || !formData.confirmPassword}
              style={{ width: '100%', marginTop: 12, marginBottom: 8, background: '#6C38FF', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 700, fontSize: 16, cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseOver={e => (e.currentTarget.style.background = '#4B1FA6')}
              onMouseOut={e => (e.currentTarget.style.background = '#6C38FF')}
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          <hr style={{ borderColor: '#fff', opacity: 0.2, margin: '24px 0' }} />
          <p style={{ color: '#fff', textAlign: 'center' }}>Already have an account?</p>
          <Link to="/login" style={{ background: '#6C38FF', color: '#fff', textAlign: 'center', display: 'block', marginBottom: 16, borderRadius: 8, padding: '12px 0', fontWeight: 700, fontSize: 16, textDecoration: 'none', transition: 'background 0.2s' }}
            onMouseOver={e => (e.currentTarget.style.background = '#4B1FA6')}
            onMouseOut={e => (e.currentTarget.style.background = '#6C38FF')}
          >Sign In</Link>
          <hr style={{ borderColor: '#fff', opacity: 0.2, margin: '16px 0' }} />
        </div>
        {/* Bottom section: Want to join a quiz */}
        <div style={{ background: '#6C38FF', color: '#fff', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 16, textAlign: 'center' }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Want to join a quiz?</p>
          <p style={{ marginBottom: 8 }}>If you have an access code, you can join without creating an account.</p>
          <Link to="/join" style={{ background: '#4B1FA6', color: '#fff', padding: '10px 0', borderRadius: 8, display: 'block', textDecoration: 'none', fontWeight: 700, margin: '0 auto', maxWidth: 200, transition: 'background 0.2s' }}
            onMouseOver={e => (e.currentTarget.style.background = '#18122B')}
            onMouseOut={e => (e.currentTarget.style.background = '#4B1FA6')}
          >Join Quiz</Link>
        </div>
      </div>
    </div>
  );
};

export default Register; 