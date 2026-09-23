# WALKTHROUGH: CivicPulse Module 3 — Dynamic SLA, Priority & Escalation Governance

## Completed Objectives

### 1. 4-Tier Administrative Hierarchy & Department Scoping
- Extended user roles to:
  - `CITIZEN`: Public grievance reporting and tracking.
  - `OFFICER`: Assigned to specific department (e.g. Roads). Can mark `SEEN`, request extensions, and submit resolution proof.
  - `DEPARTMENT_ADMIN`: Manages and verifies grievances strictly within their assigned `departmentId`.
  - `SUPER_ADMIN`: Oversees all municipal departments, cross-department SLAs, and supervisory escalations.
- Provisioned seed accounts for Department Admins (Roads, Water, Sanitation) and Super Admin.

### 2. Centralized SLA Governance Engine (`slaEngine.js`)
- **Dual Independent Clocks**:
  - `Response SLA`: Starts at `SUBMITTED`, stops at `SEEN`.
  - `Resolution SLA`: Starts at `SUBMITTED`, continues running through `RESOLUTION_SUBMITTED` & `VERIFICATION`, and stops ONLY at `VERIFIED_RESOLVED`.
  - `Verification SLA`: 24-hour administrative review window activated upon resolution proof submission. Overdue reviews are flagged.
- **Configurable SLA Thresholds**:
  - $< 75\%$: `NORMAL` (On Schedule)
  - $75\% - 89\%$: `WARNING`
  - $90\% - 99\%$: `URGENT`
  - $\ge 100\%$: `BREACHED`

### 3. Multi-Factor Priority Engine (`priorityEngine.js`)
- Formula:
  $$\text{PriorityScore} = (\text{SeverityWeight} \times 0.35) + (\text{CategoryRisk} \times 0.25) + (\text{SLAUrgency} \times 0.20) + (\text{Aging} \times 0.10) + (\text{CommunitySignal} \times 0.10) + \text{EscalationBonus}$$
- **Critical Safety Override**: High/Critical severity issues (e.g. exposed live cables, deep road craters) receive $\ge 85.0$ priority score (`CRITICAL` level) regardless of 0 community support.

### 4. SLA Extension Governance
- Multi-tier governance:
  - 1st extension ($\le 24\text{h}$): Reviewed by Department Admin.
  - 2nd extension ($> 24\text{h}$ or 2nd request): Reviewed by Super Admin.
  - 3rd extension: Prohibited ($\le 2$ max per complaint) to prevent indefinite postponement.
- Original SLA deadline is preserved in `extensionHistory` and full audit trail logged.

### 5. Automated Hierarchical Escalations (`escalationEngine.js`)
- Levels: `NOT_ESCALATED`, `WARNING`, `DEPARTMENT_ESCALATED`, `SUPER_ADMIN_ESCALATED`, `CRITICAL_ESCALATION`, `RESOLVED`.
- Evaluated on SLA breaches, $\ge 3$ citizen follow-ups, or verification backlogs.

### 6. Verification Gate & Admin Station (`VerificationQueuePage.jsx`)
- Priority-sorted queue with Before/After visual comparison.
- Department Admin sign-off transitions complaint to `VERIFIED_RESOLVED` and officially halts Resolution SLA clock. Rejection reverts complaint to `IN_PROGRESS` with reasons.

---

## Test Verification Summary

| Test Suite | Total Tests | Passed | Status |
| :--- | :--- | :--- | :--- |
| `test_module3_governance.mjs` | 42 | 42 | ✅ 100% Passed |
| `test_module2_grievance_workflow.mjs` | 29 | 29 | ✅ 100% Passed |
| `test_auth_module.mjs` | 24 | 24 | ✅ 100% Passed |
| `npm run build` (Vite production bundle) | - | 0 errors | ✅ 100% Built |
