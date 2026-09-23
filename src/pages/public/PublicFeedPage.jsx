import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card';
import { StatusBadge, SeverityBadge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { grievanceService } from '../../services/firebase/grievanceService.js';
import { slaEngine } from '../../services/governance/slaEngine.js';
import { useAuth } from '../../context/AuthContext';
import { CATEGORIES, COMPLAINT_STATUS } from '../../models/schema.js';
import {
  ThumbsUp,
  AlertCircle,
  MapPin,
  Clock,
  Building2,
  Search,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
} from 'lucide-react';

export const PublicFeedPage = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedWard, setSelectedWard] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [searchTerm, setSearchTerm] = useState('');
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userFeedback, setUserFeedback] = useState(null);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const data = await grievanceService.getPublicGrievances(selectedCategory, selectedWard, sortBy);
      setIssues(data);
    } catch (err) {
      console.error('Error loading public feed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, [selectedCategory, selectedWard, sortBy]);

  const handleSupport = async (id) => {
    if (!isAuthenticated || !currentUser) {
      setUserFeedback({
        type: 'warning',
        message: 'Please sign in as a citizen to support civic issues.',
      });
      return;
    }

    try {
      const { grievance, hasSupported } = await grievanceService.toggleSupport(id, currentUser);
      setIssues((prev) =>
        prev.map((item) => {
          if (item.id === id || item.grievanceId === id) {
            return {
              ...item,
              supportCount: grievance.supportCount,
              priorityScore: grievance.priorityScore,
              priorityLevel: grievance.priorityLevel,
              hasSupported,
            };
          }
          return item;
        })
      );

      setUserFeedback({
        type: 'success',
        message: hasSupported
          ? `You supported issue #${id}. Your civic vote helps elevate community priority.`
          : `Removed your support from #${id}.`,
      });
    } catch (err) {
      setUserFeedback({
        type: 'danger',
        message: err.message || 'Failed to register support.',
      });
    }
  };

  const handleFollowUp = async (id) => {
    if (!isAuthenticated || !currentUser) {
      setUserFeedback({
        type: 'warning',
        message: 'Please sign in as a citizen to submit a "Still Not Resolved" follow-up.',
      });
      return;
    }

    try {
      const updated = await grievanceService.submitFollowUp(id, currentUser);
      setIssues((prev) =>
        prev.map((item) => {
          if (item.id === id || item.grievanceId === id) {
            return {
              ...item,
              followUpCount: updated.followUpCount,
              priorityScore: updated.priorityScore,
              priorityLevel: updated.priorityLevel,
              escalationLevel: updated.escalationLevel,
              hasFollowedUp: true,
            };
          }
          return item;
        })
      );

      setUserFeedback({
        type: 'warning',
        message: `"Still Not Resolved" signal recorded for #${id}. Community follow-ups: ${updated.followUpCount}.`,
      });
    } catch (err) {
      setUserFeedback({
        type: 'info',
        message: err.message || 'You have already submitted a follow-up for this issue.',
      });
    }
  };

  const filteredIssues = issues.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.title.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      (item.ward && item.ward.toLowerCase().includes(term)) ||
      (item.grievanceId && item.grievanceId.toLowerCase().includes(term))
    );
  });

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: '1080px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Community Transparency Feed</h1>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem' }}>
            Live public civic issues reported across municipal wards. Transparent status tracking & community support signals.
          </p>
        </div>

        {/* Search & Sort Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search title, ward, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ width: '220px', paddingLeft: '2rem' }}
            />
            <Search size={15} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="form-select"
            style={{ width: 'auto' }}
          >
            <option value="all">All Categories</option>
            {Object.values(CATEGORIES).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="form-select"
            style={{ width: 'auto' }}
          >
            <option value="all">All Wards</option>
            <option value="Ward 4 - North Zone">Ward 4 - North Zone</option>
            <option value="Ward 8 - Central Zone">Ward 8 - Central Zone</option>
            <option value="Ward 12 - South Zone">Ward 12 - South Zone</option>
            <option value="Ward 16 - East Zone">Ward 16 - East Zone</option>
            <option value="Ward 18 - West Zone">Ward 18 - West Zone</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="form-select"
            style={{ width: 'auto' }}
          >
            <option value="recent">Recently Reported</option>
            <option value="supported">Most Supported</option>
            <option value="followed_up">Most Followed-Up</option>
            <option value="critical">Critical / Highest Priority</option>
          </select>
        </div>
      </div>

      {/* User Feedback Banner */}
      {userFeedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background:
              userFeedback.type === 'success'
                ? 'var(--success-bg)'
                : userFeedback.type === 'warning'
                ? 'var(--warning-bg)'
                : userFeedback.type === 'danger'
                ? 'var(--danger-bg)'
                : 'var(--info-bg)',
            border: `1px solid ${
              userFeedback.type === 'success'
                ? 'var(--success-border)'
                : userFeedback.type === 'warning'
                ? 'var(--warning-border)'
                : userFeedback.type === 'danger'
                ? 'var(--danger-border)'
                : 'var(--info-border)'
            }`,
            borderRadius: 'var(--radius-md)',
            color:
              userFeedback.type === 'success'
                ? 'var(--success-text)'
                : userFeedback.type === 'warning'
                ? 'var(--warning-text)'
                : userFeedback.type === 'danger'
                ? 'var(--danger-text)'
                : 'var(--info-text)',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{userFeedback.message}</span>
          <button
            onClick={() => setUserFeedback(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Grievance Stream List */}
      {loading ? (
        <LoadingSpinner message="Loading live community issues..." />
      ) : filteredIssues.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <p style={{ color: 'var(--slate-500)' }}>No public grievances match your filter criteria.</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filteredIssues.map((issue) => {
            const resolutionEval = slaEngine.evaluateResolutionSLA(issue);

            return (
              <Card key={issue.id || issue.grievanceId} hoverable>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>
                        {issue.grievanceId || issue.id}
                      </span>
                      <StatusBadge status={issue.status} />
                      <SeverityBadge severity={issue.severity} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-700)' }}>
                        Priority: {issue.priorityScore} / 100
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                        • {issue.reportedBy || 'Reported by a CivicPulse citizen'}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.15rem', marginBottom: '0.35rem', color: 'var(--slate-900)' }}>
                      {issue.title}
                    </h3>

                    <p style={{ color: 'var(--slate-600)', fontSize: '0.9rem', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                      {issue.description}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.8rem', color: 'var(--slate-500)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Building2 size={13} /> {issue.departmentName}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <MapPin size={13} /> {issue.generalizedLocation || issue.ward}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: resolutionEval.isBreached ? 'var(--danger-solid)' : 'var(--slate-600)' }}>
                        <Clock size={13} /> Resolution SLA: <strong>{resolutionEval.formattedCountdown}</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <Button
                      variant={issue.hasSupported ? 'primary' : 'outline'}
                      size="sm"
                      icon={ThumbsUp}
                      onClick={() => handleSupport(issue.id || issue.grievanceId)}
                    >
                      {issue.hasSupported ? `Supported (${issue.supportCount || 0})` : `Support (${issue.supportCount || 0})`}
                    </Button>

                    <Button
                      variant={issue.hasFollowedUp ? 'danger' : 'secondary'}
                      size="sm"
                      icon={AlertCircle}
                      onClick={() => handleFollowUp(issue.id || issue.grievanceId)}
                    >
                      {issue.hasFollowedUp ? `Followed Up (${issue.followUpCount || 0})` : `Still Not Resolved (${issue.followUpCount || 0})`}
                    </Button>
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
