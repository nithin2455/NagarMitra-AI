import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge, SeverityBadge } from '../../components/common/Badge';
import { CATEGORIES, SEVERITY_LEVELS, COMPLAINT_VISIBILITY } from '../../models/schema.js';
import { grievanceService } from '../../services/firebase/grievanceService.js';
import { storageService } from '../../services/firebase/storageService.js';
import { aiClassificationService } from '../../services/ai/aiClassificationService.js';
import { severityPredictionService } from '../../services/ai/severityPredictionService.js';
import { useAuth } from '../../context/AuthContext';
import {
  UploadCloud,
  MapPin,
  Send,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  FileText,
  Compass,
  AlertCircle,
  Building2,
  Clock,
  Home,
  Search,
  ThumbsUp,
  HelpCircle,
  Sparkles,
  Cpu,
  Check,
} from 'lucide-react';

export const ReportGrievancePage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [category, setCategory] = useState('roads');
  const [customCategory, setCustomCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ward, setWard] = useState('Ward 8 - Central Zone');
  const [landmark, setLandmark] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [visibility, setVisibility] = useState(COMPLAINT_VISIBILITY.PUBLIC);
  const [files, setFiles] = useState([]);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsNotice, setGpsNotice] = useState('');

  // Duplicate Check Assistance State
  const [existingIssues, setExistingIssues] = useState([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // AI Component 1 & Component 4 State
  const [aiPrediction, setAiPrediction] = useState(null);
  const [aiSeverityPrediction, setAiSeverityPrediction] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);
  const [aiSeverityApplied, setAiSeverityApplied] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submittedGrievance, setSubmittedGrievance] = useState(null);
  const [formError, setFormError] = useState('');

  const slaPreview = grievanceService.calculateSLA(category, severity);

  // AI Classification & Severity Effect — Triggered when title or description changes (Debounced 500ms)
  useEffect(() => {
    const textToAnalyze = `${title.trim()} ${description.trim()}`.trim();
    if (textToAnalyze.length < 10) {
      setAiPrediction(null);
      setAiSeverityPrediction(null);
      setAiApplied(false);
      setAiSeverityApplied(false);
      return;
    }

    const triggerAI = async () => {
      setAiLoading(true);
      try {
        const [classRes, sevRes] = await Promise.all([
          aiClassificationService.predictCategory({ title, description }),
          severityPredictionService.predictSeverity({ title, description, category_id: category })
        ]);
        setAiPrediction(classRes);
        setAiSeverityPrediction(sevRes);
      } catch (err) {
        console.warn('AI predictions failed:', err);
      } finally {
        setAiLoading(false);
      }
    };

    const timer = setTimeout(triggerAI, 500);
    return () => clearTimeout(timer);
  }, [title, description, category]);

  const handleApplyAISuggestion = () => {
    if (aiPrediction && aiPrediction.isAvailable && aiPrediction.category) {
      setCategory(aiPrediction.category);
      setAiApplied(true);
    }
  };

  const handleApplyAISeverity = () => {
    if (aiSeverityPrediction && aiSeverityPrediction.isAvailable && aiSeverityPrediction.predicted_severity) {
      setSeverity(aiSeverityPrediction.predicted_severity);
      setAiSeverityApplied(true);
    }
  };

  // Live duplicate checking on title or category/ward change
  useEffect(() => {
    const checkDuplicates = async () => {
      if (title.trim().length < 4) {
        setExistingIssues([]);
        return;
      }
      setCheckingDuplicates(true);
      try {
        const matches = await grievanceService.checkExistingIssues({
          categoryId: category,
          ward,
          searchKeyword: title,
        });
        setExistingIssues(matches);
      } catch (err) {
        console.error('Error checking existing issues:', err);
      } finally {
        setCheckingDuplicates(false);
      }
    };

    const timer = setTimeout(checkDuplicates, 400);
    return () => clearTimeout(timer);
  }, [title, category, ward]);

  const handleFetchGPS = () => {
    if (!navigator.geolocation) {
      setGpsNotice('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    setGpsNotice('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
        });
        setGpsNotice(`GPS Coordinates acquired: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        setGpsLoading(false);
      },
      (err) => {
        setGpsNotice('Location access declined. You can manually enter the landmark below.');
        setGpsLoading(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleFileChange = (e) => {
    setFormError('');
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      for (const file of selected) {
        try {
          storageService.validateFile(file);
        } catch (err) {
          setFormError(err.message);
          return;
        }
      }
      setFiles((prev) => [...prev, ...selected]);
    }
  };

  const handleRemoveFile = (indexToRemove) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (submitting) return;

    if (!title.trim()) {
      setFormError('Please enter a descriptive issue title.');
      return;
    }
    if (!description.trim()) {
      setFormError('Please provide a detailed description of the grievance.');
      return;
    }
    if (category === 'other' && !customCategory.trim()) {
      setFormError('Please specify the custom category for this issue.');
      return;
    }
    if (!ward.trim()) {
      setFormError('Please select a Municipal Ward.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        categoryId: category,
        customCategory: customCategory.trim(),
        title: title.trim(),
        description: description.trim(),
        ward: ward.trim(),
        landmark: landmark.trim(),
        severity,
        visibility,
        isSensitive: visibility === COMPLAINT_VISIBILITY.SENSITIVE,
        lat: gpsLocation?.lat || null,
        lng: gpsLocation?.lng || null,
        aiClassification: aiPrediction?.isAvailable ? aiPrediction : null,
      };

      const result = await grievanceService.createGrievance(currentUser, payload, files);
      setSubmittedGrievance(result);
    } catch (err) {
      setFormError(err.message || 'Failed to submit grievance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedGrievance) {
    return (
      <div style={{ maxWidth: '650px', margin: '0 auto', textAlign: 'center' }}>
        <Card>
          <div
            style={{
              width: '4rem',
              height: '4rem',
              background: 'var(--success-bg)',
              color: 'var(--success-solid)',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
            }}
          >
            <CheckCircle2 size={36} />
          </div>

          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>Grievance Submitted Successfully</h1>
          <p style={{ color: 'var(--slate-600)', fontSize: '0.925rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            Your complaint has been logged and assigned to the responsible municipal department.
          </p>

          <div
            style={{
              background: 'var(--slate-50)',
              border: '1px solid var(--slate-200)',
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.75rem',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--slate-200)', paddingBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>Grievance Reference ID</span>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--primary-800)' }}>
                {submittedGrievance.id}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>Assigned Department</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--slate-800)' }}>
                {submittedGrievance.departmentName}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>Visibility Level</span>
              <span className="badge badge-neutral">{submittedGrievance.visibility}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>Calculated Resolution SLA</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--primary-700)' }}>
                {submittedGrievance.resolutionSlaHours} Hours
              </strong>
            </div>

            {submittedGrievance.isDuplicate && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.85rem',
                  background: 'var(--primary-50, #eff6ff)',
                  border: '1px solid var(--primary-200, #bfdbfe)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.825rem',
                  color: 'var(--primary-900, #1e3a8a)',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                  <Sparkles size={16} style={{ color: 'var(--primary-600)' }} />
                  <span>AI Multimodal Issue Consolidation Active</span>
                </div>
                <div>
                  Your submission was matched with existing <strong>Master Issue #{submittedGrievance.masterComplaintId}</strong> (Group: {submittedGrievance.duplicateGroupId}) with{' '}
                  <strong>{((submittedGrievance.duplicateMatchConfidence || 0) * 100).toFixed(1)}% match confidence</strong> based on text, location, and visual evidence.
                </div>
                <div style={{ fontSize: '0.775rem', marginTop: '0.35rem', color: 'var(--slate-600)' }}>
                  ✓ Your submission is saved individually for audit and tracking, while increasing the priority score of the Master Issue.
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to={`/citizen/grievance/${submittedGrievance.id}`}>
              <Button variant="primary" icon={ArrowRight}>
                View Grievance
              </Button>
            </Link>
            <Link to="/citizen/my-grievances">
              <Button variant="secondary" icon={FileText}>
                My Submissions
              </Button>
            </Link>
            <Link to="/citizen">
              <Button variant="outline" icon={Home}>
                Return to Citizen Portal
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Report a Public Grievance</h1>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem' }}>
          Submit details and photos. The platform automatically determines the responsible department and response deadlines.
        </p>
      </div>

      <Card>
        {formError && (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger-text)',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={18} />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Category & Dynamic Department Banner */}
          <div className="form-group">
            <label className="form-label">Grievance Category *</label>
            <select
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={submitting}
            >
              {Object.values(CATEGORIES).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Automatic Department & SLA Routing Indicator */}
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--primary-50)',
              border: '1px solid var(--primary-200)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.825rem',
              color: 'var(--primary-900)',
              marginBottom: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Building2 size={16} style={{ color: 'var(--primary-700)' }} />
              <span>Assigned Authority: <strong>{slaPreview.departmentName}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={16} style={{ color: 'var(--primary-700)' }} />
              <span>SLA: <strong>{slaPreview.responseSlaHours}h Response</strong> / <strong>{slaPreview.resolutionSlaHours}h Resolution</strong></span>
            </div>
          </div>

          {category === 'other' && (
            <div className="form-group">
              <label className="form-label">Specify Custom Issue Category *</label>
              <input
                type="text"
                required
                placeholder="Describe the unlisted issue category"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="form-input"
                disabled={submitting}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Issue Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Deep pothole on 4th Main Road creating hazard for two-wheelers"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              disabled={submitting}
            />
          </div>

          {/* Duplicate Detection Assistant */}
          {existingIssues.length > 0 && (
            <div
              style={{
                background: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--warning-text)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <Search size={15} />
                Similar Public Issues Already Reported ({existingIssues.length})
              </div>
              <p style={{ fontSize: '0.785rem', color: 'var(--slate-600)', marginBottom: '0.75rem' }}>
                A similar issue may already be under municipal review. You can support existing issues to elevate their priority rather than creating duplicate complaints:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {existingIssues.map((match) => (
                  <div
                    key={match.id}
                    style={{
                      background: '#ffffff',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--slate-200)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.825rem',
                    }}
                  >
                    <div>
                      <strong>{match.grievanceId || match.id}:</strong> {match.title}
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                        {match.ward} • Status: {match.status} • Support: {match.supportCount || 0}
                      </div>
                    </div>
                    <Link to="/feed">
                      <Button variant="secondary" size="sm" icon={ThumbsUp}>
                        View & Support in Feed
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Detailed Description *</label>
            <textarea
              rows={4}
              required
              placeholder="Detail the location, public risk, severity, and any relevant landmark details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-textarea"
              disabled={submitting}
            />
          </div>

          {/* AI Intelligent Classification Assistance Card */}
          {aiLoading && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f0fa 100%)',
                border: '1px solid #bae6fd',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.825rem',
                color: '#0369a1',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <Cpu size={18} className="animate-spin" style={{ color: '#0284c7' }} />
              <span>AI is analyzing complaint description to suggest the department & category...</span>
            </div>
          )}

          {!aiLoading && aiPrediction && aiPrediction.isAvailable && !aiPrediction.isFallback && (
            <div
              style={{
                padding: '1rem 1.25rem',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                border: '1px solid #cbd5e1',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.6rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontWeight: 600, fontSize: '0.875rem' }}>
                  <Sparkles size={18} style={{ color: '#0284c7' }} />
                  <span>AI Assistance — Intelligent Routing Recommendation</span>
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '1rem',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #7dd3fc',
                  }}
                >
                  Model Confidence: {(aiPrediction.confidence * 100).toFixed(1)}%
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.825rem', color: '#334155', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Suggested Category:</span>{' '}
                  <strong style={{ color: '#0f172a' }}>{aiPrediction.categoryName}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Suggested Department:</span>{' '}
                  <strong style={{ color: '#0369a1' }}>{aiPrediction.departmentName}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {category === aiPrediction.category || aiApplied ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#15803d', fontSize: '0.8rem', fontWeight: 600 }}>
                    <Check size={16} />
                    <span>AI Classification Applied to Grievance</span>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={Sparkles}
                    onClick={handleApplyAISuggestion}
                  >
                    Apply AI Suggestion ({aiPrediction.categoryName})
                  </Button>
                )}
              </div>
            </div>
          )}

          {!aiLoading && aiPrediction && !aiPrediction.isAvailable && (
            <div
              style={{
                padding: '0.6rem 0.85rem',
                background: '#fffbe6',
                border: '1px solid #ffe58f',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                color: '#d46b08',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={15} />
              <span>AI classification service is currently offline. Manual department selection is active.</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Ward / Zone *</label>
              <select
                className="form-select"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                disabled={submitting}
              >
                <option value="Ward 4 - North Zone">Ward 4 - North Zone</option>
                <option value="Ward 8 - Central Zone">Ward 8 - Central Zone</option>
                <option value="Ward 12 - South Zone">Ward 12 - South Zone</option>
                <option value="Ward 16 - East Zone">Ward 16 - East Zone</option>
                <option value="Ward 18 - West Zone">Ward 18 - West Zone</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Severity Level</label>
              <select
                className="form-select"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                disabled={submitting}
              >
                <option value="LOW">Low (Minor cosmetic / non-urgent)</option>
                <option value="MEDIUM">Medium (Standard civic disruption)</option>
                <option value="HIGH">High (Substantial health or traffic hazard)</option>
                <option value="CRITICAL">Critical (Immediate safety / life hazard)</option>
              </select>
            </div>
          </div>

          {/* 3-Tier Visibility Configuration */}
          <div className="form-group">
            <label className="form-label">Complaint Visibility Level *</label>
            <select
              className="form-select"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              disabled={submitting}
            >
              <option value={COMPLAINT_VISIBILITY.PUBLIC}>
                Public (Appears in Community Feed with generalized location and anonymous reporting)
              </option>
              <option value={COMPLAINT_VISIBILITY.PRIVATE}>
                Private (Visible only to you and authorized municipal department officials)
              </option>
              <option value={COMPLAINT_VISIBILITY.SENSITIVE}>
                Sensitive / Confidential (Strictly restricted access for sensitive public complaints)
              </option>
            </select>
          </div>

          {/* Location & GPS */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Specific Landmark / Address Reference</label>
              <button
                type="button"
                onClick={handleFetchGPS}
                disabled={gpsLoading || submitting}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary-700)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  cursor: 'pointer',
                }}
              >
                <Compass size={14} />
                {gpsLoading ? 'Acquiring GPS...' : 'Use Current GPS'}
              </button>
            </div>

            <input
              type="text"
              placeholder="e.g. Opposite Post Office, near Junction 4"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              className="form-input"
              disabled={submitting}
            />

            {gpsNotice && (
              <div style={{ fontSize: '0.75rem', color: gpsLocation ? 'var(--success-solid)' : 'var(--slate-500)', marginTop: '0.35rem' }}>
                {gpsNotice}
              </div>
            )}
          </div>

          {/* Evidence Upload */}
          <div className="form-group">
            <label className="form-label">Photographic / Video Evidence</label>
            <label
              style={{
                display: 'block',
                border: '2px dashed var(--slate-300)',
                borderRadius: 'var(--radius-md)',
                padding: '1.75rem',
                textAlign: 'center',
                background: 'var(--slate-50)',
                color: 'var(--slate-500)',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,video/mp4"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                disabled={submitting}
              />
              <UploadCloud size={32} style={{ margin: '0 auto 0.5rem auto', color: 'var(--primary-600)' }} />
              <div style={{ fontWeight: 600, color: 'var(--slate-700)' }}>
                {files.length > 0 ? `${files.length} file(s) attached` : 'Click to upload evidence photos or video'}
              </div>
              <div style={{ fontSize: '0.75rem' }}>JPG, PNG, WEBP, MP4 (Max 10MB per file)</div>
            </label>

            {files.length > 0 && (
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {files.map((f, i) => (
                  <span
                    key={i}
                    className="badge badge-neutral"
                    style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <span>{f.name} ({(f.size / 1024).toFixed(0)}KB)</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(i)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            icon={Send}
            size="lg"
            loading={submitting}
            disabled={submitting}
            style={{ width: '100%', marginTop: '0.75rem' }}
          >
            {submitting ? 'Registering Grievance...' : 'Submit Grievance for Verification'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
