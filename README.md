# SGSU Smart Assessment Portal

Online examination and assessment platform for **Scope Global Skills University (SGSU), Bhopal**.
Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Radix/shadcn-style components, MongoDB (Mongoose 9) and Zod.

Workflow: **Local JSONL datasets → MongoDB question bank → Admin verification → exam generator → publish & share link → student signs up once → exam with autosave and a server-side timer → automatic evaluation → results, monitoring, analytics and Excel/CSV/PDF exports.**

---

## 1. Features

| Area | What it does |
|---|---|
| **Question import** | Local JSONL import from `src/data/` (preview → confirm, idempotent, change detection), CSV/JSON/JSONL upload with column mapping, optional API import (Hugging Face datasets-server) with SSRF protection, import history. |
| **Question bank** | Filters (subject, difficulty, type, source, status, images, issues), KaTeX rendering, diagram lightbox, review drawer, edit with live preview, verify/reject/archive, bulk actions. |
| **Validation** | Safe parsing of `"True"`, `"None"` and `"['images/x.png']"` (no `eval`); difficulty synonyms (Moderate→Medium, Tough/Difficult→Hard, unknown→Unclassified); answer-key checks; missing-image detection; duplicate detection by content hash. |
| **Exam generator** | 5-step wizard: exact subject counts, per-subject topics, overall and/or per-subject difficulty split (solved exactly with max-flow), sources, numerical toggle, manual selection, marking scheme, shuffling, result release, security policy. Preview with answers, replace a question, regenerate, publish. Never fabricates questions. |
| **Sharing** | Unique link (`/exam/<slug>-<random>`), copy, Web Share, QR download, close, duplicate, archive. |
| **Students** | Permanent accounts (unique Student ID), signup/login that returns to the original exam link, password reset (email or Admin-issued link), profile, dashboard, history, results. |
| **Exam workspace** | Server-authoritative timer, autosave queue (survives refresh/offline), question palette with 5 states, mark for review, clear response, keyboard shortcuts, KaTeX, zoomable diagrams, submit confirmation. |
| **Integrity** | Configurable fullscreen, tab-switch and fullscreen-exit warnings (deduplicated, 3rd confirmed violation finalises), optional camera (local preview only), microphone and relative sound level (computed in the browser, nothing recorded), accommodation requests, network events. All events are reviewable, and informational events are never treated as misconduct. |
| **Evaluation** | Idempotent finalisation (concurrent submits create one result), configurable +/− marking, subject and difficulty breakdown, timeout auto-submit, Admin finalise/reset with audit log. |
| **Admin** | Dashboard KPIs and charts, monitoring (15 s refresh), results with search/sort/filter/pagination, attempt detail, analytics, student management, settings (system status, admins, audit log). |
| **UX** | Light/dark theme (persisted), collapsible sidebar, breadcrumbs, skeletons, empty and error states, confirmation dialogs, responsive layouts, keyboard and screen-reader friendly. |

## 2. Project structure

```text
sgsu-exam-portal/
├── public/
│   ├── branding/                 # SGSU logo (light/dark variants, mark)
│   └── questions/{physics,chemistry,mathematics}/images/   # browser-safe diagrams only
├── src/
│   ├── app/                      # App Router pages + /api route handlers
│   ├── components/               # ui primitives, layout, admin, student, exam, question, charts
│   ├── data/{subject}/{train,test}.jsonl   # read-only datasets (contain answers → NOT in public/)
│   ├── data/DATASET_INFO.json    # dataset name / licence / attribution
│   ├── hooks/  lib/  models/  services/
│   └── proxy.ts                  # Next 16 "proxy" (formerly middleware): optimistic auth gate
├── scripts/                      # create-admin, import-local-questions, generate-asset-manifest, load-test
├── tests/{unit,integration,e2e}/
└── docs/TESTING_REPORT.md
```

## 3. Local setup

Requirements: **Node.js ≥ 20.19** (tested on 22) and a MongoDB server (Atlas, or local MongoDB 7/8).

```bash
npm install
cp .env.example .env.local           # then fill in the values (see §5)
npm run seed:admin                   # creates the first administrator from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                          # http://localhost:3000
```

Sign in with the admin account, then go to **Import Questions → Local dataset → Select all → Preview import → Import**.

