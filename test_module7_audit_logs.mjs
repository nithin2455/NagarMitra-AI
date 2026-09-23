/**
 * @file test_module7_audit_logs.mjs
 * @description Production Automated Unit & Integration Tests for Module 7: System Audit Logs & Accountability
 */

import { authService, INITIAL_PROVISIONED_ACCOUNTS } from './src/services/firebase/authService.js';
import { grievanceService } from './src/services/firebase/grievanceService.js';
import { auditLogService } from './src/services/firebase/auditLogService.js';
import {
  USER_ROLES,
  COMPLAINT_STATUS,
  COMPLAINT_VISIBILITY,
  SEVERITY_LEVELS,
  AUDIT_ACTIONS,
} from './src/models/schema.js';

// Setup mock localStorage
const memoryStore = {};
global.localStorage = {
  getItem: (key) => memoryStore[key] || null,
  setItem: (key, val) => { memoryStore[key] = String(val); },
  removeItem: (key) => { delete memoryStore[key]; },
  clear: () => { for (const k in memoryStore) delete memoryStore[k]; },
};

async function runModule7Tests() {
  console.log('================================================================');
  console.log('STARTING MODULE 7: SYSTEM AUDIT LOGS & ACCOUNTABILITY TESTS');
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

  // --- Step 1: Authentication & Login Action Logging ---
  console.log('--- Step 1: Authentication & LOGIN Action Logging ---');
  const citizen = await authService.register('dev.citizen@example.com', 'Pass@123456', 'Dev Citizen');

  const roadsOfficerCreds = INITIAL_PROVISIONED_ACCOUNTS['officer.roads@civicpulse.org'];
  const roadsAdminCreds = INITIAL_PROVISIONED_ACCOUNTS['admin.roads@civicpulse.org'];
  const sanitationAdminCreds = INITIAL_PROVISIONED_ACCOUNTS['admin.sanitation@civicpulse.org'];
  const superAdminCreds = INITIAL_PROVISIONED_ACCOUNTS['admin@civicpulse.org'];

  const roadsOfficer = await authService.login(roadsOfficerCreds.email, roadsOfficerCreds.password, 'officer');
  const roadsAdmin = await authService.login(roadsAdminCreds.email, roadsAdminCreds.password, 'admin');
  const sanitationAdmin = await authService.login(sanitationAdminCreds.email, sanitationAdminCreds.password, 'admin');
  const superAdmin = await authService.login(superAdminCreds.email, superAdminCreds.password, 'admin');

  // Verify LOGIN logs were written
  const initialSuperLogs = await auditLogService.getAuditLogs(superAdmin);
  const loginLogs = initialSuperLogs.filter((l) => l.action === AUDIT_ACTIONS.LOGIN);
  assert(loginLogs.length >= 4, 'TEST 1: Authentication events generate immutable LOGIN audit records');
  assert(Boolean(loginLogs[0].timestamp), 'TEST 1.1: Audit record contains accurate ISO timestamp');
  assert(Boolean(loginLogs[0].actorUid), 'TEST 1.2: Audit record contains actorUid');

  // --- Step 2: RBAC Security Access Controls on Audit Logs ---
  console.log('\n--- Step 2: RBAC Security & Access Control Enforcement ---');
  try {
    // 2.1 Super Admin Access -> OK
    const saLogs = await auditLogService.getAuditLogs(superAdmin);
    assert(Array.isArray(saLogs), 'TEST 2.1: Super Admin can query global audit logs');

    // 2.2 Department Admin Access -> OK
    const raLogs = await auditLogService.getAuditLogs(roadsAdmin);
    assert(Array.isArray(raLogs), 'TEST 2.2: Department Admin can query department audit logs');

    // 2.3 Officer Access -> DENIED
    try {
      await auditLogService.getAuditLogs(roadsOfficer);
      assert(false, 'TEST 2.3: Officer should not access Audit Logs');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 2.3: Correctly blocked Officer from accessing Audit Logs');
    }

    // 2.4 Citizen Access -> DENIED
    try {
      await auditLogService.getAuditLogs(citizen);
      assert(false, 'TEST 2.4: Citizen should not access Audit Logs');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 2.4: Correctly blocked Citizen from accessing Audit Logs');
    }

    // 2.5 Unauthenticated Access -> DENIED
    try {
      await auditLogService.getAuditLogs(null);
      assert(false, 'TEST 2.5: Unauthenticated user should not access Audit Logs');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 2.5: Correctly blocked unauthenticated access');
    }
  } catch (err) {
    assert(false, 'Step 2: RBAC tests', err.message);
  }

  // --- Step 3: Lifecycle Actions & Comprehensive Audit Recording ---
  console.log('\n--- Step 3: Complete Grievance Lifecycle Audit Logging ---');
  let gTest;
  try {
    // 3.1 Citizen creates grievance -> GRIEVANCE_CREATED
    gTest = await grievanceService.createGrievance(citizen, {
      title: 'Collapsed storm drain on MG Road',
      description: 'Dangerous open trench.',
      categoryId: 'roads',
      ward: 'Ward 1 - Central',
      severity: SEVERITY_LEVELS.HIGH,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });

    const createLogs = await auditLogService.getAuditLogs(superAdmin, {
      complaintId: gTest.id,
      action: AUDIT_ACTIONS.GRIEVANCE_CREATED,
    });
    assert(createLogs.length >= 1, 'TEST 3.1: Grievance submission generates GRIEVANCE_CREATED audit log');
    assert(createLogs[0].actorUid === citizen.uid, 'TEST 3.2: Record tracks submitting citizen UID');
    assert(createLogs[0].actorRole === USER_ROLES.CITIZEN, 'TEST 3.3: Record tracks citizen role');
    assert(createLogs[0].departmentId === 'roads', 'TEST 3.4: Record tracks routed departmentId (roads)');
    assert(createLogs[0].newStatus === COMPLAINT_STATUS.SUBMITTED, 'TEST 3.5: Record tracks newStatus SUBMITTED');

    // 3.2 Officer marks as seen -> GRIEVANCE_ACKNOWLEDGED & STATUS_CHANGED
    await grievanceService.markGrievanceAsSeen(gTest.id, roadsOfficer);

    const ackLogs = await auditLogService.getAuditLogs(superAdmin, {
      complaintId: gTest.id,
      action: AUDIT_ACTIONS.GRIEVANCE_ACKNOWLEDGED,
    });
    assert(ackLogs.length >= 1, 'TEST 3.6: Officer acknowledgment generates GRIEVANCE_ACKNOWLEDGED audit log');
    assert(ackLogs[0].actorUid === roadsOfficer.uid, 'TEST 3.7: Officer UID recorded');
    assert(ackLogs[0].previousStatus === COMPLAINT_STATUS.SUBMITTED, 'TEST 3.8: previousStatus SUBMITTED recorded');
    assert(ackLogs[0].newStatus === COMPLAINT_STATUS.SEEN, 'TEST 3.9: newStatus SEEN recorded');

    // 3.3 Officer requests SLA extension -> SLA_EXTENSION_REQUESTED
    await grievanceService.requestSLAExtension(gTest.id, roadsOfficer, {
      requestedHours: 12,
      reason: 'Awaiting specialized asphalt concrete delivery.',
    });

    const extReqLogs = await auditLogService.getAuditLogs(superAdmin, {
      complaintId: gTest.id,
      action: AUDIT_ACTIONS.SLA_EXTENSION_REQUESTED,
    });
    assert(extReqLogs.length >= 1, 'TEST 3.10: SLA extension request generates SLA_EXTENSION_REQUESTED audit log');

    // 3.4 Admin approves SLA extension -> SLA_EXTENSION_APPROVED
    const pendingExts = await grievanceService.getSLAExtensions(roadsAdmin);
    const targetExt = pendingExts.find((e) => e.grievanceId === gTest.id);
    await grievanceService.reviewSLAExtension(targetExt.id, roadsAdmin, {
      decision: 'APPROVED',
      adminRemarks: 'Extension authorized due to supplier delay.',
    });

    const extApproveLogs = await auditLogService.getAuditLogs(superAdmin, {
      complaintId: gTest.id,
      action: AUDIT_ACTIONS.SLA_EXTENSION_APPROVED,
    });
    assert(extApproveLogs.length >= 1, 'TEST 3.11: SLA extension approval generates SLA_EXTENSION_APPROVED audit log');

    // 3.5 Officer submits resolution evidence -> RESOLUTION_SUBMITTED
    await grievanceService.submitResolutionEvidence(gTest.id, roadsOfficer, {
      remarks: 'Trench reinforced with precast reinforced concrete slab.',
      afterMediaUrls: ['https://mockstorage/drain_fixed.jpg'],
    });

    const resSubmitLogs = await auditLogService.getAuditLogs(superAdmin, {
      complaintId: gTest.id,
      action: AUDIT_ACTIONS.RESOLUTION_SUBMITTED,
    });
    assert(resSubmitLogs.length >= 1, 'TEST 3.12: Resolution submission generates RESOLUTION_SUBMITTED audit log');
    assert(resSubmitLogs[0].newStatus === COMPLAINT_STATUS.VERIFICATION, 'TEST 3.13: State transition to VERIFICATION tracked');

    // 3.6 Admin rejects resolution -> RESOLUTION_REJECTED
    await grievanceService.verifyResolution(gTest.id, roadsAdmin, {
      approved: false,
      rejectionReason: 'Surface asphalt leveling incomplete around curb.',
    });

    const resRejectLogs = await auditLogService.getAuditLogs(superAdmin, {
      complaintId: gTest.id,
      action: AUDIT_ACTIONS.RESOLUTION_REJECTED,
    });
    assert(resRejectLogs.length >= 1, 'TEST 3.14: Admin rejection generates RESOLUTION_REJECTED audit log');
    assert(resRejectLogs[0].newStatus === COMPLAINT_STATUS.IN_PROGRESS, 'TEST 3.15: Reversion to IN_PROGRESS tracked');

    // 3.7 Officer re-submits corrected resolution -> RESOLUTION_SUBMITTED
    await grievanceService.submitResolutionEvidence(gTest.id, roadsOfficer, {
      remarks: 'Asphalt asphalt repaved and leveled to grade.',
      afterMediaUrls: ['https://mockstorage/drain_fixed_v2.jpg'],
    });

    // 3.8 Admin verifies & approves resolution -> RESOLUTION_VERIFIED
    await grievanceService.verifyResolution(gTest.id, roadsAdmin, { approved: true });

    const resVerifiedLogs = await auditLogService.getAuditLogs(superAdmin, {
      complaintId: gTest.id,
      action: AUDIT_ACTIONS.RESOLUTION_VERIFIED,
    });
    assert(resVerifiedLogs.length >= 1, 'TEST 3.16: Admin approval generates RESOLUTION_VERIFIED audit log');
    assert(resVerifiedLogs[0].newStatus === COMPLAINT_STATUS.VERIFIED_RESOLVED, 'TEST 3.17: Verified resolved state recorded');

    // 3.9 Admin closes grievance -> GRIEVANCE_CLOSED
    await grievanceService.closeGrievance(gTest.id, roadsAdmin, {
      closureRemarks: 'Final inspection completed. Quality confirmed.',
    });

    const closedLogs = await auditLogService.getAuditLogs(superAdmin, {
      complaintId: gTest.id,
      action: AUDIT_ACTIONS.GRIEVANCE_CLOSED,
    });
    assert(closedLogs.length >= 1, 'TEST 3.18: Final closure generates GRIEVANCE_CLOSED audit log');
    assert(closedLogs[0].previousStatus === COMPLAINT_STATUS.VERIFIED_RESOLVED, 'TEST 3.19: previousStatus VERIFIED_RESOLVED');
    assert(closedLogs[0].newStatus === COMPLAINT_STATUS.CLOSED, 'TEST 3.20: newStatus CLOSED');
  } catch (err) {
    assert(false, 'Step 3: Complete lifecycle audit logging', err.message);
  }

  // --- Step 4: Department Boundary Isolation ---
  console.log('\n--- Step 4: Department Boundary Isolation on Audit Logs ---');
  try {
    // 4.1 Create a Sanitation grievance
    const gSan = await grievanceService.createGrievance(citizen, {
      title: 'Overflowing commercial garbage compactor',
      description: 'Garbage spilling into storm drain.',
      categoryId: 'garbage',
      ward: 'Ward 2 - South',
      severity: SEVERITY_LEVELS.MEDIUM,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });

    // 4.2 Roads Admin queries audit logs -> Must NOT see Sanitation grievance audit logs
    const roadsAdminLogs = await auditLogService.getAuditLogs(roadsAdmin);
    const leakedSanitation = roadsAdminLogs.find((l) => l.grievanceId === gSan.id || l.departmentId === 'garbage');
    assert(!leakedSanitation, 'TEST 4.1: Roads Admin CANNOT see Sanitation department audit logs');

    // 4.3 Sanitation Admin CAN see Sanitation grievance audit logs
    const sanAdminLogs = await auditLogService.getAuditLogs(sanitationAdmin);
    const seenSanitation = sanAdminLogs.find((l) => l.grievanceId === gSan.id);
    assert(Boolean(seenSanitation), 'TEST 4.2: Sanitation Admin CAN see Sanitation audit logs');

    // 4.4 Roads Admin explicitly requesting Sanitation departmentId -> Access Denied
    try {
      await auditLogService.getAuditLogs(roadsAdmin, { departmentId: 'garbage' });
      assert(false, 'TEST 4.3: Roads Admin should not request Sanitation audit logs');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 4.3: Blocked cross-department audit query attempt');
    }

    // 4.5 Super Admin CAN see both Roads and Sanitation logs
    const superLogs = await auditLogService.getAuditLogs(superAdmin);
    const hasRoads = superLogs.some((l) => l.departmentId === 'roads');
    const hasSan = superLogs.some((l) => l.departmentId === 'garbage');
    assert(hasRoads && hasSan, 'TEST 4.4: Super Admin has unified visibility across all departments');
  } catch (err) {
    assert(false, 'Step 4: Department isolation', err.message);
  }

  // --- Step 5: Immutability & Anti-Tampering Protections ---
  console.log('\n--- Step 5: Immutability & Anti-Tampering Enforcement ---');
  try {
    // 5.1 Attempt to update audit log -> Blocked
    try {
      await auditLogService.updateAuditLog('LOG-MOCK-01', { remarks: 'Tampered' });
      assert(false, 'TEST 5.1: updateAuditLog must throw error');
    } catch (err) {
      assert(err.message.includes('immutable'), 'TEST 5.1: Blocked modification attempt on immutable audit records');
    }

    // 5.2 Attempt to delete audit log -> Blocked
    try {
      await auditLogService.deleteAuditLog('LOG-MOCK-01');
      assert(false, 'TEST 5.2: deleteAuditLog must throw error');
    } catch (err) {
      assert(err.message.includes('immutable'), 'TEST 5.2: Blocked deletion attempt on immutable audit records');
    }
  } catch (err) {
    assert(false, 'Step 5: Immutability', err.message);
  }

  // --- Step 6: Filter Permutations ---
  console.log('\n--- Step 6: Multi-Dimensional Filter Verification ---');
  try {
    // 6.1 Filter by Role (OFFICER)
    const officerOnly = await auditLogService.getAuditLogs(superAdmin, { role: USER_ROLES.OFFICER });
    assert(
      officerOnly.length > 0 && officerOnly.every((l) => l.actorRole === USER_ROLES.OFFICER),
      'TEST 6.1: Role filter returns only logs matching requested actorRole'
    );

    // 6.2 Filter by Action (GRIEVANCE_CLOSED)
    const closedOnly = await auditLogService.getAuditLogs(superAdmin, { action: AUDIT_ACTIONS.GRIEVANCE_CLOSED });
    assert(
      closedOnly.length > 0 && closedOnly.every((l) => l.action === AUDIT_ACTIONS.GRIEVANCE_CLOSED),
      'TEST 6.2: Action filter returns only logs matching requested action'
    );

    // 6.3 Date Range Filter (Today)
    const todayOnly = await auditLogService.getAuditLogs(superAdmin, { dateRange: 'today' });
    assert(todayOnly.length > 0, 'TEST 6.3: Date range filter "today" captures today\'s logs');

    // 6.4 Free-Text Search Filter
    const searched = await auditLogService.getAuditLogs(superAdmin, { searchTerm: 'concrete slab' });
    assert(searched.length > 0, 'TEST 6.4: Search term filter accurately finds matching narrative keywords');
  } catch (err) {
    assert(false, 'Step 6: Filtering', err.message);
  }

  // --- Summary ---
  console.log('\n================================================================');
  console.log(`MODULE 7 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runModule7Tests().catch((e) => {
  console.error('Fatal error during Module 7 test run:', e);
  process.exit(1);
});
