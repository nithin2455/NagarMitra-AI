import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, SeverityBadge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { grievanceService } from '../../services/firebase/grievanceService.js';
import { COMPLAINT_STATUS } from '../../models/schema.js';
import { Search, CheckCircle2, CircleDot, Clock, MapPin, Building2, AlertCircle } from 'lucide-react';

export const TrackGrievancePage = () => {
  const [queryId, setQueryId] = useState('CP-2026-0002');
  const [grievance, setGrievance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  const fetchGrievance = async (idToSearch) => {
    const trimmed = (idToSearch || '').trim().toUpperCase();
    if (!trimmed) {
      setSearchError('Please enter a Grievance Reference ID.');
      return;
    }

    setLoading(true);
    setSearchError('');

    try {
      const record = await grievanceService.getGrievanceById(trimmed);
      if (!record) {
        setSearchError(`No grievance found with Reference ID: ${trimmed}`);
        setGrievance(null);
      } else if (record.isSensitive) {
        setSearchError(`Grievance #${trimmed} is marked confidential and can only be tracked from the authenticated citizen portal.`);
        setGrievance(null);
      } else {
        setGrievance(record);
      }
    } catch (err) {
      setSearchError('Failed to search grievance timeline. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch for default ID
    fetchGrievance('CP-2026-0002');
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchGrievance(queryId);
  };

  // Build dynamic 8-stage lifecycle
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

  const currentRank = grievance ? statusRank[grievance.status] || 1 : 1;

  const stages = grievance
    ? [
        {
          label: 'Submitted',
          done: currentRank >= 1,
          time: `Intake recorded on ${new Date(grievance.createdAt).toLocaleString()}`,
        },
        {
          label: 'Seen by Officer',
          done: currentRank >= 2 || Boolean(grievance.seenAt),
          time: grievance.seenAt
            ? `Acknowledged at ${new Date(grievance.seenAt).toLocaleString()}`
            : 'Response SLA actively running',
        },
        {
          label: 'Verified',
          done: currentRank >= 3,
          time: currentRank >= 3 ? 'Legitimacy confirmed by department' : 'Pending verification',
        },
        {
          label: 'In Progress',
          done: currentRank >= 4,
          time: currentRank >= 4 ? 'Field operations active' : 'Pending work crew dispatch',
        },
        {
          label: 'Resolution Submitted',
          done: currentRank >= 5,
          time: currentRank >= 5 ? 'Rectification evidence submitted' : 'Pending field proof',
        },
        {
          label: 'Under Verification',
          done: currentRank >= 6,
          time: currentRank >= 6 ? 'Supervisor dual-proof verification review' : 'Resolution SLA active',
        },
        {
          label: 'Verified Resolved',
          done: currentRank >= 7,
          time: currentRank >= 7
            ? `Resolution confirmed by ${grievance.verifiedByName || 'Admin'} • SLA Halted`
            : 'Pending administrative verification',
        },
        {
          label: 'Closed',
          done: currentRank >= 8 || grievance.status === COMPLAINT_STATUS.CLOSED,
          time:
            grievance.status === COMPLAINT_STATUS.CLOSED
              ? `Closed & archived by ${grievance.closedByName || 'Admin'} on ${new Date(grievance.closedAt || grievance.updatedAt).toLocaleDateString()}`
              : 'Pending final administrative closure',
        },
      ]
    : [];

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: '850px' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', marginBottom: '0.5rem' }}>Track Grievance Timeline</h1>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.925rem' }}>
          Enter your reference ID to monitor real-time department milestones and SLA progress.
        </p>
      </div>

      <Card style={{ marginBottom: '2rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="text"
            placeholder="e.g. CP-2026-0001 or CP-2026-0002"
            value={queryId}
            onChange={(e) => {
              setQueryId(e.target.value);
              setSearchError('');
            }}
            className="form-input"
            style={{ flex: 1 }}
          />
          <Button type="submit" variant="primary" icon={Search} loading={loading} disabled={loading}>
            Track Issue
          </Button>
        </form>

        {searchError && (
          <div style={{ color: 'var(--danger-solid)', fontSize: '0.85rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <AlertCircle size={15} />
            <span>{searchError}</span>
          </div>
        )}
      </Card>

      {/* Live Grievance Record */}
      {loading ? (
        <LoadingSpinner message="Searching public municipal registry..." />
      ) : grievance ? (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid var(--slate-200)', paddingBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>
                  {grievance.grievanceId || grievance.id}
                </span>
                <SeverityBadge severity={grievance.severity} />
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--slate-900)', marginBottom: '0.35rem' }}>
                {grievance.title}
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Building2 size={14} /> {grievance.departmentName}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MapPin size={14} /> {grievance.ward}
                </span>
              </div>
            </div>
            <StatusBadge status={grievance.status} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingLeft: '0.5rem' }}>
            {stages.map((stg, i) => (
              <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ marginTop: '2px' }}>
                  {stg.done ? (
                    <CheckCircle2 size={20} style={{ color: 'var(--success-solid)' }} />
                  ) : (
                    <CircleDot size={20} style={{ color: 'var(--slate-300)' }} />
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.925rem', color: stg.done ? 'var(--slate-900)' : 'var(--slate-400)' }}>
                    {stg.label}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: stg.done ? 'var(--slate-600)' : 'var(--slate-400)' }}>
                    {stg.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
};
