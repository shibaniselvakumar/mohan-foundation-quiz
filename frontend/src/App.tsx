import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import './App.css';

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

  return (
    <Router>
      <div className="App">
        {user && <Navbar />}
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
      </div>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
};

export default App; 