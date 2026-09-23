/**
 * @file test_module4_community_transparency.mjs
 * @description Automated Verification Suite for Module 4: Community Intelligence & Public Transparency
 */

import { authService, INITIAL_PROVISIONED_ACCOUNTS } from './src/services/firebase/authService.js';
import { grievanceService } from './src/services/firebase/grievanceService.js';
import { slaEngine } from './src/services/governance/slaEngine.js';
import { priorityEngine } from './src/services/governance/priorityEngine.js';
import {
  USER_ROLES,
  COMPLAINT_STATUS,
  COMPLAINT_VISIBILITY,
  SEVERITY_LEVELS,
  ESCALATION_LEVELS,
} from './src/models/schema.js';

// Setup mock localStorage in Node.js test environment
const memoryStore = {};
global.localStorage = {
  getItem: (key) => memoryStore[key] || null,
  setItem: (key, val) => { memoryStore[key] = String(val); },
  removeItem: (key) => { delete memoryStore[key]; },
  clear: () => { for (const k in memoryStore) delete memoryStore[k]; },
};

async function runModule4Tests() {
  console.log('================================================================');
  console.log('STARTING MODULE 4: COMMUNITY INTELLIGENCE & TRANSPARENCY TESTS');
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

  // --- PREPARATION: Setup Mock Users ---
  const citizen1 = await authService.register('vikram.mehta@example.com', 'Pass@123456', 'Vikram Mehta');
  const citizen2 = await authService.register('sneha.reddy@example.com', 'Pass@123456', 'Sneha Reddy');
  const citizen3 = await authService.register('kiran.rao@example.com', 'Pass@123456', 'Kiran Rao');

  const roadsOfficer = INITIAL_PROVISIONED_ACCOUNTS['officer.roads@civicpulse.org'];
  const roadsAdmin = INITIAL_PROVISIONED_ACCOUNTS['admin.roads@civicpulse.org'];
  const waterAdmin = INITIAL_PROVISIONED_ACCOUNTS['admin.water@civicpulse.org'];
  const superAdmin = INITIAL_PROVISIONED_ACCOUNTS['admin@civicpulse.org'];

  let publicGrievance;
  let privateGrievance;
  let sensitiveGrievance;

  // --- TEST 1: Citizen creates PUBLIC grievance -> Appears in Community Feed ---
  console.log('--- TEST 1: Public Grievance Creation & Community Feed Discovery ---');
  try {
    publicGrievance = await grievanceService.createGrievance(citizen1, {
      title: 'Dangerous deep pothole on MG Road crossing',
      description: 'Major road fissure damaging two-wheelers during peak traffic hours.',
      categoryId: 'roads',
      ward: 'Ward 8 - Central Zone',
      landmark: 'Near Trinity Metro Station',
      severity: SEVERITY_LEVELS.HIGH,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });

    const feed = await grievanceService.getPublicGrievances('all', 'all');
    const inFeed = feed.find((g) => g.id === publicGrievance.id);
    assert(Boolean(inFeed), 'TEST 1.1: Public grievance appears in Community Feed');
    assert(inFeed.reportedBy === 'Reported by a CivicPulse citizen', 'TEST 1.2: Citizen identity is privacy-preserved');
    assert(!inFeed.citizenEmail, 'TEST 1.3: Citizen email is strictly excluded from public feed item');
  } catch (err) {
    assert(false, 'TEST 1: Public grievance creation', err.message);
  }

  // --- TEST 2: Citizen creates PRIVATE grievance -> Excluded from Community Feed ---
  console.log('\n--- TEST 2: Private Grievance Isolation ---');
  try {
    privateGrievance = await grievanceService.createGrievance(citizen1, {
      title: 'Individual billing dispute regarding municipal water meter',
      description: 'Personal residential water meter calculation discrepancy.',
      categoryId: 'water',
      ward: 'Ward 4 - North Zone',
      landmark: 'House No 42, 3rd Cross',
      severity: SEVERITY_LEVELS.LOW,
      visibility: COMPLAINT_VISIBILITY.PRIVATE,
    });

    const feed = await grievanceService.getPublicGrievances('all', 'all');
    const leaked = feed.find((g) => g.id === privateGrievance.id);
    assert(!leaked, 'TEST 2: Private grievance does NOT appear in Community Feed');
  } catch (err) {
    assert(false, 'TEST 2: Private grievance isolation', err.message);
  }

  // --- TEST 3: Sensitive Grievance Exclusion ---
  console.log('\n--- TEST 3: Sensitive Grievance Privacy ---');
  try {
    sensitiveGrievance = await grievanceService.createGrievance(citizen2, {
      title: 'Confidential report of illegal sewage dumping by local commercial unit',
      description: 'Hazardous chemicals discharged into storm drain at night.',
      categoryId: 'drainage',
      ward: 'Ward 12 - South Zone',
      landmark: 'Behind Industrial Warehouse 7',
      severity: SEVERITY_LEVELS.CRITICAL,
      visibility: COMPLAINT_VISIBILITY.SENSITIVE,
    });

    const feed = await grievanceService.getPublicGrievances('all', 'all');
    const leaked = feed.find((g) => g.id === sensitiveGrievance.id);
    assert(!leaked, 'TEST 3: Sensitive grievance is strictly excluded from public feed');
  } catch (err) {
    assert(false, 'TEST 3: Sensitive grievance privacy', err.message);
  }

  // --- TEST 4: Citizen Supports Public Grievance ---
  console.log('\n--- TEST 4: Citizen 1 Support Signal ---');
  try {
    const { grievance: supported1, hasSupported } = await grievanceService.toggleSupport(publicGrievance.id, citizen1);
    assert(hasSupported === true, 'TEST 4.1: Citizen 1 support recorded');
    assert(supported1.supportCount === 1, 'TEST 4.2: Support count incremented to 1');
  } catch (err) {
    assert(false, 'TEST 4: Support registration', err.message);
  }

  // --- TEST 5: Same Citizen Supports Again (Toggle Off / Anti-Duplicate) ---
  console.log('\n--- TEST 5: Anti-Duplicate Support Enforcement ---');
  try {
    const { grievance: toggled, hasSupported } = await grievanceService.toggleSupport(publicGrievance.id, citizen1);
    assert(hasSupported === false, 'TEST 5.1: Duplicate support click toggles off / prevents duplicate upvotes');
    assert(toggled.supportCount === 0, 'TEST 5.2: Support count cleanly decremented to 0');
    // Re-support for subsequent tests
    await grievanceService.toggleSupport(publicGrievance.id, citizen1);
  } catch (err) {
    assert(false, 'TEST 5: Anti-duplicate support', err.message);
  }

  // --- TEST 6: Second Citizen Supports ---
  console.log('\n--- TEST 6: Second Citizen Support Signal ---');
  try {
    const { grievance: supported2 } = await grievanceService.toggleSupport(publicGrievance.id, citizen2);
    assert(supported2.supportCount === 2, 'TEST 6: Second distinct citizen support count increased to 2');
  } catch (err) {
    assert(false, 'TEST 6: Second support', err.message);
  }

  // --- TEST 7: Citizen "Still Not Resolved" Follow-up ---
  console.log('\n--- TEST 7: "Still Not Resolved" Citizen Follow-Up ---');
  try {
    const followed1 = await grievanceService.submitFollowUp(publicGrievance.id, citizen1, {
      comment: 'Pothole expanded after recent rains, causing heavy skidding.',
    });
    assert(followed1.followUpCount === 1, 'TEST 7: Follow-up successfully recorded on existing grievance');
  } catch (err) {
    assert(false, 'TEST 7: Follow-up registration', err.message);
  }

  // --- TEST 8: Anti-Abuse Prevention for Repeated Follow-ups from Same Citizen ---
  console.log('\n--- TEST 8: Anti-Spam Follow-up Guard ---');
  try {
    await grievanceService.submitFollowUp(publicGrievance.id, citizen1, { comment: 'Duplicate spam attempt' });
    assert(false, 'TEST 8: Should reject duplicate follow-up from same citizen');
  } catch (err) {
    assert(err.message.includes('already registered'), 'TEST 8: Correctly blocked duplicate follow-up from same user');
  }

  // --- TEST 9: Critical Issue Severity Override with Zero Supports ---
  console.log('\n--- TEST 9: Severity & Safety Override Rule ---');
  try {
    const criticalIssue = await grievanceService.createGrievance(citizen3, {
      title: 'Exposed 440V transformer wire dangling across school walkway',
      description: 'Immediate electrocution risk for pedestrians and schoolchildren.',
      categoryId: 'streetlights',
      ward: 'Ward 8 - Central Zone',
      landmark: 'Near Govt High School Gate',
      severity: SEVERITY_LEVELS.CRITICAL,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });

    assert(criticalIssue.supportCount === 0, 'TEST 9.1: Support count is strictly 0');
    assert(criticalIssue.priorityLevel === 'CRITICAL', 'TEST 9.2: Priority strictly remains CRITICAL (Safety score >= 85)');
  } catch (err) {
    assert(false, 'TEST 9: Severity override check', err.message);
  }

  // --- TEST 10: Community Follow-up Urgency Escalation ---
  console.log('\n--- TEST 10: Community Urgency Contribution ---');
  try {
    await grievanceService.submitFollowUp(publicGrievance.id, citizen2, { comment: 'Multiple two-wheeler slips observed' });
    const followed3 = await grievanceService.submitFollowUp(publicGrievance.id, citizen3, { comment: 'Transit bus axle damaged' });
    assert(followed3.followUpCount === 3, 'TEST 10.1: 3 Unique citizen follow-ups accumulated');
    assert(followed3.escalationLevel === ESCALATION_LEVELS.DEPARTMENT_ESCALATED, 'TEST 10.2: Triggered DEPARTMENT_ESCALATED');
  } catch (err) {
    assert(false, 'TEST 10: Urgency escalation', err.message);
  }

  // --- TEST 11: Officer Submits Resolution Evidence -> Clock Continues ---
  console.log('\n--- TEST 11: Officer Resolution Submission & SLA Continuity ---');
  try {
    const resolvedGrievance = await grievanceService.submitResolutionEvidence(
      publicGrievance.id,
      { uid: roadsOfficer.email, displayName: 'Field Officer Verma', role: USER_ROLES.OFFICER, departmentId: 'roads' },
      { remarks: 'Cold mix asphalt patch laid and compacted.', afterMediaUrls: ['https://mockstorage/after_patch.jpg'] }
    );
    assert(resolvedGrievance.status === COMPLAINT_STATUS.VERIFICATION, 'TEST 11.1: Status transitioned to VERIFICATION');
    const slaStatus = slaEngine.evaluateResolutionSLA(resolvedGrievance);
    assert(slaStatus.isStopped === false, 'TEST 11.2: Resolution SLA remains ACTIVELY COUNTING during verification');
  } catch (err) {
    assert(false, 'TEST 11: Officer resolution evidence submission', err.message);
  }

  // --- TEST 12: Community Action Submission & Clock Continuity ---
  console.log('\n--- TEST 12: Community Action Remediation Submission ---');
  try {
    const communityIssue = await grievanceService.createGrievance(citizen1, {
      title: 'Clogged storm drain grates on 2nd Avenue',
      description: 'Leaves and plastic blocking surface runoff.',
      categoryId: 'drainage',
      ward: 'Ward 4 - North Zone',
      severity: SEVERITY_LEVELS.MEDIUM,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });

    const communityActionSubmitted = await grievanceService.submitCommunityAction(communityIssue.id, citizen2, {
      narrative: 'Neighborhood youth volunteer group cleared 4 storm grates and bagged debris.',
      afterMediaUrls: ['https://mockstorage/drain_cleared.jpg'],
    });

    assert(
      communityActionSubmitted.status === COMPLAINT_STATUS.COMMUNITY_ACTION_SUBMITTED,
      'TEST 12.1: Status transitioned to COMMUNITY_ACTION_SUBMITTED'
    );
    assert(
      communityActionSubmitted.resolutionProof.submittedByType === 'COMMUNITY',
      'TEST 12.2: Resolution proof source recorded as COMMUNITY'
    );
    const commSlaStatus = slaEngine.evaluateResolutionSLA(communityActionSubmitted);
    assert(commSlaStatus.isStopped === false, 'TEST 12.3: Resolution SLA continues running during community verification');
  } catch (err) {
    assert(false, 'TEST 12: Community action submission', err.message);
  }

  // --- TEST 13: Department Admin Approves Evidence -> Halts SLA ---
  console.log('\n--- TEST 13: Department Admin Verification Approval ---');
  try {
    const verified = await grievanceService.verifyResolution(
      publicGrievance.id,
      { uid: 'roads-admin-uid', displayName: 'Roads Supervisor', role: USER_ROLES.DEPARTMENT_ADMIN, departmentId: 'roads' },
      { approved: true }
    );
    assert(verified.status === COMPLAINT_STATUS.VERIFIED_RESOLVED, 'TEST 13.1: Status updated to VERIFIED_RESOLVED');
    const finalGrievance = await grievanceService.getGrievanceById(publicGrievance.id);
    const finalSla = slaEngine.evaluateResolutionSLA(finalGrievance);
    assert(finalSla.isStopped === true, 'TEST 13.2: Resolution SLA officially HALTED on Admin sign-off');
  } catch (err) {
    assert(false, 'TEST 13: Admin verification approval', err.message);
  }

  // --- TEST 14: Department Admin Rejects Inadequate Evidence -> IN_PROGRESS ---
  console.log('\n--- TEST 14: Inadequate Evidence Rejection & SLA Continuity ---');
  try {
    const testRejectGrievance = await grievanceService.createGrievance(citizen1, {
      title: 'Fallen tree limb obstructing sidewalk',
      description: 'Pedestrians forced onto main roadway.',
      categoryId: 'roads',
      ward: 'Ward 8 - Central Zone',
      severity: SEVERITY_LEVELS.MEDIUM,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });

    await grievanceService.submitResolutionEvidence(
      testRejectGrievance.id,
      { uid: 'roads-officer-uid', displayName: 'Field Officer', role: USER_ROLES.OFFICER, departmentId: 'roads' },
      { remarks: 'Branches partially cut.', afterMediaUrls: ['https://mockstorage/branch_cut.jpg'] }
    );

    const rejected = await grievanceService.verifyResolution(
      testRejectGrievance.id,
      { uid: 'roads-admin-uid', displayName: 'Roads Supervisor', role: USER_ROLES.DEPARTMENT_ADMIN, departmentId: 'roads' },
      { approved: false, rejectionReason: 'Debris left blocking pedestrian path. Clear thoroughly.' }
    );

    assert(rejected.status === COMPLAINT_STATUS.IN_PROGRESS, 'TEST 14.1: Grievance reverted to IN_PROGRESS');
    const revertedGrievance = await grievanceService.getGrievanceById(testRejectGrievance.id);
    assert(Boolean(revertedGrievance.resolutionSlaDue), 'TEST 14.2: Original Resolution SLA preserved without reset');
  } catch (err) {
    assert(false, 'TEST 14: Admin rejection handling', err.message);
  }

  // --- TEST 15: Citizen Attempts to Verify Resolution -> ACCESS DENIED ---
  console.log('\n--- TEST 15: Unauthorized Citizen Verification Guard ---');
  try {
    await grievanceService.verifyResolution(publicGrievance.id, citizen1, { approved: true });
    assert(false, 'TEST 15: Citizen should be denied from approving resolution');
  } catch (err) {
    assert(err.message.includes('Access Denied'), 'TEST 15: Correctly rejected Citizen attempting Admin verification');
  }

  // --- TEST 16: Officer Attempts to Approve Own Evidence -> ACCESS DENIED ---
  console.log('\n--- TEST 16: Anti-Self-Approval Enforcement ---');
  try {
    const selfTestGrievance = await grievanceService.createGrievance(citizen1, {
      title: 'Broken curbstone on 1st Main',
      description: 'Minor curbstone displacement.',
      categoryId: 'roads',
      ward: 'Ward 8 - Central Zone',
      severity: SEVERITY_LEVELS.LOW,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });

    await grievanceService.submitResolutionEvidence(
      selfTestGrievance.id,
      { uid: 'officer-singh-uid', displayName: 'Officer Singh', role: USER_ROLES.OFFICER, departmentId: 'roads' },
      { remarks: 'Reset curbstone.', afterMediaUrls: ['https://mockstorage/curbstone.jpg'] }
    );

    // If Officer tries to verify own resolution as Admin
    await grievanceService.verifyResolution(
      selfTestGrievance.id,
      { uid: 'officer-singh-uid', displayName: 'Officer Singh', role: USER_ROLES.DEPARTMENT_ADMIN, departmentId: 'roads' },
      { approved: true }
    );
    assert(false, 'TEST 16: Submitting officer should not verify own evidence');
  } catch (err) {
    assert(err.message.includes('own submitted resolution'), 'TEST 16: Correctly blocked self-verification');
  }

  // --- TEST 17: Citizen Attempts to View Confidential Grievance -> ACCESS DENIED ---
  console.log('\n--- TEST 17: Confidential Grievance Read Protection ---');
  try {
    await grievanceService.getGrievanceById(sensitiveGrievance.id, citizen1);
    assert(false, 'TEST 17: Unrelated citizen should not access sensitive grievance');
  } catch (err) {
    assert(err.message.includes('Access Denied'), 'TEST 17: Correctly blocked unauthorized access to confidential grievance');
  }

  // --- TEST 18: Department Admin Cross-Department Boundary Guard ---
  console.log('\n--- TEST 18: Department Admin Boundary Guard ---');
  try {
    await grievanceService.getGrievanceById(privateGrievance.id, {
      uid: 'roads-admin-uid',
      role: USER_ROLES.DEPARTMENT_ADMIN,
      departmentId: 'roads',
    });
    assert(false, 'TEST 18: Roads Admin should not access Water private complaint');
  } catch (err) {
    assert(err.message.includes('Access Denied'), 'TEST 18: Correctly blocked cross-department private data access');
  }

  // --- TEST 19: Super Admin Full Oversight Access ---
  console.log('\n--- TEST 19: Super Admin Transparency Oversight ---');
  try {
    const superAdminUser = { uid: 'super-admin-uid', role: USER_ROLES.SUPER_ADMIN, departmentId: null };
    const fetchedPublic = await grievanceService.getGrievanceById(publicGrievance.id, superAdminUser);
    const fetchedPrivate = await grievanceService.getGrievanceById(privateGrievance.id, superAdminUser);
    const fetchedSensitive = await grievanceService.getGrievanceById(sensitiveGrievance.id, superAdminUser);

    assert(Boolean(fetchedPublic) && Boolean(fetchedPrivate) && Boolean(fetchedSensitive), 'TEST 19: Super Admin has unified oversight across all visibility tiers');
  } catch (err) {
    assert(false, 'TEST 19: Super admin oversight', err.message);
  }

  // --- SUMMARY ---
  console.log('\n================================================================');
  console.log(`MODULE 4 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runModule4Tests().catch((e) => {
  console.error('Fatal error during test run:', e);
  process.exit(1);
});
