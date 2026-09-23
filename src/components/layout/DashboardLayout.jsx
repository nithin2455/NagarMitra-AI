import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

export const DashboardLayout = ({ title, navItems = [] }) => {
  return (
    <div className="dashboard-container">
      <aside className="dashboard-sidebar">
        <div style={{ marginBottom: '1.5rem', paddingLeft: '0.5rem' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--slate-800)', fontWeight: 700 }}>{title}</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Control Navigation</span>
        </div>
        <nav className="dashboard-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `dashboard-nav-item ${isActive ? 'active' : ''}`
                }
              >
                {Icon && <Icon size={18} />}
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <main className="dashboard-content">
        <Outlet />
      </main>
    </div>
  );
};
