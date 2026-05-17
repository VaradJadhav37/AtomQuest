# GoalPulse â€” Implementation Plan
### AtomQuest Hackathon 1.0 | In-House Goal Setting & Tracking Portal
*Derived from: AtomQuest_1.0_Winning_Strategy.md + AtomQuest_Hackathon_1.0_Problem_Statement.md*

---

## TABLE OF CONTENTS

1. Executive Summary
2. Problem Statement Breakdown
3. Solution Architecture Overview
4. Tech Stack & Tooling
5. Phase-by-Phase Implementation Roadmap
6. Feature Breakdown
7. Data Models & Schemas
8. API & Integration Surface
9. Testing & Validation Strategy
10. Risk Register
11. Demo & Presentation Strategy
12. Open Questions & Assumptions

---

## 1. EXECUTIVE SUMMARY

GoalPulse is a production-grade, AI-augmented Goal Setting & Performance Tracking Portal built to win AtomQuest Hackathon 1.0 by outperforming every judging criterion simultaneously rather than trading one off against another. The solution is architected as a React 18 + TypeScript single-page application backed by a FastAPI (Python) modular-monolith API, a Supabase-hosted PostgreSQL database, and the Anthropic AI API â€” all deployed to free-tier cloud services, yielding a projected live-demo infrastructure cost under $1. Against the six evaluation parameters, GoalPulse wins as follows: on **Functionality**, a fully tested three-role workflow (Employee â†’ Manager â†’ Admin) completes end-to-end without a single broken state, enforced by both frontend guards and backend validation so no judge action can produce an inconsistency; on **BRD Adherence**, every Phase 1 and Phase 2 requirement is implemented exactly as specified â€” including the four UoM progress formulas, the 100%/10%/8-goal validation triplet, goal locking, shared-goal achievement sync, and quarterly window enforcement at the API layer; on **User Friendliness**, a Modern Enterprise Refined design system (IBM Plex Sans, indigo/slate palette, shadcn/ui components, skeleton loaders, meaningful empty states, and real-time inline validation) ensures non-technical HR managers can operate the portal without training; on **Bug Presence**, every submit button disables on first click, all numeric inputs carry min/max/step constraints at both frontend and database layers, optimistic locking prevents approval race conditions, and a rehearsed edge-case test matrix is run before every demo; on **Good-to-Have Features**, two bonus modules are implemented deeply â€” a configurable Escalation Engine and a full Analytics Module â€” plus four GenAI innovations (AI Goal Quality Coach, Manager Check-in Copilot, Natural Language Search, Performance Summary PDF) that are embedded at actual workflow decision points rather than bolted on decoratively; and on **Cost Optimisation**, a visible Cost Dashboard in the admin panel shows real-time AI API spend, cache hit rates, and projected monthly cost at 100 users (~$2.40), making fiscal discipline a demo feature rather than a slide claim. The product name GoalPulse signals real-time organisational rhythm; the pitch positions it as an intelligence layer that makes every goal meaningful from the moment it is written and every check-in conversation richer than it would otherwise be.

---
## 2. PROBLEM STATEMENT BREAKDOWN

Every requirement, constraint, and judging criterion from the problem statement is mapped below with its implementation reference. This table serves as the master traceability matrix.

### 2.1 Phase 1 — Goal Creation & Approval (Must-Have)

| # | Requirement | Implementation Reference | Priority |
|---|---|---|---|
| PS-1.1 | Employee-facing interface to create and submit a Goal Sheet | Goal Creation Wizard (3-step form); Feature F-01 | P0 |
| PS-1.2 | Select a Thrust Area and define Goal Title / Description | Step 1 of creation wizard; dropdown for thrust area; text fields for title/description | P0 |
| PS-1.3 | Assign UoM: Numeric, %, Timeline, or Zero-based | Step 2 of creation wizard; UoM selector drives conditional target-input fields | P0 |
| PS-1.4 | Set Targets and Weightage per goal | Step 2; numeric inputs with real-time weightage balance counter | P0 |
| PS-1.5 | Total weightage across all goals must equal 100% | Frontend real-time counter + backend endpoint guard + DB constraint | P0 |
| PS-1.6 | Minimum weightage per individual goal: 10% | Frontend min-attribute + backend validation in goal_service | P0 |
| PS-1.7 | Maximum number of goals per employee: 8 | Frontend goal-count guard + backend count check before insert | P0 |
| PS-1.8 | Manager (L1) Approval Workflow — review, inline edit, or return for rework | Manager Team Dashboard with drawer-based goal review; inline edit with change logging | P0 |
| PS-1.9 | On approval, goals are locked — no further edits without Admin intervention | goal_status ENUM ? APPROVED (LOCKED); all edit endpoints return 403 post-lock | P0 |
| PS-1.10 | Shared Goals — Admin/Manager pushes departmental KPI to multiple employees | shared_goal_service; GoalLink records per recipient; Feature F-05 | P0 |
| PS-1.11 | Shared Goal recipients may adjust weightage only; title/target are read-only | is_shared flag + shared_goal_id FK on goals row; frontend enforces read-only fields | P0 |
| PS-1.12 | Achievement updates by primary owner sync across all linked goal sheets | Async background propagation via shared_goal_service on achievement write | P0 |

### 2.2 Phase 2 — Achievement Tracking & Quarterly Check-ins (Must-Have)

| # | Requirement | Implementation Reference | Priority |
|---|---|---|---|
| PS-2.1 | Quarterly update interface for employees to log Actual Achievement | Check-in Interface; side-by-side planned vs. actual; Feature F-03 | P0 |
| PS-2.2 | Status selection per goal: Not Started / On Track / Completed | Status enum on goal_achievements; dropdown per goal row | P0 |
| PS-2.3 | Manager Check-in module — view Planned vs. Achievement for each team member | Manager Check-in Screen; employee selector; per-goal comparison table | P0 |
| PS-2.4 | Manager adds structured Check-in Comment | checkin_service stores comment with quarter ref; AI Copilot generates draft | P0 |
| PS-2.5 | Min UoM progress formula: Achievement ÷ Target | UoM formula engine in achievement_service; formula tooltip in UI | P0 |
| PS-2.6 | Max UoM progress formula: Target ÷ Achievement | Same formula engine; explicit labelling "lower is better" | P0 |
| PS-2.7 | Timeline UoM: Completion date vs. Deadline | Date delta computation; expressed as % of window used | P0 |
| PS-2.8 | Zero UoM: If achievement = 0 ? 100%, else 0% | Binary formula branch; explicit "Zero = Success" tooltip | P0 |

### 2.3 Check-in Schedule Enforcement

| Period | Window Opens | System Enforcement |
|---|---|---|
| Goal Setting | 1 May | cycle_service returns GOAL_SETTING_OPEN; only creation/submission endpoints active |
| Q1 Check-in | July | cycle_service returns Q1_OPEN; achievement submission unlocked; prior quarters locked |
| Q2 Check-in | October | Q2_OPEN; Q1 window immutable |
| Q3 Check-in | January | Q3_OPEN |
| Q4 / Annual | March / April | Q4_OPEN; final achievement capture |

Enforcement is **dual-layer**: the frontend reads cycle status and renders read-only vs. editable states; every achievement submission endpoint performs a server-side date-window check before any DB write — directly satisfying the judge objection "your quarterly window enforcement is frontend-only" identified in the strategy doc.

### 2.4 User Roles & Personas

| Role | Capabilities Implemented | Access Control Mechanism |
|---|---|---|
| Employee | Create/edit goals pre-submission; view locked goals; input actuals; download Performance PDF | JWT role claim = "employee"; RLS policy on goals table; all edit endpoints 403 post-lock |
| Manager (L1) | Team dashboard; inline edit during approval; comment/feedback log; AI Check-in Copilot | JWT role claim = "manager"; manager_id FK checks on team queries |
| Admin / HR | Cycle management; goal unlock with audit; escalation rule config; org-wide completion dashboard; analytics | JWT role claim = "admin"; admin-only middleware on cycle/unlock/escalation endpoints |

### 2.5 Reporting & Governance (Section 4 of PS)

| # | Requirement | Implementation Reference |
|---|---|---|
| PS-4.1 | Achievement Report exportable as CSV/Excel | report_service streams CSV; Excel via openpyxl; Feature F-07 |
| PS-4.2 | Completion Dashboard — real-time view of check-in completion | Admin Completion Dashboard; color-coded grid; Feature F-08 |
| PS-4.3 | Audit Trail — all changes post-lock captured with who/what/when | audit_service append-only log; expandable JSON diff rows; Feature F-06 |

### 2.6 Good-to-Have Features (Section 5 of PS)

| Feature | Strategy Recommendation | Implementation Decision |
|---|---|---|
| 5.1 Azure AD / Entra ID SSO | Skip — high risk in demo, low reward vs. effort | Skipped; standard JWT auth used; OIDC middleware present for post-hackathon addition |
| 5.2 Email & Teams Integration | Mock with toast notifications + static Teams card screenshot | Email: toast mock; Teams: labelled design mockup shown in demo |
| 5.3 Escalation Module | Implement deeply as Priority 2 bonus feature | Full rule-config UI + daily cron evaluator + escalation log; Feature F-11 |
| 5.4 Analytics Module | Implement deeply as Priority 1 bonus feature | QoQ trends, heatmap, thrust distribution, manager effectiveness; Feature F-10 |

### 2.7 Evaluation Parameters (Section 6 of PS)

| Parameter | Weight | GoalPulse Response |
|---|---|---|
| Functionality of the Portal | Equal | Complete 3-role E2E workflow; seeded demo data; tested 10+ times |
| Adherence to BRD | Equal | Master traceability matrix (this section); BRD Compliance Checklist widget in admin |
| User Friendliness | Equal | Design system; empty states; inline validation; role-context banner |
| Presence of Bugs | Equal | Double-submit guards; optimistic locking; DB constraints; edge-case test matrix |
| Good-to-Have Features | Equal | Analytics (deep) + Escalation (deep) + 4 AI innovations |
| Cost Optimisation | Equal | Cost Dashboard in admin; free-tier architecture; AI cache; ~$2.40/100 users/month |

### 2.8 Constraints & Ground Rules (Section 7 of PS)

| Constraint | Compliance |
|---|---|
| Web browser accessible | React SPA deployed to Vercel; HTTPS; no desktop dependencies |
| Working demo with one complete user journey per role | Scripted 12-minute demo covers all three roles without error |
| Version-controlled repository | GitHub repo; main = always-deployable; CI/CD via GitHub Actions |
| Architecture diagram submitted | Diagram embedded in README and presented during demo |
| Login credentials / role-switching for 3 roles | Seed data provides three accounts; role context switcher in UI for demo convenience |

---
## 3. SOLUTION ARCHITECTURE OVERVIEW

### 3.1 System Description

GoalPulse is a **three-tier web application** with a clear separation between presentation, application logic, and data persistence. All tiers are independently deployable to free-tier cloud providers.

**Presentation Tier** — A React 18 single-page application compiled by Vite and served from Vercel's CDN. The SPA owns all rendering, routing (React Router v6), and client-side state. Server state (API data, cache invalidation) is managed exclusively by TanStack Query (React Query v5). The UI is built on top of shadcn/ui component primitives styled with TailwindCSS and the GoalPulse design token system. Recharts handles all chart rendering (QoQ trends, heatmaps). D3.js is used only for the Org Alignment Tree. All AI-generated text streams token-by-token into the UI via server-sent events, producing a visible "typing" effect.

**Application Tier** — A FastAPI (Python 3.12) modular monolith deployed to Render's free tier. The application is organised into discrete service modules (auth, cycle, goal, achievement, checkin, shared_goal, report, analytics, escalation, ai, audit) each with its own router and service layer. Background jobs (escalation evaluator, AI cache pruner) run inside the FastAPI process via APScheduler. The AI orchestration layer is fully isolated in ai_service.py — no LLM calls exist in route handlers. Rate limiting on AI endpoints: 10 requests/user/minute enforced in middleware.

**Data Tier** — Supabase-hosted PostgreSQL with Row Level Security policies enabled from day one. Supabase also provides Auth (JWT issuance), Storage (PDF exports), and real-time event subscriptions (used for live dashboard updates). The schema uses soft deletes (deleted_at timestamp) universally. Append-only audit_logs table. Optimistic locking via version counters on goal_sheets.

**AI Service Layer** — Anthropic API (Claude Haiku for goal quality scoring and NL search parsing; Claude Sonnet for performance narrative generation and check-in copilot). Responses are cached in-memory using a SHA-256 hash of the input as the cache key. This layer is cost-controlled by max_tokens caps and a debounce pattern on the goal quality scorer (fires only after 1.5s of typing inactivity).

