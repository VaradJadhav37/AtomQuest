# GoalKeeper Video Demo — Quick Reference Cheat Sheet
## One-Page Guide for Recording

---

## DEMO CREDENTIALS

| Role | Email | Password |
|------|-------|----------|
| **Employee** | `employee@goalkeeper.com` | `Demo@1234` |
| **Manager** | `manager@goalkeeper.com` | `Demo@1234` |
| **Admin** | `admin@goalkeeper.com` | `Demo@1234` |

---

## SCENE-BY-SCENE CHECKLIST

### ✓ SCENE 1: INTRO (0:00 – 0:20)
- [ ] Show title slide
- [ ] Introduce problem: "Fragmented goal tracking"
- [ ] Introduce solution: "Three workflows: Create → Approve → Review"

### ✓ SCENE 2: LOGIN (0:20 – 0:40)
- [ ] Navigate to login page
- [ ] Display demo credentials (on-screen graphic)
- [ ] **Call-out:** "Role-based access control with JWT"

### ✓ SCENE 3: EMPLOYEE JOURNEY (0:40 – 2:15)

#### Part 3A: Dashboard (0:40 – 1:00)
- [ ] Login as employee
- [ ] Dashboard shows: Current cycle, deadline, action needed
- [ ] **Call-out:** "User-friendly guidance [EVAL: User Friendliness]"

#### Part 3B: Goal Wizard (1:00 – 1:45)
- [ ] Click "Create Goals"
- [ ] Add 3 goals:
  1. Pipeline ($1.2M, 40%, Numeric)
  2. Retention (96%, 35%, Percentage)
  3. Training (0, 25%, Zero)
- [ ] **Point to weightage counter:** "40% → 75% → 100%"
- [ ] **Call-out:** "Real-time validation prevents errors [EVAL: BRD Adherence]"
- [ ] Show submit button transitions to ENABLED (green)

#### Part 3C: Validation Test (1:45 – 2:00)
- [ ] Try to add 4th goal with 15%
- [ ] Show error: "Total would be 115%. Maximum 100%."
- [ ] **Call-out:** "Robust edge-case handling [EVAL: Presence of Bugs]"

#### Part 3D: Submit & Lock (2:00 – 2:15)
- [ ] Click "Submit for Approval"
- [ ] Status changes to "PENDING_APPROVAL"
- [ ] **Call-out:** "Goals now locked until manager approval [EVAL: BRD 2.1]"

---

### ✓ SCENE 4: MANAGER JOURNEY (2:15 – 4:30)

#### Part 4A: Dashboard (2:15 – 2:35)
- [ ] Logout; login as manager
- [ ] Show: Pending Approvals (3), Check-ins Complete (2/3)
- [ ] **Call-out:** "Single-pane-of-glass visibility [EVAL: User Friendliness]"

#### Part 4B: Approval (2:35 – 3:15)
- [ ] Click "Eric Employee" card
- [ ] Show 3 goals with targets & weightage
- [ ] **Explain inline editing capability**
- [ ] Click "Approve All Goals"
- [ ] Confirmation dialog
- [ ] **Call-out:** "Audit logged automatically; goal locking enforced [EVAL: BRD 2.1]"

#### Part 4C: Check-in (3:15 – 4:10)
- [ ] Navigate to "Check-ins" (simulated Q1 window open)
- [ ] Show "Planned vs. Actual" layout
  - Goal 1: 1.2M → 950K = **79%** (Numeric formula: actual ÷ target)
  - Goal 2: 96% → 94% = **98%** (Percentage formula)
  - Goal 3: 0 → 0 = **100%** (Zero formula: if 0 → 100%)
- [ ] **Call-out:** "All 4 UoM formulas implemented [EVAL: BRD 2.2]"
- [ ] Show status badges: 🟡 ON_TRACK, ✅ COMPLETED, ✅ COMPLETED

#### Part 4D: AI Copilot (4:10 – 4:30)
- [ ] Click "Generate Check-in Comment"
- [ ] Show AI-generated feedback
- [ ] Manager can edit or accept
- [ ] **Call-out:** "AI improves feedback quality without replacing manager judgment [EVAL: Good-to-Have Feature]"
- [ ] Submit check-in

---

### ✓ SCENE 5: ADMIN JOURNEY (4:30 – 6:15)

#### Part 5A: Executive Dashboard (4:30 – 4:50)
- [ ] Login as admin
- [ ] Show: Completion (92%), Check-ins (88%), Avg Score (87%), At-Risk (5)
- [ ] **Call-out:** "Org-wide visibility solving problem statement [EVAL: User Friendliness]"

#### Part 5B: Risk Alerts (4:50 – 5:20)
- [ ] Show Completion Dashboard
- [ ] Highlight Ravi Menon: DRAFT, 12 days no login
- [ ] Navigate to Risk Alerts
- [ ] Show escalation rule: Email sent Day 7 → HR escalation Day 14
- [ ] **Call-out:** "Predictive risk engine, not reactive [EVAL: Good-to-Have Feature - Escalation]"

