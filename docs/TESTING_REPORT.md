# SGSU Smart Assessment Portal — Final Testing Report

Date: 16 Nov 2026 · Build: Next.js 16.4.6 production build · Database: real MongoDB 8.3 server (local) · Browser: Google Chrome for Testing 153 (headless, via Playwright 1.65)

## 1. Summary

| Suite | Tool | Executed | Passed | Failed | Blocked |
|---|---|---|---|---|---|
| Static checks | `npm run lint` (ESLint 9, next/core-web-vitals + TS) · `npm run typecheck` | 2 | 2 | 0 | 0 |
| Production build | `npm run build` | 1 | 1 | 0 | 0 |
| Unit tests | Vitest | 80 | 80 | 0 | 0 |
| Integration tests (real MongoDB) | Vitest | 51 | 51 | 0 | 0 |
| End-to-end browser + API tests | Playwright (Chrome) | 24 | 24 | 0 | 0 |
| Load test | `scripts/load-test.ts` | 1 | 1 | 0 | 0 |
| Visual QA (light/dark, desktop/mobile) | Playwright screenshots, manual review | 1 | 1 | 0 | 0 |
| Environment-dependent checks | see §6 | 7 | 0 | 0 | **7** |
| **Total** | | **167** | **160** | **0** | **7** |

**Outstanding defects:** none known in the application code. **Dataset defects** (not code) are listed in §5 and in the README.

**Deployment readiness:** the code is ready to deploy. The final acceptance workflow passed end to end on a production build. The blocked items in §6 need your Atlas cluster, Vercel project, SMTP account and real devices; they could not be run from this build environment.

### Round 5 (17 Nov 2026): exam templates, automatic scheduling, network recovery

| Check | Result |
|---|---|
| `npm run lint` · `npm run typecheck` · `npm run build` | pass |
| Vitest (unit + integration, real MongoDB) | **144 / 144** pass. New file `tests/integration/templates-scheduling-recovery.test.ts` (12 tests) |
| Playwright E2E (production build) | **39 / 39** pass. New file `tests/e2e/05-templates-scheduling-recovery.spec.ts` (15 tests) |

**Covered:**
- **Templates**: create PCM template (UI), persists in MongoDB and in a new session; exam from template applies its settings and is a draft until published; template edits leave earlier exams unchanged; duplicate; archived templates are no longer offered; one default; invalid templates rejected.
- **Scheduling**:
  - Scheduled exam blocked before its start through the page, the code and a direct API call.
  - Opens at the configured time (controlled server clock with `vi.setSystemTime`), then stops new attempts after expiry while a started attempt keeps its own deadline.
  - Hard end caps the deadline; manual closure blocks new attempts.
  - Link and code unchanged after schedule edits and a new sign-in.
  - Timezone conversion: IST, UTC, London summer time, New York winter time, and the admin dialog round trip UTC ↔ IST.
  - Notices.
- **Network recovery**:
  - Five answers saved; offline banner; change queued locally (no answer keys stored); reconnect verified with the server; answer synchronised; refresh restores the same attempt, question, answers, deadline and warning count (0); submit.
  - Lost acknowledgement (the server applied the save but the response was dropped), rapid changes and a late stale request all keep the newest answer.
  - Browser closed while offline, reopened: the queue syncs.
  - Submit while offline stays pending, then submits once.
  - Attempt finalised by another session; queue from another account ignored; sign-out clears queues; storage unavailable shows a warning and saves still work.
  - Concurrency: ten simultaneous out-of-order saves keep the highest sequence.
  - Changes sent after the attempt ended are rejected and reported.

**Not run as a separate E2E:**
- *Attempt expires during disconnection*. It would need a real minute-long wait. The rule is covered at service level instead: changes sent after the attempt ended are rejected and reported.
- Real phone/tablet networks (see §6).

**Fixes during this round:**
- After a reload, the workspace reset to question 1. It now restores the last question.
- An existing test was flaky about 10% of the time, because it picked 50 random questions from a pool of 51. It now requests the whole pool.
- E2E signups now use distinct client addresses. The production limit of 20 signups per IP per hour is unchanged.

## 2. Final acceptance workflow (Playwright, production build)

Admin Login → Local JSONL Import → MongoDB Question Bank → Question Verification → Generate Exam → Preview → Publish → Share Link → Student Signup → Permanent Account Saved → Start Test → Answer Questions → Autosave → Refresh/Resume → Submit → Automatic Evaluation → Student Result → Admin Results → Export Report — **PASS** (tests E1–E8).

