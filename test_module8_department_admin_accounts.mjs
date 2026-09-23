/**
 * @file test_module8_department_admin_accounts.mjs
 * @description Targeted Test Suite for Complete 7-Department Admin Accounts Provisioning,
 * Officer-to-Admin Mapping, Department Isolation, Verification, SLA Review, Analytics, and Audit Logging.
 */

import { authService, INITIAL_PROVISIONED_ACCOUNTS } from './src/services/firebase/authService.js';
import { grievanceService } from './src/services/firebase/grievanceService.js';
import { systemAdminService } from './src/services/firebase/systemAdminService.js';
import { auditLogService } from './src/services/firebase/auditLogService.js';
import { analyticsService } from './src/services/analytics/analyticsService.js';
import {
  USER_ROLES,
  COMPLAINT_STATUS,
  COMPLAINT_VISIBILITY,
  SEVERITY_LEVELS,
  CATEGORIES,
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

async function runDepartmentAdminTests() {
  console.log('================================================================');
  console.log('STARTING COMPLETE 7-DEPARTMENT ADMIN ACCOUNTS VERIFICATION TEST');
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

  // --- Step 1: Verify All 7 Department Admins & 7 Officers Exist in Initial Provisions ---
  console.log('--- Step 1: Verify Complete 7-Department Provisioning Matrix ---');
  const expectedDepartmentAdmins = [
    { email: 'admin.roads@civicpulse.org', deptId: 'roads', title: 'Roads Dept Admin' },
    { email: 'admin.sanitation@civicpulse.org', deptId: 'garbage', title: 'Sanitation Dept Admin' },
    { email: 'admin.water@civicpulse.org', deptId: 'water', title: 'Water Dept Admin' },
    { email: 'admin.drainage@civicpulse.org', deptId: 'drainage', title: 'Drainage Dept Admin' },
    { email: 'admin.electricity@civicpulse.org', deptId: 'streetlights', title: 'Electricity Dept Admin' },
    { email: 'admin.works@civicpulse.org', deptId: 'infrastructure', title: 'Public Works Dept Admin' },
    { email: 'admin.general@civicpulse.org', deptId: 'other', title: 'General Operations Admin' },
  ];

  for (const item of expectedDepartmentAdmins) {
    const acc = INITIAL_PROVISIONED_ACCOUNTS[item.email];
    assert(Boolean(acc), `Provision check: ${item.email} exists in INITIAL_PROVISIONED_ACCOUNTS`);
    assert(acc.role === USER_ROLES.DEPARTMENT_ADMIN, `${item.email} has role DEPARTMENT_ADMIN`);
    assert(acc.departmentId === item.deptId, `${item.email} assigned to departmentId: ${item.deptId}`);
    assert(acc.password === 'Admin@123', `${item.email} password configured as Admin@123`);
  }

  // --- Step 2: Test Login For All 4 Newly Added Department Admins ---
  console.log('\n--- Step 2: Authentication & Portal Access For 4 New Department Admins ---');
  
  // 1. Drainage Admin
  const drainageAdmin = await authService.login('admin.drainage@civicpulse.org', 'Admin@123', 'admin');
  assert(drainageAdmin.role === USER_ROLES.DEPARTMENT_ADMIN, 'TEST 1: Drainage Admin logged in with role DEPARTMENT_ADMIN');
  assert(drainageAdmin.departmentId === 'drainage', 'TEST 1.1: Drainage Admin departmentId is "drainage"');

  // 2. Electricity Admin
  const electricityAdmin = await authService.login('admin.electricity@civicpulse.org', 'Admin@123', 'admin');
  assert(electricityAdmin.role === USER_ROLES.DEPARTMENT_ADMIN, 'TEST 2: Electricity Admin logged in with role DEPARTMENT_ADMIN');
  assert(electricityAdmin.departmentId === 'streetlights', 'TEST 2.1: Electricity Admin departmentId is "streetlights"');

  // 3. Public Works Admin
  const worksAdmin = await authService.login('admin.works@civicpulse.org', 'Admin@123', 'admin');
  assert(worksAdmin.role === USER_ROLES.DEPARTMENT_ADMIN, 'TEST 3: Public Works Admin logged in with role DEPARTMENT_ADMIN');
  assert(worksAdmin.departmentId === 'infrastructure', 'TEST 3.1: Public Works Admin departmentId is "infrastructure"');

  // 4. General Operations Admin
  const generalAdmin = await authService.login('admin.general@civicpulse.org', 'Admin@123', 'admin');
  assert(generalAdmin.role === USER_ROLES.DEPARTMENT_ADMIN, 'TEST 4: General Operations Admin logged in with role DEPARTMENT_ADMIN');
  assert(generalAdmin.departmentId === 'other', 'TEST 4.1: General Admin departmentId is "other"');

  // Existing admins & super admin
  const roadsAdmin = await authService.login('admin.roads@civicpulse.org', 'Admin@123', 'admin');
  const superAdmin = await authService.login('admin@civicpulse.org', 'Admin@123', 'admin');
  const citizen = await authService.register('citizen.depttest@example.com', 'Pass@123456', 'Citizen Dept Tester');

  // --- Step 3: Test Department Officers Logins ---
  console.log('\n--- Step 3: Authentication For Officers Across All 4 New Departments ---');
  const drainageOfficer = await authService.login('officer.drainage@civicpulse.org', 'Officer@123', 'officer');
  const electricityOfficer = await authService.login('officer.electricity@civicpulse.org', 'Officer@123', 'officer');
  const worksOfficer = await authService.login('officer.works@civicpulse.org', 'Officer@123', 'officer');
  const generalOfficer = await authService.login('officer.general@civicpulse.org', 'Officer@123', 'officer');

  assert(drainageOfficer.departmentId === 'drainage', 'TEST 9.1: Drainage Officer has departmentId "drainage"');
  assert(electricityOfficer.departmentId === 'streetlights', 'TEST 10.1: Electricity Officer has departmentId "streetlights"');
  assert(worksOfficer.departmentId === 'infrastructure', 'TEST 11.1: Works Officer has departmentId "infrastructure"');
  assert(generalOfficer.departmentId === 'other', 'TEST 12.1: General Officer has departmentId "other"');

  // --- Step 4: Department Scope & Data Isolation Tests ---
  console.log('\n--- Step 4: Department Isolation On Department Management & Users ---');
  
  // 5. Drainage Admin sees only drainage department
  const drainageDepts = await systemAdminService.getDepartments(drainageAdmin);
  assert(drainageDepts.length === 1 && drainageDepts[0].id === 'drainage', 'TEST 5: Drainage Admin sees ONLY drainage department');

  // 6. Electricity Admin sees only streetlights department
  const elecDepts = await systemAdminService.getDepartments(electricityAdmin);
  assert(elecDepts.length === 1 && elecDepts[0].id === 'streetlights', 'TEST 6: Electricity Admin sees ONLY streetlights department');

  // 7. Public Works Admin sees only infrastructure department
  const worksDepts = await systemAdminService.getDepartments(worksAdmin);
  assert(worksDepts.length === 1 && worksDepts[0].id === 'infrastructure', 'TEST 7: Public Works Admin sees ONLY infrastructure department');

  // 8. General Admin sees only other department
  const genDepts = await systemAdminService.getDepartments(generalAdmin);
  assert(genDepts.length === 1 && genDepts[0].id === 'other', 'TEST 8: General Admin sees ONLY other department');

  // 16. Super Admin sees all 7 departments
  const saDepts = await systemAdminService.getDepartments(superAdmin);
  assert(saDepts.length === 7, 'TEST 16: Super Admin sees all 7 municipal departments');

  // Verify each department now has 1 officer and 1 admin
  const allDeptIds = ['roads', 'garbage', 'water', 'drainage', 'streetlights', 'infrastructure', 'other'];
  for (const dId of allDeptIds) {
    const deptInfo = saDepts.find((d) => d.id === dId);
    assert(deptInfo.officerCount === 1, `Department "${dId}" has 1 assigned officer`);
    assert(deptInfo.adminCount === 1, `Department "${dId}" has 1 assigned Department Admin`);
  }

  // --- Step 5: User Management Isolation ---
  console.log('\n--- Step 5: User Directory Department Isolation ---');
  const drainageUsers = await systemAdminService.getUsers(drainageAdmin);
  assert(
    drainageUsers.every((u) => u.departmentId === 'drainage'),
    'TEST 5.1: Drainage Admin user directory only contains users of drainage department'
  );

  const elecUsers = await systemAdminService.getUsers(electricityAdmin);
  assert(
    elecUsers.every((u) => u.departmentId === 'streetlights'),
    'TEST 6.1: Electricity Admin user directory only contains users of streetlights department'
  );

  const saUsers = await systemAdminService.getUsers(superAdmin);
  assert(saUsers.length >= 15, 'TEST 16.1: Super Admin can query all users across all 7 departments');

  // Cross-department user query rejection
  try {
    await systemAdminService.getUsers(drainageAdmin, { departmentId: 'water' });
    assert(false, 'TEST 13: Drainage Admin should not query Water department users');
  } catch (err) {
    assert(err.message.includes('Access Denied'), 'TEST 13: Blocked cross-department user query attempt');
  }

  // --- Step 6: Grievance Lifecycle, Resolution & Verification Across New Departments ---
  console.log('\n--- Step 6: Complete End-to-End Workflow For Drainage Grievance ---');
  
  // 17. Citizen reports drainage grievance
  const gDrainage = await grievanceService.createGrievance(citizen, {
    title: 'Severe storm drain blockage on Ring Road',
    description: 'Sewage backup flooding pedestrian pathway.',
    categoryId: 'drainage',
    ward: 'Ward 5 - West',
    severity: SEVERITY_LEVELS.HIGH,
    visibility: COMPLAINT_VISIBILITY.PUBLIC,
  });
  assert(gDrainage.departmentId === 'drainage', 'Grievance correctly classified to "drainage"');

  // Drainage Officer marks as seen
  await grievanceService.markGrievanceAsSeen(gDrainage.id, drainageOfficer);

  // 17. Drainage Officer submits resolution evidence
  await grievanceService.submitResolutionEvidence(gDrainage.id, drainageOfficer, {
    remarks: 'Drain jetting complete and silt removed.',
    afterMediaUrls: ['https://mockstorage/drain_cleared.jpg'],
  });

  // 18. Drainage Admin retrieves verification queue -> must see this grievance
  const drainageQueue = await grievanceService.getVerificationQueue(drainageAdmin);
  const foundInQueue = drainageQueue.some((g) => g.id === gDrainage.id);
  assert(foundInQueue, 'TEST 18: Drainage Admin verification queue receives submitted drainage evidence');

  // 20. Roads Admin attempts to verify Drainage grievance -> REJECTED
  try {
    await grievanceService.verifyResolution(gDrainage.id, roadsAdmin, { approved: true });
    assert(false, 'TEST 20: Roads Admin should NOT verify Drainage resolution evidence');
  } catch (err) {
    assert(err.message.includes('Access Denied'), 'TEST 20: Correctly blocked cross-department resolution verification');
  }

  // 19. Drainage Admin verifies and approves Drainage grievance -> SUCCESS
  const verifyResult = await grievanceService.verifyResolution(gDrainage.id, drainageAdmin, { approved: true });
  assert(verifyResult.status === COMPLAINT_STATUS.VERIFIED_RESOLVED, 'TEST 19: Drainage Admin verified and approved evidence');

  // Drainage Admin closes Drainage grievance -> CLOSED
  const closedGrievance = await grievanceService.closeGrievance(gDrainage.id, drainageAdmin, {
    closureRemarks: 'Verified on-site by Drainage Superintendent.',
  });
  assert(closedGrievance.status === COMPLAINT_STATUS.CLOSED, 'TEST 19.1: Drainage Admin officially closed grievance');

  // --- Step 7: SLA Extension Request & Verification on Electricity Department ---
  console.log('\n--- Step 7: SLA Extension Routing & Isolation (Electricity Dept) ---');
  
  const gElec = await grievanceService.createGrievance(citizen, {
    title: 'Faulty streetlight pole wiring sparked',
    description: 'Exposed high voltage wiring near bus shelter.',
    categoryId: 'streetlights',
    ward: 'Ward 3 - East',
    severity: SEVERITY_LEVELS.CRITICAL,
    visibility: COMPLAINT_VISIBILITY.PUBLIC,
  });

  await grievanceService.markGrievanceAsSeen(gElec.id, electricityOfficer);

  // Electricity Officer requests SLA extension
  const extReq = await grievanceService.requestSLAExtension(gElec.id, electricityOfficer, {
    requestedHours: 12,
    reason: 'Replacement junction box arriving from central warehouse.',
  });

  // 22. Wrong Department Admin (Sanitation Admin) tries to approve Electricity SLA -> REJECTED
  const sanitationAdmin = await authService.login('admin.sanitation@civicpulse.org', 'Admin@123', 'admin');
  try {
    await grievanceService.reviewSLAExtension(extReq.id, sanitationAdmin, {
      decision: 'APPROVED',
      adminRemarks: 'Invalid cross-department review',
    });
    assert(false, 'TEST 22: Sanitation Admin should NOT review Electricity SLA request');
  } catch (err) {
    assert(err.message.includes('Access Denied'), 'TEST 22: Correctly blocked Sanitation Admin from Electricity SLA request');
  }

  // 21. Electricity Admin approves Electricity SLA request -> SUCCESS
  const approvedExt = await grievanceService.reviewSLAExtension(extReq.id, electricityAdmin, {
    decision: 'APPROVED',
    adminRemarks: 'Parts dispatch authorized.',
  });
  assert(approvedExt.status === 'APPROVED', 'TEST 21: Electricity Admin approved electricity SLA extension');

  // --- Step 8: Analytics & Audit Logs Integration ---
  console.log('\n--- Step 8: Analytics & Audit Log Verification ---');
  
  // Analytics for Drainage Admin
  const drainageAnalytics = await analyticsService.getAnalytics(drainageAdmin);
  assert(drainageAnalytics.userScope.departmentId === 'drainage', 'TEST 8.1: Drainage Analytics is strictly department-scoped (drainage)');
  assert(drainageAnalytics.kpiSummary.totalComplaints >= 1, 'TEST 8.2: Drainage Analytics computed KPI metrics');

  // 23. LOGIN Audit generated
  const auditLogs = await auditLogService.getAuditLogs(superAdmin);
  const drainageAdminLogin = auditLogs.find(
    (l) => l.action === AUDIT_ACTIONS.LOGIN && l.actorUid === drainageAdmin.uid
  );
  assert(Boolean(drainageAdminLogin), 'TEST 23: Drainage Admin login generated immutable LOGIN audit log');

  // 24. Verification audit generated
  const drainageVerifyAudit = auditLogs.find(
    (l) => l.action === AUDIT_ACTIONS.RESOLUTION_VERIFIED && l.actorUid === drainageAdmin.uid
  );
  assert(Boolean(drainageVerifyAudit), 'TEST 24: Drainage Admin verification generated RESOLUTION_VERIFIED audit log');

  // 25. Closure audit generated
  const drainageCloseAudit = auditLogs.find(
    (l) => l.action === AUDIT_ACTIONS.GRIEVANCE_CLOSED && l.actorUid === drainageAdmin.uid
  );
  assert(Boolean(drainageCloseAudit), 'TEST 25: Drainage Admin closure generated GRIEVANCE_CLOSED audit log');

  // --- Summary ---
  console.log('\n================================================================');
  console.log(`COMPLETE 7-DEPARTMENT ADMIN SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDepartmentAdminTests().catch((e) => {
  console.error('Fatal error during test run:', e);
  process.exit(1);
});
