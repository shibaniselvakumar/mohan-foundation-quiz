import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import QuizTopbar from '../components/QuizTopbar';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import PersonIcon from '@mui/icons-material/Person';
import VpnKeyIcon from '@mui/icons-material/VpnKey';

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
    if (error) setError(null);
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
      sessionStorage.setItem('participantInfo', JSON.stringify({
        name: formData.participantName.trim(),
        sessionId: response.data.sessionId,
        quizId: response.data.quiz.id,
        participantId: response.data.participantId
      }));
      navigate(`/session/${response.data.sessionId}`);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to join quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <QuizTopbar />
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'var(--background)', py: 4 }}>
        <Card sx={{ maxWidth: 400, width: '100%', boxShadow: 6, borderRadius: 3, bgcolor: 'var(--surface)', color: 'var(--text)' }}>
          <CardContent>
            <Typography variant="h5" fontWeight={700} color="primary" gutterBottom align="center">
              Join a Quiz
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" mb={2}>
              Enter your access code and name to join the quiz session.
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <form onSubmit={handleSubmit} autoComplete="off">
              <TextField
                label="Access Code"
                name="accessCode"
                value={formData.accessCode}
                onChange={handleChange}
                fullWidth
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <VpnKeyIcon color="primary" />
                    </InputAdornment>
                  ),
                }}
                inputProps={{ style: { textTransform: 'uppercase', letterSpacing: 2 } }}
                disabled={isSubmitting}
                required
              />
              <TextField
                label="Your Name"
                name="participantName"
                value={formData.participantName}
                onChange={handleChange}
                fullWidth
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon color="primary" />
                    </InputAdornment>
                  ),
                }}
                inputProps={{ maxLength: 50 }}
                disabled={isSubmitting}
                required
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                sx={{ mt: 2, fontWeight: 700, borderRadius: 2 }}
                disabled={isSubmitting || !formData.accessCode || !formData.participantName}
              >
                {isSubmitting ? 'Joining Quiz...' : 'Join Quiz'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Box>
    </>
  );
};

export default QuizTaker; 