import React from 'react';

export const LoadingSpinner = ({ size = 24, message = null, fullScreen = false }) => {
  const spinnerContent = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
      <div
        style={{
          width: size,
          height: size,
          border: '3px solid var(--slate-200)',
          borderTopColor: 'var(--primary-600)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      {message && (
        <span style={{ fontSize: '0.875rem', color: 'var(--slate-600)', fontWeight: 500 }}>
          {message}
        </span>
      )}
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );

  if (fullScreen) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        {spinnerContent}
      </div>
    );
  }

  return spinnerContent;
};
