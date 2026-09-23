/**
 * @file test_multidept_officer_routing.mjs
 * @description Multi-Department Officer Provisioning & Inbox Isolation Verification Test
 */

import { authService, INITIAL_PROVISIONED_ACCOUNTS } from './src/services/firebase/authService.js';
import { grievanceService } from './src/services/firebase/grievanceService.js';
import {
  USER_ROLES,
  COMPLAINT_STATUS,
  COMPLAINT_VISIBILITY,
  SEVERITY_LEVELS,
} from './src/models/schema.js';

// Mock localStorage
const memoryStore = {};
global.localStorage = {
  getItem: (key) => memoryStore[key] || null,
  setItem: (key, val) => { memoryStore[key] = String(val); },
  removeItem: (key) => { delete memoryStore[key]; },
  clear: () => { for (const k in memoryStore) delete memoryStore[k]; },
};

async function runMultiDeptTests() {
  console.log('================================================================');
  console.log('STARTING MULTI-DEPARTMENT OFFICER PROVISIONING & ROUTING TESTS');
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

  // --- Step 1: Verify All 7 Provisioned Officer Accounts ---
  console.log('--- Step 1: Multi-Department Officer Authentication ---');
  const expectedDepartments = [
    { email: 'officer.roads@civicpulse.org', deptId: 'roads', name: 'Roads Dept' },
    { email: 'officer.sanitation@civicpulse.org', deptId: 'garbage', name: 'Sanitation Dept' },
    { email: 'officer.water@civicpulse.org', deptId: 'water', name: 'Water Dept' },
    { email: 'officer.drainage@civicpulse.org', deptId: 'drainage', name: 'Drainage Dept' },
    { email: 'officer.electricity@civicpulse.org', deptId: 'streetlights', name: 'Electricity Dept' },
    { email: 'officer.works@civicpulse.org', deptId: 'infrastructure', name: 'Public Works Dept' },
    { email: 'officer.general@civicpulse.org', deptId: 'other', name: 'General Operations' },
  ];

  for (const item of expectedDepartments) {
    const creds = INITIAL_PROVISIONED_ACCOUNTS[item.email];
    assert(Boolean(creds), `1.${expectedDepartments.indexOf(item) + 1}a: Credential exists for ${item.email}`);
    const loggedIn = await authService.login(creds.email, creds.password, 'officer');
    assert(loggedIn.role === USER_ROLES.OFFICER, `1.${expectedDepartments.indexOf(item) + 1}b: ${item.email} has role OFFICER`);
    assert(loggedIn.departmentId === item.deptId, `1.${expectedDepartments.indexOf(item) + 1}c: ${item.email} assigned to departmentId: '${item.deptId}'`);
    await authService.logout();
  }

  // --- Step 2: Citizen Creates Grievances Across Multiple Departments ---
  console.log('\n--- Step 2: Citizen Creates Multi-Department Grievances ---');
  const citizen = await authService.register('rahul.verma@example.com', 'Pass@123456', 'Rahul Verma');

  // Road complaint
  const roadComplaint = await grievanceService.createGrievance(citizen, {
    title: 'Severe pothole cluster on Outer Ring Road',
    description: 'Road damage causing vehicle rim damage.',
    categoryId: 'roads',
    ward: 'Ward 8 - Central Zone',
    severity: SEVERITY_LEVELS.HIGH,
    visibility: COMPLAINT_VISIBILITY.PUBLIC,
  });
  assert(roadComplaint.departmentId === 'roads', '2.1: Road complaint mapped to departmentId: "roads"');

  // Sanitation complaint (CP-2026-0004 scenario)
  const sanitationComplaint = await grievanceService.createGrievance(citizen, {
    title: 'deep smell in the area',
    description: 'Decomposed organic waste overflowing from municipal collection point.',
    categoryId: 'garbage',
    ward: 'Ward 4 - North Zone',
    severity: SEVERITY_LEVELS.MEDIUM,
    visibility: COMPLAINT_VISIBILITY.PUBLIC,
  });
  assert(sanitationComplaint.departmentId === 'garbage', '2.2: Sanitation complaint mapped to departmentId: "garbage"');

  // Water complaint
  const waterComplaint = await grievanceService.createGrievance(citizen, {
    title: 'Contaminated muddy water from supply pipe',
    description: 'Water has foul odor and suspended particulates.',
    categoryId: 'water',
    ward: 'Ward 12 - South Zone',
    severity: SEVERITY_LEVELS.HIGH,
    visibility: COMPLAINT_VISIBILITY.PUBLIC,
  });
  assert(waterComplaint.departmentId === 'water', '2.3: Water complaint mapped to departmentId: "water"');

  // --- Step 3: Verify Roads Officer Inbox Isolation ---
  console.log('\n--- Step 3: Roads Officer Inbox Isolation ---');
  const roadsOfficerCreds = INITIAL_PROVISIONED_ACCOUNTS['officer.roads@civicpulse.org'];
  const roadsOfficer = await authService.login(roadsOfficerCreds.email, roadsOfficerCreds.password, 'officer');

  const roadsInbox = await grievanceService.getDepartmentGrievances(roadsOfficer.departmentId);
  const roadInRoads = roadsInbox.some((g) => g.id === roadComplaint.id);
  const sanitationInRoads = roadsInbox.some((g) => g.id === sanitationComplaint.id);
  const waterInRoads = roadsInbox.some((g) => g.id === waterComplaint.id);

  assert(roadInRoads === true, '3.1: Roads Officer CAN see Roads complaint');
  assert(sanitationInRoads === false, '3.2: Roads Officer CANNOT see Sanitation complaint (CP-2026-0004)');
  assert(waterInRoads === false, '3.3: Roads Officer CANNOT see Water complaint');
  await authService.logout();

  // --- Step 4: Verify Sanitation Officer Inbox Isolation & CP-2026-0004 Visibility ---
  console.log('\n--- Step 4: Sanitation Officer Inbox Visibility for CP-2026-0004 ---');
  const sanitationOfficerCreds = INITIAL_PROVISIONED_ACCOUNTS['officer.sanitation@civicpulse.org'];
  const sanitationOfficer = await authService.login(sanitationOfficerCreds.email, sanitationOfficerCreds.password, 'officer');

  const sanitationInbox = await grievanceService.getDepartmentGrievances(sanitationOfficer.departmentId);
  const sanitationInSanitation = sanitationInbox.some((g) => g.id === sanitationComplaint.id);
  const roadInSanitation = sanitationInbox.some((g) => g.id === roadComplaint.id);

  assert(sanitationInSanitation === true, '4.1: Sanitation Officer CAN see "deep smell in the area" (Sanitation complaint)');
  assert(roadInSanitation === false, '4.2: Sanitation Officer CANNOT see Road complaint');

  // --- Step 5: Officer Claiming & Action Center Flow ---
  console.log('\n--- Step 5: Complaint Claiming via "Mark as Seen" ---');
  const markedSeen = await grievanceService.markGrievanceAsSeen(sanitationComplaint.id, sanitationOfficer);
  assert(markedSeen.status === COMPLAINT_STATUS.SEEN, '5.1: Status updated to SEEN');

  const claimedGrievance = await grievanceService.getGrievanceById(sanitationComplaint.id);
  assert(claimedGrievance.assignedOfficerId === sanitationOfficer.uid, '5.2: assignedOfficerId set to Sanitation Officer UID');
  assert(Boolean(claimedGrievance.seenAt), '5.3: seenAt timestamp recorded, fulfilling Response SLA');
  await authService.logout();

  // --- Summary ---
  console.log('\n================================================================');
  console.log(`MULTI-DEPARTMENT ROUTING TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMultiDeptTests().catch((e) => {
  console.error('Fatal error during test run:', e);
  process.exit(1);
});
