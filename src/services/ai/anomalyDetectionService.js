/**
 * @file anomalyDetectionService.js
 * @description Frontend client service for CivicPulse AI Component 6 (AI Anomaly & Pattern Detection).
 * Communicates with the Python Isolation Forest API (http://127.0.0.1:8000/predict-anomaly and /analyze-anomalies).
 * Includes graceful client-side fallback engine if the ML server is unreachable.
 */

const ML_API_BASE_URL = 'http://127.0.0.1:8000';

export const anomalyDetectionService = {
  /**
   * Predict anomaly score and level for a single operational window observation
   * @param {Object} windowData
   * @returns {Promise<Object>} Anomaly prediction result
   */
  async predictAnomaly(windowData = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(`${ML_API_BASE_URL}/predict-anomaly`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(windowData),
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
      console.warn('AI Anomaly API offline/timeout. Executing JS client fallback engine.', err.message);

      const rawVol = Number(windowData.raw_report_count || 10);
      const dupRatio = Number(windowData.duplicate_ratio || 0.0);
      const hotspot = Number(windowData.hotspot_score || 0.0);
      const critRatio = Number(windowData.critical_ratio || 0.0);

      let score = 0.35;
      if (rawVol >= 30) score += 0.30;
      if (dupRatio >= 0.80) score += 0.20;
      if (hotspot >= 80.0) score += 0.15;
      if (critRatio >= 0.60) score += 0.15;

      const finalScore = Math.min(0.98, Math.max(0.10, score));
      const level = finalScore < 0.50 ? 'LOW' : finalScore < 0.75 ? 'MEDIUM' : 'HIGH';

      return {
        isAvailable: true,
        isFallback: true,
        is_anomaly: finalScore >= 0.50,
        anomaly_score: Number(finalScore.toFixed(4)),
        anomaly_level: level,
        anomaly_type: rawVol >= 30 ? 'VOLUME_SPIKE' : dupRatio >= 0.80 ? 'DUPLICATE_CONCENTRATION' : 'NORMAL_PATTERN',
        contributing_indicators: [
          rawVol >= 30 ? `Raw report volume is elevated (${rawVol} complaints)` : 'Normal volume',
        ],
        threshold_low_medium: 0.50,
        threshold_medium_high: 0.75,
        model_version: '6.0.0-js-fallback',
        timestamp: windowData.date || new Date().toISOString(),
      };
    }
  },

  /**
   * Analyze batch of historical operational windows for Admin Dashboard
   * @param {Array<Object>} windows
   * @returns {Promise<Object>} Batch analysis results
   */
  async analyzeAnomaliesBatch(windows = []) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${ML_API_BASE_URL}/analyze-anomalies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ windows }),
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
      console.warn('AI Batch Anomaly API offline/timeout. Executing JS client fallback batch analysis.', err.message);

      const fallbackResults = await Promise.all(windows.map((w) => this.predictAnomaly(w)));
      const formatted = fallbackResults.map((r, i) => ({
        window_id: windows[i].window_id || `WIN-${i + 1}`,
        date: windows[i].date || new Date().toISOString(),
        department_code: windows[i].department_code || 'DEPT_GENERAL',
        raw_report_count: windows[i].raw_report_count || 0,
        master_issue_count: windows[i].master_issue_count || 0,
        duplicate_ratio: windows[i].duplicate_ratio || 0.0,
        hotspot_score: windows[i].hotspot_score || 0.0,
        ...r,
      }));

      formatted.sort((a, b) => b.anomaly_score - a.anomaly_score);
      const anomCount = formatted.filter((f) => f.is_anomaly).length;

      return {
        isAvailable: true,
        isFallback: true,
        results: formatted,
        total_analyzed: formatted.length,
        anomalies_detected: anomCount,
        model_version: '6.0.0-js-fallback',
      };
    }
  },
};

export default anomalyDetectionService;
