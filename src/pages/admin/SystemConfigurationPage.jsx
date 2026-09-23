import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { systemAdminService } from '../../services/firebase/systemAdminService.js';
import { useAuth } from '../../context/AuthContext';
import {
  Sliders,
  Shield,
  Clock,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Activity,
  FileCheck,
  Server,
  Zap,
} from 'lucide-react';

export const SystemConfigurationPage = () => {
  const { currentUser } = useAuth();

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Integrity Audit State
  const [auditResult, setAuditResult] = useState(null);
  const [auditing, setAuditing] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await systemAdminService.getSystemConfiguration(currentUser);
        setConfig(data);
      } catch (err) {
        console.error('Error fetching system config:', err);
        setError(err.message || 'Access Denied: Restricted to Super Administrators.');
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchConfig();
    }
  }, [currentUser]);

  const handleRunIntegrityAudit = async () => {
    setAuditing(true);
    try {
      const result = await systemAdminService.auditDataIntegrity(currentUser);
      setAuditResult(result);
    } catch (err) {
      console.error('Error auditing data integrity:', err);
    } finally {
      setAuditing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Inspecting platform configuration..." />;
  }

  if (error) {
    return (
      <Card style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <AlertTriangle size={40} style={{ color: 'var(--danger-solid)', margin: '0 auto 0.75rem auto' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Access Restricted</h3>
        <p style={{ color: 'var(--slate-600)' }}>{error}</p>
      </Card>
    );
  }

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
            <h1 style={{ fontSize: '1.75rem', margin: 0 }}>System Configuration</h1>
            <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>
              <Shield size={12} style={{ marginRight: '4px' }} />
              Super Admin Authority
            </span>
          </div>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem', margin: 0 }}>
            Deterministic SLA baseline rules, priority multipliers, escalation thresholds, and schema governance.
          </p>
        </div>

        {/* Data Integrity Audit Action */}
        <Button
          variant="primary"
          size="sm"
          icon={FileCheck}
          loading={auditing}
          disabled={auditing}
          onClick={handleRunIntegrityAudit}
        >
          {auditing ? 'Running Data Audit...' : 'Audit Data Integrity'}
        </Button>
      </div>

      {/* Integrity Audit Banner (if run) */}
      {auditResult && (
        <Card
          style={{
            marginBottom: '1.75rem',
            background: auditResult.healthy ? 'var(--success-bg)' : 'var(--danger-bg)',
            border: `1px solid ${auditResult.healthy ? 'var(--success-border)' : 'var(--danger-border)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {auditResult.healthy ? (
              <CheckCircle2 size={24} style={{ color: 'var(--success-text)' }} />
            ) : (
              <AlertTriangle size={24} style={{ color: 'var(--danger-text)' }} />
            )}
            <div>
              <div style={{ fontWeight: 700, color: auditResult.healthy ? 'var(--success-text)' : 'var(--danger-text)' }}>
                {auditResult.healthy
                  ? 'All Data Stores Fully Consistent & Healthy'
                  : `Data Governance Notice: ${auditResult.issuesFound} inconsistency issue(s) detected.`}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-600)', marginTop: '0.15rem' }}>
                Audited {auditResult.totalUsersAudited} user records and {auditResult.totalGrievancesAudited} grievance documents.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Section 1: Platform Environment & Version */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Server size={18} style={{ color: 'var(--primary-700)' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--slate-500)' }}>PLATFORM BUILD</span>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)' }}>{config.version}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.2rem' }}>Production Governance Core</div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Activity size={18} style={{ color: 'var(--success-solid)' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--slate-500)' }}>DATA LAYER</span>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)' }}>{config.environment}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.2rem' }}>Persistent Immutable Storage</div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Zap size={18} style={{ color: 'var(--warning-solid)' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--slate-500)' }}>DUAL-CLOCK SLA ENGINE</span>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)' }}>Active & Enforced</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.2rem' }}>Deterministic Escalation Multipliers</div>
        </Card>
      </div>

      {/* Section 2: Municipal Department Taxonomy & Baseline SLA */}
      <Card style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <Building2 size={18} style={{ color: 'var(--primary-700)' }} />
          <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Municipal Department Taxonomy & Baseline SLA</h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--slate-200)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)' }}>Department Name</th>
                <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)' }}>ID & Code</th>
                <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)', textAlign: 'center' }}>Response SLA</th>
                <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)', textAlign: 'center' }}>Resolution SLA</th>
                <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)', textAlign: 'center' }}>Base Risk Score</th>
              </tr>
            </thead>
            <tbody>
              {config.municipalDepartments.map((dept) => (
                <tr key={dept.id} style={{ borderBottom: '1px solid var(--slate-100)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--slate-900)' }}>
                    {dept.departmentName}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.775rem', background: 'var(--slate-100)', padding: '0.15rem 0.35rem', borderRadius: 'var(--radius-sm)' }}>
                      {dept.id}
                    </span>
                    <span style={{ marginLeft: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.775rem', color: 'var(--primary-700)', fontWeight: 600 }}>
                      {dept.departmentCode}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {dept.defaultResponseHours}h
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {dept.defaultResolutionHours}h
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--slate-700)' }}>
                    {dept.baseRiskScore} / 100
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section 3: SLA Warning Thresholds & Escalation Limits */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
        {/* SLA Thresholds */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Clock size={18} style={{ color: 'var(--warning-solid)' }} />
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>SLA Warning Thresholds</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(config.slaWarningThresholds).map(([key, threshold]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-200)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--slate-800)' }}>{threshold.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', fontFamily: 'var(--font-mono)' }}>
                    {threshold.minPercent}% – {threshold.maxPercent === Infinity ? '∞' : `${threshold.maxPercent}%`} elapsed
                  </div>
                </div>
                <Badge variant={threshold.color} size="sm">
                  {key}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Governance Limits */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Shield size={18} style={{ color: 'var(--primary-700)' }} />
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Extension & Escalation Limits</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--slate-50)', border: '1px solid var(--slate-200)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--slate-800)' }}>Max Extensions Per Grievance</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{config.governanceLimits.MAX_EXTENSIONS_PER_COMPLAINT}</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Prevents indefinite postponement by field officers</div>
            </div>

            <div style={{ padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--slate-50)', border: '1px solid var(--slate-200)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--slate-800)' }}>First Extension Max Duration</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>+{config.governanceLimits.FIRST_EXTENSION_MAX_HOURS}h</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Department Admin approval limit</div>
            </div>

            <div style={{ padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--slate-50)', border: '1px solid var(--slate-200)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--slate-800)' }}>Citizen Follow-up Threshold</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{config.governanceLimits.FOLLOWUP_ESCALATION_THRESHOLD} Signals</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Triggers automatic departmental escalation</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Section 4: Lifecycle Status Enums */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Layers size={18} style={{ color: 'var(--primary-700)' }} />
          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Grievance Lifecycle Status Taxonomy</h3>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {config.grievanceStatuses.map((st) => (
            <span
              key={st}
              style={{
                padding: '0.35rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--slate-100)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: 'var(--slate-700)',
                border: '1px solid var(--slate-200)',
              }}
            >
              {st}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
};
