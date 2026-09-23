/**
 * @file firebaseConfig.js
 * @description Firebase app initialization with graceful fallback for local development.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const getEnv = (key, fallback) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return fallback;
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY', 'mock_api_key'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', 'smart-grievance-demo.firebaseapp.com'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', 'smart-grievance-demo'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', 'smart-grievance-demo.appspot.com'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '1234567890'),
  appId: getEnv('VITE_FIREBASE_APP_ID', '1:1234567890:web:abcdef123456'),
};

// Check if Firebase is configured with real credentials
export const isFirebaseConfigured = () => {
  const apiKey = getEnv('VITE_FIREBASE_API_KEY', 'mock_api_key');
  return Boolean(apiKey && apiKey !== 'mock_api_key' && apiKey !== 'your_api_key_here');
};

let app;
let auth;
let db;
let storage;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  console.warn('Firebase initialization notice (running in prototype mode):', error.message);
}

export { app, auth, db, storage };
