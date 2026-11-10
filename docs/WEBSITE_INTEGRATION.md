# Logic Legends website — local implementation and handoff

Date: 11 November 2026. Project: `LL_Website`. No commit, push, production mutation or deployment was performed.

## Implemented

| Feature | Local implementation |
| --- | --- |
| NCST accounts | New self-registered accounts and student enrollment require the exact NCST domain. Existing staff may use any verified email domain after a Super Admin grants a staff role. Firebase Auth blocking functions enforce this at provider level when deployed. |
| Account creation | Super Admin can provision Admin or Instructor users. Admin can provision Instructor users only. Super Admin elevation remains restricted to the secure bootstrap process. Instructors can provision students through their own sections. Existing email reuses its Auth UID. |
| Sections | Section selector, Add Section +, empty state, Add Student, per-student removal, ownership checks and duplicate membership prevention. Surname-first display and sorting use structured profile fields. |
| Progress | Immediate reads of `users/UID/trialRuns` for enrolled existing players. Ten-trial profile and section statistics read saved receipts. No replay/new Unity session is required when records already exist. |
| Feedback | Signed-in players submit from home/profile. Author UID and timestamp are server-owned. Admin and Super Admin management, paging and capability restriction are enforced by functions. |
| Leaderboard | One read-only snapshot, no subscriptions, existing points only. Source field must be explicitly configured; no points are invented from coins, retries or trial completions. |
| Moderation | Admin and Super Admin section with search/paging, Ban/Unban and capability restrictions. Reason + confirmation required. Audit trail, Firebase disable/revocation, and current-account checks on every private API. |

The original forest/teal/gold theme and navigation remain. Tables scroll inside their containers on narrow screens. The old sample instructor statistics were removed.

## Authentication and provisioning

Existing Firebase project: `logic-legends-ac66c`; same Auth UIDs and regional Realtime Database used by Unity. No second account store, student-specific identity, wallet or inventory was created.

Claims retain the existing boolean convention: `super_admin`, `admin`, plus `instructor`. Instructors can work only with their own sections and enrolled students. Admin and Super Admin can browse Instructor accounts, work with all their sections, and use the other administrative tools. Admin can add Instructor accounts only; only Super Admin can grant Admin, change/remove staff roles, or use the secure bootstrap for Super Admin elevation. Server checks use the current Firebase UserRecord and `verifyIdToken(token, true)`, not stale token roles or supplied email. Ordinary users still need an NCST address. Roles are not editable through player profile fields. Claims unrelated to dashboard access are retained.

The game's existing solo Admin email allowlist is unchanged. Website role assignment does not replace that game-specific authorization check; coordinate any intended unified game Admin policy separately.

Provisioning creates an unverified user with a cryptographically random inaccessible initial password. When mail is configured, invitations contain Firebase-supported email-verification and password-reset links. If staff invitation mail is unavailable, the staff role is still saved and the recipient can use Forgot Password with the assigned email, set a password, then verify it. Unverified role holders cannot use protected APIs. Failed/uncertain mail delivery preserves the same UID and reports delivery pending; resend after configuring mail.

New signup names are saved through an authenticated, NCST-only `profile-setup` endpoint. It permits only own name metadata before verification; it does not allow reading progress, changing roles or accessing a dashboard. Existing players without legal-name metadata can update their own name on Profile. The website cannot reconstruct a surname reliably from a game username, so missing metadata must be supplied rather than invented.

### Environment configuration (server only)

- `FIREBASE_SERVICE_ACCOUNT_JSON`: existing trusted project service account. Never put it in published JS, source control or chat.
- `RESEND_API_KEY` and `ACCOUNT_MAIL_FROM`: invitation delivery through a verified sender. Existing Firebase email/password verification and Forgot Password continue to use Firebase's own templates. New provisioning fails before creating an identity if mail configuration is completely missing; a transport failure after creation is reported as pending and can be retried.
- `LEADERBOARD_POINTS_FIELD`: actual numeric points child under `users/UID`, confirmed by the main programmer against production. For example, set `points` **only if that is the existing scoring field**. Without this configuration the UI explicitly reports an unconfigured source. The inspected Unity/commerce checkout contains no points writer, so no production points field has been guessed.

