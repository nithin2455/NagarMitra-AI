/**
 * @file authService.js
 * @description Production Authentication & Authorization Service.
 * Interfaces with Firebase Authentication and Firestore User Profiles (/users/{uid}).
 * Strict Security Rules: Public self-registration is permanently restricted to CITIZEN role.
 */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebaseConfig.js';
import { auditLogService } from './auditLogService.js';
import { USER_ROLES, AUDIT_ACTIONS } from '../../models/schema.js';

// Local storage session key for client persistence
const LOCAL_SESSION_KEY = 'civicpulse_auth_session';
const LOCAL_USERS_KEY = 'civicpulse_users_directory';

// Provisioned Department & Administrative Seed Accounts
export const INITIAL_PROVISIONED_ACCOUNTS = {
  'citizen@civicpulse.org': {
    uid: 'cp-citizen-usr-01',
    email: 'citizen@civicpulse.org',
    password: 'Citizen@123',
    displayName: 'Aarav Sharma',
    role: USER_ROLES.CITIZEN,
    departmentId: null,
    accountStatus: 'active',
    phone: '+91 9876543210',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  'officer.roads@civicpulse.org': {
    uid: 'cp-officer-roads-01',
    email: 'officer.roads@civicpulse.org',
    password: 'Officer@123',
    displayName: 'Dave Peterson (Roads Dept)',
    role: USER_ROLES.OFFICER,
    departmentId: 'roads',
    accountStatus: 'active',
    phone: '+91 9876543211',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  'officer.sanitation@civicpulse.org': {
    uid: 'cp-officer-sanitation-01',
    email: 'officer.sanitation@civicpulse.org',
    password: 'Officer@123',
    displayName: 'Anil Deshmukh (Sanitation Dept)',
    role: USER_ROLES.OFFICER,
    departmentId: 'garbage',
    accountStatus: 'active',
    phone: '+91 9876543220',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  'officer.water@civicpulse.org': {
    uid: 'cp-officer-water-01',
    email: 'officer.water@civicpulse.org',
    password: 'Officer@123',
    displayName: 'Suresh Kumar (Water Dept)',
    role: USER_ROLES.OFFICER,
    departmentId: 'water',
    accountStatus: 'active',
    phone: '+91 9876543221',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  'officer.drainage@civicpulse.org': {
    uid: 'cp-officer-drainage-01',
    email: 'officer.drainage@civicpulse.org',
    password: 'Officer@123',
    displayName: 'Kavita Rao (Drainage Dept)',
    role: USER_ROLES.OFFICER,
    departmentId: 'drainage',
    accountStatus: 'active',
    phone: '+91 9876543222',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  'officer.electricity@civicpulse.org': {
    uid: 'cp-officer-electricity-01',
    email: 'officer.electricity@civicpulse.org',
    password: 'Officer@123',
    displayName: 'Ravi Shankar (Electricity Dept)',
    role: USER_ROLES.OFFICER,
    departmentId: 'streetlights',
    accountStatus: 'active',
    phone: '+91 9876543223',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  'officer.works@civicpulse.org': {
    uid: 'cp-officer-works-01',
    email: 'officer.works@civicpulse.org',
    password: 'Officer@123',
    displayName: 'Pooja Hegde (Public Works Dept)',
    role: USER_ROLES.OFFICER,
    departmentId: 'infrastructure',
    accountStatus: 'active',
    phone: '+91 9876543224',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  'officer.general@civicpulse.org': {
    uid: 'cp-officer-general-01',
    email: 'officer.general@civicpulse.org',
    password: 'Officer@123',
    displayName: 'Amit Roy (General Operations)',
    role: USER_ROLES.OFFICER,
    departmentId: 'other',
    accountStatus: 'active',
    phone: '+91 9876543225',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  'admin.roads@civicpulse.org': {
    uid: 'cp-dept-admin-roads-01',
    email: 'admin.roads@civicpulse.org',
    password: 'Admin@123',
    displayName: 'Rajesh Varma (Roads Dept Admin)',
    role: USER_ROLES.DEPARTMENT_ADMIN,
    departmentId: 'roads',
    accountStatus: 'active',
    phone: '+91 9876543213',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  'admin.sanitation@civicpulse.org': {
    uid: 'cp-dept-admin-sanitation-01',
    email: 'admin.sanitation@civicpulse.org',
    password: 'Admin@123',
    displayName: 'Meera Sen (Sanitation Dept Admin)',
    role: USER_ROLES.DEPARTMENT_ADMIN,
    departmentId: 'garbage',
    accountStatus: 'active',
    phone: '+91 9876543214',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  'admin.water@civicpulse.org': {
    uid: 'cp-dept-admin-water-01',
    email: 'admin.water@civicpulse.org',
    password: 'Admin@123',
    displayName: 'Vikram Nair (Water Dept Admin)',
    role: USER_ROLES.DEPARTMENT_ADMIN,
    departmentId: 'water',
    accountStatus: 'active',
    phone: '+91 9876543215',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  'admin.drainage@civicpulse.org': {
    uid: 'cp-dept-admin-drainage-01',
    email: 'admin.drainage@civicpulse.org',
    password: 'Admin@123',
    displayName: 'Priya Menon (Drainage Dept Admin)',
    role: USER_ROLES.DEPARTMENT_ADMIN,
    departmentId: 'drainage',
    accountStatus: 'active',
    phone: '+91 9876543216',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  'admin.electricity@civicpulse.org': {
    uid: 'cp-dept-admin-electricity-01',
    email: 'admin.electricity@civicpulse.org',
    password: 'Admin@123',
    displayName: 'Arjun Kumar (Electricity Dept Admin)',
    role: USER_ROLES.DEPARTMENT_ADMIN,
    departmentId: 'streetlights',
    accountStatus: 'active',
    phone: '+91 9876543217',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  'admin.works@civicpulse.org': {
    uid: 'cp-dept-admin-works-01',
    email: 'admin.works@civicpulse.org',
    password: 'Admin@123',
    displayName: 'Neha Sharma (Public Works Dept Admin)',
    role: USER_ROLES.DEPARTMENT_ADMIN,
    departmentId: 'infrastructure',
    accountStatus: 'active',
    phone: '+91 9876543218',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  'admin.general@civicpulse.org': {
    uid: 'cp-dept-admin-general-01',
    email: 'admin.general@civicpulse.org',
    password: 'Admin@123',
    displayName: 'Karthik Raj (General Operations Admin)',
    role: USER_ROLES.DEPARTMENT_ADMIN,
    departmentId: 'other',
    accountStatus: 'active',
    phone: '+91 9876543219',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  'admin@civicpulse.org': {
    uid: 'cp-super-admin-usr-01',
    email: 'admin@civicpulse.org',
    password: 'Admin@123',
    displayName: 'Sarah Jenkins (Chief Municipal Super Admin)',
    role: USER_ROLES.SUPER_ADMIN,
    departmentId: null,
    accountStatus: 'active',
    phone: '+91 9876543212',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
};

/**
 * Normalizes and migrates legacy user records (e.g. converting legacy ADMIN -> SUPER_ADMIN)
 */
const normalizeUserRecord = (userRecord) => {
  if (!userRecord) return null;
  const copy = { ...userRecord };

  // RBAC Migration Rule: admin@civicpulse.org or legacy 'admin' role -> SUPER_ADMIN with departmentId: null
  if (
    copy.role === 'admin' ||
    copy.role === 'ADMIN' ||
    (copy.email && copy.email.toLowerCase() === 'admin@civicpulse.org' && copy.role !== USER_ROLES.SUPER_ADMIN)
  ) {
    copy.role = USER_ROLES.SUPER_ADMIN;
    copy.departmentId = null;
  }

  // Ensure departmentId for SUPER_ADMIN is strictly null
  if (copy.role === USER_ROLES.SUPER_ADMIN) {
    copy.departmentId = null;
  }

  return copy;
};

/**
 * Retrieves local user directory with automated RBAC migration
 */
const getLocalUserDirectory = () => {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(INITIAL_PROVISIONED_ACCOUNTS));
      return INITIAL_PROVISIONED_ACCOUNTS;
    }
    const parsed = JSON.parse(raw);
    let updated = false;

    // Ensure all provisioned accounts exist and are normalized
    for (const [email, acc] of Object.entries(INITIAL_PROVISIONED_ACCOUNTS)) {
      const key = email.toLowerCase();
      if (!parsed[key]) {
        parsed[key] = acc;
        updated = true;
      }
    }

    // Apply RBAC migrations
    for (const [key, user] of Object.entries(parsed)) {
      const normalized = normalizeUserRecord(user);
      if (normalized.role !== user.role || normalized.departmentId !== user.departmentId) {
        parsed[key] = normalized;
        updated = true;
      }
    }

    if (updated) {
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return INITIAL_PROVISIONED_ACCOUNTS;
  }
};

/**
 * Saves a registered user to local user directory
 */
const saveLocalUserRecord = (userRecord) => {
  const dir = getLocalUserDirectory();
  dir[userRecord.email.toLowerCase()] = normalizeUserRecord(userRecord);
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(dir));
};

export const authService = {
  /**
   * Translate Firebase authentication errors to friendly messages
   */
  mapAuthError(error) {
    if (!error) return 'An unknown error occurred.';
    const code = error.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Invalid email or password. Please verify your credentials.';
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters in length.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address format.';
      case 'auth/too-many-requests':
        return 'Access temporarily locked due to multiple failed login attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network connection failed. Please check your internet connection.';
      default:
        return error.message || 'Authentication failed. Please try again.';
    }
  },

  /**
   * Authenticate user with Email and Password
   * Role is verified against Firestore /users/{uid} document.
   */
  async login(email, password, intendedPortal = null) {
    const trimmedEmail = (email || '').trim().toLowerCase();

    if (!trimmedEmail || !password) {
      throw new Error('Please provide both email address and password.');
    }

    let authenticatedProfile = null;

    if (isFirebaseConfigured() && auth) {
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      const profile = await this.getUserProfile(userCredential.user.uid);
      authenticatedProfile = normalizeUserRecord({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: profile?.displayName || userCredential.user.displayName || 'User',
        role: profile?.role || USER_ROLES.CITIZEN,
        departmentId: profile?.departmentId || null,
        accountStatus: profile?.accountStatus || 'active',
        createdAt: profile?.createdAt || null,
      });
    } else {
      // Local development fallback
      const directory = getLocalUserDirectory();
      const userMatch = Object.values(directory).find(
        (u) => u.email.toLowerCase() === trimmedEmail && u.password === password
      );

      if (!userMatch) {
        throw new Error('Invalid email or password. Please verify your credentials or register a new Citizen account.');
      }

      if (userMatch.accountStatus && userMatch.accountStatus !== 'active') {
        throw new Error('Your account is currently suspended or inactive. Please contact administration.');
      }

      const { password: _, ...cleanProfile } = userMatch;
      authenticatedProfile = normalizeUserRecord(cleanProfile);
    }

    // Portal Access Verification:
    if (intendedPortal) {
      if (intendedPortal === 'officer' || intendedPortal === USER_ROLES.OFFICER) {
        if (authenticatedProfile.role !== USER_ROLES.OFFICER) {
          throw new Error(`Access Denied: This account has the role of (${authenticatedProfile.role.toUpperCase()}) and is not authorized to access the Officer Workstation.`);
        }
      } else if (
        intendedPortal === 'admin' ||
        intendedPortal === USER_ROLES.SUPER_ADMIN ||
        intendedPortal === USER_ROLES.DEPARTMENT_ADMIN
      ) {
        if (![USER_ROLES.DEPARTMENT_ADMIN, USER_ROLES.SUPER_ADMIN].includes(authenticatedProfile.role)) {
          throw new Error(`Access Denied: This account has the role of (${authenticatedProfile.role.toUpperCase()}) and is not authorized to access the Admin Command Center.`);
        }
      } else if (intendedPortal === 'citizen' || intendedPortal === USER_ROLES.CITIZEN) {
        if (authenticatedProfile.role !== USER_ROLES.CITIZEN) {
          throw new Error(`Access Denied: This account has the role of (${authenticatedProfile.role.toUpperCase()}) and is not authorized to access the Citizen Portal.`);
        }
      }
    }

    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authenticatedProfile));

    auditLogService.logAction({
      action: AUDIT_ACTIONS.LOGIN,
      actorUid: authenticatedProfile.uid,
      actorName: authenticatedProfile.displayName,
      actorRole: authenticatedProfile.role,
      departmentId: authenticatedProfile.departmentId,
      details: `User (${authenticatedProfile.email}) logged into ${intendedPortal || authenticatedProfile.role} portal.`,
      metadata: { email: authenticatedProfile.email, portal: intendedPortal },
    }).catch(console.error);

    return authenticatedProfile;
  },

  /**
   * Public Citizen Account Registration
   * Role is IMMUTABLY assigned as CITIZEN.
   */
  async register(email, password, displayName) {
    const trimmedEmail = (email || '').trim().toLowerCase();
    const trimmedName = (displayName || '').trim();

    if (!trimmedName) {
      throw new Error('Please enter your full name.');
    }
    if (!trimmedEmail) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters in length.');
    }

    const assignedRole = USER_ROLES.CITIZEN;

    if (isFirebaseConfigured() && auth && db) {
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: trimmedName });

      const userProfile = {
        uid: user.uid,
        email: user.email,
        displayName: trimmedName,
        role: assignedRole,
        departmentId: null,
        accountStatus: 'active',
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', user.uid), userProfile);

      const combinedUser = { ...userProfile, createdAt: new Date().toISOString() };
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(combinedUser));
      return combinedUser;
    }

    // Local development fallback
    const directory = getLocalUserDirectory();
    const existing = Object.values(directory).find((u) => u.email.toLowerCase() === trimmedEmail);
    if (existing) {
      const err = new Error('An account with this email address already exists.');
      err.code = 'auth/email-already-in-use';
      throw err;
    }

    const newUid = 'usr-citizen-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);
    const newRecord = {
      uid: newUid,
      email: trimmedEmail,
      displayName: trimmedName,
      role: assignedRole,
      departmentId: null,
      accountStatus: 'active',
      password,
      createdAt: new Date().toISOString(),
    };

    saveLocalUserRecord(newRecord);

    const { password: _, ...safeProfile } = newRecord;
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(safeProfile));
    return safeProfile;
  },

  /**
   * Fetch User Profile from Firestore /users/{uid} with on-the-fly migration
   */
  async getUserProfile(uid) {
    if (!isFirebaseConfigured() || !db) {
      const directory = getLocalUserDirectory();
      const match = Object.values(directory).find((u) => u.uid === uid);
      if (match) {
        const normalized = normalizeUserRecord(match);
        const { password: _, ...safe } = normalized;
        return safe;
      }
      return null;
    }

    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const rawData = snap.data();
        const normalized = normalizeUserRecord(rawData);

        // If data was migrated, update Firestore record in place
        if (normalized.role !== rawData.role || normalized.departmentId !== rawData.departmentId) {
          updateDoc(doc(db, 'users', uid), {
            role: normalized.role,
            departmentId: normalized.departmentId,
            updatedAt: serverTimestamp(),
          }).catch(console.error);
        }

        return normalized;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user document from Firestore:', error);
      return null;
    }
  },

  /**
   * Log Out User Session
   */
  async logout() {
    const activeSession = this.getInitialSession();
    if (activeSession) {
      auditLogService.logAction({
        action: AUDIT_ACTIONS.LOGOUT,
        actorUid: activeSession.uid,
        actorName: activeSession.displayName,
        actorRole: activeSession.role,
        departmentId: activeSession.departmentId,
        details: `User (${activeSession.email}) logged out of the application.`,
        metadata: { email: activeSession.email },
      }).catch(console.error);
    }
    localStorage.removeItem(LOCAL_SESSION_KEY);
    if (isFirebaseConfigured() && auth) {
      await signOut(auth);
    }
  },

  /**
   * Get initial active session from client storage with migration
   */
  getInitialSession() {
    try {
      const raw = localStorage.getItem(LOCAL_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const normalized = normalizeUserRecord(parsed);
        if (normalized.role !== parsed.role || normalized.departmentId !== parsed.departmentId) {
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(normalized));
        }
        return normalized;
      }
    } catch {
      // ignore parsing error
    }
    return null;
  },

  /**
   * Subscribe to Firebase Auth State Changes
   */
  subscribeToAuth(callback) {
    if (!isFirebaseConfigured() || !auth) {
      const session = this.getInitialSession();
      callback(session);
      return () => {};
    }

    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await this.getUserProfile(firebaseUser.uid);
        const combined = normalizeUserRecord({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: profile?.displayName || firebaseUser.displayName || 'User',
          role: profile?.role || USER_ROLES.CITIZEN,
          departmentId: profile?.departmentId || null,
          accountStatus: profile?.accountStatus || 'active',
          createdAt: profile?.createdAt || null,
        });
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(combined));
        callback(combined);
      } else {
        localStorage.removeItem(LOCAL_SESSION_KEY);
        callback(null);
      }
    });
  },
};
