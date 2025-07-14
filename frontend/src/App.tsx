import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import QuizCreator from './pages/QuizCreator';
import QuizTaker from './pages/QuizTaker';
import QuizSession from './pages/QuizSession';
import QuizSessionCreator from './pages/QuizSessionCreator';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './App.css';
import Sidebar from './components/Sidebar';
import Box from '@mui/material/Box';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2563eb', // blue
      dark: '#1e40af',
      contrastText: '#fff',
    },
    secondary: {
      main: '#e11d48', // red
      dark: '#9f1239',
      contrastText: '#fff',
    },
    background: {
      default: '#f8fafc',
      paper: '#fff',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: [
      'Inter',
      'Segoe UI',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 12,
  },
});

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="container">
        <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
          <div className="text-center">
            <div className="pulse" style={{ fontSize: '2rem', color: 'var(--primary-blue)' }}>Loading...</div>
          </div>
        </div>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

// Public Route Component (redirects if already logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="container">
        <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
          <div className="text-center">
            <div className="pulse" style={{ fontSize: '2rem', color: 'var(--primary-blue)' }}>Loading...</div>
          </div>
        </div>
      </div>
    );
  }
  
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>;
};

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Show sidebar only on creator/admin pages
  const showSidebar = user && (
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/quiz/create') ||
    location.pathname.startsWith('/analytics')
  );

  return (
    <div className="App">
      {showSidebar ? (
        <Box sx={{ display: 'flex' }}>
          <Sidebar />
          <Box component="main" sx={{ flexGrow: 1, minHeight: '100vh', background: 'var(--background)' }}>
            <Routes>
              <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
              
              {/* Public Routes */}
              <Route 
                path="/login" 
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } 
              />
              <Route 
                path="/register" 
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                } 
              />
              <Route path="/join" element={<QuizTaker />} />
              
              {/* Protected Routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/quiz/create" 
                element={
                  <ProtectedRoute>
                    <QuizCreator />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/quiz/:quizId" 
                element={
                  <ProtectedRoute>
                    <QuizCreator />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/session/:sessionId" 
                element={<QuizSession />}
              />
              <Route 
                path="/session/:sessionId/creator" 
                element={
                  <ProtectedRoute>
                    <QuizSessionCreator />
                  </ProtectedRoute>
                } 
              />
              
              {/* 404 Route */}
              <Route path="*" element={
                <div className="container">
                  <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
                    <div className="text-center">
                      <h1 className="mb-4" style={{ fontSize: '3rem', color: 'var(--primary-red)' }}>404</h1>
                      <p className="mb-6" style={{ fontSize: '1.25rem', color: 'var(--gray-600)' }}>
                        Page not found
                      </p>
                      <a href="/" className="btn btn-primary">
                        Go Home
                      </a>
                    </div>
                  </div>
                </div>
              } />
            </Routes>
          </Box>
        </Box>
      ) : (
        // No sidebar, just render app content
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
            
            {/* Public Routes */}
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } 
            />
            <Route 
              path="/register" 
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              } 
            />
            <Route path="/join" element={<QuizTaker />} />
            
            {/* Protected Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/quiz/create" 
              element={
                <ProtectedRoute>
                  <QuizCreator />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/quiz/:quizId" 
              element={
                <ProtectedRoute>
                  <QuizCreator />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/session/:sessionId" 
              element={<QuizSession />}
            />
            <Route 
              path="/session/:sessionId/creator" 
              element={
                <ProtectedRoute>
                  <QuizSessionCreator />
                </ProtectedRoute>
              } 
            />
            
            {/* 404 Route */}
            <Route path="*" element={
              <div className="container">
                <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
                  <div className="text-center">
                    <h1 className="mb-4" style={{ fontSize: '3rem', color: 'var(--primary-red)' }}>404</h1>
                    <p className="mb-6" style={{ fontSize: '1.25rem', color: 'var(--gray-600)' }}>
                      Page not found
                    </p>
                    <a href="/" className="btn btn-primary">
                      Go Home
                    </a>
                  </div>
                </div>
              </div>
            } />
          </Routes>
        </main>
      )}
    </div>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <div className="app-bg">
          <AuthProvider>
            <SocketProvider>
              <AppContent />
            </SocketProvider>
          </AuthProvider>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App; 