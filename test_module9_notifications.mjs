/**
 * @file test_module9_notifications.mjs
 * @description Comprehensive Module 9 Test Suite for Notification Alert System,
 * Hourly Response Reminders, Post-SLA Warnings (Warning 1 & 2), Controlled Department Escalations,
 * RBAC Department Isolation, Audit Logging, and Idempotency.
 */

import { authService, INITIAL_PROVISIONED_ACCOUNTS } from './src/services/firebase/authService.js';
import { grievanceService } from './src/services/firebase/grievanceService.js';
import { notificationService } from './src/services/governance/notificationService.js';
import { auditLogService } from './src/services/firebase/auditLogService.js';
import { slaEngine } from './src/services/governance/slaEngine.js';
import {
  USER_ROLES,
  COMPLAINT_STATUS,
  COMPLAINT_VISIBILITY,
  SEVERITY_LEVELS,
  NOTIFICATION_TYPES,
  NOTIFICATION_SEVERITY,
  ESCALATION_LEVELS,
  AUDIT_ACTIONS,
} from './src/models/schema.js';

// Setup mock localStorage in Node.js test environment
const memoryStore = {};
global.localStorage = {
  getItem: (key) => memoryStore[key] || null,
  setItem: (key, val) => { memoryStore[key] = String(val); },
  removeItem: (key) => { delete memoryStore[key]; },
  clear: () => { for (const k in memoryStore) delete memoryStore[k]; },
};

