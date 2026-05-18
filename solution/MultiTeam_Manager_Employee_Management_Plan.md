# Multi-Team Manager & Employee Management — Implementation Strategy Plan
### For: AtomQuest Hackathon 1.0 — GoalKeeper Portal
*Addendum to the main Winning Blueprint — focused exclusively on team management and employee lifecycle*

---

## OVERVIEW

This plan covers two tightly related features:

1. **A Manager can own and manage multiple teams** — each with its own members, goals, and check-in cycles.
2. **A Manager or Admin can add employees (approve join requests) or remove employees** from teams — with full role and access lifecycle management.

Both features must integrate without breaking any existing functionality: goal creation, check-in flows, shared goals sync, the org tree visualization, audit trails, quarterly window enforcement, and the BRD validation engine. Every design decision below is made with that constraint in mind.

---

## PART 1 — MULTI-TEAM MANAGER FEATURE

### 1.1 The Core Concept

In the current architecture, the relationship between a Manager and their team is implicitly one-to-one — one manager, one group of employees. This plan upgrades that to a one-to-many relationship: **a single Manager account can own, govern, and operate across multiple named teams simultaneously.**

Each team is a distinct entity with its own:
- Name and optional description
- Member roster (employees assigned to that team)
- Goals (team-level goals can be scoped to one team or shared across teams a manager owns)
- Check-in windows
- Analytics and progress views

A Manager sees all their teams from a unified dashboard and can switch context between them without logging out or switching accounts.

---

### 1.2 Database Schema Changes

The following schema additions are required. These extend the existing schema — no existing tables are dropped or restructured.

**New Table: `teams`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `name` | VARCHAR(100) | Required, unique per manager |
| `description` | TEXT | Optional |
| `manager_id` | UUID (FK → users.id) | The owning manager |
| `created_at` | TIMESTAMP | Auto |
| `is_active` | BOOLEAN | Soft-delete flag |

**New Table: `team_members`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `team_id` | UUID (FK → teams.id) | The team |
| `employee_id` | UUID (FK → users.id) | The employee member |
| `joined_at` | TIMESTAMP | When approved/added |
| `status` | ENUM(`active`, `removed`) | Allows soft removal tracking |

**Modified Table: `goals`**

Add a `team_id` column (nullable FK → `teams.id`). When a goal is created within a team context, this is set. Existing goals without a team_id remain valid and belong to the manager's default workspace. No data migration or backfill needed.

**Why this schema works without breaking anything:**
- Existing goals, check-ins, and achievement records reference `employee_id` and `manager_id` directly — these continue to work unchanged.
- The `team_id` on goals is additive and nullable; no existing query breaks.
- The org tree visualization reads from `users` and goal progress — unaffected.
- Shared goal sync operates on `goal_id` — unaffected.

---

### 1.3 Backend API Endpoints (FastAPI)

