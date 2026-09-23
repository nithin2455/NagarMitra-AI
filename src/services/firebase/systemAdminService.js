/**
 * @file systemAdminService.js
 * @description Production System Administration & Data Governance Service.
 * Implements administrative data aggregation, department metrics, sanitized user management,
 * system configuration inspection, and strict integrity/schema validation guards.
 */

import { collection, getDocs, doc, setDoc, query, where, orderBy } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebaseConfig.js';
import { grievanceService } from './grievanceService.js';
import { INITIAL_PROVISIONED_ACCOUNTS } from './authService.js';
import {
  CATEGORIES,
  USER_ROLES,
  COMPLAINT_STATUS,
  SEVERITY_LEVELS,
  ESCALATION_LEVELS,
  SLA_WARNING_THRESHOLDS,
  EXTENSION_LIMITS,
} from '../../models/schema.js';

const LOCAL_USERS_KEY = 'civicpulse_users_directory';

/**
 * Retrieve raw user directory from local storage or provisioned seed
 */
function getRawLocalUsers() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_USERS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with initial provisioned accounts if missing
      for (const [key, acc] of Object.entries(INITIAL_PROVISIONED_ACCOUNTS)) {
        if (!parsed[key]) {
          parsed[key] = acc;
        }
      }
      return parsed;
    }
    return INITIAL_PROVISIONED_ACCOUNTS;
  } catch {
    return INITIAL_PROVISIONED_ACCOUNTS;
  }
}

