/**
 * @file notificationService.js
 * @description Production Notification, Response Reminder & Controlled Escalation Service.
 * Implements deterministic notification delivery, RBAC filtering, hourly response reminders,
 * multi-stage post-SLA warning alerts (Warning 1 & Warning 2), controlled department escalation,
 * and persistent storage.
 */

import {
  doc,
  setDoc,
  updateDoc,
  getDocs,
  collection,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/firebaseConfig.js';
import { slaEngine } from './slaEngine.js';
import { auditLogService } from '../firebase/auditLogService.js';
import {
  USER_ROLES,
  COMPLAINT_STATUS,
  ESCALATION_LEVELS,
  NOTIFICATION_TYPES,
  NOTIFICATION_SEVERITY,
  AUDIT_ACTIONS,
} from '../../models/schema.js';

const LOCAL_NOTIFICATIONS_KEY = 'civicpulse_notifications_db';
const LOCAL_GRIEVANCES_KEY = 'civicpulse_grievances_db';

function getLocalNotifications() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_NOTIFICATIONS_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error loading local notifications:', err);
    return [];
  }
}

function saveLocalNotifications(list) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.error('Error saving local notifications:', err);
  }
}

function getLocalGrievances() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_GRIEVANCES_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function saveLocalGrievances(list) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_GRIEVANCES_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.error('Error saving local grievances:', err);
  }
}