## 3. End-to-end tests

| ID | Module | Scenario (expected result asserted) | Result |
|---|---|---|---|
| E1 | Acceptance | Admin signs in and lands on the dashboard | Pass |
| E2 | Acceptance | Admin imports local JSONL datasets via UI (2,307 records previewed), re-import shows 0 new | Pass |
| E3 | Acceptance | Admin bulk-verifies clean questions per subject; ambiguous-image question requires visual confirmation (Verify disabled) | Pass |
| E4 | Acceptance | Wizard creates exam (P2/C2/M1), generate paper, preview with answers, replace a question, publish, link + QR | Pass |
| E5 | Acceptance | Student opens link → Create account → returns to same exam | Pass |
| E6 | Acceptance | Student answers, autosave indicator, refresh → answers restored, timer not reset, fullscreen gate, no warning on refresh, clear response, submit, result + answer review | Pass |
| E7 | Acceptance | Second attempt blocked; account persists across sessions; history listed | Pass |
| E8 | Acceptance | Admin monitoring + results + attempt detail; Excel (PK), PDF (%PDF), CSV exports; students export | Pass |
| E9 | Security | Tab-switch warnings 1 and 2, duplicate burst coalesced, 3rd confirmed violation terminates; result shows reason | Pass |
| E10 | Security | Fullscreen exit detected (warning) / gate enforced | Pass |
| E11 | Security | Camera+mic exam with fake devices: preview, start, local sound monitoring; permission denial blocks start and accommodation request submitted | Pass |
| E12 | Security | Offline: banner, answer kept locally, saved after reconnect (verified via API) | Pass |
| E13 | Security | Login from exam link redirects back to the exam | Pass |
| E14 | API | Unauthenticated → 401 and student → 403 on admin APIs | Pass |
| E15 | API | Answer keys absent from attempt payload; other student gets 403 on attempt/result/submit; 5 concurrent submits OK; restart → 409 | Pass |
| E16 | API | Invalid signup → 422; cron without secret → 401 / with secret 200; SSRF: metadata IP → 400, unapproved host → 403, http → 400; duplicate email → 409 | Pass |
| E17 | API | Insufficient questions → 422 with exact message, no paper | Pass |

## 4. Automated unit & integration tests

Every row below was executed; integration tests run against a real MongoDB server, each file in its own database.

