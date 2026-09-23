import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, SeverityBadge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { grievanceService } from '../../services/firebase/grievanceService.js';
import { slaEngine } from '../../services/governance/slaEngine.js';
import { useAuth } from '../../context/AuthContext';
import { CATEGORIES, COMPLAINT_STATUS } from '../../models/schema.js';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  MapPin,
  AlertTriangle,
  Search,
  Maximize2,
  X,
  ShieldAlert,
  Archive,
  FolderCheck,
  Lock,
} from 'lucide-react';

export const VerificationQueuePage = () => {
  const { currentUser, isDepartmentAdmin, isSuperAdmin } = useAuth();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'ready_for_closure' | 'closed'

  // Modal States
  const [rejectionModal, setRejectionModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [closeModal, setCloseModal] = useState(null);
  const [closureRemarks, setClosureRemarks] = useState('');
  const [closingGrievance, setClosingGrievance] = useState(false);
  const [activeImageModal, setActiveImageModal] = useState(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      let filterParam = 'pending';
      if (activeTab === 'ready_for_closure') filterParam = 'ready_for_closure';
      else if (activeTab === 'closed') filterParam = 'closed';

      const list = await grievanceService.getVerificationQueue(currentUser, filterParam);
      setQueue(list);
    } catch (err) {
      console.error('Error loading verification queue:', err);
      setToast({
        type: 'danger',
        message: err.message || 'Failed to load verification queue.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [currentUser, activeTab]);

  const handleVerify = async (grievanceId, approved, reason = '') => {
    try {
      await grievanceService.verifyResolution(grievanceId, currentUser, {
        approved,
        rejectionReason: reason,
      });

      setToast({
        type: 'success',
        message: approved
          ? `Grievance #${grievanceId} marked VERIFIED & RESOLVED. Resolution SLA timer officially stopped. Ready for final administrative closure.`
          : `Evidence for #${grievanceId} REJECTED. Reverted to IN_PROGRESS for field remediation without resetting SLA.`,
      });

      setRejectionModal(null);
      setRejectionReason('');
      await loadQueue();
    } catch (err) {
      setToast({
        type: 'danger',
        message: err.message || 'Failed to complete verification.',
      });
    }
  };

  const handleCloseConfirm = async (e) => {
    e.preventDefault();
    if (!closeModal || closingGrievance) return;

    setClosingGrievance(true);
    try {
      await grievanceService.closeGrievance(closeModal.id || closeModal.grievanceId, currentUser, {
        closureRemarks: closureRemarks.trim(),
      });

      setToast({
        type: 'success',
        message: `Grievance #${closeModal.grievanceId || closeModal.id} officially CLOSED and archived. Timeline updated with completed status.`,
      });

      setCloseModal(null);
      setClosureRemarks('');
      await loadQueue();
    } catch (err) {
      setToast({
        type: 'danger',
        message: err.message || 'Failed to close grievance.',
      });
    } finally {
      setClosingGrievance(false);
    }
  };

  const filteredQueue = queue.filter((item) => {
    const matchesSearch =
      searchTerm === '' ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.ward.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'all' || item.departmentId === selectedDept;
    return matchesSearch && matchesDept;
  });

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Resolution Verification & Closure Station</h1>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem' }}>
            Dual-proof inspection & final administrative closure. Resolution SLA clock stops at Verification and remains permanently halted at Closure.
          </p>
        </div>

        {/* Search & Department Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search by ID, title, or ward..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
            style={{ width: '240px' }}
          />

          {isSuperAdmin && (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="form-select"
              style={{ width: 'auto' }}
            >
              <option value="all">All Departments</option>
              {Object.values(CATEGORIES).map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.departmentName}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--slate-200)', paddingBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: activeTab === 'pending' ? 'var(--primary-600)' : 'var(--slate-100)',
            color: activeTab === 'pending' ? '#fff' : 'var(--slate-700)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Pending Verification
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ready_for_closure')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: activeTab === 'ready_for_closure' ? 'var(--primary-600)' : 'var(--slate-100)',
            color: activeTab === 'ready_for_closure' ? '#fff' : 'var(--slate-700)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Verified • Ready for Closure
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('closed')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: activeTab === 'closed' ? 'var(--primary-600)' : 'var(--slate-100)',
            color: activeTab === 'closed' ? '#fff' : 'var(--slate-700)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Closed & Archived
        </button>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            padding: '0.875rem 1.25rem',
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

      {/* Image Zoom Modal */}
      {activeImageModal && (
        <div
          onClick={() => setActiveImageModal(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '2rem',
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button
              onClick={() => setActiveImageModal(null)}
              style={{
                position: 'absolute',
                top: '-2.5rem',
                right: 0,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.9rem',
              }}
            >
              <X size={20} /> Close
            </button>
            <img
              src={activeImageModal.url}
              alt={activeImageModal.title || 'Evidence Inspection'}
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 'var(--radius-md)', objectFit: 'contain' }}
            />
            <div style={{ color: '#fff', textAlign: 'center', marginTop: '0.5rem', fontSize: '0.85rem' }}>
              {activeImageModal.title}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', maxWidth: '500px', width: '100%', padding: '1.75rem', boxShadow: 'var(--shadow-xl)' }}>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '0.4rem' }}>Reject Resolution Evidence</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginBottom: '1.25rem' }}>
              Explain why the submitted proof is inadequate or incomplete. The grievance will return to <strong>IN_PROGRESS</strong> without resetting the original Resolution SLA deadline.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!rejectionReason.trim()) return;
                handleVerify(rejectionModal, false, rejectionReason);
              }}
            >
              <div className="form-group">
                <label className="form-label">Mandatory Rejection Feedback *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail the deficiencies (e.g. debris not cleared at curb, incomplete asphalt compacting, unclear photograph)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="form-textarea"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <Button variant="secondary" onClick={() => { setRejectionModal(null); setRejectionReason(''); }}>
                  Cancel
                </Button>
                <Button type="submit" variant="danger">
                  Confirm Rejection
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Final Closure Confirmation Modal */}
      {closeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', maxWidth: '500px', width: '100%', padding: '1.75rem', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Archive size={22} style={{ color: 'var(--primary-700)' }} />
              <h2 style={{ fontSize: '1.35rem', margin: 0 }}>Confirm Final Grievance Closure</h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              You are about to officially close and archive grievance <strong>#{closeModal.grievanceId || closeModal.id}</strong>.
              This action is permanent and terminal. The citizen tracking timeline will receive the completed green tick.
            </p>

            <form onSubmit={handleCloseConfirm}>
              <div className="form-group">
                <label className="form-label">Optional Administrative Closure Remarks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Verified on site, asphalt cured, citizen confirmed resolution..."
                  value={closureRemarks}
                  onChange={(e) => setClosureRemarks(e.target.value)}
                  className="form-textarea"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <Button variant="secondary" onClick={() => { setCloseModal(null); setClosureRemarks(''); }}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" icon={Lock} loading={closingGrievance}>
                  Confirm Official Closure
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Queue List */}
      {loading ? (
        <LoadingSpinner message="Loading queue records..." />
      ) : filteredQueue.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <FolderCheck size={40} style={{ color: 'var(--slate-400)', margin: '0 auto 0.75rem auto' }} />
          <p style={{ color: 'var(--slate-600)', fontSize: '0.95rem', fontWeight: 600 }}>
            {activeTab === 'pending'
              ? 'All resolution submissions have been reviewed and verified.'
              : activeTab === 'ready_for_closure'
              ? 'No verified grievances currently awaiting closure.'
              : 'No closed grievances found.'}
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {filteredQueue.map((item) => {
            const verificationEval = slaEngine.evaluateVerificationSLA(item);
            const resolutionEval = slaEngine.evaluateResolutionSLA(item);
            const isCommunityAction = item.resolutionProof?.submittedByType === 'COMMUNITY';
            const isSelfSubmitted = item.resolutionProof?.submittedById === currentUser?.uid;
            const isVerifiedResolved = item.status === COMPLAINT_STATUS.VERIFIED_RESOLVED;
            const isClosed = item.status === COMPLAINT_STATUS.CLOSED;

            return (
              <Card key={item.id || item.grievanceId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>
                        {item.grievanceId || item.id}
                      </span>
                      <StatusBadge status={item.status} />
                      <SeverityBadge severity={item.severity} />
                      <span className={isCommunityAction ? 'badge badge-warning' : 'badge badge-primary'}>
                        {isCommunityAction ? 'Community Action Submitted' : 'Officer Resolution Proof'}
                      </span>
                      <span className="badge badge-neutral">Priority: {item.priorityScore} / 100</span>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', marginBottom: '0.35rem', color: 'var(--slate-900)' }}>
                      {item.title}
                    </h3>

                    <div style={{ fontSize: '0.875rem', color: 'var(--slate-700)', marginBottom: '0.5rem' }}>
                      <strong>Completion Remarks ({item.resolutionProof?.submittedByName || 'Submitter'}):</strong> "{item.resolutionProof?.remarks || 'Remediation completed.'}"
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Building2 size={13} /> {item.departmentName}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <MapPin size={13} /> {item.ward}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: resolutionEval.isBreached ? 'var(--danger-solid)' : 'var(--slate-600)' }}>
                        <Clock size={13} /> Resolution SLA: <strong>{resolutionEval.formattedCountdown}</strong>
                      </span>
                    </div>

                    {verificationEval.isOverdue && !isVerifiedResolved && !isClosed && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.775rem', color: 'var(--danger-solid)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <AlertTriangle size={14} />
                        Verification SLA Overdue ({verificationEval.overdueHours}h in review). Requires immediate administrative sign-off.
                      </div>
                    )}

                    {isVerifiedResolved && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--success-text)', background: 'var(--success-bg)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', display: 'inline-block' }}>
                        Verified by <strong>{item.verifiedByName || 'Department Admin'}</strong>. Resolution SLA stopped. Ready for closure.
                      </div>
                    )}

                    {isClosed && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--slate-600)', background: 'var(--slate-100)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', display: 'inline-block' }}>
                        Closed by <strong>{item.closedByName || 'Admin'}</strong> on {new Date(item.closedAt || item.updatedAt).toLocaleDateString()}.
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                    {isSelfSubmitted && !isVerifiedResolved && !isClosed ? (
                      <div style={{ padding: '0.5rem 0.75rem', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-md)', fontSize: '0.775rem', color: 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ShieldAlert size={14} />
                        Self-verification prohibited: You submitted this evidence.
                      </div>
                    ) : isVerifiedResolved ? (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Archive}
                        onClick={() => setCloseModal(item)}
                      >
                        Close Grievance & Archive
                      </Button>
                    ) : isClosed ? (
                      <span className="badge badge-neutral" style={{ padding: '0.4rem 0.75rem' }}>
                        <Lock size={12} style={{ marginRight: '4px' }} /> Officially Closed
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={XCircle}
                          onClick={() => setRejectionModal(item.id || item.grievanceId)}
                        >
                          Reject Proof
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={CheckCircle2}
                          onClick={() => handleVerify(item.id || item.grievanceId, true)}
                        >
                          Approve & Mark Verified Resolved
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dual-Proof Visual Inspection Comparison */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginTop: '0.75rem' }}>
                  {/* BEFORE PROOF */}
                  <div style={{ background: 'var(--slate-50)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.825rem', color: 'var(--slate-700)', marginBottom: '0.5rem' }}>
                      BEFORE PROOF (Citizen Intake)
                    </div>
                    {item.mediaUrls && item.mediaUrls.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem' }}>
                        {item.mediaUrls.map((url, i) => (
                          <div
                            key={i}
                            onClick={() => setActiveImageModal({ url, title: `Before Proof #${i + 1} • ${item.title}` })}
                            style={{ height: '110px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--slate-200)', background: '#000', cursor: 'pointer', position: 'relative' }}
                          >
                            <img src={url} alt={`Before Proof #${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', padding: '2px', borderRadius: '3px', color: '#fff' }}>
                              <Maximize2 size={12} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--slate-400)', fontSize: '0.8rem', background: '#fff', borderRadius: 'var(--radius-sm)' }}>
                        No initial citizen intake photo attached.
                      </div>
                    )}
                  </div>

                  {/* AFTER PROOF */}
                  <div style={{ background: 'var(--slate-50)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.825rem', color: 'var(--slate-700)', marginBottom: '0.5rem' }}>
                      AFTER PROOF ({item.resolutionProof?.submittedByType === 'COMMUNITY' ? 'Community Action' : 'Field Officer'})
                    </div>
                    {item.resolutionProof?.afterMediaUrls && item.resolutionProof.afterMediaUrls.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem' }}>
                        {item.resolutionProof.afterMediaUrls.map((url, i) => (
                          <div
                            key={i}
                            onClick={() => setActiveImageModal({ url, title: `After Rectification Proof #${i + 1} • ${item.title}` })}
                            style={{ height: '110px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--slate-200)', background: '#000', cursor: 'pointer', position: 'relative' }}
                          >
                            <img src={url} alt={`After Proof #${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', padding: '2px', borderRadius: '3px', color: '#fff' }}>
                              <Maximize2 size={12} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--slate-400)', fontSize: '0.8rem', background: '#fff', borderRadius: 'var(--radius-sm)' }}>
                        Pending photographic proof upload.
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
