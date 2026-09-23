import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, SeverityBadge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { grievanceService } from '../../services/firebase/grievanceService.js';
import { slaEngine } from '../../services/governance/slaEngine.js';
import { useAuth } from '../../context/AuthContext';
import { COMPLAINT_STATUS, ESCALATION_LEVELS, CATEGORIES } from '../../models/schema.js';
import {
  ShieldCheck,
  AlertTriangle,
  CheckSquare,
  Clock,
  Building2,
  ListFilter,
  ArrowRight,
  TrendingUp,
  AlertOctagon,
} from 'lucide-react';
import { AdminEscalationAlerts } from '../../components/admin/AdminEscalationAlerts';

export const AdminDashboard = () => {
  const { currentUser, isDepartmentAdmin, isSuperAdmin } = useAuth();
  const [grievances, setGrievances] = useState([]);
  const [extensions, setExtensions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const deptFilter = isDepartmentAdmin ? currentUser?.departmentId : 'all';
        const [grievanceList, extList] = await Promise.all([
          grievanceService.getDepartmentGrievances(deptFilter),
          grievanceService.getSLAExtensions(currentUser),
        ]);
        setGrievances(grievanceList);
        setExtensions(extList);
      } catch (err) {
        console.error('Error fetching admin dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, isDepartmentAdmin]);

  // Compute live operational governance metrics
  const totalCount = grievances.length;
  const inProgressCount = grievances.filter((g) =>
    [COMPLAINT_STATUS.SEEN, COMPLAINT_STATUS.VERIFIED, COMPLAINT_STATUS.IN_PROGRESS].includes(g.status)
  ).length;

  const awaitingVerificationCount = grievances.filter((g) =>
    [COMPLAINT_STATUS.RESOLUTION_SUBMITTED, COMPLAINT_STATUS.COMMUNITY_ACTION_SUBMITTED, COMPLAINT_STATUS.VERIFICATION].includes(g.status)
  ).length;

  const verifiedResolvedCount = grievances.filter((g) =>
    [COMPLAINT_STATUS.VERIFIED_RESOLVED, COMPLAINT_STATUS.CLOSED].includes(g.status)
  ).length;

  // SLA Warnings & Breaches
  const slaWarnings = grievances.filter((g) => {
    if ([COMPLAINT_STATUS.VERIFIED_RESOLVED, COMPLAINT_STATUS.CLOSED].includes(g.status)) return false;
    const res = slaEngine.evaluateResolutionSLA(g);
    return res.thresholdStatus === 'WARNING' || res.thresholdStatus === 'URGENT';
  }).length;

  const slaBreaches = grievances.filter((g) => {
    if ([COMPLAINT_STATUS.VERIFIED_RESOLVED, COMPLAINT_STATUS.CLOSED].includes(g.status)) return false;
    const res = slaEngine.evaluateResolutionSLA(g);
    return res.isBreached;
  }).length;

  const escalatedCount = grievances.filter((g) =>
    g.escalationLevel && g.escalationLevel !== ESCALATION_LEVELS.NOT_ESCALATED && g.escalationLevel !== ESCALATION_LEVELS.RESOLVED
  ).length;

  const pendingExtensionsCount = extensions.filter((e) => e.status === 'PENDING').length;

  // Super Admin Department Breakdown Matrix
  const departmentBreakdown = Object.values(CATEGORIES).map((cat) => {
    const deptGrievances = grievances.filter((g) => g.departmentId === cat.id);
    const breaches = deptGrievances.filter((g) => {
      if ([COMPLAINT_STATUS.VERIFIED_RESOLVED, COMPLAINT_STATUS.CLOSED].includes(g.status)) return false;
      return slaEngine.evaluateResolutionSLA(g).isBreached;
    }).length;
    const escalated = deptGrievances.filter((g) =>
      g.escalationLevel && g.escalationLevel !== ESCALATION_LEVELS.NOT_ESCALATED && g.escalationLevel !== ESCALATION_LEVELS.RESOLVED
    ).length;

    return {
      id: cat.id,
      name: cat.departmentName,
      total: deptGrievances.length,
      breaches,
      escalated,
    };
  });

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
          {isDepartmentAdmin
            ? `${currentUser?.departmentId ? currentUser.departmentId.toUpperCase() : ''} Department Administration`
            : 'Super Admin Municipal Command Center'}
        </h1>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem' }}>
          {isDepartmentAdmin
            ? `Dedicated operational dashboard for ${currentUser?.departmentId ? currentUser.departmentId.toUpperCase() : 'Department'} oversight, SLA reviews & resolution verification.`
            : 'Global civic accountability radar • Cross-department governance • Multi-tier escalations.'}
        </p>
      </div>

      {loading ? (
        <LoadingSpinner message="Calculating governance analytics..." />
      ) : (
        <>
          {/* Real Operational KPI Matrix */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <Card>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '0.25rem' }}>Total Citizen Reports</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                {grievances.reduce((acc, g) => acc + (g.reportCount || 1), 0)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>
                All citizen submissions
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '0.25rem' }}>Unique Master Issues</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary-700)' }}>
                {grievances.filter((g) => g.isMasterIssue || !g.isDuplicate).length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>
                Distinct physical issues
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '0.25rem' }}>Consolidated Duplicates</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success-solid)' }}>
                {grievances.filter((g) => g.isDuplicate).length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>
                AI deduplication active
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '0.25rem' }}>In Progress / Active</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary-700)' }}>{inProgressCount}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>Field operations active</div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '0.25rem' }}>SLA Warnings (&ge;75%)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning-solid)' }}>{slaWarnings}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>Approaching deadline</div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '0.25rem' }}>SLA Breached (100%)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger-solid)' }}>{slaBreaches}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>Overdue resolution</div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '0.25rem' }}>Active Escalations</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger-solid)' }}>{escalatedCount}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>Hierarchical intervention</div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '0.25rem' }}>Awaiting Verification</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary-700)' }}>{awaitingVerificationCount}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>Resolution proof review</div>
            </Card>
          </div>

          {/* Response SLA & Controlled Escalation Section */}
          <AdminEscalationAlerts />

          {/* Super Admin Cross-Department Breakdown */}
          {isSuperAdmin && (
            <Card style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.15rem' }}>Department Performance & SLA Matrix</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>All Municipal Authorities</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {departmentBreakdown.map((dept) => (
                  <div
                    key={dept.id}
                    style={{
                      padding: '1rem',
                      border: '1px solid var(--slate-200)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--slate-50)',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--slate-900)', marginBottom: '0.5rem' }}>
                      {dept.name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', color: 'var(--slate-600)', marginBottom: '0.25rem' }}>
                      <span>Total Grievances:</span>
                      <strong>{dept.total}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', color: dept.breaches > 0 ? 'var(--danger-solid)' : 'var(--slate-600)', marginBottom: '0.25rem' }}>
                      <span>SLA Breaches:</span>
                      <strong>{dept.breaches}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', color: dept.escalated > 0 ? 'var(--danger-solid)' : 'var(--slate-600)' }}>
                      <span>Active Escalations:</span>
                      <strong>{dept.escalated}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Action Sections */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            <Card hoverable>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ padding: '0.5rem', background: 'var(--warning-bg)', color: 'var(--warning-text)', borderRadius: 'var(--radius-md)' }}>
                  <Clock size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem' }}>SLA Extension Approvals ({pendingExtensionsCount})</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Review officer justification</span>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginBottom: '1.25rem' }}>
                Evaluate officer justification for deadline adjustments. Multi-tier limits prevent indefinite postponement.
              </p>
              <Link to="/admin/sla-approvals">
                <Button variant="secondary" size="sm" icon={ArrowRight}>Open Approvals Queue</Button>
              </Link>
            </Card>

            <Card hoverable>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ padding: '0.5rem', background: 'var(--primary-50)', color: 'var(--primary-600)', borderRadius: 'var(--radius-md)' }}>
                  <CheckSquare size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem' }}>Resolution Verification Station ({awaitingVerificationCount})</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Priority-sorted verification gate</span>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginBottom: '1.25rem' }}>
                Inspect Before and After rectification proof. Resolution SLA clock stops only upon administrative verification.
              </p>
              <Link to="/admin/verifications">
                <Button variant="primary" size="sm" icon={ArrowRight}>Open Verification Gate</Button>
              </Link>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
