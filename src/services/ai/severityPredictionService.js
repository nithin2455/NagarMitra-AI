/**
 * @file severityPredictionService.js
 * @description Frontend client service for CivicPulse AI Component 4 (Severity / Priority Prediction).
 * Communicates with the Python Random Forest API (http://127.0.0.1:8000/predict-severity).
 * Includes graceful client-side fallback engine if the ML server is unreachable.
 */

const ML_API_BASE_URL = 'http://127.0.0.1:8000';

const URGENCY_KEYWORDS = [
  'danger', 'hazard', 'immediate', 'sewage', 'collapse', 'cholera', 'accident',
  'accidents', 'sparking', 'life', 'emergency', 'broken', 'severe', 'overflowing',
  'foul', 'panic', 'pothole', 'burst', 'high-voltage', 'flood', 'contamination',
  'injury', 'fatal', 'electric', 'toxic', 'poisonous', 'die', 'leak', 'open'
];

export const severityPredictionService = {
  /**
   * Predict severity / priority level for a municipal complaint
   * @param {Object} params - { title, description, category_id, department_code, district, support_count, master_issue_count, hotspot_priority }
   * @returns {Promise<Object>} Severity prediction result with fallback support
   */
  async predictSeverity(complaint = {}) {
    const {
      title = '',
      description = '',
      category_id = 'other',
      department_code = 'DEPT_GENERAL',
      district = 'Chennai Central',
      support_count = 0,
      master_issue_count = 1,
      hotspot_priority = 0.0,
    } = complaint;

    if (!description && !title) {
      return {
        isAvailable: true,
        predicted_severity: 'MEDIUM',
        confidence: 0.5,
        recommended_action: 'Standard Review',
        isFallback: true,
        message: 'No description text provided for AI analysis.',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(`${ML_API_BASE_URL}/predict-severity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category_id,
          department_code,
          district,
          support_count,
          master_issue_count,
          hotspot_priority,
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
      console.warn('AI Severity API offline/timeout. Executing JS client fallback heuristic engine.', err.message);

      // JS Client Fallback Engine
      const fullText = (title + ' ' + description).toLowerCase();
      let matchCount = 0;
      URGENCY_KEYWORDS.forEach((kw) => {
        if (fullText.includes(kw)) matchCount++;
      });

      let predSeverity = 'LOW';
      if (category_id === 'drainage' || category_id === 'water' || matchCount >= 3) {
        predSeverity = 'CRITICAL';
      } else if (category_id === 'roads' || category_id === 'streetlights' || matchCount >= 1) {
        predSeverity = 'HIGH';
      } else if (category_id === 'garbage' || category_id === 'infrastructure') {
        predSeverity = 'MEDIUM';
      }

      return {
        isAvailable: true,
        isFallback: true,
        predicted_severity: predSeverity,
        confidence: 0.75,
        recommended_action: 'Priority Field Inspection (Client Fallback)',
        class_probabilities: {
          LOW: predSeverity === 'LOW' ? 0.75 : 0.08,
          MEDIUM: predSeverity === 'MEDIUM' ? 0.75 : 0.08,
          HIGH: predSeverity === 'HIGH' ? 0.75 : 0.08,
          CRITICAL: predSeverity === 'CRITICAL' ? 0.75 : 0.08,
        },
        modelVersion: '1.0.0-js-fallback',
      };
    }
  },
};

export default severityPredictionService;
