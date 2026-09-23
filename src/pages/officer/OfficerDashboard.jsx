import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, SeverityBadge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { grievanceService } from '../../services/firebase/grievanceService.js';
import { useAuth } from '../../context/AuthContext';
import { COMPLAINT_STATUS, CATEGORIES } from '../../models/schema.js';
import { Clock, Eye, AlertTriangle, CheckCircle2, ArrowRight, Building2, Shield } from 'lucide-react';

export const OfficerDashboard = () => {
  const { currentUser } = useAuth();
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(true);

  const deptId = currentUser?.departmentId || 'roads';
  const departmentInfo = Object.values(CATEGORIES).find((c) => c.id === deptId) || {
    departmentName: 'Roads & Infrastructure',
  };

  useEffect(() => {
    const unsubscribe = grievanceService.subscribeToDepartmentGrievances(deptId, (list) => {
      setGrievances(list);
      setLoading(false);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [deptId]);

  const pendingSeen = grievances.filter((g) => g.status === COMPLAINT_STATUS.SUBMITTED && !g.seenAt).length;
  const inProgress = grievances.filter((g) => [COMPLAINT_STATUS.SEEN, COMPLAINT_STATUS.VERIFIED, COMPLAINT_STATUS.IN_PROGRESS].includes(g.status)).length;
  const awaitingVerification = grievances.filter((g) => [COMPLAINT_STATUS.RESOLUTION_SUBMITTED, COMPLAINT_STATUS.COMMUNITY_ACTION_SUBMITTED, COMPLAINT_STATUS.VERIFICATION].includes(g.status)).length;

  const urgentQueue = grievances.slice(0, 3);

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
          Officer Workstation • {departmentInfo.departmentName}
        </h1>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem' }}>
          Assigned Officer: <strong>{currentUser?.displayName}</strong> ({currentUser?.email}) • Live SLA Countdowns & Work Order Queue
        </p>
      </div>

      {loading ? (
        <LoadingSpinner message="Calculating department KPIs..." />
      ) : (
        <>
          {/* Real KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <Card>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '0.25rem' }}>Pending "Seen"</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger-solid)' }}>{pendingSeen}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>Response SLA active</div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '0.25rem' }}>In Progress / Active</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary-700)' }}>{inProgress}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>Active field work orders</div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '0.25rem' }}>Awaiting Verification</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning-solid)' }}>{awaitingVerification}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>Resolution SLA still running</div>
            </Card>
          </div>

          {/* Department Priority Grievance Queue */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem' }}>Recent Department Grievances</h3>
              <Link to="/officer/inbox">
                <Button variant="secondary" size="sm">View Full Inbox ({grievances.length})</Button>
              </Link>
            </div>

            {urgentQueue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-400)' }}>
                No active issues in your queue.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {urgentQueue.map((item) => (
                  <div
                    key={item.id || item.grievanceId}
                    style={{
                      padding: '1rem',
                      border: '1px solid var(--slate-200)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem', alignItems: 'center' }}>
                        <StatusBadge status={item.status} />
                        <SeverityBadge severity={item.severity} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--primary-700)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                          {item.grievanceId || item.id}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                        {item.ward} • Priority Score: {item.priorityScore || 50}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link to={`/officer/grievance/${item.id || item.grievanceId}`}>
                        <Button variant="primary" size="sm" icon={ArrowRight}>Take Action</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