## 4. MongoDB Atlas configuration

1. Create a cluster (the free M0 tier is fine for evaluation). The app does not need multi-document transactions; atomicity comes from conditional updates and unique indexes.
2. **Database Access** → add a database user with *readWrite* on the app database.
3. **Network Access** → allow your IP for local development. For Vercel, allow `0.0.0.0/0` (Vercel has no fixed egress IPs) or use Vercel's Atlas integration / private networking.
4. Copy the connection string with the database name, e.g.
   `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/sgsu_exam_portal?retryWrites=true&w=majority`
5. Indexes, including the unique indexes that enforce one attempt per exam, one result per attempt and duplicate-free imports, are created automatically on first connection.

## 5. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | ✔ | MongoDB connection string including the database name |
| `AUTH_SECRET` | ✔ | 32+ random characters; keys the HMAC of session and reset tokens. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `APP_URL` | ✔ (prod) | Public base URL, used in reset links (exam links use the browser origin) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | for `seed:admin` | Initial administrator |
| `MONGODB_DNS_SERVERS` | optional | DNS used for Atlas `mongodb+srv://` lookups (default `1.1.1.1,8.8.8.8`; `off` = system DNS). Fixes `querySrv ECONNREFUSED` on some networks |
| `APPROVED_IMPORT_HOSTS` | optional | Comma-separated HTTPS hosts allowed for API import (default `datasets-server.huggingface.co`) |
| `IMPORT_API_TOKEN` | optional | Bearer token sent to approved import hosts (server-side only) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | optional | Password-reset email. Without SMTP, reset links are logged on the server and Admins can issue a reset link from **Students → student → Generate reset link**. |
| `CRON_SECRET` | optional | Protects `/api/cron/finalize-attempts` (Vercel Cron sends it as a Bearer token) |
| `MONGODB_POOL_SIZE` | optional | Connection pool size (default 10) |
| `NEXT_PUBLIC_UNIVERSITY_TIMEZONE` | optional | Default time zone for new exams and templates (default `Asia/Kolkata`) |

Secrets are only read on the server; nothing is exposed to the browser.

## 6. Dataset import

**Website (recommended):** Admin → Import Questions → Local dataset. Files in `src/data/{physics,chemistry,mathematics}/` are detected automatically; subjects with no files are shown as *Not yet imported*. The preview shows files detected, total records, valid MCQs, numerical questions, missing answer keys, missing images, duplicates, already-imported and changed records. Confirming adds valid records to the Question Bank, where they can be used in exams straight away (no separate review step). Questions with open issues are kept out of exams automatically, and an Admin can **Reject** or **Archive** any question.

**CLI (optional, e.g. for initial production seeding):**

```bash
npm run import:local -- --dry-run            # statistics only
npm run import:local                         # all files
npm run import:local -- physics/train.jsonl  # selected files
npm run import:local -- --update-existing    # apply changes from the source files
```

Imports are idempotent. Questions are identified by a content hash (subject + type + normalised text + options) plus a stable source key (file + question id + occurrence). Re-importing inserts nothing new. Changes in the source are reported and applied only when *Update existing* is chosen; a change to the answer key, text or images resets verification to *pending*.

**Adding images:** place them in `public/questions/{subject}/images/` and reference them as `images/<file>` in the dataset. `npm run build` regenerates `src/data/asset-manifest.json` so serverless functions can validate image references.

### Findings from the provided `JEE_PCM_Complete.zip` (please read)

