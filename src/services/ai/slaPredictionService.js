/**
 * @file slaPredictionService.js
 * @description Frontend client service for CivicPulse AI Component 5 (AI SLA Breach Prediction).
 * Communicates with the Python Random Forest API (http://127.0.0.1:8000/predict-sla-breach).
 * Includes graceful client-side fallback engine if the ML server is unreachable.
 */

const ML_API_BASE_URL = 'http://127.0.0.1:8000';

const URGENCY_KEYWORDS = [
  'danger', 'hazard', 'immediate', 'sewage', 'collapse', 'cholera', 'accident',
  'accidents', 'sparking', 'life', 'emergency', 'broken', 'severe', 'overflowing',
  'foul', 'panic', 'pothole', 'burst', 'high-voltage', 'flood', 'contamination'
];

export const slaPredictionService = {
  /**
   * Predict SLA breach probability and risk level for a complaint at submission time
   * @param {Object} complaint
   * @returns {Promise<Object>} SLA breach prediction result
   */
  async predictSLABreach(complaint = {}) {
    const {
      title = '',
      description = '',
      category_id = 'other',
      department_id = 'DEPT_GENERAL',
      predicted_severity = 'MEDIUM',
      severity_probabilities = {},
      master_issue_count_at_submission = 1,
      support_count_at_submission = 1,
      hotspot_score_at_submission = 0.0,
      density_score_at_submission = 0.0,
      is_hotspot_area = 0,
      response_sla_hours = 12.0,
      latitude = 13.0827,
      longitude = 80.2707,
      created_hour = new Date().getHours(),
      created_day_of_week = new Date().getDay(),
      created_month = new Date().getMonth() + 1,
      is_weekend = [0, 6].includes(new Date().getDay()) ? 1 : 0,
      is_working_hours = (new Date().getHours() >= 8 && new Date().getHours() <= 18 && ![0, 6].includes(new Date().getDay())) ? 1 : 0,
    } = complaint;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(`${ML_API_BASE_URL}/predict-sla-breach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category_id,
          department_id,
          predicted_severity,
          severity_probabilities,
          master_issue_count_at_submission,
          support_count_at_submission,
          hotspot_score_at_submission,
          density_score_at_submission,
          is_hotspot_area,
          response_sla_hours,
          latitude,
          longitude,
          created_hour,
          created_day_of_week,
          created_month,
          is_weekend,
          is_working_hours,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ML API returned status ${response.status}`);
      }

      const data = await response.json();
      return {
        isAvailable: true,
        isFallback: false,
        ...data,
      };
    } catch (err) {
      console.warn('AI SLA Breach API offline/timeout. Executing JS client fallback engine.', err.message);

      // JS Client Fallback Heuristic
      const offHours = !is_working_hours;
      const isHotspot = hotspot_score_at_submission >= 60.0 || is_hotspot_area === 1;

      let baseProb = 0.25;
      if (offHours) baseProb += 0.35;
      if (isHotspot) baseProb += 0.20;
      if (response_sla_hours <= 4.0) baseProb += 0.15;

      const breachProb = Math.min(0.95, Math.max(0.05, baseProb));
      const riskLevel = breachProb < 0.35 ? 'LOW' : (breachProb < 0.65 ? 'MEDIUM' : 'HIGH');

      return {
        isAvailable: true,
        isFallback: true,
        breach_probability: Number(breachProb.toFixed(4)),
        predicted_breach: breachProb >= 0.50,
        risk_level: riskLevel,
        threshold_low_medium: 0.35,
        threshold_medium_high: 0.65,
        model_version: '5.0.0-js-fallback',
        top_factors: [offHours ? 'is_working_hours' : 'response_sla_hours', 'hotspot_score_at_submission'],
        message: 'Client-side fallback prediction active',
      };
    }
  },
};

export default slaPredictionService;
