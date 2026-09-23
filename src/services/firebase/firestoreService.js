/**
 * @file firestoreService.js
 * @description Firestore database service interface for CRUD operations across collections.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebaseConfig.js';
import { auditLogService } from './auditLogService.js';

export const firestoreService = {
  /**
   * Fetch a single document by collection and ID
   */
  async getDocument(collectionName, id) {
    if (!isFirebaseConfigured() || !db) return null;
    const docRef = doc(db, collectionName, id);
    const snap = await getDoc(docRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  /**
   * Fetch multiple documents with optional query constraints
   */
  async getDocuments(collectionName, constraints = []) {
    if (!isFirebaseConfigured() || !db) return [];
    const colRef = collection(db, collectionName);
    const q = query(colRef, ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  /**
   * Add a new document to a collection
   */
  async createDocument(collectionName, data) {
    if (!isFirebaseConfigured() || !db) {
      return { id: 'mock_doc_' + Date.now(), ...data, createdAt: new Date().toISOString() };
    }
    const colRef = collection(db, collectionName);
    const docRef = await addDoc(colRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id, ...data };
  },

  /**
   * Update an existing document
   */
  async updateDocument(collectionName, id, updates) {
    if (!isFirebaseConfigured() || !db) {
      return { id, ...updates, updatedAt: new Date().toISOString() };
    }
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { id, ...updates };
  },

  /**
   * Append an immutable audit log entry (delegates to production auditLogService)
   */
  async logAuditEvent(complaintId, actorId, actorRole, action, previousState, newState, remarks = '') {
    return auditLogService.logAction({
      grievanceId: complaintId,
      complaintNumber: complaintId,
      actorUid: actorId,
      actorName: actorRole ? `${actorRole.toUpperCase()} (${actorId})` : 'Authorized User',
      actorRole: actorRole || 'system',
      action,
      previousStatus: previousState,
      newStatus: newState,
      details: remarks,
      timestamp: new Date().toISOString(),
    });
  },
};