Keep the website's existing pinned root dependency and lockfile (`firebase-admin` 14.5.0). Use Node 22 as specified by the project. Root functions remain Netlify ESM and the existing `netlify.toml` paths are unchanged.

### Provider-level email policy — required before public release

Frontend checks alone cannot stop someone calling Firebase signup directly. `firebase/functions.mjs` supplies `ncstBeforeCreate` and `ncstBeforeSignIn`. Account creation validates the exact NCST domain. Sign-in allows an outside-domain account only when its current Firebase record has a verified `super_admin`, `admin` or `instructor` claim; sign-in also checks the server moderation flag. Super Admin provisioning accepts a valid email address from any domain. Student provisioning remains NCST-only.

Firebase Authentication **with Identity Platform** is required for blocking functions. This is a service/plan/configuration change and was **not enabled or deployed** here. Install dependencies in `firebase/`, then deploy only codebase `website-auth-policy` to the existing project after review. Register/verify the blocking triggers and test password and Google providers. Keep Firebase's one-account-per-email behavior enabled. The copy of `account-policy.mjs` inside this deployment source must match the public shared module (covered by tests).

Existing non-NCST accounts are not deleted, rewritten or stripped of gameplay records. They can sign in only after an Admin or Super Admin grants a staff role; unassigned non-NCST accounts remain blocked. Admin-created staff are limited to the Instructor role. The secure bootstrap script accepts any valid, verified email for the initial Super Admin. Do not silently change an account email or transfer progress to a new UID. Any approved email migration must preserve that UID and reverify ownership.

