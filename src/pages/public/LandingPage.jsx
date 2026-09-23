import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { CATEGORIES } from '../../models/schema';
import {
  ShieldCheck,
  Clock,
  Users,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  FileText,
  Search,
} from 'lucide-react';

export const LandingPage = () => {
  const workflowStages = [
    { title: '1. Citizen Report', desc: 'Geotagged issue submission with media proof and sensitivity triage.' },
    { title: '2. Community Signal', desc: 'Unique citizen upvotes and collective urgency prioritization.' },
    { title: '3. Dept Routing', desc: 'Intelligent routing to local municipal authority.' },
    { title: '4. Dynamic SLA', desc: 'Separate response and resolution deadline clocks with governance.' },
    { title: '5. Action & Proof', desc: 'Field officer work or citizen DIY remediation with before/after photos.' },
    { title: '6. Verification', desc: 'Independent supervisory verification before final closure.' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem', paddingBottom: '4rem' }}>
      {/* Hero Section */}
      <section style={{ background: 'linear-gradient(180deg, #ffffff 0%, var(--slate-100) 100%)', padding: '4.5rem 0', borderBottom: '1px solid var(--slate-200)' }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: '850px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.85rem', background: 'var(--primary-50)', color: 'var(--primary-700)', borderRadius: 'var(--radius-full)', fontSize: '0.825rem', fontWeight: 600, marginBottom: '1.5rem' }}>
            <Sparkles size={14} /> Smart Public Grievance & Issue Management Platform
          </div>
          <h1 style={{ fontSize: '2.75rem', letterSpacing: '-0.03em', marginBottom: '1.25rem', color: 'var(--slate-950)' }}>
            Transparent Civic Accountability Powered by Dynamic SLA Governance
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--slate-600)', lineHeight: '1.6', marginBottom: '2.25rem' }}>
            Report civic issues, rally community support, track field officer progress in real-time, and verify dual-proof resolution evidence through an immutable audit trail.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/citizen/report">
              <Button variant="primary" size="lg" icon={FileText}>
                Report an Issue
              </Button>
            </Link>
            <Link to="/feed">
              <Button variant="secondary" size="lg" icon={Users}>
                Explore Community Feed
              </Button>
            </Link>
            <Link to="/track">
              <Button variant="outline" size="lg" icon={Search}>
                Track Grievance
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Core Workflow */}
      <section className="container">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.85rem', marginBottom: '0.5rem' }}>The Transparent 6-Pillar Workflow</h2>
          <p style={{ color: 'var(--slate-500)' }}>How issues move from citizen intake to verified remediation.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {workflowStages.map((stage, idx) => (
            <Card key={idx} hoverable>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-700)', marginBottom: '0.5rem' }}>
                {stage.title}
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--slate-600)', lineHeight: '1.5' }}>
                {stage.desc}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Categories Supported */}
      <section className="container">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.85rem', marginBottom: '0.5rem' }}>Public Grievance Categories</h2>
          <p style={{ color: 'var(--slate-500)' }}>Automated department routing with dynamic SLA base durations.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {Object.values(CATEGORIES).map((cat) => (
            <Card key={cat.id}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.4rem' }}>{cat.name}</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span>Response SLA: <strong>{cat.defaultResponseHours}h</strong></span>
                <span>Resolution SLA: <strong>{cat.defaultResolutionHours}h</strong></span>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};
