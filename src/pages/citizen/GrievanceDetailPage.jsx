import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, SeverityBadge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { grievanceService } from '../../services/firebase/grievanceService.js';
import { slaEngine } from '../../services/governance/slaEngine.js';
import { useAuth } from '../../context/AuthContext';
import { COMPLAINT_STATUS, COMPLAINT_VISIBILITY } from '../../models/schema.js';
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  Clock,
  Building2,
  MapPin,
  ThumbsUp,
  AlertCircle,
  Wrench,
  UploadCloud,
  FileText,
  Compass,
  Shield,
} from 'lucide-react';

export const GrievanceDetailPage = () => {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [grievance, setGrievance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [supports, setSupports] = useState(0);
  const [hasSupported, setHasSupported] = useState(false);
  const [followUps, setFollowUps] = useState(0);
  const [hasFollowedUp, setHasFollowedUp] = useState(false);
  const [notification, setNotification] = useState(null);

  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [diyNarrative, setDiyNarrative] = useState('');
  const [diySubmitting, setDiySubmitting] = useState(false);

  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const item = await grievanceService.getGrievanceById(id, currentUser);
        if (!item) {
          setError(`Grievance #${id} not found.`);
        } else {
          setGrievance(item);
          setSupports(item.supportCount || 0);
          setFollowUps(item.followUpCount || 0);
        }
      } catch (err) {
        setError(err.message || 'Failed to load grievance details.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [id, currentUser]);

  const handleSupportClick = async () => {
    if (!currentUser) {
      setNotification({ type: 'warning', text: 'Please sign in to support this grievance.' });
      return;
    }

    try {
      const { grievance: updated, hasSupported: nextSupported } = await grievanceService.toggleSupport(
        grievance.id,
        currentUser
      );
      setHasSupported(nextSupported);
      setSupports(updated.supportCount);
      setGrievance((prev) => ({
        ...prev,
        supportCount: updated.supportCount,
        priorityScore: updated.priorityScore,
        priorityLevel: updated.priorityLevel,
      }));
      setNotification({
        type: 'success',
        text: nextSupported ? 'Support recorded. Helps prioritize municipal action.' : 'Support removed.',
      });
    } catch (err) {
      setNotification({ type: 'danger', text: err.message || 'Failed to toggle support.' });
    }
  };

  const handleFollowUpClick = async () => {
    if (!currentUser) {
      setNotification({ type: 'warning', text: 'Please sign in to submit a follow-up.' });
      return;
    }

    try {
      const updated = await grievanceService.submitFollowUp(grievance.id, currentUser);
      setHasFollowedUp(true);
      setFollowUps(updated.followUpCount);
      setGrievance((prev) => ({
        ...prev,
        followUpCount: updated.followUpCount,
        priorityScore: updated.priorityScore,
        priorityLevel: updated.priorityLevel,
        escalationLevel: updated.escalationLevel,
      }));
      setNotification({
        type: 'warning',
        text: `Follow-up recorded: "Still Not Resolved" (${updated.followUpCount} signals). Notice escalated to supervisor queue.`,
      });
    } catch (err) {
      setNotification({ type: 'info', text: err.message || 'You have already registered your follow-up.' });
    }
  };

  const handleDiySubmit = async (e) => {
    e.preventDefault();
    if (!diyNarrative.trim() || diySubmitting) return;

    setDiySubmitting(true);
    try {
      const updated = await grievanceService.submitCommunityAction(grievance.id, currentUser, {
        narrative: diyNarrative.trim(),
      });
      setGrievance(updated);
      setShowCommunityModal(false);
      setDiyNarrative('');
      setNotification({
        type: 'success',
        text: 'Community action submitted for municipal verification. Resolution SLA remains active until verified.',
      });
    } catch (err) {
      setNotification({ type: 'danger', text: err.message || 'Failed to submit community action.' });
    } finally {
      setDiySubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Retrieving grievance record..." />;
  }

  if (error || !grievance) {
    return (
      <div style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
        <Card>
          <AlertCircle size={40} style={{ color: 'var(--danger-solid)', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Grievance Restricted / Not Found</h2>
          <p style={{ color: 'var(--slate-500)', marginBottom: '1.5rem' }}>
            {error || `Unable to locate grievance reference "${id}".`}
          </p>
          <Link to="/citizen/my-grievances">
            <Button variant="primary">Back to My Submissions</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const resolutionEval = slaEngine.evaluateResolutionSLA(grievance);

  // Construct dynamic 8-stage lifecycle from actual document properties
  const statusRank = {
    [COMPLAINT_STATUS.SUBMITTED]: 1,
    [COMPLAINT_STATUS.SEEN]: 2,
    [COMPLAINT_STATUS.VERIFIED]: 3,
    [COMPLAINT_STATUS.IN_PROGRESS]: 4,
    [COMPLAINT_STATUS.RESOLUTION_SUBMITTED]: 5,
    [COMPLAINT_STATUS.COMMUNITY_ACTION_SUBMITTED]: 5,
    [COMPLAINT_STATUS.VERIFICATION]: 6,
    [COMPLAINT_STATUS.VERIFIED_RESOLVED]: 7,
    [COMPLAINT_STATUS.CLOSED]: 8,
  };

  const currentRank = statusRank[grievance.status] || 1;

  const lifecycleStages = [
    {
      name: '1. SUBMITTED',
      done: currentRank >= 1,
      note: `Submitted on ${new Date(grievance.createdAt).toLocaleString()}`,
    },
    {
      name: '2. SEEN BY OFFICER',
      done: currentRank >= 2 || Boolean(grievance.seenAt),
      note: grievance.seenAt
        ? `Seen at ${new Date(grievance.seenAt).toLocaleString()} • Response SLA Met`
        : 'Response SLA actively running',
    },
    {
      name: '3. VERIFIED',
      done: currentRank >= 3,
      note: currentRank >= 3 ? 'Legitimacy verified & assigned to work queue' : 'Pending verification',
    },
    {
      name: '4. IN PROGRESS',
      done: currentRank >= 4,
      note: currentRank >= 4 ? 'Field work / operations underway' : 'Pending crew dispatch',
    },
    {
      name: '5. RESOLUTION / COMMUNITY ACTION SUBMITTED',
      done: currentRank >= 5,
      note:
        grievance.status === COMPLAINT_STATUS.COMMUNITY_ACTION_SUBMITTED
          ? 'Citizen community remediation proof submitted'
          : currentRank >= 5
          ? 'Field repair proof submitted'
          : 'Pending completion proof',
    },
    {
      name: '6. UNDER VERIFICATION',
      done: currentRank >= 6,
      note: currentRank >= 6 ? 'Supervisor dual-proof verification review' : 'Resolution SLA actively counting down',
    },
    {
      name: '7. VERIFIED RESOLVED',
      done: currentRank >= 7,
      note: currentRank >= 7
        ? `Verified by ${grievance.verifiedByName || 'Department Admin'} • Resolution SLA halted`
        : 'Pending Admin Verification sign-off',
    },
    {
      name: '8. CLOSED',
      done: currentRank >= 8 || grievance.status === COMPLAINT_STATUS.CLOSED,
      note:
        grievance.status === COMPLAINT_STATUS.CLOSED
          ? `Closed & archived by ${grievance.closedByName || 'Department Admin'} on ${new Date(grievance.closedAt || grievance.updatedAt).toLocaleString()}`
          : 'Pending final administrative closure',
    },
  ];

  const isTerminalState = [COMPLAINT_STATUS.VERIFIED_RESOLVED, COMPLAINT_STATUS.CLOSED].includes(grievance.status);

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/citizen/my-grievances" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
          <ArrowLeft size={16} /> Back to My Submissions
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>
                {grievance.grievanceId || grievance.id}
              </span>
              <StatusBadge status={grievance.status} />
              <SeverityBadge severity={grievance.severity} />
              <span className="badge badge-neutral">Visibility: {grievance.visibility || 'PUBLIC'}</span>
              
              {grievance.isMasterIssue && (
                <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700 }}>
                  <Shield size={12} /> Master Issue ({grievance.reportCount || 1} Reports)
                </span>
              )}
              {grievance.isDuplicate && (
                <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  Consolidated Duplicate
                </span>
              )}
            </div>
            <h1 style={{ fontSize: '1.65rem', marginBottom: '0.25rem' }}>{grievance.title}</h1>
            <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
              {grievance.ward} • {grievance.departmentName}
            </p>
            {grievance.isDuplicate && grievance.masterComplaintId && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--amber-50, #fffbeb)',
                  border: '1px solid var(--amber-200, #fde68a)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.825rem',
                  color: 'var(--amber-900, #78350f)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>
                  This report was matched by AI as part of <strong>Master Issue #{grievance.masterComplaintId}</strong> (Group {grievance.duplicateGroupId}).
                </span>
                <Link
                  to={`/citizen/grievance/${grievance.masterComplaintId}`}
                  style={{ textDecoration: 'underline', fontWeight: 700, color: 'var(--primary-700)' }}
                >
                  View Master Issue →
                </Link>
              </div>
            )}
          </div>

          {!isTerminalState && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant={hasSupported ? 'primary' : 'outline'}
                size="sm"
                icon={ThumbsUp}
                onClick={handleSupportClick}
              >
                {hasSupported ? `Supported (${supports})` : `Support (${supports})`}
              </Button>

              <Button
                variant={hasFollowedUp ? 'danger' : 'secondary'}
                size="sm"
                icon={AlertCircle}
                onClick={handleFollowUpClick}
              >
                {hasFollowedUp ? `Followed Up (${followUps})` : `Still Not Resolved (${followUps})`}
              </Button>

              <Button
                variant="primary"
                size="sm"
                icon={Wrench}
                onClick={() => setShowCommunityModal(true)}
              >
                Submit Community Action
              </Button>
            </div>
          )}
        </div>
      </div>

      {notification && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background:
              notification.type === 'success'
                ? 'var(--success-bg)'
                : notification.type === 'warning'
                ? 'var(--warning-bg)'
                : notification.type === 'danger'
                ? 'var(--danger-bg)'
                : 'var(--info-bg)',
            border: `1px solid ${
              notification.type === 'success'
                ? 'var(--success-border)'
                : notification.type === 'warning'
                ? 'var(--warning-border)'
                : notification.type === 'danger'
                ? 'var(--danger-border)'
                : 'var(--info-border)'
            }`,
            borderRadius: 'var(--radius-md)',
            color:
              notification.type === 'success'
                ? 'var(--success-text)'
                : notification.type === 'warning'
                ? 'var(--warning-text)'
                : notification.type === 'danger'
                ? 'var(--danger-text)'
                : 'var(--info-text)',
            fontSize: '0.875rem',
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{notification.text}</span>
          <button
            onClick={() => setNotification(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Community Action Modal */}
      {showCommunityModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', maxWidth: '520px', width: '100%', padding: '1.75rem', boxShadow: 'var(--shadow-xl)' }}>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>Submit Community Remediation Proof</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginBottom: '1.25rem', lineHeight: '1.45' }}>
              If your community or neighborhood volunteers fixed this issue directly, submit repair notes and after-photos for municipal verification.
            </p>

            <form onSubmit={handleDiySubmit}>
              <div className="form-group">
                <label className="form-label">Remediation Narrative *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the action taken, volunteer names, and materials used..."
                  value={diyNarrative}
                  onChange={(e) => setDiyNarrative(e.target.value)}
                  className="form-textarea"
                />
              </div>

              <div className="form-group">
                <label className="form-label">After-Fix Photographic Evidence</label>
                <div style={{ border: '2px dashed var(--slate-300)', padding: '1rem', textAlign: 'center', borderRadius: 'var(--radius-md)', background: 'var(--slate-50)', fontSize: '0.8rem', color: 'var(--slate-500)', cursor: 'pointer' }}>
                  <UploadCloud size={24} style={{ margin: '0 auto 0.25rem auto', color: 'var(--primary-600)' }} />
                  <div>Select After Photo</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <Button variant="secondary" onClick={() => setShowCommunityModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={diySubmitting}>
                  Submit for Verification Gate
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem' }}>
        {/* Left Column: Description, Meta & Evidence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Card>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Grievance Description</h3>
            <p style={{ fontSize: '0.925rem', color: 'var(--slate-700)', lineHeight: '1.6', marginBottom: '1.25rem' }}>
              {grievance.description}
            </p>

            <div style={{ borderTop: '1px solid var(--slate-200)', paddingTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--slate-600)' }}>
              <div><strong>Assigned Department:</strong> {grievance.departmentName}</div>
              <div><strong>Ward / Location:</strong> {grievance.ward} {grievance.landmark ? `• ${grievance.landmark}` : ''}</div>
              {grievance.location?.lat && (
                <div><strong>GPS Coordinates:</strong> {grievance.location.lat}, {grievance.location.lng}</div>
              )}
              <div><strong>Reported By:</strong> {grievance.citizenName || 'Verified Citizen'}</div>
              <div><strong>Resolution SLA Status:</strong> <span style={{ color: resolutionEval.isBreached ? 'var(--danger-solid)' : 'var(--primary-700)', fontWeight: 700 }}>{resolutionEval.formattedCountdown}</span></div>
              <div><strong>Calculated Priority Score:</strong> {grievance.priorityScore} / 100</div>
            </div>
          </Card>

          {/* Photographic Evidence Gallery */}
          <Card>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Attached Evidence</h3>
            {grievance.mediaUrls && grievance.mediaUrls.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                {grievance.mediaUrls.map((url, i) => (
                  <div key={i} style={{ border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden', height: '120px', background: 'var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={url} alt={`Evidence #${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '1.5rem', background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.85rem' }}>
                No initial media files attached by citizen.
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: 8-Stage Timeline */}
        <div>
          <Card>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Lifecycle Timeline</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {lifecycleStages.map((stage, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{ marginTop: '2px' }}>
                    {stage.done ? (
                      <CheckCircle2 size={18} style={{ color: 'var(--success-solid)' }} />
                    ) : (
                      <CircleDot size={18} style={{ color: 'var(--slate-300)' }} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.825rem', fontWeight: 700, color: stage.done ? 'var(--slate-900)' : 'var(--slate-400)' }}>
                      {stage.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                      {stage.note}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