**Background & Scheduled Layer** — APScheduler within the FastAPI process runs two jobs: the Escalation Evaluator daily at 09:00, and the AI Cache Pruner weekly. For the hackathon, the Escalation Evaluator can also be triggered manually via an admin "Run Now" button to guarantee reliable demo behavior without depending on Render's free-tier sleep behavior.

### 3.2 Text-Based Architecture Diagram

```
+---------------------------------------------------------------------+
¦                        USER'S BROWSER                               ¦
¦                                                                     ¦
¦  +--------------------------------------------------------------+  ¦
¦  ¦               React 18 SPA (Vite build, Vercel CDN)          ¦  ¦
¦  ¦  +-------------+ +-------------+ +------------------------+ ¦  ¦
¦  ¦  ¦  Employee   ¦ ¦   Manager   ¦ ¦     Admin / HR         ¦ ¦  ¦
¦  ¦  ¦   Views     ¦ ¦    Views    ¦ ¦       Views            ¦ ¦  ¦
¦  ¦  +-------------+ +-------------+ +------------------------+ ¦  ¦
¦  ¦         ¦               ¦                    ¦               ¦  ¦
¦  ¦  +---------------------------------------------------------+ ¦  ¦
¦  ¦  ¦           TanStack Query (server-state cache)           ¦ ¦  ¦
¦  ¦  ¦           React Router v6 (client-side routing)         ¦ ¦  ¦
¦  ¦  ¦           shadcn/ui + TailwindCSS + Recharts + D3       ¦ ¦  ¦
¦  ¦  +---------------------------------------------------------+ ¦  ¦
¦  +---------------------------+------------------------------------+  ¦
+------------------------------+--------------------------------------+
                               ¦ HTTPS / REST + SSE
                               ?
+---------------------------------------------------------------------+
¦                  FastAPI Application (Render free tier)             ¦
¦                                                                     ¦
¦  +-------------+  +-------------+  +--------------------------+   ¦
¦  ¦ auth_service¦  ¦cycle_service¦  ¦      goal_service         ¦   ¦
¦  +-------------+  +-------------+  ¦  (create/submit/approve/ ¦   ¦
¦  +-------------+  +-------------+  ¦   lock/unlock/validate)  ¦   ¦
¦  ¦achievement_ ¦  ¦ checkin_    ¦  +--------------------------+   ¦
¦  ¦  service    ¦  ¦  service    ¦                                   ¦
¦  +-------------+  +-------------+  +--------------------------+   ¦
¦  +-------------+  +-------------+  ¦  shared_goal_service      ¦   ¦
¦  ¦  report_    ¦  ¦ analytics_  ¦  ¦  (push/sync/link)         ¦   ¦
¦  ¦  service    ¦  ¦  service    ¦  +--------------------------+   ¦
¦  +-------------+  +-------------+                                   ¦
¦  +-------------+  +-------------+  +--------------------------+   ¦
¦  ¦escalation_  ¦  ¦ audit_      ¦  ¦       ai_service          ¦   ¦
¦  ¦  service    ¦  ¦  service    ¦  ¦  (cache ? Anthropic API)  ¦   ¦
¦  +-------------+  +-------------+  +--------------------------+   ¦
¦                                                                     ¦
¦  +-------------------------------------------------------------+   ¦
¦  ¦  APScheduler (escalation evaluator daily / cache pruner wk) ¦   ¦
¦  +-------------------------------------------------------------+   ¦
+---------------------------------------------------------------------+
                               ¦ pg:// (connection pool)
                               ?
+---------------------------------------------------------------------+
¦                    Supabase (BaaS)                                  ¦
¦                                                                     ¦
¦   +------------------+  +------------------+  +----------------+  ¦
¦   ¦  PostgreSQL DB   ¦  ¦   Supabase Auth  ¦  ¦ Supabase       ¦  ¦
¦   ¦  (RLS enabled)   ¦  ¦  (JWT issuance)  ¦  ¦ Storage (PDFs) ¦  ¦
¦   +------------------+  +------------------+  +----------------+  ¦
+---------------------------------------------------------------------+
                               ¦ API calls
                               ?
+---------------------------------------------------------------------+
¦              Anthropic API (external)                               ¦
¦   Claude Haiku: goal scoring, NL search     ~$0.0001/call          ¦
¦   Claude Sonnet: check-in copilot, perf PDF ~$0.003/call           ¦
+---------------------------------------------------------------------+
```

### 3.3 Data Flow: Core Workflows

**Goal Creation ? Lock Flow:**
Employee submits form ? frontend validates (weightage=100%, min 10%, max 8 goals) ? POST /api/v1/goals/submit ? goal_service validates again server-side ? inserts goals with status=PENDING_APPROVAL ? audit_service logs submission event ? manager receives notification (toast/mock email) ? manager reviews in drawer ? PATCH /api/v1/goal-sheets/{id}/approve ? goal_service sets goal_status=APPROVED (LOCKED), increments version ? all subsequent edit calls return 403.

**Shared Goal Sync Flow:**
Manager/Admin creates shared goal ? POST /api/v1/shared-goals ? shared_goal_service creates shared_goals record and GoalLink rows for each recipient ? each recipient's goal row has is_shared=true and shared_goal_id FK, with weightage editable and title/target read-only ? when primary owner logs Q1 achievement ? POST /api/v1/achievements ? achievement_service writes primary record then calls shared_goal_service.propagate_achievement() ? propagation writes matching achievement rows for all linked goal_ids in a single database transaction ? all recipients see updated values on next page load.

**AI Goal Coach Flow:**
Employee types goal description ? frontend debounces 1.5s ? POST /api/v1/ai/score-goal ? ai_service computes SHA-256 of (title+description+uom) ? checks in-memory cache ? cache miss: calls Anthropic Haiku with SMART-criteria system prompt ? returns quality_report JSON (0–10 per dimension + one suggestion per dimension) ? cache stores result ? frontend renders quality panel alongside the form.

**Quarterly Window Enforcement Flow:**
Every achievement POST hits achievement_service ? service calls cycle_service.get_active_window() ? cycle_service reads goal_cycles table for the current cycle, returns which quarter window is currently OPEN ? if current date not within the returned window, achievement_service raises HTTP 400 ("Check-in window is not currently open") ? frontend also reads /api/v1/cycles/current on page load and renders check-in inputs as read-only if window is closed.

---
## 4. TECH STACK & TOOLING

Every technology choice below is traced to either the strategy doc (SD) or problem statement (PS).

### 4.1 Frontend

| Technology | Version | Rationale | Source |
|---|---|---|---|
| React | 18 | Most hackathon-supported ecosystem; concurrent rendering for smooth UX; team familiarity | SD §7 |
| TypeScript | 5.x | Type safety prevents runtime bugs that judges will catch; role-based access types enforceable at compile time | SD §7 |
| Vite | 5.x | Fast dev server; smaller bundle than CRA; instant HMR during demo preparation | SD §7 |
| TailwindCSS | 3.x | Utility-first; enables consistent 8-pt spacing grid; JIT compiler keeps bundle small | SD §7, §8 |
| shadcn/ui | Latest | Pre-built accessible components (tables, dialogs, toasts, dropdowns, drawers); keyboard navigation included; avoids building UI primitives during hackathon | SD §7, §8 |
| TanStack Query (React Query) | v5 | Handles server state, caching, background refetch, and loading/error states; eliminates manual useEffect data fetching | SD §7 |
| React Router | v6 | Client-side routing for multi-page SPA; nested routes for role-scoped views | Standard |
| Recharts | 2.x | Sufficient for all required analytics charts (line, bar, pie, heatmap proxy); lighter than Victory or Nivo | SD §7 |
| D3.js | 7.x | Used exclusively for Org Alignment Tree — a force-directed or tree-layout graph beyond Recharts' capability | SD §7, §15 |
| Lucide React | Latest | Icon library matching shadcn/ui; consistent, lightweight, open source | SD §8 |
| IBM Plex Sans | Google Fonts | Preferred over Inter (overused in AI UIs per strategy doc); professional enterprise feel | SD §8 |
| jsPDF | 2.x | Client-side PDF generation for Performance Summary; avoids server-side rendering complexity | SD §6, Innovation 6 |

### 4.2 Backend

| Technology | Version | Rationale | Source |
|---|---|---|---|
| Python | 3.12 | Same ecosystem as AI libraries; FastAPI native; pandas for report generation | SD §7 |
| FastAPI | 0.111 | Auto-generates OpenAPI/Swagger docs (show judges); async-first; Python AI ecosystem compatible | SD §7, §9 |
| Pydantic | v2 | Request/response validation; schema enforcement at API boundary; integrated with FastAPI | SD §7 |
| SQLAlchemy | 2.x | ORM for PostgreSQL; async sessions; optimistic locking via version_id_col | SD §9 |
| Alembic | Latest | Database migrations; reproducible schema evolution; shows production discipline | Standard |
| APScheduler | 3.x | In-process scheduler for escalation evaluator (daily) and cache pruner (weekly); no separate worker process needed | SD §9 |
| cachetools / functools.lru_cache | Built-in | In-memory AI response cache keyed on SHA-256 of input; zero infrastructure cost | SD §7, §10 |
| openpyxl | Latest | Excel export for Achievement Report; required by PS §4 for CSV/Excel output | PS §4 |
| python-jose | Latest | JWT decoding and role claim extraction in auth middleware | SD §7 |
| Sentry SDK | Latest | Free-tier error tracking; shows production reliability discipline to judges | SD §11 |

### 4.3 Database & Infrastructure

| Service | Tier | Purpose | Rationale | Source |
|---|---|---|---|---|
| Supabase PostgreSQL | Free (500MB, 50k rows) | Primary database; RLS policies for multi-role data isolation | Most powerful free-tier BaaS; native RLS eliminates entire class of auth bugs | SD §7 |
| Supabase Auth | Free (50k MAU) | JWT issuance; email/password auth | Integrates natively with Supabase DB; avoids building auth from scratch | SD §7 |
| Supabase Storage | Free (1GB) | PDF export storage | Pre-integrated; no additional config | SD §7 |
| Vercel | Hobby (free) | Frontend hosting; CDN; auto-deploy on push | Zero config for Vite SPA; global CDN; preview URLs per branch | SD §11 |
| Render | Free (750 hrs/mo) | Backend (FastAPI) hosting | Simple GitHub-connected deploys; sufficient for demo scale | SD §11 |
| GitHub Actions | Free | CI/CD: test ? deploy pipeline | Demonstrates production discipline; "we have CI/CD" is a judge signal | SD §11 |
| Sentry | Free tier | Error monitoring (frontend + backend) | 15-minute integration; shows reliability awareness | SD §11 |
| Upstash Redis | Free tier | Optional: distributed cache upgrade if in-memory is insufficient | Only if in-memory cache proves insufficient; SD recommends as optional | SD §7 |

### 4.4 AI Services

| Service | Model | Use Case | Cost per Call | Source |
|---|---|---|---|---|
| Anthropic API | Claude Haiku | Goal quality scoring (SMART); NL search query parsing | ~$0.0001 | SD §6, §7 |
| Anthropic API | Claude Sonnet | Manager check-in comment generation; Performance Summary PDF narrative | ~$0.003 | SD §6, §7 |
| Anthropic Batch API | Sonnet | Year-end bulk Performance Summary generation (50% cost reduction) | ~$0.0015 | SD §10 |

### 4.5 Tooling & Developer Experience

| Tool | Purpose |
|---|---|
| pnpm | Frontend package manager; faster installs than npm |
| ESLint + Prettier | Code quality; consistent formatting |
| Vitest | Frontend unit testing |
| pytest | Backend unit and integration testing |
| httpx (pytest client) | FastAPI test client for endpoint integration tests |
| .env / .env.example | Secrets management; never commit keys |

---
## 5. PHASE-BY-PHASE IMPLEMENTATION ROADMAP

The 24-hour hackathon is divided into five phases matching the strategy doc's execution roadmap (SD §12). Each phase has explicit goals, deliverables, dependencies, effort estimate, and acceptance criteria.

---

### Phase 0 — Foundation (Hours 0–2)

**Goal:** Establish the project skeleton, infrastructure, and deployment pipeline so the live URL exists from hour 2 onward and is never lost.