| # | Kind | Module | Scenario | Result |
|---|---|---|---|---|
| 1 | Integration | Attempts, evaluation, integrity, monitoring | student attempt lifecycle > starts once, resumes on reopen, and survives concurrent start requests | Pass |
| 2 | Integration | Attempts, evaluation, integrity, monitoring | student attempt lifecycle > never exposes the answer key to the student before release | Pass |
| 3 | Integration | Attempts, evaluation, integrity, monitoring | student attempt lifecycle > autosaves, restores after reload, and does not reset the server timer | Pass |
| 4 | Integration | Attempts, evaluation, integrity, monitoring | student attempt lifecycle > scores exactly (70 correct / 20 wrong / 10 blank → 260/400) and handles concurrent submits idempotently | Pass |
| 5 | Integration | Attempts, evaluation, integrity, monitoring | student attempt lifecycle > applies custom negative marking | Pass |
| 6 | Integration | Attempts, evaluation, integrity, monitoring | student attempt lifecycle > auto-submits on timeout with saved answers | Pass |
| 7 | Integration | Attempts, evaluation, integrity, monitoring | student attempt lifecycle > finalises overdue attempts via the scheduled job | Pass |
| 8 | Integration | Attempts, evaluation, integrity, monitoring | student attempt lifecycle > counts warnings, deduplicates events and terminates on the third confirmed violation | Pass |
| 9 | Integration | Attempts, evaluation, integrity, monitoring | student attempt lifecycle > does not count warnings when the policy is disabled or the student has an approved accommodation | Pass |
| 10 | Integration | Attempts, evaluation, integrity, monitoring | student attempt lifecycle > lets an admin reset an attempt with an audit record | Pass |
| 11 | Integration | Attempts, evaluation, integrity, monitoring | student attempt lifecycle > closing an exam auto-submits active attempts; results, monitoring and analytics reflect real data | Pass |
| 12 | Integration | Attempts, evaluation, integrity, monitoring | student attempt lifecycle > rejects starts outside the exam window | Pass |
| 13 | Integration | Attempts, evaluation, integrity, monitoring | student attempt lifecycle > caps the deadline at the exam end time | Pass |
| 14 | Integration | Authentication & accounts | student registration & login > validates signup input | Pass |
| 15 | Integration | Authentication & accounts | student registration & login > registers permanently with a hashed password and unique student ID | Pass |
| 16 | Integration | Authentication & accounts | student registration & login > rejects duplicate emails (case-insensitive), including concurrent signups | Pass |
| 17 | Integration | Authentication & accounts | student registration & login > authenticates with correct credentials only | Pass |
| 18 | Integration | Authentication & accounts | student registration & login > resets passwords with a single-use token and revokes sessions | Pass |
| 19 | Integration | Local JSONL import (real dataset) | local JSONL dataset import (real provided files) > detects all subject files | Pass |
| 20 | Integration | Local JSONL import (real dataset) | local JSONL dataset import (real provided files) > previews without writing | Pass |
| 21 | Integration | Local JSONL import (real dataset) | local JSONL dataset import (real provided files) > imports valid records as Pending Review and is idempotent | Pass |
| 22 | Integration | Local JSONL import (real dataset) | local JSONL dataset import (real provided files) > stores normalised fields correctly | Pass |
| 23 | Integration | Local JSONL import (real dataset) | local JSONL dataset import (real provided files) > flags genuinely missing image files (chemistry image12.png is absent from the dataset) | Pass |
| 24 | Integration | Local JSONL import (real dataset) | local JSONL dataset import (real provided files) > does not guess unclassified difficulties | Pass |
| 25 | Integration | Local JSONL import (real dataset) | local JSONL dataset import (real provided files) > rejects unknown or traversal file ids | Pass |
| 26 | Integration | Local JSONL import (real dataset) | missing subjects, invalid rows and change detection (temporary data dir) > reports subjects without files as not present and handles invalid rows | Pass |
| 27 | Integration | Exam generator | exam generator > generates a 5-question exam with exact counts and no duplicates | Pass |
| 28 | Integration | Exam generator | exam generator > generates a 10-question exam with exact counts and no duplicates | Pass |
| 29 | Integration | Exam generator | exam generator > generates a 50-question exam with exact counts and no duplicates | Pass |
| 30 | Integration | Exam generator | exam generator > generates a 100-question exam with exact subject AND difficulty distributions | Pass |
| 31 | Integration | Exam generator | exam generator > honours subject-specific difficulty selection | Pass |
| 32 | Integration | Exam generator | exam generator > refuses to fabricate questions when the pool is insufficient | Pass |
| 33 | Integration | Exam generator | exam generator > rejects mismatched totals at validation time | Pass |
| 34 | Integration | Exam generator | exam generator > replaces a question with another of the same subject/difficulty, regenerates, publishes and freezes the paper | Pass |
| 35 | Integration | Exam generator | exam generator > blocks publishing when a selected question is un-verified after generation | Pass |
| 36 | Integration | Exam generator | exam generator > supports numerical questions only when enabled | Pass |
| 37 | Integration | Exam generator | exam generator > supports manual selection | Pass |
| 38 | Integration | CSV/JSON/JSONL upload | admin CSV / JSON / JSONL upload > maps custom CSV columns, validates and saves without touching existing questions | Pass |
| 39 | Integration | CSV/JSON/JSONL upload | admin CSV / JSON / JSONL upload > supports a default subject for files without a subject column | Pass |
| 40 | Integration | CSV/JSON/JSONL upload | admin CSV / JSON / JSONL upload > imports JSON arrays and JSONL, and skips duplicates of already-imported content | Pass |
| 41 | Integration | CSV/JSON/JSONL upload | admin CSV / JSON / JSONL upload > can skip flagged records on request | Pass |
| 42 | Unit | Dataset parsing & normalisation | string-encoded value parsing > converts None/null/empty to null | Pass |
| 43 | Unit | Dataset parsing & normalisation | string-encoded value parsing > parses booleans from strings | Pass |
| 44 | Unit | Dataset parsing & normalisation | string-encoded value parsing > parses Python-style list literals safely without eval | Pass |
| 45 | Unit | Dataset parsing & normalisation | difficulty normalisation > Easy → Easy | Pass |
| 46 | Unit | Dataset parsing & normalisation | difficulty normalisation > Moderate → Medium | Pass |
| 47 | Unit | Dataset parsing & normalisation | difficulty normalisation > Medium → Medium | Pass |
| 48 | Unit | Dataset parsing & normalisation | difficulty normalisation > Difficult → Hard | Pass |
| 49 | Unit | Dataset parsing & normalisation | difficulty normalisation > Hard → Hard | Pass |
| 50 | Unit | Dataset parsing & normalisation | difficulty normalisation > Tough → Hard | Pass |
| 51 | Unit | Dataset parsing & normalisation | difficulty normalisation > tough → Hard | Pass |
| 52 | Unit | Dataset parsing & normalisation | difficulty normalisation > Easy] → Easy | Pass |
| 53 | Unit | Dataset parsing & normalisation | difficulty normalisation > Moderate] → Medium | Pass |
| 54 | Unit | Dataset parsing & normalisation | difficulty normalisation > does not guess for | Pass |
| 55 | Unit | Dataset parsing & normalisation | difficulty normalisation > does not guess for Easy / Moderate/ Tough | Pass |
| 56 | Unit | Dataset parsing & normalisation | difficulty normalisation > does not guess for Modertae | Pass |
| 57 | Unit | Dataset parsing & normalisation | difficulty normalisation > does not guess for Moderate/ Tough | Pass |
| 58 | Unit | Dataset parsing & normalisation | difficulty normalisation > does not guess for null | Pass |
| 59 | Unit | Dataset parsing & normalisation | answer keys > accepts numeric and letter forms | Pass |
| 60 | Unit | Dataset parsing & normalisation | answer keys > flags out-of-range keys as invalid, missing keys as missing | Pass |
| 61 | Unit | Dataset parsing & normalisation | answer keys > normalises numerical answers | Pass |
| 62 | Unit | Dataset parsing & normalisation | answer keys > normalises subjects and types | Pass |
| 63 | Unit | Dataset parsing & normalisation | image paths > resolves dataset references to the subject folder | Pass |
| 64 | Unit | Dataset parsing & normalisation | image paths > rejects traversal and non-image files | Pass |
| 65 | Unit | Dataset parsing & normalisation | normalizeQuestion > normalises the representative string-encoded record | Pass |
| 66 | Unit | Dataset parsing & normalisation | normalizeQuestion > flags missing image files and excludes them via assetStatus | Pass |
| 67 | Unit | Dataset parsing & normalisation | normalizeQuestion > flags missing answer keys and incomplete options | Pass |
| 68 | Unit | Dataset parsing & normalisation | normalizeQuestion > classifies numerical questions and never shows them as MCQs without options | Pass |
| 69 | Unit | Dataset parsing & normalisation | normalizeQuestion > rejects records without text or subject | Pass |
| 70 | Unit | Dataset parsing & normalisation | normalizeQuestion > flags [IMAGE] placeholders without a matching image | Pass |
| 71 | Unit | Dataset parsing & normalisation | normalizeQuestion > detects image file names shared by different source papers | Pass |
| 72 | Unit | Dataset parsing & normalisation | normalizeQuestion > produces identical hashes for whitespace/case variants | Pass |
| 73 | Unit | Dataset parsing & normalisation | column mapping > suggests mappings for differing column names | Pass |
| 74 | Unit | SSRF protection | SSRF protection > 127.0.0.1 is private | Pass |
| 75 | Unit | SSRF protection | SSRF protection > 10.1.2.3 is private | Pass |
| 76 | Unit | SSRF protection | SSRF protection > 172.16.0.1 is private | Pass |
| 77 | Unit | SSRF protection | SSRF protection > 192.168.1.1 is private | Pass |
| 78 | Unit | SSRF protection | SSRF protection > 169.254.169.254 is private | Pass |
| 79 | Unit | SSRF protection | SSRF protection > 100.64.0.1 is private | Pass |
| 80 | Unit | SSRF protection | SSRF protection > 0.0.0.0 is private | Pass |
| 81 | Unit | SSRF protection | SSRF protection > ::1 is private | Pass |
| 82 | Unit | SSRF protection | SSRF protection > fd00::1 is private | Pass |
| 83 | Unit | SSRF protection | SSRF protection > ::ffff:127.0.0.1 is private | Pass |
| 84 | Unit | SSRF protection | SSRF protection > public addresses are allowed | Pass |
| 85 | Unit | SSRF protection | SSRF protection > accepts an approved HTTPS host resolving publicly | Pass |
| 86 | Unit | SSRF protection | SSRF protection > rejects http://datasets-server.huggingface.co/rows | Pass |
| 87 | Unit | SSRF protection | SSRF protection > rejects https://evil.example.com/rows | Pass |
| 88 | Unit | SSRF protection | SSRF protection > rejects https://127.0.0.1/rows | Pass |
| 89 | Unit | SSRF protection | SSRF protection > rejects https://user:pw@datasets-server.huggingface.co/rows | Pass |
| 90 | Unit | SSRF protection | SSRF protection > rejects https://datasets-server.huggingface.co:8443/rows | Pass |
| 91 | Unit | SSRF protection | SSRF protection > rejects approved hosts that resolve to internal addresses (DNS rebinding) | Pass |
| 92 | Unit | File parsers & redirect safety | JSONL parsing > handles blank lines and malformed records without throwing | Pass |
| 93 | Unit | File parsers & redirect safety | JSON + CSV parsing > accepts arrays and wrapped arrays, including HF datasets-server rows | Pass |
| 94 | Unit | File parsers & redirect safety | JSON + CSV parsing > parses CSV with quoted multi-line fields | Pass |
| 95 | Unit | File parsers & redirect safety | JSON + CSV parsing > detects formats by extension | Pass |
| 96 | Unit | File parsers & redirect safety | post-login redirect safety > only allows same-origin relative paths | Pass |
| 97 | Unit | Scoring engine | evaluate > scores 70 correct, 20 incorrect, 10 unanswered as 260/400 with +4/−1 | Pass |
| 98 | Unit | Scoring engine | evaluate > supports no negative marking and fails below passing marks | Pass |
| 99 | Unit | Scoring engine | evaluate > evaluates numerical answers with tolerance | Pass |
| 100 | Unit | Scoring engine | evaluate > treats empty numerical input as unanswered | Pass |
| 101 | Unit | Exam allocation solver | allocate > meets subject and overall difficulty totals exactly | Pass |
| 102 | Unit | Exam allocation solver | allocate > reports the exact shortage message for a subject | Pass |
| 103 | Unit | Exam allocation solver | allocate > honours subject-specific difficulty splits | Pass |
| 104 | Unit | Exam allocation solver | allocate > detects infeasible combinations even when totals look sufficient | Pass |
| 105 | Unit | Exam allocation solver | allocate > returns 'Any' cells when no difficulty split is requested | Pass |

