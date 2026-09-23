import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, SeverityBadge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { grievanceService } from '../../services/firebase/grievanceService.js';
import { useAuth } from '../../context/AuthContext';
import { COMPLAINT_STATUS } from '../../models/schema.js';
import { PlusCircle, FileText, Compass, CheckCircle2, Clock, Eye, Building2 } from 'lucide-react';

export const CitizenDashboard = () => {
  const { currentUser } = useAuth();
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const unsubscribe = grievanceService.subscribeToCitizenGrievances(currentUser.uid, (list) => {
      setGrievances(list);
      setLoading(false);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [currentUser?.uid]);

  const activeCount = grievances.filter((g) =>
    [COMPLAINT_STATUS.SUBMITTED, COMPLAINT_STATUS.SEEN, COMPLAINT_STATUS.VERIFIED, COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.VERIFICATION].includes(g.status)
  ).length;

  const resolvedCount = grievances.filter((g) =>
    [COMPLAINT_STATUS.VERIFIED_RESOLVED, COMPLAINT_STATUS.CLOSED].includes(g.status)
  ).length;

  const recentGrievances = grievances.slice(0, 2);

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
          Welcome, {currentUser?.displayName || 'Citizen'}
        </h1>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem' }}>
          Citizen Service Portal • Report civic problems, monitor real-time SLA progress, and track municipal resolutions.
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <Card>
          <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '0.25rem' }}>Active Grievances</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary-700)' }}>{activeCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>Under department handling</div>
        </Card>

        <Card>
          <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '0.25rem' }}>Resolved & Verified</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success-solid)' }}>{resolvedCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>Supervisor Sign-Off Complete</div>
        </Card>

        <Card>
          <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '0.25rem' }}>Total Submissions</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--slate-800)' }}>{grievances.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>Registered in municipal registry</div>
        </Card>
      </div>

      {/* Action Hub */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <Card hoverable>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ padding: '0.5rem', background: 'var(--primary-50)', color: 'var(--primary-600)', borderRadius: 'var(--radius-md)' }}>
              <PlusCircle size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Report a New Grievance</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>Automatic department routing & SLA</span>
            </div>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1.25rem' }}>
            Report road damage, drainage leaks, garbage overflow, or water supply contamination with photo proof.
          </p>
          <Link to="/citizen/report">
            <Button variant="primary" size="sm" icon={PlusCircle}>Open Report Form</Button>
          </Link>
        </Card>

        <Card hoverable>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ padding: '0.5rem', background: 'var(--slate-100)', color: 'var(--slate-700)', borderRadius: 'var(--radius-md)' }}>
              <FileText size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>My Reported Issues</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>Track live 8-stage lifecycle</span>
            </div>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1.25rem' }}>
            View your registered grievances, officer response timestamps, and verification milestones.
          </p>
          <Link to="/citizen/my-grievances">
            <Button variant="secondary" size="sm" icon={FileText}>View Submissions ({grievances.length})</Button>
          </Link>
        </Card>
      </div>

      {/* Recent Submissions List */}
      {recentGrievances.length > 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Recent Submissions</h3>
            <Link to="/citizen/my-grievances" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              View All &rarr;
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentGrievances.map((item) => (
              <div
                key={item.id || item.grievanceId}
                style={{
                  padding: '0.875rem 1rem',
                  border: '1px solid var(--slate-200)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <StatusBadge status={item.status} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>
                      {item.grievanceId || item.id}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.925rem', color: 'var(--slate-900)' }}>
                    {item.title}
                  </div>
                </div>

                <Link to={`/citizen/grievance/${item.id || item.grievanceId}`}>
                  <Button variant="secondary" size="sm" icon={Eye}>View</Button>
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
