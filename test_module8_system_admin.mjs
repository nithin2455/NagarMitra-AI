/**
 * @file test_module8_system_admin.mjs
 * @description Automated Unit & Integration Tests for Module 8: System Administration & Data Governance
 */

import { authService, INITIAL_PROVISIONED_ACCOUNTS } from './src/services/firebase/authService.js';
import { grievanceService } from './src/services/firebase/grievanceService.js';
import { systemAdminService } from './src/services/firebase/systemAdminService.js';
import { auditLogService } from './src/services/firebase/auditLogService.js';
import {
  USER_ROLES,
  COMPLAINT_STATUS,
  COMPLAINT_VISIBILITY,
  SEVERITY_LEVELS,
  CATEGORIES,
} from './src/models/schema.js';

// Setup mock localStorage
const memoryStore = {};
global.localStorage = {
  getItem: (key) => memoryStore[key] || null,
  setItem: (key, val) => { memoryStore[key] = String(val); },
  removeItem: (key) => { delete memoryStore[key]; },
  clear: () => { for (const k in memoryStore) delete memoryStore[k]; },
};

async function runModule8Tests() {
  console.log('================================================================');
  console.log('STARTING MODULE 8: SYSTEM ADMINISTRATION & DATA GOVERNANCE TESTS');
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

  // --- Step 0: Accounts Authentication ---
  console.log('--- Step 0: Accounts Setup ---');
  const citizen = await authService.register('sysadmin.citizen@example.com', 'Pass@123456', 'Citizen Tester');

  const roadsOfficerCreds = INITIAL_PROVISIONED_ACCOUNTS['officer.roads@civicpulse.org'];
  const roadsAdminCreds = INITIAL_PROVISIONED_ACCOUNTS['admin.roads@civicpulse.org'];
  const sanitationAdminCreds = INITIAL_PROVISIONED_ACCOUNTS['admin.sanitation@civicpulse.org'];
  const superAdminCreds = INITIAL_PROVISIONED_ACCOUNTS['admin@civicpulse.org'];

  const roadsOfficer = await authService.login(roadsOfficerCreds.email, roadsOfficerCreds.password, 'officer');
  const roadsAdmin = await authService.login(roadsAdminCreds.email, roadsAdminCreds.password, 'admin');
  const sanitationAdmin = await authService.login(sanitationAdminCreds.email, sanitationAdminCreds.password, 'admin');
  const superAdmin = await authService.login(superAdminCreds.email, superAdminCreds.password, 'admin');

  // --- Step 1: Department Management Access & Scoping ---
  console.log('\n--- Step 1: Department Management Access & Scoping ---');
  try {
    // 1. Super Admin access
    const saDepts = await systemAdminService.getDepartments(superAdmin);
    assert(Array.isArray(saDepts), 'TEST 1: Super Admin can access Departments');
    assert(saDepts.length === 7, 'TEST 6: Super Admin can view all 7 municipal departments');

    // 2. Department Admin access
    const raDepts = await systemAdminService.getDepartments(roadsAdmin);
    assert(Array.isArray(raDepts), 'TEST 2: Department Admin can access Departments');
    assert(
      raDepts.length === 1 && raDepts[0].id === 'roads',
      'TEST 7: Department Admin sees ONLY their assigned department (roads)'
    );

    // 3. Officer blocked
    try {
      await systemAdminService.getDepartments(roadsOfficer);
      assert(false, 'TEST 3: Officer should not access Departments');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 3: Officer is blocked from Departments');
    }

    // 4. Citizen blocked
    try {
      await systemAdminService.getDepartments(citizen);
      assert(false, 'TEST 4: Citizen should not access Departments');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 4: Citizen is blocked from Departments');
    }

    // 5. Unauthenticated blocked
    try {
      await systemAdminService.getDepartments(null);
      assert(false, 'TEST 5: Unauthenticated user should not access Departments');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 5: Unauthenticated user is blocked');
    }
  } catch (err) {
    assert(false, 'Step 1: Department Management', err.message);
  }

  // --- Step 2: User Directory & Role Management ---
  console.log('\n--- Step 2: User / Role Management & Privacy Protections ---');
  try {
    // 8. Super Admin can access User Management
    const saUsers = await systemAdminService.getUsers(superAdmin);
    assert(Array.isArray(saUsers) && saUsers.length > 0, 'TEST 8: Super Admin can access User Management');
    assert(saUsers.length >= 10, 'TEST 13: Super Admin can view users from all departments & roles');

    // Check Password Protection: Password must NEVER be exposed
    const hasPassword = saUsers.some((u) => u.password !== undefined);
    assert(!hasPassword, 'TEST 22: User passwords are strictly sanitized and never exposed in records');

    // 9. Department Admin can access User Management
    const raUsers = await systemAdminService.getUsers(roadsAdmin);
    assert(Array.isArray(raUsers), 'TEST 9: Department Admin can access User Management');

    // 12. Department Admin cannot view users from another department
    const seenNonRoads = raUsers.some((u) => u.departmentId && u.departmentId !== 'roads');
    assert(!seenNonRoads, 'TEST 12: Roads Admin cannot view users from other departments (sanitation, water, etc.)');

    // Explicit cross-department query blocked
    try {
      await systemAdminService.getUsers(roadsAdmin, { departmentId: 'garbage' });
      assert(false, 'TEST 12.1: Roads Admin should not query Sanitation users');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 12.1: Blocked cross-department user query attempt');
    }

    // 10. Officer blocked
    try {
      await systemAdminService.getUsers(roadsOfficer);
      assert(false, 'TEST 10: Officer should not access User Management');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 10: Officer is blocked from User Management');
    }

    // 11. Citizen blocked
    try {
      await systemAdminService.getUsers(citizen);
      assert(false, 'TEST 11: Citizen should not access User Management');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 11: Citizen is blocked from User Management');
    }
  } catch (err) {
    assert(false, 'Step 2: User Management', err.message);
  }

  // --- Step 3: System Configuration Governance ---
  console.log('\n--- Step 3: Platform System Configuration & Governance Parameters ---');
  try {
    // 14. Super Admin can access System Configuration
    const config = await systemAdminService.getSystemConfiguration(superAdmin);
    assert(Boolean(config?.municipalDepartments), 'TEST 14.1: System Configuration contains municipal departments');
    assert(Boolean(config?.slaWarningThresholds), 'TEST 14.2: System Configuration contains SLA warning thresholds');
    assert(Boolean(config?.governanceLimits), 'TEST 14.3: System Configuration contains governance limits');

    // 15. Department Admin blocked from System Configuration
    try {
      await systemAdminService.getSystemConfiguration(roadsAdmin);
      assert(false, 'TEST 15: Department Admin should not access System Configuration');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 15: Department Admin is blocked from System Configuration');
    }

    // 16. Officer blocked
    try {
      await systemAdminService.getSystemConfiguration(roadsOfficer);
      assert(false, 'TEST 16: Officer should not access System Configuration');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 16: Officer is blocked from System Configuration');
    }

    // 17. Citizen blocked
    try {
      await systemAdminService.getSystemConfiguration(citizen);
      assert(false, 'TEST 17: Citizen should not access System Configuration');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 17: Citizen is blocked from System Configuration');
    }
  } catch (err) {
    assert(false, 'Step 3: System Configuration', err.message);
  }

  // --- Step 4: Data Governance & Schema Validators ---
  console.log('\n--- Step 4: Data Governance & Integrity Validators ---');
  try {
    // 18. Invalid department ID is rejected
    try {
      systemAdminService.validateDepartment('invalid_nonexistent_dept');
      assert(false, 'TEST 18: Invalid department ID should be rejected');
    } catch (err) {
      assert(err.message.includes('Invalid department ID'), 'TEST 18: Invalid department ID is rejected');
    }

    // Valid department passes
    assert(systemAdminService.validateDepartment('roads') === true, 'TEST 18.1: Valid department ID passes validation');

    // 19. Invalid role/department combination is detected
    try {
      systemAdminService.validateUserRoleConsistency({
        role: USER_ROLES.OFFICER,
        departmentId: null, // Officer without department is invalid!
      });
      assert(false, 'TEST 19: Officer without department must be rejected');
    } catch (err) {
      assert(err.message.includes('Department Officers must be assigned'), 'TEST 19: Invalid role/department combination detected');
    }

    try {
      systemAdminService.validateUserRoleConsistency({
        role: USER_ROLES.CITIZEN,
        departmentId: 'roads', // Citizen tied to department is invalid!
      });
      assert(false, 'TEST 19.1: Citizen with department must be rejected');
    } catch (err) {
      assert(err.message.includes('must not be tied to a specific departmentId'), 'TEST 19.1: Citizen department rule enforced');
    }

    // 20. Invalid grievance status is rejected
    try {
      systemAdminService.validateGrievanceData({
        departmentId: 'roads',
        status: 'CORRUPTED_NON_EXISTENT_STATUS',
      });
      assert(false, 'TEST 20: Invalid status should be rejected');
    } catch (err) {
      assert(err.message.includes('Invalid grievance status'), 'TEST 20: Invalid grievance status is rejected');
    }

    // 21. Invalid priority is rejected
    try {
      systemAdminService.validateGrievanceData({
        departmentId: 'roads',
        status: COMPLAINT_STATUS.SUBMITTED,
        severity: 'ULTRA_EXTREME_INVALID',
      });
      assert(false, 'TEST 21: Invalid priority should be rejected');
    } catch (err) {
      assert(err.message.includes('Invalid priority/severity'), 'TEST 21: Invalid priority is rejected');
    }
  } catch (err) {
    assert(false, 'Step 4: Data Governance', err.message);
  }

  // --- Step 5: Regression Check on Module 7 Audit Logs ---
  console.log('\n--- Step 5: Module 7 Audit Log Verification ---');
  try {
    const recentAuditLogs = await auditLogService.getAuditLogs(superAdmin);
    assert(recentAuditLogs.length > 0, 'TEST 23: Existing Module 7 audit functionality remains active & working');
  } catch (err) {
    assert(false, 'Step 5: Audit log regression check', err.message);
  }

  // --- Summary ---
  console.log('\n================================================================');
  console.log(`MODULE 8 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runModule8Tests().catch((e) => {
  console.error('Fatal error during Module 8 test run:', e);
  process.exit(1);
});
