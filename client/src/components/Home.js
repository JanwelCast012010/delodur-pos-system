import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Wrench,
  CheckCircle,
  ArrowRight,
  Activity,
  People,
  Calculator,
  CarFront,
  Box
} from 'react-bootstrap-icons';
import useCustomModal from '../hooks/useCustomModal';

const Home = () => {
  const navigate = useNavigate();
  const { showAlert } = useCustomModal();
  const [hoveredCard, setHoveredCard] = useState(null);
  const [clickedCard, setClickedCard] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [ripplePosition, setRipplePosition] = useState({ x: 0, y: 0 });

  const systems = [
    {
      id: 1,
      name: 'TRACK V2',
      subtitle: 'DELODUR CORPORATION',
      description: 'Advanced Inventory & Stock Management',
      version: 'v2.0.1',
      features: ['Real-time Inventory', 'Stock Tracking', 'Sales Management', 'Warehouse Control'],
      lastUpdated: '2025-11-24',
      color: '#757575',
      gradient: 'linear-gradient(135deg, #9e9e9e 0%, #616161 100%)',
      icon: Box,
      available: true,
      route: '/dashboard',
      hasLogo: true,
      logoType: 'mercedes'
    },
    {
      id: 2,
      name: 'GERMAN MOTORS',
      subtitle: 'Management System',
      description: 'Automotive Parts & Service Management',
      version: 'v1.0.0',
      features: ['Parts Catalog', 'Service Scheduling', 'Customer Management', 'Order Processing'],
      lastUpdated: 'In Development',
      color: '#21409A',
      gradient: 'linear-gradient(135deg, #21409A 0%, #0d2d6b 100%)',
      icon: CarFront,
      available: false,
      hasLogo: true,
      underDevelopment: true
    },
    {
      id: 3,
      name: 'ACCESS V2',
      subtitle: 'DELODUR CORPORATION',
      description: 'Business Operations & Management',
      version: 'v2.0.0',
      features: ['Business Analytics', 'Operations Dashboard', 'Performance Metrics', 'Data Insights'],
      lastUpdated: 'Coming Soon',
      color: '#000000',
      gradient: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
      icon: Activity,
      available: false,
      hasLogo: true,
      logoType: 'bmw'
    },
    {
      id: 4,
      name: 'HRIS',
      subtitle: 'Human Resources Information System',
      description: 'Employee Management & HR Operations',
      version: 'v1.0.0',
      features: ['Employee Records', 'Payroll Management', 'Attendance Tracking', 'Performance Reviews'],
      lastUpdated: 'Coming Soon',
      color: '#2e7d32',
      gradient: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
      icon: People,
      available: false
    },
    {
      id: 5,
      name: 'ACCOUNTING SYSTEM',
      subtitle: 'GMI x DELO x AMV',
      description: 'Financial Management & Accounting',
      version: 'v1.0.0',
      features: ['General Ledger', 'Accounts Payable', 'Accounts Receivable', 'Financial Reports'],
      lastUpdated: 'Coming Soon',
      color: '#c62828',
      gradient: 'linear-gradient(135deg, #ef5350 0%, #c62828 100%)',
      icon: Calculator,
      available: false
    }
  ];

  const handleSystemClick = async (system, event) => {
    if (system.available) {
      // Get click position for ripple effect
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setRipplePosition({ x, y });
      
      // Set clicked card and start animation
      setClickedCard(system.id);
      
      // Show loading state
      setIsNavigating(true);
      
      // Wait for animation to complete, then navigate
      setTimeout(() => {
        navigate(system.route);
      }, 600); // Match animation duration
    } else {
      await showAlert(
        `${system.name} is coming soon. Please check back later!`,
        'Coming Soon'
      );
    }
  };

  // Mercedes Benz Logo Component
  const MercedesBenzLogo = ({ size = 80 }) => (
    <div style={{
      width: `${size}px`,
      height: `${size}px`,
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    }}>
      <img 
        src="/mercedes-logo.png" 
        alt="Mercedes Benz Logo" 
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'contain',
          marginBottom: '0'
        }} 
      />
    </div>
  );

  // BMW Logo Component
  const BMWLogo = ({ size = 80 }) => (
    <img 
      src="/bmw-logo.png" 
      alt="BMW Logo" 
      style={{ 
        width: `${size}px`, 
        height: `${size}px`, 
        objectFit: 'contain',
        marginBottom: '0'
      }} 
    />
  );

  // German Motors Logo Component
  const GermanMotorsLogo = ({ size = 80 }) => (
    <img 
      src="/german-motors-logo.png" 
      alt="German Motors Logo" 
      style={{ 
        width: `${size}px`, 
        height: `${size}px`, 
        objectFit: 'contain',
        marginBottom: '0'
      }} 
    />
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      padding: '0',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated background orbs */}
      <div style={{
        position: 'absolute',
        width: '800px',
        height: '800px',
        background: 'radial-gradient(circle, rgba(33, 64, 154, 0.15) 0%, transparent 70%)',
        borderRadius: '50%',
        top: '-400px',
        left: '-400px',
        animation: 'floatOrb 20s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(46, 125, 50, 0.12) 0%, transparent 70%)',
        borderRadius: '50%',
        bottom: '-300px',
        right: '-300px',
        animation: 'floatOrb 25s ease-in-out infinite reverse'
      }} />

      {/* Top Navigation Bar */}
      <div style={{
        padding: '30px 60px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-primary)',
        backdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 15px rgba(0, 0, 0, 0.5)'
      }}>
        <div>
          <h1 style={{
            fontSize: '1.8rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: '2px',
            fontFamily: '"Inter", -apple-system, sans-serif'
          }}>
            DELODUR CORPORATION
          </h1>
          <p style={{
            fontSize: '0.75rem',
            color: '#888',
            margin: '4px 0 0 0',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            fontWeight: '300'
          }}>
            MULTI-SYSTEM PLATFORM
          </p>
        </div>
        <div style={{
          display: 'flex',
          gap: '20px',
          alignItems: 'center'
        }}>
          <div style={{
            padding: '8px 16px',
            background: 'rgba(76, 175, 80, 0.15)',
            borderRadius: '8px',
            border: '1px solid rgba(76, 175, 80, 0.3)'
          }}>
            <span style={{ color: '#aaa', fontSize: '0.75rem', marginRight: '8px' }}>Status:</span>
            <span style={{ color: '#4caf50', fontSize: '0.75rem', fontWeight: '600' }}>● All Systems Operational</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        padding: '80px 60px',
        maxWidth: '1800px',
        margin: '0 auto'
      }}>
        {/* Welcome Section */}
        <div style={{
          marginBottom: '60px',
          textAlign: 'center'
        }}>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            marginBottom: '12px',
            fontFamily: '"Inter", -apple-system, sans-serif'
          }}>
            Select Your System
          </h2>
          <p style={{
            fontSize: '1rem',
            color: '#999',
            fontWeight: '400'
          }}>
            Choose from our integrated enterprise management systems
          </p>
        </div>

        {/* Systems Grid - 3x2 Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          gap: '30px',
          position: 'relative',
          zIndex: 1,
          minHeight: '800px'
        }}>
          {systems.map((system) => {
            const isHovered = hoveredCard === system.id;
            const isAvailable = system.available;
            const isUnderDevelopment = system.underDevelopment;
            const IconComponent = system.icon;

            return (
              <div
                key={system.id}
                onClick={(e) => handleSystemClick(system, e)}
                onMouseEnter={() => setHoveredCard(system.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: isHovered 
                    ? `linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)`
                    : 'rgba(255, 255, 255, 0.03)',
                  border: `2px solid ${isHovered ? system.color : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '16px',
                  padding: '50px 40px',
                  minHeight: '420px',
                  cursor: 'pointer',
                  transition: clickedCard === system.id ? 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' : 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: clickedCard === system.id 
                    ? 'translateY(-8px) scale(0.95)' 
                    : isHovered 
                    ? 'translateY(-8px) scale(1.02)' 
                    : 'translateY(0) scale(1)',
                  boxShadow: clickedCard === system.id
                    ? `0 0 0 4px ${system.color}40, 0 24px 48px rgba(0, 0, 0, 0.6)`
                    : isHovered 
                    ? `0 24px 48px rgba(0, 0, 0, 0.4), 0 0 0 1px ${system.color}50`
                    : '0 8px 24px rgba(0, 0, 0, 0.3)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  opacity: clickedCard === system.id ? 0.9 : 1
                }}
              >
                {/* Ripple Effect */}
                {clickedCard === system.id && (
                  <div
                    style={{
                      position: 'absolute',
                      left: ripplePosition.x,
                      top: ripplePosition.y,
                      width: '0',
                      height: '0',
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${system.color}30, transparent)`,
                      transform: 'translate(-50%, -50%)',
                      animation: 'ripple 0.6s ease-out',
                      pointerEvents: 'none',
                      zIndex: 10
                    }}
                  />
                )}
                {/* Gradient overlay on hover */}
                {isHovered && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `linear-gradient(135deg, ${system.color}15 0%, transparent 100%)`,
                    pointerEvents: 'none'
                  }} />
                )}

                {/* Top accent bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: isHovered ? system.gradient : 'transparent',
                  transition: 'all 0.3s ease'
                }} />

                {/* Icon/Logo Section */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '24px'
                }}>
                  {system.hasLogo ? (
                    system.logoType === 'mercedes' ? (
                      <MercedesBenzLogo size={80} />
                    ) : system.logoType === 'bmw' ? (
                      <BMWLogo size={100} />
                    ) : (
                      <GermanMotorsLogo size={80} />
                    )
                  ) : (
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '12px',
                      background: system.gradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 8px 16px ${system.color}30`,
                      transform: isHovered ? 'rotate(5deg) scale(1.1)' : 'rotate(0) scale(1)',
                      transition: 'all 0.3s ease'
                    }}>
                      <IconComponent size={28} color="#ffffff" />
                    </div>
                  )}
                  <div style={{ flex: 1, marginLeft: '16px' }}>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#888',
                      textTransform: 'uppercase',
                      letterSpacing: '2px',
                      marginBottom: '4px',
                      fontWeight: '500'
                    }}>
                      {system.subtitle}
                    </div>
                    <h3 style={{
                      fontSize: '1.8rem',
                      fontWeight: '900',
                      color: isHovered ? system.color : 'var(--text-primary)',
                      margin: 0,
                      letterSpacing: '1px',
                      transition: 'color 0.3s ease',
                      fontFamily: '"Inter", -apple-system, sans-serif'
                    }}>
                      {system.name}
                    </h3>
                  </div>
                </div>

                {/* Description */}
                <p style={{
                  fontSize: '0.9rem',
                  color: '#aaa',
                  marginBottom: '20px',
                  lineHeight: '1.6'
                }}>
                  {system.description}
                </p>

                {/* System Info Section */}
                <div style={{
                  marginBottom: '20px',
                  padding: '16px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  {/* Version */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Version
                    </span>
                    <span style={{ fontSize: '0.85rem', color: system.color, fontWeight: '600' }}>
                      {system.version}
                    </span>
                  </div>

                  {/* Features List */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                      Key Features
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {system.features.slice(0, 3).map((feature, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.8rem',
                          color: '#ccc'
                        }}>
                          <div style={{
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            background: system.color,
                            flexShrink: 0
                          }} />
                          <span>{feature}</span>
                        </div>
                      ))}
                      {system.features.length > 3 && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#888',
                          fontStyle: 'italic',
                          marginTop: '4px'
                        }}>
                          +{system.features.length - 3} more features
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Last Updated */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '12px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Last Updated
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#aaa', fontWeight: '500' }}>
                      {system.lastUpdated}
                    </span>
                  </div>
                </div>

                {/* Footer with status and arrow */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '20px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: isAvailable 
                      ? 'rgba(76, 175, 80, 0.15)' 
                      : isUnderDevelopment
                      ? 'rgba(255, 152, 0, 0.15)'
                      : 'rgba(33, 150, 243, 0.15)',
                    border: `1px solid ${isAvailable ? '#4caf50' : isUnderDevelopment ? '#ff9800' : '#2196f3'}40`
                  }}>
                    {isAvailable ? (
                      <>
                        <CheckCircle size={12} color="#4caf50" />
                        <span style={{ 
                          color: '#4caf50', 
                          fontSize: '0.7rem', 
                          fontWeight: '600',
                          letterSpacing: '1px',
                          textTransform: 'uppercase'
                        }}>
                          Available
                        </span>
                      </>
                    ) : isUnderDevelopment ? (
                      <>
                        <Wrench size={12} color="#ff9800" />
                        <span style={{ 
                          color: '#ff9800', 
                          fontSize: '0.7rem', 
                          fontWeight: '600',
                          letterSpacing: '1px',
                          textTransform: 'uppercase'
                        }}>
                          Under Development
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ 
                          color: '#2196f3', 
                          fontSize: '0.7rem', 
                          fontWeight: '600',
                          letterSpacing: '1px',
                          textTransform: 'uppercase'
                        }}>
                          Coming Soon
                        </span>
                      </>
                    )}
                  </div>
                  
                  {isHovered && (
                    <ArrowRight 
                      size={18} 
                      color={system.color}
                      style={{
                        transition: 'transform 0.3s ease',
                        animation: 'slideRight 0.3s ease'
                      }}
                    />
                  )}
                </div>

                {/* Shine effect */}
                {isHovered && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: `linear-gradient(90deg, transparent, ${system.color}10, transparent)`,
                    animation: 'shine 1.5s ease-in-out',
                    pointerEvents: 'none'
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Loading Overlay */}
      {isNavigating && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--modal-overlay)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.3s ease-in'
        }}>
          <div style={{
            textAlign: 'center'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: `4px solid rgba(117, 117, 117, 0.2)`,
              borderTop: `4px solid #757575`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }} />
            <p style={{
              fontSize: '1.1rem',
              color: 'var(--text-primary)',
              fontWeight: '600',
              margin: 0
            }}>
              Loading TRACK V2...
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes floatOrb {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(50px, 50px) scale(1.1);
          }
        }

        @keyframes shine {
          0% {
            left: -100%;
          }
          100% {
            left: 100%;
          }
        }

        @keyframes slideRight {
          0% {
            opacity: 0;
            transform: translateX(-10px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes ripple {
          0% {
            width: 0;
            height: 0;
            opacity: 1;
          }
          100% {
            width: 300px;
            height: 300px;
            opacity: 0;
          }
        }

        @keyframes fadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default Home;
