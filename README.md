# Xello Tuition: Internal Operations & Credit Management Platform

Operational management web application for **Xello Tuition**, a one-to-one online tuition business serving students in Kerala and Malayali families across GCC countries (UAE, Saudi Arabia, Qatar, Oman, Kuwait, Bahrain).

Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma ORM (SQLite for local zero-friction execution & PostgreSQL/Supabase production ready)**, and **Lucide Icons**.

---

## 1. Core Architectural Model: Shared Balance & Credit Ledger

Students purchase multi-subject class packages with a shared entitlement pool:
- **Entitlement (Purchased)**: Total classes bought (e.g., 20 classes).
- **Allocated**: Distributed to subjects (e.g., Chemistry: 10, English: 10).
- **Reserved**: Scheduled for upcoming future classes.
- **Consumed**: Completed sessions or chargeable no-shows under the package policy.
- **Delivered**: Classes physically taught by tutors.
- **Billed & Collected**: Pure financial accounting strictly decoupled from class credit balances.

### Reallocation Mechanics
During exam season, academic coordinators can reallocate remaining classes between subjects (e.g. from 10/10 to 15/5) with:
1. **Zero Billing Disturbance**: Reallocation alone does not modify billing invoices or receipts.
2. **Atomic Verification**: Total allocations must equal package entitlement; allocation cannot fall below already-consumed credits.
3. **Reservation Conflict Detection**: If future scheduled classes exceed the new remaining balance, the system blocks the action and identifies the conflicting sessions.
4. **Auditable Double-Entry Ledger**: Every reallocation, reservation, consumption, and reversal is permanently recorded with actor identity, timestamp, before/after values, and operational reason.

---

## 2. Server-Enforced Role-Based Authorization

The application features a built-in **Persona Switcher** in the top navigation bar to test all 4 roles:

| Role | Operational Scope & Permissions | Server-Side Enforcement |
| :--- | :--- | :--- |
| **Owner / Admin** | Full access to academic and financial operations, policy adjustments, user management, and payouts. | Superuser access. |
| **Academic Coordinator** | Manage students, subject enrolments, timetable, attendance review, package reallocations, and follow-ups. | Cannot alter fee invoices, verify payments, approve payout runs, or export financial data. |
| **Teacher / Tutor** | View assigned students, own personal timetable, submit attendance, lesson notes, homework, and progress. | Isolated to own students and schedule; cannot view other tutors' rates or unrestricted parent financials. |
| **Accounts** | Invoices, payment proof verification, receipts, outstanding collections, and dues follow-up queue. | Cannot alter academic attendance or subject allocations. |

---

## 3. Operations Screens

