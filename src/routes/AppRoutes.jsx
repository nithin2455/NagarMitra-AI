import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { USER_ROLES } from '../models/schema';
import { AppLayout } from '../components/layout/AppLayout';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { RoleGuard, ProtectedRoute } from './RoleGuard';

// Icons for sidebars
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  Inbox,
  Clock,
  CheckSquare,
  Building2,
  ListFilter,
  HardHat,
  Shield,
  Compass,
  BarChart3,
  Users,
  Sliders,
  Flame,
  ShieldAlert,
} from 'lucide-react';

// Public & Auth Pages
import { LandingPage } from '../pages/public/LandingPage';
import { PublicFeedPage } from '../pages/public/PublicFeedPage';
import { TrackGrievancePage } from '../pages/public/TrackGrievancePage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { UnauthorizedPage } from '../pages/auth/UnauthorizedPage';
import { NotFoundPage } from '../pages/public/NotFoundPage';

// Citizen Pages
import { CitizenDashboard } from '../pages/citizen/CitizenDashboard';
import { ReportGrievancePage } from '../pages/citizen/ReportGrievancePage';
import { MyGrievancesPage } from '../pages/citizen/MyGrievancesPage';
import { GrievanceDetailPage } from '../pages/citizen/GrievanceDetailPage';

// Officer Pages
import { OfficerDashboard } from '../pages/officer/OfficerDashboard';
import { OfficerInboxPage } from '../pages/officer/OfficerInboxPage';
import { OfficerActionPage } from '../pages/officer/OfficerActionPage';

// Admin Pages
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { AdminAnalyticsPage } from '../pages/admin/AdminAnalyticsPage';
import { AdminHotspotsPage } from '../pages/admin/AdminHotspotsPage';
import { DepartmentsPage } from '../pages/admin/DepartmentsPage';
import { UserManagementPage } from '../pages/admin/UserManagementPage';
import { SystemConfigurationPage } from '../pages/admin/SystemConfigurationPage';
import { SLAApprovalsPage } from '../pages/admin/SLAApprovalsPage';
import { VerificationQueuePage } from '../pages/admin/VerificationQueuePage';
import { AuditLogsPage } from '../pages/admin/AuditLogsPage';
import { AdminAnomalyPage } from '../pages/admin/AdminAnomalyPage';

// Navigation configurations for role-based dashboard sidebars
const citizenNav = [
  { to: '/citizen', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/citizen/report', label: 'Report Grievance', icon: PlusCircle },
  { to: '/citizen/my-grievances', label: 'My Submissions', icon: FileText },
  { to: '/feed', label: 'Community Feed', icon: Compass },
];

const officerNav = [
  { to: '/officer', label: 'Workstation Overview', icon: HardHat, end: true },
  { to: '/officer/inbox', label: 'Assigned Inbox', icon: Inbox },
];

const adminNav = [
  { to: '/admin', label: 'Command Overview', icon: Shield, end: true },
  { to: '/admin/anomalies', label: 'AI Anomaly Detection', icon: ShieldAlert },
  { to: '/admin/hotspots', label: 'AI Location Hotspots', icon: Flame },
  { to: '/admin/analytics', label: 'Analytics & Intelligence', icon: BarChart3 },
  { to: '/admin/departments', label: 'Departments', icon: Building2 },
  { to: '/admin/users', label: 'User Management', icon: Users },
  { to: '/admin/system-config', label: 'System Configuration', icon: Sliders },
  { to: '/admin/sla-approvals', label: 'SLA Approvals', icon: Clock },
  { to: '/admin/verifications', label: 'Resolution Verifications', icon: CheckSquare },
  { to: '/admin/audit-logs', label: 'System Audit Logs', icon: ListFilter },
];

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Root Shell Layout */}
      <Route element={<AppLayout />}>
        {/* Public Landing & Auth Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Authenticated Community & Tracking Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/feed" element={<PublicFeedPage />} />
          <Route path="/track" element={<TrackGrievancePage />} />
        </Route>

        {/* Strictly Citizen Portal Routes */}
        <Route element={<RoleGuard allowedRoles={[USER_ROLES.CITIZEN]} />}>
          <Route path="/citizen" element={<DashboardLayout title="Citizen Portal" navItems={citizenNav} />}>
            <Route index element={<CitizenDashboard />} />
            <Route path="report" element={<ReportGrievancePage />} />
            <Route path="my-grievances" element={<MyGrievancesPage />} />
            <Route path="grievance/:id" element={<GrievanceDetailPage />} />
          </Route>
        </Route>

        {/* Strictly Department Officer Workstation Routes */}
        <Route element={<RoleGuard allowedRoles={[USER_ROLES.OFFICER]} />}>
          <Route path="/officer" element={<DashboardLayout title="Officer Workstation" navItems={officerNav} />}>
            <Route index element={<OfficerDashboard />} />
            <Route path="inbox" element={<OfficerInboxPage />} />
            <Route path="grievance/:id" element={<OfficerActionPage />} />
          </Route>
        </Route>

        {/* Department Admin & Super Admin Command Center Routes */}
        <Route
          element={
            <RoleGuard
              allowedRoles={[
                USER_ROLES.DEPARTMENT_ADMIN,
                USER_ROLES.SUPER_ADMIN,
              ]}
            />
          }
        >
          <Route path="/admin" element={<DashboardLayout title="Admin Command Center" navItems={adminNav} />}>
            <Route index element={<AdminDashboard />} />
            <Route path="anomalies" element={<AdminAnomalyPage />} />
            <Route path="hotspots" element={<AdminHotspotsPage />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
            <Route path="departments" element={<DepartmentsPage />} />
            <Route path="users" element={<UserManagementPage />} />
            <Route element={<RoleGuard allowedRoles={[USER_ROLES.SUPER_ADMIN]} />}>
              <Route path="system-config" element={<SystemConfigurationPage />} />
            </Route>
            <Route path="sla-approvals" element={<SLAApprovalsPage />} />
            <Route path="verifications" element={<VerificationQueuePage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
          </Route>
        </Route>

        {/* 404 Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