### Load test (50 concurrent synthetic students, 30-question exam, production server on 2 vCPU)

| Step | Requests | Errors | p50 | p95 | max |
|---|---|---|---|---|---|
| signup (bcrypt) | 50 | 0 | 8.4 s | 8.5 s | 8.5 s |
| start | 50 | 0 | 600 ms | 939 ms | 956 ms |
| load attempt | 50 | 0 | 471 ms | 571 ms | 572 ms |
| autosave (one request per answer) | 1,500 | 0 | 306 ms | 406 ms | 510 ms |
| submit + evaluation | 50 | 0 | 385 ms | 436 ms | 443 ms |

1,700 requests in 19.8 s (86 req/s), 0 failed flows. Database check afterwards: 50 attempts, 50 submitted, 50 results, 0 duplicate results, every attempt had all 30 answers saved. Signup latency is CPU-bound bcrypt hashing of 50 simultaneous registrations on 2 vCPUs. Real signups are spread out, and Vercel scales functions horizontally.

## 5. Defects found during testing and fixes applied

| # | Module | Found by | Problem | Root cause | Fix | Retest |
|---|---|---|---|---|---|---|
| 1 | Dataset images | Data analysis + visual check | Wrong diagrams shown (e.g. a circuit question displays a formula from another paper) | Source papers' `image1…N` names collided when flattened into one folder | New `ambiguous_image` validation: these questions are excluded from exams until an Admin visually confirms the diagram | Unit + integration + E2E (E3) Pass |
| 2 | Exam workspace | E2E E6 | Refreshing the exam page was recorded as a tab-switch **warning** | Browser fires `visibilitychange: hidden` during unload | Ignore visibility/fullscreen signals after `beforeunload`/`pagehide`; reset on `pageshow` | E6 Pass (0/3 warnings after refresh) |
| 3 | Admin UI (mobile) | Visual QA | Horizontal overflow on the dashboard at 390 px | Grid items sized to their table's min-content | `min-w-0` on cards | Overflow check: false |
| 4 | Charts | Visual QA | Negative averages (negative marking) clipped below the axis | Fixed `[0, auto]` y-domain | Domain includes negative minimum + zero reference line | Visual Pass |
| 5 | Question previews | Visual QA | Truncated previews showed raw LaTeX | Truncation split `$…$` pairs | `previewText()` never cuts inside a formula | Visual Pass |
| 6 | Chart palette | Palette validator | Brand purple too dark / teal too grey for chart marks (lightness band + chroma floor fail) | — | Validated chart slots `#7043a1 / #d4691f / #0a8f7e` (light) and `#9b74cc / #d9732c / #1fa891` (dark): all checks PASS | Validator Pass |
| 7 | Typing | `tsc` | Mongoose 9 infers array sub-documents of lean results as `any` | Library typing | Explicit sub-document interfaces | tsc clean |
| 8 | Lint | ESLint (React 19 rules) | setState-in-effect and ref-in-render warnings | — | Deferred effect work; clock offset held in state | Lint clean |
| 9 | Test harness | E2E | Login helper raced navigation; selectors matched required-field asterisks; wizard default start time is next hour (“Upcoming”) | Test code | Wait for navigation; role-based selectors; test sets start time to now | 17/17 Pass |
| 10 | Test fixture | Integration | Duplicate Student IDs in parallel fixture creation | Shared counter read after `await` | Capture counter before await | 41/41 Pass |

