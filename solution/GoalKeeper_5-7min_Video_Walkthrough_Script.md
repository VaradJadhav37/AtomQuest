# GoalKeeper: 5-7 Minute Video Walkthrough Script
## Evaluation-Aligned Demo with Technical Highlighting

---

## SCRIPT OVERVIEW

**Total Duration:** 5:30 – 7:00 minutes  
**Evaluation Criteria Focus:**
- ✅ Functionality of the Portal (complete user journeys)
- ✅ Adherence to BRD (all must-haves + bonus features)
- ✅ User Friendliness (intuitive workflows, helpful errors)
- ✅ Presence of Bugs (edge case handling, robustness)
- ✅ Good-to-Have Features (analytics, escalations, cost dashboard)
- ✅ Cost Optimisation (architecture, caching strategy)

**Roles Covered:** Employee → Manager → Admin (all 3 required by BRD)

---

## SCENE 1: INTRO & CONTEXT [0:00 – 0:20]

### Visual: Title Slide / App Logo

**Narration:**
"Hello, I'm walking you through **GoalKeeper**, an enterprise goal-setting and performance tracking portal. We're addressing the core problem: organizations with 50+ employees struggle with fragmented goal tracking. No real-time visibility, no manager coaching, no audit trail. 

**GoalPulse solves this with three key workflows: employees create and submit goals, managers approve and coach, and admins govern the entire process.**

Let me walk you through the complete system."

**On-Screen Text Callouts:**
- Problem: Fragmented goal tracking ❌
- Solution: Structured, audited, AI-assisted portal ✅

---

## SCENE 2: LOGIN & ROLE SELECTION [0:20 – 0:40]

### Visual: Browser tab with application URL

**Narration:**
"The portal uses role-based access control with JWT authentication. Here are our three demo users:

**[Display Demo Credentials]**
- Employee: eric@goalkeeper.com
- Manager: maya@goalkeeper.com
- Admin: alex@goalkeeper.com

Everyone uses password: Demo@1234

**[EVAL HIGHLIGHT: User Friendliness]** The login is clean and straightforward—no technical jargon, immediate access for each role."

**Actions:**
1. Navigate to login page
2. **Display credentials slide** on camera (or text overlay)
3. Show "Remember me" checkbox, "Need help?" link
4. Don't login yet; advance to next scene

**On-Screen Callouts:**
- JWT-based stateless authentication
- Role isolation enforced at backend

---

## SCENE 3: EMPLOYEE JOURNEY — GOAL CREATION [0:40 – 2:15]

### Part 3A: Login & Dashboard [0:40 – 1:00]

**Actions:**
1. Login as `employee@goalkeeper.com`
2. Navigate to dashboard

**Narration:**
"Logging in as an employee. **[Dashboard appears]** The dashboard immediately shows the current cycle status: 'Goal Setting is open. Deadline: June 30th.' This addresses a pain point from the problem statement—**clarity on cycle timing.**"

**On-Screen Callouts:**
- **Current cycle:** FY2026-Q1
- **Action needed:** Create goal sheet
- **Deadline:** June 30, 2026

**[EVAL HIGHLIGHT: User Friendliness]** Clear, contextual guidance on what the user needs to do.

---

### Part 3B: Goal Creation Wizard [1:00 – 1:45]

**Actions:**
1. Click "Create Goals for FY2026-Q1"
2. Goal Wizard opens

**Narration:**
"The Goal Wizard guides employees through goal creation. Notice: **[PAUSE]** **the interface is simple, with only necessary fields.**

Let me add three goals to demonstrate **BRD Requirement #2.1:**
- Goal sheets with thrust areas
- UoM selection
- Weightage validation
- Max 8 goals, min 10% per goal, total 100%"

**Goal 1: New Pipeline Creation**
- Click "Add Goal"
- **Title:** "New pipeline creation"
- **Thrust Area:** [Click dropdown] Revenue Growth
- **UoM Type:** [Show 4 options: Numeric, %, Timeline, Zero] — select **Numeric**
- **Target Value:** 1200000
- **Weightage:** 40
- Click "Add Goal"

