/**
 * @file test_module2_grievance_workflow.mjs
 * @description Comprehensive Automated End-to-End Test Suite for Module 2
 * Tests Citizen Submission -> Unique ID Generation -> Automatic Department Routing ->
 * SLA Calculation -> Officer Workstation Inbox -> Citizen Tracking & Timeline -> Security.
 */

import { authService, INITIAL_PROVISIONED_ACCOUNTS } from './src/services/firebase/authService.js';
import { grievanceService } from './src/services/firebase/grievanceService.js';
import { storageService } from './src/services/firebase/storageService.js';
import { USER_ROLES, CATEGORIES, SEVERITY_LEVELS, COMPLAINT_STATUS } from './src/models/schema.js';

// Setup mock localStorage in Node.js test environment
const memoryStore = {};
global.localStorage = {
  getItem: (key) => memoryStore[key] || null,
  setItem: (key, val) => { memoryStore[key] = String(val); },
  removeItem: (key) => { delete memoryStore[key]; },
  clear: () => { for (const k in memoryStore) delete memoryStore[k]; },
};

async function runModule2Tests() {
  console.log('================================================================');
  console.log('STARTING MODULE 2: CITIZEN GRIEVANCE SUBMISSION & TRACKING TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  // --- TEST A: Citizen logs in ---
  console.log('--- TEST A: Citizen Login ---');
  let citizenUser;
  try {
    citizenUser = await authService.register('rohit.sharma@example.com', 'Pass@123456', 'Rohit Sharma');
    assert(citizenUser && citizenUser.role === USER_ROLES.CITIZEN, 'TEST A: Citizen logged in and verified with role CITIZEN');
  } catch (err) {
    assert(false, 'TEST A: Citizen login', err.message);
  }

  // --- TEST B & L: Validation of Grievance Form ---
  console.log('\n--- TEST B & L: Input Validation & Form Guarding ---');
  try {
    grievanceService.validateSubmission({ title: '', description: 'Some text', categoryId: 'roads', ward: 'Ward 8' });
    assert(false, 'TEST L1: Should reject empty title');
  } catch (err) {
    assert(err.message.includes('title is required'), 'TEST L1: Correctly rejected empty title');
  }

  try {
    grievanceService.validateSubmission({ title: 'Valid Title', description: '', categoryId: 'roads', ward: 'Ward 8' });
    assert(false, 'TEST L2: Should reject empty description');
  } catch (err) {
    assert(err.message.includes('description is required'), 'TEST L2: Correctly rejected empty description');
  }

  try {
    grievanceService.validateSubmission({ title: 'Valid Title', description: 'Valid Desc', categoryId: 'other', customCategory: '', ward: 'Ward 8' });
    assert(false, 'TEST L3: Should reject custom category without description');
  } catch (err) {
    assert(err.message.includes('specify the custom category'), 'TEST L3: Correctly rejected empty custom category');
  }

  // --- TEST M: Evidence File Validation ---
  console.log('\n--- TEST M: Evidence Upload Validation ---');
  try {
    storageService.validateFile({ type: 'application/exe', size: 1024, name: 'malware.exe' });
    assert(false, 'TEST M1: Should reject unsupported file type');
  } catch (err) {
    assert(err.message.includes('Unsupported file format'), 'TEST M1: Correctly caught invalid file type (.exe)');
  }

  try {
    storageService.validateFile({ type: 'image/jpeg', size: 15 * 1024 * 1024, name: 'huge_photo.jpg' });
    assert(false, 'TEST M2: Should reject file > 10MB');
  } catch (err) {
    assert(err.message.includes('too large'), 'TEST M2: Correctly rejected oversized file');
  }

  const validPhoto = { type: 'image/jpeg', size: 2 * 1024 * 1024, name: 'pothole_evidence.jpg' };
  assert(storageService.validateFile(validPhoto) === true, 'TEST M3: Valid JPEG file (2MB) passes validation');

  // --- TEST C, D, E, F, G: Citizen Submits Valid Grievance ---
  console.log('\n--- TEST C, D, E, F, G: Grievance Creation, ID, Routing & SLA ---');
  let createdGrievance;
  try {
    const payload = {
      categoryId: 'roads',
      title: 'Massive Pothole at 7th Cross Junction',
      description: 'Dangerous pothole approximately 3 feet wide causing severe bike skids during evening traffic.',
      ward: 'Ward 8 - Central Zone',
      landmark: 'Opposite State Bank Branch',
      severity: SEVERITY_LEVELS.CRITICAL,
      isSensitive: false,
      lat: 12.9716,
      lng: 77.5946,
    };

    createdGrievance = await grievanceService.createGrievance(citizenUser, payload, []);
    assert(createdGrievance !== null, 'TEST C: Grievance submission succeeded');

    // TEST D: Firestore document contains fields
    assert(createdGrievance.citizenId === citizenUser.uid, 'TEST D1: Document bound to authenticated citizen UID');
    assert(createdGrievance.status === COMPLAINT_STATUS.SUBMITTED, 'TEST D2: Initial status strictly set to SUBMITTED');

    // TEST E: Unique Grievance ID
    assert(
      createdGrievance.id && createdGrievance.id.startsWith('CP-2026-'),
      `TEST E: Unique Grievance ID generated: ${createdGrievance.id}`
    );

    // TEST F: Automatic Department Routing
    assert(
      createdGrievance.departmentId === 'roads' && createdGrievance.departmentCode === 'DEPT_ROADS',
      'TEST F: Category "roads" deterministically mapped to "Roads & Infrastructure" (DEPT_ROADS)'
    );

    // TEST G: SLA Calculation
    // For Roads (Base: 12h Response, 72h Resolution) with CRITICAL severity (Multiplier: 0.25)
    // Response = 12 * 0.25 = 3h, Resolution = 72 * 0.25 = 18h
    assert(createdGrievance.responseSlaHours === 3, `TEST G1: Dynamic Response SLA calculated: ${createdGrievance.responseSlaHours}h`);
    assert(createdGrievance.resolutionSlaHours === 18, `TEST G2: Dynamic Resolution SLA calculated: ${createdGrievance.resolutionSlaHours}h`);
    assert(Boolean(createdGrievance.responseSlaDue) && Boolean(createdGrievance.resolutionSlaDue), 'TEST G3: SLA deadline timestamps populated');
  } catch (err) {
    assert(false, 'TEST C-G: Submit valid grievance', err.message);
  }

  // --- TEST H: My Submissions Query for Citizen ---
  console.log('\n--- TEST H: Citizen "My Submissions" Query ---');
  try {
    const myGrievances = await grievanceService.getCitizenGrievances(citizenUser.uid);
    assert(Array.isArray(myGrievances) && myGrievances.length > 0, 'TEST H1: Retrieved citizen grievance list');
    const matched = myGrievances.find((g) => g.id === createdGrievance.id);
    assert(Boolean(matched), 'TEST H2: Newly submitted grievance appears under citizen My Submissions');
  } catch (err) {
    assert(false, 'TEST H: My Submissions query', err.message);
  }

  // --- TEST I: Grievance Details Retrieval ---
  console.log('\n--- TEST I: Grievance Details & Timeline Data ---');
  try {
    const fetchedRecord = await grievanceService.getGrievanceById(createdGrievance.id);
    assert(fetchedRecord && fetchedRecord.id === createdGrievance.id, 'TEST I1: Fetched grievance details by Reference ID');
    assert(fetchedRecord.title === 'Massive Pothole at 7th Cross Junction', 'TEST I2: Title matches submitted data');
    assert(fetchedRecord.location.lat === 12.9716, 'TEST I3: GPS coordinates stored and retrieved');
  } catch (err) {
    assert(false, 'TEST I: Grievance details', err.message);
  }

  // --- TEST J: Connected to Officer Workstation & Mark as Seen ---
  console.log('\n--- TEST J: Officer Workstation & Response SLA Fulfillment ---');
  try {
    // Road Officer accesses department inbox
    const roadOfficer = INITIAL_PROVISIONED_ACCOUNTS['officer.roads@civicpulse.org'];
    const deptGrievances = await grievanceService.getDepartmentGrievances('roads');
    const officerFound = deptGrievances.find((g) => g.id === createdGrievance.id);
    assert(Boolean(officerFound), 'TEST J1: Newly submitted Road grievance appeared in Road Officer Workstation Inbox');

    // Officer marks grievance as SEEN
    const seenResult = await grievanceService.markGrievanceAsSeen(createdGrievance.id, {
      uid: 'officer-roads-uid',
      displayName: 'Officer Dave (Roads)',
    });
    assert(seenResult.status === COMPLAINT_STATUS.SEEN, 'TEST J2: Status updated to SEEN in Firestore');
    assert(Boolean(seenResult.seenAt), 'TEST J3: seenAt timestamp recorded, fulfilling Response SLA');

    // Re-fetch to ensure persistence
    const verifiedSeen = await grievanceService.getGrievanceById(createdGrievance.id);
    assert(verifiedSeen.status === COMPLAINT_STATUS.SEEN, 'TEST J4: Grievance status persisted as SEEN across readers');
  } catch (err) {
    assert(false, 'TEST J: Officer connection', err.message);
  }

  // --- TEST K: Isolation & Privacy of Grievances ---
  console.log('\n--- TEST K: Grievance Ownership Isolation ---');
  try {
    const otherCitizen = await authService.register('ananya.patel@example.com', 'Pass@123456', 'Ananya Patel');
    const otherGrievances = await grievanceService.getCitizenGrievances(otherCitizen.uid);
    const leaked = otherGrievances.find((g) => g.id === createdGrievance.id);
    assert(!leaked, 'TEST K: Other citizen cannot see Rohit Sharma\'s grievance under their My Submissions');
  } catch (err) {
    assert(false, 'TEST K: Privacy isolation', err.message);
  }

  // --- TEST N: Logout & Login Session Continuity ---
  console.log('\n--- TEST N: Logout & Re-login Grievance Continuity ---');
  try {
    await authService.logout();
    assert(authService.getInitialSession() === null, 'TEST N1: Logged out successfully');

    // Log back in as original citizen
    const reLoggedIn = await authService.login('rohit.sharma@example.com', 'Pass@123456', USER_ROLES.CITIZEN);
    const restoredGrievances = await grievanceService.getCitizenGrievances(reLoggedIn.uid);
    const restored = restoredGrievances.find((g) => g.id === createdGrievance.id);
    assert(Boolean(restored), 'TEST N2: Grievances still owned and accessible after re-authenticating');
  } catch (err) {
    assert(false, 'TEST N: Session continuity', err.message);
  }

  // --- TEST O: Re-verify Module 1 Authentication & RBAC ---
  console.log('\n--- TEST O: Module 1 Regression & RBAC Boundary Protection ---');
  try {
    const adminAccount = INITIAL_PROVISIONED_ACCOUNTS['admin@civicpulse.org'];
    const admin = await authService.login(adminAccount.email, adminAccount.password, 'admin');
    assert(admin.role === USER_ROLES.SUPER_ADMIN, 'TEST O1: Super Admin authentication remains fully intact');

    // Citizen attempting Officer login check
    try {
      await authService.login('rohit.sharma@example.com', 'Pass@123456', USER_ROLES.OFFICER);
      assert(false, 'TEST O2: Citizen should not be allowed into Officer portal');
    } catch (e) {
      assert(e.message.includes('Access Denied'), 'TEST O2: RBAC portal boundary successfully prevents privilege escalation');
    }
  } catch (err) {
    assert(false, 'TEST O: Module 1 regression', err.message);
  }

  console.log('\n================================================================');
  console.log(`MODULE 2 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runModule2Tests().catch((e) => {
  console.error('Fatal error during test run:', e);
  process.exit(1);
});
