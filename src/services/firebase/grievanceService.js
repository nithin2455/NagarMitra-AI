/**
 * @file grievanceService.js
 * @description Production Grievance Management & Governance Service.
 * Implements deterministic department routing, dynamic dual-clock SLA calculation,
 * multi-factor priority scoring, hierarchical escalation, extension governance,
 * verification gates, community transparency, privacy-preserving feed, and real-time Firestore synchronization.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebaseConfig.js';
import { storageService } from './storageService.js';
import { slaEngine } from '../governance/slaEngine.js';
import { priorityEngine } from '../governance/priorityEngine.js';
import { escalationEngine } from '../governance/escalationEngine.js';
import { firestoreService } from './firestoreService.js';
import { auditLogService } from './auditLogService.js';
import { notificationService } from '../governance/notificationService.js';
import {
  CATEGORIES,
  SEVERITY_LEVELS,
  COMPLAINT_STATUS,
  COMPLAINT_VISIBILITY,
  EVIDENCE_VISIBILITY,
  ESCALATION_LEVELS,
  EXTENSION_LIMITS,
  USER_ROLES,
  AUDIT_ACTIONS,
} from '../../models/schema.js';
import { duplicateDetectionService } from '../ai/duplicateDetectionService.js';
import { severityPredictionService } from '../ai/severityPredictionService.js';
import { slaPredictionService } from '../ai/slaPredictionService.js';

// Local storage keys for offline persistent store
const LOCAL_GRIEVANCES_KEY = 'civicpulse_grievances_db';
const LOCAL_ID_COUNTER_KEY = 'civicpulse_id_counter';
const LOCAL_EXTENSIONS_KEY = 'civicpulse_extensions_db';
const LOCAL_VOTES_KEY = 'civicpulse_user_votes_db';

/**
 * Helper to generalize location for public privacy
 */
const getGeneralizedLocation = (landmark, ward) => {
  if (landmark && landmark.trim()) {
    return `${landmark.trim()}, ${ward.trim()}`;
  }
  return ward.trim();
};

/**
 * Helper to get local grievances store
 */
