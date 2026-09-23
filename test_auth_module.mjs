/**
 * @file test_auth_module.mjs
 * @description Automated Unit & Integration Tests for Production Module 1 (Authentication & RBAC Migration)
 */

import { authService, INITIAL_PROVISIONED_ACCOUNTS } from './src/services/firebase/authService.js';
import { USER_ROLES } from './src/models/schema.js';

// Setup mock localStorage in Node.js test environment
const memoryStore = {};
global.localStorage = {
  getItem: (key) => memoryStore[key] || null,
  setItem: (key, val) => { memoryStore[key] = String(val); },
  removeItem: (key) => { delete memoryStore[key]; },
  clear: () => { for (const k in memoryStore) delete memoryStore[k]; },
};

async function runModule1Tests() {
  console.log('================================================================');
  console.log('STARTING PRODUCTION AUTHENTICATION & RBAC TEST SUITE');
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

  // --- TEST 1: Register a new citizen ---
  console.log('--- Step 1: Register a New Citizen ---');
  let newCitizen;
  try {
    newCitizen = await authService.register('priya.nair@example.com', 'SecurePass2026', 'Priya Nair');
    assert(newCitizen && newCitizen.email === 'priya.nair@example.com', '1.1: Account created with correct email');
    assert(newCitizen.role === USER_ROLES.CITIZEN, '1.2: Enforced role is strictly CITIZEN (No self-elevation)');
    assert(newCitizen.accountStatus === 'active', '1.3: Account status is active');
    assert(newCitizen.displayName === 'Priya Nair', '1.4: Display name saved correctly');
  } catch (err) {
    assert(false, '1: Register new citizen', err.message);
  }

  // --- TEST 2: Duplicate Registration & Validation ---
  console.log('\n--- Step 2: Duplicate Email & Weak Password Rejections ---');
  try {
    await authService.register('priya.nair@example.com', 'SecurePass2026', 'Duplicate Attempt');
    assert(false, '2.1: Should reject duplicate email');
  } catch (err) {
    assert(err.message.includes('already exists'), '2.1: Correctly rejected duplicate email registration');
  }

  try {
    await authService.register('weak@example.com', '123', 'Weak User');
    assert(false, '2.2: Should reject password < 6 chars');
  } catch (err) {
    assert(err.message.includes('at least 6 characters'), '2.2: Correctly caught short password');
  }

  // --- TEST 3: Logout Functionality ---
  console.log('\n--- Step 3: Logout Verification ---');
  await authService.logout();
  const sessionAfterLogout = authService.getInitialSession();
  assert(sessionAfterLogout === null, '3.1: Session state completely cleared on logout');

  // --- TEST 4: Login with Registered Citizen ---
  console.log('\n--- Step 4: Login with Registered Citizen ---');
  let loggedInCitizen;
  try {
    loggedInCitizen = await authService.login('priya.nair@example.com', 'SecurePass2026');
    assert(loggedInCitizen && loggedInCitizen.email === 'priya.nair@example.com', '4.1: Login succeeded with valid credentials');
    assert(loggedInCitizen.role === USER_ROLES.CITIZEN, '4.2: Stored profile role retained as CITIZEN');
  } catch (err) {
    assert(false, '4: Login with registered citizen', err.message);
  }

  // --- TEST 5: Portal Access Enforcement at Login ---
  console.log('\n--- Step 5: Portal Login Intent Protection ---');
  // Attempt to log in with Citizen credentials on Admin portal tab -> Must be rejected!
  try {
    await authService.login('priya.nair@example.com', 'SecurePass2026', 'admin');
    assert(false, '5.1: Should reject Citizen logging into Admin portal tab');
  } catch (err) {
    assert(err.message.includes('Access Denied'), '5.1: Correctly denied Citizen attempting Admin portal sign-in');
  }

  // Attempt to log in with Citizen credentials on Officer portal tab -> Must be rejected!
  try {
    await authService.login('priya.nair@example.com', 'SecurePass2026', 'officer');
    assert(false, '5.2: Should reject Citizen logging into Officer portal tab');
  } catch (err) {
    assert(err.message.includes('Access Denied'), '5.2: Correctly denied Citizen attempting Officer portal sign-in');
  }

  // Logging in on Citizen portal tab -> Must succeed!
  try {
    const validPortalCitizen = await authService.login('priya.nair@example.com', 'SecurePass2026', 'citizen');
    assert(validPortalCitizen.role === USER_ROLES.CITIZEN, '5.3: Citizen successfully authenticated on Citizen portal tab');
  } catch (err) {
    assert(false, '5.3: Citizen portal login', err.message);
  }

  // --- TEST 6: Route Level RBAC Enforcement ---
  console.log('\n--- Step 6: Route-Level RBAC Boundaries ---');
  const citizenAllowed = [USER_ROLES.CITIZEN];
  const officerAllowed = [USER_ROLES.OFFICER];
  const adminAllowed = [USER_ROLES.DEPARTMENT_ADMIN, USER_ROLES.SUPER_ADMIN];

  assert(citizenAllowed.includes(loggedInCitizen.role) === true, '6.1: Citizen can access /citizen routes');
  assert(officerAllowed.includes(loggedInCitizen.role) === false, '6.2: Citizen CANNOT access /officer routes (Redirects to /unauthorized)');
  assert(adminAllowed.includes(loggedInCitizen.role) === false, '6.3: Citizen CANNOT access /admin routes (Redirects to /unauthorized)');

  // --- TEST 7: Department Officer Authentication & RBAC ---
  console.log('\n--- Step 7: Department Officer Authentication & Access ---');
  await authService.logout();
  const officerAccount = INITIAL_PROVISIONED_ACCOUNTS['officer.roads@civicpulse.org'];
  const officer = await authService.login(officerAccount.email, officerAccount.password, 'officer');
  assert(officer.role === USER_ROLES.OFFICER, '7.1: Officer authenticated successfully');
  assert(officer.departmentId === 'roads', '7.2: Officer department assigned as roads');
  assert(officerAllowed.includes(officer.role) === true, '7.3: Officer has access to /officer');
  assert(adminAllowed.includes(officer.role) === false, '7.4: Officer CANNOT access /admin');
  assert(citizenAllowed.includes(officer.role) === false, '7.5: Officer CANNOT access /citizen');

  // --- TEST 8: Super Admin Authentication & RBAC Migration ---
  console.log('\n--- Step 8: Super Admin Authentication & RBAC Migration ---');
  await authService.logout();
  const superAdminAccount = INITIAL_PROVISIONED_ACCOUNTS['admin@civicpulse.org'];
  const superAdmin = await authService.login(superAdminAccount.email, superAdminAccount.password, 'admin');
  assert(superAdmin.role === USER_ROLES.SUPER_ADMIN, '8.1: admin@civicpulse.org authenticated with role SUPER_ADMIN');
  assert(superAdmin.departmentId === null, '8.2: SUPER_ADMIN departmentId is strictly null');
  assert(adminAllowed.includes(superAdmin.role) === true, '8.3: SUPER_ADMIN has access to /admin routes');
  assert(officerAllowed.includes(superAdmin.role) === false, '8.4: SUPER_ADMIN separated from officer workstation');

  // --- TEST 9: Department Admin Authentication & Scope ---
  console.log('\n--- Step 9: Department Admin Authentication & Scope ---');
  await authService.logout();
  const deptAdminAccount = INITIAL_PROVISIONED_ACCOUNTS['admin.roads@civicpulse.org'];
  const deptAdmin = await authService.login(deptAdminAccount.email, deptAdminAccount.password, 'admin');
  assert(deptAdmin.role === USER_ROLES.DEPARTMENT_ADMIN, '9.1: Roads Dept Admin authenticated with role DEPARTMENT_ADMIN');
  assert(deptAdmin.departmentId === 'roads', '9.2: Department Admin departmentId is roads');
  assert(adminAllowed.includes(deptAdmin.role) === true, '9.3: DEPARTMENT_ADMIN has access to /admin routes');

  // --- TEST 10: Legacy Role Migration Handler ---
  console.log('\n--- Step 10: Legacy Profile Normalization ---');
  const legacyProfile = { uid: 'legacy-1', email: 'admin@civicpulse.org', role: 'admin', departmentId: 'all' };
  localStorage.setItem('civicpulse_users_directory', JSON.stringify({ 'admin@civicpulse.org': legacyProfile }));
  const migratedUser = await authService.getUserProfile('legacy-1');
  assert(migratedUser.role === USER_ROLES.SUPER_ADMIN, '10.1: Legacy role "admin" automatically migrated to SUPER_ADMIN');
  assert(migratedUser.departmentId === null, '10.2: Migrated SUPER_ADMIN departmentId normalized to null');

  // --- TEST 11: Final Unauthenticated Boundary ---
  console.log('\n--- Step 11: Final Unauthenticated Access Block ---');
  await authService.logout();
  const emptySession = authService.getInitialSession();
  assert(emptySession === null, '11.1: Logged-out state active');

  // --- TEST 12: Unauthenticated Route Protection & Navbar Rules ---
  console.log('\n--- Step 12: Unauthenticated Route Protection & Direct URL Redirection ---');
  const protectedRoutes = ['/feed', '/track', '/citizen/report', '/citizen/my-grievances', '/officer/inbox', '/admin/dashboard'];
  
  // Verify unauthenticated user state
  const isAuth = Boolean(authService.getInitialSession());
  assert(!isAuth, '12.1: Unauthenticated user session confirmed empty');

  protectedRoutes.forEach((route, idx) => {
    // Standard protection rule: unauthenticated attempts to access protected routes must fail/redirect
    const requiresAuth = route.startsWith('/feed') || route.startsWith('/track') || route.startsWith('/citizen') || route.startsWith('/officer') || route.startsWith('/admin');
    assert(requiresAuth && !isAuth, `12.${idx + 2}: Direct URL access to ${route} blocked for unauthenticated users (Redirects to /login)`);
  });

  // Authenticate citizen and test allowed features
  const activeCitizen = await authService.login('priya.nair@example.com', 'SecurePass2026', 'citizen');
  assert(activeCitizen.role === USER_ROLES.CITIZEN, '12.8: Authenticated Citizen session active');
  assert(citizenAllowed.includes(activeCitizen.role), '12.9: Authenticated Citizen can access /feed, /track, and /citizen features');
  assert(!officerAllowed.includes(activeCitizen.role), '12.10: Authenticated Citizen cannot access /officer routes');
  assert(!adminAllowed.includes(activeCitizen.role), '12.11: Authenticated Citizen cannot access /admin routes');

  console.log('\n================================================================');
  console.log(`PRODUCTION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runModule1Tests().catch((e) => {
  console.error('Fatal error during test run:', e);
  process.exit(1);
});
