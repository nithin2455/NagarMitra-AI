/**
 * @file test_module6_analytics.mjs
 * @description Automated Unit & Integration Tests for Module 6: Analytics & Administrative Intelligence
 */

import { authService, INITIAL_PROVISIONED_ACCOUNTS } from './src/services/firebase/authService.js';
import { grievanceService } from './src/services/firebase/grievanceService.js';
import { analyticsService } from './src/services/analytics/analyticsService.js';
import {
  USER_ROLES,
  COMPLAINT_STATUS,
  COMPLAINT_VISIBILITY,
  SEVERITY_LEVELS,
  ESCALATION_LEVELS,
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

async function runModule6Tests() {
  console.log('================================================================');
  console.log('STARTING MODULE 6: ANALYTICS & ADMINISTRATIVE INTELLIGENCE TESTS');
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
  console.log('--- Step 0: Accounts Authentication ---');
  const citizen = await authService.register('ananya.analytics@example.com', 'Pass@123456', 'Ananya Sen');

  const roadsOfficerCreds = INITIAL_PROVISIONED_ACCOUNTS['officer.roads@civicpulse.org'];
  const roadsAdminCreds = INITIAL_PROVISIONED_ACCOUNTS['admin.roads@civicpulse.org'];
  const sanitationAdminCreds = INITIAL_PROVISIONED_ACCOUNTS['admin.sanitation@civicpulse.org'];
  const superAdminCreds = INITIAL_PROVISIONED_ACCOUNTS['admin@civicpulse.org'];

  const roadsOfficer = await authService.login(roadsOfficerCreds.email, roadsOfficerCreds.password, 'officer');
  const roadsAdmin = await authService.login(roadsAdminCreds.email, roadsAdminCreds.password, 'admin');
  const sanitationAdmin = await authService.login(sanitationAdminCreds.email, sanitationAdminCreds.password, 'admin');
  const superAdmin = await authService.login(superAdminCreds.email, superAdminCreds.password, 'admin');

  // --- TEST 1 to 5: Security & RBAC Access Controls ---
  console.log('\n--- Step 1: Security & RBAC Access Controls ---');
  try {
    // 1. Super Admin Access -> Allowed
    const superAdminData = await analyticsService.getAnalytics(superAdmin);
    assert(Boolean(superAdminData?.kpiSummary), 'TEST 1: Super Admin can access Analytics');

    // 2. Department Admin Access -> Allowed
    const roadsAdminData = await analyticsService.getAnalytics(roadsAdmin);
    assert(Boolean(roadsAdminData?.kpiSummary), 'TEST 2: Department Admin can access Analytics');

    // 3. Citizen Access -> DENIED
    try {
      await analyticsService.getAnalytics(citizen);
      assert(false, 'TEST 3: Citizen should not access Analytics');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 3: Correctly blocked Citizen from accessing Analytics');
    }

    // 4. Officer Access -> DENIED
    try {
      await analyticsService.getAnalytics(roadsOfficer);
      assert(false, 'TEST 4: Officer should not access Analytics');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 4: Correctly blocked Officer from accessing Analytics');
    }

    // 5. Logged-out user Access -> DENIED
    try {
      await analyticsService.getAnalytics(null);
      assert(false, 'TEST 5: Logged-out user should not access Analytics');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 5: Correctly blocked unauthenticated access');
    }
  } catch (err) {
    assert(false, 'Step 1: Security & RBAC', err.message);
  }

  // --- Step 2: Seed Known Dataset Across Multiple Departments & Lifecycle States ---
  console.log('\n--- Step 2: Seed Controlled Dataset for Analytical Validation ---');
  let gRoadSubmitted, gRoadInProgress, gRoadVerified, gSanitationClosed, gWaterEscalated;
  try {
    // 1. Roads Complaint - SUBMITTED, HIGH priority
    gRoadSubmitted = await grievanceService.createGrievance(citizen, {
      title: 'Pothole cluster on Brigade Road',
      description: 'Major craters on highway.',
      categoryId: 'roads',
      ward: 'Ward 1 - Central',
      severity: SEVERITY_LEVELS.HIGH,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });

    // 2. Roads Complaint - IN_PROGRESS (Marked seen by Roads Officer), MEDIUM priority
    gRoadInProgress = await grievanceService.createGrievance(citizen, {
      title: 'Missing asphalt curb stones',
      description: 'Curb damaged.',
      categoryId: 'roads',
      ward: 'Ward 1 - Central',
      severity: SEVERITY_LEVELS.MEDIUM,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });
    await grievanceService.markGrievanceAsSeen(gRoadInProgress.id, roadsOfficer);

    // 3. Roads Complaint - VERIFIED_RESOLVED, LOW priority
    gRoadVerified = await grievanceService.createGrievance(citizen, {
      title: 'Faded speed bump markings',
      description: 'Low visibility speed breaker.',
      categoryId: 'roads',
      ward: 'Ward 2 - South',
      severity: SEVERITY_LEVELS.LOW,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });
    await grievanceService.markGrievanceAsSeen(gRoadVerified.id, roadsOfficer);
    await grievanceService.submitResolutionEvidence(gRoadVerified.id, roadsOfficer, {
      remarks: 'Painted retro-reflective thermoplastic yellow stripes.',
      afterMediaUrls: ['https://mockstorage/road_stripes.jpg'],
    });
    await grievanceService.verifyResolution(gRoadVerified.id, roadsAdmin, { approved: true });

    // 4. Sanitation Complaint - CLOSED, CRITICAL priority
    gSanitationClosed = await grievanceService.createGrievance(citizen, {
      title: 'Hazardous hospital bio-waste dumped near school',
      description: 'Severe health hazard.',
      categoryId: 'garbage',
      ward: 'Ward 4 - North',
      severity: SEVERITY_LEVELS.CRITICAL,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });
    const sanOfficer = await authService.login('officer.sanitation@civicpulse.org', 'Officer@123', 'officer');
    await grievanceService.markGrievanceAsSeen(gSanitationClosed.id, sanOfficer);
    await grievanceService.submitResolutionEvidence(gSanitationClosed.id, sanOfficer, {
      remarks: 'Hazardous waste safely incinerated and sterilized.',
      afterMediaUrls: ['https://mockstorage/sanitation_clean.jpg'],
    });
    await grievanceService.verifyResolution(gSanitationClosed.id, sanitationAdmin, { approved: true });
    await grievanceService.closeGrievance(gSanitationClosed.id, sanitationAdmin, {
      closureRemarks: 'Site cleared and soil tested negative for contaminants.',
    });

    // 5. Water Complaint - Escalated via 3 unique follow-ups
    gWaterEscalated = await grievanceService.createGrievance(citizen, {
      title: 'Water main pipeline burst and flooding basements',
      description: 'Extreme water wastage.',
      categoryId: 'water',
      ward: 'Ward 5 - East',
      severity: SEVERITY_LEVELS.HIGH,
      visibility: COMPLAINT_VISIBILITY.PUBLIC,
    });
    const c2 = await authService.register('c2@example.com', 'Pass@123456', 'Citizen 2');
    const c3 = await authService.register('c3@example.com', 'Pass@123456', 'Citizen 3');
    await grievanceService.submitFollowUp(gWaterEscalated.id, citizen);
    await grievanceService.submitFollowUp(gWaterEscalated.id, c2);
    await grievanceService.submitFollowUp(gWaterEscalated.id, c3);

    console.log('✅ Controlled multi-department dataset seeded successfully.');
  } catch (err) {
    assert(false, 'Step 2: Seed dataset', err.message);
  }

  // --- Step 3: Total KPI Count & Aggregations ---
  console.log('\n--- Step 3: KPI Metrics & Aggregation Accuracy ---');
  try {
    const globalData = await analyticsService.getAnalytics(superAdmin, { dateRange: 'all_time' });
    const kpis = globalData.kpiSummary;

    assert(kpis.totalComplaints >= 5, 'TEST 6: Total grievance count accurately computed (>=5)');
    assert(kpis.pending >= 1, 'TEST 6.1: Pending count correctly includes SUBMITTED complaints');
    assert(kpis.inProgress >= 1, 'TEST 6.2: In Progress count correctly includes active complaints');
    assert(kpis.verifiedResolved >= 1, 'TEST 6.3: Verified Resolved count correctly includes verified complaints');
    assert(kpis.closed >= 1, 'TEST 6.4: Closed count correctly includes archived complaints');
    assert(kpis.escalated >= 1, 'TEST 6.5: Escalated count correctly includes escalated complaints');
  } catch (err) {
    assert(false, 'Step 3: KPI Aggregations', err.message);
  }

  // --- Step 4: Filtering Capabilities (Department, Status, Priority, Date) ---
  console.log('\n--- Step 4: Multi-Dimensional Filter Evaluation ---');
  try {
    // 7. Department Filtering (Roads only)
    const roadsOnly = await analyticsService.getAnalytics(superAdmin, { departmentId: 'roads' });
    assert(
      roadsOnly.kpiSummary.totalComplaints >= 3,
      'TEST 7.1: Super Admin can filter by specific department (roads >= 3)'
    );

    // 8. Status Filtering (Verified Resolved only)
    const verifiedOnly = await analyticsService.getAnalytics(superAdmin, { status: COMPLAINT_STATUS.VERIFIED_RESOLVED });
    assert(
      verifiedOnly.kpiSummary.totalComplaints >= 1 && verifiedOnly.kpiSummary.inProgress === 0,
      'TEST 8: Status filter returns only grievances matching requested status'
    );

    // 9. Priority Filtering (High only)
    const highOnly = await analyticsService.getAnalytics(superAdmin, { priority: 'HIGH' });
    assert(
      highOnly.kpiSummary.totalComplaints >= 2,
      'TEST 9: Priority filter isolates grievances matching selected severity level'
    );

    // 10. Date Range Filtering (Today / All Time)
    const todayData = await analyticsService.getAnalytics(superAdmin, { dateRange: 'today' });
    assert(
      todayData.kpiSummary.totalComplaints >= 5,
      'TEST 10: Date range filter "today" correctly captures newly created complaints'
    );
  } catch (err) {
    assert(false, 'Step 4: Filtering evaluation', err.message);
  }

  // --- Step 5: Department Breakdown & Resolution Rate Calculations ---
  console.log('\n--- Step 5: Department Performance Matrix & Resolution Rate ---');
  try {
    const globalData = await analyticsService.getAnalytics(superAdmin);
    const deptMatrix = globalData.departmentAnalytics;

    assert(Array.isArray(deptMatrix) && deptMatrix.length === 7, 'TEST 11.1: Department matrix includes all 7 municipal departments');

    const roadsStats = deptMatrix.find((d) => d.departmentId === 'roads');
    assert(Boolean(roadsStats), 'TEST 11.2: Roads department metrics computed');
    assert(roadsStats.total >= 3, 'TEST 11.3: Roads total complaints tracked correctly');
    assert(roadsStats.resolved >= 1, 'TEST 11.4: Roads resolved count correctly combines VERIFIED_RESOLVED and CLOSED');

    // 12. Resolution Rate Math Verification
    const expectedRoadsRate = Number(((roadsStats.resolved / roadsStats.total) * 100).toFixed(1));
    assert(
      roadsStats.resolutionRate === expectedRoadsRate,
      `TEST 12.1: Roads resolution rate calculated accurately (${roadsStats.resolutionRate}% matches ${expectedRoadsRate}%)`
    );

    // Zero complaints safety check (e.g. general operations or streetlights if 0)
    const zeroDept = deptMatrix.find((d) => d.total === 0) || { total: 0, resolved: 0, resolutionRate: 0 };
    assert(
      zeroDept.resolutionRate === 0,
      'TEST 12.2: Zero-complaint departments safely evaluate resolution rate to 0.0% without division-by-zero errors'
    );
  } catch (err) {
    assert(false, 'Step 5: Resolution rate math', err.message);
  }

  // --- Step 6: SLA Analytics Verification ---
  console.log('\n--- Step 6: Dual-Clock SLA Analytics Metrics ---');
  try {
    const globalData = await analyticsService.getAnalytics(superAdmin);
    const sla = globalData.slaAnalytics;

    assert(Boolean(sla?.response), 'TEST 13.1: Response SLA analytics structure populated');
    assert(sla.response.met >= 3, 'TEST 13.2: Response SLA Met counter correctly aggregates acknowledged grievances');
    assert(typeof sla.response.complianceRate === 'number', 'TEST 13.3: Response SLA compliance rate computed');

    assert(Boolean(sla?.resolution), 'TEST 14.1: Resolution SLA analytics structure populated');
    assert(sla.resolution.met >= 2, 'TEST 14.2: Resolution SLA Met counter aggregates verified and closed grievances');
    assert(typeof sla.resolution.complianceRate === 'number', 'TEST 14.3: Resolution SLA compliance rate computed');
  } catch (err) {
    assert(false, 'Step 6: SLA Analytics', err.message);
  }

  // --- Step 7: Department Admin Isolation & Cross-Department Security ---
  console.log('\n--- Step 7: Department Admin Boundary Enforcement ---');
  try {
    // 15. Roads Admin queries Roads -> Sees ONLY Roads complaints
    const roadsScope = await analyticsService.getAnalytics(roadsAdmin);
    assert(
      roadsScope.departmentAnalytics.length === 1 && roadsScope.departmentAnalytics[0].departmentId === 'roads',
      'TEST 15.1: Department Admin is strictly scoped to their single assigned department'
    );

    // 15.2 Roads Admin attempts to request Sanitation analytics -> FORBIDDEN
    try {
      await analyticsService.getAnalytics(roadsAdmin, { departmentId: 'garbage' });
      assert(false, 'TEST 15.2: Roads Admin should not request Sanitation department analytics');
    } catch (err) {
      assert(err.message.includes('Access Denied'), 'TEST 15.2: Blocked cross-department analytics leak');
    }

    // 16. Super Admin has unrestricted access to all departments
    const superAdminMatrix = await analyticsService.getAnalytics(superAdmin);
    assert(
      superAdminMatrix.departmentAnalytics.length === 7,
      'TEST 16: Super Admin has unified oversight across all 7 departments'
    );
  } catch (err) {
    assert(false, 'Step 7: Boundary enforcement', err.message);
  }

  // --- Step 8: Empty Data State Handling ---
  console.log('\n--- Step 8: Empty Filter Result State ---');
  try {
    // Non-existent status or future date
    const emptyResult = await analyticsService.getAnalytics(superAdmin, {
      status: 'NON_EXISTENT_STATUS',
    });
    assert(emptyResult.kpiSummary.totalComplaints === 0, 'TEST 17.1: Returns totalComplaints: 0 on empty matches');
    assert(emptyResult.kpiSummary.overallResolutionRate === 0, 'TEST 17.2: Returns overallResolutionRate: 0 on empty matches');
    assert(Array.isArray(emptyResult.priorityDistribution), 'TEST 17.3: Priority distribution safely structured for 0 items');
  } catch (err) {
    assert(false, 'Step 8: Empty state', err.message);
  }

  // --- Summary ---
  console.log('\n================================================================');
  console.log(`MODULE 6 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runModule6Tests().catch((e) => {
  console.error('Fatal error during Module 6 test run:', e);
  process.exit(1);
});
