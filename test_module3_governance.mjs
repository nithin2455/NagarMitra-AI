/**
 * @file test_module3_governance.mjs
 * @description Automated Unit & Integration Tests for Module 3 (Dynamic SLA, Priority & Escalation Governance)
 */

import { authService, INITIAL_PROVISIONED_ACCOUNTS } from './src/services/firebase/authService.js';
import { grievanceService } from './src/services/firebase/grievanceService.js';
import { slaEngine } from './src/services/governance/slaEngine.js';
import { priorityEngine } from './src/services/governance/priorityEngine.js';
import { escalationEngine } from './src/services/governance/escalationEngine.js';
import {
  USER_ROLES,
  CATEGORIES,
  SEVERITY_LEVELS,
  COMPLAINT_STATUS,
  ESCALATION_LEVELS,
  EXTENSION_LIMITS,
} from './src/models/schema.js';

// Setup mock localStorage in Node.js test environment
const memoryStore = {};
global.localStorage = {
  getItem: (key) => memoryStore[key] || null,
  setItem: (key, val) => { memoryStore[key] = String(val); },
  removeItem: (key) => { delete memoryStore[key]; },
  clear: () => { for (const k in memoryStore) delete memoryStore[k]; },
};

async function runModule3Tests() {
  console.log('================================================================');
  console.log('STARTING MODULE 3: DYNAMIC SLA, PRIORITY & ESCALATION TESTS');
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

  // --- TEST 1: Citizen submits LOW priority grievance with dynamic SLA ---
  console.log('--- TEST 1: Low Priority Grievance Dynamic SLA Calculation ---');
  let lowGrievance;
  try {
    const citizen = await authService.register('vikas.mehta@example.com', 'Pass@123456', 'Vikas Mehta');
    lowGrievance = await grievanceService.createGrievance(citizen, {
      categoryId: 'garbage',
      title: 'Minor garbage litter on walkway corner',
      description: 'Some dry paper and plastic cups on side pavement.',
      ward: 'Ward 4 - North Zone',
      severity: SEVERITY_LEVELS.LOW,
      isSensitive: false,
    });

    // Base garbage: 12h response, 36h resolution. Multiplier for LOW = 1.5x -> 18h response, 54h resolution.
    assert(lowGrievance.responseSlaHours === 18, `TEST 1.1: LOW severity response SLA computed: ${lowGrievance.responseSlaHours}h (Base: 12h * 1.5)`);
    assert(lowGrievance.resolutionSlaHours === 54, `TEST 1.2: LOW severity resolution SLA computed: ${lowGrievance.resolutionSlaHours}h (Base: 36h * 1.5)`);
    assert(lowGrievance.priorityLevel === 'LOW', `TEST 1.3: Priority level categorized as LOW (${lowGrievance.priorityScore})`);
  } catch (err) {
    assert(false, 'TEST 1: Low priority grievance submission', err.message);
  }

  // --- TEST 2: Citizen submits CRITICAL safety hazard with ZERO community support ---
  console.log('\n--- TEST 2: Critical Safety Hazard with Zero Community Support ---');
  let criticalGrievance;
  try {
    const citizen = await authService.login('vikas.mehta@example.com', 'Pass@123456');
    criticalGrievance = await grievanceService.createGrievance(citizen, {
      categoryId: 'roads',
      title: 'Major road collapse and deep crater on arterial bus route',
      description: 'Severe structural road collapse obstructing transit lane directly outside central bus hub.',
      ward: 'Ward 8 - Central Zone',
      severity: SEVERITY_LEVELS.CRITICAL,
      isSensitive: false,
    });

    // Zero community support
    assert(criticalGrievance.supportCount === 0, 'TEST 2.1: Community support is strictly 0');
    // Critical safety override ensures score >= 85 and CRITICAL level
    assert(criticalGrievance.priorityScore >= 85.0, `TEST 2.2: Critical safety issue received priority score: ${criticalGrievance.priorityScore}`);
    assert(criticalGrievance.priorityLevel === 'CRITICAL', 'TEST 2.3: Priority level is strictly CRITICAL despite 0 community votes');
    // Base roads: 12h response, 72h resolution. Multiplier for CRITICAL = 0.25x -> 3h response, 18h resolution.
    assert(criticalGrievance.responseSlaHours === 3, `TEST 2.4: Response SLA shortened to ${criticalGrievance.responseSlaHours}h for emergency hazard`);
    assert(criticalGrievance.resolutionSlaHours === 18, `TEST 2.5: Resolution SLA shortened to ${criticalGrievance.resolutionSlaHours}h`);
  } catch (err) {
    assert(false, 'TEST 2: Critical safety hazard priority test', err.message);
  }

  // --- TEST 3: Officer marks grievance SEEN -> Response SLA stops ---
  console.log('\n--- TEST 3: Officer Marks SEEN -> Response SLA Halts ---');
  try {
    const officer = INITIAL_PROVISIONED_ACCOUNTS['officer.roads@civicpulse.org'];
    const seenRecord = await grievanceService.markGrievanceAsSeen(criticalGrievance.id, officer);
    assert(seenRecord.status === COMPLAINT_STATUS.SEEN, 'TEST 3.1: Status updated to SEEN');
    assert(Boolean(seenRecord.seenAt), 'TEST 3.2: seenAt timestamp successfully recorded');

    const updatedGrievance = await grievanceService.getGrievanceById(criticalGrievance.id);
    const responseEval = slaEngine.evaluateResponseSLA(updatedGrievance);
    assert(responseEval.isStopped === true, 'TEST 3.3: Response SLA clock officially halted upon marking SEEN');
    assert(responseEval.isMet === true, 'TEST 3.4: Response SLA evaluated as MET');
  } catch (err) {
    assert(false, 'TEST 3: Officer mark seen test', err.message);
  }

  // --- TEST 4: Resolution SLA Continues Running ---
  console.log('\n--- TEST 4: Resolution SLA Clock Continues Running ---');
  try {
    const updatedGrievance = await grievanceService.getGrievanceById(criticalGrievance.id);
    const resolutionEval = slaEngine.evaluateResolutionSLA(updatedGrievance);
    assert(resolutionEval.isStopped === false, 'TEST 4.1: Resolution SLA clock remains actively counting down');
    assert(resolutionEval.remainingHours > 0, `TEST 4.2: Remaining resolution time: ${resolutionEval.formattedCountdown}`);
  } catch (err) {
    assert(false, 'TEST 4: Resolution SLA clock continuity test', err.message);
  }

  // --- TEST 5: Officer Requests SLA Extension (Cannot directly change deadline) ---
  console.log('\n--- TEST 5: Officer SLA Extension Request Governance ---');
  let extensionRequest;
  try {
    const officer = INITIAL_PROVISIONED_ACCOUNTS['officer.roads@civicpulse.org'];
    extensionRequest = await grievanceService.requestSLAExtension(criticalGrievance.id, officer, {
      requestedHours: 12,
      reason: 'Specialized high-voltage transformer crane team dispatched from central grid.',
    });

    assert(extensionRequest !== null, 'TEST 5.1: Extension request created');
    assert(extensionRequest.status === 'PENDING', 'TEST 5.2: Extension status is PENDING (Officer cannot self-approve)');

    const unchangedGrievance = await grievanceService.getGrievanceById(criticalGrievance.id);
    assert(
      unchangedGrievance.resolutionSlaDue === criticalGrievance.resolutionSlaDue,
      'TEST 5.3: Grievance deadline unchanged prior to administrative review'
    );
  } catch (err) {
    assert(false, 'TEST 5: Extension request governance test', err.message);
  }

  // --- TEST 6: Department Admin Approves Extension ---
  console.log('\n--- TEST 6: Department Admin Extension Approval & Audit History ---');
  try {
    // Roads Admin reviews extension
    const roadsAdmin = INITIAL_PROVISIONED_ACCOUNTS['admin.roads@civicpulse.org'];
    const approved = await grievanceService.reviewSLAExtension(extensionRequest.id, roadsAdmin, {
      decision: 'APPROVED',
      adminRemarks: 'Approved for electrical team coordination.',
    });

    assert(approved.status === 'APPROVED', 'TEST 6.1: Extension decision marked APPROVED');

    const extendedGrievance = await grievanceService.getGrievanceById(criticalGrievance.id);
    assert(extendedGrievance.extensionCount === 1, 'TEST 6.2: Extension count incremented to 1');
    assert(extendedGrievance.extensionHistory.length === 1, 'TEST 6.3: Original deadline preserved in extension history');
    assert(
      new Date(extendedGrievance.resolutionSlaDue).getTime() > new Date(criticalGrievance.resolutionSlaDue).getTime(),
      'TEST 6.4: Resolution SLA deadline updated to proposed extended time'
    );
  } catch (err) {
    assert(false, 'TEST 6: Extension approval test', err.message);
  }

  // --- TEST 7: Extension Limits Enforced ---
  console.log('\n--- TEST 7: Extension Limits & Denial of Indefinite Postponement ---');
  try {
    const officer = INITIAL_PROVISIONED_ACCOUNTS['officer.roads@civicpulse.org'];
    const superAdmin = INITIAL_PROVISIONED_ACCOUNTS['admin@civicpulse.org'];

    // 2nd Extension Request
    const ext2 = await grievanceService.requestSLAExtension(criticalGrievance.id, officer, {
      requestedHours: 12,
      reason: 'Severe weather delay.',
    });
    await grievanceService.reviewSLAExtension(ext2.id, superAdmin, { decision: 'APPROVED' });

    // 3rd Extension Request (Must be rejected by policy: MAX_EXTENSIONS_PER_COMPLAINT = 2)
    try {
      await grievanceService.requestSLAExtension(criticalGrievance.id, officer, {
        requestedHours: 24,
        reason: 'Third extension attempt.',
      });
      assert(false, 'TEST 7.1: Should reject 3rd extension attempt');
    } catch (err) {
      assert(err.message.includes('Extension limit reached'), 'TEST 7.1: Correctly blocked 3rd extension request');
    }
  } catch (err) {
    assert(false, 'TEST 7: Extension limits test', err.message);
  }

  // --- TEST 8: Automatic SLA Breach Escalation ---
  console.log('\n--- TEST 8: Automatic SLA Breach Escalation Governance ---');
  try {
    // Simulated overdue grievance (due 2 hours ago)
    const overdueGrievance = {
      id: 'CP-2026-TEST-OVERDUE',
      createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
      responseSlaDue: new Date(Date.now() - 3600000 * 15).toISOString(),
      resolutionSlaDue: new Date(Date.now() - 3600000 * 2).toISOString(),
      seenAt: new Date(Date.now() - 3600000 * 18).toISOString(),
      status: COMPLAINT_STATUS.IN_PROGRESS,
      severity: SEVERITY_LEVELS.HIGH,
      departmentId: 'roads',
      followUpCount: 0,
      extensionCount: 0,
    };

    const escalation = escalationEngine.evaluateEscalation(overdueGrievance);
    assert(
      escalation.level === ESCALATION_LEVELS.DEPARTMENT_ESCALATED,
      `TEST 8: Overdue Resolution SLA automatically triggered: ${escalation.level}`
    );
  } catch (err) {
    assert(false, 'TEST 8: Escalation engine test', err.message);
  }

  // --- TEST 9: Officer Submits Resolution Proof -> Resolution SLA Continues ---
  console.log('\n--- TEST 9: Resolution Evidence Submission & Clock Continuity ---');
  try {
    const officer = INITIAL_PROVISIONED_ACCOUNTS['officer.roads@civicpulse.org'];
    const inReviewGrievance = await grievanceService.submitResolutionEvidence(criticalGrievance.id, officer, {
      remarks: 'Insulation replaced and high-tension wire secured at 18 feet elevation.',
      afterMediaUrls: ['https://storage.googleapis.com/mock-after.jpg'],
    });

    assert(inReviewGrievance.status === COMPLAINT_STATUS.VERIFICATION, 'TEST 9.1: Status transitioned to VERIFICATION');
    assert(Boolean(inReviewGrievance.verificationSubmittedAt), 'TEST 9.2: verificationSubmittedAt recorded');

    // Crucial rule verification: Resolution SLA MUST NOT stop!
    const resolutionEval = slaEngine.evaluateResolutionSLA(inReviewGrievance);
    assert(resolutionEval.isStopped === false, 'TEST 9.3: Resolution SLA clock CONTINUES running during Admin verification gate');
  } catch (err) {
    assert(false, 'TEST 9: Resolution proof submission test', err.message);
  }

  // --- TEST 10: Department Admin Verifies Resolution -> Status VERIFIED_RESOLVED, Clock Halts ---
  console.log('\n--- TEST 10: Department Admin Verification & SLA Clock Termination ---');
  try {
    const roadsAdmin = INITIAL_PROVISIONED_ACCOUNTS['admin.roads@civicpulse.org'];
    const verificationResult = await grievanceService.verifyResolution(criticalGrievance.id, roadsAdmin, {
      approved: true,
    });

    assert(verificationResult.status === COMPLAINT_STATUS.VERIFIED_RESOLVED, 'TEST 10.1: Status updated to VERIFIED_RESOLVED');
    assert(Boolean(verificationResult.verifiedResolvedAt), 'TEST 10.2: verifiedResolvedAt recorded');

    const completedGrievance = await grievanceService.getGrievanceById(criticalGrievance.id);
    const finalResolutionEval = slaEngine.evaluateResolutionSLA(completedGrievance);
    assert(finalResolutionEval.isStopped === true, 'TEST 10.3: Resolution SLA officially HALTED upon Admin Verification sign-off');
    assert(completedGrievance.escalationLevel === ESCALATION_LEVELS.RESOLVED, 'TEST 10.4: Escalation state cleared to RESOLVED');
  } catch (err) {
    assert(false, 'TEST 10: Verification sign-off test', err.message);
  }

  // --- TEST 11: Verification SLA Overdue Evaluation ---
  console.log('\n--- TEST 11: Verification SLA Overdue Evaluation ---');
  try {
    const delayedVerificationGrievance = {
      id: 'CP-2026-TEST-VERIFY-DELAY',
      status: COMPLAINT_STATUS.VERIFICATION,
      verificationSubmittedAt: new Date(Date.now() - 3600000 * 30).toISOString(), // 30h ago (> 24h)
      verificationSlaHours: 24,
      verifiedResolvedAt: null,
    };

    const verEval = slaEngine.evaluateVerificationSLA(delayedVerificationGrievance);
    assert(verEval.isOverdue === true, 'TEST 11.1: Correctly flagged Verification SLA as overdue (> 24h)');
    assert(verEval.overdueHours >= 6, `TEST 11.2: Overdue hours calculated: ${verEval.overdueHours}h`);
  } catch (err) {
    assert(false, 'TEST 11: Verification SLA test', err.message);
  }

  // --- TEST 12: Citizen "Still Not Resolved" 1-Citizen-1-Vote Follow-up ---
  console.log('\n--- TEST 12: Citizen Follow-Up Governance ---');
  try {
    const citizen1 = await authService.register('arjun.patel@example.com', 'Pass@123456', 'Arjun Patel');
    const citizen2 = await authService.register('kavita.desai@example.com', 'Pass@123456', 'Kavita Desai');
    const citizen3 = await authService.register('manoj.kumar@example.com', 'Pass@123456', 'Manoj Kumar');

    // 1st follow-up
    await grievanceService.submitFollowUp(lowGrievance.id, citizen1);
    const f1 = await grievanceService.getGrievanceById(lowGrievance.id);
    assert(f1.followUpCount === 1, 'TEST 12.1: 1st follow-up recorded');

    // Duplicate prevention: citizen1 tries again -> MUST REJECT!
    try {
      await grievanceService.submitFollowUp(lowGrievance.id, citizen1);
      assert(false, 'TEST 12.2: Should prevent duplicate follow-up from same citizen');
    } catch (e) {
      assert(e.message.includes('already registered'), 'TEST 12.2: Correctly prevented duplicate follow-up from same citizen');
    }

    // 2nd & 3rd unique follow-ups
    await grievanceService.submitFollowUp(lowGrievance.id, citizen2);
    await grievanceService.submitFollowUp(lowGrievance.id, citizen3);

    const f3 = await grievanceService.getGrievanceById(lowGrievance.id);
    assert(f3.followUpCount === 3, 'TEST 12.3: Unique follow-up count reached 3');
    assert(
      f3.escalationLevel === ESCALATION_LEVELS.DEPARTMENT_ESCALATED,
      `TEST 12.4: 3 Unique citizen follow-ups triggered: ${f3.escalationLevel}`
    );
  } catch (err) {
    assert(false, 'TEST 12: Follow-up governance test', err.message);
  }

  // --- TEST 13: Department Admin Isolation ---
  console.log('\n--- TEST 13: Department Admin Boundary Enforcement ---');
  try {
    // Water Admin attempts to approve a Roads extension -> MUST BE REJECTED!
    const waterAdmin = INITIAL_PROVISIONED_ACCOUNTS['admin.water@civicpulse.org'];
    const roadsExt = {
      id: 'EXT-ROADS-001',
      grievanceId: 'CP-2026-0002',
      departmentId: 'roads',
      requestedHours: 12,
      reason: 'Road work delay',
      status: 'PENDING',
      requiresSuperAdmin: false,
    };

    // Save to test store
    const list = [roadsExt];
    localStorage.setItem('civicpulse_extensions_db', JSON.stringify(list));

    try {
      await grievanceService.reviewSLAExtension('EXT-ROADS-001', waterAdmin, { decision: 'APPROVED' });
      assert(false, 'TEST 13: Water Admin should not be allowed to approve Roads extension');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 13: Correctly blocked Water Admin from modifying Roads extension');
    }
  } catch (err) {
    assert(false, 'TEST 13: Department Admin isolation test', err.message);
  }

  // --- TEST 14: Super Admin Access to All Departments ---
  console.log('\n--- TEST 14: Super Admin Unrestricted Department Oversight ---');
  try {
    const superAdmin = INITIAL_PROVISIONED_ACCOUNTS['admin@civicpulse.org'];
    const allGrievances = await grievanceService.getDepartmentGrievances('all');
    assert(Array.isArray(allGrievances) && allGrievances.length >= 2, 'TEST 14.1: Super Admin can query cross-department grievances');

    const allExtensions = await grievanceService.getSLAExtensions(superAdmin);
    assert(Array.isArray(allExtensions), 'TEST 14.2: Super Admin can access all department extension queues');
  } catch (err) {
    assert(false, 'TEST 14: Super Admin access test', err.message);
  }

  // --- TEST 15: Module 1 Regression & Role Boundary Verification ---
  console.log('\n--- TEST 15: Regression & Role Boundary Verification ---');
  try {
    // Super Admin login check
    const superAdminAcc = INITIAL_PROVISIONED_ACCOUNTS['admin@civicpulse.org'];
    const sa = await authService.login(superAdminAcc.email, superAdminAcc.password, USER_ROLES.ADMIN);
    assert(sa.role === USER_ROLES.SUPER_ADMIN, 'TEST 15.1: Super Admin authenticated successfully');

    // Department Admin login check
    const deptAdminAcc = INITIAL_PROVISIONED_ACCOUNTS['admin.roads@civicpulse.org'];
    const da = await authService.login(deptAdminAcc.email, deptAdminAcc.password, USER_ROLES.ADMIN);
    assert(da.role === USER_ROLES.DEPARTMENT_ADMIN, 'TEST 15.2: Roads Dept Admin authenticated successfully');
    assert(da.departmentId === 'roads', 'TEST 15.3: Roads Dept Admin departmentId verified');
  } catch (err) {
    assert(false, 'TEST 15: Regression test', err.message);
  }

  console.log('\n================================================================');
  console.log(`MODULE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runModule3Tests().catch((e) => {
  console.error('Fatal error during test run:', e);
  process.exit(1);
});
