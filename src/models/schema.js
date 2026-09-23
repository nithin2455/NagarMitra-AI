/**
 * @file schema.js
 * @description Core entity definitions, status enums, role definitions, and governance constants
 * for the Smart Public Grievance & Issue Management Platform.
 */

export const USER_ROLES = {
  CITIZEN: 'citizen',
  OFFICER: 'officer',
  DEPARTMENT_ADMIN: 'department_admin',
  SUPER_ADMIN: 'super_admin',
};

export const COMPLAINT_STATUS = {
  SUBMITTED: 'SUBMITTED',
  SEEN: 'SEEN',
  VERIFIED: 'VERIFIED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLUTION_SUBMITTED: 'RESOLUTION_SUBMITTED',
  COMMUNITY_ACTION_SUBMITTED: 'COMMUNITY_ACTION_SUBMITTED',
  VERIFICATION: 'VERIFICATION',
  VERIFIED_RESOLVED: 'VERIFIED_RESOLVED',
  CLOSED: 'CLOSED',
  REJECTED: 'REJECTED',
  REOPENED: 'REOPENED',
};

export const COMPLAINT_VISIBILITY = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
  SENSITIVE: 'SENSITIVE',
};

export const EVIDENCE_VISIBILITY = {
  PUBLIC_EVIDENCE: 'PUBLIC_EVIDENCE',
  PRIVATE_EVIDENCE: 'PRIVATE_EVIDENCE',
  INTERNAL_EVIDENCE: 'INTERNAL_EVIDENCE',
};

export const SEVERITY_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

export const ESCALATION_LEVELS = {
  NOT_ESCALATED: 'NOT_ESCALATED',
  WARNING: 'WARNING',
  DEPARTMENT_ESCALATED: 'DEPARTMENT_ESCALATED',
  SUPER_ADMIN_ESCALATED: 'SUPER_ADMIN_ESCALATED',
  CRITICAL_ESCALATION: 'CRITICAL_ESCALATION',
  RESOLVED: 'RESOLVED',
};

export const SLA_WARNING_THRESHOLDS = {
  NORMAL: { minPercent: 0, maxPercent: 74, label: 'On Schedule', color: 'success' },
  WARNING: { minPercent: 75, maxPercent: 89, label: 'SLA Warning (75% Elapsed)', color: 'warning' },
  URGENT: { minPercent: 90, maxPercent: 99, label: 'Urgent SLA Warning (90% Elapsed)', color: 'danger' },
  BREACHED: { minPercent: 100, maxPercent: Infinity, label: 'SLA Breached (100% Elapsed)', color: 'danger' },
};

export const DEFAULT_VERIFICATION_SLA_HOURS = 24;

export const NOTIFICATION_TYPES = {
  ASSIGNED: 'ASSIGNED',
  REMINDER: 'REMINDER',
  WARNING_1: 'WARNING_1',
  WARNING_2: 'WARNING_2',
  ESCALATED: 'ESCALATED',
  SLA_WARNING: 'SLA_WARNING',
  STATUS_UPDATE: 'STATUS_UPDATE',
};

export const NOTIFICATION_SEVERITY = {
  NORMAL: 'NORMAL',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
  ESCALATED: 'ESCALATED',
};

