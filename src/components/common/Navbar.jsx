import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES } from '../../models/schema.js';
import { ShieldAlert, LogOut, LayoutDashboard, PlusCircle, Compass, HardHat, Shield, Search, FileText, CheckSquare, Clock } from 'lucide-react';
import { Button } from './Button';
import { NotificationBell } from './NotificationBell';

export const Navbar = () => {
  const { currentUser, role, isAuthenticated, isDepartmentAdmin, isSuperAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isAnyAdmin = isDepartmentAdmin || isSuperAdmin;

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand-logo">
          <div className="brand-icon">
            <ShieldAlert size={20} />
          </div>
          <span>CIVIC<span style={{ color: 'var(--primary-600)' }}>PULSE</span></span>
        </Link>

        <ul className="nav-links">
          <li>
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
              Home
            </NavLink>
          </li>

          {/* Authenticated Citizen Navigation */}
          {isAuthenticated && role === USER_ROLES.CITIZEN && (
            <>
              <li>
                <NavLink to="/feed" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Compass size={15} style={{ display: 'inline', marginRight: 5 }} />
                  Community Feed
                </NavLink>
              </li>
              <li>
                <NavLink to="/track" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Search size={15} style={{ display: 'inline', marginRight: 5 }} />
                  Track Grievance
                </NavLink>
              </li>
              <li>
                <NavLink to="/citizen" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                  <LayoutDashboard size={15} style={{ display: 'inline', marginRight: 5 }} />
                  Citizen Portal
                </NavLink>
              </li>
              <li>
                <NavLink to="/citizen/report" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <PlusCircle size={15} style={{ display: 'inline', marginRight: 5 }} />
                  Report Issue
                </NavLink>
              </li>
              <li>
                <NavLink to="/citizen/my-grievances" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <FileText size={15} style={{ display: 'inline', marginRight: 5 }} />
                  My Submissions
                </NavLink>
              </li>
            </>
          )}

          {/* Authenticated Officer Navigation */}
          {isAuthenticated && role === USER_ROLES.OFFICER && (
            <>
              <li>
                <NavLink to="/officer" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                  <HardHat size={15} style={{ display: 'inline', marginRight: 5 }} />
                  Officer Workstation
                </NavLink>
              </li>
              <li>
                <NavLink to="/officer/inbox" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Assigned Inbox
                </NavLink>
              </li>
              <li>
                <NavLink to="/feed" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Compass size={15} style={{ display: 'inline', marginRight: 5 }} />
                  Community Feed
                </NavLink>
              </li>
              <li>
                <NavLink to="/track" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Search size={15} style={{ display: 'inline', marginRight: 5 }} />
                  Track Grievance
                </NavLink>
              </li>
            </>
          )}

          {/* Authenticated Department Admin / Super Admin Navigation */}
          {isAuthenticated && isAnyAdmin && (
            <>
              <li>
                <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                  <Shield size={15} style={{ display: 'inline', marginRight: 5 }} />
                  {isDepartmentAdmin ? `${currentUser?.departmentId ? currentUser.departmentId.toUpperCase() : ''} Admin` : 'Command Center'}
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin/sla-approvals" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Clock size={15} style={{ display: 'inline', marginRight: 5 }} />
                  SLA Approvals
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin/verifications" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <CheckSquare size={15} style={{ display: 'inline', marginRight: 5 }} />
                  Verifications
                </NavLink>
              </li>
              <li>
                <NavLink to="/feed" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Compass size={15} style={{ display: 'inline', marginRight: 5 }} />
                  Community Feed
                </NavLink>
              </li>
              <li>
                <NavLink to="/track" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Search size={15} style={{ display: 'inline', marginRight: 5 }} />
                  Track Grievance
                </NavLink>
              </li>
            </>
          )}
        </ul>

        <div className="nav-actions">
          {isAuthenticated && currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <NotificationBell />
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--slate-800)' }}>
                  {currentUser.displayName}
                </span>
                <span style={{ fontSize: '0.725rem', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>
                  {isDepartmentAdmin ? `${currentUser.departmentId} Admin` : isSuperAdmin ? 'Super Admin' : currentUser.role}
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={handleLogout} icon={LogOut}>
                Logout
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link to="/login">
                <Button variant="secondary" size="sm">Sign In</Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">Register</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