| Finding | Count | Handling |
|---|---|---|
| Records | 2,307 (Physics 768, Chemistry 738, Maths 801) | — |
| Empty question text | 8 | Rejected (listed in import history) |
| Exact duplicate questions | 61 | Imported once |
| **Image file names shared across different source papers** | **1,296 questions** | Each source `.docx` numbered its images `image1…imageN`, and they were flattened into one folder per subject, so e.g. `physics/images/image17.png` is referenced by 18 papers but only one file survived. For example, P-20-Q7 (a circuit) currently shows a double-slit formula. These questions are flagged **“ambiguous image”** and cannot be verified until an Admin opens the review drawer, checks the diagram and ticks *“I have checked the diagram(s)…”*. **Recommended fix:** re-export the images with paper-specific folders or names and re-import with *Update existing*. |
| Missing image files (`chemistry/images/image1,10,11,12.png`) | 24 questions | Flagged; excluded from exams |
| `[IMAGE]` placeholders inside options | 66 | Flagged (option images are not in the dataset) |
| MCQs with fewer than 4 options | 482 | Flagged |
| Out-of-range answer keys (e.g. `5`) / missing keys | 316 / 127 | Flagged; never guessed |
| Unrecognised difficulty (`""`, `Easy / Moderate/ Tough`, `Modertae`) | 252 | Set to *Unclassified*; the Admin sets it while reviewing |
| Garbled legacy Hindi-font text (Kruti Dev) mixed into some questions | not auto-detected | Visible during review; edit or reject |
| **Usable immediately after review** (without curation) | **768 (577 MCQs: Physics 80, Chemistry 214, Maths 283; 191 numerical)** | Superseded by the curation policy and generated questions below |

### Curation policy and generated questions (applied by default)

The Local dataset page has **Apply curation policy (recommended)**, ticked by default (CLI: on unless `--no-curation`). With it on:

- **AI-solved answer keys (22)** and **AI-assigned difficulty (263)** come from `src/data/curation.json`, keyed by `file#question_id#occurrence`. Every such question carries a *Reviewer notes* box in the review drawer ("Answer key solved by AI reviewer — please confirm"), so an Admin still confirms it before verifying. Keys that could not be solved with certainty (placeholder text, flawed or figure-dependent questions) were not invented; those questions are removed.
- **Unusable questions are removed** rather than imported: missing or unverifiable question figures (shared image names), option images that don't exist, fewer than four options, no or invalid answer key, placeholder text. The preview lists every removed question with its reason. Solution figures that can't be verified are stripped, and the text solution is kept.
- **Original generated questions:** `src/data/{subject}/sgsu_generated.jsonl` holds 520 Easy/Medium questions per subject, and `sgsu_generated_2.jsonl` holds 160 more per subject (110 Hard, 30 Medium, 20 Easy). The Hard set is multi-step JEE Main level (friction on inclines, collisions, LCR, buffers, Nernst, Arrhenius, Bayes, skew lines, onto functions…), from `scripts/generator/hard.ts`. Together they come to 680 per subject (Class 11–12 / JEE Main level, Easy and Medium, with step solutions). They come from `npm run generate:questions` (`scripts/generator/`): seeded, parameterised templates where the **answer is computed from the same numbers shown in the question**, so the key is correct by construction. Distractors are typical mistakes (wrong formula, missed factor, sign error). There are 66 Physics, 43 Chemistry and 65 Mathematics templates spanning the syllabus. The source paper is labelled *SGSU Question Generator v1 (computed answers)*. Like everything else, they can be used in exams immediately.

Bank after a full curated import: **3,235 questions — Physics 896, Chemistry 1,136, Mathematics 1,203** (2,901 MCQs, 334 numerical), with 0 open issues.

To change the generated bank: `npm run generate:questions -- --per-subject 600 --seed 7`, then re-import.

### Aptitude subjects (added 16 Nov 2026)

Three more subjects: **Quantitative Aptitude, Logical Reasoning, Verbal Ability** (`src/data/{quantitative-aptitude,logical-reasoning,verbal-ability}/`).

- `aptitude_platform.jsonl` comes from the uploaded *aptitude-test-platform* `question_bank.json` (600 MCQs), converted by `scripts/data/convert_aptitude_platform.py`. Here is what happened to them:
  - **46 dropped**: their options were single placeholder letters.
  - **554 imported**. Currency `$` is escaped, inline "Options: A) …" stems got real options, and wrong-unit distractors (e.g. "4 workers" for a days answer) were replaced.
  - **392 of the 554 are usable in exams.**
  - **162 stay in the bank as *Rejected*, with the reason shown.** These are answers the source itself marks "requires re-solving", wrong blood relations, inconsistent coding rules, and option sets that are unrelated or repeat the same choice. An admin can fix and restore any of them.
- `sgsu_generated.jsonl` holds **545 original questions**:
  - Quant 200, Reasoning 200, Verbal 145, in Easy, Medium and Hard.
  - Numeric answers are computed from the question; verbal items come from hand-checked tables.