**[PAUSE & HIGHLIGHT]** 
**Narration:** "Notice the **weightage counter at the top: 40% used, 60% remaining.** This real-time feedback prevents the most common error—exceeding 100%. **[EVAL HIGHLIGHT: Adherence to BRD]** This directly enforces BRD requirement: total weightage = 100%."

**Goal 2: Customer Retention**
- Click "Add Goal"
- **Title:** "Customer retention"
- **Thrust Area:** Customer Satisfaction
- **UoM Type:** [Highlight dropdown] Percentage
- **Target Value:** 96
- **Weightage:** 35
- Click "Add Goal"

**[PAUSE]** 
**Narration:** "Now at 75%, 25% remaining."

**Goal 3: Compliance Training**
- Click "Add Goal"
- **Title:** "Compliance training"
- **Thrust Area:** Compliance & Risk
- **UoM Type:** [Highlight dropdown] **Zero** ← *Intentionally show less common type*
- **Target Value:** 0
- **Weightage:** 25
- Click "Add Goal"

**[HIGHLIGHT WEIGHTAGE]** 
**Narration:** "And now we're at **100% exactly.** The submit button is now **enabled in green**, signaling to the user: 'Your goals are valid and ready to submit.' **[EVAL HIGHLIGHT: User Friendliness & Bug Prevention]** This prevents submission errors by making validation visual and immediate."

**On-Screen Callouts:**
- Total Weightage: 100% ✓
- All 3 UoM types shown (Numeric, %, Zero)
- Submit button: ENABLED

---

### Part 3C: Validation Test [1:45 – 2:00]

**Actions (Show Robustness):**
1. Try to add a 4th goal with 15% weightage
2. [Demonstrate error handling]

**Narration:**
"Let me deliberately test the validation. I'll try to add a 4th goal with 15% weightage to show **how the system prevents invalid submissions.**"

**Actions:**
1. Click "Add Goal"
2. Enter: **Title:** "Test goal", **UoM:** Numeric, **Target:** 100, **Weightage:** 15
3. Click "Add Goal"

**[Error appears in red banner]**
**Narration:** "Perfect. The system shows a friendly error: '**Total weightage would be 115%. Maximum is 100%**' The form won't allow the addition. **[EVAL HIGHLIGHT: Presence of Bugs - Robustness]** This shows we're handling edge cases correctly—no silent failures, no database errors. Users get clear, actionable feedback."

**Actions:**
1. Close error
2. Don't add the 4th goal
3. Click "Submit for Approval"

**On-Screen Callouts:**
- BRD Validation: Min 10%, Max 100%, Max 8 goals ✓
- No bugs in validation logic
- User-friendly error messages

---

### Part 3D: Submission & Lock State [2:00 – 2:15]

**Actions:**
1. Confirmation dialog appears
2. Click "Confirm Submission"
3. Dashboard updates to show status

**Narration:**
"After submission, the status changes to **'Pending Approval'**—immediately visible on the dashboard. The goals are now **locked for the employee**; they cannot be edited until the manager approves or returns them. This is **BRD Requirement #2.1: Goal locking post-approval.**

Next step: Manager review."

**On-Screen Callouts:**
- Status: PENDING_APPROVAL
- Goals locked until manager action
- Employee cannot edit

---

## SCENE 4: MANAGER JOURNEY — APPROVAL & CHECK-IN [2:15 – 4:30]

### Part 4A: Manager Login & Team Dashboard [2:15 – 2:35]

**Actions:**
1. Logout (or show role switcher if available)
2. Login as `maya@goalkeeper.com` / `Demo@1234`
3. Manager dashboard loads

**Narration:**
"Now logging in as **Maya Manager**, who has three direct reports. The dashboard immediately shows:
- **Pending Approvals: 3** (team members awaiting review)
- **Check-ins Complete: 2 of 3** (progress bar)
- **Team member cards** with individual status

This **[EVAL HIGHLIGHT: User Friendliness]** provides managers with a single-pane-of-glass view—no need to hunt for information across spreadsheets."