#### Part 5C: Analytics (5:20 – 6:00)
- [ ] Navigate to Analytics
- [ ] Show QoQ trend: Q4 (78%) → Q1 (87%)
- [ ] Show thrust-area heatmap (Revenue Growth 91%, Innovation 72%)
- [ ] Navigate to Reports; show CSV/Excel export
- [ ] **Call-out:** "BRD Section 5.4 Good-to-Have Features implemented [EVAL: Good-to-Have]"

#### Part 5D: Audit Trail (6:00 – 6:30)
- [ ] Navigate to Audit Trail
- [ ] Show timeline: Created → Submitted → Approved → Check-in → Locked
- [ ] Click entry → show JSON detail (before/after values)
- [ ] **Call-out:** "Immutable compliance log for governance [EVAL: BRD #4]"

#### Part 5E: Cost Dashboard (6:30 – 6:50)
- [ ] Navigate to Cost Dashboard
- [ ] Show: Vercel (free), Render (free), Supabase (free), Groq ($2–5)
- [ ] **Explain:** Caching strategy (95% hit rate), bulk queries, CDN
- [ ] **Total:** $2–5/month at 500 users
- [ ] **Call-out:** "Architecturally optimized for efficiency [EVAL: Cost Optimisation]"

---

### ✓ SCENE 6: VALIDATION DEMO (6:50 – 7:00)
- [ ] Try invalid weightage → error appears
- [ ] Try to edit locked goal → read-only
- [ ] Try double-click approve → button disabled
- [ ] **Call-out:** "Zero crashes; graceful error handling [EVAL: Presence of Bugs]"

---

### ✓ SCENE 7: OUTRO (7:00 – 7:15)
- [ ] Summarize 6 evaluation criteria
- [ ] Mention tech stack: React, Node, Supabase, Groq
- [ ] Thank viewers

---

## EVALUATION CRITERIA MAPPING

| Criterion | Demo Points | Timing |
|-----------|-------------|--------|
| **#1 Functionality** | Complete workflows (all 3 roles) | 0:40 – 4:30 |
| **#2 BRD Adherence** | Weightage validation, UoM formulas, approval, locking, windows | Throughout |
| **#3 User Friendliness** | Dashboards, real-time counters, contextual guidance, color badges | Throughout |
| **#4 Presence of Bugs** | Validation test, edge cases, no double-submits, lock state | 1:45–2:00, 6:50–7:00 |
| **#5 Good-to-Have** | AI Copilot (4:10), Analytics (5:20), Escalation (4:50), Audit (6:00) | 4:10 – 6:30 |
| **#6 Cost Optimisation** | Cost dashboard, caching, bulk queries, free-tier architecture | 6:30 – 6:50 |

---

## KEY CALLOUTS TO MAKE

**BRD Alignment:**
- [ ] "This is Phase 1 requirement 2.1: Goal creation with validation"
- [ ] "This is Phase 2 requirement 2.2: Achievement tracking with all 4 UoM formulas"
- [ ] "This is good-to-have feature 5.4: Analytics with QoQ trends and heatmaps"

**Problem Solving:**
- [ ] "The problem statement: managers can't see team progress in real time"
- [ ] "GoalPulse solves this with dashboards and real-time updates"
- [ ] "Employees now have clarity on cycle timing and deadlines"

**Technical Excellence:**
- [ ] "Robust validation prevents silent failures"
- [ ] "Audit trail ensures compliance and governance"
- [ ] "AI layer enhances without replacing human judgment"
- [ ] "Scalable architecture at minimal cost"

---

## RECORD WITH:

- **Resolution:** 1920x1080 (Full HD)
- **Frame Rate:** 30 fps
- **Cursor Speed:** Slow (let viewers follow your clicks)
- **Pacing:** Conversational; pause after actions
- **Audio:** Clear; no background noise

---

## POST-PRODUCTION ADD:

- [ ] Title card (GoalPulse + tagline)
- [ ] Evaluation criteria tags overlaid at each section
- [ ] On-screen text for demo credentials (not spoken)
- [ ] BRD requirement tags ("✓ BRD 2.1", etc.)
- [ ] Background music (royalty-free, instrumental, low volume)
- [ ] Timing counter (optional)
- [ ] End card with team name, GitHub link, deployment URL

---

## TIMING CHEAT SHEET (Keep Running Total)

| Time | Event |
|------|-------|
| 0:00 | Intro starts |
| 0:20 | Login page |
| 0:40 | Employee dashboard |
| 1:00 | Goal wizard (Goal 1) |
| 1:15 | Goal wizard (Goal 2) |
| 1:30 | Goal wizard (Goal 3) |
| 1:45 | Validation test (4th goal rejected) |
| 2:00 | Submit & lock |
| 2:15 | Manager dashboard |
| 2:35 | Goal approval |
| 3:15 | Check-in entry |
| 4:10 | AI Copilot |
| 4:30 | Admin dashboard |
| 4:50 | Risk alerts |
| 5:20 | Analytics |
| 6:00 | Audit trail |
| 6:30 | Cost dashboard |
| 6:50 | Validation demo |
| 7:00 | Outro |

**Target: 7:00 exactly (aim for 6:50 – 7:10 range)**

---

**Ready to record! Follow this sheet, hit each section, make the callouts, and you'll have a compelling, evaluation-aligned demo. GoalKeeper is ready for judges!**
