# Website verification

11 November 2026. Local checkout only; no deploy, commit, push or production account/database changes.

## Completed checks

- **39 backend/policy regression tests**: verified NCST domain normalization, current-account role checks, stale/revoked token denial, unverified activation boundaries, new instructor/student provisioning, concurrent identity reuse, invitation failure/retry, section ownership, duplicate enrollment, membership-only removal, surname sorting, immediate existing-player progress, answer-weighted statistics, profile access, feedback attribution, read-only points snapshot, capability restrictions, expiration, ban/unban separation and audit records.
- **Headless Chrome browser tests at 1440×900 and 390×900**: actual frontend plus actual handlers with injected in-memory Firebase Auth/RTDB. Created empty sections, enrolled an existing player and saw their 75.0% recorded progress immediately, provisioned a new student, verified sorting and all ten profile rows, provisioned an instructor, applied/removed a feedback restriction, submitted/read feedback and displayed a points snapshot. No page-level JavaScript exceptions or global horizontal overflow in checked dashboard/home views.
- Production Netlify function modules import successfully with Firebase Admin 14.5.0.
- Optional Firebase Auth policy exports load with Firebase Functions 7.4.0 / Firebase Admin 14.5.0. No policy was deployed or invoked against real users.
- JavaScript syntax checks passed across all 41 frontend, Netlify, Firebase, test and helper-script files. Runtime used for local checks: Node 24.22.1; deployment configuration retains Node 22.
- Database migration fixture verifies preservation of existing wallet validations/indexes and the input file, and addition of ban/revocation guards. Shared/public Auth policy copies match.

During browser QA, the inherited confirmation-dialog flex style pushed larger form controls outside their click area. The shared dialog override now lays these forms out vertically. Newly reused toolbar buttons/selectors were also given the existing profile button styling. Both responsive flows passed afterward. A test-only feedback-rate collision between widths was resolved by using distinct fixture accounts; production throttling was retained.

## Evidence and reproduction

- `output/verification/browser-results.txt`: browser pass details.
- `output/verification/backend-results.txt`: final Node test output.
- `output/verification/screenshots/`: local, Git-ignored visual captures.
- `npm test`: backend and migration checks.
- `npm run preview:qa`: isolated test server; no credentials needed.
- `npm run test:browser -- PATH_TO_PLAYWRIGHT`: browser checks; set `QA_BROWSER_PATH` if using an installed headless Chrome/Edge binary.

The preview server is not Netlify's publish output and must never be deployed as an authentication service. No fake Auth override exists in the published frontend.

## Not verified live

These are local fixture/browser results, **not** production Firebase Emulator Suite or deployed-service acceptance results. Still required:

1. Configure server credentials and verified invitation sender; deliver and redeem real verification/password-setup links using test NCST accounts.
2. Verify an NCST Super Admin exists before activating the strict policy; preserve legacy accounts/UIDs and plan any approved email changes separately.
3. Enable the required Identity Platform capability and deploy/register the two blocking hooks. Confirm direct Firebase signup and Google sign-in reject other domains.
4. Review the additive rules migration against a current production export and execute the shared backend's emulator rules tests before deployment.
5. Confirm the real points field and set `LEADERBOARD_POINTS_FIELD`; no points writer was found in the inspected game checkout, so production configuration cannot be guessed.
6. Check production availability of `users/UID/trialRuns` receipts. Unsynced/local-only game history is not accessible to the website until the existing game sync is connected.
7. Validate ban/revocation across deployed services, direct RTDB paths and active Unity/Photon sessions. The website does not claim an immediate in-game kick or game-wide capability restriction.

See `docs/WEBSITE_INTEGRATION.md` for schema, authorization, migration and main-programmer setup details.
