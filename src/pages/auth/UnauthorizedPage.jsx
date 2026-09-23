import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES } from '../../models/schema';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ShieldAlert, ArrowLeft, LogOut, LayoutDashboard } from 'lucide-react';

export const UnauthorizedPage = () => {
  const { currentUser, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const attemptedPath = location.state?.attemptedPath || 'the requested page';

  const getAuthorizedHome = () => {
    switch (role) {
      case USER_ROLES.OFFICER:
        return '/officer';
      case USER_ROLES.ADMIN:
        return '/admin';
      case USER_ROLES.CITIZEN:
      default:
        return '/citizen';
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="container" style={{ padding: '4.5rem 1.5rem', maxWidth: '560px', textAlign: 'center' }}>
      <Card>
        <div
          style={{
            width: '3.75rem',
            height: '3.75rem',
            background: 'var(--danger-bg)',
            color: 'var(--danger-solid)',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto',
          }}
        >
          <ShieldAlert size={32} />
        </div>

        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.4rem', color: 'var(--slate-900)' }}>
          403 • Access Restricted
        </h1>

        <p style={{ color: 'var(--slate-600)', fontSize: '0.925rem', lineHeight: '1.55', marginBottom: '1.25rem' }}>
          You are currently authenticated as <strong>{currentUser?.displayName || 'User'}</strong> with role{' '}
          <span
            style={{
              padding: '0.2rem 0.5rem',
              background: 'var(--slate-200)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            {role || 'UNKNOWN'}
          </span>
          .
        </p>

        <div
          style={{
            background: 'var(--slate-50)',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            marginBottom: '1.75rem',
            fontSize: '0.85rem',
            color: 'var(--slate-700)',
            textAlign: 'left',
          }}
        >
          <strong style={{ color: 'var(--danger-text)', display: 'block', marginBottom: '0.25rem' }}>
            Security Rule Enforcement:
          </strong>
          {role === USER_ROLES.CITIZEN && (
            <span>
              Citizens are strictly restricted from accessing Department Officer Workstations and Administrative Command Centers.
            </span>
          )}
          {role === USER_ROLES.OFFICER && (
            <span>
              Department Officers cannot access Administrative Supervision queues or public Citizen action portals directly.
            </span>
          )}
          {role === USER_ROLES.ADMIN && (
            <span>
              This section is outside the administrative routing scope.
            </span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to={getAuthorizedHome()}>
            <Button variant="primary" icon={LayoutDashboard}>
              Go to My Authorized Dashboard
            </Button>
          </Link>
          <Button variant="secondary" icon={LogOut} onClick={handleLogout}>
            Sign Out & Switch User
          </Button>
        </div>
      </Card>
    </div>
  );
};
