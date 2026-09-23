/**
 * @file test_module5_resolution_verification.mjs
 * @description Automated Unit & Integration Tests for Module 5: Complete Officer Resolution, Admin Verification & Final Closure Workflow
 */

import { authService, INITIAL_PROVISIONED_ACCOUNTS } from './src/services/firebase/authService.js';
import { grievanceService } from './src/services/firebase/grievanceService.js';
import { storageService } from './src/services/firebase/storageService.js';
import { slaEngine } from './src/services/governance/slaEngine.js';
import {
  USER_ROLES,
  COMPLAINT_STATUS,
  COMPLAINT_VISIBILITY,
  SEVERITY_LEVELS,
  ESCALATION_LEVELS,
} from './src/models/schema.js';

// Setup mock localStorage
const memoryStore = {};
global.localStorage = {
  getItem: (key) => memoryStore[key] || null,
  setItem: (key, val) => { memoryStore[key] = String(val); },
  removeItem: (key) => { delete memoryStore[key]; },
  clear: () => { for (const k in memoryStore) delete memoryStore[k]; },
};

async function runModule5Tests() {
  console.log('================================================================');
  console.log('STARTING MODULE 5: RESOLUTION, VERIFICATION & CLOSURE TESTS');
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

  // --- Step 0: Accounts Setup ---
  const citizenUser = await authService.register('pooja.nair@example.com', 'Pass@123456', 'Pooja Nair');

  const roadsOfficerCreds = INITIAL_PROVISIONED_ACCOUNTS['officer.roads@civicpulse.org'];
  const sanitationOfficerCreds = INITIAL_PROVISIONED_ACCOUNTS['officer.sanitation@civicpulse.org'];
  const roadsAdminCreds = INITIAL_PROVISIONED_ACCOUNTS['admin.roads@civicpulse.org'];
  const sanitationAdminCreds = INITIAL_PROVISIONED_ACCOUNTS['admin.sanitation@civicpulse.org'];
  const superAdminCreds = INITIAL_PROVISIONED_ACCOUNTS['admin@civicpulse.org'];

  const roadsOfficer = await authService.login(roadsOfficerCreds.email, roadsOfficerCreds.password, 'officer');
  const sanitationOfficer = await authService.login(sanitationOfficerCreds.email, sanitationOfficerCreds.password, 'officer');
  const roadsAdmin = await authService.login(roadsAdminCreds.email, roadsAdminCreds.password, 'admin');
  const sanitationAdmin = await authService.login(sanitationAdminCreds.email, sanitationAdminCreds.password, 'admin');
  const superAdmin = await authService.login(superAdminCreds.email, superAdminCreds.password, 'admin');

  // --- TEST 1 & 2: Department Isolation on Complaint Detail View ---
  console.log('--- Step 1: Officer Complaint Access & Isolation ---');
  let sanitationComplaint;
  try {
    sanitationComplaint = await grievanceService.createGrievance(citizenUser, {
      title: 'Severe garbage accumulation and stench near market square',
      description: 'Organic and dry waste overflow creating hygiene issue.',
      categoryId: 'garbage',
      ward: 'Ward 4 - North Zone',
      landmark: 'Near City Market Gate 2',
      severity: SEVERITY_LEVELS.HIGH,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });

    // 1. Sanitation Officer opens Sanitation Complaint -> Allowed
    const fetchedBySanitationOfficer = await grievanceService.getGrievanceById(
      sanitationComplaint.id,
      sanitationOfficer
    );
    assert(Boolean(fetchedBySanitationOfficer), 'TEST 1: Sanitation Officer can open Sanitation complaint');

    // 2. Roads Officer attempts to open private Sanitation Complaint -> ACCESS DENIED
    const privateSanitationComplaint = await grievanceService.createGrievance(citizenUser, {
      title: 'Private sewage overflow on residential compound',
      description: 'Private sewer backflow in backyard.',
      categoryId: 'garbage',
      ward: 'Ward 4 - North Zone',
      severity: SEVERITY_LEVELS.MEDIUM,
      visibility: COMPLAINT_VISIBILITY.PRIVATE,
    });

    try {
      await grievanceService.getGrievanceById(privateSanitationComplaint.id, roadsOfficer);
      assert(false, 'TEST 2.1: Roads Officer should NOT be able to open private Sanitation complaint');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 2.1: Correctly blocked Roads Officer from accessing private Sanitation complaint');
    }

    // 2.2 Cross-department acknowledgment guard
    try {
      await grievanceService.markGrievanceAsSeen(sanitationComplaint.id, roadsOfficer);
      assert(false, 'TEST 2.2: Roads Officer should not acknowledge Sanitation complaint');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 2.2: Correctly blocked Roads Officer from acknowledging Sanitation complaint');
    }
  } catch (err) {
    assert(false, 'Step 1: Access isolation', err.message);
  }

  // --- TEST 3 & 4: Officer Acknowledges Complaint & Claims Ownership ---
  console.log('\n--- Step 2: Officer Acknowledges Complaint & Fulfills Response SLA ---');
  try {
    const acknowledged = await grievanceService.markGrievanceAsSeen(sanitationComplaint.id, sanitationOfficer);
    assert(acknowledged.status === COMPLAINT_STATUS.SEEN, 'TEST 3.1: Complaint status transitioned to SEEN');
    assert(Boolean(acknowledged.seenAt), 'TEST 3.2: seenAt timestamp recorded, fulfilling Response SLA');

    const updatedGrievance = await grievanceService.getGrievanceById(sanitationComplaint.id);
    assert(
      updatedGrievance.assignedOfficerId === sanitationOfficer.uid,
      'TEST 4: assignedOfficerId successfully bound to Sanitation Officer UID'
    );
  } catch (err) {
    assert(false, 'Step 2: Acknowledgment & ownership', err.message);
  }

  // --- TEST 5: Storage Validation Rules ---
  console.log('\n--- Step 3: Photo Evidence Validation Rules ---');
  try {
    // 5.1 Invalid file type
    try {
      storageService.validateFile({ type: 'application/x-executable', size: 1024 });
      assert(false, 'TEST 5.1: Should reject executable');
    } catch (err) {
      assert(err.message.includes('Unsupported file format'), 'TEST 5.1: Correctly rejected unsupported file type');
    }

    // 5.2 Oversized file
    try {
      storageService.validateFile({ type: 'image/jpeg', size: 15 * 1024 * 1024 });
      assert(false, 'TEST 5.2: Should reject file > 10MB');
    } catch (err) {
      assert(err.message.includes('too large'), 'TEST 5.2: Correctly rejected file exceeding 10MB limit');
    }

    // 5.3 Valid image
    const validFile = storageService.validateFile({ type: 'image/jpeg', size: 2 * 1024 * 1024 });
    assert(validFile === true, 'TEST 5.3: Valid JPEG file (2MB) passes validation');
  } catch (err) {
    assert(false, 'Step 3: Storage validation', err.message);
  }

  // --- TEST 6, 7, 8: Resolution Proof Validation & Pre-checks ---
  console.log('\n--- Step 4: Resolution Proof Validation & Pre-checks ---');
  try {
    // Missing Remarks Check
    try {
      await grievanceService.submitResolutionEvidence(sanitationComplaint.id, sanitationOfficer, {
        remarks: '',
        afterMediaUrls: ['https://mockstorage/after.jpg'],
      });
      assert(false, 'TEST 8.1: Should reject empty remarks');
    } catch (err) {
      assert(err.message.includes('remarks are required'), 'TEST 8.1: Correctly caught missing completion remarks');
    }

    // Missing Evidence Check
    try {
      await grievanceService.submitResolutionEvidence(sanitationComplaint.id, sanitationOfficer, {
        remarks: 'Waste cleared and disinfected.',
        afterMediaUrls: [],
      });
      assert(false, 'TEST 8.2: Should reject empty evidence');
    } catch (err) {
      assert(err.message.includes('photographic proof is required'), 'TEST 8.2: Correctly caught missing evidence files');
    }

    // Wrong Department Officer Submission Check
    try {
      await grievanceService.submitResolutionEvidence(sanitationComplaint.id, roadsOfficer, {
        remarks: 'Roads team attempting sanitation resolution.',
        afterMediaUrls: ['https://mockstorage/after.jpg'],
      });
      assert(false, 'TEST 8.3: Roads Officer should not resolve Sanitation complaint');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 8.3: Correctly blocked wrong department officer from submitting resolution');
    }
  } catch (err) {
    assert(false, 'Step 4: Validation checks', err.message);
  }

  // --- TEST 9 & 10: Successful Resolution Submission -> Transitions to VERIFICATION ---
  console.log('\n--- Step 5: Resolution Submission & State Transition ---');
  let submittedUnderVerification;
  try {
    submittedUnderVerification = await grievanceService.submitResolutionEvidence(
      sanitationComplaint.id,
      sanitationOfficer,
      {
        remarks: '2.5 tons of overflow garbage cleared using mechanical loader; area disinfected with bleaching powder.',
        afterMediaUrls: ['https://mockstorage/sanitation_after_01.jpg'],
      }
    );

    assert(
      submittedUnderVerification.status === COMPLAINT_STATUS.VERIFICATION,
      'TEST 9: Status transitioned to VERIFICATION (Under Verification Gate)'
    );
    assert(
      submittedUnderVerification.resolutionProof.submittedByType === 'OFFICER',
      'TEST 10.1: Resolution proof source recorded as OFFICER'
    );
    assert(
      submittedUnderVerification.resolutionProof.afterMediaUrls.length === 1,
      'TEST 10.2: After photographic evidence URL stored correctly'
    );

    // Crucial SLA Invariant Check
    const activeResSla = slaEngine.evaluateResolutionSLA(submittedUnderVerification);
    assert(
      activeResSla.isStopped === false,
      'TEST 10.3: Resolution SLA clock CONTINUES running during Admin verification gate'
    );
  } catch (err) {
    assert(false, 'Step 5: Submission flow', err.message);
  }

  // --- TEST 11, 12, 13: Department Admin Verification Station Inspection ---
  console.log('\n--- Step 6: Department Admin Verification Queue Inspection ---');
  try {
    const sanitationQueue = await grievanceService.getVerificationQueue(sanitationAdmin);
    const inQueue = sanitationQueue.find((g) => g.id === sanitationComplaint.id);

    assert(Boolean(inQueue), 'TEST 11: Sanitation Admin sees the submitted complaint in Verification Queue');
    assert(
      inQueue.resolutionProof?.afterMediaUrls?.length > 0,
      'TEST 13: AFTER rectification proof is visible to Admin'
    );
  } catch (err) {
    assert(false, 'Step 6: Verification queue', err.message);
  }

  // --- TEST 14, 15, 16: Verification Boundary & Anti-Self-Approval Enforcement ---
  console.log('\n--- Step 7: Authorization & Anti-Self-Approval Enforcement ---');
  try {
    // Wrong Department Admin attempts to verify -> Must be denied
    try {
      await grievanceService.verifyResolution(sanitationComplaint.id, roadsAdmin, { approved: true });
      assert(false, 'TEST 15: Roads Admin should not verify Sanitation complaint');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 15: Correctly blocked Roads Admin from verifying Sanitation grievance');
    }

    // Submitting Officer attempts to verify own resolution -> Must be denied
    try {
      await grievanceService.verifyResolution(sanitationComplaint.id, sanitationOfficer, { approved: true });
      assert(false, 'TEST 16: Submitting Officer should not verify own resolution');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 16: Correctly blocked Submitting Officer from self-verification');
    }
  } catch (err) {
    assert(false, 'Step 7: Authorization boundaries', err.message);
  }

  // --- TEST 17, 18, 19: Admin Rejection Flow & SLA Continuity ---
  console.log('\n--- Step 8: Admin Rejection Handling & Correction Workflow ---');
  let rejectedGrievance;
  try {
    rejectedGrievance = await grievanceService.verifyResolution(sanitationComplaint.id, sanitationAdmin, {
      approved: false,
      rejectionReason: 'Waste near curbstone remains uncleared. Provide full perimeter photo.',
    });

    assert(rejectedGrievance.status === COMPLAINT_STATUS.IN_PROGRESS, 'TEST 19: Status reverted back to IN_PROGRESS upon rejection');

    const inProgressGrievance = await grievanceService.getGrievanceById(sanitationComplaint.id);
    assert(
      inProgressGrievance.rejectionReason.includes('Waste near curbstone'),
      'TEST 19.2: Admin rejection reason recorded on complaint'
    );

    const continuingSla = slaEngine.evaluateResolutionSLA(inProgressGrievance);
    assert(
      continuingSla.isStopped === false,
      'TEST 20: Resolution SLA continues counting down with original deadline intact'
    );

    // Officer re-submits corrected evidence
    const correctedSubmission = await grievanceService.submitResolutionEvidence(
      sanitationComplaint.id,
      sanitationOfficer,
      {
        remarks: 'Perimeter cleaned completely and second photo attached.',
        afterMediaUrls: ['https://mockstorage/sanitation_after_corrected.jpg'],
      }
    );
    assert(
      correctedSubmission.status === COMPLAINT_STATUS.VERIFICATION,
      'TEST 21: Officer successfully re-submitted corrected resolution evidence'
    );
  } catch (err) {
    assert(false, 'Step 8: Rejection handling', err.message);
  }

  // --- TEST 20 & 21: Final Admin Approval & Resolution SLA Clock Termination ---
  console.log('\n--- Step 9: Admin Approval & Resolution SLA Termination ---');
  try {
    const verifiedApproval = await grievanceService.verifyResolution(sanitationComplaint.id, sanitationAdmin, {
      approved: true,
    });

    assert(
      verifiedApproval.status === COMPLAINT_STATUS.VERIFIED_RESOLVED,
      'TEST 17: Status updated to VERIFIED_RESOLVED'
    );

    const finalResolvedGrievance = await grievanceService.getGrievanceById(sanitationComplaint.id);
    const finalResolutionSla = slaEngine.evaluateResolutionSLA(finalResolvedGrievance);

    assert(
      finalResolutionSla.isStopped === true,
      'TEST 18: Resolution SLA officially HALTED upon Admin Verification sign-off'
    );
    assert(
      finalResolvedGrievance.escalationLevel === ESCALATION_LEVELS.RESOLVED,
      'TEST 18.2: Escalation state marked RESOLVED'
    );
  } catch (err) {
    assert(false, 'Step 9: Final Admin approval', err.message);
  }

  // --- TEST 22 & 23: State Machine Hardening (Cannot re-verify resolved complaint) ---
  console.log('\n--- Step 10: State Machine Hardening ---');
  try {
    try {
      await grievanceService.verifyResolution(sanitationComplaint.id, sanitationAdmin, { approved: true });
      assert(false, 'TEST 22.1: Should not allow re-verification of already resolved complaint');
    } catch (err) {
      assert(err.message.includes('Cannot verify grievance with status: VERIFIED_RESOLVED'), 'TEST 22.1: Prevented re-verification of resolved grievance');
    }

    try {
      await grievanceService.submitResolutionEvidence(sanitationComplaint.id, sanitationOfficer, {
        remarks: 'Attempting to resolve closed issue',
        afterMediaUrls: ['https://mockstorage/extra.jpg'],
      });
      assert(false, 'TEST 22.2: Should not allow resolution submission on resolved complaint');
    } catch (err) {
      assert(err.message.includes('Cannot submit resolution proof for grievance with status: VERIFIED_RESOLVED'), 'TEST 22.2: Prevented resolution submission on resolved grievance');
    }
  } catch (err) {
    assert(false, 'Step 10: State machine hardening', err.message);
  }

  // --- TEST 24: Citizen Views Final Verified Status ---
  console.log('\n--- Step 11: Citizen Verification Visibility ---');
  try {
    const citizenView = await grievanceService.getGrievanceById(sanitationComplaint.id, citizenUser);
    assert(
      citizenView.status === COMPLAINT_STATUS.VERIFIED_RESOLVED,
      'TEST 23.1: Citizen views final VERIFIED_RESOLVED status'
    );
    assert(
      Boolean(citizenView.verifiedResolvedAt),
      'TEST 23.2: Verification timestamp recorded and accessible to citizen'
    );
  } catch (err) {
    assert(false, 'Step 11: Citizen verification visibility', err.message);
  }

  // --- Step 12: Final Administrative Closure Workflow (VERIFIED_RESOLVED -> CLOSED) ---
  console.log('\n--- Step 12: Final Administrative Closure Workflow (VERIFIED_RESOLVED -> CLOSED) ---');
  try {
    // 12.1 Unauthorized Closure: Citizen attempts to close
    try {
      await grievanceService.closeGrievance(sanitationComplaint.id, citizenUser);
      assert(false, 'TEST 24.1: Citizen should not close grievance');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 24.1: Correctly blocked Citizen from closing grievance');
    }

    // 12.2 Unauthorized Closure: Officer attempts to close
    try {
      await grievanceService.closeGrievance(sanitationComplaint.id, sanitationOfficer);
      assert(false, 'TEST 24.2: Officer should not close grievance');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 24.2: Correctly blocked Officer from closing grievance');
    }

    // 12.3 Unauthorized Closure: Wrong Department Admin attempts to close
    try {
      await grievanceService.closeGrievance(sanitationComplaint.id, roadsAdmin);
      assert(false, 'TEST 24.3: Roads Admin should not close Sanitation grievance');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 24.3: Correctly blocked Roads Admin from closing Sanitation grievance');
    }

    // 12.4 Authorized Closure: Sanitation Admin closes Sanitation grievance
    const closedGrievance = await grievanceService.closeGrievance(sanitationComplaint.id, sanitationAdmin, {
      closureRemarks: 'Final inspection confirmed complete clearance and restoration.',
    });

    assert(closedGrievance.status === COMPLAINT_STATUS.CLOSED, 'TEST 24.4: Grievance status successfully transitioned to CLOSED');
    assert(Boolean(closedGrievance.closedAt), 'TEST 24.5: closedAt timestamp recorded');
    assert(closedGrievance.closedById === sanitationAdmin.uid, 'TEST 24.6: closedById recorded with Admin UID');
    assert(closedGrievance.closedByName.includes('Meera Sen'), 'TEST 24.7: closedByName recorded');
    assert(closedGrievance.closureRemarks.includes('Final inspection confirmed'), 'TEST 24.8: closureRemarks recorded');

    // 12.5 SLA Invariant: Resolution SLA remains halted
    const closedResolutionSla = slaEngine.evaluateResolutionSLA(closedGrievance);
    assert(closedResolutionSla.isStopped === true, 'TEST 24.9: Resolution SLA remains HALTED at CLOSED state');

    // 12.6 State Machine: Cannot close already CLOSED grievance
    try {
      await grievanceService.closeGrievance(sanitationComplaint.id, sanitationAdmin);
      assert(false, 'TEST 24.10: Should reject closing already CLOSED grievance');
    } catch (err) {
      assert(err.message.includes('already CLOSED'), 'TEST 24.10: Correctly prevented re-closure of CLOSED grievance');
    }

    // 12.7 Terminal state: Cannot submit resolution proof or verify CLOSED grievance
    try {
      await grievanceService.submitResolutionEvidence(sanitationComplaint.id, sanitationOfficer, {
        remarks: 'Post closure work',
        afterMediaUrls: ['https://mockstorage/extra.jpg'],
      });
      assert(false, 'TEST 24.11: Should reject resolution submission on CLOSED grievance');
    } catch (err) {
      assert(err.message.includes('Cannot submit resolution proof for grievance with status: CLOSED'), 'TEST 24.11: Prevented resolution submission on CLOSED grievance');
    }

    try {
      await grievanceService.verifyResolution(sanitationComplaint.id, sanitationAdmin, { approved: true });
      assert(false, 'TEST 24.12: Should reject verification on CLOSED grievance');
    } catch (err) {
      assert(err.message.includes('Cannot verify grievance with status: CLOSED'), 'TEST 24.12: Prevented verification on CLOSED grievance');
    }

    // 12.8 Citizen visibility: Citizen views CLOSED status
    const citizenClosedView = await grievanceService.getGrievanceById(sanitationComplaint.id, citizenUser);
    assert(citizenClosedView.status === COMPLAINT_STATUS.CLOSED, 'TEST 24.13: Citizen views final CLOSED status');
    assert(Boolean(citizenClosedView.closedAt), 'TEST 24.14: Citizen can view closedAt timestamp');

    // 12.9 Super Admin Cross-Department Closure
    const roadComplaint = await grievanceService.createGrievance(citizenUser, {
      title: 'Deep crater on main boulevard',
      description: 'Vehicle damage hazard.',
      categoryId: 'roads',
      ward: 'Ward 2 - Central',
      severity: SEVERITY_LEVELS.HIGH,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });
    await grievanceService.markGrievanceAsSeen(roadComplaint.id, roadsOfficer);
    await grievanceService.submitResolutionEvidence(roadComplaint.id, roadsOfficer, {
      remarks: 'Patching and sealing complete.',
      afterMediaUrls: ['https://mockstorage/road_after.jpg'],
    });
    await grievanceService.verifyResolution(roadComplaint.id, roadsAdmin, { approved: true });

    const superAdminClosed = await grievanceService.closeGrievance(roadComplaint.id, superAdmin, {
      closureRemarks: 'Super Admin executive sign-off and closure.',
    });
    assert(superAdminClosed.status === COMPLAINT_STATUS.CLOSED, 'TEST 24.15: Super Admin can close complaints across departments');
  } catch (err) {
    assert(false, 'Step 12: Final Closure Workflow', err.message);
  }

  // --- Summary ---
  console.log('\n================================================================');
  console.log(`MODULE 5 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runModule5Tests().catch((e) => {
  console.error('Fatal error during test run:', e);
  process.exit(1);
});