| 11 | Question generator | Curated dry-run import | 8 generated logic-gate questions rejected as "fewer than four options" | Distractor text `Undefined` is a null token in the importer | Distractor changed; the generator now applies the importer's null-token and 25-character rules itself | 1,560/1,560 generated questions import with 0 issues |
| 12 | Question generator | Curated dry-run import | 6 generated questions rejected as placeholder text | Stems shorter than 25 characters | Stems lengthened | Same |
| 13 | Question generator | Manual spot check of samples | Non-integer distractors on count questions (e.g. "7.5 electrons"), negative resistance distractor, scientific notation outside `$…$` | Scaled distractors | Integer-only distractors for count answers, no non-positive distractors for physical magnitudes, notation always wrapped | Unit tests + re-sample Pass |

**Round 2 (curation + generated questions):** the local-import integration test now imports all 9 files with the curation policy and asserts: >1,000 unusable questions removed, 22 AI keys and 263 AI difficulties applied, **zero** remaining questions with missing/ambiguous images, missing keys, incomplete options or unclassified difficulty, and exactly 520 generated questions per subject. `tests/unit/question-generator.test.ts` checks for each subject: 520 unique stems, 4 distinct options, no NaN/undefined, Easy/Medium only, a solution present, and determinism by seed. An automatic cross-check confirmed that the correct option's value appears in the computed solution for 1,506/1,560 questions; the remaining 54 differ only in formatting (e.g. `g/16` vs `1/16`, `+6` vs `6`) and were reviewed by hand. E2E E3 now asserts that the curation preview appears, that P-20-Q7 (wrong diagram) is not in the bank, and that an AI-keyed question shows its reviewer note.

