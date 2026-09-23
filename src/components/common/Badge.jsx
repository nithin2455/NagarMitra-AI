import React from 'react';

export const Badge = ({ children, variant = 'neutral', size = 'md', className = '' }) => {
  const variantMap = {
    primary: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    neutral: 'badge-neutral',
  };

  const badgeClass = `badge ${variantMap[variant] || 'badge-neutral'} ${className}`;
  return <span className={badgeClass}>{children}</span>;
};

export const StatusBadge = ({ status }) => {
  const statusConfig = {
    SUBMITTED: { label: 'Submitted', variant: 'neutral' },
    SEEN: { label: 'Seen by Officer', variant: 'primary' },
    VERIFIED: { label: 'Verified', variant: 'primary' },
    IN_PROGRESS: { label: 'In Progress', variant: 'warning' },
    RESOLUTION_SUBMITTED: { label: 'Resolution Submitted', variant: 'warning' },
    COMMUNITY_ACTION_SUBMITTED: { label: 'Community Action Submitted', variant: 'warning' },
    VERIFICATION: { label: 'Under Verification', variant: 'warning' },
    VERIFIED_RESOLVED: { label: 'Verified Resolved', variant: 'success' },
    CLOSED: { label: 'Closed', variant: 'success' },
    ESCALATED: { label: 'Escalated', variant: 'danger' },
    REJECTED: { label: 'Rejected', variant: 'danger' },
  };

  const config = statusConfig[status] || { label: status, variant: 'neutral' };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export const SeverityBadge = ({ severity }) => {
  const severityConfig = {
    LOW: { label: 'Low', variant: 'neutral' },
    MEDIUM: { label: 'Medium', variant: 'primary' },
    HIGH: { label: 'High', variant: 'warning' },
    CRITICAL: { label: 'Critical', variant: 'danger' },
  };

  const config = severityConfig[severity] || { label: severity, variant: 'neutral' };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};
