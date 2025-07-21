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
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#18122B', py: 4 }}>
      <Card sx={{ maxWidth: 400, width: '100%', boxShadow: 6, borderRadius: 3, bgcolor: '#4B1FA6', color: '#fff' }}>
        {/* Top section: Welcome and subtitle */}
        <Box sx={{ bgcolor: '#6C38FF', color: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, p: 3, textAlign: 'center' }}>
          <Typography variant="h4" fontWeight={700} sx={{ color: '#fff' }} gutterBottom>
            Welcome Back
          </Typography>
          <Typography variant="body2" sx={{ color: '#fff', mb: 2 }}>
            Sign in to your account to continue
          </Typography>
        </Box>
        <CardContent sx={{ p: 3, pb: 0 }}>
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
              fullWidth
              size="large"
              sx={{ mt: 2, fontWeight: 700, borderRadius: 2, bgcolor: '#6C38FF', color: '#fff', '&:hover': { bgcolor: '#4B1FA6' } }}
              disabled={isSubmitting || !formData.username || !formData.password}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </Box>
          <Divider sx={{ my: 3, bgcolor: '#fff', opacity: 0.2 }} />
          <Typography variant="body2" color="text.secondary" align="center" mb={1}>
            Don't have an account?
          </Typography>
          <Button
            component={Link}
            to="/register"
            variant="contained"
            fullWidth
            sx={{ mb: 2, fontWeight: 700, borderRadius: 2, bgcolor: '#6C38FF', color: '#fff', '&:hover': { bgcolor: '#4B1FA6' } }}
          >
            Create Account
          </Button>
          <Divider sx={{ my: 2, bgcolor: '#fff', opacity: 0.2 }} />
          {/* Bottom section: Want to join a quiz */}
          <Box sx={{ bgcolor: '#6C38FF', color: '#fff', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, p: 2, mt: 3, textAlign: 'center' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Want to join a quiz?
            </Typography>
            <Typography variant="body2" mb={1}>
              If you have an access code, you can join without creating an account.
            </Typography>
            <Button
              component={Link}
              to="/join"
              variant="contained"
              fullWidth
              sx={{ fontWeight: 700, borderRadius: 2, bgcolor: '#4B1FA6', color: '#fff', '&:hover': { bgcolor: '#18122B' } }}
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