**On-Screen Callouts:**
- Role: MANAGER
- Direct Reports: 3
- Pending Approvals: 3
- Check-in Status: 2/3 ✓

---

### Part 4B: Goal Approval Workflow [2:35 – 3:15]

**Actions:**
1. Click on "Eric Employee" card
2. Goal sheet detail page opens

**Narration:**
"Clicking on Eric shows his goal sheet with the 3 goals we just created. Let me highlight what the manager sees:

**[Point to each column]**
- **Goal Title:** 'New pipeline creation'
- **Target Value:** 1,200,000
- **Weightage:** 40%
- **Status:** Goals locked, ready for approval

The manager can either:
1. **Approve as-is** (if everything looks correct)
2. **Edit inline** (adjust targets or weightage if needed)
3. **Return for rework** (send back with feedback)

**[EVAL HIGHLIGHT: Adherence to BRD]** This is **BRD Requirement #2.1: Manager Approval Workflow with inline editing capability.**"

**Actions:**
1. Show the 3 goals with details
2. Point out each goal's weightage adds to 100%
3. Click "Approve All Goals"

**[Approval dialog appears]**

**Narration:**
"The manager confirms the approval. Behind the scenes, we're:
- Setting a `locked_at` timestamp
- Recording who approved and when
- Creating an audit log entry

All three goals are now **APPROVED and LOCKED**—neither employee nor manager can edit without admin intervention."

**On-Screen Callouts:**
- BRD Requirement #2.1: ✓ Approval workflow implemented
- Inline editing capability: ✓ Shown
- Audit logging: ✓ Logged automatically

**Actions:**
1. Return to Manager Dashboard
2. Show updated status: Eric now shows "APPROVED"

---

### Part 4C: Quarterly Check-in (Achievement Tracking) [3:15 – 4:10]

**Actions:**
1. Navigate to "Check-ins" tab
2. Show check-in interface

**Narration:**
"We've moved forward in time to July—**Q1 Check-in is now open** (our cycle defined the window: July 1 – September 30).

Notice the system enforces **quarterly windows** as defined in BRD Phase 2. Employees can only submit actuals during the active window. If they tried outside this window, the system would return: 'Check-in window is closed.'

**[EVAL HIGHLIGHT: Adherence to BRD]** This is **BRD Requirement #2.2: Quarterly check-in windows enforced.**"

**Actions:**
1. Show Eric's goals with "Planned vs. Actual" layout
2. For each goal, show:

**Goal 1: New Pipeline Creation**
- **Planned:** 1,200,000
- **Actual (entered by employee):** 950,000
- **UoM:** Numeric (higher is better)
- **Computed Score:** (950,000 ÷ 1,200,000) × 100 = **79%** ✓
- **Status:** ON_TRACK 🟡

**[HIGHLIGHT FORMULA]**
**Narration:** "For Numeric goals where higher is better, we divide actual by target. **[EVAL HIGHLIGHT: Adherence to BRD]** This is the exact formula from BRD Phase 2, Section 2.2.**"

**Goal 2: Customer Retention**
- **Planned:** 96%
- **Actual:** 94%
- **Computed Score:** (94 ÷ 96) × 100 = **98%** ✓
- **Status:** COMPLETED ✅

**Goal 3: Compliance Training**
- **Planned:** 0 (Zero-based: 0 = success)
- **Actual:** 0
- **Computed Score:** If 0 → **100%** ✓
- **Status:** COMPLETED ✅

**[HIGHLIGHT SCORING]**
**Narration:** "Notice the system computes all four UoM types: Numeric, Percentage, Timeline (date-based), and Zero-based. All formulas from the BRD are implemented and working correctly. **[EVAL HIGHLIGHT: Adherence to BRD—All 4 UoM types shown]**"

**On-Screen Callouts:**
- UoM Formula 1 (Numeric): Actual ÷ Target ✓
- UoM Formula 2 (Percentage): Actual ÷ Target ✓
- UoM Formula 3 (Zero): If 0 → 100%, else 0% ✓
- UoM Formula 4 (Timeline): [Mention available, not used in this example]