**Deliverables:**
- GitHub repo created with main branch protection; feature branch strategy documented in README
- Frontend scaffolded: Vite + React 18 + TypeScript + TailwindCSS + shadcn/ui initialised; IBM Plex Sans imported; design tokens (color palette, spacing scale) defined in tailwind.config.ts
- Backend scaffolded: FastAPI project with folder structure routers/ services/ models/ core/ tests/; health endpoint GET /health returning {"status":"ok","db":"connected","ai":"operational"}
- Supabase project created; initial schema migration for users, departments, goal_cycles, goal_sheets, goals tables applied via Alembic
- Frontend deployed to Vercel (bare-bones, shows GoalPulse logo and "Coming soon")
- Backend deployed to Render (health endpoint live and accessible from public URL)
- .env.example committed; .env in .gitignore; all secrets in environment variables
- GitHub Actions workflow: on push to main ? pytest ? vitest ? deploy

**Dependencies:** Team access to Supabase, Vercel, Render accounts; Anthropic API key obtained

**Effort:** 2 developer-hours

**Acceptance Criteria:**
- Public URL returns the GoalPulse landing screen in a browser
- /health returns HTTP 200 with all three status fields
- CI/CD pipeline passes on an empty commit
- No secrets in any committed file

---

### Phase 1 — Core BRD Features / MVP (Hours 2–8)

**Goal:** Implement the minimum viable product that satisfies Phase 1 and Phase 2 of the problem statement's must-have requirements.

**Deliverables:**
- Auth system: login page, JWT issuance via Supabase Auth, role claim extraction, role-based middleware on all backend routes, RLS policies enabled
- Goal Creation Wizard: 3-step form (thrust area + title/description ? UoM + target + weightage ? review + submit); real-time weightage balance counter; inline validation (100%, 10% min, 8-goal max) on frontend and backend
- Goal Submission: POST /api/v1/goals/submit; goal_service enforces all BRD validation rules server-side; goal_sheets.status set to PENDING_APPROVAL
- Manager Team Dashboard: table of direct reports with approval status badges; drawer opens goal sheet for review; inline edit of targets/weightages with change logging; Return for Rework action with mandatory comment
- Manager Approval: PATCH /api/v1/goal-sheets/{id}/approve; sets goal_status=APPROVED (LOCKED); version counter incremented
- Goal Locking: all edit endpoints return HTTP 403 for LOCKED goals; padlock icon visible in employee Goal Sheet View
- Basic Check-in Interface: employee selects quarter; enters actual achievement per goal; UoM formula engine computes progress score; status dropdown (Not Started / On Track / Completed); POST /api/v1/achievements
- Audit Service: event logging on every state-changing operation (submission, approval, lock, unlock, achievement write)

**Dependencies:** Phase 0 complete; Supabase schema applied; auth working

**Effort:** 6 developer-hours (2 developers parallel: 1 on frontend forms, 1 on backend services)

**Acceptance Criteria:**
- One complete Employee ? Manager flow executes without any error: create goals, submit, manager approves, goals lock, employee enters Q1 actuals, computed scores display correctly
- Entering 9 goals is blocked with a helpful error message
- Setting weightage total to 99% blocks submission with a specific error
- A goal with weightage 9% is blocked with a specific error
- Approving a goal sheet with version mismatch returns HTTP 409
- Locked goals return 403 on edit attempts via Postman (backend-only test)

---

### Phase 2 — Complete the BRD (Hours 8–14)

**Goal:** Implement every remaining must-have requirement including shared goals, manager check-in, admin capabilities, reporting, and quarterly window enforcement.

**Deliverables:**
- Manager Check-in Screen: employee selector; per-goal planned vs. actual side-by-side comparison; comment textarea; POST /api/v1/check-ins
- Shared Goals: POST /api/v1/shared-goals (admin/manager only); GoalLink records per recipient; recipient goal view shows shared indicator (chain-link icon) with weightage-editable, title/target read-only; achievement propagation via shared_goal_service.propagate_achievement() in a single DB transaction
- Admin Completion Dashboard: filterable grid (employee × quarter); color-coded cells (green/amber/red); summary KPIs at top
- Admin Cycle Management panel: create/edit goal_cycles records; open/close dates per quarter
- Quarterly Window Enforcement: cycle_service.get_active_window() called on every achievement POST; frontend reads /api/v1/cycles/current and renders check-in as read-only outside window
- Achievement Report Export: GET /api/v1/reports/achievements?format=csv|xlsx; streams response; openpyxl for Excel
- Audit Trail view in admin: filterable log table with expandable JSON diff rows
- Admin Goal Unlock: PATCH /api/v1/goal-sheets/{id}/unlock; mandatory reason capture; audit log entry; sets goal_status=UNLOCKED_EXCEPTION; re-lock on next approval
- Demo seed data script: populates 3 users (one per role), a complete goal sheet, Q1+Q2 actuals; seed reset button in admin UI

**Dependencies:** Phase 1 complete; all Phase 1 services stable

**Effort:** 6 developer-hours

**Acceptance Criteria:**
- Full demo script runs without guidance through all three roles: employee creates and submits ? manager approves ? employee logs Q1 actuals ? manager adds check-in comment ? admin views audit trail ? admin exports Achievement Report CSV (file opens correctly)
- Shared goal: manager pushes shared goal to two employees; primary owner logs achievement; both linked employee goal sheets reflect updated achievement without any manual action
- Attempting to submit Q1 actuals when no window is active returns a helpful error (tested via Postman directly to API)
- Demo seed reset clears and re-populates all data in under 30 seconds

---

### Phase 3 — UX Polish + AI Innovation Layer (Hours 14–18)

**Goal:** Transform the functional MVP into a product experience; add the four AI features that differentiate GoalPulse from every other submission.

**Deliverables:**
- Empty states on all list/grid views: custom icon, one-line explanation, CTA button
- Skeleton loading screens replacing spinners on data-heavy views (goal sheet list, team dashboard, analytics)
- Micro-animations: status badge transitions, drawer open/close, progress bar fills
- Goal status timeline component: visual Draft ? Submitted ? Approved ? Q1 Updated ? Q2 Updated progression bar on each goal sheet
- Formula tooltip: hovering over a computed progress score shows "Achievement (85) ÷ Target (100) = 85%" with UoM type label
- AI Goal Quality Coach: POST /api/v1/ai/score-goal; Haiku call with SMART system prompt; response cached; rendered as 5-dimension quality panel (0–10 scores + suggestions) in persistent right panel of creation wizard; debounced 1.5s
- Manager Check-in Copilot: POST /api/v1/ai/generate-checkin-comment; Sonnet call with employee performance context JSON; response streamed token-by-token to frontend textarea via SSE; "Generate AI Comment" button with loading state
- Analytics Module: 4 tabs — Trends (QoQ line chart per employee/team), Heatmap (completion rate grid), Distribution (thrust area pie + UoM breakdown), Manager Effectiveness (bar chart of check-in completion rates); department filter + date range selector
- Escalation Module: admin rule configuration UI (trigger condition, days threshold, escalation chain); daily cron evaluator via APScheduler; manual "Run Now" button for demo; escalation_events log view; POST /api/v1/escalation-rules; GET /api/v1/escalation-events

**Dependencies:** Phase 2 complete; Anthropic API key configured in backend env

**Effort:** 4 developer-hours

**Acceptance Criteria:**
- AI Goal Coach appears within 2 seconds of 1.5s typing pause and shows distinct scores per SMART dimension
- "Generate AI Comment" produces a 3–5 sentence coaching narrative that streams visibly into the textarea
- Analytics Trends tab shows a meaningful QoQ line chart using seed data
- Escalation "Run Now" button fires and creates at least one escalation event in the log (using seed data configured with a violated rule)
- All empty states render meaningful content — no blank white areas anywhere in the app

---

### Phase 4 — Wow Features + Cost Dashboard (Hours 18–22)

**Goal:** Add the three show-stopping demo moments and the cost-optimisation evidence that closes the judging argument.

**Deliverables:**
- Org Alignment Tree Visualization: full-width D3.js tree; each employee node shows name + aggregate achievement %; color coded green (>80%), amber (50–80%), red (<50%); click node ? side drawer with goal sheet summary; animation on load
- Natural Language Search: global search bar in admin/manager header; POST /api/v1/ai/parse-search; Haiku parses NL query ? returns structured filter JSON ? applied to goals DB query ? results rendered in a filtered table; identical query responses cached
- Performance Summary PDF Generator: "Generate Performance Summary" button on employee year-end view; POST /api/v1/ai/generate-performance-summary; Sonnet generates full narrative (strengths, development areas, overall assessment) from full-year goal + actuals + manager comment data; narrative inserted into jsPDF-rendered PDF alongside a formatted goal table; PDF downloadable in-browser
- Cost Dashboard (Admin): card showing AI API calls today / this week; estimated cost ("$0.12 this week"); cache hit rate ("63% of AI calls served from cache"); projected monthly cost at 100 users ("$2.40"); infrastructure cost table (Vercel: $0, Render: $0, Supabase: $0, AI: $X)
- BRD Compliance Checklist widget in admin: visual checklist of every BRD requirement with checkmarks; links to each feature
- Role Context Switch banner: persistent header bar showing "Viewing as: [Employee | Manager | Admin]" with one-click switch for demo convenience

**Dependencies:** Phase 3 complete; seed data in place; AI service stable

**Effort:** 4 developer-hours

**Acceptance Criteria:**
- Org Tree opens full-screen, animates in, displays all seeded employees with correct colors, click opens drawer with correct goal data
- NL Search: typing "show me all Q1 goals with achievement below 50%" returns correctly filtered results
- Performance PDF downloads and contains both the AI narrative paragraph and the formatted goals table
- Cost Dashboard shows real numbers (not hard-coded placeholders) based on actual ai_service call log
- Role switcher changes the entire UI context (nav, available actions, visible data) within one click

---

### Phase 5 — Hardening + Demo Preparation (Hours 22–24)

**Goal:** Eliminate all remaining edge-case bugs; prepare and rehearse the 12-minute demo script; submit all deliverables.

**Deliverables:**
- Edge-case test run: attempt 9 goals (blocked), 99% weightage (blocked), weightage 9% (blocked), out-of-window achievement (blocked), double-submit click (single request only), browser back button after approval (state correct), empty form submit (prevented)
- All submit/approve/generate buttons: disabled on first click + loading spinner; re-enabled on response or error
- Network failure handling: all API calls have error boundaries; failed calls show retry toast (not blank screen)
- README completed: architecture diagram, tech stack description, setup instructions, demo credentials (employee@goalpulse.com / manager@goalpulse.com / admin@goalpulse.com), live URL
- Demo seed reset tested: 5 consecutive resets complete in under 30 seconds each
- Full demo script rehearsed 5 times without guidance
- Repository submitted; live URL confirmed accessible from external network
- Sentry configured: at least one test error captured to verify monitoring works

**Dependencies:** All previous phases complete

**Effort:** 2 developer-hours

**Acceptance Criteria:**
- Demo script runs 5 consecutive times without any unhandled error or broken state
- Every judge edge-case attempt (listed above) produces a helpful, specific error message — not a crash or blank screen
- /health endpoint returns HTTP 200 from the live URL
- GitHub repo is public and contains a passing CI/CD badge in the README

---
## 6. FEATURE BREAKDOWN

For each feature: what it does, how it works technically, which PS requirement it addresses, and its priority.

---

### F-01 — Goal Creation Wizard

**What it does:** A 3-step guided form that allows an employee to create between 1 and 8 goals per annual cycle. Each goal captures: Thrust Area (dropdown), Goal Title (text), Description (textarea), Unit of Measurement (UoM selector: Numeric/Percentage/Timeline/Zero-based), Target value (conditional on UoM type), and Weightage percentage. A persistent real-time weightage balance bar at the top of the form shows remaining % as goals are added.

**How it works technically:** Step 1 collects thrust area, title, description. Step 2 collects UoM, target (numeric input for Numeric/%, date picker for Timeline, disabled for Zero), and weightage. UoM type selection conditionally renders the appropriate target input and a tooltip explaining the UoM (e.g., "Zero-based: achievement of zero counts as 100% success — e.g., safety incidents"). Weightage counter is a derived state computed as 100 minus the sum of all goal weightages. The counter turns red when the total is not exactly 100%. Step 3 shows a read-only review of all goals with the AI quality scores visible. Submit button triggers POST /api/v1/goals/submit. Backend goal_service validates all rules before writing. On validation failure, specific error messages are returned per field.

**PS Requirement:** PS-1.1 through PS-1.7 (all Phase 1 Goal Creation requirements)

**Priority:** P0

---

### F-02 — Manager Approval Workflow

**What it does:** Allows a manager to review a submitted goal sheet, optionally edit targets or weightages inline, and either approve (locking all goals) or return for rework (with a mandatory comment explaining the reason).