**Round 3 (16 Nov, evening):** the review/verify step was removed on request. Imported questions are usable straight away; rejected, archived or flagged questions are still excluded (new integration test). The Question Bank has subject tabs with counts. All text sizes are about 1–1.5px larger. 160 more generated questions per subject (110 Hard). Sidebar class-order fix merged. Re-run: lint, typecheck and build clean; 115/115 Vitest; 17/17 Playwright. E3 now checks the subject tabs and that there is no Verify button. The "insufficient questions" API test now asks for 400 Hard Chemistry questions, because the bank now holds more than 400 Chemistry questions.

**Round 4 (16 Nov, night)**

*What was added*
- Aptitude subjects, with the external bank reviewed and 545 generated questions.
- LeetCode-style Question Bank: topics list with E/M/H counts, a clickable difficulty strip, and green/amber/red difficulty colours.
- Quick Generate and Default Exam Settings.
- Wizard auto-save and resume.
- Permanent access codes and a Share dialog. QR codes removed.
- Student *Examinations* page with code entry.
- Restructured admin sidebar.
- Redesigned home, sign-in and sign-up pages, with light-orange accents.

*New tests*
- `tests/unit/quick-generate.test.ts`: apportionment, presets, titles, defaults validation, access-code format and normalisation.
- `tests/integration/quick-generate.test.ts`: defaults persist; exact distributions; new defaults don't change old exams; shortage creates nothing; code/link resolve to the same exam, are stable and backfilled once; duplicates get no code.
- Aptitude import assertions in `local-import.test.ts`.
- `tests/e2e/04-quick-generate-and-access.spec.ts`:
  - both home-page *Sign in* buttons give the same branded page at 1020 px;
  - Quick Generate PCM gives 35/35/30 and E30/M45/H25, then publish;
  - link and code are identical after refresh, after logout/login, and in All Examinations;
  - Copy link / Copy code put the exact values on the clipboard;
  - no QR anywhere;
  - invalid code shows a clear message, and lowercase codes are accepted;
  - code and link share one attempt (monitoring shows one row);
  - a closed exam's code says "no longer available";
  - Default Settings persist and drive the next aptitude exam (12/11/7);
  - the wizard draft survives navigation and can be resumed or discarded.

