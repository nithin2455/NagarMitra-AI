/**
 * @file auditLogService.js
 * @description Production Immutable Audit Logging & System Accountability Service.
 * Records chronological, append-only administrative and operational actions across
 * the grievance lifecycle into Firestore (/audit_logs) and persistent audit storage.
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebaseConfig.js';
import { USER_ROLES, AUDIT_ACTIONS } from '../../models/schema.js';

const LOCAL_AUDIT_KEY = 'civicpulse_audit_logs';

/**
 * Retrieve local audit log repository from memory / localStorage
 */
function getLocalAuditLogs() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_AUDIT_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error reading local audit logs:', err);
    return [];
  }
}

/**
 * Append-only write to local audit log repository
 */
function appendLocalAuditLog(record) {
  try {
    const logs = getLocalAuditLogs();
    logs.unshift(record); // Prepend so newest is first
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(logs));
    }
  } catch (err) {
    console.error('Error saving local audit log:', err);
  }
}

export const auditLogService = {
  /**
   * Append an immutable audit record to the system ledger
   * @param {Object} logData
   * @returns {Promise<Object>} Created audit record
   */
  async logAction(logData) {
    const {
      grievanceId = null,
      complaintNumber = null,
      actorUid = 'SYSTEM',
      actorName = 'System Automated Engine',
      actorRole = 'system',
      departmentId = null,
      action,
      previousStatus = null,
      newStatus = null,
      details = '',
      metadata = {},
      timestamp = new Date().toISOString(),
    } = logData;

    if (!action) {
      console.warn('AuditLogService: Action is required for audit record creation.');
      return null;
    }

    const auditLogId = `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const record = {
      id: auditLogId,
      auditLogId,
      grievanceId,
      complaintNumber: complaintNumber || (grievanceId ? `CP-${grievanceId.slice(0, 8).toUpperCase()}` : null),
      actorUid,
      actorName,
      actorRole,
      departmentId,
      action,
      previousStatus,
      newStatus,
      timestamp,
      details,
      metadata: metadata || {},
    };

    // 1. Write to Firestore if configured
    if (isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, 'audit_logs', auditLogId);
        await setDoc(docRef, record);
      } catch (err) {
        console.error('Firestore audit logging error:', err);
      }
    }

    // 2. Append to local persistent ledger
    appendLocalAuditLog(record);

    return record;
  },

  /**
   * Query immutable audit logs with strict Role-Based Access Control (RBAC) & Department Isolation
   * @param {Object} adminProfile - User profile of the requesting administrator
   * @param {Object} filters - { departmentId, role, action, complaintId, dateRange, searchTerm }
   * @returns {Promise<Array>} Filtered chronological list of audit logs
   */
  async getAuditLogs(adminProfile, filters = {}) {
    // RBAC Security Check: Only Department Admin and Super Admin may access audit logs
    if (
      !adminProfile ||
      ![USER_ROLES.DEPARTMENT_ADMIN, USER_ROLES.SUPER_ADMIN].includes(adminProfile.role)
    ) {
      throw new Error('Access Denied: Administrative audit logs are restricted to authorized administrators.');
    }

    const {
      departmentId = 'all',
      role = 'all',
      action = 'all',
      complaintId = '',
      dateRange = 'all_time',
      searchTerm = '',
    } = filters;

    // Security Rule: Department Admin is strictly locked to their assigned department
    let targetDept = departmentId;
    if (adminProfile.role === USER_ROLES.DEPARTMENT_ADMIN) {
      if (departmentId !== 'all' && departmentId !== adminProfile.departmentId) {
        throw new Error(
          `Access Denied: Department Admin for (${adminProfile.departmentId.toUpperCase()}) cannot view audit logs for another department.`
        );
      }
      targetDept = adminProfile.departmentId;
    }

    let allLogs = [];

    // Fetch from Firestore or local storage
    if (isFirebaseConfigured() && db) {
      try {
        const colRef = collection(db, 'audit_logs');
        let q;
        if (targetDept !== 'all') {
          q = query(colRef, where('departmentId', '==', targetDept), orderBy('timestamp', 'desc'), limit(500));
        } else {
          q = query(colRef, orderBy('timestamp', 'desc'), limit(500));
        }
        const snap = await getDocs(q);
        allLogs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.error('Firestore getAuditLogs error, falling back to local:', err);
        allLogs = getLocalAuditLogs();
      }
    } else {
      allLogs = getLocalAuditLogs();
    }

    // Apply department filtering (for local fallback and in-memory precision)
    if (targetDept !== 'all') {
      allLogs = allLogs.filter((log) => log.departmentId === targetDept || log.departmentId === 'all');
    }

    // Apply Role Filter
    if (role !== 'all') {
      allLogs = allLogs.filter((log) => log.actorRole === role);
    }

    // Apply Action Filter
    if (action !== 'all') {
      allLogs = allLogs.filter((log) => log.action === action);
    }

    // Apply Complaint ID Filter
    if (complaintId.trim()) {
      const qId = complaintId.trim().toLowerCase();
      allLogs = allLogs.filter(
        (log) =>
          (log.grievanceId && log.grievanceId.toLowerCase().includes(qId)) ||
          (log.complaintNumber && log.complaintNumber.toLowerCase().includes(qId))
      );
    }

    // Apply Date Range Filter
    if (dateRange !== 'all_time') {
      const now = new Date();
      allLogs = allLogs.filter((log) => {
        if (!log.timestamp) return true;
        const logDate = new Date(log.timestamp);
        if (dateRange === 'today') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return logDate >= startOfToday;
        }
        if (dateRange === 'last_7_days') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return logDate >= sevenDaysAgo;
        }
        if (dateRange === 'last_30_days') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return logDate >= thirtyDaysAgo;
        }
        return true;
      });
    }

    // Apply Search Term Filter (Actor, Complaint Number, Details, Remarks)
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      allLogs = allLogs.filter(
        (log) =>
          (log.actorName && log.actorName.toLowerCase().includes(term)) ||
          (log.actorUid && log.actorUid.toLowerCase().includes(term)) ||
          (log.details && log.details.toLowerCase().includes(term)) ||
          (log.complaintNumber && log.complaintNumber.toLowerCase().includes(term)) ||
          (log.action && log.action.toLowerCase().includes(term))
      );
    }

    return allLogs;
  },

  /**
   * Immutability Enforcement: Block modification or deletion of audit logs
   */
  async updateAuditLog() {
    throw new Error('Forbidden: Audit logs are strictly immutable and cannot be updated.');
  },

  async deleteAuditLog() {
    throw new Error('Forbidden: Audit logs are strictly immutable and cannot be deleted.');
  },
};
