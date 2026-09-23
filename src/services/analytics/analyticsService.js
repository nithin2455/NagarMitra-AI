/**
 * @file analyticsService.js
 * @description Production Analytics & Administrative Intelligence Service.
 * Aggregates real grievance data from Firestore / local directory, evaluating
 * live SLA performance, priority distributions, and department resolution rates.
 */

import { grievanceService } from '../firebase/grievanceService.js';
import { slaEngine } from '../governance/slaEngine.js';
import {
  USER_ROLES,
  COMPLAINT_STATUS,
  SEVERITY_LEVELS,
  ESCALATION_LEVELS,
  CATEGORIES,
} from '../../models/schema.js';

export const analyticsService = {
  /**
   * Generates comprehensive administrative analytics for an authenticated admin
   * @param {Object} adminProfile - Current user profile
   * @param {Object} filters - { departmentId, status, priority, dateRange }
   */
  async getAnalytics(adminProfile, filters = {}) {
    if (
      !adminProfile ||
      ![USER_ROLES.DEPARTMENT_ADMIN, USER_ROLES.SUPER_ADMIN].includes(adminProfile.role)
    ) {
      throw new Error('Access Denied: Administrative intelligence is restricted to authorized Admins.');
    }

    const {
      departmentId = 'all',
      status = 'all',
      priority = 'all',
      dateRange = 'all_time', // 'all_time' | 'today' | 'last_7_days' | 'last_30_days'
    } = filters;

    // Security Rule: Department Admin is strictly locked to their assigned department
    let targetDept = departmentId;
    if (adminProfile.role === USER_ROLES.DEPARTMENT_ADMIN) {
      if (departmentId !== 'all' && departmentId !== adminProfile.departmentId) {
        throw new Error(
          `Access Denied: Department Admin for (${adminProfile.departmentId.toUpperCase()}) cannot view analytics for another department.`
        );
      }
      targetDept = adminProfile.departmentId;
    }

    // 1. Fetch raw grievances based on authorized department scope
    const rawGrievances = await grievanceService.getDepartmentGrievances(targetDept);

    // 2. Apply Date Range Filter
    const now = new Date();
    const filteredByDate = rawGrievances.filter((g) => {
      if (!g.createdAt) return true;
      const createdDate = new Date(g.createdAt);
      if (dateRange === 'today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return createdDate >= startOfToday;
      }
      if (dateRange === 'last_7_days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return createdDate >= sevenDaysAgo;
      }
      if (dateRange === 'last_30_days') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return createdDate >= thirtyDaysAgo;
      }
      return true; // 'all_time'
    });

    // 3. Apply Status Filter
    const filteredByStatus = filteredByDate.filter((g) => {
      if (status === 'all') return true;
      if (status === 'escalated') {
        return (
          g.escalationLevel &&
          g.escalationLevel !== ESCALATION_LEVELS.NOT_ESCALATED &&
          g.escalationLevel !== ESCALATION_LEVELS.RESOLVED
        );
      }
      return g.status === status;
    });

    // 4. Apply Priority Filter
    const finalGrievances = filteredByStatus.filter((g) => {
      if (priority === 'all') return true;
      const level = (g.priorityLevel || g.severity || '').toUpperCase();
      return level === priority.toUpperCase();
    });

    // --- A. KPI Summary ---
    const totalComplaints = finalGrievances.length;
    const pending = finalGrievances.filter((g) =>
      [COMPLAINT_STATUS.SUBMITTED, COMPLAINT_STATUS.SEEN, COMPLAINT_STATUS.VERIFIED].includes(g.status)
    ).length;

    const inProgress = finalGrievances.filter((g) => g.status === COMPLAINT_STATUS.IN_PROGRESS).length;

    const underVerification = finalGrievances.filter((g) =>
      [
        COMPLAINT_STATUS.VERIFICATION,
        COMPLAINT_STATUS.RESOLUTION_SUBMITTED,
        COMPLAINT_STATUS.COMMUNITY_ACTION_SUBMITTED,
      ].includes(g.status)
    ).length;

    const verifiedResolved = finalGrievances.filter(
      (g) => g.status === COMPLAINT_STATUS.VERIFIED_RESOLVED
    ).length;

    const closed = finalGrievances.filter((g) => g.status === COMPLAINT_STATUS.CLOSED).length;

    const escalated = finalGrievances.filter(
      (g) =>
        g.escalationLevel &&
        g.escalationLevel !== ESCALATION_LEVELS.NOT_ESCALATED &&
        g.escalationLevel !== ESCALATION_LEVELS.RESOLVED
    ).length;

    const totalResolved = verifiedResolved + closed;
    const overallResolutionRate =
      totalComplaints > 0 ? Number(((totalResolved / totalComplaints) * 100).toFixed(1)) : 0;

    // --- B. Department-wise Analytics Matrix ---
    // For Dept Admin, show only their department; For Super Admin, show all or filtered
    const deptCategories =
      adminProfile.role === USER_ROLES.DEPARTMENT_ADMIN
        ? Object.values(CATEGORIES).filter((c) => c.id === adminProfile.departmentId)
        : targetDept !== 'all'
        ? Object.values(CATEGORIES).filter((c) => c.id === targetDept)
        : Object.values(CATEGORIES);

    const departmentAnalytics = deptCategories.map((cat) => {
      const deptList = filteredByDate.filter((g) => g.departmentId === cat.id);
      const deptTotal = deptList.length;
      const deptInProgress = deptList.filter((g) => g.status === COMPLAINT_STATUS.IN_PROGRESS).length;
      const deptUnderVerif = deptList.filter((g) =>
        [
          COMPLAINT_STATUS.VERIFICATION,
          COMPLAINT_STATUS.RESOLUTION_SUBMITTED,
          COMPLAINT_STATUS.COMMUNITY_ACTION_SUBMITTED,
        ].includes(g.status)
      ).length;
      const deptVerified = deptList.filter((g) => g.status === COMPLAINT_STATUS.VERIFIED_RESOLVED).length;
      const deptClosed = deptList.filter((g) => g.status === COMPLAINT_STATUS.CLOSED).length;
      const deptResolved = deptVerified + deptClosed;
      const deptPending = deptTotal - deptResolved;
      const deptEscalated = deptList.filter(
        (g) =>
          g.escalationLevel &&
          g.escalationLevel !== ESCALATION_LEVELS.NOT_ESCALATED &&
          g.escalationLevel !== ESCALATION_LEVELS.RESOLVED
      ).length;

      const rate = deptTotal > 0 ? Number(((deptResolved / deptTotal) * 100).toFixed(1)) : 0;

      return {
        departmentId: cat.id,
        departmentName: cat.departmentName,
        departmentCode: cat.departmentCode,
        total: deptTotal,
        inProgress: deptInProgress,
        underVerification: deptUnderVerif,
        verifiedResolved: deptVerified,
        closed: deptClosed,
        escalated: deptEscalated,
        resolved: deptResolved,
        pending: deptPending,
        resolutionRate: rate,
      };
    });

    // --- C. Priority Analytics Distribution ---
    const priorityCounts = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    finalGrievances.forEach((g) => {
      const p = (g.priorityLevel || g.severity || 'LOW').toUpperCase();
      if (priorityCounts[p] !== undefined) {
        priorityCounts[p]++;
      } else if (p === 'CRITICAL_SAFETY' || p === 'EMERGENCY') {
        priorityCounts.CRITICAL++;
      } else {
        priorityCounts.LOW++;
      }
    });

    const priorityDistribution = [
      {
        priority: 'Critical',
        key: 'CRITICAL',
        count: priorityCounts.CRITICAL,
        percentage:
          totalComplaints > 0
            ? Number(((priorityCounts.CRITICAL / totalComplaints) * 100).toFixed(1))
            : 0,
        color: '#dc2626',
      },
      {
        priority: 'High',
        key: 'HIGH',
        count: priorityCounts.HIGH,
        percentage:
          totalComplaints > 0
            ? Number(((priorityCounts.HIGH / totalComplaints) * 100).toFixed(1))
            : 0,
        color: '#ea580c',
      },
      {
        priority: 'Medium',
        key: 'MEDIUM',
        count: priorityCounts.MEDIUM,
        percentage:
          totalComplaints > 0
            ? Number(((priorityCounts.MEDIUM / totalComplaints) * 100).toFixed(1))
            : 0,
        color: '#d97706',
      },
      {
        priority: 'Low',
        key: 'LOW',
        count: priorityCounts.LOW,
        percentage:
          totalComplaints > 0
            ? Number(((priorityCounts.LOW / totalComplaints) * 100).toFixed(1))
            : 0,
        color: '#2563eb',
      },
    ];

    // --- D. SLA Analytics Evaluation ---
    let responseMet = 0;
    let responseBreached = 0;
    let responseActive = 0;

    let resolutionMet = 0;
    let resolutionBreached = 0;
    let resolutionActive = 0;

    finalGrievances.forEach((g) => {
      const respEval = slaEngine.evaluateResponseSLA(g, now);
      if (respEval) {
        if (respEval.isStopped) {
          if (respEval.isMet) responseMet++;
          else responseBreached++;
        } else {
          if (respEval.isBreached) responseBreached++;
          else responseActive++;
        }
      }

      const resEval = slaEngine.evaluateResolutionSLA(g, now);
      if (resEval) {
        if (resEval.isStopped) {
          if (resEval.isMet) resolutionMet++;
          else resolutionBreached++;
        } else {
          if (resEval.isBreached) resolutionBreached++;
          else resolutionActive++;
        }
      }
    });

    const totalResponseEvaluated = responseMet + responseBreached;
    const responseComplianceRate =
      totalResponseEvaluated > 0
        ? Number(((responseMet / totalResponseEvaluated) * 100).toFixed(1))
        : 100;

    const totalResolutionEvaluated = resolutionMet + resolutionBreached;
    const resolutionComplianceRate =
      totalResolutionEvaluated > 0
        ? Number(((resolutionMet / totalResolutionEvaluated) * 100).toFixed(1))
        : 100;

    // --- E. Status Distribution for Charts ---
    const statusDistribution = [
      { status: 'Submitted', count: finalGrievances.filter((g) => g.status === COMPLAINT_STATUS.SUBMITTED).length, color: '#64748b' },
      { status: 'Seen / Acknowledged', count: finalGrievances.filter((g) => g.status === COMPLAINT_STATUS.SEEN).length, color: '#0284c7' },
      { status: 'In Progress', count: inProgress, color: '#2563eb' },
      { status: 'Under Verification', count: underVerification, color: '#f59e0b' },
      { status: 'Verified Resolved', count: verifiedResolved, color: '#10b981' },
      { status: 'Closed', count: closed, color: '#059669' },
    ].filter((s) => s.count > 0 || totalComplaints === 0);

    return {
      kpiSummary: {
        totalComplaints,
        pending,
        inProgress,
        underVerification,
        verifiedResolved,
        closed,
        escalated,
        totalResolved,
        overallResolutionRate,
      },
      departmentAnalytics,
      priorityDistribution,
      statusDistribution,
      slaAnalytics: {
        response: {
          met: responseMet,
          breached: responseBreached,
          active: responseActive,
          complianceRate: responseComplianceRate,
        },
        resolution: {
          met: resolutionMet,
          breached: resolutionBreached,
          active: resolutionActive,
          complianceRate: resolutionComplianceRate,
        },
      },
      filtersApplied: {
        departmentId: targetDept,
        status,
        priority,
        dateRange,
      },
      userScope: {
        role: adminProfile.role,
        departmentId: adminProfile.departmentId,
      },
      generatedAt: now.toISOString(),
    };
  },
};
