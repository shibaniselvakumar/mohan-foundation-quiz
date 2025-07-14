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
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', py: 4 }}>
      <Card sx={{ maxWidth: 400, width: '100%', boxShadow: 6, borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h4" fontWeight={700} color="primary" align="center" gutterBottom>
            Welcome Back
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" mb={2}>
            Sign in to your account to continue
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit} autoComplete="off" sx={{ mt: 2 }}>
            <TextField
              label="Username or Email"
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
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              sx={{ mt: 2, fontWeight: 700, borderRadius: 2 }}
              disabled={isSubmitting || !formData.username || !formData.password}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </Box>
          <Divider sx={{ my: 3 }} />
          <Typography variant="body2" color="text.secondary" align="center" mb={1}>
            Don't have an account?
          </Typography>
          <Button
            component={Link}
            to="/register"
            variant="outlined"
            color="primary"
            fullWidth
            sx={{ mb: 2, fontWeight: 700, borderRadius: 2 }}
          >
            Create Account
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

export default Login; 