import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, AlertCircle, AlertTriangle, Info, ShieldAlert, ExternalLink } from 'lucide-react';
import { notificationService } from '../../services/governance/notificationService.js';
import { grievanceService } from '../../services/firebase/grievanceService.js';
import { useAuth } from '../../context/AuthContext';
import { NOTIFICATION_SEVERITY } from '../../models/schema.js';

export const NotificationBell = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    if (!currentUser) return;
    try {
      // Process live grievances & fetch updated notifications
      const grievances = await grievanceService.getDepartmentGrievances(
        currentUser.role === 'super_admin' ? 'all' : currentUser.departmentId || 'all'
      );
      const list = await notificationService.processAllGrievances(currentUser, grievances);
      setNotifications(list);
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 15000); // Periodic 15s refresh
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, currentUser]);

  // Click outside listener to close popover
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isAuthenticated || !currentUser) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = async (e, id) => {
    e.stopPropagation();
    await notificationService.markAsRead(id, currentUser);
    fetchNotifications();
  };

  const handleMarkAllAsRead = async () => {
    setLoading(true);
    await notificationService.markAllAsRead(currentUser);
    await fetchNotifications();
    setLoading(false);
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await notificationService.markAsRead(notif.notificationId || notif.id, currentUser);
    }
    setIsOpen(false);

    // Route based on role & grievanceId
    const gId = notif.grievanceId || notif.complaintNumber;
    if (currentUser.role === 'officer') {
      navigate(`/officer/grievance/${gId}`);
    } else if (['department_admin', 'super_admin'].includes(currentUser.role)) {
      navigate(`/admin`);
    } else {
      navigate(`/track?id=${gId}`);
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case NOTIFICATION_SEVERITY.NORMAL:
        return {
          label: 'Normal',
          bg: '#ecfdf5',
          color: '#047857',
          border: '#10b981',
          icon: Info,
        };
      case NOTIFICATION_SEVERITY.WARNING:
        return {
          label: 'Warning',
          bg: '#fffbeb',
          color: '#b45309',
          border: '#f59e0b',
          icon: AlertTriangle,
        };
      case NOTIFICATION_SEVERITY.CRITICAL:
        return {
          label: 'Critical',
          bg: '#fef2f2',
          color: '#b91c1c',
          border: '#ef4444',
          icon: AlertCircle,
        };
      case NOTIFICATION_SEVERITY.ESCALATED:
        return {
          label: 'Escalated',
          bg: '#f5f3ff',
          color: '#6d28d9',
          border: '#8b5cf6',
          icon: ShieldAlert,
        };
      default:
        return {
          label: 'Info',
          bg: '#f1f5f9',
          color: '#334155',
          border: '#64748b',
          icon: Info,
        };
    }
  };

  const formatTimestamp = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.4rem',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--slate-700)',
          transition: 'background 0.15s ease',
        }}
        title="Notifications"
        aria-label="Toggle notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              backgroundColor: 'var(--danger-solid, #ef4444)',
              color: '#ffffff',
              fontSize: '0.65rem',
              fontWeight: 800,
              borderRadius: '9999px',
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 0 0 2px #ffffff',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '360px',
            maxWidth: '90vw',
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--slate-200, #e2e8f0)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid var(--slate-200, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--slate-50, #f8fafc)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--slate-800, #1e293b)' }}>
                System Notifications
              </h4>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: 'var(--primary-100, #e0f2fe)',
                    color: 'var(--primary-700, #0369a1)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '9999px',
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-600, #0284c7)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* List Content */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--slate-400, #94a3b8)' }}>
                <Bell size={28} style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>No notifications found.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const badge = getSeverityBadge(n.severity);
                const SeverityIcon = badge.icon;
                return (
                  <div
                    key={n.notificationId || n.id}
                    onClick={() => handleNotificationClick(n)}
                    style={{
                      padding: '0.85rem 1rem',
                      borderBottom: '1px solid var(--slate-100, #f1f5f9)',
                      backgroundColor: n.isRead ? '#ffffff' : 'var(--slate-50, #f8fafc)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--slate-100, #f1f5f9)')}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = n.isRead ? '#ffffff' : 'var(--slate-50, #f8fafc)')
                    }
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                          }}
                        >
                          <SeverityIcon size={11} />
                          {badge.label}
                        </span>

                        <span
                          style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            color: 'var(--primary-700, #0369a1)',
                          }}
                        >
                          {n.complaintNumber || n.grievanceId}
                        </span>
                      </div>

                      <span style={{ fontSize: '0.7rem', color: 'var(--slate-400, #94a3b8)', whiteSpace: 'nowrap' }}>
                        {formatTimestamp(n.createdAt)}
                      </span>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--slate-800, #1e293b)', marginBottom: '0.2rem' }}>
                      {n.title}
                    </div>

                    <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--slate-600, #475569)', lineHeight: 1.35 }}>
                      {n.message}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--primary-600, #0284c7)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600 }}>
                        View Details <ExternalLink size={10} />
                      </span>

                      {!n.isRead && (
                        <button
                          onClick={(e) => handleMarkAsRead(e, n.notificationId || n.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--slate-400, #94a3b8)',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            padding: '0.1rem 0.3rem',
                            borderRadius: '4px',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-600)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--slate-400)')}
                          title="Mark as read"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
