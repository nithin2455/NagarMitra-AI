/**
 * @file slaEngine.js
 * @description Centralized Dynamic SLA Governance Engine.
 * Manages dual independent SLA clocks (Response SLA & Resolution SLA),
 * Verification SLA countdowns, warning threshold states, and deadline extension calculations.
 */

import {
  CATEGORIES,
  SEVERITY_LEVELS,
  SEVERITY_MULTIPLIERS,
  SLA_WARNING_THRESHOLDS,
  DEFAULT_VERIFICATION_SLA_HOURS,
  COMPLAINT_STATUS,
} from '../../models/schema.js';

export const slaEngine = {
  /**
   * Calculates initial Response, Resolution, and Verification SLA on grievance intake
   * @param {string} categoryId
   * @param {string} severity
   * @param {Date} intakeTime
   */
  calculateInitialSLA(categoryId, severity = SEVERITY_LEVELS.MEDIUM, intakeTime = new Date()) {
    const key = (categoryId || 'other').toUpperCase();
    const config = CATEGORIES[key] || CATEGORIES.OTHER;
    const multiplier = SEVERITY_MULTIPLIERS[severity] || 1.0;

    // Dynamic SLA duration calculations
    const responseSlaHours = Math.max(1, Math.round(config.defaultResponseHours * multiplier));
    const resolutionSlaHours = Math.max(2, Math.round(config.defaultResolutionHours * multiplier));
    const verificationSlaHours = DEFAULT_VERIFICATION_SLA_HOURS;

    const intakeMillis = intakeTime.getTime();
    const responseSlaDue = new Date(intakeMillis + responseSlaHours * 3600 * 1000).toISOString();
    const resolutionSlaDue = new Date(intakeMillis + resolutionSlaHours * 3600 * 1000).toISOString();

    return {
      departmentId: config.id,
      departmentName: config.departmentName,
      departmentCode: config.departmentCode,
      responseSlaHours,
      resolutionSlaHours,
      verificationSlaHours,
      responseSlaDue,
      resolutionSlaDue,
      verificationSlaDue: null, // Initialized when resolution proof is submitted
    };
  },

  /**
   * Evaluates Response SLA Clock
   * Clock STARTS at SUBMITTED and STOPS when marked SEEN by an officer.
   */
  evaluateResponseSLA(complaint, currentTime = new Date()) {
    if (!complaint) return null;

    const createdAt = new Date(complaint.createdAt || Date.now()).getTime();
    const dueAt = new Date(complaint.responseSlaDue || Date.now()).getTime();
    const seenAt = complaint.seenAt ? new Date(complaint.seenAt).getTime() : null;

    const totalDurationMillis = Math.max(1000, dueAt - createdAt);

    // If already seen, clock is stopped
    if (seenAt) {
      const durationTakenMillis = seenAt - createdAt;
      const isMet = seenAt <= dueAt;
      return {
        isStopped: true,
        isMet,
        isBreached: !isMet,
        stoppedAt: complaint.seenAt,
        hoursTaken: Number((durationTakenMillis / (3600 * 1000)).toFixed(1)),
        thresholdStatus: isMet ? 'MET' : 'BREACHED',
        label: isMet ? 'Response SLA Met' : 'Response SLA Breached',
      };
    }

    // Active countdown
    const currentMillis = currentTime.getTime();
    const elapsedMillis = currentMillis - createdAt;
    const remainingMillis = dueAt - currentMillis;
    const elapsedPercent = Math.min(100, Math.max(0, (elapsedMillis / totalDurationMillis) * 100));
    const isBreached = currentMillis > dueAt;

    let thresholdStatus = 'NORMAL';
    if (isBreached) {
      thresholdStatus = 'BREACHED';
    } else if (elapsedPercent >= SLA_WARNING_THRESHOLDS.URGENT.minPercent) {
      thresholdStatus = 'URGENT';
    } else if (elapsedPercent >= SLA_WARNING_THRESHOLDS.WARNING.minPercent) {
      thresholdStatus = 'WARNING';
    }

    const remainingHours = Math.max(0, remainingMillis / (3600 * 1000));
    const remainingMinutes = Math.max(0, Math.round(remainingMillis / (60 * 1000)));

    return {
      isStopped: false,
      isMet: false,
      isBreached,
      elapsedPercent: Number(elapsedPercent.toFixed(1)),
      remainingHours: Number(remainingHours.toFixed(1)),
      remainingMinutes,
      thresholdStatus,
      formattedCountdown: this.formatCountdown(remainingMillis, isBreached),
    };
  },

  /**
   * Evaluates Resolution SLA Clock
   * Clock STARTS at SUBMITTED and STOPS ONLY when VERIFIED_RESOLVED is confirmed by Admin.
   * Crucial rule: Clock continues running through RESOLUTION_SUBMITTED and VERIFICATION.
   */
  evaluateResolutionSLA(complaint, currentTime = new Date()) {
    if (!complaint) return null;

    const createdAt = new Date(complaint.createdAt || Date.now()).getTime();
    const dueAt = new Date(complaint.resolutionSlaDue || Date.now()).getTime();
    const resolvedAt = complaint.verifiedResolvedAt ? new Date(complaint.verifiedResolvedAt).getTime() : null;

    const totalDurationMillis = Math.max(1000, dueAt - createdAt);

    // If officially verified resolved, clock is stopped
    if (resolvedAt) {
      const durationTakenMillis = resolvedAt - createdAt;
      const isMet = resolvedAt <= dueAt;
      return {
        isStopped: true,
        isMet,
        isBreached: !isMet,
        stoppedAt: complaint.verifiedResolvedAt,
        hoursTaken: Number((durationTakenMillis / (3600 * 1000)).toFixed(1)),
        thresholdStatus: isMet ? 'MET' : 'BREACHED',
        label: isMet ? 'Resolution SLA Satisfied' : 'Resolution SLA Breached Prior to Sign-off',
      };
    }

    // Active countdown (continues running even if resolution proof is under review)
    const currentMillis = currentTime.getTime();
    const elapsedMillis = currentMillis - createdAt;
    const remainingMillis = dueAt - currentMillis;
    const elapsedPercent = Math.min(100, Math.max(0, (elapsedMillis / totalDurationMillis) * 100));
    const isBreached = currentMillis > dueAt;

    let thresholdStatus = 'NORMAL';
    if (isBreached) {
      thresholdStatus = 'BREACHED';
    } else if (elapsedPercent >= SLA_WARNING_THRESHOLDS.URGENT.minPercent) {
      thresholdStatus = 'URGENT';
    } else if (elapsedPercent >= SLA_WARNING_THRESHOLDS.WARNING.minPercent) {
      thresholdStatus = 'WARNING';
    }

    const remainingHours = Math.max(0, remainingMillis / (3600 * 1000));
    const remainingMinutes = Math.max(0, Math.round(remainingMillis / (60 * 1000)));

    return {
      isStopped: false,
      isMet: false,
      isBreached,
      elapsedPercent: Number(elapsedPercent.toFixed(1)),
      remainingHours: Number(remainingHours.toFixed(1)),
      remainingMinutes,
      thresholdStatus,
      isUnderVerification: [
        COMPLAINT_STATUS.RESOLUTION_SUBMITTED,
        COMPLAINT_STATUS.COMMUNITY_ACTION_SUBMITTED,
        COMPLAINT_STATUS.VERIFICATION,
      ].includes(complaint.status),
      formattedCountdown: this.formatCountdown(remainingMillis, isBreached),
    };
  },

  /**
   * Evaluates Admin Verification SLA Clock
   * Starts when resolution evidence is submitted. Must be verified within 24h.
   */
  evaluateVerificationSLA(complaint, currentTime = new Date()) {
    if (!complaint || !complaint.verificationSubmittedAt) {
      return { isActive: false, isOverdue: false, formattedCountdown: 'Not in Verification Queue' };
    }

    const submittedAt = new Date(complaint.verificationSubmittedAt).getTime();
    const windowHours = complaint.verificationSlaHours || DEFAULT_VERIFICATION_SLA_HOURS;
    const dueAt = submittedAt + windowHours * 3600 * 1000;
    const currentMillis = currentTime.getTime();

    // If verified resolved, verification is complete
    if (complaint.verifiedResolvedAt) {
      return {
        isActive: false,
        isCompleted: true,
        isOverdue: false,
        formattedCountdown: 'Verification Completed',
      };
    }

    const remainingMillis = dueAt - currentMillis;
    const isOverdue = currentMillis > dueAt;
    const remainingHours = Number((remainingMillis / (3600 * 1000)).toFixed(1));

    return {
      isActive: true,
      isCompleted: false,
      isOverdue,
      remainingHours: Math.max(0, remainingHours),
      overdueHours: isOverdue ? Number(((currentMillis - dueAt) / (3600 * 1000)).toFixed(1)) : 0,
      formattedCountdown: isOverdue
        ? `Verification Overdue by ${Math.abs(remainingHours)}h`
        : `Verification SLA: ${this.formatCountdown(remainingMillis, false)}`,
    };
  },

  /**
   * Formats remaining milliseconds into human-readable text
   */
  formatCountdown(remainingMillis, isBreached) {
    if (isBreached || remainingMillis <= 0) {
      const overdueHours = Math.abs(Math.round(remainingMillis / (3600 * 1000)));
      return overdueHours > 0 ? `SLA Breached (${overdueHours}h Overdue)` : 'SLA Breached (Overdue)';
    }

    const totalMinutes = Math.floor(remainingMillis / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return `${days}d ${remHours}h remaining`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  },
};