**How it works technically:** Manager Team Dashboard shows a table of direct reports. Each row has a status badge (Pending / Approved / Rework Required). Clicking a row opens a slide-in drawer (shadcn Sheet component) showing the full goal sheet in editable form — managers can edit target values and weightages directly in the drawer. Edits are logged in audit_logs as manager_inline_edit events before the approval is committed. The Approve button calls PATCH /api/v1/goal-sheets/{id}/approve, which increments the version counter and sets goal_status=APPROVED (LOCKED) in a single transaction. Optimistic locking: if the submitted version does not match the DB version (employee edited concurrently), the endpoint returns HTTP 409 with a user-friendly message. The Return for Rework action calls PATCH /api/v1/goal-sheets/{id}/return with a mandatory rework_reason field; the employee receives a notification (toast mock) and the goal sheet reverts to DRAFT status.

**PS Requirement:** PS-1.8, PS-1.9 (Manager approval and goal locking)

**Priority:** P0

---

### F-03 — Quarterly Check-in Interface (Employee)

**What it does:** Allows an employee to log actual achievement values against planned targets for each goal in the currently open quarterly window. Computed progress scores are displayed inline with formula tooltips.

**How it works technically:** The interface renders a table with one row per goal. Each row shows: Goal Title, Thrust Area, UoM type, Planned Target, an editable Actual Achievement input, a Status dropdown (Not Started / On Track / Completed), and a computed Progress Score displayed after the actual is entered (formula applied client-side first, then confirmed by the server). A formula tooltip (hover on the score) shows the exact arithmetic: e.g., "Achievement (85) ÷ Target (100) = 85.0%". The UoM formula engine applies: Min: Achievement÷Target; Max: Target÷Achievement; Timeline: a date-delta percentage; Zero: binary 100%/0%. Submitting calls POST /api/v1/achievements with all goal actuals for that quarter. The backend validates the active window via cycle_service before writing. The computed_score is stored in the goal_achievements table alongside the raw actuals to create an immutable record. Outside the active window, all inputs render as read-only and a banner explains when the next window opens.

**PS Requirement:** PS-2.1, PS-2.2, PS-2.5 through PS-2.8 (Achievement tracking and all four UoM formulas)

**Priority:** P0

---

### F-04 — Manager Check-in Module

**What it does:** Allows a manager to view each team member's planned vs. actual achievement for the current quarter side by side, and add a structured check-in comment documenting the discussion.

**How it works technically:** Employee selector dropdown at top of screen. On selection, a two-column table renders: left column = Planned Target per goal, right column = employee's logged Actual Achievement. Progress scores display in a third column. Comment textarea below the table accepts free-form manager feedback. The "Generate AI Comment" button triggers POST /api/v1/ai/generate-checkin-comment, which sends the employee's full performance context (goals, targets, actuals, progress scores, status flags, prior quarter actuals if available) to Claude Sonnet. The response streams token-by-token back to the frontend via server-sent events, populating the textarea with a visible typing effect. Manager can edit the draft before submitting. POST /api/v1/check-ins stores the final comment with quarter reference and manager ID.

**PS Requirement:** PS-2.3, PS-2.4 (Manager check-in view and comment)

**Priority:** P0

---

### F-05 — Shared Goals with Achievement Sync

**What it does:** Allows an admin or manager to push a departmental KPI goal to multiple employees simultaneously. Recipients see the shared goal in their goal sheet with the title and target locked; they may only adjust their weightage. When the primary owner logs achievement, all linked goal sheets automatically reflect the updated value.

**How it works technically:** Admin/Manager accesses Shared Goal creation panel. Fills in goal details (title, description, UoM, target, thrust area) and selects recipient employees from a multi-select list. POST /api/v1/shared-goals creates one shared_goals record (the template) and one goals row per recipient with is_shared=true, shared_goal_id FK, and a weightage_editable=true / title_target_editable=false flag. On the recipient's goal sheet, the shared goal row displays a chain-link icon and grays out title/target fields while keeping weightage editable. When the primary owner submits achievement for a shared goal via POST /api/v1/achievements, achievement_service detects is_shared=true and calls shared_goal_service.propagate_achievement(). This function runs a single database transaction that writes achievement rows for all goal_ids in the goal_links table for that shared_goal_id with the same achievement value. Propagation is idempotent: writing the same value twice produces the same result. All linked employees see updated scores on their next page load (React Query refetch-on-focus).

**PS Requirement:** PS-1.10, PS-1.11, PS-1.12 (Shared Goals all three sub-requirements)

**Priority:** P0 (strategy doc flags this as the highest-risk implementation; deserves dedicated engineering time)

---

### F-06 — Audit Trail

**What it does:** An append-only log of every state-changing operation in the system, visible to admins. Records who changed what, when, and what the before/after values were.

**How it works technically:** audit_service.log_event() is called by every other service on state changes. Each call inserts one row into the audit_logs table (append-only; no updates or deletes on this table). Log view in the admin panel is a filterable table with columns: Timestamp, User (name + email), Action (human-readable: "Goal Approved", "Goal Unlocked", "Achievement Logged"), Entity (Goal Sheet ID or Goal ID), Before (JSON — expandable), After (JSON — expandable). Filters: date range, user, action type. The JSON diff view uses a simple before/after display; no complex diffing library needed.

**PS Requirement:** PS-4.3 (Audit Trail — log all changes post-lock with who/what/when)

**Priority:** P1

---

### F-07 — Achievement Report Export

**What it does:** A one-click export of all employees' planned targets vs. actual achievements for a selected quarter, downloadable as CSV or Excel.

**How it works technically:** Admin selects quarter and optional department filter. GET /api/v1/reports/achievements?quarter=Q1&format=csv streams the response. The report_service queries goal_achievements joined with goals and users, groups by employee, and returns rows: Employee Name, Department, Goal Title, Thrust Area, UoM, Planned Target, Actual Achievement, Computed Progress Score, Status. CSV uses Python's csv module with streaming. Excel uses openpyxl with basic formatting (bold headers, auto-column widths). The frontend triggers a file download via a Blob URL.

**PS Requirement:** PS-4.1 (Achievement Report CSV/Excel export)

**Priority:** P1

---

### F-08 — Admin Completion Dashboard

**What it does:** A real-time grid showing which employees and managers have completed each quarterly check-in, with color-coded status cells and summary KPIs.

**How it works technically:** GET /api/v1/reports/completion-dashboard returns a matrix: rows = employees, columns = Goal Setting + Q1 + Q2 + Q3 + Q4. Each cell value is one of: COMPLETED (green), PENDING (amber), OVERDUE (red), NOT_OPEN (gray). Summary KPIs at top: "X% employees submitted goals" / "Y% managers completed Q1 check-ins." Department filter and search by employee name. React Query refetches every 30 seconds for near-real-time updates.

**PS Requirement:** PS-4.2 (Completion Dashboard — real-time view of check-in completion)

**Priority:** P1

---

### F-09 — AI Goal Quality Coach

**What it does:** As an employee types a goal title and description, a persistent right-side panel scores the goal on the five SMART dimensions (Specific, Measurable, Achievable, Relevant, Time-bound), each on a 0–10 scale, with one actionable improvement suggestion per dimension.

**How it works technically:** A debounce function (1.5 seconds of typing inactivity) triggers POST /api/v1/ai/score-goal with {title, description, uom_type, target} as the body. ai_service computes SHA-256(title+description+uom_type+target) as the cache key, checks in-memory cache, and on miss calls Claude Haiku with a system prompt containing SMART criteria definitions and 3 examples of good/bad goals. Response: a JSON object with five dimension keys, each containing a score (0–10) and a suggestion string. max_tokens=300. Result is cached and returned. Frontend renders a 5-row quality panel with a color-coded score bar per dimension (red 0–3, amber 4–6, green 7–10) and expandable suggestion text. Panel updates in-place on each new response without re-rendering the form.

**PS Requirement:** Addresses the core problem context ("poorly defined goals = poor tracking") in PS §1; directly improves BRD adherence by catching weak goals before submission; supports Criterion 5 (Good-to-Have Features) as an AI innovation

**Priority:** P1

---

### F-10 — Analytics Module

**What it does:** A 4-tab analytics section providing QoQ goal achievement trends, an org-wide completion heatmap, goal distribution by thrust area and UoM, and a manager effectiveness comparison.

**How it works technically:** All data comes from analytics_service which uses DB-side SQL aggregations (GROUP BY, CTEs, window functions) — no in-memory Python loops over fetched rows. Tab 1 (Trends): Recharts LineChart with employee/team/department selector; X-axis = quarter (Q1–Q4); Y-axis = average progress score %. Tab 2 (Heatmap): a grid rendered with Recharts or a custom CSS grid; rows = employees, columns = quarters; cell color intensity = achievement %. Tab 3 (Distribution): Recharts PieChart for thrust area breakdown; a grouped BarChart for UoM type × status. Tab 4 (Manager Effectiveness): BarChart comparing check-in completion rates per L1 manager. Department filter and year selector apply to all tabs.

**PS Requirement:** PS §5.4 (Analytics Module — all four sub-requirements)

**Priority:** P1 (strategy doc recommends this as the highest-visual-impact bonus feature)

---

### F-11 — Escalation Module