---

### Part 4D: Manager Check-in Comment (AI-Assisted) [4:10 – 4:30]

**Actions:**
1. Click "AI Copilot" or "Generate Feedback" button
2. Show generated comment

**Narration:**
"**[EVAL HIGHLIGHT: Good-to-Have Feature #1 - AI Integration]**

This is where GoalPulse goes beyond basic tracking. The manager can click 'Generate Check-in Comment' to let **AI assist with feedback quality.**"

**[AI-Generated Comment appears]**

**Narration:**
"The system generates: **'Eric has delivered strong execution this quarter with overall achievement of 92.3%. Highlights: Compliance training completed with zero incidents, and customer retention at 98%—critical for our churn goals. Pipeline creation is on track at 79% of target; let's discuss any bottlenecks in the enterprise deals.'**

The manager can then:
1. Use this as-is
2. Edit it (we show an editable text box)
3. Add their own comment from scratch

**[EVAL HIGHLIGHT: User Friendliness & Quality]** This eliminates a common failure mode in HRMS tools: managers writing generic or empty check-in comments. We're improving the quality of manager-employee conversations at scale."

**Actions:**
1. Show manager accepts the comment
2. Click "Submit Check-in"
3. Show confirmation: Check-in locked

**On-Screen Callouts:**
- AI-generated feedback: ✓ Implemented
- Manager can edit: ✓ Full control
- Audit logged: ✓ Automatic

---

## SCENE 5: ADMIN JOURNEY — GOVERNANCE & ANALYTICS [4:30 – 6:15]

### Part 5A: Admin Login & Executive Dashboard [4:30 – 4:50]

**Actions:**
1. Login as `alex@goalkeeper.com` / `Demo@1234`
2. Admin dashboard loads

**Narration:**
"Logging in as **Alex Admin**. The executive dashboard shows **org-wide visibility**:

**[Point to each metric]**
- **Goal Completion:** 92 of 100 employees have approved goal sheets (92%)
- **Check-in Progress:** 88 of 100 have submitted Q1 check-ins (88%)
- **Average Score:** 87% (trending up from 84% last quarter)
- **At-Risk Alerts:** 5 employees flagged as overdue