const getLocalGrievances = () => {
  try {
    const raw = localStorage.getItem(LOCAL_GRIEVANCES_KEY);
    if (!raw) {
      const now = Date.now();
      const initial = [
        {
          id: 'CP-2026-0001',
          grievanceId: 'CP-2026-0001',
          citizenId: 'cp-citizen-usr-01',
          citizenName: 'Aarav Sharma',
          citizenEmail: 'citizen@civicpulse.org',
          title: 'Major Water Main Burst on 5th Cross Road',
          description: 'Continuous high-pressure water pipe leakage flooding road and causing water supply cutoff in Block B.',
          categoryId: 'water',
          customCategory: '',
          departmentId: 'water',
          departmentName: 'Water Supply & Quality',
          departmentCode: 'DEPT_WATER',
          visibility: COMPLAINT_VISIBILITY.PUBLIC,
          isSensitive: false,
          status: COMPLAINT_STATUS.IN_PROGRESS,
          severity: SEVERITY_LEVELS.HIGH,
          priorityScore: 78.5,
          priorityLevel: 'HIGH',
          ward: 'Ward 4 - North Zone',
          landmark: 'Near Central Park West Gate',
          location: {
            address: '5th Cross Road, Ward 4',
            landmark: 'Near Central Park West Gate',
            ward: 'Ward 4 - North Zone',
            generalizedLocation: 'Near Central Park West Gate, Ward 4 - North Zone',
            lat: 12.9716,
            lng: 77.5946,
          },
          mediaUrls: [],
          supportCount: 14,
          followUpCount: 2,
          responseSlaHours: 2,
          resolutionSlaHours: 9,
          verificationSlaHours: 24,
          responseSlaDue: new Date(now - 3600000 * 2).toISOString(),
          resolutionSlaDue: new Date(now + 3600000 * 12).toISOString(),
          verificationSlaDue: null,
          seenAt: new Date(now - 3600000 * 4).toISOString(),
          verificationSubmittedAt: null,
          verifiedResolvedAt: null,
          assignedOfficerId: 'cp-officer-usr-01',
          extensionCount: 0,
          extensionHistory: [],
          escalationLevel: ESCALATION_LEVELS.NOT_ESCALATED,
          escalationReason: '',
          createdAt: new Date(now - 3600000 * 5).toISOString(),
          updatedAt: new Date(now - 3600000 * 1).toISOString(),
        },
        {
          id: 'CP-2026-0002',
          grievanceId: 'CP-2026-0002',
          citizenId: 'cp-citizen-usr-01',
          citizenName: 'Aarav Sharma',
          citizenEmail: 'citizen@civicpulse.org',
          title: 'Deep Sinkhole Forming Near Bus Terminal Junction',
          description: 'Major road subsidence on primary transit lane creating acute hazard for morning commuter buses.',
          categoryId: 'roads',
          customCategory: '',
          departmentId: 'roads',
          departmentName: 'Roads & Infrastructure',
          departmentCode: 'DEPT_ROADS',
          visibility: COMPLAINT_VISIBILITY.PUBLIC,
          isSensitive: false,
          status: COMPLAINT_STATUS.SUBMITTED,
          severity: SEVERITY_LEVELS.CRITICAL,
          priorityScore: 92.0,
          priorityLevel: 'CRITICAL',
          ward: 'Ward 8 - Central Zone',
          landmark: 'Opposite City Bus Stand Platform 3',
          location: {
            address: 'Bus Stand Junction, Ward 8',
            landmark: 'Opposite Platform 3',
            ward: 'Ward 8 - Central Zone',
            generalizedLocation: 'Opposite Platform 3, Ward 8 - Central Zone',
            lat: 12.978,
            lng: 77.59,
          },
          mediaUrls: [],
          supportCount: 34,
          followUpCount: 4,
          responseSlaHours: 3,
          resolutionSlaHours: 18,
          verificationSlaHours: 24,
          responseSlaDue: new Date(now + 3600000 * 2).toISOString(),
          resolutionSlaDue: new Date(now + 3600000 * 16).toISOString(),
          verificationSlaDue: null,
          seenAt: null,
          verificationSubmittedAt: null,
          verifiedResolvedAt: null,
          assignedOfficerId: null,
          extensionCount: 0,
          extensionHistory: [],
          escalationLevel: ESCALATION_LEVELS.DEPARTMENT_ESCALATED,
          escalationReason: 'Community follow-up threshold reached (4 citizen "Still Not Resolved" signals).',
          createdAt: new Date(now - 3600000 * 1).toISOString(),
          updatedAt: new Date(now - 3600000 * 1).toISOString(),
        },
      ];
      localStorage.setItem(LOCAL_GRIEVANCES_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const saveLocalGrievances = (list) => {
  localStorage.setItem(LOCAL_GRIEVANCES_KEY, JSON.stringify(list));
};

const getLocalExtensions = () => {
  try {
    const raw = localStorage.getItem(LOCAL_EXTENSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalExtensions = (list) => {
  localStorage.setItem(LOCAL_EXTENSIONS_KEY, JSON.stringify(list));
};

const getLocalVotes = () => {
  try {
    const raw = localStorage.getItem(LOCAL_VOTES_KEY);
    return raw ? JSON.parse(raw) : { supports: {}, followups: {} };
  } catch {
    return { supports: {}, followups: {} };
  }
};

const saveLocalVotes = (votes) => {
  localStorage.setItem(LOCAL_VOTES_KEY, JSON.stringify(votes));
};

export const grievanceService = {
  /**
   * Deterministic category-to-department routing
   */
  getDepartmentForCategory(categoryId) {
    const key = (categoryId || 'other').toUpperCase();
    const config = CATEGORIES[key] || CATEGORIES.OTHER;
    return {
      departmentId: config.id,
      departmentName: config.departmentName,
      departmentCode: config.departmentCode,
      baseResponseHours: config.defaultResponseHours,
      baseResolutionHours: config.defaultResolutionHours,
    };
  },

  /**
   * Calculate dynamic Response and Resolution SLA
   */
  calculateSLA(categoryId, severity = SEVERITY_LEVELS.MEDIUM) {
    return slaEngine.calculateInitialSLA(categoryId, severity);
  },

  /**
   * Calculate multi-factor priority score
   */
  calculatePriorityScore(severity, categoryId, supportCount = 0, followUpCount = 0, createdAt = new Date(), escalationLevel = ESCALATION_LEVELS.NOT_ESCALATED, isResolutionBreached = false) {
    const result = priorityEngine.calculatePriority({
      severity,
      categoryId,
      supportCount,
      followUpCount,
      createdAt,
      escalationLevel,
      isResolutionBreached,
    });
    return result.priorityScore;
  },

  /**
   * Generate next sequential unique Grievance ID (CP-YYYY-XXXX)
   */
  generateGrievanceId() {
    const currentYear = new Date().getFullYear();
    try {
      let counter = Number(localStorage.getItem(LOCAL_ID_COUNTER_KEY) || 2);
      counter += 1;
      localStorage.setItem(LOCAL_ID_COUNTER_KEY, String(counter));
      const padded = String(counter).padStart(4, '0');
      return `CP-${currentYear}-${padded}`;
    } catch {
      const rand = Math.floor(1000 + Math.random() * 9000);
      return `CP-${currentYear}-${rand}`;
    }
  },

  /**
   * Validate submission payload
   */
  validateSubmission(data) {
    if (!data.title || !data.title.trim()) {
      throw new Error('Grievance title is required.');
    }
    if (!data.description || !data.description.trim()) {
      throw new Error('Detailed description is required.');
    }
    if (!data.categoryId) {
      throw new Error('Grievance category is required.');
    }
    if (data.categoryId === 'other' && (!data.customCategory || !data.customCategory.trim())) {
      throw new Error('Please specify the custom category description.');
    }
    if (!data.ward || !data.ward.trim()) {
      throw new Error('Municipal Ward / Zone is required.');
    }
  },

  /**
   * Check existing issues for duplicate assistance before submission
   */
  async checkExistingIssues({ categoryId, ward, searchKeyword }) {
    const publicIssues = await this.getPublicGrievances(categoryId || 'all', ward || 'all');
    if (!searchKeyword || !searchKeyword.trim()) {
      return publicIssues.slice(0, 5);
    }
    const term = searchKeyword.trim().toLowerCase();
    return publicIssues
      .filter(
        (issue) =>
          issue.title.toLowerCase().includes(term) ||
          issue.description.toLowerCase().includes(term) ||
          (issue.ward && issue.ward.toLowerCase().includes(term))
      )
      .slice(0, 5);
  },

  /**
   * Submit a new citizen grievance
   */
  async createGrievance(citizenUser, formData, evidenceFiles = []) {
    if (!citizenUser || !citizenUser.uid) {
      throw new Error('You must be authenticated to submit a grievance.');
    }

    this.validateSubmission(formData);

    const generatedId = this.generateGrievanceId();
    const sla = slaEngine.calculateInitialSLA(formData.categoryId, formData.severity);
    const priorityResult = priorityEngine.calculatePriority({
      severity: formData.severity || SEVERITY_LEVELS.MEDIUM,
      categoryId: formData.categoryId,
    });

    let mediaUrls = [];
    if (evidenceFiles && evidenceFiles.length > 0) {
      mediaUrls = await storageService.uploadEvidenceFiles(evidenceFiles, `complaints/${generatedId}`);
    }

    // 3-Tier Visibility Resolution
    let visibility = COMPLAINT_VISIBILITY.PUBLIC;
    if (formData.visibility) {
      visibility = formData.visibility;
    } else if (formData.isSensitive) {
      visibility = COMPLAINT_VISIBILITY.SENSITIVE;
    }

    const generalizedLoc = getGeneralizedLocation(formData.landmark, formData.ward);

    // AI Component 2 Candidate Retrieval (Scalable department candidate pool)
    const existingDeptComplaints = await this.getDepartmentGrievances(sla.departmentId);
    const candidateMasters = existingDeptComplaints.filter(
      (g) => (g.isMasterIssue || !g.isDuplicate) && g.status !== COMPLAINT_STATUS.CLOSED
    );

    const prepNewComplaint = {
      id: generatedId,
      title: formData.title.trim(),
      description: formData.description.trim(),
      categoryId: formData.categoryId,
      departmentId: sla.departmentId,
      lat: formData.lat || null,
      lng: formData.lng || null,
      mediaUrls,
    };

    const duplicateCheckRes = await duplicateDetectionService.findDuplicateMasterMatch({
      newComplaint: prepNewComplaint,
      candidateMasters,
    });

    const isDup = Boolean(duplicateCheckRes.hasMatch && duplicateCheckRes.match);
    const match = isDup ? duplicateCheckRes.match : null;

    const masterId = match ? match.matchedMasterId : null;
    const groupId = match ? match.duplicateGroupId : `GRP-${generatedId}`;

    // AI Component 4 Severity Prediction
    let aiSeverityRes = null;
    try {
      aiSeverityRes = await severityPredictionService.predictSeverity({
        title: formData.title.trim(),
        description: formData.description.trim(),
        category_id: formData.categoryId,
        department_code: sla.departmentCode,
        district: 'Chennai Central',
      });
    } catch (err) {
      console.warn('AI Severity prediction failed during creation:', err);
    }

    // AI Component 5 SLA Breach Prediction
    let aiSlaRes = null;
    try {
      aiSlaRes = await slaPredictionService.predictSLABreach({
        title: formData.title.trim(),
        description: formData.description.trim(),
        category_id: formData.categoryId,
        department_id: sla.departmentId,
        predicted_severity: aiSeverityRes ? aiSeverityRes.predicted_severity : (formData.severity || 'MEDIUM'),
        severity_probabilities: aiSeverityRes ? aiSeverityRes.class_probabilities : {},
        master_issue_count_at_submission: isDup ? (match.reportCount || 1) : 1,
        support_count_at_submission: 0,
        hotspot_score_at_submission: 0.0,
        density_score_at_submission: 0.0,
        is_hotspot_area: 0,
        response_sla_hours: sla.responseSlaHours,
        latitude: formData.lat || 13.0827,
        longitude: formData.lng || 80.2707,
      });
    } catch (err) {
      console.warn('AI SLA breach prediction failed during creation:', err);
    }

    const newGrievance = {
      id: generatedId,
      grievanceId: generatedId,
      citizenId: citizenUser.uid,
      citizenName: citizenUser.displayName || 'Citizen',
      citizenEmail: citizenUser.email || '',
      title: formData.title.trim(),
      description: formData.description.trim(),
      categoryId: formData.categoryId,
      customCategory: formData.customCategory ? formData.customCategory.trim() : '',
      departmentId: sla.departmentId,
      departmentName: sla.departmentName,
      departmentCode: sla.departmentCode,
      ward: formData.ward.trim(),
      landmark: formData.landmark ? formData.landmark.trim() : '',
      visibility,
      isSensitive: visibility === COMPLAINT_VISIBILITY.SENSITIVE || Boolean(formData.isSensitive),
      location: {
        address: formData.landmark ? `${formData.landmark}, ${formData.ward}` : formData.ward,
        landmark: formData.landmark || '',
        ward: formData.ward,
        generalizedLocation: generalizedLoc,
        lat: formData.lat || null,
        lng: formData.lng || null,
      },
      severity: formData.severity || SEVERITY_LEVELS.MEDIUM,
      status: COMPLAINT_STATUS.SUBMITTED,
      priorityScore: priorityResult.priorityScore,
      priorityLevel: priorityResult.priorityLevel,
      mediaUrls,
      supportCount: 0,
      followUpCount: 0,
      responseSlaHours: sla.responseSlaHours,
      resolutionSlaHours: sla.resolutionSlaHours,
      verificationSlaHours: sla.verificationSlaHours,
      responseSlaDue: sla.responseSlaDue,
      resolutionSlaDue: sla.resolutionSlaDue,
      verificationSlaDue: null,
      seenAt: null,
      verificationSubmittedAt: null,
      verifiedResolvedAt: null,
      assignedOfficerId: null,
      extensionCount: 0,
      extensionHistory: [],
      escalationLevel: ESCALATION_LEVELS.NOT_ESCALATED,
      escalationReason: '',
      // AI Component 2 Duplicate Consolidation Metadata
      isMasterIssue: !isDup,
      masterComplaintId: masterId,
      duplicateGroupId: groupId,
      isDuplicate: isDup,
      reportCount: 1,
      duplicateCount: 0,
      uniqueCitizenCount: 1,
      duplicateMatchConfidence: isDup ? match.confidence : null,
      duplicateMatchSignals: isDup ? match.signals : null,

      // AI Component 4 Severity Prediction Metadata
      aiSeverityPrediction: aiSeverityRes
        ? {
            predictedSeverity: aiSeverityRes.predicted_severity,
            confidence: aiSeverityRes.confidence,
            recommendedAction: aiSeverityRes.recommended_action,
            classProbabilities: aiSeverityRes.class_probabilities,
            isFallback: Boolean(aiSeverityRes.isFallback),
            predictedAt: new Date().toISOString(),
          }
        : null,
      isSeverityOverridden: aiSeverityRes
        ? formData.severity !== aiSeverityRes.predicted_severity
        : false,

      // AI Component 5 SLA Breach Prediction Metadata
      aiSlaPrediction: aiSlaRes
        ? {
            breachProbability: aiSlaRes.breach_probability,
            predictedBreach: aiSlaRes.predicted_breach,
            riskLevel: aiSlaRes.risk_level,
            thresholdLowMedium: aiSlaRes.threshold_low_medium,
            thresholdMediumHigh: aiSlaRes.threshold_medium_high,
            topFactors: aiSlaRes.top_factors,
            modelVersion: aiSlaRes.model_version,
            isFallback: Boolean(aiSlaRes.isFallback),
            predictedAt: new Date().toISOString(),
          }
        : null,

      aiClassification: formData.aiClassification
        ? {
            category: formData.aiClassification.category || 'other',
            department: formData.aiClassification.department || 'other',
            confidence: typeof formData.aiClassification.confidence === 'number' ? formData.aiClassification.confidence : 0.0,
            modelVersion: formData.aiClassification.modelVersion || '1.0.0',
            predictedAt: new Date().toISOString(),
          }
        : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured() && db) {
      await setDoc(doc(db, 'complaints', generatedId), {
        ...newGrievance,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const localList = getLocalGrievances();

    // If duplicate match, increment Master Issue counters
    if (isDup && masterId) {
      const masterIdx = localList.findIndex((g) => g.id === masterId || g.grievanceId === masterId);
      if (masterIdx !== -1) {
        const masterObj = localList[masterIdx];
        const newReportCount = (masterObj.reportCount || 1) + 1;
        const newDuplicateCount = (masterObj.duplicateCount || 0) + 1;
        
        // Boost Master priority score based on multiple citizen reports
        const newPriorityScore = Math.min(100.0, (masterObj.priorityScore || 50) + 5.0);

        localList[masterIdx] = {
          ...masterObj,
          reportCount: newReportCount,
          duplicateCount: newDuplicateCount,
          priorityScore: newPriorityScore,
          updatedAt: new Date().toISOString(),
        };

        if (isFirebaseConfigured() && db) {
          try {
            await updateDoc(doc(db, 'complaints', masterId), {
              reportCount: newReportCount,
              duplicateCount: newDuplicateCount,
              priorityScore: newPriorityScore,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            console.error('Firestore master update error:', err);
          }
        }
      }
    }

    localList.unshift(newGrievance);
    saveLocalGrievances(localList);

    await auditLogService.logAction({
      grievanceId: generatedId,
      complaintNumber: generatedId,
      actorUid: citizenUser.uid,
      actorName: citizenUser.displayName || 'Citizen Submitter',
      actorRole: citizenUser.role || USER_ROLES.CITIZEN,
      departmentId: sla.departmentId,
      action: AUDIT_ACTIONS.GRIEVANCE_CREATED,
      previousStatus: 'NONE',
      newStatus: COMPLAINT_STATUS.SUBMITTED,
      details: `Grievance intake logged (${visibility}). Assigned to ${sla.departmentName}. Response SLA: ${sla.responseSlaHours}h, Resolution SLA: ${sla.resolutionSlaHours}h.`,
      metadata: {
        title: (formData.title || '').trim(),
        categoryId: formData.categoryId,
        severity: formData.severity || SEVERITY_LEVELS.MEDIUM,
        visibility,
      },
    });

    if (isDup && masterId) {
      await auditLogService.logAction({
        grievanceId: generatedId,
        complaintNumber: generatedId,
        actorUid: citizenUser.uid,
        actorName: citizenUser.displayName || 'AI Multimodal Deduplication Engine',
        actorRole: USER_ROLES.CITIZEN,
        departmentId: sla.departmentId,
        action: AUDIT_ACTIONS.GRIEVANCE_DUPLICATE_LINKED,
        previousStatus: COMPLAINT_STATUS.SUBMITTED,
        newStatus: COMPLAINT_STATUS.SUBMITTED,
        details: `Multimodal AI detected real-world duplicate issue. Linked complaint #${generatedId} to Master Issue #${masterId} (Group ${groupId}) with ${(match.confidence * 100).toFixed(1)}% confidence.`,
        metadata: {
          masterComplaintId: masterId,
          duplicateGroupId: groupId,
          confidence: match.confidence,
          signals: match.signals,
        },
      });
    }

    try {
      await notificationService.evaluateGrievanceNotifications(newGrievance);
    } catch (err) {
      console.error('Error triggering initial assignment notification:', err);
    }

    return newGrievance;
  },

  /**
   * Fetch all citizen reports linked to a Master Issue
   */
  async getDuplicatesForMaster(masterComplaintId) {
    if (!masterComplaintId) return [];

    if (isFirebaseConfigured() && db) {
      try {
        const colRef = collection(db, 'complaints');
        const q = query(colRef, where('masterComplaintId', '==', masterComplaintId), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.error('Firestore getDuplicatesForMaster error:', err);
      }
    }

    const localList = getLocalGrievances();
    return localList.filter((g) => g.masterComplaintId === masterComplaintId);
  },

  /**
   * Fetch single grievance by ID with live governance evaluation and privacy filters
   */
  async getGrievanceById(id, requestingUser = null) {
    const trimmedId = (id || '').trim().toUpperCase();
    let record = null;

    if (isFirebaseConfigured() && db) {
      try {
        const snap = await getDoc(doc(db, 'complaints', trimmedId));
        if (snap.exists()) {
          record = { id: snap.id, ...snap.data() };
        }
      } catch (err) {
        console.error('Firestore getDoc error:', err);
      }
    }

    if (!record) {
      const localList = getLocalGrievances();
      record = localList.find(
        (g) => (g.grievanceId && g.grievanceId.toUpperCase() === trimmedId) || (g.id && g.id.toUpperCase() === trimmedId)
      );
    }

    if (!record) return null;

    // Evaluate live governance clocks and escalations
    const escalationEval = escalationEngine.evaluateEscalation(record);
    const resolutionEval = slaEngine.evaluateResolutionSLA(record);
    const priorityResult = priorityEngine.calculatePriority({
      severity: record.severity,
      categoryId: record.categoryId,
      supportCount: record.supportCount,
      followUpCount: record.followUpCount,
      createdAt: record.createdAt,
      escalationLevel: escalationEval.level,
      isResolutionBreached: resolutionEval.isBreached,
    });

    record.escalationLevel = escalationEval.level;
    record.escalationReason = escalationEval.reason;
    record.priorityScore = priorityResult.priorityScore;
    record.priorityLevel = priorityResult.priorityLevel;

    // Check privacy boundaries if requestingUser is provided
    if (requestingUser) {
      const isOwner = requestingUser.uid === record.citizenId;
      const isSuperAdmin = requestingUser.role === USER_ROLES.SUPER_ADMIN;
      const isDeptAdmin =
        requestingUser.role === USER_ROLES.DEPARTMENT_ADMIN && requestingUser.departmentId === record.departmentId;
      const isDeptOfficer =
        requestingUser.role === USER_ROLES.OFFICER && requestingUser.departmentId === record.departmentId;

      const isAuthorizedOfficial = isSuperAdmin || isDeptAdmin || isDeptOfficer;

      // If sensitive or private and not authorized, reject access
      if ((record.visibility === COMPLAINT_VISIBILITY.SENSITIVE || record.isSensitive) && !isOwner && !isAuthorizedOfficial) {
        throw new Error('Access Denied: You are not authorized to view this confidential grievance.');
      }
      if (record.visibility === COMPLAINT_VISIBILITY.PRIVATE && !isOwner && !isAuthorizedOfficial) {
        throw new Error('Access Denied: This private grievance is restricted to the submitter and department authorities.');
      }
    }

    return record;
  },

  /**
   * Fetch grievances submitted by a specific citizen UID
   */
  async getCitizenGrievances(citizenUid) {
    if (!citizenUid) return [];

    if (isFirebaseConfigured() && db) {
      try {
        const colRef = collection(db, 'complaints');
        const q = query(colRef, where('citizenId', '==', citizenUid), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.error('Firestore getCitizenGrievances error:', err);
      }
    }

    const localList = getLocalGrievances();
    return localList.filter((g) => g.citizenId === citizenUid);
  },

  /**
   * Fetch grievances assigned to a specific department
   */
  async getDepartmentGrievances(departmentId) {
    if (!departmentId) return [];

    if (isFirebaseConfigured() && db) {
      try {
        const colRef = collection(db, 'complaints');
        const q =
          departmentId === 'all'
            ? query(colRef, orderBy('createdAt', 'desc'))
            : query(colRef, where('departmentId', '==', departmentId), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.error('Firestore getDepartmentGrievances error:', err);
      }
    }

    const localList = getLocalGrievances();
    if (departmentId === 'all') return localList;
    return localList.filter((g) => g.departmentId === departmentId);
  },

  /**
   * Fetch public community feed grievances with strict privacy masking
   */
  async getPublicGrievances(category = 'all', ward = 'all', sortBy = 'recent', limitCount = 20) {
    let list = [];
    if (isFirebaseConfigured() && db) {
      try {
        const colRef = collection(db, 'complaints');
        const q = query(
          colRef,
          where('visibility', '==', COMPLAINT_VISIBILITY.PUBLIC),
          where('isSensitive', '==', false),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        );
        const snap = await getDocs(q);
        list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.error('Firestore getPublicGrievances error:', err);
        list = getLocalGrievances();
      }
    } else {
      list = getLocalGrievances();
    }

    // Filter for public visibility
    const filtered = list.filter((g) => {
      if (g.visibility === COMPLAINT_VISIBILITY.PRIVATE || g.visibility === COMPLAINT_VISIBILITY.SENSITIVE || g.isSensitive) {
        return false;
      }
      const matchCat = category === 'all' || g.categoryId === category;
      const matchWard = ward === 'all' || (g.ward && g.ward.toLowerCase().includes(ward.toLowerCase()));
      return matchCat && matchWard;
    });

    // Privacy Masking: Redact personal submitter information from public feed objects
    const sanitized = filtered.map((g) => {
      const { citizenEmail: _, citizenPhone: __, ...safe } = g;
      return {
        ...safe,
        reportedBy: 'Reported by a CivicPulse citizen',
        generalizedLocation: g.location?.generalizedLocation || g.ward,
      };
    });

    // Sorting
    if (sortBy === 'supported') {
      sanitized.sort((a, b) => (b.supportCount || 0) - (a.supportCount || 0));
    } else if (sortBy === 'followed_up') {
      sanitized.sort((a, b) => (b.followUpCount || 0) - (a.followUpCount || 0));
    } else if (sortBy === 'critical') {
      sanitized.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
    }

    return sanitized;
  },

  /**
   * Officer Action: Mark Grievance as Seen
   */
  async markGrievanceAsSeen(grievanceId, officerProfile) {
    const grievance = await this.getGrievanceById(grievanceId);
    if (!grievance) {
      throw new Error(`Grievance #${grievanceId} not found.`);
    }

    if (officerProfile && officerProfile.role === USER_ROLES.OFFICER && grievance.departmentId !== officerProfile.departmentId) {
      throw new Error(
        `Access Denied: Officer for (${officerProfile.departmentId.toUpperCase()}) cannot acknowledge grievances belonging to (${grievance.departmentName}).`
      );
    }

    const timestamp = new Date().toISOString();

    if (isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, 'complaints', grievanceId);
        await updateDoc(docRef, {
          status: COMPLAINT_STATUS.SEEN,
          seenAt: serverTimestamp(),
          assignedOfficerId: officerProfile?.uid || null,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Firestore markGrievanceAsSeen error:', err);
      }
    }

    const localList = getLocalGrievances();
    const updated = localList.map((g) => {
      if (g.id === grievanceId || g.grievanceId === grievanceId) {
        return {
          ...g,
          status: COMPLAINT_STATUS.SEEN,
          seenAt: timestamp,
          assignedOfficerId: officerProfile?.uid || null,
          updatedAt: timestamp,
        };
      }
      return g;
    });
    saveLocalGrievances(updated);

    await auditLogService.logAction({
      grievanceId,
      complaintNumber: grievance.id || grievance.grievanceId || grievanceId,
      actorUid: officerProfile?.uid || 'OFFICER',
      actorName: officerProfile?.displayName || 'Field Officer',
      actorRole: officerProfile?.role || USER_ROLES.OFFICER,
      departmentId: grievance.departmentId,
      action: AUDIT_ACTIONS.GRIEVANCE_ACKNOWLEDGED,
      previousStatus: COMPLAINT_STATUS.SUBMITTED,
      newStatus: COMPLAINT_STATUS.SEEN,
      details: `Officer (${officerProfile?.displayName || officerProfile?.uid}) acknowledged grievance. Response SLA clock halted. Officer assigned.`,
      metadata: {
        officerUid: officerProfile?.uid,
        departmentId: officerProfile?.departmentId,
      },
    });

    try {
      await notificationService.evaluateGrievanceNotifications({
        ...grievance,
        status: COMPLAINT_STATUS.SEEN,
        seenAt: timestamp,
      });
    } catch (err) {
      console.error('Error evaluating notifications on grievance acknowledgment:', err);
    }

    return { id: grievanceId, status: COMPLAINT_STATUS.SEEN, seenAt: timestamp };
  },

  /**
   * Officer Action: Request SLA Deadline Extension
   */
  async requestSLAExtension(grievanceId, officerProfile, { requestedHours, reason }) {
    const grievance = await this.getGrievanceById(grievanceId);
    if (!grievance) {
      throw new Error(`Grievance #${grievanceId} not found.`);
    }

    const currentCount = grievance.extensionCount || 0;
    if (currentCount >= EXTENSION_LIMITS.MAX_EXTENSIONS_PER_COMPLAINT) {
      throw new Error(
        `Extension limit reached (${EXTENSION_LIMITS.MAX_EXTENSIONS_PER_COMPLAINT} extensions maximum). Further extensions are prohibited to prevent indefinite delays.`
      );
    }

    const hours = Number(requestedHours);
    if (!hours || hours <= 0) {
      throw new Error('Please specify a valid extension duration in hours.');
    }
    if (!reason || !reason.trim()) {
      throw new Error('Mandatory justification reason is required for SLA extension requests.');
    }

    const currentDeadline = new Date(grievance.resolutionSlaDue).getTime();
    const proposedDeadline = new Date(currentDeadline + hours * 3600 * 1000).toISOString();

    const extensionId = `EXT-${Date.now()}`;
    const extensionRequest = {
      id: extensionId,
      grievanceId,
      departmentId: grievance.departmentId,
      requestedByOfficerId: officerProfile?.uid || 'officer',
      requestedByOfficerName: officerProfile?.displayName || 'Field Officer',
      requestedHours: hours,
      reason: reason.trim(),
      previousDeadline: grievance.resolutionSlaDue,
      proposedDeadline,
      status: 'PENDING',
      isSecondExtension: currentCount === 1,
      requiresSuperAdmin: currentCount === 1 || hours > EXTENSION_LIMITS.FIRST_EXTENSION_MAX_HOURS,
      reviewedByAdminId: null,
      reviewedByAdminName: '',
      adminRemarks: '',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    };

    if (isFirebaseConfigured() && db) {
      await setDoc(doc(db, 'sla_extensions', extensionId), {
        ...extensionRequest,
        createdAt: serverTimestamp(),
      });
    }

    const extensions = getLocalExtensions();
    extensions.unshift(extensionRequest);
    saveLocalExtensions(extensions);

    await auditLogService.logAction({
      grievanceId,
      complaintNumber: grievance.id || grievance.grievanceId || grievanceId,
      actorUid: officerProfile?.uid || 'OFFICER',
      actorName: officerProfile?.displayName || 'Field Officer',
      actorRole: officerProfile?.role || USER_ROLES.OFFICER,
      departmentId: grievance.departmentId,
      action: AUDIT_ACTIONS.SLA_EXTENSION_REQUESTED,
      previousStatus: grievance.status,
      newStatus: grievance.status,
      details: `Extension of +${hours}h requested by ${officerProfile?.displayName || 'Officer'}. Reason: "${reason.trim()}". Proposed deadline: ${proposedDeadline}`,
      metadata: {
        extensionId,
        requestedHours: hours,
        reason: reason.trim(),
        previousDeadline: grievance.resolutionSlaDue,
        proposedDeadline,
      },
    });

    return extensionRequest;
  },

  /**
   * Admin Action: Review and Approve/Reject SLA Extension Request
   */
  async reviewSLAExtension(extensionId, adminProfile, { decision, adminRemarks = '' }) {
    const extensions = getLocalExtensions();
    const extension = extensions.find((e) => e.id === extensionId);
    if (!extension) {
      throw new Error(`Extension request #${extensionId} not found.`);
    }

    if (adminProfile?.role === USER_ROLES.DEPARTMENT_ADMIN) {
      if (extension.departmentId !== adminProfile.departmentId) {
        throw new Error(
          `Access Denied: Department Admin for (${adminProfile.departmentId.toUpperCase()}) cannot approve extensions for (${extension.departmentId.toUpperCase()}).`
        );
      }
      if (extension.requiresSuperAdmin) {
        throw new Error(
          'This extension request exceeds 24h or is a second extension and strictly requires Super Admin approval.'
        );
      }
    }

    const timestamp = new Date().toISOString();
    extension.status = decision;
    extension.reviewedByAdminId = adminProfile?.uid || 'admin';
    extension.reviewedByAdminName = adminProfile?.displayName || 'Admin Supervisor';
    extension.adminRemarks = adminRemarks;
    extension.reviewedAt = timestamp;
    saveLocalExtensions(extensions);

    if (decision === 'APPROVED') {
      const localList = getLocalGrievances();
      const updated = localList.map((g) => {
        if (g.id === extension.grievanceId || g.grievanceId === extension.grievanceId) {
          const extensionHistory = g.extensionHistory || [];
          extensionHistory.push({
            extensionId,
            approvedHours: extension.requestedHours,
            reason: extension.reason,
            previousDeadline: g.resolutionSlaDue,
            newDeadline: extension.proposedDeadline,
            approvedBy: extension.reviewedByAdminName,
            approvedAt: timestamp,
          });

          return {
            ...g,
            resolutionSlaDue: extension.proposedDeadline,
            extensionCount: (g.extensionCount || 0) + 1,
            extensionHistory,
            updatedAt: timestamp,
          };
        }
        return g;
      });
      saveLocalGrievances(updated);
    }

    await auditLogService.logAction({
      grievanceId: extension.grievanceId,
      complaintNumber: extension.grievanceId,
      actorUid: adminProfile?.uid || 'ADMIN',
      actorName: adminProfile?.displayName || 'Department Administrator',
      actorRole: adminProfile?.role || USER_ROLES.DEPARTMENT_ADMIN,
      departmentId: extension.departmentId,
      action: decision === 'APPROVED' ? AUDIT_ACTIONS.SLA_EXTENSION_APPROVED : AUDIT_ACTIONS.SLA_EXTENSION_REJECTED,
      previousStatus: 'PENDING_REVIEW',
      newStatus: decision,
      details: `Extension request for +${extension.requestedHours}h was ${decision} by ${adminProfile?.displayName || 'Admin'}. ${adminRemarks ? `Remarks: "${adminRemarks}"` : ''}`,
      metadata: {
        extensionId: extension.id,
        decision,
        adminRemarks,
        requestedHours: extension.requestedHours,
      },
    });

    return extension;
  },

  /**
   * Fetch SLA Extension requests filtered by Admin's authorization
   */
  async getSLAExtensions(adminProfile) {
    const list = getLocalExtensions();
    if (!adminProfile || adminProfile.role === USER_ROLES.SUPER_ADMIN) {
      return list;
    }
    return list.filter((e) => e.departmentId === adminProfile.departmentId);
  },

  /**
   * Officer Action: Submit Resolution Evidence
   * Transitions status to VERIFICATION and activates Verification SLA clock.
   * Crucial rule: Resolution SLA remains active until confirmed by Admin!
   */
  async submitResolutionEvidence(grievanceId, officerProfile, { remarks, afterMediaUrls = [] }) {
    if (!officerProfile || !officerProfile.uid) {
      throw new Error('You must be authenticated as a department officer to submit resolution evidence.');
    }
    if (!remarks || !remarks.trim()) {
      throw new Error('Mandatory completion/engineering remarks are required.');
    }
    if (!afterMediaUrls || afterMediaUrls.length === 0) {
      throw new Error('After-rectification photographic proof is required.');
    }

    const grievance = await this.getGrievanceById(grievanceId);
    if (!grievance) {
      throw new Error(`Grievance #${grievanceId} not found.`);
    }

    if (officerProfile.role === USER_ROLES.OFFICER && grievance.departmentId !== officerProfile.departmentId) {
      throw new Error(
        `Access Denied: Officer for (${officerProfile.departmentId.toUpperCase()}) cannot submit resolution for (${grievance.departmentName}).`
      );
    }

    const allowedStatuses = [
      COMPLAINT_STATUS.SUBMITTED,
      COMPLAINT_STATUS.SEEN,
      COMPLAINT_STATUS.IN_PROGRESS,
    ];
    if (!allowedStatuses.includes(grievance.status)) {
      throw new Error(`Cannot submit resolution proof for grievance with status: ${grievance.status}`);
    }

    const timestamp = new Date().toISOString();
    const verificationSlaDue = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const resolutionProof = {
      submittedByType: 'OFFICER',
      submittedById: officerProfile.uid,
      submittedByName: officerProfile.displayName || 'Field Officer',
      remarks: remarks.trim(),
      afterMediaUrls,
      evidenceVisibility: EVIDENCE_VISIBILITY.PUBLIC_EVIDENCE,
      submittedAt: timestamp,
    };

    if (isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, 'complaints', grievanceId);
        await updateDoc(docRef, {
          status: COMPLAINT_STATUS.VERIFICATION,
          verificationSubmittedAt: serverTimestamp(),
          verificationSlaDue,
          resolutionProof,
          assignedOfficerId: officerProfile.uid,
          rejectionReason: '',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Firestore submitResolutionEvidence error:', err);
      }
    }

    const localList = getLocalGrievances();
    let targetGrievance = null;

    const updated = localList.map((g) => {
      if (g.id === grievanceId || g.grievanceId === grievanceId) {
        targetGrievance = {
          ...g,
          status: COMPLAINT_STATUS.VERIFICATION,
          verificationSubmittedAt: timestamp,
          verificationSlaDue,
          resolutionProof,
          assignedOfficerId: officerProfile.uid,
          rejectionReason: '',
          updatedAt: timestamp,
        };
        return targetGrievance;
      }
      return g;
    });
    saveLocalGrievances(updated);

    await auditLogService.logAction({
      grievanceId,
      complaintNumber: grievance.id || grievance.grievanceId || grievanceId,
      actorUid: officerProfile.uid,
      actorName: officerProfile.displayName || 'Field Officer',
      actorRole: officerProfile.role || USER_ROLES.OFFICER,
      departmentId: grievance.departmentId,
      action: AUDIT_ACTIONS.RESOLUTION_SUBMITTED,
      previousStatus: grievance.status,
      newStatus: COMPLAINT_STATUS.VERIFICATION,
      details: `Officer resolution proof submitted for Admin verification. Remarks: "${remarks.trim()}". Verification SLA active (24h). Resolution SLA continues counting down.`,
      metadata: {
        submittedByType: 'OFFICER',
        remarks: remarks.trim(),
        afterMediaUrlsCount: afterMediaUrls.length,
      },
    });

    return targetGrievance;
  },

  /**
   * Community Action: Citizen Submits Community Remediation Proof
   * Transitions status to COMMUNITY_ACTION_SUBMITTED / VERIFICATION.
   * Crucial rule: Resolution SLA remains active until verified by Department Admin!
   */
  async submitCommunityAction(grievanceId, citizenUser, { narrative, afterMediaUrls = [] }) {
    if (!citizenUser || !citizenUser.uid) {
      throw new Error('You must be authenticated to submit community action proof.');
    }
    if (!narrative || !narrative.trim()) {
      throw new Error('Please describe the community remediation work completed.');
    }

    const grievance = await this.getGrievanceById(grievanceId);
    const timestamp = new Date().toISOString();
    const verificationSlaDue = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const resolutionProof = {
      submittedByType: 'COMMUNITY',
      submittedById: citizenUser.uid,
      submittedByName: citizenUser.displayName || 'CivicPulse Citizen',
      remarks: narrative.trim(),
      afterMediaUrls,
      evidenceVisibility: EVIDENCE_VISIBILITY.PUBLIC_EVIDENCE,
      submittedAt: timestamp,
    };

    if (isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, 'complaints', grievanceId);
        await updateDoc(docRef, {
          status: COMPLAINT_STATUS.COMMUNITY_ACTION_SUBMITTED,
          verificationSubmittedAt: serverTimestamp(),
          verificationSlaDue,
          resolutionProof,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Firestore submitCommunityAction error:', err);
      }
    }

    const localList = getLocalGrievances();
    let targetGrievance = null;

    const updated = localList.map((g) => {
      if (g.id === grievanceId || g.grievanceId === grievanceId) {
        targetGrievance = {
          ...g,
          status: COMPLAINT_STATUS.COMMUNITY_ACTION_SUBMITTED,
          verificationSubmittedAt: timestamp,
          verificationSlaDue,
          resolutionProof,
          updatedAt: timestamp,
        };
        return targetGrievance;
      }
      return g;
    });
    saveLocalGrievances(updated);

    await auditLogService.logAction({
      grievanceId,
      complaintNumber: grievance?.id || grievance?.grievanceId || grievanceId,
      actorUid: citizenUser.uid,
      actorName: citizenUser.displayName || 'Community Volunteer',
      actorRole: citizenUser.role || USER_ROLES.CITIZEN,
      departmentId: grievance?.departmentId || null,
      action: AUDIT_ACTIONS.RESOLUTION_SUBMITTED,
      previousStatus: grievance?.status || COMPLAINT_STATUS.IN_PROGRESS,
      newStatus: COMPLAINT_STATUS.COMMUNITY_ACTION_SUBMITTED,
      details: `Citizen submitted community remediation proof. Verification SLA active (24h). Resolution SLA continues counting down.`,
      metadata: {
        submittedByType: 'COMMUNITY',
        narrative: narrative.trim(),
        afterMediaUrlsCount: afterMediaUrls.length,
      },
    });

    return targetGrievance;
  },

  /**
   * Admin Action: Verify Resolution Evidence (Officer Evidence or Community Action)
   * Anti-Self-Approval: Officer cannot verify own evidence; Submitting citizen cannot verify own community action.
   */
  async verifyResolution(grievanceId, adminProfile, { approved, rejectionReason = '' }) {
    if (!adminProfile || ![USER_ROLES.DEPARTMENT_ADMIN, USER_ROLES.SUPER_ADMIN].includes(adminProfile.role)) {
      throw new Error('Access Denied: Only authorized Department Admins or Super Admin can verify resolution evidence.');
    }

    const grievance = await this.getGrievanceById(grievanceId);
    if (!grievance) {
      throw new Error(`Grievance #${grievanceId} not found.`);
    }

    const verificationAllowedStatuses = [
      COMPLAINT_STATUS.VERIFICATION,
      COMPLAINT_STATUS.RESOLUTION_SUBMITTED,
      COMPLAINT_STATUS.COMMUNITY_ACTION_SUBMITTED,
    ];
    if (!verificationAllowedStatuses.includes(grievance.status)) {
      throw new Error(
        `Cannot verify grievance with status: ${grievance.status}. It is not in the verification queue.`
      );
    }

    // Department boundary check
    if (adminProfile.role === USER_ROLES.DEPARTMENT_ADMIN) {
      if (grievance.departmentId !== adminProfile.departmentId) {
        throw new Error(
          `Access Denied: Department Admin for (${adminProfile.departmentId.toUpperCase()}) cannot verify grievances belonging to (${grievance.departmentName}).`
        );
      }
    }

    // Anti-Self-Approval checks:
    const submittedById = grievance.resolutionProof?.submittedById;
    if (submittedById && submittedById === adminProfile.uid) {
      throw new Error('Access Denied: You cannot verify or approve your own submitted resolution evidence.');
    }

    if (!approved && (!rejectionReason || !rejectionReason.trim())) {
      throw new Error('Mandatory rejection reason is required when rejecting resolution proof.');
    }

    const timestamp = new Date().toISOString();
    const newStatus = approved ? COMPLAINT_STATUS.VERIFIED_RESOLVED : COMPLAINT_STATUS.IN_PROGRESS;

    if (isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, 'complaints', grievanceId);
        await updateDoc(docRef, {
          status: newStatus,
          verifiedResolvedAt: approved ? serverTimestamp() : null,
          verifiedById: approved ? adminProfile.uid : null,
          verifiedByName: approved ? (adminProfile.displayName || 'Admin Supervisor') : '',
          verificationSubmittedAt: null,
          verificationSlaDue: null,
          rejectionReason: approved ? '' : rejectionReason.trim(),
          rejectedBy: approved ? '' : (adminProfile.displayName || 'Admin Supervisor'),
          rejectedAt: approved ? null : timestamp,
          escalationLevel: approved ? ESCALATION_LEVELS.RESOLVED : grievance.escalationLevel,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Firestore verifyResolution error:', err);
      }
    }

    const localList = getLocalGrievances();
    const updated = localList.map((g) => {
      if (g.id === grievanceId || g.grievanceId === grievanceId) {
        return {
          ...g,
          status: newStatus,
          verifiedResolvedAt: approved ? timestamp : null,
          verifiedById: approved ? adminProfile.uid : null,
          verifiedByName: approved ? (adminProfile.displayName || 'Admin Supervisor') : '',
          verificationSubmittedAt: null,
          verificationSlaDue: null,
          rejectionReason: approved ? '' : rejectionReason.trim(),
          rejectedBy: approved ? '' : (adminProfile.displayName || 'Admin Supervisor'),
          rejectedAt: approved ? null : timestamp,
          escalationLevel: approved ? ESCALATION_LEVELS.RESOLVED : g.escalationLevel,
          updatedAt: timestamp,
        };
      }
      return g;
    });
    saveLocalGrievances(updated);

    await auditLogService.logAction({
      grievanceId,
      complaintNumber: grievance.id || grievance.grievanceId || grievanceId,
      actorUid: adminProfile.uid,
      actorName: adminProfile.displayName || 'Admin Supervisor',
      actorRole: adminProfile.role,
      departmentId: grievance.departmentId,
      action: approved ? AUDIT_ACTIONS.RESOLUTION_VERIFIED : AUDIT_ACTIONS.RESOLUTION_REJECTED,
      previousStatus: grievance.status,
      newStatus,
      details: approved
        ? `Resolution evidence verified and approved by ${adminProfile.displayName || 'Admin'}. Resolution SLA halted.`
        : `Evidence rejected by ${adminProfile.displayName || 'Admin'}. Reason: "${rejectionReason.trim()}". Reverted to IN_PROGRESS.`,
      metadata: {
        approved,
        rejectionReason: approved ? null : rejectionReason.trim(),
        verifiedResolvedAt: approved ? timestamp : null,
      },
    });

    return { id: grievanceId, status: newStatus, verifiedResolvedAt: approved ? timestamp : null };
  },

  /**
   * Admin Action: Final Administrative Closure of Grievance
   * Transitions status: VERIFIED_RESOLVED -> CLOSED.
   * Terminal state: no further resolution submissions, no further verification.
   * Resolution SLA remains halted (verifiedResolvedAt).
   */
  async closeGrievance(grievanceId, adminProfile, { closureRemarks = '' } = {}) {
    if (!adminProfile || ![USER_ROLES.DEPARTMENT_ADMIN, USER_ROLES.SUPER_ADMIN].includes(adminProfile.role)) {
      throw new Error('Access Denied: Only authorized Department Admins or Super Admin can close a grievance.');
    }

    const grievance = await this.getGrievanceById(grievanceId);
    if (!grievance) {
      throw new Error(`Grievance #${grievanceId} not found.`);
    }

    // State machine check: Must be VERIFIED_RESOLVED
    if (grievance.status !== COMPLAINT_STATUS.VERIFIED_RESOLVED) {
      if (grievance.status === COMPLAINT_STATUS.CLOSED) {
        throw new Error('Grievance is already CLOSED.');
      }
      throw new Error(
        `Cannot close grievance with status: ${grievance.status}. Grievance must first be verified and resolved (VERIFIED_RESOLVED) before final administrative closure.`
      );
    }

    // Department boundary check
    if (adminProfile.role === USER_ROLES.DEPARTMENT_ADMIN) {
      if (grievance.departmentId !== adminProfile.departmentId) {
        throw new Error(
          `Access Denied: Department Admin for (${adminProfile.departmentId.toUpperCase()}) cannot close grievances belonging to (${grievance.departmentName}).`
        );
      }
    }

    const timestamp = new Date().toISOString();

    if (isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, 'complaints', grievanceId);
        await updateDoc(docRef, {
          status: COMPLAINT_STATUS.CLOSED,
          isArchived: true,
          archivedAt: serverTimestamp(),
          closedAt: serverTimestamp(),
          closedById: adminProfile.uid,
          closedByName: adminProfile.displayName || 'Admin Supervisor',
          closureRemarks: closureRemarks.trim(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Firestore closeGrievance error:', err);
      }
    }

    const localList = getLocalGrievances();
    let targetGrievance = null;
    const updated = localList.map((g) => {
      if (g.id === grievanceId || g.grievanceId === grievanceId) {
        targetGrievance = {
          ...g,
          status: COMPLAINT_STATUS.CLOSED,
          isArchived: true,
          archivedAt: timestamp,
          closedAt: timestamp,
          closedById: adminProfile.uid,
          closedByName: adminProfile.displayName || 'Admin Supervisor',
          closureRemarks: closureRemarks.trim(),
          updatedAt: timestamp,
        };
        return targetGrievance;
      }
      return g;
    });
    saveLocalGrievances(updated);

    await auditLogService.logAction({
      grievanceId,
      complaintNumber: grievance.id || grievance.grievanceId || grievanceId,
      actorUid: adminProfile.uid,
      actorName: adminProfile.displayName || 'Admin Supervisor',
      actorRole: adminProfile.role,
      departmentId: grievance.departmentId,
      action: AUDIT_ACTIONS.GRIEVANCE_CLOSED,
      previousStatus: COMPLAINT_STATUS.VERIFIED_RESOLVED,
      newStatus: COMPLAINT_STATUS.CLOSED,
      details: `Grievance officially closed and archived by ${adminProfile.displayName || 'Admin'}. ${closureRemarks ? `Remarks: "${closureRemarks.trim()}"` : ''}`,
      metadata: {
        closedById: adminProfile.uid,
        closureRemarks: closureRemarks.trim(),
        closedAt: timestamp,
        isArchived: true,
      },
    });

    return targetGrievance;
  },

  /**
   * Admin Action: Archive Grievance
   * Marks a VERIFIED_RESOLVED or CLOSED grievance as archived without physically deleting any data.
   */
  async archiveGrievance(grievanceId, adminProfile, { archiveReason = '' } = {}) {
    if (!adminProfile || ![USER_ROLES.DEPARTMENT_ADMIN, USER_ROLES.SUPER_ADMIN].includes(adminProfile.role)) {
      throw new Error('Access Denied: Only authorized Department Admins or Super Admin can archive a grievance.');
    }

    const grievance = await this.getGrievanceById(grievanceId);
    if (!grievance) {
      throw new Error(`Grievance #${grievanceId} not found.`);
    }

    // Must be in VERIFIED_RESOLVED or CLOSED status to be archived
    if (![COMPLAINT_STATUS.VERIFIED_RESOLVED, COMPLAINT_STATUS.CLOSED].includes(grievance.status)) {
      throw new Error(
        `Cannot archive grievance with status: ${grievance.status}. Only verified or closed grievances can be archived.`
      );
    }

    // Department boundary check
    if (adminProfile.role === USER_ROLES.DEPARTMENT_ADMIN) {
      if (grievance.departmentId !== adminProfile.departmentId) {
        throw new Error(
          `Access Denied: Department Admin for (${adminProfile.departmentId.toUpperCase()}) cannot archive grievances belonging to (${grievance.departmentName}).`
        );
      }
    }

    const timestamp = new Date().toISOString();
    const isAlreadyClosed = grievance.status === COMPLAINT_STATUS.CLOSED;

    if (isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, 'complaints', grievanceId);
        await updateDoc(docRef, {
          status: COMPLAINT_STATUS.CLOSED,
          isArchived: true,
          archivedAt: serverTimestamp(),
          archivedById: adminProfile.uid,
          archivedByName: adminProfile.displayName || 'Admin Supervisor',
          archiveReason: archiveReason.trim(),
          closedAt: isAlreadyClosed ? grievance.closedAt : serverTimestamp(),
          closedById: isAlreadyClosed ? grievance.closedById : adminProfile.uid,
          closedByName: isAlreadyClosed ? grievance.closedByName : (adminProfile.displayName || 'Admin Supervisor'),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Firestore archiveGrievance error:', err);
      }
    }

    const localList = getLocalGrievances();
    let targetGrievance = null;
    const updated = localList.map((g) => {
      if (g.id === grievanceId || g.grievanceId === grievanceId) {
        targetGrievance = {
          ...g,
          status: COMPLAINT_STATUS.CLOSED,
          isArchived: true,
          archivedAt: timestamp,
          archivedById: adminProfile.uid,
          archivedByName: adminProfile.displayName || 'Admin Supervisor',
          archiveReason: archiveReason.trim(),
          closedAt: g.closedAt || timestamp,
          closedById: g.closedById || adminProfile.uid,
          closedByName: g.closedByName || (adminProfile.displayName || 'Admin Supervisor'),
          updatedAt: timestamp,
        };
        return targetGrievance;
      }
      return g;
    });
    saveLocalGrievances(updated);

    await auditLogService.logAction({
      grievanceId,
      complaintNumber: grievance.id || grievance.grievanceId || grievanceId,
      actorUid: adminProfile.uid,
      actorName: adminProfile.displayName || 'Admin Supervisor',
      actorRole: adminProfile.role,
      departmentId: grievance.departmentId,
      action: AUDIT_ACTIONS.GRIEVANCE_CLOSED,
      previousStatus: grievance.status,
      newStatus: COMPLAINT_STATUS.CLOSED,
      details: `Grievance officially archived by ${adminProfile.displayName || 'Admin'}. ${archiveReason ? `Archive Reason: "${archiveReason.trim()}"` : ''}`,
      metadata: {
        archivedById: adminProfile.uid,
        archiveReason: archiveReason.trim(),
        archivedAt: timestamp,
        isArchived: true,
      },
    });

    return targetGrievance;
  },

  /**
   * Citizen Action: Submit 1-Citizen-1-Vote "Still Not Resolved" Follow-up
   * Prevents spam / duplicate clicks using deterministic tracking.
   */
  async submitFollowUp(grievanceId, citizenUser, { comment = '' } = {}) {
    if (!citizenUser || !citizenUser.uid) {
      throw new Error('You must be logged in as a verified citizen to submit a follow-up.');
    }

    const voteStore = getLocalVotes();
    const voteKey = `${grievanceId}_${citizenUser.uid}`;

    if (voteStore.followups[voteKey]) {
      throw new Error('You have already registered your unique "Still Not Resolved" follow-up for this grievance.');
    }

    voteStore.followups[voteKey] = {
      citizenId: citizenUser.uid,
      citizenName: citizenUser.displayName || 'Citizen',
      comment: comment.trim(),
      timestamp: new Date().toISOString(),
    };
    saveLocalVotes(voteStore);

    const localList = getLocalGrievances();
    let targetGrievance = null;

    const updated = localList.map((g) => {
      if (g.id === grievanceId || g.grievanceId === grievanceId) {
        const nextCount = (g.followUpCount || 0) + 1;
        const priorityResult = priorityEngine.calculatePriority({
          severity: g.severity,
          categoryId: g.categoryId,
          supportCount: g.supportCount,
          followUpCount: nextCount,
          createdAt: g.createdAt,
        });

        let newEscalation = g.escalationLevel;
        let newReason = g.escalationReason;

        if (nextCount >= EXTENSION_LIMITS.FOLLOWUP_ESCALATION_THRESHOLD && g.escalationLevel === ESCALATION_LEVELS.NOT_ESCALATED) {
          newEscalation = ESCALATION_LEVELS.DEPARTMENT_ESCALATED;
          newReason = `Community follow-up threshold reached (${nextCount} citizen signals).`;
        }

        targetGrievance = {
          ...g,
          followUpCount: nextCount,
          priorityScore: priorityResult.priorityScore,
          priorityLevel: priorityResult.priorityLevel,
          escalationLevel: newEscalation,
          escalationReason: newReason,
          updatedAt: new Date().toISOString(),
        };
        return targetGrievance;
      }
      return g;
    });
    saveLocalGrievances(updated);

    await auditLogService.logAction({
      grievanceId,
      complaintNumber: targetGrievance?.id || targetGrievance?.grievanceId || grievanceId,
      actorUid: citizenUser.uid,
      actorName: citizenUser.displayName || 'Citizen',
      actorRole: citizenUser.role || USER_ROLES.CITIZEN,
      departmentId: targetGrievance?.departmentId || null,
      action: AUDIT_ACTIONS.SLA_ACTION,
      previousStatus: targetGrievance?.status || 'ACTIVE',
      newStatus: targetGrievance?.escalationLevel || 'ACTIVE',
      details: `Citizen registered "Still Not Resolved" signal. Total follow-ups: ${targetGrievance?.followUpCount}. Priority elevated to ${targetGrievance?.priorityScore}.`,
      metadata: {
        followUpCount: targetGrievance?.followUpCount,
        priorityScore: targetGrievance?.priorityScore,
        escalationLevel: targetGrievance?.escalationLevel,
      },
    });

    return targetGrievance;
  },

  /**
   * Citizen Action: 1-Citizen-1-Vote Support / Upvote
   */
  async toggleSupport(grievanceId, citizenUser) {
    if (!citizenUser || !citizenUser.uid) {
      throw new Error('You must be logged in to support an issue.');
    }

    const voteStore = getLocalVotes();
    const voteKey = `${grievanceId}_${citizenUser.uid}`;
    const alreadySupported = Boolean(voteStore.supports[voteKey]);

    if (alreadySupported) {
      delete voteStore.supports[voteKey];
    } else {
      voteStore.supports[voteKey] = {
        citizenId: citizenUser.uid,
        timestamp: new Date().toISOString(),
      };
    }
    saveLocalVotes(voteStore);

    const localList = getLocalGrievances();
    let targetGrievance = null;

    const updated = localList.map((g) => {
      if (g.id === grievanceId || g.grievanceId === grievanceId) {
        const nextCount = alreadySupported ? Math.max(0, (g.supportCount || 0) - 1) : (g.supportCount || 0) + 1;
        const priorityResult = priorityEngine.calculatePriority({
          severity: g.severity,
          categoryId: g.categoryId,
          supportCount: nextCount,
          followUpCount: g.followUpCount,
          createdAt: g.createdAt,
          escalationLevel: g.escalationLevel,
        });

        targetGrievance = {
          ...g,
          supportCount: nextCount,
          priorityScore: priorityResult.priorityScore,
          priorityLevel: priorityResult.priorityLevel,
          updatedAt: new Date().toISOString(),
        };
        return targetGrievance;
      }
      return g;
    });
    saveLocalGrievances(updated);

    return { grievance: targetGrievance, hasSupported: !alreadySupported };
  },

  /**
   * Fetch Verification Queue sorted by priority, urgency, and verification overdue status
   * @param {Object} adminProfile
   * @param {string} statusFilter - 'pending' | 'ready_for_closure' | 'all'
   */
  async getVerificationQueue(adminProfile, statusFilter = 'pending') {
    let list = [];
    if (isFirebaseConfigured() && db) {
      try {
        const colRef = collection(db, 'complaints');
        const q = query(colRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.error('Firestore getVerificationQueue error:', err);
        list = getLocalGrievances();
      }
    } else {
      list = getLocalGrievances();
    }

    let queue = [];

    if (statusFilter === 'ready_for_closure') {
      queue = list.filter((g) => g.status === COMPLAINT_STATUS.VERIFIED_RESOLVED);
    } else if (statusFilter === 'closed' || statusFilter === 'archived') {
      queue = list.filter((g) => g.status === COMPLAINT_STATUS.CLOSED || g.isArchived);
    } else if (statusFilter === 'all') {
      queue = list.filter((g) =>
        [
          COMPLAINT_STATUS.RESOLUTION_SUBMITTED,
          COMPLAINT_STATUS.COMMUNITY_ACTION_SUBMITTED,
          COMPLAINT_STATUS.VERIFICATION,
          COMPLAINT_STATUS.VERIFIED_RESOLVED,
          COMPLAINT_STATUS.CLOSED,
        ].includes(g.status) || g.isArchived
      );
    } else {
      // Default: 'pending' verification items
      queue = list.filter((g) =>
        [
          COMPLAINT_STATUS.RESOLUTION_SUBMITTED,
          COMPLAINT_STATUS.COMMUNITY_ACTION_SUBMITTED,
          COMPLAINT_STATUS.VERIFICATION,
        ].includes(g.status)
      );
    }

    const filtered =
      adminProfile?.role === USER_ROLES.DEPARTMENT_ADMIN
        ? queue.filter((g) => g.departmentId === adminProfile.departmentId)
        : queue;

    return filtered.sort((a, b) => {
      const scoreA = a.priorityScore || 0;
      const scoreB = b.priorityScore || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  },

  /**
   * Real-time listeners
   */
  subscribeToCitizenGrievances(citizenUid, callback) {
    if (!citizenUid) {
      callback([]);
      return () => {};
    }

    const sync = () => {
      const localList = getLocalGrievances();
      callback(localList.filter((g) => g.citizenId === citizenUid));
    };
    sync();
    const interval = setInterval(sync, 2000);
    return () => clearInterval(interval);
  },

  subscribeToDepartmentGrievances(departmentId, callback) {
    if (!departmentId) {
      callback([]);
      return () => {};
    }

    const sync = () => {
      const localList = getLocalGrievances();
      callback(departmentId === 'all' ? localList : localList.filter((g) => g.departmentId === departmentId));
    };
    sync();
    const interval = setInterval(sync, 2000);
    return () => clearInterval(interval);
  },
};
