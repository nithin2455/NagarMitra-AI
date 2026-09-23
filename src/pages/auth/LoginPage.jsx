import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES } from '../../models/schema.js';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Shield, UserCheck, HardHat, LogIn, AlertCircle } from 'lucide-react';

export const LoginPage = () => {
  const { login, loading, authError, setAuthError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Intended portal selection tab ('citizen' | 'officer' | 'admin')
  const [selectedPortal, setSelectedPortal] = useState('citizen');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  // Target destination if redirected from a protected route
  const from = location.state?.from?.pathname;

  const getPortalDetails = () => {
    switch (selectedPortal) {
      case 'officer':
        return {
          title: 'Officer Workstation',
          description: 'Authorized access for Municipal Field Officers and Department Engineers.',
          buttonLabel: 'Sign In to Officer Workstation',
          icon: HardHat,
          targetPath: '/officer',
        };
      case 'admin':
        return {
          title: 'Admin Command Center',
          description: 'Supervisory access for Municipal Administration, Department Heads & Auditors.',
          buttonLabel: 'Sign In to Admin Command Center',
          icon: Shield,
          targetPath: '/admin',
        };
      case 'citizen':
      default:
        return {
          title: 'Citizen Portal',
          description: 'Sign in to file grievances, support community issues, and track resolutions.',
          buttonLabel: 'Sign In to Citizen Portal',
          icon: UserCheck,
          targetPath: '/citizen',
        };
    }
  };

  const currentPortal = getPortalDetails();
  const PortalIcon = currentPortal.icon;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (setAuthError) setAuthError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLocalError('Please enter both your email address and password.');
      return;
    }

    try {
      // Pass selectedPortal to verify authorization against Firestore role
      const user = await login(trimmedEmail, password, selectedPortal);
      const destination = from || currentPortal.targetPath;
      navigate(destination, { replace: true });
    } catch (err) {
      setLocalError(err.message || 'Authentication failed. Please verify your credentials.');
    }
  };

  return (
    <div className="container" style={{ padding: '3.5rem 1.5rem', maxWidth: '520px' }}>
      <Card>
        {/* Portal Selector Tabs */}
        <div className="portal-tabs-container">
          <button
            type="button"
            className={`portal-tab-btn ${selectedPortal === 'citizen' ? 'active' : ''}`}
            onClick={() => {
              setSelectedPortal('citizen');
              setLocalError('');
            }}
          >
            <UserCheck size={15} />
            <span>Citizen</span>
          </button>

          <button
            type="button"
            className={`portal-tab-btn ${selectedPortal === 'officer' ? 'active' : ''}`}
            onClick={() => {
              setSelectedPortal('officer');
              setLocalError('');
            }}
          >
            <HardHat size={15} />
            <span>Officer</span>
          </button>

          <button
            type="button"
            className={`portal-tab-btn ${selectedPortal === 'admin' ? 'active' : ''}`}
            onClick={() => {
              setSelectedPortal('admin');
              setLocalError('');
            }}
          >
            <Shield size={15} />
            <span>Admin</span>
          </button>
        </div>

        {/* Portal Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '3rem',
              height: '3rem',
              background: 'var(--primary-50)',
              color: 'var(--primary-700)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem auto',
            }}
          >
            <PortalIcon size={24} />
          </div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>{currentPortal.title}</h1>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
            {currentPortal.description}
          </p>
        </div>

        {/* Error Notification Banner */}
        {(localError || authError) && (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger-text)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              marginBottom: '1.25rem',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{localError || authError}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setLocalError('');
              }}
              placeholder={
                selectedPortal === 'officer'
                  ? 'officer.department@civicpulse.org'
                  : selectedPortal === 'admin'
                  ? 'admin@civicpulse.org'
                  : 'citizen@email.com'
              }
              className="form-input"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setLocalError('');
              }}
              placeholder="••••••••"
              className="form-input"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            icon={LogIn}
            loading={loading}
            disabled={loading}
            style={{ width: '100%', marginTop: '0.75rem' }}
          >
            {loading ? 'Authenticating...' : currentPortal.buttonLabel}
          </Button>
        </form>

        {/* Registration link for citizens */}
        {selectedPortal === 'citizen' && (
          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--slate-500)' }}>
            New to CivicPulse? <Link to="/register" style={{ fontWeight: 600 }}>Create Citizen Account</Link>
          </div>
        )}

        {selectedPortal !== 'citizen' && (
          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.775rem', color: 'var(--slate-400)', lineHeight: '1.4' }}>
            Officer and Administrative credentials are strictly provisioned by Municipal IT Services.
          </div>
        )}
      </Card>
    </div>
  );
};
