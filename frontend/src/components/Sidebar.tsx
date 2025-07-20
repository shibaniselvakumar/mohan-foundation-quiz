import React from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import BarChartIcon from '@mui/icons-material/BarChart';
import LogoutIcon from '@mui/icons-material/Logout';
import { Box, Typography } from '@mui/material';

const drawerWidth = 240;

const navItems = [
  { label: 'Dashboard', icon: <DashboardIcon color="primary" />, path: '/dashboard' },
  { label: 'Create Quiz', icon: <AddCircleIcon color="secondary" />, path: '/quiz/create' }
];

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: drawerWidth,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #2563eb 80%, #e11d48 100%)',
          color: '#fff',
          border: 'none',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
        <Avatar sx={{ bgcolor: '#fff', color: '#2563eb', width: 64, height: 64, mb: 1, fontWeight: 700, fontSize: 32 }}>
          {user?.username?.charAt(0).toUpperCase() || 'U'}
        </Avatar>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
          {user?.username || 'User'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
          {user?.email || ''}
        </Typography>
      </Box>
      <Divider sx={{ bgcolor: 'rgba(255,255,255,0.2)', mb: 2 }} />
      <List>
        {navItems.map((item) => (
          <ListItem key={item.label} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={location.pathname.startsWith(item.path)}
              sx={{
                color: '#fff',
                borderRadius: 2,
                mb: 1,
                '&.Mui-selected, &:hover': {
                  background: 'rgba(255,255,255,0.12)',
                },
              }}
            >
              <ListItemIcon sx={{ color: '#fff', minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      <Box sx={{ px: 2, pb: 3 }}>
        <IconButton
          onClick={handleLogout}
          sx={{ color: '#fff', width: '100%', justifyContent: 'flex-start', borderRadius: 2, p: 1.5, '&:hover': { background: 'rgba(255,255,255,0.12)' } }}
        >
          <LogoutIcon sx={{ mr: 1 }} />
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            Sign out
          </Typography>
        </IconButton>
      </Box>
    </Drawer>
  );
};

export default Sidebar; 