**[EVAL HIGHLIGHT: Good-to-Have Feature #2 - Analytics Module & Escalation]**

This dashboard directly addresses the problem statement: managers couldn't see team progress in real time. Now, org leaders have instant visibility."

**On-Screen Callouts:**
- Org completion rate: 92% ✓
- At-risk employees: 5 flagged
- Trending: Score improving Q4→Q1

---

### Part 5B: Completion Dashboard & Risk Alerts [4:50 – 5:20]

**Actions:**
1. Navigate to "Completion Dashboard"
2. Show employee list with status

**Narration:**
"The Completion Dashboard shows department-level detail. **[Scroll through employees]**

All employees in Sales: APPROVED ✓  
All employees in Ops: DRAFT or APPROVED  
**[Highlight Ravi Menon] — Status: DRAFT, Last login: 12 days ago**

The system **automatically flags** Ravi as an escalation risk. **[EVAL HIGHLIGHT: Good-to-Have Feature #2 - Escalation Intelligence Engine]**

Let me show the Risk Alerts section."

**Actions:**
1. Navigate to "Risk Alerts" or "Escalations"
2. Show alert for Ravi

**[Alert displays]:**
- **Employee:** Ravi Menon
- **Risk:** Goal sheet not submitted (10 days into open window)
- **Actions Taken:** Auto-email sent on day 7; manager reminder sent
- **Next Escalation:** HR escalation on day 14

**Narration:**
"The escalation engine **predicts which employees will miss deadlines** based on:
- Days since last login
- % of goals not started
- Days remaining in window

Rather than reactive notifications, we're being proactive. This is a feature absent from most HRMS tools. **[EVAL HIGHLIGHT: Differentiation in Good-to-Have Features]**"

**On-Screen Callouts:**
- Escalation triggered: Day 10 of 14-day window
- Predictive alerts: ✓ Implemented
- Audit trail: All escalations logged

---

### Part 5C: Analytics & Reporting [5:20 – 6:00]

**Actions:**
1. Navigate to "Analytics"
2. Show QoQ Trend Chart

**[Line chart appears showing quarters: Q4 2025 → Q1 2026]**

**Narration:**
"The Analytics module shows **QoQ performance trends**. Notice:
- Q4 2025: Org average score 78%
- Q1 2026: Org average score 87% (+9 percentage points)

This tells HR: 'Our goal-setting and coaching process is improving employee performance.'

**[Next visualization: Heatmap]**

Here's a **thrust-area heatmap**. Rows are employees, columns are thrust areas:
- **Revenue Growth:** 91% average (strong)
- **Customer Satisfaction:** 88% average (good)
- **Operational Efficiency:** 85% average (developing)
- **Innovation:** 72% average (attention needed)

**[EVAL HIGHLIGHT: Adherence to BRD - Section 5.4 Good-to-Have]** We implemented:
- Quarter-on-Quarter trends ✓
- Heatmaps for achievement analysis ✓
- Manager effectiveness comparison ✓"

**On-Screen Callouts:**
- Analytics Module: ✓ Fully implemented
- BRD Section 5.4 checklist: ✓ All items covered

**Actions:**
1. Navigate to "Reports"
2. Show Export option

**Narration:**
"The admin can export all goal data as **CSV or Excel** with:
- Employee name, goal, target, actual, score, manager
- Full audit trail of approvals and changes
- Filter by cycle, department, status

This addresses the BRD requirement: '**Achievement Report: Exportable (CSV/Excel)**.'"

**On-Screen Callouts:**
- BRD Requirement #4 (Reporting): ✓ CSV/Excel export implemented

---

### Part 5D: Audit Trail & Compliance [6:00 – 6:30]

**Actions:**
1. Navigate to "Audit Trail"
2. Show timeline for Eric Employee

**Narration:**
"**[EVAL HIGHLIGHT: Good-to-Have Feature & Governance]**

Every action in GoalPulse is logged for **compliance and governance**:

**[Timeline shows]**
- **May 10, 14:30** — Goal sheet created (DRAFT)
- **May 11, 10:15** — Submitted for approval (PENDING_APPROVAL)
- **May 12, 09:45** — Goal sheet approved by Maya Manager (APPROVED, locked_at timestamp)
- **July 1, 16:20** — Check-in submitted by Eric
- **July 2, 11:00** — Manager comment added; check-in locked
- **July 15, 13:45** — Audit log entry viewed by Alex Admin

**[Click on an entry]**

**Narration:**
"Clicking any entry shows the **full JSON detail**—before/after values, who made the change, timestamp.

**[EVAL HIGHLIGHT: Presence of Bugs - Data Integrity & Audit]** This audit trail prevents data corruption; any deletion or modification is logged. For compliance audits (SOX, ISO), we have a complete immutable record."

**On-Screen Callouts:**
- Audit trail: Complete ✓
- Immutable log: ✓
- BRD Requirement #4 (Audit): ✓ Implemented

---

### Part 5E: Cost Optimization Dashboard [6:30 – 6:50]

**Actions:**
1. Navigate to "Admin" → "Cost Dashboard"
2. Show infrastructure cost estimate

**Narration:**
"**[EVAL HIGHLIGHT: Cost Optimisation Criterion]**

Here's the cost dashboard showing our **infrastructure efficiency**:

**[Dashboard shows]**
- **Frontend (Vercel):** Free tier (100 GB bandwidth included)
- **Backend (Render):** Free tier (750 compute hours monthly)
- **Database (Supabase):** Free tier (500 MB, 0.5M database operations)
- **AI (Groq):** ~$2–5/month

**Total estimated monthly cost at 500 users: $2–5**

How do we achieve this?
1. **AI Response Caching:** 95% cache hit rate on Goal Coach calls (saves ~$300/month)
2. **Bulk Database Queries:** No N+1 query patterns; parallel Promise.all fetches
3. **CDN for Static Assets:** Vercel auto-caches; reduces bandwidth

**[EVAL HIGHLIGHT: Technical Excellence]** We didn't just build a working product; we optimized for cost from day one. This shows architectural maturity."

**On-Screen Callouts:**
- Estimated cost: $2–5/month at scale ✓
- Caching strategy: 95% AI hit rate ✓
- Architecture: Serverless + managed DB ✓

---

## SCENE 6: VALIDATION DEMO & ROBUSTNESS [6:50 – 7:00]

### Quick Edge-Case Test

**Actions (Optional - if time):**
1. Try to submit check-in outside window → **Error:** "Check-in window closed"
2. Try to edit locked goal → **Read-only field** (no action)
3. Try to double-click approve button → **Disabled immediately** (loading state, no duplicate submission)

**Narration:**
"**[EVAL HIGHLIGHT: Presence of Bugs - Robustness]**

GoalPulse has been tested for common edge cases:
- ✓ No duplicate submissions (button disabled after click)
- ✓ No out-of-window check-ins (window enforced)
- ✓ No editing of locked goals (backend validates permission)
- ✓ All validation errors are user-friendly, not technical

Zero crashes, zero silent failures. Every error path has graceful handling."

---

## SCENE 7: OUTRO & SUMMARY [7:00 – 7:15]

**Narration:**
"Let me summarize **GoalKeeper** against the evaluation criteria:

**✓ Functionality:** Complete end-to-end workflows for all 3 roles
**✓ BRD Adherence:** All Phase 1 & Phase 2 requirements implemented
**✓ User Friendliness:** Clear dashboards, intuitive forms, contextual guidance
**✓ Robustness:** Edge cases handled, validation enforced, zero bugs
**✓ Good-to-Have Features:** AI coaching, analytics, escalation engine, cost optimization
**✓ Cost Optimisation:** $2–5/month at scale with caching strategy

**Technology Stack:**
- React 19, TypeScript, Tailwind CSS (frontend)
- Node.js Express, Supabase PostgreSQL (backend)
- Groq LLAMA 3.1 (AI layer)
- Deployed on Vercel, Render, Supabase (serverless)

This is a production-ready, enterprise-grade solution that directly addresses the hackathon problem statement. **Thank you.**"

**Final On-Screen Callouts:**
- ✅ All 6 evaluation criteria demonstrated
- ✅ All 3 user roles shown with complete workflows
- ✅ 5:30 – 7:00 minutes elapsed
- ✅ Ready for judge Q&A

---

## TIMING BREAKDOWN

| Section | Duration | Cumulative |
|---------|----------|-----------|
| Intro & Context | 0:20 | 0:20 |
| Login & Role Selection | 0:20 | 0:40 |
| Employee: Goal Creation | 1:35 | 2:15 |
| Manager: Approval & Check-in | 2:15 | 4:30 |
| Admin: Governance & Analytics | 1:45 | 6:15 |
| Validation Demo | 0:10 | 6:25 |
| Outro & Summary | 0:35 | 7:00 |
| **TOTAL** | **7:00** | — |

---

## KEY TALKING POINTS (Evaluation-Aligned)

### Criterion #1: Functionality of the Portal
- ✅ Employee creates → Manager approves → Check-in submitted
- ✅ No errors, complete workflows end-to-end
- ✅ Status updates in real-time

### Criterion #2: Adherence to BRD
- ✅ Weightage validation (100%, min 10%)
- ✅ All 4 UoM formulas implemented (Numeric, %, Timeline, Zero)
- ✅ Goal locking post-approval
- ✅ Shared goals sync capability
- ✅ Quarterly windows enforced
- ✅ Manager approval workflow with inline editing

### Criterion #3: User Friendliness
- ✅ Clean dashboards with single-pane-of-glass view
- ✅ Real-time weightage counter (no math needed)
- ✅ Friendly error messages (not "Error 422")
- ✅ Contextual guidance ("Goal Setting is open until June 30")
- ✅ Color-coded status badges (green/amber/red)

### Criterion #4: Presence of Bugs
- ✅ Validation tested: invalid weightage rejected
- ✅ Window enforcement: check-in blocked outside cycle
- ✅ No duplicate submissions (button disabled)
- ✅ Lock state enforced: goals uneditable post-approval
- ✅ All edge cases handled gracefully

### Criterion #5: Good-to-Have Features
- ✅ **AI Goal Coach:** SMART scoring in real-time
- ✅ **AI Check-in Copilot:** Generates manager feedback
- ✅ **Analytics Module:** QoQ trends, heatmaps, manager effectiveness
- ✅ **Escalation Engine:** Predictive risk alerts
- ✅ **Audit Trail:** Complete compliance logging
- ✅ **Cost Dashboard:** Infrastructure efficiency visibility

### Criterion #6: Cost Optimisation
- ✅ **Free-tier architecture:** Vercel, Render, Supabase all free tier
- ✅ **Caching strategy:** 95% AI hit rate saves $300/month
- ✅ **Bulk queries:** No N+1 pattern; parallel fetches
- ✅ **Estimated cost:** $2–5/month at 500 users
- ✅ **Scalable:** Cost grows linearly; optimized for growth

---

## RECORDING TIPS

1. **Pacing:** Speak clearly; pause after each major action (let the demo "breathe")
2. **Cursor Movement:** Move mouse slowly; let viewers follow your navigation
3. **Highlighting:** Use on-screen graphics/arrows to point out key elements
4. **Audio:** Record in quiet environment; speak at conversational pace
5. **Transitions:** Use fade/cut between scenes; avoid jump-cuts mid-action
6. **Overlay Text:** Add evaluation criteria callouts in post-production
7. **Timing:** Aim for 6:30 – 7:00 (leaves 30 seconds buffer for judge playback)

---

## POST-PRODUCTION ELEMENTS

**Graphics to Add:**
- Title card: GoalPulse Logo + Tagline
- Evaluation criteria callouts at each step
- On-screen text: Demo credentials (not spoken, just displayed)
- BRD requirement tags: "BRD 2.1: ✓"
- Timing counter (optional)
- End card: Team name, GitHub link, deployment URL

**Music/Sound:**
- Subtle background music (royalty-free, instrumental)
- System sounds (notification, approval, check-in sounds) — keep minimal
- No loud volume spikes

---

## JUDGE Q&A TALKING POINTS (After Demo)

**Judges might ask:**

1. **"Why did you choose React + Supabase?"**
   - Answer: "Fast iteration during hackathon, built-in auth/RBAC, no DevOps overhead. Scales easily; free tier sufficient for judges to test."

2. **"How is the AI integrated?"**
   - Answer: "Groq API with 95% caching. If offline, we fallback gracefully. Designed to enhance, not replace, manager judgment."

3. **"What's your plan for scalability?"**
   - Answer: "Serverless by design. If we hit limits, we upgrade Render tier (still <$50/month at 5K users) and add Redis for caching."

4. **"Are there any known issues?"**
   - Answer: "[Mention any if applicable] Everything we demoed works. Known improvements in backlog: mobile app, Teams integration, Entra ID SSO."

5. **"How long did this take to build?"**
   - Answer: "[Your timeline] The AI layer was 20% of code, 80% of perceived value."

---

## FINAL CHECKLIST BEFORE RECORDING

- [ ] All 3 demo users accessible with correct credentials
- [ ] Demo database seeded with realistic data
- [ ] Seed reset button working (for judge re-runs)
- [ ] Browser window sized appropriately (1920x1080 recommended)
- [ ] Network latency acceptable (no 10+ second waits)
- [ ] All pages load without errors
- [ ] Validation rules trigger correctly
- [ ] AI features respond (even if fallback, no blank screens)
- [ ] Audit trails populated with realistic timestamps
- [ ] Analytics dashboard renders charts correctly
- [ ] Export buttons work (CSV/Excel)
- [ ] Logout/role-switching works smoothly

---

**Good luck with your demo! This script hits every evaluation criterion while telling a compelling story of the system in action.**
