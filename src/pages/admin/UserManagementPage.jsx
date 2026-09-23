import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { systemAdminService } from '../../services/firebase/systemAdminService.js';
import { useAuth } from '../../context/AuthContext';
import { CATEGORIES, USER_ROLES } from '../../models/schema.js';
import {
  Users,
  Shield,
  Search,
  Filter,
  RotateCw,
  UserCheck,
  Building2,
  Mail,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';

export const UserManagementPage = () => {
  const { currentUser, isDepartmentAdmin, isSuperAdmin } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await systemAdminService.getUsers(currentUser, {
        role: selectedRole,
        departmentId: isDepartmentAdmin ? currentUser.departmentId : selectedDept,
        searchTerm,
      });
      setUsers(data);
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err.message || 'Failed to load user directory.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchUsers();
    }
  }, [currentUser, selectedRole, selectedDept, searchTerm]);

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case USER_ROLES.SUPER_ADMIN:
        return 'danger';
      case USER_ROLES.DEPARTMENT_ADMIN:
        return 'primary';
      case USER_ROLES.OFFICER:
        return 'warning';
      case USER_ROLES.CITIZEN:
        return 'info';
      default:
        return 'neutral';
    }
  };

  const getDepartmentLabel = (deptId) => {
    if (!deptId) return 'General / Citizen';
    const cat = Object.values(CATEGORIES).find((c) => c.id === deptId);
    return cat ? cat.departmentName : deptId.toUpperCase();
  };

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
            <h1 style={{ fontSize: '1.75rem', margin: 0 }}>User & Role Directory</h1>
            <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
              <Shield size={12} style={{ marginRight: '4px' }} />
              {isDepartmentAdmin
                ? `${currentUser?.departmentId?.toUpperCase()} Department Scope`
                : 'Executive Super Admin'}
            </span>
          </div>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem', margin: 0 }}>
            Authorized platform personnel, department assignments, and account role verification.
          </p>
        </div>

        {/* Refresh Button */}
        <Button
          variant="secondary"
          size="sm"
          icon={RotateCw}
          loading={refreshing}
          disabled={loading || refreshing}
          onClick={() => fetchUsers(true)}
        >
          {refreshing ? 'Refreshing Directory...' : 'Refresh Users'}
        </Button>
      </div>

      {/* Filter Control Bar */}
      <Card style={{ marginBottom: '1.75rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Filter size={16} style={{ color: 'var(--primary-700)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--slate-800)' }}>
            User Search & Filter Controls
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          {/* Search Input */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              Search Name or Email
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search user profile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem 0.4rem 2rem' }}
              />
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '0.6rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--slate-400)',
                }}
              />
            </div>
          </div>

          {/* Role Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              Filter by Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="form-select"
              style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem' }}
            >
              <option value="all">All Roles</option>
              <option value={USER_ROLES.OFFICER}>Department Officers</option>
              <option value={USER_ROLES.DEPARTMENT_ADMIN}>Department Administrators</option>
              {isSuperAdmin && <option value={USER_ROLES.SUPER_ADMIN}>Super Administrators</option>}
              {isSuperAdmin && <option value={USER_ROLES.CITIZEN}>Citizens</option>}
            </select>
          </div>

          {/* Department Filter (Super Admin only) */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              Department Scope
            </label>
            {isSuperAdmin ? (
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="form-select"
                style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem' }}
              >
                <option value="all">All Departments</option>
                {Object.values(CATEGORIES).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.departmentName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                disabled
                value={getDepartmentLabel(currentUser?.departmentId)}
                className="form-input"
                style={{ fontSize: '0.825rem', padding: '0.4rem 0.6rem', background: 'var(--slate-100)' }}
              />
            )}
          </div>
        </div>
      </Card>

      {/* Main Users Table */}
      {loading ? (
        <LoadingSpinner message="Retrieving authorized user profiles..." />
      ) : error ? (
        <Card style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <AlertTriangle size={40} style={{ color: 'var(--danger-solid)', margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>User Directory Error</h3>
          <p style={{ color: 'var(--slate-600)', marginBottom: '1.25rem' }}>{error}</p>
          <Button variant="primary" onClick={() => fetchUsers()}>
            Retry Loading
          </Button>
        </Card>
      ) : users.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <FolderOpen size={44} style={{ color: 'var(--slate-400)', margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.35rem', color: 'var(--slate-800)' }}>
            No users found
          </h3>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.25rem auto' }}>
            No user profiles match your currently selected filters.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSelectedRole('all');
              setSelectedDept('all');
              setSearchTerm('');
            }}
          >
            Reset Filters
          </Button>
        </Card>
      ) : (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
              Displaying <strong>{users.length}</strong> registered accounts
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--slate-200)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)' }}>User / Identity</th>
                  <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)' }}>Role</th>
                  <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)' }}>Department Allocation</th>
                  <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)', textAlign: 'center' }}>Account Status</th>
                  <th style={{ padding: '0.75rem 0.5rem', color: 'var(--slate-600)', textAlign: 'right' }}>Joined / Active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.uid || user.email} style={{ borderBottom: '1px solid var(--slate-100)' }}>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>
                        {user.displayName || 'CivicPulse User'}
                      </div>
                      <div style={{ fontSize: '0.775rem', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                        {user.email}
                      </div>
                    </td>

                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <Badge variant={getRoleBadgeVariant(user.role)} size="sm">
                        {user.role?.toUpperCase()}
                      </Badge>
                    </td>

                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      {user.departmentId ? (
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--slate-800)' }}>
                            {getDepartmentLabel(user.departmentId)}
                          </div>
                          <span style={{ fontSize: '0.725rem', fontFamily: 'var(--font-mono)', color: 'var(--slate-400)' }}>
                            ID: {user.departmentId}
                          </span>
                        </div>
                      ) : user.role === USER_ROLES.SUPER_ADMIN ? (
                        <span style={{ color: 'var(--danger-text)', fontWeight: 600, fontSize: '0.8rem' }}>
                          Global Municipal Authority
                        </span>
                      ) : (
                        <span style={{ color: 'var(--slate-400)', fontSize: '0.8rem' }}>
                          Public Resident Submitter
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      <Badge variant={user.accountStatus === 'active' ? 'success' : 'danger'} size="sm">
                        {user.accountStatus ? user.accountStatus.toUpperCase() : 'ACTIVE'}
                      </Badge>
                    </td>

                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--slate-500)', fontSize: '0.775rem' }}>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
