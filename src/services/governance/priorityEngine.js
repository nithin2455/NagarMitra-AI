/**
 * @file priorityEngine.js
 * @description Centralized Dynamic Priority Governance Engine.
 * Implements multi-factor priority scoring ensuring safety risks and high severity
 * receive urgent triage regardless of community vote counts.
 */

import {
  CATEGORIES,
  SEVERITY_LEVELS,
  ESCALATION_LEVELS,
} from '../../models/schema.js';

export const priorityEngine = {
  /**
   * Calculates comprehensive multi-factor priority score
   * @param {Object} params
   * @param {string} params.severity - LOW, MEDIUM, HIGH, CRITICAL
   * @param {string} params.categoryId - Category ID
   * @param {number} params.supportCount - Citizen support/upvotes
   * @param {number} params.followUpCount - "Still Not Resolved" follow-ups
   * @param {string|Date} params.createdAt - Grievance creation date
   * @param {string} params.escalationLevel - Escalation level
   * @param {boolean} params.isResolutionBreached - Whether resolution SLA is breached
   */
  calculatePriority({
    severity = SEVERITY_LEVELS.MEDIUM,
    categoryId = 'other',
    supportCount = 0,
    followUpCount = 0,
    createdAt = new Date(),
    escalationLevel = ESCALATION_LEVELS.NOT_ESCALATED,
    isResolutionBreached = false,
  }) {
    // 1. Severity Factor (0 - 100)
    const severityWeights = {
      [SEVERITY_LEVELS.CRITICAL]: 100,
      [SEVERITY_LEVELS.HIGH]: 80,
      [SEVERITY_LEVELS.MEDIUM]: 50,
      [SEVERITY_LEVELS.LOW]: 20,
    };
    const severityScore = severityWeights[severity] || 50;

    // 2. Category Risk Factor (0 - 100)
    const key = (categoryId || 'other').toUpperCase();
    const catConfig = CATEGORIES[key] || CATEGORIES.OTHER;
    const categoryRiskScore = catConfig.baseRiskScore || 50;

    // 3. SLA Urgency Factor (0 - 100)
    let slaUrgencyScore = 40;
    if (isResolutionBreached) {
      slaUrgencyScore = 100;
    }

    // 4. Aging Factor (0 - 100)
    const elapsedHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / (1000 * 3600));
    const agingScore = Math.min(100, elapsedHours * 2.5);

    // 5. Community Signal Factor (0 - 100)
    // 1 upvote = +2 pts, 1 unique follow-up = +15 pts
    const communityScore = Math.min(100, supportCount * 2 + followUpCount * 15);

    // 6. Escalation Bonus
    let escalationBonus = 0;
    if (escalationLevel === ESCALATION_LEVELS.CRITICAL_ESCALATION) {
      escalationBonus = 25;
    } else if (escalationLevel === ESCALATION_LEVELS.SUPER_ADMIN_ESCALATED) {
      escalationBonus = 20;
    } else if (escalationLevel === ESCALATION_LEVELS.DEPARTMENT_ESCALATED) {
      escalationBonus = 12;
    } else if (escalationLevel === ESCALATION_LEVELS.WARNING) {
      escalationBonus = 5;
    }

    // Weighted aggregation: 35% Severity + 25% Category Risk + 20% SLA Urgency + 10% Aging + 10% Community
    let rawScore =
      severityScore * 0.35 +
      categoryRiskScore * 0.25 +
      slaUrgencyScore * 0.2 +
      agingScore * 0.1 +
      communityScore * 0.1 +
      escalationBonus;

    // Critical Safety Override Rule:
    // Any issue flagged with CRITICAL severity is guaranteed a minimum score of 85.0 (CRITICAL level)
    if (severity === SEVERITY_LEVELS.CRITICAL && rawScore < 85.0) {
      rawScore = 85.0;
    } else if (severity === SEVERITY_LEVELS.HIGH && rawScore < 65.0) {
      rawScore = 65.0;
    }

    const priorityScore = Number(rawScore.toFixed(1));
    const priorityLevel = this.getPriorityLevel(priorityScore);

    return {
      priorityScore,
      priorityLevel,
      factors: {
        severityScore,
        categoryRiskScore,
        slaUrgencyScore,
        agingScore: Number(agingScore.toFixed(1)),
        communityScore,
        escalationBonus,
      },
    };
  },

  /**
   * Maps numerical priority score to clear categorical level
   */
  getPriorityLevel(score) {
    if (score >= 85.0) return 'CRITICAL';
    if (score >= 65.0) return 'HIGH';
    if (score >= 40.0) return 'MEDIUM';
    return 'LOW';
  },
};