export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  GRIEVANCE_CREATED: 'GRIEVANCE_CREATED',
  GRIEVANCE_ACKNOWLEDGED: 'GRIEVANCE_ACKNOWLEDGED',
  OFFICER_ASSIGNED: 'OFFICER_ASSIGNED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  RESOLUTION_SUBMITTED: 'RESOLUTION_SUBMITTED',
  RESOLUTION_REJECTED: 'RESOLUTION_REJECTED',
  RESOLUTION_VERIFIED: 'RESOLUTION_VERIFIED',
  GRIEVANCE_CLOSED: 'GRIEVANCE_CLOSED',
  SLA_ACTION: 'SLA_ACTION',
  SLA_EXTENSION_REQUESTED: 'SLA_EXTENSION_REQUESTED',
  SLA_EXTENSION_APPROVED: 'SLA_EXTENSION_APPROVED',
  SLA_EXTENSION_REJECTED: 'SLA_EXTENSION_REJECTED',
  NOTIFICATION_CREATED: 'NOTIFICATION_CREATED',
  RESPONSE_REMINDER_GENERATED: 'RESPONSE_REMINDER_GENERATED',
  SLA_BREACHED: 'SLA_BREACHED',
  WARNING_1_GENERATED: 'WARNING_1_GENERATED',
  WARNING_2_GENERATED: 'WARNING_2_GENERATED',
  COMPLAINT_ESCALATED: 'COMPLAINT_ESCALATED',
  GRIEVANCE_DUPLICATE_LINKED: 'GRIEVANCE_DUPLICATE_LINKED',
  MASTER_ISSUE_CONSOLIDATED: 'MASTER_ISSUE_CONSOLIDATED',
};

export const CATEGORIES = {
  ROADS: {
    id: 'roads',
    name: 'Road Damage & Potholes',
    departmentCode: 'DEPT_ROADS',
    departmentName: 'Roads & Infrastructure',
    defaultResponseHours: 12,
    defaultResolutionHours: 72,
    baseRiskScore: 75,
  },
  DRAINAGE: {
    id: 'drainage',
    name: 'Drainage & Sewage Overflow',
    departmentCode: 'DEPT_DRAINAGE',
    departmentName: 'Drainage & Sewerage',
    defaultResponseHours: 6,
    defaultResolutionHours: 24,
    baseRiskScore: 80,
  },
  GARBAGE: {
    id: 'garbage',
    name: 'Garbage & Waste Disposal',
    departmentCode: 'DEPT_SANITATION',
    departmentName: 'Sanitation & Solid Waste',
    defaultResponseHours: 12,
    defaultResolutionHours: 36,
    baseRiskScore: 50,
  },
  WATER: {
    id: 'water',
    name: 'Water Supply Contamination / Burst',
    departmentCode: 'DEPT_WATER',
    departmentName: 'Water Supply & Quality',
    defaultResponseHours: 4,
    defaultResolutionHours: 18,
    baseRiskScore: 90,
  },
  STREETLIGHTS: {
    id: 'streetlights',
    name: 'Streetlights & Electrical Hazards',
    departmentCode: 'DEPT_ELECTRICITY',
    departmentName: 'Electricity & Streetlights',
    defaultResponseHours: 4,
    defaultResolutionHours: 24,
    baseRiskScore: 90,
  },
  INFRASTRUCTURE: {
    id: 'infrastructure',
    name: 'Public Infrastructure Damage',
    departmentCode: 'DEPT_WORKS',
    departmentName: 'Public Works & Infrastructure',
    defaultResponseHours: 24,
    defaultResolutionHours: 168, // 7 days
    baseRiskScore: 60,
  },
  OTHER: {
    id: 'other',
    name: 'Other / New Issue',
    departmentCode: 'DEPT_GENERAL',
    departmentName: 'General Municipal Operations',
    defaultResponseHours: 12,
    defaultResolutionHours: 48,
    baseRiskScore: 40,
  },
};

export const SEVERITY_MULTIPLIERS = {
  CRITICAL: 0.25,
  HIGH: 0.5,
  MEDIUM: 1.0,
  LOW: 1.5,
};

export const EXTENSION_LIMITS = {
  MAX_EXTENSIONS_PER_COMPLAINT: 2,
  FIRST_EXTENSION_MAX_HOURS: 24,
  SECOND_EXTENSION_REQUIRES_SUPER_ADMIN: true,
  FOLLOWUP_ESCALATION_THRESHOLD: 3, // Unique citizen follow-ups triggering higher authority review
};

/**
 * Entity schema templates for Firestore documents
 */
