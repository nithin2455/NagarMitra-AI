import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Home } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div className="container" style={{ padding: '5rem 1.5rem', maxWidth: '500px', textAlign: 'center' }}>
      <Card>
        <h1 style={{ fontSize: '3rem', color: 'var(--primary-600)', marginBottom: '0.5rem' }}>404</h1>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>Page Not Found</h2>
        <p style={{ color: 'var(--slate-600)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          The requested path does not exist on the platform.
        </p>
        <Link to="/">
          <Button variant="primary" icon={Home}>Back to Home</Button>
        </Link>
      </Card>
    </div>
  );
};
