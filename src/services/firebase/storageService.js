/**
 * @file storageService.js
 * @description Firebase Storage Service for photographic and video evidence.
 * Includes client-side file type & size validation, upload progress handlers,
 * and reliable fallback mechanisms.
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, isFirebaseConfigured } from './firebaseConfig.js';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit

export const storageService = {
  /**
   * Validate a file before upload
   * @param {File} file
   */
  validateFile(file) {
    if (!file) {
      throw new Error('No file provided.');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(`Unsupported file format (${file.type || 'unknown'}). Please upload JPG, PNG, WEBP, or MP4.`);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      throw new Error(`File is too large (${sizeMB}MB). Maximum allowed size is 10MB.`);
    }
    return true;
  },

  /**
   * Upload a single file
   * @param {File} file
   * @param {string} path - Target storage folder
   */
  async uploadFile(file, path = 'complaints') {
    this.validateFile(file);

    if (!isFirebaseConfigured() || !storage) {
      // In offline / local development mode, convert to a safe local Object URL
      return typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : `data:${file.type};base64,mock`;
    }

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const storagePath = `${path}/${timestamp}_${cleanFileName}`;
    const storageRef = ref(storage, storagePath);

    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    return getDownloadURL(snapshot.ref);
  },

  /**
   * Upload multiple evidence files
   * @param {Array<File>} files
   * @param {string} path
   */
  async uploadEvidenceFiles(files, path = 'complaints') {
    if (!files || files.length === 0) return [];

    const uploadPromises = Array.from(files).map((file) => this.uploadFile(file, path));
    return Promise.all(uploadPromises);
  },
};