- Bank after a full import: **4,334 questions**, of which 4,172 are usable in exams.

### Create Examination: Quick Generate and Custom Generate

- **Quick Generate** (default): select subjects and click *Generate examination*. Everything else comes from **Admin → Default Exam Settings** (stored in MongoDB, model `ExamDefaultConfiguration`):
  - Total, duration, difficulty %, PCM and Aptitude subject presets (other combinations are split evenly), marking, pass %, shuffling, security rules, result visibility and validity days.
  - Counts use largest-remainder rounding, so they always add up to the total.
  - The exam stores a snapshot of the settings it used. Later changes never alter existing exams.
  - If the bank is short, nothing is created and the exact shortage is shown, with a switch to Custom Generate.
- **Custom Generate**: the full wizard. It **auto-saves as a draft** to MongoDB (`WizardDraft`, one per admin) while you work, and offers *Resume draft / Discard* on the next visit.

### Sharing: link and access code (QR codes removed)

- Publishing creates a permanent link and a permanent **access code** (`SGSU-XXXXXX`, crypto-random, unique index).
- Admins can copy both at any time from the exam page or **All Examinations → ⋯ → Share / Copy link / Copy exam code**. The same values are shown after refresh, logout or redeploy.
- Students can use either:
  - open the link, or
  - sign in and go to **Examinations → Have an examination code?** (also on the home page). Code lookups are rate-limited.
- Both resolve to the same exam page, so login and the one-attempt rule are enforced in one place. A student who used the link and then the code resumes the same attempt.
- Closed or expired exams accept no new attempts. Their code is kept for reference.
- QR generation, display, download and the `qrcode` package have been removed.

### Exam templates, scheduling and network recovery (added 17 Nov 2026)

- **Exam Templates** (*Examination Management → Exam Templates*, model `ExamTemplate`):
  - Save subjects and counts, difficulty, topic filters, shuffling, marking and pass %, duration, security, result settings and scheduling defaults. A template never stores questions, attempts, links or codes.
  - Start from the PCM, Aptitude or Semester example, or from blank. All values stay editable.
  - Actions: edit, duplicate, set as default, archive and restore. Archived templates are not offered for new exams.
  - **Create Examination → Create from Template**: pick a template, adjust, then *Generate examination*. The paper is drawn from the question bank and opens as a draft for review. Nothing is published without confirmation.
  - Each exam keeps `appliedTemplateSnapshot`, so later template edits never change it.
- **Scheduling**:
  - Choose *Start immediately* (open for a validity period after publishing) or *Schedule examination* (start/end date and time with a time zone, Asia/Kolkata by default).
  - Times are stored in UTC and shown in the exam's zone.
  - States: Draft → Scheduled → Active → Expired, plus Closed and Archived. They are calculated from server time on every request (no cron needed). The start API enforces the same rules, so calling it directly cannot bypass them.
  - *Exam Details → Schedule & availability → Edit schedule* changes the window. A start time can no longer move once the exam has opened. Link and code never change.
  - **Attempt deadline policy**: by default, a student who starts before the end time gets the full duration. With **Hard end time** on, attempts end at the end time.
  - Students who opened an exam get in-app notices on their dashboard: upcoming, available, closing soon and expired.
- **Network recovery**:
  - Every answer change gets a client sequence number and is queued on the device (`localStorage`, owner-checked, no answer keys) until the server confirms it.
  - The server ignores older or duplicate updates and uses optimistic concurrency (`serverRevision`), so retries and out-of-order requests cannot overwrite a newer answer.
  - On reconnect, `POST /api/attempts/[id]/sync` verifies the session, applies queued changes and returns the authoritative status, deadline, answers and warnings.
  - Refresh or reopen restores the same attempt, answers, question and timer.
  - A Submit made while offline stays *pending* and is sent once the connection returns.
  - Network loss is never counted as a warning.

The dataset's licence is not stated in the provided files. `DATASET_INFO.json` records this, and each question keeps its original source paper in `originalSource`.

## 7. Scripts