**What it does:** A rule-based escalation engine that automatically detects compliance failures (e.g., employee hasn't submitted goals N days after cycle open) and escalates notifications through a configurable chain. An escalation log is visible to admin.

**How it works technically:** Admin configures escalation rules via a UI form: trigger condition (dropdown: "Goal not submitted within N days of cycle open" / "Manager not approved within N days of submission" / "Check-in not completed within window"), threshold (N days), and escalation chain (employee ? manager ? skip-level). POST /api/v1/escalation-rules stores the rule. APScheduler runs escalation_service.evaluate_rules() daily at 09:00. The evaluator checks each active rule against current DB state and fires notifications (logged as escalation_events; mock toast for demo). A "Run Now" admin button calls the evaluator synchronously for reliable demo behavior. GET /api/v1/escalation-events returns the log with filters for status, trigger type, and date range.

**PS Requirement:** PS §5.3 (Escalation Module — all three sub-requirements including configurable triggers and escalation log)

**Priority:** P2

---

### F-12 — Org Alignment Tree Visualization

**What it does:** A full-width interactive org tree where each employee node is color-coded by their aggregate goal achievement percentage. Clicking a node opens a side drawer with that employee's goal sheet summary.

**How it works technically:** GET /api/v1/analytics/org-tree returns a tree-structured JSON (manager ? direct reports hierarchy) with each node containing: employee_id, name, department, aggregate_achievement_pct (average computed progress score across all goals for the current quarter). D3.js renders a hierarchical tree layout with circle nodes. Node fill color: green (>80%), amber (50–80%), red (<50%), gray (no data). On node click: a shadcn Sheet drawer opens showing the employee's goal list with progress scores — no page navigation. Tree animates in on mount using D3 transitions. Legend at bottom-right. This is the "demo floor magnet" identified in the strategy doc.

**PS Requirement:** Supports Criterion 1 (Functionality) and Criterion 3 (User Friendliness) by making org-wide alignment visible; bonus points under Criterion 5

**Priority:** P2

---

### F-13 — Natural Language Search

**What it does:** A global search bar in the admin/manager header that accepts natural language queries and returns filtered goal results.

**How it works technically:** User types a query such as "show me all Q2 goals in the Sales thrust area with achievement below 50%." Frontend calls POST /api/v1/ai/parse-search with {query: "..."} as the body. ai_service sends the query to Claude Haiku with a system prompt instructing it to extract structured filters from the natural language input. Haiku returns a JSON object: {quarter, thrust_area, status, achievement_below, achievement_above, employee_name}. Null values indicate the filter was not specified. The backend applies the non-null filters to a goals DB query and returns matching goals. Results render in a filterable table. Identical query strings hit the in-memory cache.

**PS Requirement:** Supports Criterion 3 (User Friendliness) and Criterion 5 (Good-to-Have); demonstrates AI integration depth

**Priority:** P2

---

### F-14 — Performance Summary PDF Generator

**What it does:** A "Generate Performance Summary" button on an employee's year-end view produces a downloadable PDF containing a formatted goal table and an AI-written narrative paragraph summarizing the employee's annual performance.

**How it works technically:** Button calls POST /api/v1/ai/generate-performance-summary with the employee's full year context: goal titles, UoM types, planned targets, Q1–Q4 actuals, computed scores, and manager check-in comments per quarter. ai_service calls Claude Sonnet (highest quality for this low-frequency, high-value call) with a system prompt focused on formal, balanced performance writing. Output: three paragraphs (strengths, development areas, overall assessment). max_tokens=600. Client-side jsPDF assembles the PDF: header (GoalPulse branding, employee name, year), goal performance table (columns: Goal Title, Target, Q1–Q4 Actuals, Final Score), and the AI narrative below. PDF is generated in-browser and downloaded directly — no server storage required for demo scale.

**PS Requirement:** Supports Criterion 5 (Good-to-Have) and Criterion 1 (Functionality — tangible output artifact); supports appraisal workflow closure

**Priority:** P2

---

### F-15 — Cost Dashboard

**What it does:** An admin panel card showing real-time AI API usage, estimated spend, cache efficiency, and projected monthly cost at 100 users — making cost optimisation a visible, demonstrable feature.

**How it works technically:** ai_service maintains in-memory counters: total_calls_today, total_calls_this_week, cache_hits, cache_misses, estimated_cost_usd (computed from model tier × token counts). GET /api/v1/admin/cost-dashboard returns these values. Frontend renders a card with four metrics: "AI calls this week: 47," "Estimated cost: $0.12," "Cache hit rate: 63%," "Projected cost at 100 users/month: $2.40." Infrastructure cost table below shows all services with $0 for free-tier providers. This directly addresses Criterion 6 (Cost Optimisation) with visible, real-number evidence.

**PS Requirement:** Criterion 6 (Cost Optimisation) explicitly; strategy doc identifies this as "the most memorable single fact judges will carry out of your demo"

**Priority:** P2

---

### F-16 — BRD Compliance Checklist Widget

**What it does:** A small checklist in the admin panel showing every BRD requirement with a green checkmark, each item linking to the relevant feature in the portal.

**How it works technically:** Static component (no API call needed) rendering a list of all requirements from PS §2, §3, §4 with checkmarks and anchor links. The meta-awareness of showing judges that the team tracked BRD compliance explicitly is a psychological differentiator noted in the strategy doc.

**PS Requirement:** Supports all evaluation criteria; directly maps to Criterion 2 (Adherence to BRD)

**Priority:** P2

---
## 7. DATA MODELS & SCHEMAS

All descriptions are in prose and table format only. No code. Every entity is directly traceable to system behaviors described in the strategy doc and requirements in the problem statement.

---

### 7.1 Entity Relationship Summary

The data model has 12 core entities. The primary ownership chain is: **users** ? belong to **departments** ? participate in **goal_cycles** via **goal_sheets** ? which contain **goals** ? which have **goal_achievements** per quarter ? which trigger **check_ins** by managers. Cross-cutting concerns are handled by **shared_goals** + **goal_links** (shared goal distribution), **audit_logs** (immutable change history), **escalation_rules** + **escalation_events** (automated compliance), and an **ai_cache** (cost control).

---

### 7.2 Entity Descriptions

**users**

Represents all system users across all three roles. Every user has exactly one role. Soft-deleted with deleted_at.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key; matches Supabase Auth user ID |
| email | Text | Unique; used for login |
| full_name | Text | Displayed in all views |
| role | Enum | EMPLOYEE, MANAGER, ADMIN |
| department_id | UUID FK ? departments | Organizational unit |
| manager_id | UUID FK ? users (self) | L1 manager; null for top-level managers |
| created_at | Timestamp | |
| deleted_at | Timestamp | Null = active; soft delete |

---

**departments**

Organizational units. Used for filtering in analytics, completion dashboard, and escalation scope.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | Text | e.g., "Sales," "Engineering" |
| head_id | UUID FK ? users | Department head (for escalation chain) |
| created_at | Timestamp | |

---

**goal_cycles**

Defines the annual goal-setting cycle and all quarterly check-in windows. Exactly one ACTIVE cycle exists at any time.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| year | Integer | e.g., 2026 |
| goal_setting_open | Date | 1 May — Phase 1 opens |
| goal_setting_close | Date | Close of goal-setting window |
| q1_open | Date | July — Q1 window opens |
| q1_close | Date | |
| q2_open | Date | October |
| q2_close | Date | |
| q3_open | Date | January |
| q3_close | Date | |
| q4_open | Date | March/April |
| q4_close | Date | |
| status | Enum | UPCOMING, GOAL_SETTING_OPEN, Q1_OPEN, Q2_OPEN, Q3_OPEN, Q4_OPEN, CLOSED |
| created_by | UUID FK ? users | Admin who configured the cycle |
| created_at | Timestamp | |

---

**goal_sheets**

The container representing one employee's full set of goals for one cycle. One employee has at most one goal_sheet per cycle.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| employee_id | UUID FK ? users | The employee who owns this sheet |
| cycle_id | UUID FK ? goal_cycles | The annual cycle |
| status | Enum | DRAFT, PENDING_APPROVAL, APPROVED_LOCKED, UNLOCKED_EXCEPTION, REWORK_REQUIRED |
| version | Integer | Optimistic locking counter; incremented on every approval |
| submitted_at | Timestamp | When employee submitted for approval |
| approved_at | Timestamp | When manager approved |
| approved_by | UUID FK ? users | Manager who approved |
| created_at | Timestamp | |
| deleted_at | Timestamp | Soft delete |

---

**goals**

Individual goals within a goal sheet. Each sheet can have 1–8 goals; total weightage must equal 100%; each goal's weightage is at least 10%.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| goal_sheet_id | UUID FK ? goal_sheets | Parent sheet |
| thrust_area | Text | e.g., "Revenue Growth," "Customer Satisfaction" |
| title | Text | Goal title |
| description | Text | Extended goal description |
| uom_type | Enum | MIN, MAX, TIMELINE, ZERO |
| target_value | Numeric | Null for ZERO type; date stored as Unix timestamp for TIMELINE |
| weightage | Numeric | Percentage; must be = 10; sum across sheet = 100 |
| is_shared | Boolean | True if pushed from a shared_goals template |
| shared_goal_id | UUID FK ? shared_goals | Null if not shared |
| weightage_editable | Boolean | True for shared goals (recipients can adjust weightage) |
| status | Enum | DRAFT, PENDING_APPROVAL, APPROVED_LOCKED, UNLOCKED_EXCEPTION |
| created_at | Timestamp | |
| deleted_at | Timestamp | Soft delete |

*Note: goal-level status mirrors goal_sheet status for enforcement convenience; locking happens at the sheet level and propagates to all goals.*

---

**goal_achievements**

One row per (goal, quarter) pair. Created when an employee logs actuals. Immutable after the quarter window closes (no UPDATE via API after close_date; admin override creates a new audit event).

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| goal_id | UUID FK ? goals | The goal being tracked |
| quarter | Enum | Q1, Q2, Q3, Q4 |
| actual_value | Numeric | Employee-entered actuals |
| computed_score | Numeric | UoM formula result stored at submission time; immutable |
| status | Enum | NOT_STARTED, ON_TRACK, COMPLETED |
| submitted_at | Timestamp | When employee saved actuals |
| created_at | Timestamp | |

---

**check_ins**

Manager's structured comment for a specific employee-quarter pair. One row per (manager, employee, quarter).

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| manager_id | UUID FK ? users | Manager who wrote the comment |
| employee_id | UUID FK ? users | Employee being reviewed |
| cycle_id | UUID FK ? goal_cycles | Cycle context |
| quarter | Enum | Q1, Q2, Q3, Q4 |
| comment_text | Text | Final submitted comment (may be AI-drafted and edited) |
| ai_generated | Boolean | True if comment originated from AI Copilot |
| created_at | Timestamp | |
| updated_at | Timestamp | |

---

**shared_goals**

The template record for a departmental KPI pushed to multiple employees. Contains the canonical title, description, UoM, and target.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| title | Text | Canonical goal title (read-only for recipients) |
| description | Text | |
| uom_type | Enum | Same enum as goals |
| target_value | Numeric | Canonical target (read-only for recipients) |
| thrust_area | Text | |
| primary_owner_id | UUID FK ? users | The employee whose achievement propagates to all links |
| created_by | UUID FK ? users | Admin or Manager who pushed the shared goal |
| cycle_id | UUID FK ? goal_cycles | |
| created_at | Timestamp | |

---

**goal_links**

Junction table mapping a shared_goals template to each recipient employee's goals row. One row per recipient.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| shared_goal_id | UUID FK ? shared_goals | The template |
| goal_id | UUID FK ? goals | The recipient's actual goal row |
| recipient_id | UUID FK ? users | The recipient employee |
| weightage | Numeric | Recipient's chosen weightage (only editable field) |
| created_at | Timestamp | |

---

**audit_logs**

Append-only immutable event log. Never updated or deleted. Captures every state change across all entities.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| entity_type | Text | e.g., "goal_sheet," "goal," "goal_achievement" |
| entity_id | UUID | ID of the changed entity |
| changed_by | UUID FK ? users | User who triggered the change |
| action | Text | Human-readable: "GOAL_SUBMITTED," "GOAL_APPROVED," "GOAL_UNLOCKED," "ACHIEVEMENT_LOGGED" |
| old_value | JSONB | Full snapshot before change; null for creation events |
| new_value | JSONB | Full snapshot after change |
| timestamp | Timestamp | Server-side; not client-provided |
| reason | Text | Mandatory for unlock events; optional for others |

---

**escalation_rules**

Admin-configured rules defining when and how escalations fire.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| trigger_condition | Enum | GOAL_NOT_SUBMITTED, MANAGER_NOT_APPROVED, CHECKIN_NOT_COMPLETED |
| threshold_days | Integer | N days after the trigger event before escalation fires |
| escalation_chain | JSONB | Array of {role: EMPLOYEE/MANAGER/SKIP_LEVEL/HR, delay_days: N} |
| is_active | Boolean | Admin can deactivate without deleting |
| created_by | UUID FK ? users | |
| created_at | Timestamp | |

---

**escalation_events**

Log of every escalation that was triggered by the evaluator.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| rule_id | UUID FK ? escalation_rules | Which rule triggered this |
| affected_user_id | UUID FK ? users | Employee or manager being escalated |
| notified_user_id | UUID FK ? users | Who received the notification |
| trigger_description | Text | Human-readable explanation |
| status | Enum | PENDING, RESOLVED, ACKNOWLEDGED |
| fired_at | Timestamp | When the evaluator generated this event |
| resolved_at | Timestamp | Null until resolved |

---

**ai_cache** (in-memory; not a DB table)

In-process Python dictionary in ai_service. Key: SHA-256 hex of concatenated input fields. Value: {response: object, created_at: datetime}. Pruned weekly (entries older than 30 days removed). Not persisted across restarts — acceptable at hackathon scale because cache rebuild is instant as employees reuse similar goal text.

---

### 7.3 Key Constraints Summary

| Constraint | Enforcement Layer |
|---|---|
| Total weightage per goal_sheet = 100% | Frontend counter + backend goal_service + DB check constraint |
| Minimum weightage per goal = 10% | Frontend min attribute + backend validation + DB check constraint |
| Maximum goals per goal_sheet = 8 | Frontend goal count guard + backend count-before-insert check |
| goal_sheets.version = submitted_version on approval | Optimistic locking check in approval endpoint |
| goal_achievements immutable post-window-close | Window check in achievement_service on every write |
| audit_logs — no UPDATE or DELETE | No UPDATE/DELETE endpoints exist for this table; Supabase RLS denies all non-INSERT operations |
| Shared goal title/target read-only for recipients | weightage_editable flag + frontend field disabling + backend field-level edit guard |

---
## 8. API & INTEGRATION SURFACE

All internal API endpoints follow the pattern /api/v1/{resource}. All endpoints require a valid JWT in the Authorization: Bearer header. Role authorization is enforced in middleware before any DB access. OpenAPI/Swagger docs are auto-generated by FastAPI and accessible at /docs — show judges this page as a professionalism signal.

---

### 8.1 Authentication Endpoints

| Method | Path | Roles | Purpose | Key Inputs | Key Outputs |
|---|---|---|---|---|---|
| POST | /api/v1/auth/login | Public | Email/password login; issues JWT with role claim | {email, password} | {access_token, role, user_id} |
| POST | /api/v1/auth/logout | Any | Invalidates session | — | {status: "ok"} |
| GET | /api/v1/auth/me | Any | Returns current user profile | — | {id, name, email, role, department} |

---

### 8.2 Cycle Management Endpoints

| Method | Path | Roles | Purpose | Key Inputs | Key Outputs |
|---|---|---|---|---|---|
| GET | /api/v1/cycles/current | Any | Returns the active cycle and which window is currently open | — | {cycle_id, status, active_window, window_close_date} |
| GET | /api/v1/cycles | Admin | List all cycles | — | Array of cycle objects |
| POST | /api/v1/cycles | Admin | Create a new annual cycle | {year, goal_setting_open, goal_setting_close, q1_open, q1_close, …} | Created cycle object |
| PATCH | /api/v1/cycles/{id} | Admin | Update cycle window dates | Any cycle date fields | Updated cycle object |

---

### 8.3 Goal Sheet & Goal Endpoints

| Method | Path | Roles | Purpose | Key Inputs | Key Outputs |
|---|---|---|---|---|---|
| GET | /api/v1/goal-sheets/my | Employee | Get own goal sheet for current cycle | — | Goal sheet with nested goals array |
| POST | /api/v1/goal-sheets | Employee | Create empty goal sheet for current cycle | {cycle_id} | Created goal sheet object |
| POST | /api/v1/goals | Employee | Add a single goal to own goal sheet | {goal_sheet_id, thrust_area, title, description, uom_type, target_value, weightage} | Created goal object |
| PATCH | /api/v1/goals/{id} | Employee | Edit a goal (pre-submission only; 403 if LOCKED) | Any non-locked goal fields | Updated goal object |
| DELETE | /api/v1/goals/{id} | Employee | Remove a goal (soft delete; pre-submission only) | — | {status: "deleted"} |
| POST | /api/v1/goal-sheets/{id}/submit | Employee | Submit goal sheet for manager approval | {version} | Updated goal sheet with PENDING_APPROVAL status |
| GET | /api/v1/goal-sheets/team | Manager | Get all direct report goal sheets | ?status=PENDING_APPROVAL | Array of goal sheets with employee info |
| PATCH | /api/v1/goal-sheets/{id}/approve | Manager, Admin | Approve goal sheet; locks all goals | {version} | Goal sheet with APPROVED_LOCKED status |
| PATCH | /api/v1/goal-sheets/{id}/return | Manager | Return goal sheet for rework | {version, rework_reason} | Goal sheet with REWORK_REQUIRED status |
| PATCH | /api/v1/goals/{id}/manager-edit | Manager | Inline edit of target/weightage during approval | {target_value?, weightage?} | Updated goal; audit event fired |
| PATCH | /api/v1/goal-sheets/{id}/unlock | Admin | Unlock a locked goal sheet for exception edits | {reason} | Goal sheet with UNLOCKED_EXCEPTION status; audit event fired |

---

### 8.4 Shared Goal Endpoints

| Method | Path | Roles | Purpose | Key Inputs | Key Outputs |
|---|---|---|---|---|---|
| POST | /api/v1/shared-goals | Manager, Admin | Push a departmental KPI to multiple employees | {title, description, uom_type, target_value, thrust_area, primary_owner_id, recipient_ids[], cycle_id} | Created shared_goals object + count of GoalLink records created |
| GET | /api/v1/shared-goals | Manager, Admin | List all shared goals for current cycle | — | Array of shared goals with linked recipient count |
| PATCH | /api/v1/goals/{id}/weightage | Employee | Update weightage on a shared goal (only editable field) | {weightage} | Updated goal object |

---

### 8.5 Achievement Endpoints

| Method | Path | Roles | Purpose | Key Inputs | Key Outputs |
|---|---|---|---|---|---|
| POST | /api/v1/achievements | Employee | Submit actual achievements for current quarter | {goal_sheet_id, quarter, achievements: [{goal_id, actual_value, status}]} | Array of goal_achievements; computed_scores returned |
| GET | /api/v1/achievements/my | Employee | Get own achievements across all quarters | ?quarter=Q1 | Achievements with computed scores |
| GET | /api/v1/achievements/employee/{id} | Manager | Get a specific employee's achievements | ?quarter=Q1 | Achievements with computed scores |

---

### 8.6 Check-in Endpoints

| Method | Path | Roles | Purpose | Key Inputs | Key Outputs |
|---|---|---|---|---|---|
| POST | /api/v1/check-ins | Manager | Submit structured check-in comment for an employee-quarter | {employee_id, quarter, cycle_id, comment_text, ai_generated} | Created check_in object |
| GET | /api/v1/check-ins/employee/{id} | Manager, Employee (own) | Get all check-in comments for an employee | — | Array of check_in objects |

---

### 8.7 Report Endpoints

| Method | Path | Roles | Purpose | Key Inputs | Key Outputs |
|---|---|---|---|---|---|
| GET | /api/v1/reports/achievements | Admin, Manager | Download Achievement Report | ?quarter=Q1&department_id=X&format=csv|xlsx | File stream (Content-Disposition: attachment) |
| GET | /api/v1/reports/completion-dashboard | Admin, Manager | Completion matrix data | ?cycle_id=X&department_id=X | Matrix object: {employees: [{id, name, goal_setting: STATUS, q1: STATUS, …}]} |
| GET | /api/v1/reports/audit-trail | Admin | Paginated audit log | ?entity_type=X&changed_by=X&from=date&to=date&page=N | {items: [], total, page} |

---

### 8.8 Analytics Endpoints

| Method | Path | Roles | Purpose | Key Inputs | Key Outputs |
|---|---|---|---|---|---|
| GET | /api/v1/analytics/qoq-trends | Admin, Manager | QoQ average progress scores | ?employee_id=X&department_id=X&year=2026 | {quarters: [Q1,Q2,Q3,Q4], series: [{name, data: []}]} |
| GET | /api/v1/analytics/completion-heatmap | Admin | Org-wide heatmap data | ?cycle_id=X | Matrix for heatmap rendering |
| GET | /api/v1/analytics/goal-distribution | Admin | Thrust area and UoM distribution | ?cycle_id=X | {by_thrust_area: [], by_uom_type: [], by_status: []} |
| GET | /api/v1/analytics/manager-effectiveness | Admin | Manager check-in completion rates | ?cycle_id=X | Array of {manager_name, completion_rate_pct} |
| GET | /api/v1/analytics/org-tree | Admin, Manager | Hierarchical employee achievement tree | ?cycle_id=X&quarter=Q1 | Tree-structured JSON |

---

### 8.9 Escalation Endpoints

| Method | Path | Roles | Purpose | Key Inputs | Key Outputs |
|---|---|---|---|---|---|
| GET | /api/v1/escalation-rules | Admin | List all escalation rules | — | Array of rules |
| POST | /api/v1/escalation-rules | Admin | Create a new escalation rule | {trigger_condition, threshold_days, escalation_chain} | Created rule object |
| PATCH | /api/v1/escalation-rules/{id} | Admin | Update or deactivate a rule | {is_active?, threshold_days?, escalation_chain?} | Updated rule |
| GET | /api/v1/escalation-events | Admin | Get escalation event log | ?status=PENDING&from=date | Paginated events array |
| POST | /api/v1/escalation-events/run-now | Admin | Manually trigger escalation evaluator | — | {events_fired: N, details: []} |

---

### 8.10 AI Service Endpoints

| Method | Path | Roles | Purpose | Key Inputs | Key Outputs |
|---|---|---|---|---|---|
| POST | /api/v1/ai/score-goal | Employee | SMART quality score for a goal | {title, description, uom_type, target_value} | {specific: {score, suggestion}, measurable: {…}, achievable: {…}, relevant: {…}, time_bound: {…}} |
| POST | /api/v1/ai/generate-checkin-comment | Manager | Draft check-in comment from performance data | {employee_name, goals: [{title, target, actual, score, status}], prior_quarter_actuals?: []} | SSE stream of comment tokens; final event contains full comment string |
| POST | /api/v1/ai/generate-performance-summary | Employee, Admin | Year-end performance narrative | {employee_name, cycle_year, goals: [{title, uom_type, target, q1_actual, q2_actual, q3_actual, q4_actual, final_score, manager_comments: []}]} | {narrative: {strengths_paragraph, development_paragraph, overall_assessment}} |
| POST | /api/v1/ai/parse-search | Manager, Admin | Parse NL query into structured filters | {query: string} | {quarter?, thrust_area?, status?, achievement_below?, achievement_above?, employee_name?} |

*AI endpoints are rate-limited to 10 requests/user/minute in middleware.*

---

### 8.11 Admin / System Endpoints

| Method | Path | Roles | Purpose | Key Inputs | Key Outputs |
|---|---|---|---|---|---|
| GET | /api/v1/admin/cost-dashboard | Admin | AI usage metrics and cost data | — | {calls_today, calls_week, cache_hits, cache_misses, cache_hit_rate_pct, estimated_cost_usd, projected_monthly_100_users_usd} |
| GET | /health | Public | Health check | — | {status: "ok", db: "connected", ai: "operational"} |
| POST | /api/v1/admin/seed | Admin | Reset and re-seed demo data | {confirm: true} | {status: "seeded", users_created: 3, goals_created: N} |

---

### 8.12 External Service Integrations

| Service | Integration Type | Purpose | Notes |
|---|---|---|---|
| Supabase Auth | REST + JWT | User login, token issuance, session management | Native Supabase client SDK used; JWT decoded in FastAPI middleware |
| Anthropic API | HTTPS REST | LLM calls for all four AI features | Python anthropic SDK; async calls; in-memory cache before each call |
| Supabase Storage | REST (S3-compatible) | PDF export storage (optional; PDFs also streamable directly) | Only used if server-side PDF storage is needed; jsPDF generates client-side by default |
| Sentry | SDK (Python + JS) | Error capture and alerting | Sentry.init() in FastAPI startup and React main.tsx |

---
## 9. TESTING & VALIDATION STRATEGY

Testing serves two purposes: ensuring correctness before judging, and proving to judges that the team treated quality seriously. All test commands are runnable in CI/CD.

---

### 9.1 Backend Unit Tests (pytest)

Each service module has a corresponding test file in tests/. Tests use pytest fixtures with an in-memory SQLite database (for speed) and a mocked Anthropic API client (to avoid live API calls during tests).

| Module | Test Scenarios |
|---|---|
| goal_service | Create goal (valid); create 9th goal (expect 422); set weightage=9% (expect 422); total weightage=99% on submit (expect 422); total weightage=101% on submit (expect 422); total weightage=100% on submit (expect 200); approve locked sheet (expect 403 on edit); approve with wrong version (expect 409) |
| achievement_service | Submit actuals inside open window (expect 200); submit outside window (expect 400 with message); Min UoM formula correctness (85÷100=0.85); Max UoM formula (100÷85=1.176); Zero UoM with actual=0 (expect 1.0); Zero UoM with actual=1 (expect 0.0); Timeline UoM date computation |
| shared_goal_service | Push shared goal to 3 recipients (expect 3 GoalLink records); primary owner achievement propagates to all 3 linked goals; recipient cannot edit title/target (expect 403); recipient can edit weightage (expect 200) |
| audit_service | Every state-changing operation in goal_service produces an audit_log entry; audit entries are never updated or deleted |
| cycle_service | Returns correct active window based on current date; blocks achievement submission when no window is open |
| escalation_service | Rule fires correctly when threshold is exceeded; run_now endpoint fires correctly; event logged in escalation_events |
| ai_service | Cache hit returns cached result without calling API; cache miss calls API and stores result; rate limit exceeded returns 429 |

---

### 9.2 Frontend Unit Tests (Vitest + React Testing Library)

| Component | Test Scenarios |
|---|---|
| WeightageBalanceCounter | Shows "10% remaining" when 90% allocated; turns red when total > 100%; shows "0% remaining" at exactly 100% |
| UoM formula tooltip | Renders correct formula text for each of the four UoM types |
| GoalCreationWizard | Cannot proceed to Step 3 with weightage != 100%; cannot add more than 8 goals; submit button disabled during loading |
| StatusBadge | Renders correct color for each status enum value |
| GoalSheet (locked) | All input fields disabled when goal_status=APPROVED_LOCKED; padlock icon visible |
| AuthGuard | Redirects Employee to 403 page when accessing Manager-only route |

---

### 9.3 Integration Tests (pytest + httpx)

These tests run against the full FastAPI app with a real (test) PostgreSQL database.

| Scenario | Steps | Expected Result |
|---|---|---|
| Complete Employee ? Manager flow | Create user (employee) + user (manager); employee creates 8 goals with 100% weightage; employee submits; manager approves | Goal sheet status = APPROVED_LOCKED; all goals status = APPROVED_LOCKED; audit log has 2 entries |
| Shared goal sync | Admin pushes shared goal to 2 employees; primary owner logs Q1 achievement | Both linked goal_achievements records have identical actual_value and computed_score |
| Quarterly window enforcement | Set cycle with Q1 window in future; employee submits achievement | Returns HTTP 400 with "Check-in window is not currently open" |
| Optimistic locking race condition | Employee and manager both read goal sheet version=1; employee edits (version bumps to 2); manager approves with version=1 | Returns HTTP 409 Conflict |
| Audit trail completeness | Run complete E2E flow; query audit_logs | At minimum: GOAL_SUBMITTED, GOAL_APPROVED, ACHIEVEMENT_LOGGED entries exist |
| Goal unlock with audit | Admin unlocks a locked goal sheet with reason; goal sheet status changes to UNLOCKED_EXCEPTION | audit_logs contains GOAL_UNLOCKED entry with reason field populated |

---

### 9.4 End-to-End Demo Validation (Manual Checklist)

Run through each item exactly as a judge would attempt it. Check all boxes 2 hours before judging.

**BRD Compliance Validation:**
- [ ] Add 9th goal ? blocked with "Maximum 8 goals allowed" message
- [ ] Set goal weightage to 8% ? blocked with "Minimum weightage is 10%" message
- [ ] Submit with total weightage = 97% ? blocked with "Total weightage must equal 100%"
- [ ] Submit with total weightage = 103% ? blocked with same message
- [ ] Approve goal sheet ? goals immediately show padlock icon
- [ ] Try to edit a locked goal as employee ? 403 message displayed, not a crash
- [ ] Shared goal: weightage field editable for recipient, title/target grayed out and non-interactive
- [ ] Shared goal: primary owner logs achievement ? linked recipient's progress score updates without any action by recipient
- [ ] AI Check-in Copilot: click "Generate AI Comment" ? visible token-by-token streaming into textarea
- [ ] Formula tooltip: hover over computed score ? correct formula shown with actual numbers

**Edge Case Validation:**
- [ ] Click "Submit" twice rapidly ? only one request sent (button disabled after first click)
- [ ] Submit check-in form when window is closed ? helpful error message, not crash
- [ ] Browser back button after goal approval ? correct locked state shown
- [ ] Enter non-numeric value in weightage field ? blocked by input type=number
- [ ] Leave goal title blank and try to add ? inline validation fires before API call

**PS Requirement Validation:**
- [ ] Achievement Report: download CSV ? file opens in Excel with correct columns
- [ ] Audit Trail: approve then unlock a goal ? both events appear in admin audit log with correct timestamps
- [ ] Completion Dashboard: after Q1 actuals submitted ? correct employee shows as COMPLETED in Q1 column
- [ ] Quarterly window enforcement: use Postman to POST /api/v1/achievements with auth token when no window is active ? HTTP 400 returned (not frontend-only enforcement)

---

### 9.5 PS Requirement ? Test Coverage Matrix

| PS Requirement | Unit Test | Integration Test | Manual Checklist |
|---|---|---|---|
| PS-1.5 Total weightage = 100% | goal_service tests | Full E2E flow | Checklist item |
| PS-1.6 Min weightage 10% | goal_service tests | — | Checklist item |
| PS-1.7 Max 8 goals | goal_service tests | — | Checklist item |
| PS-1.9 Goal locking | — | Locking integration test | Checklist item |
| PS-1.11 Shared goal read-only fields | shared_goal_service | Shared goal sync test | Checklist item |
| PS-1.12 Shared goal achievement sync | shared_goal_service | Shared goal sync test | Checklist item |
| PS-2.5–2.8 All four UoM formulas | achievement_service | — | Formula tooltip check |
| PS-2.3 Check-in window enforcement | cycle_service | Window enforcement test | Postman test |
| PS-4.1 Achievement Report export | — | — | Download and open file |
| PS-4.2 Completion Dashboard | — | — | Q1 completion check |
| PS-4.3 Audit Trail completeness | audit_service | Audit trail test | Audit view check |

---
## 10. RISK REGISTER

Each risk is scored: Likelihood (H/M/L) × Impact (H/M/L) = Priority.

| # | Risk | Likelihood | Impact | Priority | Mitigation |
|---|---|---|---|---|---|
| R-01 | Shared goal achievement sync has a race condition or transaction failure | M | H | HIGH | Use a single database transaction in shared_goal_service.propagate_achievement(); write all linked achievement rows atomically; test with the concurrent-update integration test scenario |
| R-02 | Quarterly window enforcement is frontend-only; judge bypasses via Postman | H | H | HIGH | Backend validation in achievement_service is mandatory (Phase 1 acceptance criterion); add to manual Postman test checklist 2 hours before judging |
| R-03 | Render free tier spins down after inactivity; backend cold starts during demo | H | H | HIGH | Use Render's "keep-alive" ping (free); alternatively, open the health endpoint in a background tab 10 minutes before demo; use UptimeRobot free tier to ping every 5 minutes |
| R-04 | Anthropic API call fails or times out during demo (live judge viewing) | M | H | HIGH | Pre-cache all demo scenario responses in the ai_service cache before the demo (run the demo script once in the morning to populate cache); show judges the cache hit in the Cost Dashboard |
| R-05 | UoM formula incorrectly implemented — especially Max type (teams often flip numerator/denominator) | M | H | HIGH | Dedicated unit test for all four formula types with known inputs and expected outputs; formula tooltip in UI lets judges visually verify the math |
| R-06 | Double-submit creates duplicate goal records or duplicate achievements | M | H | HIGH | Submit button disabled on first click (React state); backend uses unique constraint on (goal_sheet_id, quarter) for achievements; PATCH idempotency via version check |
| R-07 | D3.js Org Tree renders incorrectly on the demo laptop's browser/resolution | M | M | MEDIUM | Test the tree on the exact browser and screen resolution that will be used for demo; make the tree fullscreen-responsive; use a fixed viewport width as a fallback |
| R-08 | PDF generation (jsPDF) produces poorly formatted output | M | M | MEDIUM | Allocate 2 hours specifically to PDF layout styling; use a fixed-width template; test with real seed data before demo day |
| R-09 | Time runs out before Phase 4 (wow features) is complete | M | M | MEDIUM | Phase prioritization is designed so P0 and P1 features in Phases 1–3 already satisfy all judging criteria; Phase 4 features add score but are not required to avoid failure |
| R-10 | Optimistic locking version mismatch in manager approval during demo | L | M | MEDIUM | Demo script has only one person acting as manager at a time; seed data is designed to avoid concurrent sessions; acceptable to acknowledge this edge case verbally if asked |
| R-11 | Supabase free tier 500MB storage limit exceeded during extended demo | L | L | LOW | Demo data is minimal (dozens of rows); no binary uploads except PDFs (stored locally or in Supabase Storage with 1GB limit); not a realistic risk |
| R-12 | GitHub Actions CI/CD takes too long and blocks deployment during crunch time | L | M | LOW | Keep test suite fast (mock external services); set a 5-minute timeout; if CI blocks, manually trigger Render/Vercel deploy from dashboard |
| R-13 | Azure AD SSO attempted and fails silently | L if skipped | H if attempted | LOW (by avoidance) | Do not implement Azure AD SSO. Strategy doc is explicit: skip it. Standard JWT auth handles the demo. OIDC middleware present for post-hackathon mention. |
| R-14 | WebSocket / real-time implementation breaks and causes demo instability | L if avoided | H if attempted | LOW (by avoidance) | Do not use WebSockets. Use React Query polling (refetchInterval: 30000ms) for the completion dashboard. More reliable for demo environments. |

---
## 11. DEMO & PRESENTATION STRATEGY

The 12-minute demo is the single highest-leverage moment. Every second is scripted and rehearsed. The structure below is derived directly from the strategy doc (SD §13) and mapped to the judging criteria from the problem statement (PS §6).

---

### 11.1 Pre-Demo Checklist (30 minutes before judging)

- Run the seed reset button: confirm 3 demo users and clean demo data in under 30 seconds
- Open the /health endpoint in a browser tab: confirm {"status":"ok","db":"connected","ai":"operational"}
- Run through the complete demo script once: confirm no errors
- Open the Render dashboard: confirm backend is awake (not in sleep state)
- Have the following tabs pre-opened in the demo browser: GoalPulse app (Employee role), Cost Dashboard, Org Alignment Tree
- Confirm the demo laptop screen resolution matches the resolution you tested at
- Have demo credentials written down: employee@goalpulse.com / manager@goalpulse.com / admin@goalpulse.com

---

### 11.2 Demo Script (12 Minutes)

**Minutes 0–1: The Problem (Verbal Setup)**

Do not show slides. Speak directly: "Imagine you're an HR manager at a 500-person company. It's April. You need to run performance appraisals. You have spreadsheets from 12 managers, half outdated. Nobody tracked Q2 check-ins properly. That's what GoalPulse eliminates — let me show you."

Open GoalPulse. Role context banner shows: "Viewing as: Employee."

*Criterion addressed: Criterion 1 (Functionality) — framing creates expectations that the system will then demonstrably meet.*

---

**Minutes 1–4: Employee Journey (Goal Creation)**

1. Click "Create New Goal." Goal Creation Wizard opens (Step 1).
2. Select Thrust Area "Revenue Growth." Enter goal title: "Increase Q3 Inbound Pipeline to $2M." Enter description.
3. Say: "Watch what happens as I type." — Pause typing for 1.5 seconds. AI Goal Coach panel activates on the right, showing SMART scores. Point out a specific low score (e.g., "Specific: 6/10 — try adding a specific channel or method").
4. Adjust the description based on the suggestion. AI Coach updates. Say: "The AI coach helps employees write better goals before they're even submitted — catching the problem at source."
5. Proceed to Step 2. Select UoM: Numeric (Min). Enter Target: 2000000. Enter Weightage: 40%.
6. Add a second goal. Weightage counter shows "60% remaining" in real time. Add 40% weightage.
7. Say: "Watch what happens when I try to submit with only 80% allocated" — set second goal to 20%, hit Submit. "Total weightage must equal 100%." Say: "The system enforces all BRD rules here." Correct to 60%. Submit.

*Criterion addressed: Criterion 1 (Functionality), Criterion 2 (BRD Adherence — validation rules firing), Criterion 3 (User Friendliness), Criterion 5 (AI Goal Coach)*

---

**Minutes 4–6: Manager Journey (Approval)**

1. Click role switcher ? Manager. Team Dashboard appears. Pending approval badge visible.
2. Click the employee row. Goal sheet opens in side drawer.
3. Say: "I can edit targets or weightages inline before approving." Adjust target value. Say: "This edit is logged in the audit trail."
4. Click "Approve." Confirmation dialog: "This will lock all 2 goals and notify the employee." Click Confirm.
5. Switch back to Employee. Goal Sheet View shows padlock icon. All fields read-only.
6. Say: "Goals are now locked. No employee can edit them. Only admin can unlock with a logged reason."

*Criterion addressed: Criterion 1 (Functionality — complete approval flow), Criterion 2 (BRD Adherence — locking), Criterion 4 (No bugs — confirmation dialogs)*

---

**Minutes 6–8: Check-in Journey (Employee Q1 Actuals)**

1. Remain as Employee. Click "Q1 Check-in."
2. For Goal 1: Enter Actual: 1500000. Status: On Track. Computed score appears inline: "1,500,000 ÷ 2,000,000 = 75.0%"
3. Hover over the score. Tooltip: "Min UoM: Achievement ÷ Target = 75.0%." Say: "Judges can verify the formula right here — no black box."
4. Submit Q1 actuals.

*Criterion addressed: Criterion 1 (Functionality), Criterion 2 (BRD Adherence — all four UoM formulas visible), Criterion 3 (formula tooltips), Criterion 4 (predictable computation)*

---

**Minutes 8–10: Manager Check-in with AI Copilot (Emotional Peak)**

1. Switch to Manager. Open Manager Check-in screen. Select the employee.
2. Planned vs. Actual table visible side by side.
3. Say: "Most managers write 'good progress' or nothing. Watch this." Click "Generate AI Comment."
4. Loading state appears briefly. Then text streams token-by-token into the textarea. Let it complete.
5. Read one sentence aloud. Say: "The manager can edit it — the AI is an assistant, never an authority." Edit one word.
6. Click Submit Check-in.
7. Say: "We don't just track goals — we improve how managers give feedback. That's a genuine product differentiation."

*Criterion addressed: Criterion 1 (Functionality), Criterion 3 (User Friendliness), Criterion 5 (AI Check-in Copilot — deepest AI feature)*

---

**Minutes 10–11: Org Alignment Tree (The Wow Moment)**

1. Switch to Admin. Click "Org Alignment" in the nav.
2. Full-screen D3 tree animates in. Nodes are color-coded. Say: "Every employee, their current achievement percentage, color-coded across the org."
3. Click one red node (low achievement). Side drawer opens with their goal sheet summary.
4. Say: "Managers cannot monitor team progress in real time — that was the problem statement. This is the answer."

*Criterion addressed: Criterion 1 (Functionality), Criterion 3 (User Friendliness — the visual magnet), Criterion 5 (bonus feature depth)*

---

**Minutes 11–12: Cost Dashboard (The Close)**

1. Navigate to Cost Dashboard in admin.
2. Show: "AI calls this week: 47. Estimated cost: $0.12. Cache hit rate: 63%. Projected at 100 users/month: $2.40."
3. Show infrastructure table: Vercel $0. Render $0. Supabase $0. Total: approximately $0.50 in AI calls for this entire demo.
4. Final line: "GoalPulse replaces $15-per-user-per-month OKR tools with approximately $0.02 per user per month. Thank you."

*Criterion addressed: Criterion 6 (Cost Optimisation — explicit, memorable, evidence-based)*

---

### 11.3 Psychological Hooks (From Strategy Doc)

| Hook | When | Effect |
|---|---|---|
| "Watch what happens as I type" (before AI Coach fires) | Minute 2 | Creates anticipation; primes judges to pay attention |
| Deliberately trigger the 100% weightage error | Minute 3 | Turns a guardrail into an offense story: "we designed for failure" |
| Streaming token-by-token AI comment | Minute 9 | Visceral AI presence; static responses do not have this effect |
| "I can edit it — the AI is an assistant, never an authority" | Minute 9 | Preempts the "what if AI gives bad output" judge question |
| Clicking a node on the Org Tree | Minute 10 | Creates an interactive moment judges participate in |
| The "$2.40 per month" close | Minute 12 | Single most memorable fact; forces comparison to complexity witnessed |

---

### 11.4 Handling Difficult Judge Questions

**"How would this handle 10,000 employees?"**
"The architecture already supports it — all computation uses DB-side SQL aggregation rather than in-memory processing. The backend is stateless, so horizontal scaling is a Render configuration change. AI API rate limits at that scale would be addressed with a request queue and Anthropic's Batch API for 50% cost reduction."

**"Is the AI actually calling a real LLM?"**
"Yes — I can open the browser network tab and show you the API call response in real time." (Be ready to do this. Have DevTools pre-positioned.)

**"Why not Azure AD SSO?"**
"We prioritized depth on core BRD features and high-value AI experiences. The escalation module and analytics are significantly more impactful for the core use case. Azure AD integration is a one-sprint addition — we've implemented standard OIDC middleware that accepts any identity provider."

**"What if the AI generates a bad check-in comment?"**
"All AI outputs are fully editable. The system treats AI as an assistant, never an authority. The manager reviews and edits every generated comment before submitting. The goal quality score is advisory — it doesn't block submission."

**"The shared goal sync seems complex — did you handle concurrent updates?"**
"Yes — the propagation runs in a single database transaction. Same achievement value written twice produces the same result: idempotent. We have an integration test specifically for the concurrent-update scenario."

---
## 12. OPEN QUESTIONS & ASSUMPTIONS

All ambiguities in either source document are catalogued here. Items marked **FLAG** are contradictions between the strategy doc and problem statement. Items marked **ASSUMPTION** are decisions made in the absence of specification.

---

### 12.1 Contradictions Between Documents (FLAG)

**FLAG-01: UoM Type Naming Discrepancy**

The problem statement (PS §2.2) labels the four UoM types as: Numeric, %, Timeline, and Zero-based, and defines Min as "higher is better" and Max as "lower is better." The strategy doc (SD §2, Criterion 2) uses the same Min/Max terminology. However, the PS UoM table does not use the terms "Min" and "Max" as enum values — it uses "Min (Numeric / %)" and "Max (Numeric / %)" as descriptive labels. It is ambiguous whether Numeric and % are separate UoM types sharing the Min/Max distinction, or whether Min and Max are the actual UoM enum values with Numeric/% as sub-types.

**Decision required before implementation:** Clarify whether the UoM selector in the goal creation form should show: (a) four options: Min, Max, Timeline, Zero — or (b) four options: Numeric (Min), Percentage (Min), Timeline, Zero-based — or (c) five options separating Numeric-Min, Numeric-Max, Percentage-Min, Percentage-Max, Timeline, Zero. The implementation plan assumes option (a): the enum has values MIN, MAX, TIMELINE, ZERO, where MIN and MAX each accept either a raw number or a percentage as the target, and the UI labels them "Higher is Better (Min)" and "Lower is Better (Max)."

---

**FLAG-02: Check-in Status Options**

The problem statement (PS §2.2) lists three status options: "Not Started / On Track / Completed." The strategy doc (SD §2, Criterion 2) adds a fourth: "At Risk" (used for color-coding in the UI). The PS does not mention "At Risk" as a valid status selection. If "At Risk" is added to the status enum, it may be flagged as a BRD deviation by judges who read the PS literally.

**Decision required:** Either restrict status to the PS's three values (Not Started, On Track, Completed) and use "At Risk" only as a derived display flag in manager views — or add "At Risk" as a fourth status and be prepared to defend it as a UX enhancement. The implementation plan assumes the former: the stored status enum has exactly three values per PS, and "At Risk" is derived in the analytics/manager dashboard from the computed progress score being below 50% for the current quarter.

---

### 12.2 Ambiguities in the Problem Statement (ASSUMPTION)

**ASSUMPTION-01: Thrust Area Values**
The problem statement requires employees to "Select a Thrust Area" but does not define the list of valid thrust areas. The implementation assumes thrust areas are configurable by Admin (a simple CRUD in the admin panel) and pre-seeded with common enterprise categories: Revenue Growth, Customer Satisfaction, Operational Efficiency, People Development, Innovation, Compliance & Risk. This is consistent with the strategy doc's references to "thrust area distribution" in analytics.

**ASSUMPTION-02: Manager Scope — Who Is "L1 Manager"**
The PS (§3) refers to "Manager (L1)" but does not define how the manager-employee relationship is stored or resolved when Azure AD is not used. The implementation assumes the users.manager_id self-referential FK defines the L1 relationship, configured by Admin during user setup (or populated by the seed script). The /api/v1/goal-sheets/team endpoint returns goal sheets where goal_sheets.employee_id is any user whose manager_id matches the requesting user's id.

**ASSUMPTION-03: Quarterly Window Dates**
The PS (§2.3) states check-in windows open in "July," "October," "January," "March/April" but does not specify exact dates or durations. The implementation assumes: Admin configures exact open/close dates per quarter in the Cycle Management panel. The seed data uses: Q1 opens July 1, closes July 31; Q2 opens October 1, closes October 31; Q3 opens January 1, closes January 31; Q4 opens March 1, closes April 30. These are configurable and not hardcoded.

**ASSUMPTION-04: "Primary Owner" for Shared Goals**
The PS (§2.1) states "Achievement updates by the primary owner sync across all linked goal sheets" but does not define how the primary owner is designated. The implementation assumes the primary owner is the employee explicitly designated by the admin or manager when creating the shared goal (the primary_owner_id field in shared_goals). All other recipients receive a linked goal where they enter their own data passively — they cannot log achievement for the shared goal; only the primary owner can.

**ASSUMPTION-05: What "Sync" Means for Shared Goal Achievement**
The PS (§2.1) says "Achievement updates by the primary owner sync across all linked goal sheets." It is ambiguous whether this means (a) the actual_value and computed_score propagate to all linked employees, effectively making their achievement identical to the primary owner's — or (b) the primary owner's achievement is displayed as a reference alongside each linked employee's own independent achievement. The implementation assumes option (a): full propagation, so all linked employees show the same actual_value and computed_score for the shared goal. This is the interpretation that makes the sync mechanism meaningful and technically demonstrable.

**ASSUMPTION-06: Goal Sheet Scope (One per Cycle)**
The PS does not state whether an employee can have multiple goal sheets per cycle (e.g., one per department or project). The implementation assumes one goal sheet per employee per cycle, matching the strategy doc's model and the 100% weightage constraint (which only makes sense across a single sheet).

**ASSUMPTION-07: "Achievement Report" Scope**
The PS (§4) says the Achievement Report should show "Planned Target vs. Actual Achievement for all employees." It does not specify: (a) which quarter(s) to include, (b) whether to include intermediate quarters or only year-end, (c) whether to break out by quarter or show only the latest. The implementation provides a quarter filter parameter on the export endpoint, defaulting to the most recently closed quarter. The Excel export includes one sheet per quarter when no quarter filter is specified.

**ASSUMPTION-08: Escalation Notification Channel**
The PS (§5.3) mentions escalation notifications but the strategy doc recommends mocking email with toast notifications. The implementation will use in-app toast notifications and escalation_events log entries as the notification mechanism. Email notifications will be labelled "Email notification sent (mock)" in the UI. This is explicitly disclosed in the README and during demo if asked.

**ASSUMPTION-09: "Completion Dashboard" Definition of "Completed"**
The PS (§4) requires a "real-time view of which employees and managers have completed quarterly check-ins." For employees, "completed" = submitted actuals for the quarter (goal_achievements rows exist for all goals in that quarter). For managers, "completed" = submitted a check_in comment for each of their direct reports for the quarter (check_ins rows exist for each employee-quarter pair). These definitions are used in all completion rate calculations.

**ASSUMPTION-10: PDF Performance Summary Trigger**
The strategy doc (SD §6, Innovation 6) describes a "one-click Generate Performance Summary" but does not specify when in the cycle this is available. The implementation makes it available at any time to the employee (for their own data) and to admin (for any employee), but the AI narrative quality is highest when full-year data (all four quarters) is available. The UI shows a banner when fewer than 4 quarters of actuals are present: "Performance summary is most accurate with full-year data. You currently have Q1–Q2 actuals."

---

### 12.3 Decisions Made (No Document Reference — Team Discretion)

| Decision | Rationale |
|---|---|
| Product name: GoalPulse | Recommended by strategy doc (SD §4); communicates real-time rhythm |
| Skip Azure AD SSO | Explicitly recommended by strategy doc; high demo-environment risk |
| Skip WebSockets; use React Query polling | Strategy doc explicitly warns against WebSockets (SD §14); polling is more reliable |
| Skip Teams bot; show static mockup | Strategy doc recommends mocking; live Teams bot adds demo-environment failure risk |
| Skip email notifications; use toast mocks | Same reasoning; strategy doc explicit on this |
| Use jsPDF (client-side PDF) over server-side | Avoids Supabase Storage dependency for demo; simpler; faster |
| Demo uses 3 named accounts (not anonymous) | PS §8 requires "login credentials of the 3 roles"; named accounts are cleaner than toggles |
| Role context switcher built into UI header | Strategy doc recommends this for demo convenience; clearly labelled as demo feature |

---

## APPENDIX: Feature Priority Quick Reference

| Priority | Features |
|---|---|
| P0 (Must-have; demo fails without) | F-01 Goal Creation Wizard, F-02 Manager Approval, F-03 Employee Check-in, F-04 Manager Check-in, F-05 Shared Goals |
| P1 (High impact; demo weaker without) | F-06 Audit Trail, F-07 Achievement Report, F-08 Completion Dashboard, F-09 AI Goal Coach, F-10 Analytics Module |
| P2 (Wow factor; builds on solid P0/P1 foundation) | F-11 Escalation Module, F-12 Org Alignment Tree, F-13 Natural Language Search, F-14 Performance PDF, F-15 Cost Dashboard, F-16 BRD Checklist |

---

## APPENDIX: Submission Deliverables Checklist

Per PS §8:
- [ ] Live/hosted demo URL (Vercel frontend + Render backend)
- [ ] Source code repository (GitHub; main branch; CI/CD badge in README)
- [ ] Architecture diagram (the text diagram in Section 3.2 of this document, exported as PNG for the README and PDF submission)
- [ ] Login credentials: employee@goalpulse.com / manager@goalpulse.com / admin@goalpulse.com (all with the same password, documented in README)

Additional deliverables per strategy doc:
- [ ] /health endpoint returning JSON status
- [ ] OpenAPI/Swagger docs at /docs
- [ ] Seed reset button tested and working
- [ ] README with setup instructions, environment variable guide, and demo script

---

*This implementation plan was produced by cross-referencing AtomQuest_1.0_Winning_Strategy.md and AtomQuest_Hackathon_1.0_Problem_Statement.md in their entirety. Every section is traceable to one or both source documents. No generic boilerplate has been included. Decisions not explicitly specified in either source are documented as ASSUMPTION items in Section 12.*
