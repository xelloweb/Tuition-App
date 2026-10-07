# Xello Tuition — issue register

Inspection and fixes, 7 Oct 2026. Everything below was verified on an isolated local build with fictional
fixture data (`npm test` fixtures); nothing was tested against the live site's data.

Evidence used: code review of every page and API route; browser sweep of 16 pages × 4 roles × 6 widths
(320–1440 px, 384 page loads) with axe-core 4 (WCAG 2.0/2.1/2.2 A+AA rules); end-to-end browser scripts
for the workflows in brief §14; server-clock (UTC vs IST) × device-zone (Dubai vs India) comparison;
throttled mobile timing; automated tests (140 unit/integration, 18 acceptance scenarios, 12 HTTP).

**Status key** — Fixed and verified · Fixed, unverified · Blocked · Not implemented · Not reproduced.
"Live" means xellotuition.com; at 22:14 IST on 7 Oct the live site still served a build from before the hotfix
(pushed to GitHub at 20:34 IST).

## 1. Security, data loss and accounting

| ID | Workflow | Issue (reproduction) | Impact | Sev. | Root cause | Fix | Status |
|---|---|---|---|---|---|---|---|
| SEC-4 | Deploy | Commit 6f680d3 (another session) set `resetRequested = true` in the seed. Every build ran the seed, so every deploy deleted the whole live database and re-created it from code. | All live data lost on each push. | Critical | Forced wipe left in. | Hotfix 09b17aa restores the `ALLOW_DB_RESET` guard (populated databases are never touched). | Fixed and verified locally; pushed to GitHub; **not live** (Hostinger build not observed) |
| SEC-5 | Login | Commit 95b7914 made the app sign sessions with a secret written in the public repository whenever `NEXTAUTH_SECRET` is missing or short. The commit name ("EnvUpdateFailed") suggests the live site is in that state. | Anyone could forge an owner login. | Critical | Fallback secret. | Hotfix: published secrets refused, fail closed with a "needs one setting" page; secret read per request so builds don't need it. | Fixed and verified locally (missing / leaked / valid secret); pushed; **not live** |
| SEC-2 | Repository | Commits 2837515 and 1102fb2 (another session) put 55 trainers' names, emails and phones and 128 students' names into `prisma/seed.ts`; the repository is public. `prisma/dev.db` (tracked) now holds the same data; `trainers.tsv` (with bank details) and `students.tsv` sit in the project folder. No bank details were committed. | Personal data published. | Critical | Real data used as seed data; database file tracked and bundled. | Data removed from current code (hotfix); ignore rules for data exports; `dev.db` no longer bundled; untracked in the next commit. | Partly fixed. **Blocked on owner:** make the repository private; history still contains the data (purge needs a force-push decision) |
| SEC-1 | Login | First live build seeded staff logins with `demo123`; later re-seeds gave coordinator and accounts the owner's setup password. | Account takeover / shared password. | Critical | Published default password; shared bootstrap password. | Production refuses published passwords; deploy step replaces a published owner password with `SEED_ADMIN_PASSWORD` and clears published or shared staff passwords (owner issues reset links on the new Users page); sessions end. | Fixed and verified locally (tests); not live |
| SEC-7 | Sessions | Changing or resetting a password, or switching a login off, left existing 30-day sessions valid. | Leaked sessions stay usable. | High | Stateless JWT with no version. | `User.sessionVersion` checked on every request; bumped on change/reset/revoke/switch-off. | Fixed and verified |
| SEC-6 | Login | `?callbackUrl=` was followed blindly after sign-in (could send staff to another website). | Phishing aid. | Medium | Unvalidated redirect. | Same-site paths only. | Fixed and verified (browser check: external and `//` targets land on the dashboard) |
| SEC-3 | Dashboard, attendance, timetable, payouts, progress | A trainer login without a linked trainer profile fell through to staff queries (all classes, students, every trainer's pay). | Data exposure. | Medium | `if (role === TEACHER && teacherId)` filters. | Unlinked trainer logins get a notice on every scoped page. | Fixed and verified |
| DATA-1 | Admission | Weekly slots were written with no validation: no clash check, wrong trainer possible, malformed input → 500. | Double-booking, corrupt slots. | High | Admission bypassed the timetable service. | Admission runs the timetable plan inside the admission transaction. | Fixed and verified |
| WF-1 | Admission | Confirming an admission booked no classes (booking ran separately and swallowed its errors). | Trainers saw no classes. | High | Same; error swallowed. | First 4 weeks booked atomically; problems reported, not hidden. | Fixed and verified |
| DATA-2 | Drafts | Drafts created placeholder students and guardians ("TBD", `+910000000000`). | Polluted lists and sibling matching. | Medium | Drafts stored as students. | Separate `AdmissionDraft` table; confirm creates records and removes the draft in one transaction; stale saves refused (409). | Fixed and verified |
| ACC-3 | Billing | No screen could record a payment (API only). | Partial payments could not be entered. | High | Missing UI. | "Record payment" (unverified until Accounts verify). | Fixed and verified (₹2,000 on ₹6,000 → ₹4,000) |
| ACC-4 | Attendance | One-tap buttons saved invented topics/homework; the API defaulted an empty topic to "General curriculum session". | False class records. | Medium | Convenience defaults. | Topic typed by the trainer; empty topic stored as "Not recorded". | Fixed and verified |
| ACC-1 | Reports | Exports used the server clock for day boundaries (7–8 Oct covered 7 Oct 05:30 → 9 Oct 05:29 IST on a UTC server). | Wrong period totals. | Medium | `setHours` in server zone. | IST day ranges. | Fixed and verified |
| ACC-2 | Dashboard | Low-balance list omitted used-up packages; loaded every session to count. | Renewals missed. | Medium | Ad-hoc calculation. | Grouped counts; 0-left packages included and shown first. | Fixed and verified (used-up package listed) |

### Found 8 Oct 2026 (commits made overnight by another AI tool under the owner's Git name)

| ID | Issue | Impact | Fix | Status |
|---|---|---|---|---|
| SEC-8 | `auth-options.ts` accepted a fixed owner password written in the public code (and reset the owner's real password to it). | Anyone could sign in as owner. | Removed; that password is now on the published list (refused at sign-in, never accepted as a new password). | Fixed and verified locally |
| SEC-9 | `/api/auth/forgot-password` set a new owner password for anyone, and returned working reset links for any staff or trainer email. | Takeover of every login. | Endpoint removed; the page now explains how to get a link from the owner. | Fixed and verified locally |
| SEC-10 | The deploy's seed step ran an import that first deleted all students, guardians, classes, attendance, packages, invoices and payments, then re-imported a fixed list. | Every deploy erased work entered in the app. | Import removed from the build. | Fixed and verified locally |
| SEC-11 | Three scripts with about 130 students' names, WhatsApp numbers and places were committed to the public repository. | Personal data published. | Removed from the repository and ignored; still in history. | Partly fixed. **Blocked on owner:** make the repository private |
| SEC-12 | Anyone could have used SEC-8/9 while they were live. | Unknown access. | One-time reset at deploy: every session ends, the owner password becomes SEED_ADMIN_PASSWORD, logins changed since 23:30 IST on 7 Oct need a new link, open links are cancelled. | Fixed and verified locally (rehearsed) |

**Owner password recovery** (replaces any public reset form): in Hostinger's Environment variables set
`SEED_ADMIN_PASSWORD` to a new password (12+ characters) and add `OWNER_PASSWORD_RESET` = `reset-owner-password`;
redeploy; sign in as admin@xellotuition.com with the new password; then delete `OWNER_PASSWORD_RESET` (otherwise
every deploy resets the owner password again) and change the password under My account.

## 2. Admission, scheduling, login and attendance

| ID | Issue | Fix | Status |
|---|---|---|---|
| TZ-1 | Time-zone switchers (header, timetable editor, trainer form), "local" second times, student zones on lists. | IST everywhere; other zones refused on save; older GCC-time slots shown and saved in IST at the same instants. | Fixed and verified |
| WF-2 | Trainer day view: arrows only. | Date picker, previous/next/today, attendance state per class. | Fixed and verified |
| WF-3 | No way for trainers to request attendance corrections. | Correction requests; staff correct (audited) or decline; resolved automatically. | Fixed and verified (was Not implemented) |
| WF-4 | Credit effect not explained before submission. | Effect per package rule shown in the form. | Fixed and verified |
| WF-5 | No login management. | Owner-only Users page (create, switch off/on, one-time links, no self lock-out). | Fixed and verified (was Not implemented) |
| WF-6 | Trainers had to be typed one by one. | Google Sheet import with preview, duplicate skipping, bank column dropped in the browser. | Fixed and verified (was Not implemented) |
| WF-7 | Instalment schedules; payment-proof file upload. | — | Not implemented |

## 3. Navigation, forms and mobile

| ID | Issue | Fix | Status |
|---|---|---|---|
| NAV-1 | Teacher / Trainer / Tutor mixed. | "Trainer" in every label. | Fixed and verified |
| NAV-2 | 12 ungrouped items; mobile and desktop menus disagreed. | One grouped definition; ≤4 mobile destinations + More per role. | Fixed and verified |
| NAV-3 | Settings claimed configuration it did not offer, "cryptographically ordered" audit log, developer instructions. (Correction: the listed class rules *are* applied as package defaults.) | Accurate rules, Users link, readable audit log. | Fixed and verified |
| FORM-1 | Login labels not connected. | Connected (+27 other forms). | Fixed and verified |
| FORM-2 | No unsaved-change warning. | Admission form warns (dialog and browser close). Trainer form: not added. | Partly fixed |
| UI-1 | Timetable rows clipped their action buttons at 768 and 1024 px (owner and coordinator: 4 of 336 loads). | Wrapping layouts (timetable rows, trainer-card actions). | Fixed and verified (0 of 384 loads clipped) |
| DASH-1 | Unlabelled money totals, wrong links, misleading absence count. | INR + "as of" labels, every card opens the matching records. | Fixed and verified |

## 4. Accessibility, visual system and performance (before → after, measured)

| ID | Measure | Before | After | Status |
|---|---|---|---|---|
| A11Y-1 | Pages with exactly one `h1` | 0 of 56 | 64 of 64 | Fixed and verified |
| A11Y-2 | axe violations (all roles, 390 & 1440 px) | 421 nodes (contrast 271, unnamed button 60, name mismatch 56, unlabeled select 18, unlabeled input 16) | 0 | Fixed and verified |
| A11Y-3 | Dialog focus (initial focus, trap, return) | Missing | Native modal dialog everywhere | Fixed and verified |
| VIS-1 | Text under 12 px | 33.5% of text nodes (all widths; 31.8% at 1440 px) | 0% | Fixed and verified; tokens added, older screens partly migrated |
| PERF-1 | Header clock re-rendering every second; unbounded dashboard/attendance queries | Present | Removed / aggregated / attendance history capped at 100 | Fixed and verified |

## Remaining limitations

- Live site: the hotfix (09b17aa) reached GitHub at 20:34 IST but Hostinger had not deployed it by 22:14 IST; all other work is local and uncommitted.
- Before redeploying, confirm that no `ALLOW_DB_RESET` variable exists in Hostinger: set to `wipe-all-data`, it would still wipe the live database.
- Personal data remains in the public repository's history until the repository is made private and/or history is rewritten.
- 79 `no-explicit-any` lint errors remain in older screens (billing, dues, payouts, timetable, progress); npm audit reported 8 high-severity advisories earlier (not re-assessed).
- Not implemented: instalment schedules, payment-proof upload, trainer availability used for clash checks.