export const EntitySchemas = {
  User: {
    uid: '',
    email: '',
    displayName: '',
    role: USER_ROLES.CITIZEN,
    departmentId: null,
    accountStatus: 'active',
    phone: '',
    createdAt: null,
  },
  Department: {
    id: '',
    name: '',
    code: '',
    headAdminId: '',
    defaultResponseHours: 12,
    defaultResolutionHours: 48,
  },
  Complaint: {
    id: '',
    grievanceId: '',
    citizenId: '',
    citizenName: '',
    citizenEmail: '',
    title: '',
    description: '',
    categoryId: 'roads',
    customCategory: '',
    departmentId: 'roads',
    departmentName: 'Roads & Infrastructure',
    departmentCode: 'DEPT_ROADS',
    assignedOfficerId: null,
    visibility: COMPLAINT_VISIBILITY.PUBLIC,
    isSensitive: false,
    status: COMPLAINT_STATUS.SUBMITTED,
    severity: SEVERITY_LEVELS.MEDIUM,
    priorityScore: 0,
    priorityLevel: 'MEDIUM',
    location: {
      address: '',
      landmark: '',
      ward: '',
      generalizedLocation: '',
      lat: null,
      lng: null,
    },
    mediaUrls: [],
    supportCount: 0,
    followUpCount: 0,
    responseSlaHours: 12,
    resolutionSlaHours: 72,
    verificationSlaHours: 24,
    responseSlaDue: null,
    resolutionSlaDue: null,
    verificationSlaDue: null,
    seenAt: null,
    verificationSubmittedAt: null,
    verifiedResolvedAt: null,
    closedAt: null,
    closedById: null,
    closedByName: '',
    closureRemarks: '',
    extensionCount: 0,
    extensionHistory: [],
    escalationLevel: ESCALATION_LEVELS.NOT_ESCALATED,
    escalationReason: '',
    // Master Issue & Multimodal Duplicate Grouping Fields
    isMasterIssue: true,
    masterComplaintId: '',
    duplicateGroupId: '',
    isDuplicate: false,
    reportCount: 1,
    duplicateCount: 0,
    uniqueCitizenCount: 1,
    duplicateMatchConfidence: 0,
    duplicateMatchSignals: null,
    createdAt: null,
    updatedAt: null,
  },
  SLAExtension: {
    id: '',
    grievanceId: '',
    requestedByOfficerId: '',
    requestedByOfficerName: '',
    requestedHours: 0,
    reason: '',
    previousDeadline: null,
    proposedDeadline: null,
    status: 'PENDING', // PENDING, APPROVED, REJECTED
    reviewedByAdminId: null,
    reviewedByAdminName: '',
    adminRemarks: '',
    createdAt: null,
    reviewedAt: null,
  },
  Resolution: {
    id: '',
    grievanceId: '',
    submittedByType: 'OFFICER', // OFFICER | COMMUNITY
    submittedById: '',
    submittedByName: '',
    remarks: '',
    beforeMediaUrls: [],
    afterMediaUrls: [],
    evidenceVisibility: EVIDENCE_VISIBILITY.PUBLIC_EVIDENCE,
    submittedAt: null,
    verificationStatus: 'PENDING_VERIFICATION', // PENDING_VERIFICATION | VERIFIED | REJECTED
    verifiedById: null,
    verifiedByName: '',
    rejectionReason: '',
    verifiedAt: null,
  },
  AuditLog: {
    id: '',
    auditLogId: '',
    grievanceId: null,
    complaintNumber: null,
    actorUid: '',
    actorName: '',
    actorRole: '',
    departmentId: null,
    action: '',
    previousStatus: null,
    newStatus: null,
    timestamp: null,
    details: '',
    metadata: {},
  },
  Notification: {
    id: '',
    notificationId: '',
    grievanceId: '',
    complaintNumber: '',
    recipientUid: null,
    recipientRole: 'OFFICER',
    departmentId: 'roads',
    type: 'ASSIGNED',
    severity: 'NORMAL',
    title: '',
    message: '',
    createdAt: null,
    readAt: null,
    isRead: false,
    relatedSlaDeadline: null,
    escalationStage: 0,
  },
};
