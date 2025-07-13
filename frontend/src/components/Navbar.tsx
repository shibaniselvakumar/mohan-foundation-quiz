import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={{
      backgroundColor: 'var(--white)',
      boxShadow: 'var(--shadow)',
      padding: '1rem 0',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <div className="container">
        <div className="flex items-center justify-between">
          {/* Logo/Brand */}
          <Link to="/dashboard" style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--primary-blue)',
            textDecoration: 'none'
          }}>
            NGO Quiz
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/dashboard" style={{
              color: 'var(--gray-700)',
              textDecoration: 'none',
              fontWeight: '500',
              transition: 'color 0.2s ease-in-out'
            }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-blue)'}
               onMouseLeave={(e) => e.currentTarget.style.color = 'var(--gray-700)'}>
              Dashboard
            </Link>
            <Link to="/quiz/create" style={{
              color: 'var(--gray-700)',
              textDecoration: 'none',
              fontWeight: '500',
              transition: 'color 0.2s ease-in-out'
            }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-blue)'}
               onMouseLeave={(e) => e.currentTarget.style.color = 'var(--gray-700)'}>
              Create Quiz
            </Link>
            
            {/* User Menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  border: '2px solid var(--gray-200)',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--white)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-blue)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--gray-200)'}
              >
                <div style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-blue)',
                  color: 'var(--white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600'
                }}>
                  {user?.username.charAt(0).toUpperCase()}
                </div>
                <span style={{ color: 'var(--gray-700)', fontWeight: '500' }}>
                  {user?.username}
                </span>
                <span style={{ color: 'var(--gray-500)' }}>▼</span>
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  backgroundColor: 'var(--white)',
                  border: '1px solid var(--gray-200)',
                  borderRadius: '0.5rem',
                  boxShadow: 'var(--shadow-lg)',
                  minWidth: '200px',
                  zIndex: 1000
                }}>
                  <div style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--gray-200)'
                  }}>
                    <div style={{
                      fontSize: '0.875rem',
                      color: 'var(--gray-500)',
                      marginBottom: '0.25rem'
                    }}>
                      Signed in as
                    </div>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: 'var(--gray-800)'
                    }}>
                      {user?.username}
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: 'var(--gray-600)'
                    }}>
                      {user?.email}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--primary-red)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease-in-out'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--light-red)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden"
            style={{
              padding: '0.5rem',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer'
            }}
          >
            <div style={{
              width: '1.5rem',
              height: '2px',
              backgroundColor: 'var(--gray-700)',
              marginBottom: '0.25rem',
              transition: 'all 0.2s ease-in-out'
            }}></div>
            <div style={{
              width: '1.5rem',
              height: '2px',
              backgroundColor: 'var(--gray-700)',
              marginBottom: '0.25rem',
              transition: 'all 0.2s ease-in-out'
            }}></div>
            <div style={{
              width: '1.5rem',
              height: '2px',
              backgroundColor: 'var(--gray-700)',
              transition: 'all 0.2s ease-in-out'
            }}></div>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden" style={{
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--gray-200)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Link to="/dashboard" style={{
                padding: '0.75rem',
                color: 'var(--gray-700)',
                textDecoration: 'none',
                fontWeight: '500',
                borderRadius: '0.5rem',
                transition: 'background-color 0.2s ease-in-out'
              }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gray-100)'}
                 onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                Dashboard
              </Link>
              <Link to="/quiz/create" style={{
                padding: '0.75rem',
                color: 'var(--gray-700)',
                textDecoration: 'none',
                fontWeight: '500',
                borderRadius: '0.5rem',
                transition: 'background-color 0.2s ease-in-out'
              }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gray-100)'}
                 onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                Create Quiz
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  padding: '0.75rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--primary-red)',
                  textAlign: 'left',
                  fontWeight: '500',
                  cursor: 'pointer',
                  borderRadius: '0.5rem',
                  transition: 'background-color 0.2s ease-in-out'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--light-red)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar; 