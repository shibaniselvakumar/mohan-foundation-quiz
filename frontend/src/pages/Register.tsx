import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';

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
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', py: 4 }}>
      <Card sx={{ maxWidth: 400, width: '100%', boxShadow: 6, borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h4" fontWeight={700} color="primary" align="center" gutterBottom>
            Create Account
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" mb={2}>
            Join us to start creating amazing quizzes
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {validationErrors.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </Alert>
          )}
          <Box component="form" onSubmit={handleSubmit} autoComplete="off" sx={{ mt: 2 }}>
            <TextField
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              fullWidth
              margin="normal"
              required
              disabled={isSubmitting}
              autoFocus
            />
            <TextField
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              fullWidth
              margin="normal"
              required
              disabled={isSubmitting}
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              fullWidth
              margin="normal"
              required
              disabled={isSubmitting}
            />
            <TextField
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              fullWidth
              margin="normal"
              required
              disabled={isSubmitting}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              sx={{ mt: 2, fontWeight: 700, borderRadius: 2 }}
              disabled={isSubmitting || !formData.username || !formData.email || !formData.password || !formData.confirmPassword}
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </Button>
          </Box>
          <Divider sx={{ my: 3 }} />
          <Typography variant="body2" color="text.secondary" align="center" mb={1}>
            Already have an account?
          </Typography>
          <Button
            component={Link}
            to="/login"
            variant="outlined"
            color="primary"
            fullWidth
            sx={{ mb: 2, fontWeight: 700, borderRadius: 2 }}
          >
            Sign In
          </Button>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="subtitle1" color="primary" fontWeight={600} gutterBottom>
              Want to join a quiz?
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={1}>
              If you have an access code, you can join without creating an account.
            </Typography>
            <Button
              component={Link}
              to="/join"
              variant="contained"
              color="secondary"
              fullWidth
              sx={{ fontWeight: 700, borderRadius: 2 }}
            >
              Join Quiz
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Register; 