All endpoints are prefixed under `/api/v1/teams/`. All require authentication. Manager-scoped endpoints verify `current_user.role == "manager"` and that the `team_id` belongs to the requesting manager before any operation.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/teams/` | Create a new team |
| GET | `/teams/` | List all teams owned by the current manager |
| GET | `/teams/{team_id}` | Get team detail + member list |
| PATCH | `/teams/{team_id}` | Rename or update team description |
| DELETE | `/teams/{team_id}` | Soft-delete a team (sets `is_active = false`) |
| GET | `/teams/{team_id}/members` | List active members of a team |
| GET | `/teams/{team_id}/goals` | List goals scoped to this team |
| GET | `/teams/{team_id}/analytics` | Progress summary for the team |

All write operations on teams are logged to the existing audit trail with `action_type: "team_event"` and a description field.

**Critical backend guard:** When a manager calls any team endpoint, the service layer must verify `teams.manager_id == current_user.id`. This prevents cross-manager team access. This check must be in the service layer, not just the route guard, because it must hold even if a future route is added that bypasses role checks.

---

### 1.4 Frontend Implementation

**Manager Dashboard Changes**

The manager's top navigation gains a **Team Switcher** — a dropdown that lists all teams they own, plus an "All Teams" aggregate view. The selected team context persists in React state (not URL params, to avoid complexity) and scopes all subsequent data fetches via React Query.

Example context store (Zustand or React Context):
```
activeTeamId: string | "all"
teams: Team[]
setActiveTeam(id): void
```

**Team Management Page** (`/manager/teams`)

This is a new page accessible from the manager sidebar. It shows:
- A card grid of all teams with member count, active goal count, and average progress.
- A "+ Create Team" button that opens a modal with Name + Description fields.
- Clicking a team card navigates to that team's detail page.

**Team Detail Page** (`/manager/teams/:teamId`)

Contains three tabs:
1. **Members** — roster table with name, email, join date, and a Remove button.
2. **Goals** — the existing goals table, filtered to this team's `team_id`.
3. **Analytics** — the existing analytics charts, scoped to team members.

This reuses all existing components. The only new prop passed is `teamId`, which is forwarded to all React Query hooks as a filter parameter.

**Goal Creation — Team Association**

When a manager creates a goal (existing flow), a new optional dropdown is added: "Assign to Team." This lists their teams. If left blank, the goal is unscoped (personal/default workspace). This is a non-breaking addition to the existing goal creation form.

---

### 1.5 How Existing Features Stay Intact

| Feature | Impact | Resolution |
|---|---|---|
| Goal creation + BRD validation | No impact | Team dropdown is additive, validation rules unchanged |
| Shared goals sync | No impact | Sync is keyed on goal_id, not team_id |
| Quarterly window enforcement | No impact | Window logic is date-based, not team-based |
| Org Alignment Tree | Minor addition | Tree nodes can be grouped by team (color border per team) as an enhancement, but default behavior unchanged |
| Check-in workflow | No impact | Check-ins reference employee_id and goal_id directly |
| Audit trail | Additive | New team events logged, existing events unchanged |
| Analytics module | Additive | Team-scoped view is a filter on top of existing queries |
| Admin completion dashboard | No impact | Admin reads from users and goals tables, unchanged |

---

## PART 2 — EMPLOYEE ADD / REMOVE (APPROVAL & REMOVAL FLOW)

### 2.1 The Two Actor Model

Both **Managers** and **Admins** can add and remove employees, but through slightly different mechanisms:

- **Admin** has platform-wide authority. They can add any employee to any team, approve or reject join requests globally, and hard-remove an employee from the platform.
- **Manager** can only operate within teams they own. They can approve or reject requests to join their teams and remove employees from their own teams.

This maps cleanly to the existing three-role system (Admin, Manager, Employee) and requires no new role types.

---

### 2.2 The Employee Join Request Flow

An employee who wants to join a team goes through a request-approval cycle rather than being auto-added. This mirrors real-world HRMS onboarding.

**Step 1 — Employee Sends a Request**

On the employee dashboard, a new section "My Teams" shows current team memberships and a "+ Request to Join a Team" button. This opens a modal with a searchable dropdown of available teams (teams whose manager is active and whose `is_active = true`). The employee selects a team and submits. A record is created in `team_join_requests`.

**New Table: `team_join_requests`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `team_id` | UUID (FK → teams.id) | Target team |
| `employee_id` | UUID (FK → users.id) | Requesting employee |
| `requested_at` | TIMESTAMP | Auto |
| `status` | ENUM(`pending`, `approved`, `rejected`) | Default `pending` |
| `reviewed_by` | UUID (FK → users.id) | Manager or Admin who acted |
| `reviewed_at` | TIMESTAMP | Nullable until reviewed |
| `rejection_reason` | TEXT | Optional, for rejected requests |

**Step 2 — Manager / Admin Sees Pending Requests**

A **Pending Requests** badge appears on the Manager's Team Detail page and on the Admin's User Management page whenever there are unreviewed requests. This uses a polling approach (React Query with a 30-second refetch interval — consistent with the main blueprint's anti-WebSocket stance).

**Step 3 — Approve or Reject**

The reviewer sees a table of pending requests with employee name, email, and the date requested. Each row has an **Approve** and **Reject** button.

- On **Approve**: A row is inserted into `team_members` with `status = active`. The `team_join_requests` record is updated to `approved`. The employee's "My Teams" section immediately reflects the new membership.
- On **Reject**: The `team_join_requests` record is updated to `rejected`, with an optional rejection reason. The employee sees "Request Rejected" in their "My Teams" section with the reason if provided.

Both actions are written to the audit trail.

---

### 2.3 The Admin Direct-Add Flow

An Admin does not need to wait for an employee to request. From the Admin panel's User Management page, the Admin can:

1. Select any employee from the employee list.
2. Click "Add to Team."
3. A modal shows all active teams with a searchable dropdown.
4. On confirmation, a `team_members` row is directly inserted (`status = active`) and an `approved` join request record is also created for audit completeness (with `reviewed_by = admin_user_id`).

This gives Admins a fast-track path that bypasses the request queue while still maintaining a full audit trail.

---

### 2.4 The Remove Employee Flow

**Manager Removing from Their Own Team**

On the Team Detail → Members tab, each active member row has a **Remove** button. Clicking it opens a confirmation modal: "Remove [Name] from [Team Name]? This will not delete their goals or goal history."

On confirmation:
- The `team_members` row for this employee + team is updated: `status = removed`.
- The employee's goals scoped to this team (`goals.team_id = this team`) are **not deleted**. They are retained for historical record and audit. They simply no longer appear in the active team view.
- An audit trail entry is created: `action_type: "member_removed"`, with manager ID, employee ID, team ID, and timestamp.
- The employee's "My Teams" section no longer shows this team.

**Admin Removing from Any Team or from the Platform**

Admins have two levels of removal:

1. **Remove from a specific team** — same as above, but executable on any team regardless of manager.
2. **Deactivate the employee's account** — this is a platform-level action. It sets `users.is_active = false` on the employee record. The employee can no longer log in. All their historical goals, check-ins, and audit records are preserved. The org tree and analytics continue to show their historical data correctly by querying all users (active or not) for historical periods. Active goal assignments are flagged as "Employee Deactivated" in the manager's goal view.

**Critical rule:** No employee data (goals, check-ins, achievements) is ever hard-deleted. Removal is always a status flag change. This is non-negotiable for an HRMS product — historical data integrity is a legal and operational requirement.

---

### 2.5 Backend API Endpoints for Employee Management

All prefixed under `/api/v1/teams/{team_id}/members/` and `/api/v1/admin/users/`. All role-guarded.

| Method | Endpoint | Actor | Purpose |
|---|---|---|---|
| POST | `/teams/{team_id}/members/request` | Employee | Submit join request |
| GET | `/teams/{team_id}/members/requests` | Manager/Admin | View pending requests |
| POST | `/teams/{team_id}/members/requests/{request_id}/approve` | Manager/Admin | Approve request |
| POST | `/teams/{team_id}/members/requests/{request_id}/reject` | Manager/Admin | Reject with optional reason |
| DELETE | `/teams/{team_id}/members/{employee_id}` | Manager/Admin | Remove member from team |
| POST | `/admin/users/{user_id}/add-to-team` | Admin only | Direct add to team |
| PATCH | `/admin/users/{user_id}/deactivate` | Admin only | Deactivate account platform-wide |
| PATCH | `/admin/users/{user_id}/reactivate` | Admin only | Reactivate a deactivated account |

Every one of these endpoints writes an audit trail record. The audit record format is identical to existing audit entries, using the same `audit_logs` table with an expanded `action_type` enum.

---

### 2.6 Frontend: Admin User Management Page Changes

The existing Admin panel gains a dedicated **"User Management"** section (new sidebar item). It contains:

**Employee Table**
Columns: Name, Email, Role, Teams (count + names as tags), Status (Active / Deactivated), Actions.

Actions per row:
- **Add to Team** — opens team selection modal.
- **Remove from Team** — opens team selection modal showing current team memberships.
- **Deactivate** — opens confirmation modal with a warning that the employee will lose login access.
- **Reactivate** (only shown for deactivated users).

**Pending Requests Panel**
A collapsible panel at the top of the User Management page shows all pending join requests across all teams. Each row shows: Employee name → requested to join → Team name → date. Approve / Reject buttons inline.

---

### 2.7 Notification Strategy

No email infrastructure is required (keeping it simple and demo-stable). All notifications are delivered as **in-app toast notifications** on next login or page load:

- Employee logs in after their request was approved → toast: "Your request to join [Team Name] was approved."
- Employee logs in after rejection → toast: "Your request to join [Team Name] was not approved. [Reason if provided]."
- Manager logs in with pending requests → persistent banner: "You have [N] pending team join requests."

Toast notifications use the existing notification system (if built) or a simple `localStorage`-backed unread flag cleared on view. No new infrastructure required.

---

## PART 3 — INTEGRATION CHECKLIST

Before considering this feature complete, verify all of the following:

- [ ] Manager can create, rename, and soft-delete teams without affecting any existing goal or check-in records.
- [ ] Team switcher in manager dashboard correctly scopes all data fetches.
- [ ] Employee can submit a join request and see its status in real time (30-second polling).
- [ ] Manager can approve and reject requests; approved employees immediately appear in member list.
- [ ] Admin can directly add any employee to any team bypassing the request queue.
- [ ] Manager can remove an employee from their team; goals and history are preserved.
- [ ] Admin can deactivate an employee; historical data remains intact and visible.
- [ ] All team events appear in the audit trail with correct actor, action, and timestamp.
- [ ] Org Alignment Tree still renders correctly for employees in multiple teams (employee appears once; their team memberships are a hover detail).
- [ ] Goal creation form correctly associates goals to a team via the new dropdown.
- [ ] All backend endpoints validate ownership (manager can only act on their own teams).
- [ ] Quarterly window enforcement is unaffected (date-based, not team-based).
- [ ] Shared goals sync is unaffected (goal_id-based, not team-based).
- [ ] BRD weightage and goal count validations are scoped per employee per quarter, not per team — this is unchanged.

---

## PART 4 — IMPLEMENTATION TIMELINE WITHIN HACKATHON

This feature is **Advanced Scope** — it should be built after the MVP is stable (after Hour 14).

| Hours | Tasks |
|---|---|
| Hour 14–15 | DB migrations: add `teams`, `team_members`, `team_join_requests` tables. Add `team_id` to `goals`. |
| Hour 15–16 | Backend: Team CRUD endpoints + member list endpoint. Role guards and ownership validation. |
| Hour 16–17 | Backend: Join request endpoints (submit, approve, reject, direct-add, remove, deactivate). Audit trail integration. |
| Hour 17–18 | Frontend: Team Switcher component + Team Management page + Team Detail page (Members + Goals tabs). |
| Hour 18–19 | Frontend: Admin User Management page (employee table, pending requests panel, modals). |
| Hour 19–20 | Frontend: Employee "My Teams" section + join request submission flow + status toasts. |
| Hour 20 | End-to-end smoke test: create team → employee requests → manager approves → manager removes → admin deactivates. Fix any broken flows. |

This timeline keeps the feature safely within the Advanced Scope window and does not compress the Demo Scope polish phase (Hours 20–24).

---

*This plan is a focused addendum to the AtomQuest 1.0 Winning Blueprint. It covers only the multi-team manager feature and employee add/remove lifecycle. All other features, architecture decisions, and demo strategies remain as documented in the main blueprint.*