*Defects found and fixed in this round*

| # | Defect | Fix |
|---|---|---|
| 1 | Subject folders with hyphens rejected by the local-import API (aptitude import silently failed) | Path validation accepts `[a-z-]` folder names |
| 2 | The PCM "placeholder text" rule also removed 19 genuine short aptitude questions ("What is 25% of 400?") | Short stems are kept when they are complete questions; the PCM result is unchanged (1,095 removed) |
| 3 | Saving default settings failed with a MongoDB path conflict when the full document was sent back | Only schema-validated fields are written |
| 4 | Fast typing before the draft check finished auto-saved an empty wizard state | Auto-save always sends the latest state and flushes on leaving the page |
| 5 | Share link rendered as a bare path for one frame (could be copied incomplete) | Full URL is computed before the panel renders |
| 6 | Long links widened dialogs and hid the Copy buttons | Dialog grid uses `minmax(0,1fr)` |
| 7 | Two fields in one row stretched each other (signup Password/Confirm misaligned); selects turned grey | `Field` uses `content-start`; select background classes no longer conflict |
| 8 | Below 1024 px the sign-in page lost its brand panel and logo, so the two Sign in buttons seemed to open different pages | Brand panel from 768 px, logo and orange strip on phones |
| 9 | Long topics overlapped the Difficulty column; subject tabs overflowed | Truncation with full name on hover; short tab labels with full accessible names |

**Re-run results:** lint, typecheck and production build are clean; Vitest 131/131; Playwright 24/24. Screenshots were reviewed manually at 1440 px, 1020 px and 390 px, in light and dark mode.

No feature was removed and no mock data was introduced to make a test pass.

## 6. Blocked — require resources unavailable in this environment

| Check | Why blocked | What is needed |
|---|---|---|
| MongoDB **Atlas** connection | Outbound network restricted; all tests used a real local MongoDB 8.3 server instead | Your Atlas URI in `MONGODB_URI`; then run `npm test` and the E2E suite with `E2E_MONGODB_URI` |
| **Vercel** deployment & HTTPS permission behaviour | No Vercel credentials | Deploy per README §8; repeat E1–E8 against the deployed URL |
| Password-reset **email delivery** | No SMTP server | SMTP env vars (reset flow is tested; the admin-issued link path is tested) |
| Live **Hugging Face API** import | External network blocked | Run Import via API with a datasets-server `/rows` URL (SSRF guards are tested) |
| **Real camera/microphone** on physical devices | Automated tests used Chrome fake devices and permission mocks | Manual check on target laptops: permission prompt, preview, unplug webcam → "camera interrupted" event, loud noise → sound-level event |
| Fullscreen on Safari/Firefox, tablets | Only Chrome automated | Manual browser matrix |
| Load test at university scale | 2-vCPU sandbox | Repeat `npm run load-test` against staging with the expected number of students |

## 7. Notes

- Proctoring is browser-based and not foolproof. All integrity events are informational for human review; permission denials, disconnections and sound alerts never count as warnings.
- Coverage of visual QA: dashboard, question bank, review drawer, import, wizard, exam detail, monitoring, results, student dashboard, exam landing, exam workspace and result page in light and dark themes, plus mobile signup and dashboard.
