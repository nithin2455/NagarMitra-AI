import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { analyticsService } from '../../services/analytics/analyticsService.js';
import { useAuth } from '../../context/AuthContext';
import { CATEGORIES, COMPLAINT_STATUS } from '../../models/schema.js';
import {
  DepartmentBarChart,
  StatusDonutChart,
  PriorityDistributionChart,
} from '../../components/analytics/AnalyticsCharts.jsx';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Filter,
  RotateCw,
  Layers,
  FileSpreadsheet,
  Shield,
  FolderOpen,
  PieChart as PieIcon,
  BarChart3,
} from 'lucide-react';

export const AdminAnalyticsPage = () => {
  const { currentUser, isDepartmentAdmin, isSuperAdmin } = useAuth();

  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filter States
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all_time');

  const fetchAnalytics = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await analyticsService.getAnalytics(currentUser, {
        departmentId: selectedDept,
        status: selectedStatus,
        priority: selectedPriority,
        dateRange: selectedDateRange,
      });
      setAnalyticsData(data);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError(err.message || 'Failed to calculate administrative intelligence analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchAnalytics();
    }
  }, [currentUser, selectedDept, selectedStatus, selectedPriority, selectedDateRange]);

  const kpis = analyticsData?.kpiSummary;
  const deptData = analyticsData?.departmentAnalytics || [];
  const priorityData = analyticsData?.priorityDistribution || [];
  const statusData = analyticsData?.statusDistribution || [];
  const sla = analyticsData?.slaAnalytics;

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.75rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.75rem', margin: 0 }}>CivicPulse Analytics</h1>
            <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
              <Shield size={12} style={{ marginRight: '4px' }} />
              {isDepartmentAdmin
                ? `${currentUser?.departmentId ? currentUser.departmentId.toUpperCase() : 'DEPT'} Admin Scope`
                : 'Executive Super Admin'}
            </span>
          </div>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem', margin: 0 }}>
            Administrative Intelligence • Real-time SLA Governance & Department Resolution Matrix
          </p>
        </div>

        {/* Refresh Button */}
        <Button
          variant="secondary"
          size="sm"
          icon={RotateCw}
          loading={refreshing}
          disabled={loading || refreshing}
          onClick={() => fetchAnalytics(true)}
        >
          {refreshing ? 'Refreshing Data...' : 'Refresh Data'}
        </Button>
      </div>

      {/* Interactive Filters Bar */}
      <Card style={{ marginBottom: '1.75rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Filter size={16} style={{ color: 'var(--primary-700)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--slate-800)' }}>
            Analytics Filters
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          {/* Department Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              Department
            </label>
            {isSuperAdmin ? (
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="form-select"
                style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem' }}
              >
                <option value="all">All Departments</option>
                {Object.values(CATEGORIES).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.departmentName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                disabled
                value={
                  Object.values(CATEGORIES).find((c) => c.id === currentUser?.departmentId)?.departmentName ||
                  currentUser?.departmentId?.toUpperCase()
                }
                className="form-input"
                style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem', background: 'var(--slate-100)' }}
              />
            )}
          </div>

          {/* Status Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              Grievance Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="form-select"
              style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem' }}
            >
              <option value="all">All Statuses</option>
              <option value={COMPLAINT_STATUS.SUBMITTED}>Submitted</option>
              <option value={COMPLAINT_STATUS.SEEN}>Seen / Acknowledged</option>
              <option value={COMPLAINT_STATUS.IN_PROGRESS}>In Progress</option>
              <option value={COMPLAINT_STATUS.VERIFICATION}>Under Verification</option>
              <option value={COMPLAINT_STATUS.VERIFIED_RESOLVED}>Verified Resolved</option>
              <option value={COMPLAINT_STATUS.CLOSED}>Closed</option>
              <option value="escalated">Active Escalations</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              Priority Level
            </label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="form-select"
              style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem' }}
            >
              <option value="all">All Priorities</option>
              <option value="CRITICAL">Critical / Safety Emergency</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              Time Period
            </label>
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="form-select"
              style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem' }}
            >
              <option value="all_time">All Time</option>
              <option value="today">Today</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {loading ? (
        <LoadingSpinner message="Calculating administrative intelligence metrics..." />
      ) : error ? (
        <Card style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <AlertTriangle size={40} style={{ color: 'var(--danger-solid)', margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Analytics Error</h3>
          <p style={{ color: 'var(--slate-600)', marginBottom: '1.25rem', maxWidth: '500px', margin: '0 auto 1.25rem auto' }}>
            {error}
          </p>
          <Button variant="primary" onClick={() => fetchAnalytics()}>
            Retry Loading Analytics
          </Button>
        </Card>
      ) : kpis?.totalComplaints === 0 ? (
        <Card style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <FolderOpen size={44} style={{ color: 'var(--slate-400)', margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.35rem', color: 'var(--slate-800)' }}>
            No grievance data available
          </h3>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.25rem auto' }}>
            No grievances match the currently selected filter parameters. Adjust your filters or click below to reset.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSelectedDept('all');
              setSelectedStatus('all');
              setSelectedPriority('all');
              setSelectedDateRange('all_time');
            }}
          >
            Reset All Filters
          </Button>
        </Card>
      ) : (
        <>
          {/* Section 1: Executive KPI Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.875rem',
              marginBottom: '1.75rem',
            }}
          >
            <Card>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Grievances
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--slate-900)', marginTop: '0.2rem' }}>
                {kpis?.totalComplaints || 0}
              </div>
              <div style={{ fontSize: '0.725rem', color: 'var(--slate-400)', marginTop: '0.2rem' }}>
                Overall intake
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                Pending Intake
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#64748b', marginTop: '0.2rem' }}>
                {kpis?.pending || 0}
              </div>
              <div style={{ fontSize: '0.725rem', color: 'var(--slate-400)', marginTop: '0.2rem' }}>
                Submitted / Unseen
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                In Progress
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary-700)', marginTop: '0.2rem' }}>
                {kpis?.inProgress || 0}
              </div>
              <div style={{ fontSize: '0.725rem', color: 'var(--slate-400)', marginTop: '0.2rem' }}>
                Field crews active
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                Under Verification
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning-solid)', marginTop: '0.2rem' }}>
                {kpis?.underVerification || 0}
              </div>
              <div style={{ fontSize: '0.725rem', color: 'var(--slate-400)', marginTop: '0.2rem' }}>
                Awaiting Admin sign-off
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                Verified Resolved
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success-solid)', marginTop: '0.2rem' }}>
                {kpis?.verifiedResolved || 0}
              </div>
              <div style={{ fontSize: '0.725rem', color: 'var(--slate-400)', marginTop: '0.2rem' }}>
                Sign-off confirmed
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                Closed & Archived
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--slate-700)', marginTop: '0.2rem' }}>
                {kpis?.closed || 0}
              </div>
              <div style={{ fontSize: '0.725rem', color: 'var(--slate-400)', marginTop: '0.2rem' }}>
                Terminal archival
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                Escalated
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger-solid)', marginTop: '0.2rem' }}>
                {kpis?.escalated || 0}
              </div>
              <div style={{ fontSize: '0.725rem', color: 'var(--slate-400)', marginTop: '0.2rem' }}>
                Supervisor notices
              </div>
            </Card>
          </div>

          {/* Section 2: Visual Intelligence & Charts Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
              marginBottom: '1.75rem',
            }}
          >
            {/* Chart 1: Department Breakdown Bar Chart */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <BarChart3 size={18} style={{ color: 'var(--primary-700)' }} />
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Complaints by Department</h3>
              </div>
              <DepartmentBarChart data={deptData} height={260} />
            </Card>

            {/* Chart 2: Status Distribution Donut Chart */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <PieIcon size={18} style={{ color: 'var(--primary-700)' }} />
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Complaint Status Distribution</h3>
              </div>
              <StatusDonutChart data={statusData} total={kpis?.totalComplaints || 0} size={220} />
            </Card>
          </div>

          {/* Section 3: Priority Distribution */}
          <Card style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Layers size={18} style={{ color: 'var(--primary-700)' }} />
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Grievance Priority Distribution</h3>
            </div>
            <PriorityDistributionChart data={priorityData} total={kpis?.totalComplaints || 0} />
          </Card>

          {/* Section 4: Dual-Clock SLA Governance Performance */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
              marginBottom: '1.75rem',
            }}
          >
            {/* Response SLA Card */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={18} style={{ color: 'var(--primary-700)' }} />
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Response SLA Performance</h3>
                </div>
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    color: sla?.response.complianceRate >= 80 ? 'var(--success-text)' : 'var(--danger-text)',
                  }}
                >
                  {sla?.response.complianceRate}% Compliance
                </span>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                Measures the time taken from citizen intake to officer acknowledgment ("Mark as Seen").
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                <div style={{ background: 'var(--success-bg)', padding: '0.6rem 0.4rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--success-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--success-text)', fontWeight: 600 }}>SLA MET</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--success-text)' }}>
                    {sla?.response.met || 0}
                  </div>
                </div>

                <div style={{ background: 'var(--danger-bg)', padding: '0.6rem 0.4rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--danger-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--danger-text)', fontWeight: 600 }}>BREACHED</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--danger-text)' }}>
                    {sla?.response.breached || 0}
                  </div>
                </div>

                <div style={{ background: 'var(--info-bg)', padding: '0.6rem 0.4rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--info-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--info-text)', fontWeight: 600 }}>ACTIVE</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--info-text)' }}>
                    {sla?.response.active || 0}
                  </div>
                </div>
              </div>
            </Card>

            {/* Resolution SLA Card */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--success-solid)' }} />
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Resolution SLA Performance</h3>
                </div>
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    color: sla?.resolution.complianceRate >= 80 ? 'var(--success-text)' : 'var(--danger-text)',
                  }}
                >
                  {sla?.resolution.complianceRate}% Compliance
                </span>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                Counts down continuously from submission and halts ONLY when Department Admin marks Verified Resolved.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                <div style={{ background: 'var(--success-bg)', padding: '0.6rem 0.4rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--success-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--success-text)', fontWeight: 600 }}>SLA MET</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--success-text)' }}>
                    {sla?.resolution.met || 0}
                  </div>
                </div>

                <div style={{ background: 'var(--danger-bg)', padding: '0.6rem 0.4rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--danger-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--danger-text)', fontWeight: 600 }}>BREACHED</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--danger-text)' }}>
                    {sla?.resolution.breached || 0}
                  </div>
                </div>

                <div style={{ background: 'var(--info-bg)', padding: '0.6rem 0.4rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--info-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--info-text)', fontWeight: 600 }}>ACTIVE</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--info-text)' }}>
                    {sla?.resolution.active || 0}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Section 5: Department Resolution Performance Table */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={18} style={{ color: 'var(--primary-700)' }} />
                <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Department Resolution Performance</h3>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                Overall Resolution Rate: <strong>{kpis?.overallResolutionRate || 0}%</strong>
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--slate-200)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)' }}>Department</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)', textAlign: 'center' }}>Total</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)', textAlign: 'center' }}>Resolved</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)', textAlign: 'center' }}>Pending</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)', textAlign: 'center' }}>Escalated</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)', minWidth: '180px' }}>Resolution Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {deptData.map((dept) => (
                    <tr key={dept.departmentId} style={{ borderBottom: '1px solid var(--slate-100)' }}>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{dept.departmentName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', fontFamily: 'var(--font-mono)' }}>
                          {dept.departmentCode}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 700 }}>
                        {dept.total}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: 'var(--success-text)', fontWeight: 600 }}>
                        {dept.resolved}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: 'var(--slate-600)' }}>
                        {dept.pending}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: dept.escalated > 0 ? 'var(--danger-solid)' : 'var(--slate-400)', fontWeight: dept.escalated > 0 ? 700 : 400 }}>
                        {dept.escalated}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              flex: 1,
                              height: '8px',
                              background: 'var(--slate-100)',
                              borderRadius: 'var(--radius-full)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${dept.resolutionRate}%`,
                                height: '100%',
                                background:
                                  dept.resolutionRate >= 75
                                    ? 'var(--success-solid)'
                                    : dept.resolutionRate >= 40
                                    ? 'var(--warning-solid)'
                                    : 'var(--primary-600)',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, minWidth: '42px' }}>
                            {dept.resolutionRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
