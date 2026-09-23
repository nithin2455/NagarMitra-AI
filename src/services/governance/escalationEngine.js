/**
 * @file escalationEngine.js
 * @description Hierarchical Escalation Governance Engine.
 * Evaluates grievance state, SLA breaches, citizen follow-ups, and verification backlog
 * to escalate issues up the administrative chain (Officer -> Department Admin -> Super Admin).
 */

import {
  ESCALATION_LEVELS,
  COMPLAINT_STATUS,
  SEVERITY_LEVELS,
  EXTENSION_LIMITS,
} from '../../models/schema.js';
import { slaEngine } from './slaEngine.js';

export const escalationEngine = {
  /**
   * Evaluates current escalation state of a grievance
   * @param {Object} complaint
   * @param {Date} currentTime
   */
  evaluateEscalation(complaint, currentTime = new Date()) {
    if (!complaint) {
      return { level: ESCALATION_LEVELS.NOT_ESCALATED, reason: '' };
    }

    // 1. If already resolved, status is RESOLVED
    if ([COMPLAINT_STATUS.VERIFIED_RESOLVED, COMPLAINT_STATUS.CLOSED].includes(complaint.status)) {
      return {
        level: ESCALATION_LEVELS.RESOLVED,
        reason: 'Issue verified resolved. Escalations cleared.',
      };
    }

    const responseEval = slaEngine.evaluateResponseSLA(complaint, currentTime);
    const resolutionEval = slaEngine.evaluateResolutionSLA(complaint, currentTime);
    const verificationEval = slaEngine.evaluateVerificationSLA(complaint, currentTime);

    const followUpCount = complaint.followUpCount || 0;
    const extensionCount = complaint.extensionCount || 0;
    const isCritical = complaint.severity === SEVERITY_LEVELS.CRITICAL;

    // 2. Critical Escalation Triggers
    if (isCritical && resolutionEval.isBreached) {
      return {
        level: ESCALATION_LEVELS.CRITICAL_ESCALATION,
        reason: 'Critical public safety hazard with breached Resolution SLA.',
      };
    }

    if (extensionCount >= EXTENSION_LIMITS.MAX_EXTENSIONS_PER_COMPLAINT + 1) {
      return {
        level: ESCALATION_LEVELS.CRITICAL_ESCALATION,
        reason: 'Repeated unauthorized SLA extensions attempted.',
      };
    }

    // 3. Super Admin Escalation Triggers
    if (verificationEval.isOverdue && verificationEval.overdueHours >= 24) {
      return {
        level: ESCALATION_LEVELS.SUPER_ADMIN_ESCALATED,
        reason: 'Resolution verification overdue by > 24 hours at Department Admin level.',
      };
    }

    if (resolutionEval.isBreached && resolutionEval.remainingHours <= -48) {
      return {
        level: ESCALATION_LEVELS.SUPER_ADMIN_ESCALATED,
        reason: 'Resolution SLA severely breached (> 48 hours overdue).',
      };
    }

    if (extensionCount >= 2) {
      return {
        level: ESCALATION_LEVELS.SUPER_ADMIN_ESCALATED,
        reason: 'Multiple SLA extensions requested; requires Super Admin supervisory review.',
      };
    }

    if (followUpCount >= 5) {
      return {
        level: ESCALATION_LEVELS.SUPER_ADMIN_ESCALATED,
        reason: `High community follow-up volume (${followUpCount} citizen signals) escalated to Super Admin.`,
      };
    }

    // 4. Department Admin Escalation Triggers
    if (complaint.escalationLevel === ESCALATION_LEVELS.DEPARTMENT_ESCALATED) {
      return {
        level: ESCALATION_LEVELS.DEPARTMENT_ESCALATED,
        reason: complaint.escalationReason || 'Officer failed to acknowledge grievance after response SLA and warning alerts.',
      };
    }

    if (resolutionEval.isBreached) {
      return {
        level: ESCALATION_LEVELS.DEPARTMENT_ESCALATED,
        reason: 'Resolution SLA breached. Department Admin intervention required.',
      };
    }

    if (responseEval.isBreached) {
      return {
        level: ESCALATION_LEVELS.WARNING,
        reason: 'Response SLA breached. Post-SLA officer warning alert active.',
      };
    }

    if (followUpCount >= EXTENSION_LIMITS.FOLLOWUP_ESCALATION_THRESHOLD) {
      return {
        level: ESCALATION_LEVELS.DEPARTMENT_ESCALATED,
        reason: `Community follow-up threshold reached (${followUpCount} citizen "Still Not Resolved" signals).`,
      };
    }

    if (verificationEval.isOverdue) {
      return {
        level: ESCALATION_LEVELS.DEPARTMENT_ESCALATED,
        reason: 'Verification SLA window elapsed. Department Admin review needed.',
      };
    }

    // 5. Early Warning Threshold
    if (resolutionEval.thresholdStatus === 'WARNING' || resolutionEval.thresholdStatus === 'URGENT') {
      return {
        level: ESCALATION_LEVELS.WARNING,
        reason: `Approaching deadline (${resolutionEval.elapsedPercent}% SLA elapsed).`,
      };
    }

    // 6. Normal
    return {
      level: ESCALATION_LEVELS.NOT_ESCALATED,
      reason: 'SLA parameters within standard operational window.',
    };
  },
};
