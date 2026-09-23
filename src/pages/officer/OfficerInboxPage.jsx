import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, SeverityBadge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { grievanceService } from '../../services/firebase/grievanceService.js';
import { useAuth } from '../../context/AuthContext';
import { CATEGORIES } from '../../models/schema.js';
import { Eye, Clock, CheckCircle2, ArrowRight, Building2, MapPin } from 'lucide-react';

export const OfficerInboxPage = () => {
  const { currentUser } = useAuth();
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  const officerDepartmentId = currentUser?.departmentId || 'roads';
  const departmentInfo = Object.values(CATEGORIES).find((c) => c.id === officerDepartmentId) || {
    departmentName: 'Roads & Infrastructure',
  };

  useEffect(() => {
    // Subscribe to live department grievances
    const unsubscribe = grievanceService.subscribeToDepartmentGrievances(officerDepartmentId, (list) => {
      setGrievances(list);
      setLoading(false);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [officerDepartmentId]);

  const handleMarkAsSeen = async (id) => {
    try {
      await grievanceService.markGrievanceAsSeen(id, currentUser);
      setToastMessage(`Grievance #${id} marked as SEEN. Response SLA stopped and citizen notified.`);
    } catch (err) {
      setToastMessage(`Error updating status: ${err.message}`);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
          Officer Workstation • {departmentInfo.departmentName}
        </h1>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem' }}>
          Queue: <strong>{departmentInfo.departmentName}</strong> • Logged in as: <strong>{currentUser?.displayName}</strong> ({currentUser?.email})
        </p>
      </div>

      {toastMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--success-text)',
            fontSize: '0.875rem',
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading department inbox..." />
      ) : grievances.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <p style={{ color: 'var(--slate-500)' }}>No active grievances currently assigned to your department queue.</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {grievances.map((item) => (
            <Card key={item.id || item.grievanceId} hoverable>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <StatusBadge status={item.status} />
                    <SeverityBadge severity={item.severity} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>
                      {item.grievanceId || item.id}
                    </span>
                    {item.isMasterIssue && (
                      <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700 }}>
                        Master Issue ({item.reportCount || 1} Reports)
                      </span>
                    )}
                    {item.isDuplicate && (
                      <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                        Linked to #{item.masterComplaintId}
                      </span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                      • {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--slate-900)' }}>
                    {item.title}
                  </h3>

                  <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginBottom: '0.5rem' }}>
                    {item.description}
                  </p>

                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Building2 size={13} /> {item.departmentName}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={13} /> {item.ward}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={13} /> Response SLA: <strong>{item.seenAt ? `MET (Seen at ${new Date(item.seenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : `${item.responseSlaHours}h window`}</strong>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'center' }}>
                  {(!item.seenAt && item.status === 'SUBMITTED') && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Eye}
                      onClick={() => handleMarkAsSeen(item.id || item.grievanceId)}
                    >
                      Mark as Seen
                    </Button>
                  )}
                  <Link to={`/officer/grievance/${item.id || item.grievanceId}`}>
                    <Button variant="primary" size="sm" icon={ArrowRight}>
                      Open Action Center
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