| Command | Description |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | Develop / production build (generates the asset manifest) / serve |
| `npm run lint` · `npm run typecheck` | ESLint (flat config) · `tsc --noEmit` |
| `npm test` | Vitest unit + integration tests; integration tests need MongoDB at `MONGODB_TEST_URI` (default `mongodb://127.0.0.1:27017`) and create and drop their own databases |
| `npm run test:e2e` | Playwright against `next start` on port 3100 with database `sgsu_e2e` (dropped at start). Set `CHROME_PATH` if Chrome is not at `/usr/bin/google-chrome`; run `npm run build` first. |
| `npm run seed:admin` · `npm run import:local` | CLI admin creation · CLI dataset import (`--dry-run`, `--no-curation`, `--show-removed`) |
| `npm run generate:questions` | Regenerates the generated question files for all six subjects (PCM files are byte-for-byte stable) |
| `python3 scripts/data/convert_aptitude_platform.py <question_bank.json> src/data` | Re-converts the external aptitude bank with the review rules |
| `npm run load-test` | `BASE_URL=… EXAM_TOKEN=<share token> STUDENTS=50 npm run load-test` |

## 8. Production build & Vercel deployment

1. Push the repository to GitHub, then **Vercel → New Project → Import**. The framework preset is detected as Next.js.
2. Add the environment variables from §5 (Production and Preview). `APP_URL` = your Vercel domain.
3. Deploy. `next.config.ts` traces `src/data/**` into the import routes, and `prebuild` writes the image manifest. Datasets are read-only; nothing writes to the filesystem at runtime.
4. After the first deploy: run `npm run seed:admin` locally against the production `MONGODB_URI` (or temporarily set the env vars and run it once), sign in, and import the local dataset from the Admin UI.
5. **Cron:** `vercel.json` schedules `/api/cron/finalize-attempts` daily, which is valid on the Hobby plan. Expired attempts are also finalised lazily whenever monitoring, results or the attempt itself is loaded, and the student's browser auto-submits at zero. On Pro you can change the schedule to `*/5 * * * *`.
6. Limits to know: Vercel request bodies are capped at about 4.5 MB, so the upload UI accepts files up to 4 MB (use the CLI for larger files). Long imports declare `maxDuration = 60`.
7. Camera, microphone and fullscreen need HTTPS (Vercel provides it). `Permissions-Policy` allows them only for this origin.

## 9. Security notes

- Passwords: bcrypt (cost 11). Sessions: random 256-bit tokens in `httpOnly`, `SameSite=Lax`, `Secure` (prod) cookies, stored only as HMAC-SHA256 hashes, 14-day expiry, revoked on password reset or account disable.
- Every API route checks role and ownership on the server (`requireAdmin` / `requireStudent` plus attempt ownership). `proxy.ts` is only an optimistic redirect.
- Answer keys live in `answerKeySnapshot`, which student endpoints never select; they are released only through the result endpoint after the configured release.
- Rate limits (MongoDB-backed, so they work across serverless instances): login 10/15 min per email+IP, signup 20/h per IP, password reset 10/h per IP. They rely on `x-forwarded-for`, which Vercel sets; behind another proxy, make sure it overwrites that header.
- API import: HTTPS only, approved hosts only, no IP literals, credentials or custom ports, DNS results checked against private ranges, redirects not followed, 15 s timeout, 10 MB cap. The host allowlist also mitigates DNS rebinding.
- CSV exports escape formula injection. PDF/Excel are generated server-side.
- Proctoring is browser-based and **not foolproof**. Events are technical signals for human review. No video or audio is recorded or uploaded, and no biometrics are used.

## 10. Design decisions

- **Exam versions:** generating a paper creates a new version with frozen `ExamQuestion` snapshots; publishing freezes it, so later question-bank edits never change a live exam.
- **One attempt:** partial unique index on `(examId, studentId)` where `isCurrent = true`. Admin reset flips the old attempt to `isCurrent: false` (kept for audit, its result marked `superseded`).
- **Deadline:** `min(start + duration, exam end)`, with a 5-second grace for in-flight autosaves.
- **Question shuffling** happens within subject sections (Physics → Chemistry → Mathematics); option shuffling is per attempt, and option ids are the original indices.
- **Warning coalescing:** a unique `clientEventId` makes delivery idempotent, and a 2-second window counts one browser action (e.g. tab switch + fullscreen exit) as a single warning. Refreshing the page is not a violation.
