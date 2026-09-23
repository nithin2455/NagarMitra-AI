import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { grievanceService } from '../../services/firebase/grievanceService';
import { hotspotDetectionService } from '../../services/ai/hotspotDetectionService';
import { CATEGORIES, USER_ROLES } from '../../models/schema';
import {
  MapPin,
  Flame,
  Filter,
  RotateCw,
  Shield,
  Layers,
  Activity,
  AlertTriangle,
  Zap,
  Radio,
  CheckCircle2,
  Sliders,
  ChevronRight,
  Database,
  ExternalLink,
} from 'lucide-react';

export const AdminHotspotsPage = () => {
  const { currentUser, isDepartmentAdmin, isSuperAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [grievances, setGrievances] = useState([]);
  const [hotspotResult, setHotspotResult] = useState(null);
  const [selectedHotspot, setSelectedHotspot] = useState(null);

  // Filter & DBSCAN Hyperparameter States
  const [mode, setMode] = useState('OVERALL'); // 'OVERALL' | 'DEPARTMENT'
  const [selectedDept, setSelectedDept] = useState('all');
  const [timeWindow, setTimeWindow] = useState('ALL_TIME'); // '24h' | '7d' | '30d' | 'ALL_TIME'
  const [epsMeters, setEpsMeters] = useState(350);
  const [minSamples, setMinSamples] = useState(3);

  // RBAC scope determination
  const effectiveDept = isDepartmentAdmin ? currentUser?.departmentId || 'all' : selectedDept;

  const fetchHotspots = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // 1. Fetch raw/master grievances based on authorized scope
      const data = await grievanceService.getDepartmentGrievances(effectiveDept);
      setGrievances(data);

      // 2. Execute DBSCAN Hotspot Detection via AI Client Service
      const result = await hotspotDetectionService.detectHotspots({
        complaints: data,
        mode,
        department: effectiveDept,
        timeWindow,
        epsMeters: parseFloat(epsMeters),
        minSamples: parseInt(minSamples, 10),
      });

      setHotspotResult(result);
      if (result.hotspots && result.hotspots.length > 0) {
        setSelectedHotspot(result.hotspots[0]);
      } else {
        setSelectedHotspot(null);
      }
    } catch (err) {
      console.error('Error in Hotspot Detection:', err);
      setError(err.message || 'Failed to detect location hotspots.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchHotspots();
    }
  }, [currentUser, mode, selectedDept, timeWindow, epsMeters, minSamples]);

  const getPriorityBadgeVariant = (score) => {
    if (score >= 70) return 'danger';
    if (score >= 50) return 'warning';
    if (score >= 30) return 'primary';
    return 'neutral';
  };

  const getPriorityLabel = (score) => {
    if (score >= 70) return 'CRITICAL HOTSPOT';
    if (score >= 50) return 'HIGH DENSITY';
    if (score >= 30) return 'MODERATE DENSITY';
    return 'LOW DENSITY';
  };

  return (
    <div style={{ paddingBottom: '2rem' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Flame size={22} />
            </div>
            <h1 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 700 }}>
              AI Location Hotspot Detection
            </h1>
            <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
              <Shield size={12} style={{ marginRight: '4px' }} />
              DBSCAN Geospatial Clustering
            </span>
          </div>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem', margin: 0 }}>
            Component 3 • Spherical Haversine Density-Based Spatial Clustering & Priority Ranking
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {hotspotResult && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.8rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 600,
                backgroundColor: hotspotResult.isFallback ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                color: hotspotResult.isFallback ? '#d97706' : '#059669',
                border: `1px solid ${hotspotResult.isFallback ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
              }}
            >
              <Radio size={14} className={hotspotResult.isFallback ? '' : 'animate-pulse'} />
              {hotspotResult.isFallback ? 'JS Fallback Engine' : 'Python DBSCAN ML Server'}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchHotspots(true)}
            disabled={refreshing || loading}
          >
            <RotateCw size={14} className={refreshing ? 'animate-spin' : ''} style={{ marginRight: '6px' }} />
            Refresh Hotspots
          </Button>
        </div>
      </div>

      {/* Filter & Hyperparameter Control Bar */}
      <Card style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Sliders size={18} style={{ color: 'var(--primary-600)' }} />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Hotspot Detection Parameters & Scope</h3>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Clustering Mode */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Clustering Mode
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="form-control"
              style={{ width: '100%', fontSize: '0.875rem' }}
            >
              <option value="OVERALL">Overall Cross-Category</option>
              <option value="DEPARTMENT">Per-Department Isolated</option>
            </select>
          </div>

          {/* Department Filter (Super Admin only) */}
          {!isDepartmentAdmin && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Department Scope
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="form-control"
                style={{ width: '100%', fontSize: '0.875rem' }}
              >
                <option value="all">All Departments</option>
                {Object.entries(CATEGORIES).map(([key, cat]) => (
                  <option key={key} value={cat.id}>
                    {cat.name} ({cat.deptCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Time Window */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Time Window Filter
            </label>
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value)}
              className="form-control"
              style={{ width: '100%', fontSize: '0.875rem' }}
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="ALL_TIME">All Time</option>
            </select>
          </div>

          {/* DBSCAN Eps Distance Radius */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Cluster Radius (Eps: {epsMeters}m)
            </label>
            <select
              value={epsMeters}
              onChange={(e) => setEpsMeters(Number(e.target.value))}
              className="form-control"
              style={{ width: '100%', fontSize: '0.875rem' }}
            >
              <option value={100}>100 meters (Very tight)</option>
              <option value={250}>250 meters (Neighborhood)</option>
              <option value={350}>350 meters (Optimal Municipal)</option>
              <option value={500}>500 meters (Ward scale)</option>
              <option value={1000}>1000 meters (Zone scale)</option>
            </select>
          </div>

          {/* DBSCAN Min Samples Density */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Min Reports Density (Min Samples: {minSamples})
            </label>
            <select
              value={minSamples}
              onChange={(e) => setMinSamples(Number(e.target.value))}
              className="form-control"
              style={{ width: '100%', fontSize: '0.875rem' }}
            >
              <option value={2}>2 reports (Sensors/Low threshold)</option>
              <option value={3}>3 reports (Default cluster)</option>
              <option value={5}>5 reports (Dense cluster)</option>
              <option value={10}>10 reports (Severe epidemic)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Loading & Error States */}
      {loading ? (
        <Card style={{ padding: '3rem', textAlign: 'center' }}>
          <LoadingSpinner size="lg" />
          <p style={{ marginTop: '1rem', color: 'var(--slate-500)' }}>
            Executing DBSCAN geospatial clustering over complaint coordinates...
          </p>
        </Card>
      ) : error ? (
        <Card style={{ padding: '2rem', backgroundColor: '#fef2f2', borderColor: '#fca5a5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#b91c1c' }}>
            <AlertTriangle size={24} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Hotspot Analysis Error</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#991b1b' }}>{error}</p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Summary Metric Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <Card padding="1.25rem">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)', fontWeight: 600 }}>
                  Active Hotspots
                </span>
                <MapPin size={20} style={{ color: 'var(--primary-600)' }} />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--slate-800)' }}>
                {hotspotResult?.total_clusters || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>
                Discovered cluster zones
              </div>
            </Card>

            <Card padding="1.25rem">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)', fontWeight: 600 }}>
                  Critical Priority Hotspots
                </span>
                <Flame size={20} style={{ color: '#ef4444' }} />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem', color: '#ef4444' }}>
                {hotspotResult?.hotspots?.filter((h) => h.priority_score >= 70).length || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>
                Priority score S ≥ 70
              </div>
            </Card>

            <Card padding="1.25rem">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)', fontWeight: 600 }}>
                  Master Issues in Clusters
                </span>
                <Layers size={20} style={{ color: '#8b5cf6' }} />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem', color: '#8b5cf6' }}>
                {hotspotResult?.hotspots?.reduce((acc, h) => acc + (h.master_issue_count || 0), 0) || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>
                From {hotspotResult?.hotspots?.reduce((acc, h) => acc + (h.total_reports || 0), 0) || 0} raw complaints
              </div>
            </Card>

            <Card padding="1.25rem">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)', fontWeight: 600 }}>
                  Isolated Noise Reports
                </span>
                <Activity size={20} style={{ color: '#64748b' }} />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem', color: '#64748b' }}>
                {hotspotResult?.noise_count || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>
                {hotspotResult?.noise_percentage != null ? `${hotspotResult.noise_percentage}% of total dataset` : '0%'}
              </div>
            </Card>
          </div>

          {/* Main Hotspots Layout: Table & Detail View */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: selectedHotspot ? '1fr 380px' : '1fr',
              gap: '1.5rem',
            }}
          >
            {/* Hotspots Table */}
            <Card padding="0">
              <div
                style={{
                  padding: '1.25rem',
                  borderBottom: '1px solid var(--slate-200)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                    Detected Geospatial Hotspots ({hotspotResult?.hotspots?.length || 0})
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                    Ranked by Priority Score S = 0.35·Density + 0.25·Severity + 0.20·SLA + 0.20·Citizens
                  </p>
                </div>
              </div>

              {!hotspotResult?.hotspots || hotspotResult.hotspots.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
                  <MapPin size={36} style={{ marginBottom: '0.75rem', color: 'var(--slate-300)' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>No Hotspots Detected</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    Try reducing Min Density or increasing Cluster Radius in the controls above.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--slate-50)', textAlign: 'left', fontSize: '0.8rem' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Rank</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Centroid / Location</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Category / Dept</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Master Issues</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Total Reports</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Radius</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Priority Score</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hotspotResult.hotspots.map((hotspot, idx) => {
                        const isSelected = selectedHotspot?.cluster_id === hotspot.cluster_id;
                        return (
                          <tr
                            key={hotspot.cluster_id || idx}
                            onClick={() => setSelectedHotspot(hotspot)}
                            style={{
                              borderBottom: '1px solid var(--slate-100)',
                              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              transition: 'background-color 0.15s ease',
                            }}
                          >
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>#{idx + 1}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ fontWeight: 600, color: 'var(--slate-800)' }}>
                                {hotspot.dominant_landmark || 'Centroid Zone'}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                                {hotspot.centroid_lat?.toFixed(5)}, {hotspot.centroid_lng?.toFixed(5)}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <Badge variant="neutral" size="sm">
                                {hotspot.department || hotspot.category || 'Overall'}
                              </Badge>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#8b5cf6' }}>
                              {hotspot.master_issue_count} master
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--slate-600)' }}>
                              {hotspot.total_reports} complaints
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--slate-600)' }}>
                              {hotspot.radius_meters}m
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Badge variant={getPriorityBadgeVariant(hotspot.priority_score)}>
                                  {hotspot.priority_score?.toFixed(1)} / 100
                                </Badge>
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              <Button variant="ghost" size="sm">
                                <ChevronRight size={16} />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Hotspot Detailed Drawer / Card */}
            {selectedHotspot && (
              <Card padding="1.25rem">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '1rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '1px solid var(--slate-200)',
                  }}
                >
                  <div>
                    <Badge variant={getPriorityBadgeVariant(selectedHotspot.priority_score)} className="mb-2">
                      {getPriorityLabel(selectedHotspot.priority_score)}
                    </Badge>
                    <h3 style={{ margin: '0.25rem 0 0 0', fontSize: '1.2rem', fontWeight: 700 }}>
                      Cluster #{selectedHotspot.cluster_id}
                    </h3>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-600)' }}>
                      {selectedHotspot.priority_score?.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>Priority Rank Score</div>
                  </div>
                </div>

                {/* Metrics Breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div
                    style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--slate-50)',
                      borderRadius: '6px',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Master Issues</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#8b5cf6' }}>
                      {selectedHotspot.master_issue_count}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--slate-50)',
                      borderRadius: '6px',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Total Reports</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-800)' }}>
                      {selectedHotspot.total_reports}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--slate-50)',
                      borderRadius: '6px',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Unique Citizens</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-800)' }}>
                      {selectedHotspot.unique_citizens || selectedHotspot.total_reports}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--slate-50)',
                      borderRadius: '6px',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Cluster Radius</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-800)' }}>
                      {selectedHotspot.radius_meters}m
                    </div>
                  </div>
                </div>

                {/* Spatial Coordinates */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--slate-700)' }}>
                    Geospatial Centroid
                  </h4>
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '6px',
                      backgroundColor: 'var(--slate-900)',
                      color: '#38bdf8',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      {selectedHotspot.centroid_lat?.toFixed(6)}, {selectedHotspot.centroid_lng?.toFixed(6)}
                    </span>
                    <a
                      href={`https://maps.google.com/?q=${selectedHotspot.centroid_lat},${selectedHotspot.centroid_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>

                {/* Associated Complaint IDs */}
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--slate-700)' }}>
                    Clustered Grievance IDs ({selectedHotspot.complaint_ids?.length || 0})
                  </h4>
                  <div
                    style={{
                      maxHeight: '160px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.4rem',
                      padding: '0.5rem',
                      backgroundColor: 'var(--slate-50)',
                      borderRadius: '6px',
                    }}
                  >
                    {selectedHotspot.complaint_ids?.map((id) => (
                      <span
                        key={id}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          backgroundColor: 'var(--white)',
                          border: '1px solid var(--slate-200)',
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                        }}
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminHotspotsPage;
