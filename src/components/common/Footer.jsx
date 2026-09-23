import React from 'react';

export const Footer = () => {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <strong style={{ color: 'var(--slate-800)' }}>CivicPulse • Public Grievance & Issue Management Platform</strong>
          <p style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>
            Transparent Civic Accountability • Dynamic SLA Governance • Dual-Evidence Verification
          </p>
        </div>
        <div style={{ fontSize: '0.8rem' }}>
          <span>Municipal Administration & Public Service Platform</span>
        </div>
      </div>
    </footer>
  );
};
