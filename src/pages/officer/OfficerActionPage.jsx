import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, SeverityBadge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { grievanceService } from '../../services/firebase/grievanceService.js';
import { storageService } from '../../services/firebase/storageService.js';
import { slaEngine } from '../../services/governance/slaEngine.js';
import { useAuth } from '../../context/AuthContext';
import { COMPLAINT_STATUS, EXTENSION_LIMITS } from '../../models/schema.js';
import {
  ArrowLeft,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Building2,
  MapPin,
  Eye,
  Camera,
  ShieldAlert,
  Send,
  FileCheck,
  RotateCcw,
  Sparkles,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
} from 'lucide-react';

export const OfficerActionPage = () => {
  const { id } = useParams();
  const { currentUser } = useAuth();

  const [grievance, setGrievance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(null);
  const [toast, setToast] = useState(null);

  // Lightbox Image Modal State
  const [activeImageModal, setActiveImageModal] = useState(null);

  // SLA Extension Modal State
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [extensionHours, setExtensionHours] = useState(24);
  const [extensionReason, setExtensionReason] = useState('');
  const [extensionSubmitting, setExtensionSubmitting] = useState(false);

  // Resolution Proof Form State
  const [remarks, setRemarks] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidencePreview, setEvidencePreview] = useState(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const fetchRecord = async () => {
    setLoading(true);
    try {
      const item = await grievanceService.getGrievanceById(id, currentUser);
      if (!item) {
        setAccessDenied(`Grievance record #${id} was not found.`);
      } else if (currentUser?.role === 'officer' && item.departmentId !== currentUser.departmentId) {
        setAccessDenied(
          `Access Denied: This grievance belongs to (${item.departmentName}). You are registered as an officer for (${currentUser.departmentId.toUpperCase()}).`
        );
      } else {
        setGrievance(item);
        setAccessDenied(null);
      }
    } catch (err) {
      setAccessDenied(err.message || 'Access Denied.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecord();
  }, [id, currentUser]);

  // Clean up object URL when component unmounts or image changes
  useEffect(() => {
    return () => {
      if (evidencePreview && evidencePreview.startsWith('blob:')) {
        URL.revokeObjectURL(evidencePreview);
      }
    };
  }, [evidencePreview]);

  // ESC and Arrow Key Listener for Image Lightbox
  useEffect(() => {
    if (!activeImageModal) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveImageModal(null);
      } else if (e.key === 'ArrowLeft') {
        setActiveImageModal((prev) => {
          if (!prev || !prev.images || prev.images.length <= 1) return prev;
          const newIndex = (prev.index - 1 + prev.images.length) % prev.images.length;
          return { ...prev, index: newIndex };
        });
      } else if (e.key === 'ArrowRight') {
        setActiveImageModal((prev) => {
          if (!prev || !prev.images || prev.images.length <= 1) return prev;
          const newIndex = (prev.index + 1) % prev.images.length;
          return { ...prev, index: newIndex };
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeImageModal]);

  // Handle Mark As Seen (Halts Response SLA & reveals resolution station on same page)
  const handleMarkAsSeen = async () => {
    try {
      const updated = await grievanceService.markGrievanceAsSeen(grievance.id, currentUser);
      setGrievance((prev) => ({
        ...prev,
        status: updated.status,
        seenAt: updated.seenAt,
        assignedOfficerId: currentUser.uid,
      }));
      setToast({
        type: 'success',
        message: `Grievance #${grievance.id} marked as SEEN. Response SLA clock halted. You may now enter completion remarks and upload rectification proof.`,
      });
    } catch (err) {
      setToast({ type: 'danger', message: err.message || 'Failed to acknowledge grievance.' });
    }
  };

  // Handle Extension Request Submission
  const handleExtensionSubmit = async (e) => {
    e.preventDefault();
    if (extensionSubmitting) return;

    if (!extensionReason.trim()) {
      setToast({ type: 'danger', message: 'Please provide a justification for this extension.' });
      return;
    }

    setExtensionSubmitting(true);
    try {
      await grievanceService.requestSLAExtension(
        grievance.id,
        currentUser,
        Number(extensionHours),
        extensionReason.trim()
      );
      setToast({
        type: 'success',
        message: 'Extension request submitted. Awaiting Department Admin approval.',
      });
      setShowExtensionModal(false);
      setExtensionReason('');
      await fetchRecord();
    } catch (err) {
      setToast({ type: 'danger', message: err.message || 'Failed to submit extension request.' });
    } finally {
      setExtensionSubmitting(false);
    }
  };

  // File Upload Helper
  const processSelectedFile = (file) => {
    if (!file) return;

    try {
      storageService.validateFile(file);

      // Clean previous object URL
      if (evidencePreview && evidencePreview.startsWith('blob:')) {
        URL.revokeObjectURL(evidencePreview);
      }

      setEvidenceFile(file);
      const previewUrl = URL.createObjectURL(file);
      setEvidencePreview(previewUrl);
      setToast(null);
    } catch (err) {
      setToast({ type: 'danger', message: err.message });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    processSelectedFile(file);
  };

  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset so same file can be re-selected if desired
      fileInputRef.current.click();
    }
  };

  const handleRemoveFile = () => {
    if (evidencePreview && evidencePreview.startsWith('blob:')) {
      URL.revokeObjectURL(evidencePreview);
    }
    setEvidenceFile(null);
    setEvidencePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag & Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!submittingProof) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (submittingProof) return;

    const file = e.dataTransfer.files?.[0];
    processSelectedFile(file);
  };

  // Handle Resolution Proof Submission
  const handleEvidenceSubmit = async (e) => {
    e.preventDefault();
    if (submittingProof) return;

    if (!remarks.trim()) {
      setToast({ type: 'danger', message: 'Please enter detailed engineering/completion remarks.' });
      return;
    }
    if (!evidenceFile) {
      setToast({ type: 'danger', message: 'Please attach after-rectification photographic evidence.' });
      return;
    }

    setSubmittingProof(true);
    try {
      // 1. Upload evidence file
      const uploadedUrls = await storageService.uploadEvidenceFiles(
        [evidenceFile],
        `resolutions/${grievance.id}`
      );

      // 2. Submit resolution proof to grievance service
      const updated = await grievanceService.submitResolutionEvidence(grievance.id, currentUser, {
        remarks: remarks.trim(),
        afterMediaUrls: uploadedUrls,
      });

      setGrievance(updated);
      setToast({
        type: 'success',
        message:
          'Resolution proof submitted for Department Admin verification. Resolution SLA remains active until verified.',
      });
      setEvidenceFile(null);
      setEvidencePreview(null);
    } catch (err) {
      setToast({ type: 'danger', message: err.message || 'Failed to submit resolution proof.' });
    } finally {
      setSubmittingProof(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading grievance action center..." />;
  }

  if (accessDenied || !grievance) {
    return (
      <div style={{ maxWidth: '640px', margin: '3rem auto', textAlign: 'center' }}>
        <Card>
          <ShieldAlert size={48} style={{ color: 'var(--danger-solid)', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Access Restricted</h2>
          <p style={{ color: 'var(--slate-600)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            {accessDenied || `Unable to access grievance #${id}.`}
          </p>
          <Link to="/officer/inbox">
            <Button variant="primary">Return to Department Inbox</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const responseEval = slaEngine.evaluateResponseSLA(grievance);
  const resolutionEval = slaEngine.evaluateResolutionSLA(grievance);

  const isSubmitted = grievance.status === COMPLAINT_STATUS.SUBMITTED;
  const isSeenOrInProgress =
    [COMPLAINT_STATUS.SEEN, COMPLAINT_STATUS.IN_PROGRESS].includes(grievance.status);
  const isUnderVerification = [
    COMPLAINT_STATUS.VERIFICATION,
    COMPLAINT_STATUS.RESOLUTION_SUBMITTED,
    COMPLAINT_STATUS.COMMUNITY_ACTION_SUBMITTED,
  ].includes(grievance.status);
  const isVerifiedResolved = grievance.status === COMPLAINT_STATUS.VERIFIED_RESOLVED;
  const isClosed = grievance.status === COMPLAINT_STATUS.CLOSED;
  const wasRejected = Boolean(grievance.rejectionReason && isSeenOrInProgress);

  // Status Stepper Index
  const getStepIndex = () => {
    if (isSubmitted) return 0;
    if (grievance.status === COMPLAINT_STATUS.SEEN) return 1;
    if (grievance.status === COMPLAINT_STATUS.IN_PROGRESS) return 2;
    if (isUnderVerification) return 3;
    if (isVerifiedResolved) return 4;
    if (isClosed) return 5;
    return 1;
  };
  const currentStep = getStepIndex();
  const steps = ['Submitted', 'Acknowledged', 'In Progress', 'Under Verification', 'Verified Resolved', 'Closed'];

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto' }}>
      {/* Top Breadcrumb & Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to="/officer/inbox"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.875rem',
            marginBottom: '0.75rem',
            color: 'var(--primary-700)',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} /> Back to Department Inbox
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-800)', fontFamily: 'var(--font-mono)' }}>
                {grievance.grievanceId || grievance.id}
              </span>
              <StatusBadge status={grievance.status} />
              <SeverityBadge severity={grievance.severity} />
              <span className="badge badge-neutral">Priority Score: {grievance.priorityScore} / 100</span>
            </div>
            <h1 style={{ fontSize: '1.65rem', marginBottom: '0.25rem' }}>{grievance.title}</h1>
            <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
              {grievance.ward} {grievance.landmark ? `• ${grievance.landmark}` : ''} • {grievance.departmentName}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {isSubmitted && !grievance.seenAt && (
              <Button variant="primary" icon={Eye} onClick={handleMarkAsSeen}>
                Acknowledge & Mark as Seen
              </Button>
            )}

            {isSeenOrInProgress && (
              <Button
                variant="secondary"
                size="sm"
                icon={Calendar}
                onClick={() => setShowExtensionModal(true)}
                disabled={(grievance.extensionCount || 0) >= EXTENSION_LIMITS.MAX_EXTENSIONS_PER_COMPLAINT}
              >
                Request SLA Extension ({grievance.extensionCount || 0}/2)
              </Button>
            )}
          </div>
        </div>

        {/* Visual Lifecycle Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {steps.map((stepName, i) => {
            const isCompleted = i < currentStep;
            const isCurrent = i === currentStep;
            return (
              <React.Fragment key={stepName}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.775rem',
                    fontWeight: isCurrent ? 700 : 500,
                    background: isCurrent ? 'var(--primary-600)' : isCompleted ? 'var(--success-bg)' : 'var(--slate-100)',
                    color: isCurrent ? '#fff' : isCompleted ? 'var(--success-text)' : 'var(--slate-500)',
                    border: isCompleted ? '1px solid var(--success-border)' : '1px solid transparent',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>{i + 1}. {stepName}</span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ width: '16px', height: '2px', background: isCompleted ? 'var(--success-border)' : 'var(--slate-200)' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
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

      {/* Fullscreen Image Lightbox Modal */}
      {activeImageModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveImageModal(null);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1.5rem',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                marginBottom: '0.75rem',
                color: '#fff',
              }}
            >
              <div style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>{activeImageModal.title || 'Evidence Inspection'}</span>
                {activeImageModal.images?.length > 1 && (
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--slate-300)',
                      background: 'rgba(255,255,255,0.18)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 700,
                    }}
                  >
                    {activeImageModal.index + 1} of {activeImageModal.images.length}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setActiveImageModal(null)}
                aria-label="Close image modal"
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '34px',
                  height: '34px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.35)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Image Viewport */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Previous Button */}
              {activeImageModal.images?.length > 1 && (
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageModal((prev) => ({
                      ...prev,
                      index: (prev.index - 1 + prev.images.length) % prev.images.length,
                    }));
                  }}
                  style={{
                    position: 'absolute',
                    left: '-3.5rem',
                    background: 'rgba(255,255,255,0.22)',
                    border: 'none',
                    color: '#fff',
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-full)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 10,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.4)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
                >
                  <ChevronLeft size={26} />
                </button>
              )}

              <img
                src={
                  activeImageModal.images
                    ? activeImageModal.images[activeImageModal.index]
                    : activeImageModal.url
                }
                alt={activeImageModal.title || 'Evidence Inspection'}
                style={{
                  maxWidth: '85vw',
                  maxHeight: '78vh',
                  borderRadius: 'var(--radius-md)',
                  objectFit: 'contain',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src =
                    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="%23222" width="400" height="300"/><text fill="%23aaa" font-family="sans-serif" font-size="14" x="50%" y="50%" text-anchor="middle">Photo evidence could not be loaded</text></svg>';
                }}
              />

              {/* Next Button */}
              {activeImageModal.images?.length > 1 && (
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageModal((prev) => ({
                      ...prev,
                      index: (prev.index + 1) % prev.images.length,
                    }));
                  }}
                  style={{
                    position: 'absolute',
                    right: '-3.5rem',
                    background: 'rgba(255,255,255,0.22)',
                    border: 'none',
                    color: '#fff',
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-full)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 10,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.4)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
                >
                  <ChevronRight size={26} />
                </button>
              )}
            </div>

            {/* Bottom Keyboard Hint */}
            <div style={{ color: 'var(--slate-400)', fontSize: '0.785rem', marginTop: '0.75rem', textAlign: 'center' }}>
              Press <kbd style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '3px', color: '#fff' }}>ESC</kbd> or click outside to close
              {activeImageModal.images?.length > 1 && (
                <span> • Use <kbd style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '3px', color: '#fff' }}>←</kbd> <kbd style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '3px', color: '#fff' }}>→</kbd> keys to navigate</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Alert Callout */}
      {wasRejected && (
        <div
          style={{
            padding: '1rem 1.25rem',
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning-border)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
          }}
        >
          <AlertTriangle size={20} style={{ color: 'var(--warning-solid)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--warning-text)', fontSize: '0.9rem' }}>
              Previous Resolution Proof Was Rejected by Department Admin
            </strong>
            <p style={{ fontSize: '0.85rem', color: 'var(--slate-700)', marginTop: '0.25rem', marginBottom: 0 }}>
              <strong>Admin Feedback:</strong> "{grievance.rejectionReason}"
            </p>
            <p style={{ fontSize: '0.785rem', color: 'var(--slate-500)', marginTop: '0.25rem', marginBottom: 0 }}>
              The original Resolution SLA remains active. Please execute required field corrections and re-submit proof below.
            </p>
          </div>
        </div>
      )}

      {/* SLA Extension Request Modal */}
      {showExtensionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', maxWidth: '500px', width: '100%', padding: '1.75rem', boxShadow: 'var(--shadow-xl)' }}>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '0.4rem' }}>Request SLA Deadline Extension</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginBottom: '1.25rem' }}>
              Current Extensions: <strong>{grievance.extensionCount || 0} of {EXTENSION_LIMITS.MAX_EXTENSIONS_PER_COMPLAINT} maximum</strong>.
              All extensions require operational justification and Admin approval.
            </p>

            <form onSubmit={handleExtensionSubmit}>
              <div className="form-group">
                <label className="form-label">Extension Duration *</label>
                <select
                  className="form-select"
                  value={extensionHours}
                  onChange={(e) => setExtensionHours(Number(e.target.value))}
                >
                  <option value={12}>+12 Hours</option>
                  <option value={24}>+24 Hours (Standard)</option>
                  <option value={48}>+48 Hours (Major Works)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Operational Justification *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail cause of delay (e.g. specialized equipment transit, asphalt cooling delays, severe rainfall)..."
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  className="form-textarea"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <Button variant="secondary" onClick={() => setShowExtensionModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={extensionSubmitting}>
                  Submit Extension Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Left Column: Complaint Narrative & Citizen Evidence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Complaint Information */}
          <Card>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Complaint Narrative & Location</h3>
            <p style={{ fontSize: '0.925rem', color: 'var(--slate-700)', lineHeight: '1.6', marginBottom: '1.25rem' }}>
              {grievance.description}
            </p>

            <div style={{ borderTop: '1px solid var(--slate-200)', paddingTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--slate-600)' }}>
              <div><strong>Assigned Department:</strong> {grievance.departmentName} ({grievance.departmentCode})</div>
              <div><strong>Ward / Location:</strong> {grievance.ward} {grievance.landmark ? `• ${grievance.landmark}` : ''}</div>
              {grievance.location?.lat && (
                <div><strong>GPS Coordinates:</strong> {grievance.location.lat}, {grievance.location.lng}</div>
              )}
              <div><strong>Reported By:</strong> {grievance.citizenName} ({grievance.citizenEmail})</div>
              <div><strong>Assigned Officer:</strong> {grievance.assignedOfficerId ? (currentUser.displayName || currentUser.email) : 'Unclaimed Department Pool'}</div>
            </div>
          </Card>

          {/* Citizen Initial Intake Proof (BEFORE PROOF) */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Citizen Intake Photographic Evidence (BEFORE)</h3>
              {grievance.mediaUrls && grievance.mediaUrls.length > 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--primary-700)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Maximize2 size={12} /> Click to view full image
                </span>
              )}
            </div>

            {grievance.mediaUrls && grievance.mediaUrls.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                {grievance.mediaUrls.map((url, i) => (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    aria-label={`View full citizen intake photo #${i + 1}`}
                    onClick={() =>
                      setActiveImageModal({
                        images: grievance.mediaUrls,
                        index: i,
                        title: `Citizen Intake Evidence #${i + 1} • ${grievance.title}`,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveImageModal({
                          images: grievance.mediaUrls,
                          index: i,
                          title: `Citizen Intake Evidence #${i + 1} • ${grievance.title}`,
                        });
                      }
                    }}
                    style={{
                      border: '1px solid var(--slate-200)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      height: '120px',
                      background: 'var(--slate-100)',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <img
                      src={url}
                      alt={`Before Evidence #${i + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="130" height="120" viewBox="0 0 130 120"><rect fill="%23eee" width="130" height="120"/><text fill="%23aaa" font-family="sans-serif" font-size="10" x="50%" y="50%" text-anchor="middle">Photo unavailable</text></svg>';
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        background: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        padding: '3px 6px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.7rem',
                      }}
                    >
                      <Maximize2 size={11} />
                      <span>Zoom</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '1.25rem', background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.85rem' }}>
                No initial media files attached by citizen.
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Clocks & Officer Action Workstation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* SLA Governance Dashboard */}
          <Card>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} /> SLA Clocks & AI Risk Governance
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
              {grievance.aiSlaPrediction && (
                <div
                  style={{
                    padding: '0.75rem',
                    background: grievance.aiSlaPrediction.riskLevel === 'HIGH' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.08)',
                    border: `1px solid ${grievance.aiSlaPrediction.riskLevel === 'HIGH' ? 'var(--danger-border)' : 'var(--info-border)'}`,
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 700, color: grievance.aiSlaPrediction.riskLevel === 'HIGH' ? 'var(--danger-solid)' : 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Sparkles size={14} /> AI SLA Risk Warning: {grievance.aiSlaPrediction.riskLevel} RISK
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-700)' }}>
                      {(grievance.aiSlaPrediction.breachProbability * 100).toFixed(1)}% Prob
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-600)', lineHeight: '1.4' }}>
                    AI estimates higher likelihood of response delay. Key factors: {grievance.aiSlaPrediction.topFactors?.slice(0, 3).join(', ')}.
                  </div>
                </div>
              )}

              <div style={{ padding: '0.75rem', background: grievance.seenAt ? 'var(--success-bg)' : 'var(--warning-bg)', border: `1px solid ${grievance.seenAt ? 'var(--success-border)' : 'var(--warning-border)'}`, borderRadius: 'var(--radius-md)' }}>
                <strong>Response SLA:</strong> {grievance.seenAt ? `MET (Seen at ${new Date(grievance.seenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : `${responseEval?.remainingHours || 0}h window active`}
              </div>

              <div style={{ padding: '0.75rem', background: resolutionEval.isBreached ? 'var(--danger-bg)' : 'var(--info-bg)', border: `1px solid ${resolutionEval.isBreached ? 'var(--danger-border)' : 'var(--info-border)'}`, borderRadius: 'var(--radius-md)' }}>
                <strong>Resolution SLA:</strong> <span style={{ fontWeight: 700 }}>{resolutionEval.formattedCountdown}</span>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate-600)', marginTop: '0.25rem' }}>
                  Policy: Clock counts down continuously and stops ONLY when Department Admin marks Verified Resolved.
                </div>
              </div>
            </div>
          </Card>

          {/* Action Station A: Unacknowledged Work Order */}
          {isSubmitted && !grievance.seenAt && (
            <Card>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Acknowledge Work Order</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginBottom: '1rem', lineHeight: '1.45' }}>
                Click below to acknowledge this grievance, claim officer ownership, and fulfill the mandatory Response SLA.
              </p>
              <Button variant="primary" icon={Eye} onClick={handleMarkAsSeen} style={{ width: '100%' }}>
                Acknowledge & Mark as Seen
              </Button>
            </Card>
          )}

          {/* Action Station B: Resolution Proof Submission Form */}
          {isSeenOrInProgress && (
            <Card>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>Submit Resolution Proof</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                Enter engineering notes and attach after-rectification photos for Department Admin Verification.
              </p>

              <form onSubmit={handleEvidenceSubmit}>
                <div className="form-group">
                  <label className="form-label">Completion / Engineering Remarks *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Detail work completed (e.g. laid cold-mix asphalt, compacted subgrade, cleared debris, road opened for transit)..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="form-textarea"
                    disabled={submittingProof}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">After-Rectification Photographic Proof *</label>

                  {/* Hidden Native File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    disabled={submittingProof}
                  />

                  {/* Upload Drop Target Area or Image Preview */}
                  {!evidencePreview ? (
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Upload after-rectification photo"
                      onClick={handleTriggerFileInput}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleTriggerFileInput();
                        }
                      }}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      style={{
                        border: isDragging ? '2px dashed var(--primary-600)' : '2px dashed var(--slate-300)',
                        padding: '1.5rem',
                        textAlign: 'center',
                        borderRadius: 'var(--radius-md)',
                        background: isDragging ? 'var(--primary-50)' : 'var(--slate-50)',
                        cursor: submittingProof ? 'not-allowed' : 'pointer',
                        transition: 'border-color 0.2s, background-color 0.2s',
                        outline: 'none',
                      }}
                    >
                      <Camera size={28} style={{ margin: '0 auto 0.4rem auto', color: 'var(--primary-600)' }} />
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--slate-800)' }}>
                        Click or drag & drop to attach resolution photo
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>
                        Supports JPG, PNG, WEBP up to 10MB
                      </div>
                    </div>
                  ) : (
                    <div style={{ border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)', padding: '0.75rem', background: 'var(--slate-50)' }}>
                      <div style={{ position: 'relative', height: '160px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: '#000', marginBottom: '0.5rem' }}>
                        <img
                          src={evidencePreview}
                          alt="Rectification Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--slate-600)' }}>
                        <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {evidenceFile?.name} ({(evidenceFile?.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>

                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={RotateCcw}
                            onClick={handleTriggerFileInput}
                            disabled={submittingProof}
                          >
                            Replace
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRemoveFile}
                            disabled={submittingProof}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  icon={Send}
                  loading={submittingProof}
                  disabled={submittingProof || !evidenceFile || !remarks.trim()}
                  style={{ width: '100%', marginTop: '0.5rem' }}
                >
                  Submit for Verification Gate
                </Button>
              </form>
            </Card>
          )}

          {/* Action Station C: Under Verification State */}
          {isUnderVerification && (
            <Card>
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <FileCheck size={36} style={{ color: 'var(--primary-600)', margin: '0 auto 0.5rem auto' }} />
                <h3 style={{ fontSize: '1.15rem', marginBottom: '0.35rem' }}>Under Verification Gate</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', lineHeight: '1.45', marginBottom: '1rem' }}>
                  Resolution proof has been submitted and is currently in the <strong>Department Admin Verification Queue</strong>.
                </p>

                {grievance.resolutionProof?.afterMediaUrls?.[0] && (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="View full submitted rectification proof"
                    onClick={() =>
                      setActiveImageModal({
                        images: grievance.resolutionProof.afterMediaUrls,
                        index: 0,
                        title: `Submitted Rectification Proof • ${grievance.title}`,
                      })
                    }
                    style={{
                      border: '1px solid var(--slate-200)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      height: '140px',
                      marginBottom: '0.75rem',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={grievance.resolutionProof.afterMediaUrls[0]}
                      alt="Submitted Rectification Proof"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="140" viewBox="0 0 400 140"><rect fill="%23eee" width="400" height="140"/><text fill="%23aaa" font-family="sans-serif" font-size="12" x="50%" y="50%" text-anchor="middle">Proof image unavailable</text></svg>';
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        background: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        padding: '3px 6px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.7rem',
                      }}
                    >
                      <Maximize2 size={11} />
                      <span>Zoom</span>
                    </div>
                  </div>
                )}

                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', background: 'var(--slate-50)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', textAlign: 'left' }}>
                  <strong>Submitted Remarks:</strong> "{grievance.resolutionProof?.remarks}"
                </div>
              </div>
            </Card>
          )}

          {/* Action Station D: Verified Resolved */}
          {isVerifiedResolved && (
            <Card>
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <CheckCircle2 size={40} style={{ color: 'var(--success-solid)', margin: '0 auto 0.5rem auto' }} />
                <h3 style={{ fontSize: '1.15rem', marginBottom: '0.35rem', color: 'var(--success-text)' }}>
                  Verified & Resolved
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', lineHeight: '1.45', marginBottom: '1rem' }}>
                  Verified by <strong>{grievance.verifiedByName || 'Department Admin'}</strong> on{' '}
                  {new Date(grievance.verifiedResolvedAt || Date.now()).toLocaleDateString()}. Resolution SLA has stopped.
                </p>

                {grievance.resolutionProof?.afterMediaUrls?.[0] && (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="View full verified rectification proof"
                    onClick={() =>
                      setActiveImageModal({
                        images: grievance.resolutionProof.afterMediaUrls,
                        index: 0,
                        title: `Verified Rectification Proof • ${grievance.title}`,
                      })
                    }
                    style={{
                      border: '1px solid var(--slate-200)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      height: '140px',
                      marginBottom: '0.75rem',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={grievance.resolutionProof.afterMediaUrls[0]}
                      alt="Verified Rectification Proof"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="140" viewBox="0 0 400 140"><rect fill="%23eee" width="400" height="140"/><text fill="%23aaa" font-family="sans-serif" font-size="12" x="50%" y="50%" text-anchor="middle">Proof image unavailable</text></svg>';
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        background: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        padding: '3px 6px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.7rem',
                      }}
                    >
                      <Maximize2 size={11} />
                      <span>Zoom</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Action Station E: Grievance Closed & Archived */}
          {isClosed && (
            <Card>
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <CheckCircle2 size={40} style={{ color: 'var(--primary-700)', margin: '0 auto 0.5rem auto' }} />
                <h3 style={{ fontSize: '1.15rem', marginBottom: '0.35rem', color: 'var(--slate-800)' }}>
                  Grievance Closed & Archived
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', lineHeight: '1.45', marginBottom: '1rem' }}>
                  Officially closed by <strong>{grievance.closedByName || 'Department Admin'}</strong> on{' '}
                  {new Date(grievance.closedAt || grievance.updatedAt).toLocaleDateString()}. Work order is fully terminal and archived.
                </p>

                {grievance.closureRemarks && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-600)', background: 'var(--slate-50)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', textAlign: 'left', marginBottom: '0.75rem' }}>
                    <strong>Closure Remarks:</strong> "{grievance.closureRemarks}"
                  </div>
                )}

                {grievance.resolutionProof?.afterMediaUrls?.[0] && (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="View full archived rectification proof"
                    onClick={() =>
                      setActiveImageModal({
                        images: grievance.resolutionProof.afterMediaUrls,
                        index: 0,
                        title: `Archived Rectification Proof • ${grievance.title}`,
                      })
                    }
                    style={{
                      border: '1px solid var(--slate-200)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      height: '140px',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={grievance.resolutionProof.afterMediaUrls[0]}
                      alt="Archived Rectification Proof"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="140" viewBox="0 0 400 140"><rect fill="%23eee" width="400" height="140"/><text fill="%23aaa" font-family="sans-serif" font-size="12" x="50%" y="50%" text-anchor="middle">Proof image unavailable</text></svg>';
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        background: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        padding: '3px 6px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.7rem',
                      }}
                    >
                      <Maximize2 size={11} />
                      <span>Zoom</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
