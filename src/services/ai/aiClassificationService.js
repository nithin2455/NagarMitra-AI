/**
 * @file aiClassificationService.js
 * @description Frontend client service for CivicPulse AI Component 1 (Complaint Classification).
 * Communicates with the Python ML Prediction API (http://127.0.0.1:8000/predict).
 * Implements non-blocking graceful fallback if the ML server is unreachable.
 */

const ML_API_BASE_URL = 'http://127.0.0.1:8000';

export const aiClassificationService = {
  /**
   * Predict department and category for a citizen complaint
   * @param {Object} params - { description, title }
   * @returns {Promise<Object>} Prediction result or fallback status
   */
  async predictCategory({ description, title = '' }) {
    if (!description || !description.trim()) {
      return {
        isAvailable: true,
        category: 'other',
        categoryName: 'Other / New Issue',
        department: 'other',
        departmentName: 'General Municipal Operations',
        departmentCode: 'DEPT_GENERAL',
        confidence: 0.0,
        modelVersion: '1.0.0',
        isFallback: true,
        message: 'Description text is required for AI analysis.',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(`${ML_API_BASE_URL}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
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
        category: data.category || 'other',
        categoryName: data.categoryName || 'Other / New Issue',
        department: data.department || 'other',
        departmentName: data.departmentName || 'General Municipal Operations',
        departmentCode: data.departmentCode || 'DEPT_GENERAL',
        confidence: typeof data.confidence === 'number' ? data.confidence : 0.0,
        modelVersion: data.modelVersion || '1.0.0',
        allProbabilities: data.allProbabilities || {},
        isFallback: Boolean(data.isFallback),
      };
    } catch (err) {
      console.warn('AI Classification API unavailable or timed out. Falling back to manual routing.', err.message);
      return {
        isAvailable: false,
        error: err.message,
        message: 'AI classification service is currently offline. Manual department selection is active.',
      };
    }
  },

  /**
   * Health check for ML API status
   */
  async checkHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${ML_API_BASE_URL}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  },
};
