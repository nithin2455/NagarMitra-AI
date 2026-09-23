import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { anomalyDetectionService } from '../../services/ai/anomalyDetectionService.js';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  BarChart2,
  Filter,
  CheckCircle2,
  Info,
  Sparkles,
  Clock,
  Building2,
  Search,
  Eye,
  RefreshCw,
  FileSearch,
  Layers,
  X,
} from 'lucide-react';

export const AdminAnomalyPage = () => {
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [anomalies, setAnomalies] = useState([]);
  const [summary, setSummary] = useState({
    totalAnalyzed: 0,
    anomaliesDetected: 0,
    highRiskCount: 0,
    reviewedCount: 0,
    anomalyRate: '0.0%',
  });

  // Filter States
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Anomaly Detail Modal State
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewStatus, setReviewStatus] = useState('REVIEWED');
  const [toast, setToast] = useState(null);

  // Load operational anomaly windows for analysis
  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      // Mock / fetched operational window data spanning recent days
      const windows = [
        {
          window_id: 'WIN-2026-0891',
          date: new Date(Date.now() - 3600000 * 2).toISOString().split('T')[0],
          department_code: 'DEPT_ROADS',
          raw_report_count: 58,
          master_issue_count: 4,
          duplicate_ratio: 0.931,
          reports_per_master_issue: 14.5,
          hotspot_score: 88.5,
          local_density: 0.885,
          cluster_size: 42,
          critical_count: 12,
          high_count: 24,
          critical_ratio: 0.207,
          high_sla_risk_count: 38,
          high_sla_risk_ratio: 0.655,
          rate_of_change: 3.42,
          time_slot: 'MORNING_06_12',
          hour: 9,
          day_of_week: 2,
          is_weekend: 0,
          status: 'UNREVIEWED',
        },
        {
          window_id: 'WIN-2026-0888',
          date: new Date(Date.now() - 3600000 * 6).toISOString().split('T')[0],
          department_code: 'DEPT_DRAINAGE',
          raw_report_count: 84,
          master_issue_count: 8,
          duplicate_ratio: 0.905,
          reports_per_master_issue: 10.5,
          hotspot_score: 95.2,
          local_density: 0.952,
          cluster_size: 70,
          critical_count: 52,
          high_count: 20,
          critical_ratio: 0.619,
          high_sla_risk_count: 65,
          high_sla_risk_ratio: 0.774,
          rate_of_change: 5.12,
          time_slot: 'NIGHT_00_06',
          hour: 3,
          day_of_week: 1,
          is_weekend: 0,
          status: 'NEEDS_INVESTIGATION',
        },
        {
          window_id: 'WIN-2026-0885',
          date: new Date(Date.now() - 3600000 * 24).toISOString().split('T')[0],
          department_code: 'DEPT_ELECTRICITY',
          raw_report_count: 42,
          master_issue_count: 3,
          duplicate_ratio: 0.928,
          reports_per_master_issue: 14.0,
          hotspot_score: 82.0,
          local_density: 0.82,
          cluster_size: 35,
          critical_count: 38,
          high_count: 4,
          critical_ratio: 0.905,
          high_sla_risk_count: 36,
          high_sla_risk_ratio: 0.857,
          rate_of_change: 2.85,
          time_slot: 'EVENING_18_24',
          hour: 21,
          day_of_week: 0,
          is_weekend: 0,
          status: 'UNREVIEWED',
        },
        {
          window_id: 'WIN-2026-0880',
          date: new Date(Date.now() - 3600000 * 36).toISOString().split('T')[0],
          department_code: 'DEPT_SANITATION',
          raw_report_count: 14,
          master_issue_count: 10,
          duplicate_ratio: 0.286,
          reports_per_master_issue: 1.4,
          hotspot_score: 25.0,
          local_density: 0.25,
          cluster_size: 5,
          critical_count: 1,
          high_count: 3,
          critical_ratio: 0.071,
          high_sla_risk_count: 2,
          high_sla_risk_ratio: 0.143,
          rate_of_change: 0.12,
          time_slot: 'AFTERNOON_12_18',
          hour: 14,
          day_of_week: 6,
          is_weekend: 1,
          status: 'UNREVIEWED',
        },
        {
          window_id: 'WIN-2026-0875',
          date: new Date(Date.now() - 3600000 * 48).toISOString().split('T')[0],
          department_code: 'DEPT_WATER',
          raw_report_count: 65,
          master_issue_count: 6,
          duplicate_ratio: 0.908,
          reports_per_master_issue: 10.8,
          hotspot_score: 91.0,
          local_density: 0.91,
          cluster_size: 50,
          critical_count: 45,
          high_count: 12,
          critical_ratio: 0.692,
          high_sla_risk_count: 50,
          high_sla_risk_ratio: 0.769,
          rate_of_change: 4.15,
          time_slot: 'MORNING_06_12',
          hour: 10,
          day_of_week: 5,
          is_weekend: 1,
          status: 'LEGITIMATE_EVENT',
        },
      ];

      const res = await anomalyDetectionService.analyzeAnomaliesBatch(windows);
      if (res && res.results) {
        setAnomalies(res.results);

        const highCount = res.results.filter((r) => r.anomaly_level === 'HIGH').length;
        setSummary({
          totalAnalyzed: res.total_analyzed,
          anomaliesDetected: res.anomalies_detected,
          highRiskCount: highCount,
          reviewedCount: res.results.filter((r) => r.status && r.status !== 'UNREVIEWED').length,
          anomalyRate: `${((res.anomalies_detected / res.total_analyzed) * 100).toFixed(1)}%`,
        });
      }
    } catch (err) {
      console.error('Failed to load anomaly detection data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, []);

  const handleReviewSubmit = (e) => {
    e.preventDefault();
    if (!selectedAnomaly) return;

    setAnomalies((prev) =>
      prev.map((item) =>
        item.window_id === selectedAnomaly.window_id
          ? {
              ...item,
              reviewStatus: reviewStatus,
              reviewedBy: currentUser?.displayName || 'Super Admin',
              reviewedAt: new Date().toISOString(),
              reviewNote: reviewNote.trim(),
            }
          : item
      )
    );

    setToast({
      type: 'success',
      message: `Operational anomaly ${selectedAnomaly.window_id} marked as ${reviewStatus.replace('_', ' ')}.`,
    });
    setSelectedAnomaly(null);
    setReviewNote('');
  };

  // Department RBAC Filter
  const userDept = currentUser?.departmentId ? `DEPT_${currentUser.departmentId.toUpperCase()}` : null;
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const filteredAnomalies = anomalies.filter((item) => {
    if (!isSuperAdmin && userDept && item.department_code !== userDept) {
      return false;
    }
    if (filterDepartment !== 'ALL' && item.department_code !== filterDepartment) {
      return false;
    }
    if (filterLevel !== 'ALL' && item.anomaly_level !== filterLevel) {
      return false;
    }
    if (filterType !== 'ALL' && item.anomaly_type !== filterType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = item.window_id.toLowerCase().includes(q);
      const matchDept = item.department_code.toLowerCase().includes(q);
      const matchType = item.anomaly_type.toLowerCase().includes(q);
      if (!matchId && !matchDept && !matchType) return false;
    }
    return true;
  });

  if (loading) {
    return <LoadingSpinner message="Analyzing operational grievance anomaly patterns..." />;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldAlert size={28} style={{ color: 'var(--primary-600)' }} /> AI Anomaly & Pattern Detection
          </h1>
          <p style={{ color: 'var(--slate-600)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Unsupervised Isolation Forest monitoring of operational complaint spikes, spatial clusters, and volume deviations.
          </p>
        </div>

        <Button variant="outline" onClick={fetchAnomalies} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={16} /> Re-analyze Operational Windows
        </Button>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            padding: '0.875rem 1.25rem',
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
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>
            ✕
          </button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
        <Card style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>Operational Windows</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0.35rem 0' }}>{summary.totalAnalyzed}</div>
          <div style={{ fontSize: '0.785rem', color: 'var(--slate-600)' }}>Aggregated operational time slots</div>
        </Card>

        <Card style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>Anomalous Patterns</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--warning-text)', margin: '0.35rem 0' }}>{summary.anomaliesDetected}</div>
          <div style={{ fontSize: '0.785rem', color: 'var(--slate-600)' }}>Overall Anomaly Rate: {summary.anomalyRate}</div>
        </Card>

        <Card style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>High Deviation Alerts</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--danger-solid)', margin: '0.35rem 0' }}>{summary.highRiskCount}</div>
          <div style={{ fontSize: '0.785rem', color: 'var(--slate-600)' }}>Require priority admin review</div>
        </Card>

        <Card style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>Admin Reviews</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--success-text)', margin: '0.35rem 0' }}>{summary.reviewedCount}</div>
          <div style={{ fontSize: '0.785rem', color: 'var(--slate-600)' }}>Human verified & annotated</div>
        </Card>
      </div>

      {/* Filter Controls Bar */}
      <Card style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search window ID, department, or pattern..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem', width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--slate-700)' }}>Dept:</span>
            <select className="form-select" value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}>
              <option value="ALL">All Departments</option>
              <option value="DEPT_ROADS">Roads</option>
              <option value="DEPT_DRAINAGE">Drainage</option>
              <option value="DEPT_SANITATION">Sanitation</option>
              <option value="DEPT_WATER">Water</option>
              <option value="DEPT_ELECTRICITY">Electricity</option>
              <option value="DEPT_WORKS">Works</option>
              <option value="DEPT_GENERAL">General</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--slate-700)' }}>Anomaly Level:</span>
            <select className="form-select" value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
              <option value="ALL">All Levels</option>
              <option value="HIGH">HIGH (Score &ge; 0.75)</option>
              <option value="MEDIUM">MEDIUM (0.50 &ndash; 0.74)</option>
              <option value="LOW">LOW (&lt; 0.50)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--slate-700)' }}>Pattern:</span>
            <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="ALL">All Patterns</option>
              <option value="VOLUME_SPIKE">Volume Spike</option>
              <option value="DUPLICATE_CONCENTRATION">Duplicate Concentration</option>
              <option value="GEOGRAPHIC_SPIKE">Geographic Concentration</option>
              <option value="SEVERITY_SPIKE">Severity Spike</option>
              <option value="SLA_RISK_SPIKE">SLA Risk Concentration</option>
              <option value="MULTIVARIATE_ANOMALY">Multivariate Anomaly</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Operational Anomalies Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Analyzed Operational Windows ({filteredAnomalies.length})</h3>
          <span style={{ fontSize: '0.785rem', color: 'var(--slate-500)' }}>Unsupervised Isolation Forest Analysis</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)', color: 'var(--slate-600)', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                <th style={{ padding: '0.875rem 1.25rem' }}>Window ID</th>
                <th style={{ padding: '0.875rem 1rem' }}>Date / Slot</th>
                <th style={{ padding: '0.875rem 1rem' }}>Department</th>
                <th style={{ padding: '0.875rem 1rem' }}>Volume</th>
                <th style={{ padding: '0.875rem 1rem' }}>Dup Ratio</th>
                <th style={{ padding: '0.875rem 1rem' }}>Score</th>
                <th style={{ padding: '0.875rem 1rem' }}>Level</th>
                <th style={{ padding: '0.875rem 1rem' }}>Pattern Type</th>
                <th style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAnomalies.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-500)' }}>
                    No operational anomaly records matched the active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredAnomalies.map((item) => (
                  <tr key={item.window_id} style={{ borderBottom: '1px solid var(--slate-150)', background: item.anomaly_level === 'HIGH' ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                    <td style={{ padding: '0.875rem 1.25rem', fontWeight: 700, color: 'var(--primary-700)' }}>{item.window_id}</td>
                    <td style={{ padding: '0.875rem 1rem' }}>{item.date}</td>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>{item.department_code.replace('DEPT_', '')}</td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <strong>{item.raw_report_count}</strong> <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>({item.master_issue_count} master)</span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>{(item.duplicate_ratio * 100).toFixed(0)}%</td>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 700 }}>{item.anomaly_score.toFixed(4)}</td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.55rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: item.anomaly_level === 'HIGH' ? 'var(--danger-bg)' : item.anomaly_level === 'MEDIUM' ? 'var(--warning-bg)' : 'var(--slate-100)',
                          color: item.anomaly_level === 'HIGH' ? 'var(--danger-text)' : item.anomaly_level === 'MEDIUM' ? 'var(--warning-text)' : 'var(--slate-700)',
                          border: `1px solid ${item.anomaly_level === 'HIGH' ? 'var(--danger-border)' : item.anomaly_level === 'MEDIUM' ? 'var(--warning-border)' : 'var(--slate-200)'}`,
                        }}
                      >
                        {item.anomaly_level}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: 'var(--slate-700)' }}>{item.anomaly_type.replace('_', ' ')}</td>
                    <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>
                      <Button variant="outline" size="sm" onClick={() => setSelectedAnomaly(item)}>
                        <Eye size={14} style={{ marginRight: '4px' }} /> Review
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Review Modal */}
      {selectedAnomaly && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', maxWidth: '640px', width: '100%', padding: '1.75rem', boxShadow: 'var(--shadow-xl)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>Operational Anomaly Review • {selectedAnomaly.window_id}</h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
                  {selectedAnomaly.date} &bull; {selectedAnomaly.department_code}
                </span>
              </div>
              <button onClick={() => setSelectedAnomaly(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--slate-400)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1rem', background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <div><strong>Anomaly Score:</strong> {selectedAnomaly.anomaly_score}</div>
                <div><strong>Anomaly Level:</strong> {selectedAnomaly.anomaly_level}</div>
                <div><strong>Pattern Type:</strong> {selectedAnomaly.anomaly_type}</div>
                <div><strong>Raw / Master Ratio:</strong> {selectedAnomaly.raw_report_count} reports / {selectedAnomaly.master_issue_count} masters</div>
              </div>

              <strong style={{ fontSize: '0.85rem', color: 'var(--slate-800)', display: 'block', marginBottom: '0.4rem' }}>
                Contributing Indicators (vs Historical Baseline):
              </strong>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.825rem', color: 'var(--slate-700)', lineHeight: '1.45' }}>
                {selectedAnomaly.contributing_indicators?.map((ind, i) => (
                  <li key={i}>{ind}</li>
                ))}
              </ul>
            </div>

            <form onSubmit={handleReviewSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Admin Determination *</label>
                <select className="form-select" value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                  <option value="REVIEWED">REVIEWED (Acknowledged)</option>
                  <option value="EXPLAINED">EXPLAINED (Natural Event e.g. Weather / Monsoon)</option>
                  <option value="LEGITIMATE_EVENT">LEGITIMATE_EVENT (Confirmed Emergency / Campaign)</option>
                  <option value="NEEDS_INVESTIGATION">NEEDS_INVESTIGATION (Flagged for Field Audit)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Administrative Review Notes</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Record operational rationale, inspection results, or explanatory notes..."
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <Button type="button" variant="outline" onClick={() => setSelectedAnomaly(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Save Admin Determination
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAnomalyPage;