export const systemAdminService = {
  /**
   * Fetch municipal departments with real aggregate metrics
   * @param {Object} adminProfile - Authenticated administrator profile
   * @returns {Promise<Array>} List of department objects with live stats
   */
  async getDepartments(adminProfile) {
    if (
      !adminProfile ||
      ![USER_ROLES.DEPARTMENT_ADMIN, USER_ROLES.SUPER_ADMIN].includes(adminProfile.role)
    ) {
      throw new Error('Access Denied: Department management is restricted to authorized administrators.');
    }

    // 1. Fetch grievances to calculate real department stats
    const isDeptAdmin = adminProfile.role === USER_ROLES.DEPARTMENT_ADMIN;
    const targetDept = isDeptAdmin ? adminProfile.departmentId : 'all';

    const grievances = await grievanceService.getDepartmentGrievances(targetDept);
    const users = await this.getUsers(adminProfile);

    // 2. Determine department list scope
    const allCategories = Object.values(CATEGORIES);
    const visibleCategories = isDeptAdmin
      ? allCategories.filter((cat) => cat.id === adminProfile.departmentId)
      : allCategories;

    return visibleCategories.map((cat) => {
      const deptGrievances = grievances.filter((g) => g.departmentId === cat.id);
      const totalGrievances = deptGrievances.length;

      const resolvedCount = deptGrievances.filter((g) =>
        [COMPLAINT_STATUS.VERIFIED_RESOLVED, COMPLAINT_STATUS.CLOSED].includes(g.status)
      ).length;

      const resolutionRate =
        totalGrievances > 0 ? Number(((resolvedCount / totalGrievances) * 100).toFixed(1)) : 0;

      // Count officers and admins assigned to this department
      const deptOfficers = users.filter(
        (u) => u.role === USER_ROLES.OFFICER && u.departmentId === cat.id
      ).length;

      const deptAdmins = users.filter(
        (u) => u.role === USER_ROLES.DEPARTMENT_ADMIN && u.departmentId === cat.id
      ).length;

      return {
        id: cat.id,
        departmentId: cat.id,
        name: cat.departmentName,
        code: cat.departmentCode,
        status: 'ACTIVE',
        grievanceCount: totalGrievances,
        resolvedCount,
        resolutionRate,
        officerCount: deptOfficers,
        adminCount: deptAdmins,
        defaultResponseHours: cat.defaultResponseHours,
        defaultResolutionHours: cat.defaultResolutionHours,
        baseRiskScore: cat.baseRiskScore,
      };
    });
  },

  /**
   * Fetch sanitized user directory with strict department isolation.
   * CRITICAL: Never exposes passwords or sensitive credentials.
   * @param {Object} adminProfile - Authenticated administrator profile
   * @param {Object} filters - { role, departmentId, searchTerm }
   * @returns {Promise<Array>} List of sanitized user records
   */
  async getUsers(adminProfile, filters = {}) {
    if (
      !adminProfile ||
      ![USER_ROLES.DEPARTMENT_ADMIN, USER_ROLES.SUPER_ADMIN].includes(adminProfile.role)
    ) {
      throw new Error('Access Denied: User directory access is restricted to authorized administrators.');
    }

    const { role = 'all', departmentId = 'all', searchTerm = '' } = filters;
    const isDeptAdmin = adminProfile.role === USER_ROLES.DEPARTMENT_ADMIN;

    // Security Rule: Department Admin is strictly isolated to their own department
    if (isDeptAdmin && departmentId !== 'all' && departmentId !== adminProfile.departmentId) {
      throw new Error(
        `Access Denied: Department Admin for (${adminProfile.departmentId.toUpperCase()}) cannot view users of another department.`
      );
    }

    let allUsers = [];

    if (isFirebaseConfigured() && db) {
      try {
        const snap = await getDocs(collection(db, 'users'));
        allUsers = snap.docs.map((d) => {
          const data = d.data();
          const { password: _, ...clean } = data;
          return { uid: d.id, ...clean };
        });
      } catch (err) {
        console.error('Firestore getUsers error, falling back to local:', err);
      }
    }

    if (allUsers.length === 0) {
      const rawLocal = getRawLocalUsers();
      allUsers = Object.values(rawLocal).map((user) => {
        const { password: _, ...clean } = user;
        return clean;
      });
    }

    // Apply Department Isolation
    if (isDeptAdmin) {
      allUsers = allUsers.filter((u) => u.departmentId === adminProfile.departmentId);
    } else if (departmentId !== 'all') {
      allUsers = allUsers.filter((u) => u.departmentId === departmentId);
    }

    // Apply Role Filter
    if (role !== 'all') {
      allUsers = allUsers.filter((u) => u.role === role);
    }

    // Apply Search Term Filter
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      allUsers = allUsers.filter(
        (u) =>
          (u.displayName && u.displayName.toLowerCase().includes(term)) ||
          (u.email && u.email.toLowerCase().includes(term)) ||
          (u.role && u.role.toLowerCase().includes(term)) ||
          (u.departmentId && u.departmentId.toLowerCase().includes(term))
      );
    }

    return allUsers;
  },

  /**
   * Fetch platform-wide system configuration (Super Admin ONLY)
   * @param {Object} adminProfile - Authenticated administrator profile
   * @returns {Object} System configuration matrix
   */
  async getSystemConfiguration(adminProfile) {
    if (!adminProfile || adminProfile.role !== USER_ROLES.SUPER_ADMIN) {
      throw new Error('Access Denied: System configuration inspection is restricted to Super Administrators.');
    }

    return {
      municipalDepartments: Object.values(CATEGORIES),
      priorityLevels: Object.values(SEVERITY_LEVELS),
      grievanceStatuses: Object.values(COMPLAINT_STATUS),
      escalationLevels: Object.values(ESCALATION_LEVELS),
      slaWarningThresholds: SLA_WARNING_THRESHOLDS,
      governanceLimits: EXTENSION_LIMITS,
      version: 'CivicPulse v2.0.0 (Enterprise Governance)',
      environment: isFirebaseConfigured() ? 'Firebase Cloud Firestore' : 'Local Persistence Engine',
      generatedAt: new Date().toISOString(),
    };
  },

  // ==========================================
  // DATA GOVERNANCE & INTEGRITY VALIDATORS
  // ==========================================

  /**
   * Validates if a departmentId is recognized in the platform taxonomy
   * @param {string} departmentId
   * @returns {boolean}
   */
  validateDepartment(departmentId) {
    if (!departmentId || typeof departmentId !== 'string') {
      throw new Error('Data Governance Error: Department ID must be a non-empty string.');
    }
    const validIds = Object.values(CATEGORIES).map((c) => c.id);
    if (!validIds.includes(departmentId)) {
      throw new Error(
        `Data Governance Error: Invalid department ID "${departmentId}". Valid IDs: ${validIds.join(', ')}`
      );
    }
    return true;
  },

  /**
   * Validates user role and department consistency rules
   * Rules:
   * - OFFICER must have a valid departmentId.
   * - DEPARTMENT_ADMIN must have a valid departmentId.
   * - CITIZEN must have departmentId === null or undefined.
   * - SUPER_ADMIN must have departmentId === null or undefined.
   * @param {Object} userData - { role, departmentId }
   */
  validateUserRoleConsistency(userData) {
    if (!userData || !userData.role) {
      throw new Error('Data Governance Error: User role is required.');
    }

    const { role, departmentId } = userData;
    const validRoles = Object.values(USER_ROLES);

    if (!validRoles.includes(role)) {
      throw new Error(`Data Governance Error: Invalid role "${role}". Valid roles: ${validRoles.join(', ')}`);
    }

    if (role === USER_ROLES.OFFICER) {
      if (!departmentId) {
        throw new Error('Data Governance Error: Department Officers must be assigned to a valid departmentId.');
      }
      this.validateDepartment(departmentId);
    } else if (role === USER_ROLES.DEPARTMENT_ADMIN) {
      if (!departmentId) {
        throw new Error('Data Governance Error: Department Admins must be assigned to a valid departmentId.');
      }
      this.validateDepartment(departmentId);
    } else if (role === USER_ROLES.CITIZEN || role === USER_ROLES.SUPER_ADMIN) {
      if (departmentId !== null && departmentId !== undefined && departmentId !== '') {
        throw new Error(
          `Data Governance Error: Role "${role}" must not be tied to a specific departmentId.`
        );
      }
    }

    return true;
  },

  /**
   * Validates grievance schema integrity
   * @param {Object} grievanceData - { categoryId, departmentId, status, severity }
   */
  validateGrievanceData(grievanceData) {
    if (!grievanceData) {
      throw new Error('Data Governance Error: Grievance record payload is missing.');
    }

    // 1. Department / Category check
    const dept = grievanceData.departmentId || grievanceData.categoryId;
    this.validateDepartment(dept);

    // 2. Status check
    if (grievanceData.status) {
      const validStatuses = Object.values(COMPLAINT_STATUS);
      if (!validStatuses.includes(grievanceData.status)) {
        throw new Error(
          `Data Governance Error: Invalid grievance status "${grievanceData.status}". Valid statuses: ${validStatuses.join(', ')}`
        );
      }
    }

    // 3. Severity check
    if (grievanceData.severity) {
      const validSeverities = Object.values(SEVERITY_LEVELS);
      if (!validSeverities.includes(grievanceData.severity)) {
        throw new Error(
          `Data Governance Error: Invalid priority/severity "${grievanceData.severity}". Valid levels: ${validSeverities.join(', ')}`
        );
      }
    }

    return true;
  },

  /**
   * Run full data integrity check on existing store
   * @param {Object} adminProfile
   */
  async auditDataIntegrity(adminProfile) {
    if (!adminProfile || adminProfile.role !== USER_ROLES.SUPER_ADMIN) {
      throw new Error('Access Denied: Data integrity auditing is restricted to Super Administrators.');
    }

    const users = await this.getUsers(adminProfile);
    const grievances = await grievanceService.getDepartmentGrievances('all');

    const issues = [];

    // Audit users
    users.forEach((u) => {
      try {
        this.validateUserRoleConsistency(u);
      } catch (err) {
        issues.push({ type: 'USER_INCONSISTENCY', id: u.uid || u.email, message: err.message });
      }
    });

    // Audit grievances
    grievances.forEach((g) => {
      try {
        this.validateGrievanceData(g);
      } catch (err) {
        issues.push({ type: 'GRIEVANCE_INCONSISTENCY', id: g.id || g.grievanceId, message: err.message });
      }
    });

    return {
      healthy: issues.length === 0,
      totalUsersAudited: users.length,
      totalGrievancesAudited: grievances.length,
      issuesFound: issues.length,
      issues,
      auditedAt: new Date().toISOString(),
    };
  },
};
