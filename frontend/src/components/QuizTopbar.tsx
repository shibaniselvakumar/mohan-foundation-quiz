import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

interface QuizTopbarProps {
  participantName?: string;
  timer?: number;
  step?: number;
  totalSteps?: number;
}

const QuizTopbar: React.FC<QuizTopbarProps> = ({ participantName, timer, step, totalSteps }) => {
  return (
    <AppBar position="static" color="primary" elevation={2} sx={{ zIndex: 1201 }}>
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', minHeight: 64 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 1 }}>
            NGO Quiz
          </Typography>
          {typeof step === 'number' && typeof totalSteps === 'number' && (
            <Typography variant="body2" sx={{ ml: 2, color: 'rgba(255,255,255,0.85)' }}>
              Question {step + 1} / {totalSteps}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {typeof timer === 'number' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgba(255,255,255,0.08)', px: 1.5, py: 0.5, borderRadius: 2 }}>
              <AccessTimeIcon fontSize="small" sx={{ color: 'secondary.light' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>{timer}s</Typography>
            </Box>
          )}
          {participantName && (
            <Avatar sx={{ bgcolor: 'secondary.main', color: '#fff', fontWeight: 700 }}>
              {participantName.charAt(0).toUpperCase()}
            </Avatar>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default QuizTopbar; 