Firebase reference: [blocking functions](https://firebase.google.com/docs/auth/extend-with-blocking-functions), [Admin email action links](https://firebase.google.com/docs/auth/admin/email-action-links).

## Database schema and non-destructive migration

New, server-owned data:

```text
website/sections/SECTION_ID
  name, ownerUid, createdAt
  students/AUTH_UID { by, enrolledAt }
website/feedback/ID { uid, author, text, submittedAt, source, version }
website/feedbackRate/UID
website/moderation/UID
  ban { active, by, reason, at, expiresAt:null, originallyDisabled }
  restriction { active, by, reason, at, expiresAt, capabilities }
  sessionsRevokedAt
website/moderationAudit/ID { actor, target, action, reason, timestamp, expiresAt, capabilities, status }
website/roleAudit/ID { by, uid, from, role, at, status }
users/AUTH_UID/profile { surname, firstName, middleName }
```

Section IDs are deterministic per owner/code. Membership keys are Auth UIDs, so capitalization, concurrent enrollment and re-enrollment cannot produce disconnected student records. Removal deletes only that membership. Account provisioning/name setup writes only the profile child, never the whole `users/UID` object.

Do **not** replace shared database rules with a new empty website template. Export the current production rules, preserve a backup, and run:

```text
node firebase/patch-database-rules.mjs exported.rules.json reviewed.rules.json ACTUAL_POINTS_FIELD
```

The tool writes a different local output file. It retains existing rules/validations, adds owner/feedback/points indexes, denies direct access to website administration data and wraps existing authenticated access rules with ban/revoked-session checks. Public static-data rules are left public. It stops for manual review if existing website permissions conflict. Review the diff, run the shared backend's Firebase Emulator Suite rules tests, then deploy the reviewed rules separately. No live migration or rules deployment was performed.

## Statistics and retry semantics

Trial mapping matches Unity `TrialCatalog`: 1 Propositional Logic; 2 Truth Table; 3 Rules of Inference; 4 Formal vs Informal; 5 Direct/Indirect; 6 Induction; 7 Sets; 8 Functions/Relations; 9 Graphs; 10 Trees.

For each trial, read all non-Admin attempts under `users/UID/trialRuns/TRIAL/attempts`. Count boolean `quizAnswers/EVENT/correct` once per saved event. When event data is present, do not add its summary counters again. Legacy summary-only records use `correctAnswers`/`incorrectAnswers`. Truth Table follows the actual commerce implementation: main accuracy counts `kind:table`, excluding house pickup quizzes. Rules of Inference follows its existing answer receipts. Admin-used attempts do not count as educational completion or accuracy.

Accuracy = correct / (correct + incorrect) × 100. Section accuracy combines answer counts, **not the mean of student percentages**. Weakest Topic considers only answered trials, with trial number as a stable tie breaker. No answers means “No data yet.” Completed requires a non-Admin completed receipt; an unlocked-stage integer is not proof of a completed trial.

Retries come from explicit saved `run.retries` / Game Over → Try Again records. An incorrect answer never increments the displayed retry count. Start Over retains historical attempts, so profile totals cover recorded attempts rather than just the current run. Older records do not include a separate timeout-reason field: do not misrepresent this as every timer expiration, including expirations that were not retried. Missing unsynced/local-only Unity data cannot be recovered by a website query; deploy/connect the existing trial-progress sync if production does not have these receipts.

## Moderation enforcement and Unity impact

- Ban is indefinite until explicitly unbanned. This release deliberately offers no unenforced automatic ban-expiration control. It stores the reason/time and uses Firebase `disabled:true` plus token revocation. Unban does not clear a separate restriction and does not enable an account that was already disabled for another reason.
- Supported restrictions are **feedback submission** and **instructor dashboard/student-record access**, enforced on the corresponding server routes. Expired restrictions are ignored on the server. No unsupported game/chat/purchase restriction controls are shown.
- Each private request checks current account/moderation state. Partial Auth/database failures are audited as `enforcement-pending`, and the UI reports the need to review/reconcile instead of claiming success. Web bans are stored before Auth disable, so the website remains blocked after a failed downstream call.
- Firebase disable/revocation affects subsequent authentication and services that check revocation. This does **not** guarantee immediate removal from an already running Unity/Photon/offline session. The game/backend must apply the reviewed RTDB rule guards, check current moderation/token validity at entry and protected endpoints, and observe ban changes to leave multiplayer, stop protected actions and sign out. Add that Unity-side listener in a separate approved game change; no game scripts were modified for this website request.
- The existing commerce backend already verifies tokens with revocation checking, but all deployed endpoints and direct database paths still need a shared enforcement audit. Do not claim unsupported game-wide restrictions or an instant in-game kick.

Firebase reference: [session revocation and database rules](https://firebase.google.com/docs/auth/admin/manage-sessions).

## Verification and delivery status

Tests use injected in-memory Auth/RTDB, not production credentials/accounts. `tests/education-preview-server.mjs` serves the real frontend and real handlers with isolated fixtures. Never publish the test server or its fake Auth module.

Run backend tests:

```text
node --test tests/role-permissions.test.mjs tests/dashboard-accounts.test.mjs tests/education.test.mjs tests/policy-migration.test.mjs
```

Run the isolated preview with `node tests/education-preview-server.mjs`, then `node tests/browser-smoke.mjs PATH_TO_PLAYWRIGHT`. The browser script accepts `QA_BROWSER_PATH` for a local headless browser. It never automates the user's normal browser profile.

Results and remaining limitations are in `docs/VERIFICATION.md` and `output/verification/browser-results.txt`. Required live acceptance: deployed blocking functions and rules, actual invitation delivery/redemption, both real login providers, existing production progress field availability, actual points source, ban handling for existing Unity sessions, and account switching/revocation across deployed services.

No live backend data, ownership, cosmetics, wallet balance, progress or production configuration was changed. Nothing was committed, pushed, merged or published.
