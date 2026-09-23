import React from 'react';

export const Card = ({ children, className = '', hoverable = false, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`card ${hoverable ? 'card-hover' : ''} ${className}`}
    >
      {children}
    </div>
  );
};
