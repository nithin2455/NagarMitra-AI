import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { systemAdminService } from '../../services/firebase/systemAdminService.js';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Shield,
  RotateCw,
  Users,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  FolderOpen,
} from 'lucide-react';

export const DepartmentsPage = () => {
  const { currentUser, isDepartmentAdmin, isSuperAdmin } = useAuth();

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchDepartments = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await systemAdminService.getDepartments(currentUser);
      setDepartments(data);
    } catch (err) {
      console.error('Error fetching department data:', err);
      setError(err.message || 'Failed to load department governance statistics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchDepartments();
    }
  }, [currentUser]);

  return (
    <div>
      {/* Header */}
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
            <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Municipal Departments</h1>
            <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
              <Shield size={12} style={{ marginRight: '4px' }} />
              {isDepartmentAdmin
                ? `${currentUser?.departmentId?.toUpperCase()} Department Scope`
                : 'Executive Super Admin'}
            </span>
          </div>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem', margin: 0 }}>
            Operational department staffing, real-time grievance load, and SLA governance rules.
          </p>
        </div>

        {/* Refresh Button */}
        <Button
          variant="secondary"
          size="sm"
          icon={RotateCw}
          loading={refreshing}
          disabled={loading || refreshing}
          onClick={() => fetchDepartments(true)}
        >
          {refreshing ? 'Refreshing...' : 'Refresh Departments'}
        </Button>
      </div>

      {/* Main Content */}
      {loading ? (
        <LoadingSpinner message="Loading municipal department governance matrix..." />
      ) : error ? (
        <Card style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <AlertTriangle size={40} style={{ color: 'var(--danger-solid)', margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Department Data Error</h3>
          <p style={{ color: 'var(--slate-600)', marginBottom: '1.25rem' }}>{error}</p>
          <Button variant="primary" onClick={() => fetchDepartments()}>
            Retry Loading
          </Button>
        </Card>
      ) : departments.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <FolderOpen size={44} style={{ color: 'var(--slate-400)', margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.35rem', color: 'var(--slate-800)' }}>
            No department data available
          </h3>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.25rem auto' }}>
            No municipal department records found for your current administrative role.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {departments.map((dept) => (
            <Card key={dept.id}>
              {/* Header Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--slate-900)', margin: '0 0 0.25rem 0' }}>
                    {dept.name}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--slate-500)' }}>
                      ID: {dept.id}
                    </span>
                    <span style={{ color: 'var(--slate-300)' }}>•</span>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary-700)' }}>
                      {dept.code}
                    </span>
                  </div>
                </div>
                <Badge variant="success" size="sm">
                  {dept.status}
                </Badge>
              </div>

              {/* Real Stats Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  background: 'var(--slate-50)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  textAlign: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', textTransform: 'uppercase' }}>Grievances</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', marginTop: '0.1rem' }}>
                    {dept.grievanceCount}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', textTransform: 'uppercase' }}>Officers</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-700)', marginTop: '0.1rem' }}>
                    {dept.officerCount}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', textTransform: 'uppercase' }}>Admins</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-700)', marginTop: '0.1rem' }}>
                    {dept.adminCount}
                  </div>
                </div>
              </div>

              {/* Resolution Rate */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--slate-600)' }}>Resolution Efficiency:</span>
                  <strong style={{ color: dept.resolutionRate >= 75 ? 'var(--success-text)' : 'var(--slate-800)' }}>
                    {dept.resolutionRate}% ({dept.resolvedCount} / {dept.grievanceCount} resolved)
                  </strong>
                </div>
                <div
                  style={{
                    height: '6px',
                    background: 'var(--slate-200)',
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
              </div>

              {/* Baseline SLA Rules */}
              <div style={{ borderTop: '1px solid var(--slate-100)', paddingTop: '0.75rem', fontSize: '0.775rem', color: 'var(--slate-600)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Response SLA Baseline:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{dept.defaultResponseHours} hours</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Resolution SLA Baseline:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{dept.defaultResolutionHours} hours</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Base Risk Score:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{dept.baseRiskScore} / 100</strong>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
