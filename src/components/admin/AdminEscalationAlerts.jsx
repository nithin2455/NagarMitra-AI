import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { StatusBadge, SeverityBadge } from '../common/Badge';
import { grievanceService } from '../../services/firebase/grievanceService.js';
import { notificationService } from '../../services/governance/notificationService.js';
import { useAuth } from '../../context/AuthContext';
import { NOTIFICATION_SEVERITY, ESCALATION_LEVELS } from '../../models/schema.js';
import { ShieldAlert, AlertTriangle, AlertCircle, Clock, ExternalLink, ArrowRight, Building2 } from 'lucide-react';

export const AdminEscalationAlerts = () => {
  const { currentUser, isSuperAdmin } = useAuth();
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEscalations = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const deptFilter = isSuperAdmin ? 'all' : currentUser.departmentId;
      const grievances = await grievanceService.getDepartmentGrievances(deptFilter);
      const notifications = await notificationService.getNotifications(currentUser);

      // Map grievances to detailed escalation objects
      const items = grievances
        .filter((g) => {
          // Show if escalated OR has post-SLA warning alerts
          const isEscalated =
            g.escalationLevel &&
            g.escalationLevel !== ESCALATION_LEVELS.NOT_ESCALATED &&
            g.escalationLevel !== ESCALATION_LEVELS.RESOLVED;

          const gNotifs = notifications.filter((n) => n.grievanceId === g.id || n.complaintNumber === g.id);
          const hasWarningOrEscalation = gNotifs.some((n) =>
            [NOTIFICATION_SEVERITY.CRITICAL, NOTIFICATION_SEVERITY.ESCALATED, NOTIFICATION_SEVERITY.WARNING].includes(n.severity)
          );

          return isEscalated || hasWarningOrEscalation;
        })
        .map((g) => {
          const gNotifs = notifications.filter((n) => n.grievanceId === g.id || n.complaintNumber === g.id);
          const warn1 = gNotifs.find((n) => n.type === 'WARNING_1');
          const warn2 = gNotifs.find((n) => n.type === 'WARNING_2');
          const escNotif = gNotifs.find((n) => n.type === 'ESCALATED');

          let highestSeverity = NOTIFICATION_SEVERITY.NORMAL;
          if (escNotif) highestSeverity = NOTIFICATION_SEVERITY.ESCALATED;
          else if (warn2 || warn1) highestSeverity = NOTIFICATION_SEVERITY.CRITICAL;
          else if (gNotifs.some((n) => n.severity === NOTIFICATION_SEVERITY.WARNING)) {
            highestSeverity = NOTIFICATION_SEVERITY.WARNING;
          }

          return {
            grievance: g,
            complaintNumber: g.id || g.grievanceId,
            department: g.departmentName || g.departmentId,
            departmentId: g.departmentId,
            assignedOfficer: g.assignedOfficerId ? `Officer (${g.assignedOfficerId})` : 'Unassigned / Dept Pool',
            slaDeadline: g.responseSlaDue,
            slaBreachTime: g.responseSlaDue,
            warning1Time: warn1 ? warn1.createdAt : null,
            warning2Time: warn2 ? warn2.createdAt : null,
            escalationTime: escNotif ? escNotif.createdAt : null,
            status: g.status,
            priority: g.severity,
            severity: highestSeverity,
          };
        });

      // Sort escalated and critical first
      items.sort((a, b) => {
        const severityRank = { ESCALATED: 4, CRITICAL: 3, WARNING: 2, NORMAL: 1 };
        return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      });

      setEscalations(items);
    } catch (err) {
      console.error('Error fetching admin escalations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscalations();
  }, [currentUser]);

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case NOTIFICATION_SEVERITY.NORMAL:
        return { bg: '#ecfdf5', color: '#047857', border: '#10b981', label: 'NORMAL' };
      case NOTIFICATION_SEVERITY.WARNING:
        return { bg: '#fffbeb', color: '#b45309', border: '#f59e0b', label: 'WARNING' };
      case NOTIFICATION_SEVERITY.CRITICAL:
        return { bg: '#fef2f2', color: '#b91c1c', border: '#ef4444', label: 'CRITICAL' };
      case NOTIFICATION_SEVERITY.ESCALATED:
        return { bg: '#f5f3ff', color: '#6d28d9', border: '#8b5cf6', label: 'ESCALATED' };
      default:
        return { bg: '#f1f5f9', color: '#334155', border: '#64748b', label: 'NORMAL' };
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ padding: '0.4rem', borderRadius: 'var(--radius-md)', backgroundColor: '#f5f3ff', color: '#6d28d9' }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--slate-800)' }}>
              Response SLA & Controlled Escalation Command Center
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>
              {isSuperAdmin
                ? 'Global Multi-Department Post-SLA Escalations & Officer Warnings'
                : `Department Alerts & Escalations (${currentUser?.departmentId?.toUpperCase()})`}
            </span>
          </div>
        </div>

        <Button variant="secondary" size="sm" onClick={fetchEscalations}>
          Refresh Alerts
        </Button>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-400)' }}>
          Loading escalation metrics...
        </div>
      ) : escalations.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-400)', backgroundColor: 'var(--slate-50)', borderRadius: 'var(--radius-md)' }}>
          <ShieldAlert size={32} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4 }} />
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>No active post-SLA escalations or warnings detected.</p>
          <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>
            Field officers are responding within authorized Response SLA windows.
          </span>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--slate-100)', textTransform: 'uppercase', fontSize: '0.725rem', color: 'var(--slate-600)', letterSpacing: '0.05em' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Severity</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Complaint No.</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Department</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Officer</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>SLA Due</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Warning 1</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Warning 2</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Escalated At</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {escalations.map((item) => {
                const style = getSeverityStyle(item.severity);
                return (
                  <tr key={item.complaintNumber} style={{ borderBottom: '1px solid var(--slate-200)' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          backgroundColor: style.bg,
                          color: style.color,
                          border: `1px solid ${style.border}`,
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 800,
                          fontSize: '0.675rem',
                          display: 'inline-block',
                        }}
                      >
                        {style.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {item.complaintNumber}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--slate-700)', fontWeight: 600 }}>
                      {item.department}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--slate-600)' }}>
                      {item.assignedOfficer}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--slate-600)' }}>
                      {formatDateTime(item.slaDeadline)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: item.warning1Time ? '#b91c1c' : 'var(--slate-400)' }}>
                      {formatDateTime(item.warning1Time)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: item.warning2Time ? '#b91c1c' : 'var(--slate-400)' }}>
                      {formatDateTime(item.warning2Time)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: item.escalationTime ? '#6d28d9' : 'var(--slate-400)', fontWeight: item.escalationTime ? 700 : 400 }}>
                      {formatDateTime(item.escalationTime)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <StatusBadge status={item.status} />
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <Link to={`/admin`}>
                        <Button variant="secondary" size="sm" icon={ExternalLink}>
                          Inspect
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