async function runModule9Tests() {
  console.log('================================================================');
  console.log('STARTING MODULE 9 — NOTIFICATION & CONTROLLED ESCALATION TESTS');
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

  try {
    // --- Setup Test Users ---
    const citizen = await authService.register('citizen.notif@example.com', 'Pass@123456', 'Citizen Notif Tester');
    const roadsOfficer = await authService.login('officer.roads@civicpulse.org', 'Officer@123', 'officer');
    const sanitationOfficer = await authService.login('officer.sanitation@civicpulse.org', 'Officer@123', 'officer');
    const roadsAdmin = await authService.login('admin.roads@civicpulse.org', 'Admin@123', 'admin');
    const waterAdmin = await authService.login('admin.water@civicpulse.org', 'Admin@123', 'admin');
    const superAdmin = await authService.login('admin@civicpulse.org', 'Admin@123', 'admin');

    // --- Step 1: Initial Officer Assignment Notification ---
    console.log('--- Step 1: Initial Officer Assignment Notification ---');
    const grievance1 = await grievanceService.createGrievance(citizen, {
      title: 'Pothole cluster on Main Street',
      description: 'Dangerous road damage causing traffic congestion.',
      categoryId: 'roads',
      ward: 'Ward 1',
      severity: SEVERITY_LEVELS.MEDIUM,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });

    const roadsNotifs = await notificationService.getNotifications(roadsOfficer);
    const assignedNotif = roadsNotifs.find((n) => n.grievanceId === grievance1.id && n.type === NOTIFICATION_TYPES.ASSIGNED);

    assert(Boolean(assignedNotif), 'TEST 1: New assigned complaint creates officer notification');
    assert(assignedNotif.severity === NOTIFICATION_SEVERITY.NORMAL, 'TEST 1.1: Assigned notification has NORMAL (Green) severity');
    assert(assignedNotif.departmentId === 'roads', 'TEST 2: Correct officer (roads) receives assigned notification');

    // --- Step 2: Department Isolation ---
    console.log('\n--- Step 2: Department Isolation Security ---');
    const saniNotifs = await notificationService.getNotifications(sanitationOfficer);
    const saniHasRoadsNotif = saniNotifs.some((n) => n.grievanceId === grievance1.id);
    assert(!saniHasRoadsNotif, 'TEST 3: Wrong officer (sanitation) cannot access roads notification');
    assert(saniNotifs.every((n) => n.departmentId === 'garbage'), 'TEST 4: Sanitation officer notifications strictly isolated to garbage department');

    // --- Step 3: Hourly Reminder System ---
    console.log('\n--- Step 3: Hourly Reminder System & Idempotency ---');
    const intakeTime = new Date(grievance1.createdAt);
    const oneHourLater = new Date(intakeTime.getTime() + 1.5 * 3600 * 1000); // 1.5h later

    await notificationService.evaluateGrievanceNotifications(grievance1, oneHourLater);
    const roadsNotifsAfterReminder = await notificationService.getNotifications(roadsOfficer);
    const reminderNotif = roadsNotifsAfterReminder.find((n) => n.grievanceId === grievance1.id && n.type === NOTIFICATION_TYPES.REMINDER);

    assert(Boolean(reminderNotif), 'TEST 5: Hourly reminder logic generates reminder notification');

    // Idempotency check: Re-evaluating at same time should NOT create duplicate reminder
    await notificationService.evaluateGrievanceNotifications(grievance1, oneHourLater);
    const roadsNotifsReEval = await notificationService.getNotifications(roadsOfficer);
    const reminderCount = roadsNotifsReEval.filter((n) => n.grievanceId === grievance1.id && n.type === NOTIFICATION_TYPES.REMINDER).length;
    assert(reminderCount === 1, 'TEST 6: Duplicate reminders are prevented (Idempotency verified)');

    // --- Step 4: Officer Acknowledgment Halts Reminders & Escalation ---
    console.log('\n--- Step 4: Officer Acknowledgment Cancels Reminders/Escalations ---');
    const ackGrievance = await grievanceService.createGrievance(citizen, {
      title: 'Water pipe leak on 3rd Avenue',
      description: 'Minor leakage near curb.',
      categoryId: 'water',
      ward: 'Ward 2',
      severity: SEVERITY_LEVELS.LOW,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });
    const waterOfficer = await authService.login('officer.water@civicpulse.org', 'Officer@123', 'officer');

    // Officer acknowledges
    await grievanceService.markGrievanceAsSeen(ackGrievance.id, waterOfficer);

    // Advance time past SLA deadline
    const wayPastDeadline = new Date(Date.now() + 48 * 3600 * 1000);
    await notificationService.evaluateGrievanceNotifications(
      { ...ackGrievance, status: COMPLAINT_STATUS.SEEN, seenAt: new Date().toISOString() },
      wayPastDeadline
    );

    const waterNotifs = await notificationService.getNotifications(waterOfficer);
    const hasWarningsAfterAck = waterNotifs.some(
      (n) => n.grievanceId === ackGrievance.id && [NOTIFICATION_TYPES.WARNING_1, NOTIFICATION_TYPES.WARNING_2, NOTIFICATION_TYPES.ESCALATED].includes(n.type)
    );
    assert(!hasWarningsAfterAck, 'TEST 7: Officer acknowledgment stops reminders and prevents post-SLA warnings/escalations');

    // --- Step 5: Post-SLA Warnings (Warning 1 & Warning 2) & Controlled Escalation ---
    console.log('\n--- Step 5: Multi-Stage Warnings & Controlled Escalation ---');
    const escGrievance = await grievanceService.createGrievance(citizen, {
      title: 'High voltage wire hanging low',
      description: 'Dangerously low street wiring.',
      categoryId: 'streetlights',
      ward: 'Ward 3',
      severity: SEVERITY_LEVELS.HIGH,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });
    const elecOfficer = await authService.login('officer.electricity@civicpulse.org', 'Officer@123', 'officer');
    const elecAdmin = await authService.login('admin.electricity@civicpulse.org', 'Admin@123', 'admin');

    // Advance time past Response SLA deadline (4h default for streetlights)
    const postBreachTime = new Date(Date.now() + 5 * 3600 * 1000);

    // 1st Evaluation -> Generates Warning 1 (CRITICAL)
    await notificationService.evaluateGrievanceNotifications(escGrievance, postBreachTime);
    const elecNotifs1 = await notificationService.getNotifications(elecOfficer);
    const warn1 = elecNotifs1.find((n) => n.grievanceId === escGrievance.id && n.type === NOTIFICATION_TYPES.WARNING_1);

    assert(Boolean(warn1), 'TEST 8: Response SLA breach generates Warning 1');
    assert(warn1.severity === NOTIFICATION_SEVERITY.CRITICAL, 'TEST 8.1: Warning 1 has CRITICAL (Red) severity');
    assert(warn1.escalationStage === 1, 'TEST 8.2: Warning 1 has escalationStage = 1');

    // Check that Warning 1 does NOT immediately escalate grievance to admin
    const gAfterWarn1 = await grievanceService.getGrievanceById(escGrievance.id);
    assert(gAfterWarn1.escalationLevel !== ESCALATION_LEVELS.DEPARTMENT_ESCALATED, 'TEST 9: Warning 1 does NOT immediately escalate to Department Admin');

    // 2nd Evaluation -> Generates Warning 2 (CRITICAL)
    await notificationService.evaluateGrievanceNotifications(escGrievance, postBreachTime);
    const elecNotifs2 = await notificationService.getNotifications(elecOfficer);
    const warn2 = elecNotifs2.find((n) => n.grievanceId === escGrievance.id && n.type === NOTIFICATION_TYPES.WARNING_2);

    assert(Boolean(warn2), 'TEST 10: Second evaluation generates Warning 2');
    assert(warn2.severity === NOTIFICATION_SEVERITY.CRITICAL, 'TEST 10.1: Warning 2 has CRITICAL (Red) severity');
    assert(warn2.escalationStage === 2, 'TEST 10.2: Warning 2 has escalationStage = 2');

    // 3rd Evaluation -> Triggers Controlled Escalation to Department Admin (ESCALATED)
    await notificationService.evaluateGrievanceNotifications(escGrievance, postBreachTime);
    const gAfterEsc = await grievanceService.getGrievanceById(escGrievance.id);

    assert(gAfterEsc.escalationLevel === ESCALATION_LEVELS.DEPARTMENT_ESCALATED, 'TEST 11: Escalation occurs ONLY after Warning 1 + Warning 2');

    const adminNotifs = await notificationService.getNotifications(elecAdmin);
    const escNotif = adminNotifs.find((n) => n.grievanceId === escGrievance.id && n.type === NOTIFICATION_TYPES.ESCALATED);

    assert(Boolean(escNotif), 'TEST 12: Correct Department Admin (electricity) receives escalation notification');
    assert(escNotif.severity === NOTIFICATION_SEVERITY.ESCALATED, 'TEST 12.1: Escalation notification has ESCALATED (Purple) severity');

    // --- Step 6: Cross-Department Escalation Security & Super Admin ---
    console.log('\n--- Step 6: Cross-Department Security & Super Admin Visibility ---');
    const waterAdminNotifs = await notificationService.getNotifications(waterAdmin);
    const waterHasElecEsc = waterAdminNotifs.some((n) => n.grievanceId === escGrievance.id);
    assert(!waterHasElecEsc, 'TEST 13: Cross-department escalation access is blocked for Water Admin');

    const superAdminNotifs = await notificationService.getNotifications(superAdmin);
    const superHasElecEsc = superAdminNotifs.some((n) => n.grievanceId === escGrievance.id);
    assert(superHasElecEsc, 'TEST 14: Super Admin can view escalations globally across all departments');

    // --- Step 7: Notification Read / Unread State Management ---
    console.log('\n--- Step 7: Notification Read / Unread State ---');
    assert(warn1.isRead === false, 'TEST 15.1: New notification starts with isRead = false');

    await notificationService.markAsRead(warn1.notificationId, elecOfficer);
    const elecNotifsUpdated = await notificationService.getNotifications(elecOfficer);
    const readWarn1 = elecNotifsUpdated.find((n) => n.notificationId === warn1.notificationId);

    assert(readWarn1.isRead === true, 'TEST 15.2: markAsRead sets isRead = true');
    assert(Boolean(readWarn1.readAt), 'TEST 15.3: markAsRead sets readAt timestamp');

    const countMarked = await notificationService.markAllAsRead(elecOfficer);
    assert(countMarked >= 0, 'TEST 15.4: markAllAsRead executes successfully');

    // --- Step 8: Immutable Audit Logs Integration ---
    console.log('\n--- Step 8: Immutable Audit Logs Integration ---');
    const auditLogs = await auditLogService.getAuditLogs(superAdmin);

    const warn1Audit = auditLogs.find((l) => l.action === AUDIT_ACTIONS.WARNING_1_GENERATED && l.grievanceId === escGrievance.id);
    const warn2Audit = auditLogs.find((l) => l.action === AUDIT_ACTIONS.WARNING_2_GENERATED && l.grievanceId === escGrievance.id);
    const escAudit = auditLogs.find((l) => l.action === AUDIT_ACTIONS.COMPLAINT_ESCALATED && l.grievanceId === escGrievance.id);

    assert(Boolean(warn1Audit), 'TEST 16.1: Audit log entry created for WARNING_1_GENERATED');
    assert(Boolean(warn2Audit), 'TEST 16.2: Audit log entry created for WARNING_2_GENERATED');
    assert(Boolean(escAudit), 'TEST 16.3: Audit log entry created for COMPLAINT_ESCALATED');

    // --- Summary ---
    console.log('\n================================================================');
    console.log(`MODULE 9 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during Module 9 test execution:', err);
    process.exit(1);
  }
}

runModule9Tests();