1. **Dashboard** (`/`): Real-time academic KPIs (Active Students, Today's Sessions, Missing Attendance, Low Package Balances) and financial KPIs (Net Billed, Collections, Outstanding, Overdue Dues).
2. **Students Directory** (`/students`): Searchable student roster with GCC country badges and package status chips.
3. **Student Profile** (`/students/[id]`): Detailed profile with all **9 Operational Tabs**:
   - *Overview* (Student ID, Class/Grade, Board, Medium, Guardian WhatsApp, Country, Timezone, Joining Date, Preferred timings, Coordinator notes)
   - *Subjects & Teachers* (Enrolments, tutors, target exam dates)
   - *Packages & Balances* (Shared balance breakdown & Reallocate modal)
   - *Timetable* (Upcoming and past sessions in IST and local GCC time)
   - *Attendance* (Class outcomes, topics covered, homework, credit deduction status)
   - *Fees & Payments* (Invoices, receipts, unallocated advance credits)
   - *Progress* (Monthly curriculum milestones, homework completion %, assessments)
   - *Follow-ups* (Promised payment dates, parent notes, one-click WhatsApp action)
   - *Activity History* (Audited credit ledger events and timestamped logs)
4. **Packages & Credits** (`/packages`): Reusable package templates, active student packages, interactive **"Reallocate Remaining Classes"** modal with real-time pre-validation, and **Auditable Credit Ledger** viewer.
5. **Timetable** (`/timetable`): Day, week, and list views, dual India/GCC timezone switcher, conflict checks (teacher/student overlapping and package credit availability), online meeting links, and rescheduling.
6. **Attendance & Inbox** (`/attendance`): Missing attendance inbox, attendance submission modal, teacher absence zero-charge policy enforcement, and audited attendance correction/reversal modal.
7. **Payments & Invoices** (`/billing`): Invoices, payment verification inbox (proof upload != verified payment), unallocated advance credit, and printable tuition receipts.
8. **Dues & Follow-ups** (`/dues`): Aging bands (Due today, 1-7d, 8-15d, 16-30d, 30d+), low balance renewal queue, and prefilled WhatsApp links (`https://wa.me/...`).
9. **Teachers** (`/teachers`): Tutor directory, subject specializations, supported grades, and rate snapshots.
10. **Teacher Payouts** (`/payouts`): Batch payout runs, rate snapshots, and approval workflows.
11. **Reports & Exports** (`/reports`): Attendance, delivered vs consumed, collections, and formula-safe CSV exports.
12. **Settings & Audit** (`/settings`): Tuition policies (4h cancellation window, teacher absence zero-charge), database backup instructions, and live system audit logs.

---

## 4. Setup & Running Locally

### Prerequisites
- Node.js v18+ or v20+ or v24+
- npm v9+

### Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Push Prisma database schema (creates local SQLite dev.db)
npx prisma db push

# 3. Seed demo dataset (Naveen Chandran, Ananya Kurian, Adithya Menon, Chemistry/English 20-pack)
npm run seed

# 4. Start Next.js development server
npm run dev
# App is accessible at http://localhost:3000 (or http://localhost:3003)
```

---

## 5. Automated Acceptance Test Suite (18 Scenarios)

The project includes an automated test runner executing all 18 end-to-end scenarios:

```bash
npm test
```

### Verified Scenarios:
- [x] **Scenario 01**: Create student, 2 subjects, 2 teachers, and 20-class package allocated 10/10.
- [x] **Scenario 02**: Complete 6 Chemistry and 4 English classes; verify remaining total is 10.
- [x] **Scenario 03**: Reallocate to 15 Chemistry and 5 English; verify remaining balances are 9 and 1.
- [x] **Scenario 04**: Reject an allocation below already consumed credits.
- [x] **Scenario 05**: Detect and resolve excess future reservations before reallocation.
- [x] **Scenario 06**: Reschedule a class without double reservation or consumption.
- [x] **Scenario 07**: Verify teacher absence consumes no credit.
- [x] **Scenario 08**: Submit attendance twice; consume credit only once (idempotent).
- [x] **Scenario 09**: Correct attendance and verify the reversal history and restored balances.
- [x] **Scenario 10**: Bill ₹6,000, verify a ₹2,000 payment, and show ₹4,000 outstanding.
- [x] **Scenario 11**: Confirm outstanding becomes overdue only after the applicable due date.
- [x] **Scenario 12**: Upload payment proof without verification; balance remains unchanged.
- [x] **Scenario 13**: Apply an advance without double-counting collection.
- [x] **Scenario 14**: Verify renewal does not overwrite the previous package.
- [x] **Scenario 15**: Reject unauthorized teacher access through direct API requests.
- [x] **Scenario 16**: Verify two concurrent actions cannot overspend remaining credit.
- [x] **Scenario 17**: Verify payout items cannot be paid twice.
- [x] **Scenario 18**: Verify relevant local class times for India and GCC users.

---

## 6. Production Deployment (PostgreSQL & Supabase)

To deploy to production with managed PostgreSQL (Supabase / Neon):
1. Change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`.
2. Set `DATABASE_URL` in `.env` to your PostgreSQL pooled connection string.
3. Run `npx prisma migrate deploy`.
4. Configure managed Supabase authentication using the provided integration boundary in `src/lib/auth.ts`.
