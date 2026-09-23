import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { auditLogService } from '../../services/firebase/auditLogService.js';
import { useAuth } from '../../context/AuthContext';
import { CATEGORIES, USER_ROLES, AUDIT_ACTIONS } from '../../models/schema.js';
import {
  ListFilter,
  Shield,
  Search,
  Filter,
  RotateCw,
  Clock,
  User,
  Building2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Eye,
  X,
  Database,
  Calendar,
} from 'lucide-react';

export const AdminAuditLogsPage = () => {
  const { currentUser, isDepartmentAdmin, isSuperAdmin } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all_time');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Log for Full Inspection Modal
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchAuditLogs = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await auditLogService.getAuditLogs(currentUser, {
        departmentId: isDepartmentAdmin ? currentUser.departmentId : selectedDept,
        role: selectedRole,
        action: selectedAction,
        dateRange: selectedDateRange,
        searchTerm,
      });
      setLogs(data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError(err.message || 'Failed to load system audit logs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchAuditLogs();
    }
  }, [currentUser, selectedDept, selectedRole, selectedAction, selectedDateRange, searchTerm]);

  // Action badge color mapping
  const getActionBadgeVariant = (action) => {
    switch (action) {
      case AUDIT_ACTIONS.RESOLUTION_VERIFIED:
      case 'EXTENSION_APPROVED':
      case AUDIT_ACTIONS.SLA_EXTENSION_APPROVED:
        return 'success';
      case AUDIT_ACTIONS.RESOLUTION_REJECTED:
      case 'EXTENSION_REJECTED':
      case AUDIT_ACTIONS.SLA_EXTENSION_REJECTED:
        return 'danger';
      case AUDIT_ACTIONS.GRIEVANCE_CLOSED:
        return 'neutral';
      case AUDIT_ACTIONS.RESOLUTION_SUBMITTED:
      case AUDIT_ACTIONS.SLA_ACTION:
      case AUDIT_ACTIONS.SLA_EXTENSION_REQUESTED:
        return 'warning';
      case AUDIT_ACTIONS.GRIEVANCE_ACKNOWLEDGED:
      case 'STATUS_SEEN':
        return 'info';
      case AUDIT_ACTIONS.GRIEVANCE_CREATED:
      case 'GRIEVANCE_SUBMITTED':
      case AUDIT_ACTIONS.LOGIN:
      case AUDIT_ACTIONS.LOGOUT:
      default:
        return 'primary';
    }
  };

  // Role badge color mapping
  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case USER_ROLES.SUPER_ADMIN:
        return 'danger';
      case USER_ROLES.DEPARTMENT_ADMIN:
        return 'primary';
      case USER_ROLES.OFFICER:
        return 'warning';
      case USER_ROLES.CITIZEN:
        return 'info';
      default:
        return 'neutral';
    }
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.75rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.75rem', margin: 0 }}>System Audit Logs</h1>
            <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
              <Shield size={12} style={{ marginRight: '4px' }} />
              {isDepartmentAdmin
                ? `${currentUser?.departmentId?.toUpperCase()} Department Scope`
                : 'Super Admin Global Ledger'}
            </span>
          </div>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem', margin: 0 }}>
            Immutable chronological ledger of system actions, state transitions, SLA events, and administrative accountability.
          </p>
        </div>

        {/* Refresh Button */}
        <Button
          variant="secondary"
          size="sm"
          icon={RotateCw}
          loading={refreshing}
          disabled={loading || refreshing}
          onClick={() => fetchAuditLogs(true)}
        >
          {refreshing ? 'Refreshing Ledger...' : 'Refresh Logs'}
        </Button>
      </div>

      {/* Filter Control Bar */}
      <Card style={{ marginBottom: '1.75rem', padding: '1.1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Filter size={16} style={{ color: 'var(--primary-700)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--slate-800)' }}>
            Audit Search & Governance Filters
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          {/* Search Input */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              Search Actor / ID / Details
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search by ID or keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem 0.4rem 2rem' }}
              />
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '0.6rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--slate-400)',
                }}
              />
            </div>
          </div>

          {/* Department Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              Department
            </label>
            {isSuperAdmin ? (
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="form-select"
                style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem' }}
              >
                <option value="all">All Departments</option>
                {Object.values(CATEGORIES).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.departmentName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                disabled
                value={
                  Object.values(CATEGORIES).find((c) => c.id === currentUser?.departmentId)?.departmentName ||
                  currentUser?.departmentId?.toUpperCase()
                }
                className="form-input"
                style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem', background: 'var(--slate-100)' }}
              />
            )}
          </div>

          {/* Role Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              Actor Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="form-select"
              style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem' }}
            >
              <option value="all">All Roles</option>
              <option value={USER_ROLES.CITIZEN}>Citizen</option>
              <option value={USER_ROLES.OFFICER}>Department Officer</option>
              <option value={USER_ROLES.DEPARTMENT_ADMIN}>Department Admin</option>
              <option value={USER_ROLES.SUPER_ADMIN}>Super Admin</option>
              <option value="system">System Engine</option>
            </select>
          </div>

          {/* Action Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              Action Type
            </label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="form-select"
              style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem' }}
            >
              <option value="all">All Actions</option>
              <option value={AUDIT_ACTIONS.GRIEVANCE_CREATED}>GRIEVANCE_CREATED</option>
              <option value={AUDIT_ACTIONS.GRIEVANCE_ACKNOWLEDGED}>GRIEVANCE_ACKNOWLEDGED</option>
              <option value={AUDIT_ACTIONS.RESOLUTION_SUBMITTED}>RESOLUTION_SUBMITTED</option>
              <option value={AUDIT_ACTIONS.RESOLUTION_VERIFIED}>RESOLUTION_VERIFIED</option>
              <option value={AUDIT_ACTIONS.RESOLUTION_REJECTED}>RESOLUTION_REJECTED</option>
              <option value={AUDIT_ACTIONS.GRIEVANCE_CLOSED}>GRIEVANCE_CLOSED</option>
              <option value={AUDIT_ACTIONS.SLA_ACTION}>SLA_ACTION</option>
              <option value={AUDIT_ACTIONS.SLA_EXTENSION_REQUESTED}>SLA_EXTENSION_REQUESTED</option>
              <option value={AUDIT_ACTIONS.SLA_EXTENSION_APPROVED}>SLA_EXTENSION_APPROVED</option>
              <option value={AUDIT_ACTIONS.SLA_EXTENSION_REJECTED}>SLA_EXTENSION_REJECTED</option>
              <option value={AUDIT_ACTIONS.LOGIN}>LOGIN</option>
              <option value={AUDIT_ACTIONS.LOGOUT}>LOGOUT</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              Date Range
            </label>
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="form-select"
              style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem' }}
            >
              <option value="all_time">All Time</option>
              <option value="today">Today</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Table / Content */}
      {loading ? (
        <LoadingSpinner message="Retrieving immutable audit records..." />
      ) : error ? (
        <Card style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <AlertTriangle size={40} style={{ color: 'var(--danger-solid)', margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Audit Ledger Error</h3>
          <p style={{ color: 'var(--slate-600)', marginBottom: '1.25rem' }}>{error}</p>
          <Button variant="primary" onClick={() => fetchAuditLogs()}>
            Retry Loading
          </Button>
        </Card>
      ) : logs.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <Database size={44} style={{ color: 'var(--slate-400)', margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.35rem', color: 'var(--slate-800)' }}>
            No audit records found
          </h3>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.25rem auto' }}>
            No system audit entries match your current search criteria.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSelectedDept('all');
              setSelectedRole('all');
              setSelectedAction('all');
              setSelectedDateRange('all_time');
              setSearchTerm('');
            }}
          >
            Reset Filters
          </Button>
        </Card>
      ) : (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
              Displaying <strong>{logs.length}</strong> immutable audit entries
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--slate-200)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)', width: '140px' }}>Timestamp</th>
                  <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)' }}>Complaint ID</th>
                  <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)' }}>Actor & Role</th>
                  <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)' }}>Action</th>
                  <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)' }}>Transition</th>
                  <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)' }}>Details</th>
                  <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)', textAlign: 'right' }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const dateStr = log.timestamp
                    ? new Date(log.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—';

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--slate-100)',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50"
                    >
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-500)', fontSize: '0.775rem', whiteSpace: 'nowrap' }}>
                        {dateStr}
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        {log.complaintNumber || log.grievanceId ? (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              color: 'var(--primary-800)',
                              background: 'var(--primary-50)',
                              padding: '0.15rem 0.35rem',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.775rem',
                            }}
                          >
                            {log.complaintNumber || log.grievanceId}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--slate-400)', fontSize: '0.75rem' }}>System Session</span>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--slate-800)' }}>
                          {log.actorName || log.actorUid}
                        </div>
                        <div style={{ marginTop: '0.15rem' }}>
                          <Badge variant={getRoleBadgeVariant(log.actorRole)} size="sm">
                            {log.actorRole?.toUpperCase() || 'SYSTEM'}
                          </Badge>
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <Badge variant={getActionBadgeVariant(log.action)} size="sm">
                          {log.action}
                        </Badge>
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem', whiteSpace: 'nowrap' }}>
                        {log.previousStatus || log.newStatus ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--slate-600)', fontFamily: 'var(--font-mono)' }}>
                            <span>{log.previousStatus || '—'}</span>
                            <ArrowRight size={12} style={{ color: 'var(--slate-400)' }} />
                            <strong style={{ color: 'var(--slate-800)' }}>{log.newStatus || '—'}</strong>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--slate-400)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)', maxWidth: '320px' }}>
                        <div
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '0.8rem',
                          }}
                          title={log.details}
                        >
                          {log.details || '—'}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Eye}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Audit Detail Modal */}
      {selectedLog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedLog(null);
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '620px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              padding: '1.5rem',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Audit Entry Record</h3>
                  <Badge variant="primary">IMMUTABLE</Badge>
                </div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--slate-400)' }}>
                  ID: {selectedLog.id}
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--slate-400)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Structured Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'var(--slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.725rem', color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  Timestamp
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--slate-900)' }}>
                  {new Date(selectedLog.timestamp).toLocaleString()}
                </div>
              </div>

              <div style={{ background: 'var(--slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.725rem', color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  Action Performed
                </div>
                <div>
                  <Badge variant={getActionBadgeVariant(selectedLog.action)} size="sm">
                    {selectedLog.action}
                  </Badge>
                </div>
              </div>

              <div style={{ background: 'var(--slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.725rem', color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  Actor Identity
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--slate-900)' }}>
                  {selectedLog.actorName}
                </div>
                <div style={{ fontSize: '0.725rem', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                  UID: {selectedLog.actorUid}
                </div>
              </div>

              <div style={{ background: 'var(--slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.725rem', color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  Actor Role
                </div>
                <div>
                  <Badge variant={getRoleBadgeVariant(selectedLog.actorRole)} size="sm">
                    {selectedLog.actorRole?.toUpperCase()}
                  </Badge>
                </div>
              </div>

              <div style={{ background: 'var(--slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.725rem', color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  Complaint Reference
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-800)', fontFamily: 'var(--font-mono)' }}>
                  {selectedLog.complaintNumber || selectedLog.grievanceId || 'N/A'}
                </div>
              </div>

              <div style={{ background: 'var(--slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.725rem', color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  Department Scope
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--slate-900)' }}>
                  {selectedLog.departmentId ? selectedLog.departmentId.toUpperCase() : 'Global / Municipal'}
                </div>
              </div>
            </div>

            {/* State Transition */}
            {(selectedLog.previousStatus || selectedLog.newStatus) && (
              <div style={{ marginBottom: '1.25rem', padding: '0.75rem', border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Lifecycle State Transition
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                  <span style={{ padding: '0.2rem 0.4rem', background: 'var(--slate-100)', borderRadius: 'var(--radius-sm)' }}>
                    {selectedLog.previousStatus || 'NONE'}
                  </span>
                  <ArrowRight size={14} style={{ color: 'var(--slate-400)' }} />
                  <span style={{ padding: '0.2rem 0.4rem', background: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>
                    {selectedLog.newStatus || 'NONE'}
                  </span>
                </div>
              </div>
            )}

            {/* Description / Remarks */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Operational Log Narrative
              </div>
              <div style={{ padding: '0.75rem', background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--slate-800)', lineHeight: '1.5' }}>
                {selectedLog.details || 'No additional narrative recorded.'}
              </div>
            </div>

            {/* Metadata Payload */}
            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Structured Event Metadata
                </div>
                <pre
                  style={{
                    padding: '0.75rem',
                    background: 'var(--slate-900)',
                    color: '#38bdf8',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    overflowX: 'auto',
                  }}
                >
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>
                Close Inspection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
