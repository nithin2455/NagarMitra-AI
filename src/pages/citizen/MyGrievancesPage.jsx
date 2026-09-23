import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { StatusBadge, SeverityBadge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { grievanceService } from '../../services/firebase/grievanceService.js';
import { useAuth } from '../../context/AuthContext';
import { Clock, Eye, PlusCircle, Building2, MapPin, AlertCircle } from 'lucide-react';

export const MyGrievancesPage = () => {
  const { currentUser } = useAuth();
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    // Subscribe to live Firestore updates for this citizen
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

  const calculateSlaRemaining = (dueIsoString) => {
    if (!dueIsoString) return 'Active';
    const dueTime = new Date(dueIsoString).getTime();
    const diffHours = (dueTime - Date.now()) / (1000 * 3600);

    if (diffHours <= 0) {
      return 'SLA Overdue (Escalation Triggered)';
    }
    if (diffHours < 24) {
      return `${Math.round(diffHours)}h remaining`;
    }
    const days = Math.floor(diffHours / 24);
    const remHours = Math.round(diffHours % 24);
    return `${days}d ${remHours}h remaining`;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>My Reported Grievances</h1>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem' }}>
            Live status tracking, officer response timestamps, and verified resolution milestones.
          </p>
        </div>
        <Link to="/citizen/report">
          <Button variant="primary" size="sm" icon={PlusCircle}>
            Report New Issue
          </Button>
        </Link>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading your submitted grievances..." />
      ) : grievances.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <div
            style={{
              width: '3.5rem',
              height: '3.5rem',
              background: 'var(--primary-50)',
              color: 'var(--primary-700)',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto',
            }}
          >
            <PlusCircle size={28} />
          </div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>No Grievances Submitted Yet</h3>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
            You have not reported any civic issues under this account. Submit a new report to track municipal redressal.
          </p>
          <Link to="/citizen/report">
            <Button variant="primary" icon={PlusCircle}>
              Report Your First Grievance
            </Button>
          </Link>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {grievances.map((item) => (
            <Card key={item.id || item.grievanceId} hoverable>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <StatusBadge status={item.status} />
                    <SeverityBadge severity={item.severity} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>
                      {item.grievanceId || item.id}
                    </span>
                    <span style={{ fontSize: '0.775rem', color: 'var(--slate-400)' }}>
                      • {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', marginBottom: '0.35rem', color: 'var(--slate-900)' }}>
                    {item.title}
                  </h3>

                  <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                    {item.description}
                  </p>

                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Building2 size={14} /> {item.departmentName}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={14} /> {item.ward}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={14} /> Resolution SLA: <strong>{calculateSlaRemaining(item.resolutionSlaDue)}</strong>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'center' }}>
                  <Link to={`/citizen/grievance/${item.id || item.grievanceId}`}>
                    <Button variant="secondary" size="sm" icon={Eye}>
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