export const notificationService = {
  /**
   * Retrieves notifications filtered strictly by RBAC rules and Department Isolation
   */
  async getNotifications(userProfile) {
    if (!userProfile) return [];

    let allNotifs = [];
    if (isFirebaseConfigured() && db) {
      try {
        const colRef = collection(db, 'notifications');
        const q = query(colRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        allNotifs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.error('Firestore getNotifications error:', err);
        allNotifs = getLocalNotifications();
      }
    } else {
      allNotifs = getLocalNotifications();
    }

    // Apply Security Layer RBAC Filtering
    const userRole = userProfile.role;
    const userDept = userProfile.departmentId;
    const userUid = userProfile.uid;

    const filtered = allNotifs.filter((n) => {
      // 1. Super Admin sees all notifications
      if (userRole === USER_ROLES.SUPER_ADMIN) {
        return true;
      }

      // 2. Department Admin sees notifications for their department or targeted to admins
      if (userRole === USER_ROLES.DEPARTMENT_ADMIN) {
        if (n.recipientUid && n.recipientUid === userUid) return true;
        if (n.departmentId && n.departmentId === userDept) {
          return ['DEPARTMENT_ADMIN', 'ADMIN', 'ALL'].includes(n.recipientRole);
        }
        return false;
      }

      // 3. Officer sees notifications for their department / targeted to officers
      if (userRole === USER_ROLES.OFFICER) {
        if (n.recipientUid && n.recipientUid === userUid) return true;
        if (n.departmentId && n.departmentId === userDept) {
          return ['OFFICER', 'ALL_OFFICERS', 'ALL'].includes(n.recipientRole);
        }
        return false;
      }

      // 4. Citizen sees notifications for their UID
      if (userRole === USER_ROLES.CITIZEN) {
        return n.recipientUid === userUid || (n.recipientRole === 'CITIZEN' && n.recipientUid === userUid);
      }

      return false;
    });

    // Sort newest first
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filtered;
  },

  /**
   * Create a single notification with idempotency check
   */
  async createNotification(data) {
    const id = data.notificationId || data.id || `NOTIF_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const notifList = getLocalNotifications();

    // Idempotency check: Return existing if notificationId already exists
    const existing = notifList.find((n) => n.notificationId === id || n.id === id);
    if (existing) {
      return existing;
    }

    const timestamp = data.createdAt || new Date().toISOString();
    const newNotif = {
      id,
      notificationId: id,
      grievanceId: data.grievanceId || '',
      complaintNumber: data.complaintNumber || data.grievanceId || '',
      recipientUid: data.recipientUid || null,
      recipientRole: data.recipientRole || 'OFFICER',
      departmentId: data.departmentId || 'roads',
      type: data.type || NOTIFICATION_TYPES.ASSIGNED,
      severity: data.severity || NOTIFICATION_SEVERITY.NORMAL,
      title: data.title || 'System Notification',
      message: data.message || '',
      createdAt: timestamp,
      readAt: null,
      isRead: false,
      relatedSlaDeadline: data.relatedSlaDeadline || null,
      escalationStage: typeof data.escalationStage === 'number' ? data.escalationStage : 0,
    };

    if (isFirebaseConfigured() && db) {
      try {
        await setDoc(doc(db, 'notifications', id), {
          ...newNotif,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Firestore setDoc notification error:', err);
      }
    }

    notifList.unshift(newNotif);
    saveLocalNotifications(notifList);

    return newNotif;
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId, userProfile) {
    const timestamp = new Date().toISOString();
    const notifList = getLocalNotifications();

    let updatedItem = null;
    const updatedList = notifList.map((n) => {
      if (n.id === notificationId || n.notificationId === notificationId) {
        updatedItem = {
          ...n,
          isRead: true,
          readAt: timestamp,
        };
        return updatedItem;
      }
      return n;
    });

    saveLocalNotifications(updatedList);

    if (isFirebaseConfigured() && db) {
      try {
        await updateDoc(doc(db, 'notifications', notificationId), {
          isRead: true,
          readAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Firestore markAsRead error:', err);
      }
    }

    return updatedItem;
  },

  /**
   * Mark all visible notifications for user as read
   */
  async markAllAsRead(userProfile) {
    if (!userProfile) return 0;
    const visibleNotifs = await this.getNotifications(userProfile);
    const visibleIds = new Set(visibleNotifs.map((n) => n.notificationId || n.id));

    const timestamp = new Date().toISOString();
    const notifList = getLocalNotifications();

    let count = 0;
    const updatedList = notifList.map((n) => {
      const id = n.notificationId || n.id;
      if (visibleIds.has(id) && !n.isRead) {
        count++;
        return { ...n, isRead: true, readAt: timestamp };
      }
      return n;
    });

    if (count > 0) {
      saveLocalNotifications(updatedList);
    }

    return count;
  },

  /**
   * Core Engine: Evaluates a grievance record against SLA, reminders, and controlled escalation stages.
   */
  async evaluateGrievanceNotifications(grievance, currentTime = new Date()) {
    if (!grievance) return null;

    // Terminal statuses do not generate response reminders/escalations
    if ([COMPLAINT_STATUS.VERIFIED_RESOLVED, COMPLAINT_STATUS.CLOSED, COMPLAINT_STATUS.REJECTED].includes(grievance.status)) {
      return null;
    }

    const complaintId = grievance.id || grievance.grievanceId;
    const deptId = grievance.departmentId;
    const responseEval = slaEngine.evaluateResponseSLA(grievance, currentTime);

    const createdTimeMillis = new Date(grievance.createdAt || Date.now()).getTime();
    const nowMillis = currentTime.getTime();

    // 1. Initial Officer Assignment Notification
    const assignedNotifId = `NOTIF_${complaintId}_ASSIGNED`;
    await this.createNotification({
      notificationId: assignedNotifId,
      grievanceId: complaintId,
      complaintNumber: complaintId,
      recipientRole: 'OFFICER',
      departmentId: deptId,
      type: NOTIFICATION_TYPES.ASSIGNED,
      severity: NOTIFICATION_SEVERITY.NORMAL,
      title: 'New complaint assigned',
      message: `Complaint ${complaintId} has been assigned to your department. Please review and acknowledge it.`,
      relatedSlaDeadline: grievance.responseSlaDue,
      escalationStage: 0,
    });

    // If officer has already acknowledged (SEEN or beyond), no further reminders/warnings are issued!
    if (grievance.seenAt || grievance.status !== COMPLAINT_STATUS.SUBMITTED) {
      return null;
    }

    // 2. Hourly Reminder System (while SUBMITTED & response SLA not breached)
    if (!responseEval.isBreached) {
      const hoursElapsed = Math.floor((nowMillis - createdTimeMillis) / (3600 * 1000));
      if (hoursElapsed >= 1) {
        const reminderNotifId = `NOTIF_${complaintId}_REMINDER_${hoursElapsed}`;
        const isUrgent = responseEval.thresholdStatus === 'WARNING' || responseEval.thresholdStatus === 'URGENT';
        await this.createNotification({
          notificationId: reminderNotifId,
          grievanceId: complaintId,
          complaintNumber: complaintId,
          recipientRole: 'OFFICER',
          departmentId: deptId,
          type: NOTIFICATION_TYPES.REMINDER,
          severity: isUrgent ? NOTIFICATION_SEVERITY.WARNING : NOTIFICATION_SEVERITY.NORMAL,
          title: 'Response reminder',
          message: `You have an unacknowledged complaint ${complaintId}. Please review and acknowledge it.`,
          relatedSlaDeadline: grievance.responseSlaDue,
          escalationStage: 0,
        });

        await auditLogService.logAction({
          grievanceId: complaintId,
          complaintNumber: complaintId,
          actorUid: 'SYSTEM_SCHEDULER',
          actorName: 'CivicPulse Governance Engine',
          actorRole: 'SYSTEM',
          departmentId: deptId,
          action: AUDIT_ACTIONS.RESPONSE_REMINDER_GENERATED,
          previousStatus: COMPLAINT_STATUS.SUBMITTED,
          newStatus: COMPLAINT_STATUS.SUBMITTED,
          details: `Hourly response reminder #${hoursElapsed} issued to ${deptId.toUpperCase()} officers for unacknowledged complaint ${complaintId}.`,
        });
      }
      return null;
    }

    // 3. Response SLA Breached — Warning 1 (CRITICAL - Red)
    const warning1Id = `NOTIF_${complaintId}_WARNING_1`;
    const allNotifs = getLocalNotifications();
    const warning1Exists = allNotifs.some((n) => n.notificationId === warning1Id || n.id === warning1Id);

    if (!warning1Exists) {
      await this.createNotification({
        notificationId: warning1Id,
        grievanceId: complaintId,
        complaintNumber: complaintId,
        recipientRole: 'OFFICER',
        departmentId: deptId,
        type: NOTIFICATION_TYPES.WARNING_1,
        severity: NOTIFICATION_SEVERITY.CRITICAL,
        title: 'Response SLA breached — Warning 1',
        message: `Complaint ${complaintId} has exceeded the response SLA. Please acknowledge and take action immediately.`,
        relatedSlaDeadline: grievance.responseSlaDue,
        escalationStage: 1,
      });

      await auditLogService.logAction({
        grievanceId: complaintId,
        complaintNumber: complaintId,
        actorUid: 'SYSTEM_GOVERNANCE',
        actorName: 'CivicPulse Governance Engine',
        actorRole: 'SYSTEM',
        departmentId: deptId,
        action: AUDIT_ACTIONS.WARNING_1_GENERATED,
        previousStatus: COMPLAINT_STATUS.SUBMITTED,
        newStatus: COMPLAINT_STATUS.SUBMITTED,
        details: `Response SLA breached for ${complaintId}. Issued Warning 1 (CRITICAL) to officer. Escalation Stage: 1.`,
      });

      return null;
    }

    // 4. Second Warning — Warning 2 (CRITICAL - Red)
    const warning2Id = `NOTIF_${complaintId}_WARNING_2`;
    const warning2Exists = allNotifs.some((n) => n.notificationId === warning2Id || n.id === warning2Id);

    if (!warning2Exists) {
      await this.createNotification({
        notificationId: warning2Id,
        grievanceId: complaintId,
        complaintNumber: complaintId,
        recipientRole: 'OFFICER',
        departmentId: deptId,
        type: NOTIFICATION_TYPES.WARNING_2,
        severity: NOTIFICATION_SEVERITY.CRITICAL,
        title: 'Final response warning — Warning 2',
        message: `Complaint ${complaintId} remains unacknowledged after the response SLA breach. Immediate action is required.`,
        relatedSlaDeadline: grievance.responseSlaDue,
        escalationStage: 2,
      });

      await auditLogService.logAction({
        grievanceId: complaintId,
        complaintNumber: complaintId,
        actorUid: 'SYSTEM_GOVERNANCE',
        actorName: 'CivicPulse Governance Engine',
        actorRole: 'SYSTEM',
        departmentId: deptId,
        action: AUDIT_ACTIONS.WARNING_2_GENERATED,
        previousStatus: COMPLAINT_STATUS.SUBMITTED,
        newStatus: COMPLAINT_STATUS.SUBMITTED,
        details: `Complaint ${complaintId} remains unacknowledged post-SLA breach. Issued Warning 2 (CRITICAL) to officer. Escalation Stage: 2.`,
      });

      return null;
    }

    // 5. Controlled Escalation (ESCALATED - Purple)
    // Occurs ONLY after Warning 1 AND Warning 2 have been issued and grievance remains unacknowledged!
    const escalatedNotifId = `NOTIF_${complaintId}_ESCALATED`;
    const escalatedNotifExists = allNotifs.some((n) => n.notificationId === escalatedNotifId || n.id === escalatedNotifId);

    if (!escalatedNotifExists) {
      // Escalate grievance in local storage
      const localGrievances = getLocalGrievances();
      const updatedGrievances = localGrievances.map((g) => {
        if (g.id === complaintId || g.grievanceId === complaintId) {
          return {
            ...g,
            escalationLevel: ESCALATION_LEVELS.DEPARTMENT_ESCALATED,
            escalationReason: `Complaint ${complaintId} was escalated because the assigned officer did not acknowledge it after the response SLA and two warning alerts.`,
            updatedAt: currentTime.toISOString(),
          };
        }
        return g;
      });
      saveLocalGrievances(updatedGrievances);

      // Create ESCALATED notification for Department Admin
      await this.createNotification({
        notificationId: escalatedNotifId,
        grievanceId: complaintId,
        complaintNumber: complaintId,
        recipientRole: 'DEPARTMENT_ADMIN',
        departmentId: deptId,
        type: NOTIFICATION_TYPES.ESCALATED,
        severity: NOTIFICATION_SEVERITY.ESCALATED,
        title: 'Complaint Escalated',
        message: `Complaint ${complaintId} was escalated because the assigned officer did not acknowledge it after the response SLA and two warning alerts.`,
        relatedSlaDeadline: grievance.responseSlaDue,
        escalationStage: 3,
      });

      await auditLogService.logAction({
        grievanceId: complaintId,
        complaintNumber: complaintId,
        actorUid: 'SYSTEM_GOVERNANCE',
        actorName: 'CivicPulse Governance Engine',
        actorRole: 'SYSTEM',
        departmentId: deptId,
        action: AUDIT_ACTIONS.COMPLAINT_ESCALATED,
        previousStatus: COMPLAINT_STATUS.SUBMITTED,
        newStatus: COMPLAINT_STATUS.SUBMITTED,
        details: `Controlled escalation triggered for ${complaintId}. Escalated to Department Admin (${deptId.toUpperCase()}) following 2 unacknowledged post-SLA warnings.`,
        metadata: {
          escalationLevel: ESCALATION_LEVELS.DEPARTMENT_ESCALATED,
          escalationStage: 3,
        },
      });
    }

    return null;
  },

  /**
   * Process all grievances in system to evaluate and refresh notifications
   */
  async processAllGrievances(userProfile, grievances = null) {
    const list = grievances || getLocalGrievances();
    for (const g of list) {
      await this.evaluateGrievanceNotifications(g);
    }
    return this.getNotifications(userProfile);
  },

  // --- Legacy Backwards Compatibility Methods ---
  async dispatchEscalationAlert({ grievanceId, targetRole, departmentId, escalationLevel, message }) {
    const id = `NOTIF_${grievanceId}_LEGACY_ESCALATED`;
    return this.createNotification({
      notificationId: id,
      grievanceId,
      complaintNumber: grievanceId,
      recipientRole: targetRole,
      departmentId,
      type: NOTIFICATION_TYPES.ESCALATED,
      severity: NOTIFICATION_SEVERITY.ESCALATED,
      title: 'Complaint Escalated',
      message: message || `Grievance #${grievanceId} escalated to ${targetRole}`,
    });
  },

  async dispatchSLAWarning({ grievanceId, recipientRole, message }) {
    const id = `NOTIF_${grievanceId}_SLA_WARN`;
    return this.createNotification({
      notificationId: id,
      grievanceId,
      complaintNumber: grievanceId,
      recipientRole: recipientRole || 'OFFICER',
      type: NOTIFICATION_TYPES.SLA_WARNING,
      severity: NOTIFICATION_SEVERITY.WARNING,
      title: 'SLA Warning Alert',
      message: message || `SLA Warning for complaint #${grievanceId}`,
    });
  },
};
