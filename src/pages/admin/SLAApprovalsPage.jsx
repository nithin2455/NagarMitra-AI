import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, SeverityBadge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { grievanceService } from '../../services/firebase/grievanceService.js';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES } from '../../models/schema.js';
import { CheckCircle, XCircle, Clock, ShieldAlert, Building2 } from 'lucide-react';

export const SLAApprovalsPage = () => {
  const { currentUser, isDepartmentAdmin, isSuperAdmin } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState({});

  const loadRequests = async () => {
    setLoading(true);
    try {
      const list = await grievanceService.getSLAExtensions(currentUser);
      setRequests(list);
    } catch (err) {
      console.error('Error loading SLA extensions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [currentUser]);

  const handleDecision = async (extId, decision) => {
    try {
      const remarks = adminRemarks[extId] || '';
      await grievanceService.reviewSLAExtension(extId, currentUser, {
        decision,
        adminRemarks: remarks,
      });

      setToast({
        type: 'success',
        message:
          decision === 'APPROVED'
            ? `Extension request #${extId} APPROVED. Resolution SLA extended and audited.`
            : `Extension request #${extId} REJECTED. Notice dispatched to department.`,
      });

      await loadRequests();
    } catch (err) {
      setToast({
        type: 'danger',
        message: err.message || 'Failed to process extension decision.',
      });
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');

  return (
    <div>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>SLA Extension Approvals</h1>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem' }}>
          {isDepartmentAdmin
            ? `Review officer justification for ${currentUser?.departmentId?.toUpperCase()} deadline adjustments.`
            : 'Supervisory review of municipal SLA extension requests across all departments.'}
        </p>
      </div>

      {toast && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: toast.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
            border: `1px solid ${toast.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
            borderRadius: 'var(--radius-md)',
            color: toast.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
            fontSize: '0.875rem',
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading pending SLA extension requests..." />
      ) : pendingRequests.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <p style={{ color: 'var(--slate-500)' }}>
            No pending SLA extension requests requiring your authorization.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {pendingRequests.map((req) => (
            <Card key={req.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>
                      {req.id}
                    </span>
                    <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                      Pending Review
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                      • Requested by {req.requestedByOfficerName} ({new Date(req.createdAt).toLocaleDateString()})
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--slate-900)' }}>
                    Grievance: {req.grievanceId}
                  </h3>

                  <div style={{ background: 'var(--slate-50)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', margin: '0.75rem 0', fontSize: '0.85rem', border: '1px solid var(--slate-200)' }}>
                    <strong>Officer Justification:</strong> "{req.reason}"
                  </div>

                  <div style={{ fontSize: '0.825rem', color: 'var(--slate-600)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <span>Department: <strong>{req.departmentId?.toUpperCase()}</strong></span>
                    <span>Requested: <strong>+{req.requestedHours} Hours</strong></span>
                    <span>Current Deadline: <strong>{new Date(req.previousDeadline).toLocaleString()}</strong></span>
                    <span>Proposed Deadline: <strong>{new Date(req.proposedDeadline).toLocaleString()}</strong></span>
                  </div>

                  {req.requiresSuperAdmin && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.775rem', color: 'var(--danger-solid)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <ShieldAlert size={14} />
                      Requires Super Admin approval (Exceeds standard 24h limit or second extension).
                    </div>
                  )}

                  {/* Administrative remarks input */}
                  <div style={{ marginTop: '0.75rem' }}>
                    <input
                      type="text"
                      placeholder="Add supervisor notes / condition..."
                      value={adminRemarks[req.id] || ''}
                      onChange={(e) =>
                        setAdminRemarks({ ...adminRemarks, [req.id]: e.target.value })
                      }
                      className="form-input"
                      style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'center' }}>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={XCircle}
                    onClick={() => handleDecision(req.id, 'REJECTED')}
                  >
                    Reject Request
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={CheckCircle}
                    onClick={() => handleDecision(req.id, 'APPROVED')}
                  >
                    Approve Extension
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
