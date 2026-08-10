# Production Audit and Test Report

**Audit date:** 2026-08-10  
**Scope:** Zuko User web app and Android WebView shell, with verified integration evidence for the adjacent CoinCall API/Host/Admin deployment.  
**Evidence rule:** A result is marked `PASS` only when it was actually built, type-checked, tested, or queried during this release-audit work. Real-device, real-money, and dashboard actions are never inferred from compilation.

## A. Executive Summary

- **Overall status:** PARTIAL
- **Production readiness score:** 35/100
- **Release recommendation:** **NO-GO**
- **Critical blockers:**
  1. Real User-to-Host device testing of camera, microphone, Agora media, reconnects, and billing has not occurred.
  2. The deployed API reported `onlineHosts: 0` and `readyHosts: 0`; the User calling lobby therefore has no callable Hosts.
  3. Browser Stripe catalog products are all `available: false`; live web Checkout cannot complete.
  4. Financial/call persistence reports `mongo+disk`, while legacy Firebase/client fallback architecture remains in other paths. Full Mongo replica-set transaction authority is not proven.
  5. The User source has no complete Privacy Policy route or account-deletion route.

### Work completed and verified

- Changed the User RTC lifecycle so `CONNECTED` is emitted only after media/Agora join and backend RTC acknowledgement both succeed.
- Removed Firebase minute-transfer fallback from the User call screen. A failed authoritative billing request now ends the call safely instead of trying a client-side debit/credit.
- Removed the direct client `/wallet/credit` alternate fallback from a live-call reserve refund helper.
- Confirmed User app production web build and TypeScript checks pass.
- Confirmed Android configuration is `com.zuko.user`, version `1.0.19`, with `CAMERA`, `RECORD_AUDIO`, and Play Billing permission. EAS remote versioning has queued the release candidate as version code `23`.
- Produced and verified the release-candidate AAB using the exact Google Play upload certificate.
- Queried deployed User/API endpoints and payment catalog without making any production mutation.

### Test evidence

| Check | Result | Evidence |
|---|---|---|
| Root TypeScript | PASS | `npx tsc --noEmit` |
| Expo shell TypeScript | PASS | `npx --prefix expo-app tsc --noEmit` |
| Root production web build | PASS | `npm run build` completed all 28 routes |
| Diff whitespace check | PASS | `git diff --check` |
| Root ESLint | FAIL | `npm run lint`: 27 remaining pre-existing errors after the release-critical call-screen repair |
| CoinCall backend tests | PASS | Earlier verified in this audit thread: 23/23 passed |
| Admin production build | PASS | Earlier verified in this audit thread |
| EAS production release candidate | PASS | `expo-app/builds/Zuko-1.0.19-code23-release.aab`; Android store AAB, `1.0.19` / code `23`, commit `895469e`; upload certificate SHA-1/SHA-256 exactly matched Play Console |
| Real User + Host camera/call test | BLOCKED | No connected authenticated test devices/accounts/Agora test evidence |
| Live Google Play test purchase / RTDN | BLOCKED | No license-tester purchase or configured proof |
| Live Stripe Checkout / webhook | BLOCKED | Catalog is unavailable for web Stripe products |

## B. Architecture Discovered

| Component | Verified architecture |
|---|---|
| User web app | Root Next.js 16.2.12 application using React 19 and Turbopack. |
| Android User app | `expo-app/` Expo/React Native WebView shell loading the deployed User web app; includes `react-native-iap` for Google Play Billing bridge. |
| Android identity/version | Package/application ID `com.zuko.user`; source version `1.0.19`. EAS remote versioning is authoritative for Play artifacts; current release candidate is code `23`. |
| Call/media | Web Agora RTC SDK (`agora-rtc-sdk-ng`) in the User app; Android permission bridge requests camera/microphone through the Expo shell. |
| Authentication | User web client stores a server-issued session in browser storage and can use Firebase Google sign-in. Legacy local OTP/local-user compatibility code remains. |
| Backend | External CoinCall Express + WebSocket API at `https://coincall-api.onrender.com/api`; health reported Agora configured, Mongo configured, and `persistence: "mongo+disk"`. |
| Realtime and Firebase | Firebase browser Auth/RTDB/FCM are optional client integrations; API/WebSocket is also used for calls and updates. |
| Payments | Native Android path uses Google Play Billing bridge and backend purchase verification endpoint. Browser path requests backend Stripe Checkout. |
| Financial UI | Wallet, gifts, live-lock, call minute billing, purchase history, and VIP flows are present in the User code. Backend must remain the authority for all balance/entitlement changes. |
| Host/Admin | Nested CoinCall repository contains Expo Host app, Express/Mongo source, and Vite Admin. Its build/type/test evidence is noted above; end-to-end role testing is not available. |

## C. Feature Matrix

| Feature | User App | Host App | Backend | Admin | Test Status | Final Status |
|---|---|---|---|---|---|---|
| Launch / production web build | PASS | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | Root production build passed | PASS |
| Email / Google sign-in | PARTIAL | BLOCKED | PARTIAL | NOT APPLICABLE | Static code only; no real account flow | BLOCKED |
| Camera / microphone permission gate | FIXED | PARTIAL | NOT APPLICABLE | NOT APPLICABLE | Manifest and code inspected; no real device | PARTIAL |
| User-to-Host call request/ringing | PARTIAL | BLOCKED | PARTIAL | NOT APPLICABLE | API currently returns no Hosts | BLOCKED |
| Agora token / join / local and remote media | FIXED | BLOCKED | PARTIAL | NOT APPLICABLE | Static lifecycle/type checks only | BLOCKED |
| Reconnect / token renewal | PARTIAL | BLOCKED | PARTIAL | NOT APPLICABLE | Code inspected only | BLOCKED |
| Server-authoritative minute billing | FIXED in User call path | BLOCKED | PARTIAL | PARTIAL | Type check only; no real ledger transaction | PARTIAL |
| Gifts / live-lock monetary transfers | PARTIAL | BLOCKED | PARTIAL | PARTIAL | No integration test | BLOCKED |
| Wallet / ledger history | PARTIAL | BLOCKED | PARTIAL | PARTIAL | Backend tests previously passed; no production reconciliation | PARTIAL |
| Google Play coin purchases | PARTIAL | NOT APPLICABLE | PARTIAL | PARTIAL | Product catalog query only | BLOCKED |
| VIP purchases / restore | PARTIAL | NOT APPLICABLE | PARTIAL | PARTIAL | Static catalog only | BLOCKED |
| Stripe Checkout | FAIL | NOT APPLICABLE | PARTIAL | PARTIAL | Web catalog reported all products unavailable | FAIL |
| Stripe webhook/refund lifecycle | BLOCKED | NOT APPLICABLE | PARTIAL | PARTIAL | No configured live webhook evidence | BLOCKED |
| Admin payment / wallet visibility | NOT APPLICABLE | NOT APPLICABLE | PARTIAL | PARTIAL | Admin production build only | BLOCKED |
| Android release signing | PASS | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | EAS AAB signature and both upload-certificate fingerprints verified exactly | PASS |
| Privacy policy / account deletion | FAIL | NOT APPLICABLE | PARTIAL | NOT APPLICABLE | No root route found | FAIL |
| Deployment availability | PARTIAL | PARTIAL | PARTIAL | PARTIAL | User site HTTP 200; API first timed out then health passed | PARTIAL |

## D. Bugs Found and Fixed

### CALL-001 — Connected state could precede successful RTC media join

- **Severity:** Critical
- **Component:** User call lifecycle
- **Root cause:** `useCallSessionEngine` set `CONNECTED` before `startUserAgoraCall()` finished. A camera/microphone, token, or Agora join failure could therefore make UI/timers treat a failed session as connected.
- **User impact:** Premature connected UI and a risk of starting downstream billing/timers before usable media existed.
- **Files changed:** `src/hooks/useCallSessionEngine.ts`
- **Repair:** Move `setState("CONNECTED")` until after Agora local-media join succeeds and `/calls/:id/rtc-connected` acknowledges the participant. Applied to normal and pre-accepted call paths.
- **Test proving repair:** `npx tsc --noEmit`; root `npm run build`.
- **Result:** FIXED IN CODE; real device/Agora verification remains blocked.

### WALLET-001 — Firebase fallback could bypass authoritative call billing ledger

- **Severity:** Critical
- **Component:** User call per-minute billing
- **Root cause:** On Express `/calls/:id/minute` failure, the User UI could fall back to `transferCallMinuteFb()`, allowing a separate client-side Firebase wallet debit/host credit.
- **User impact:** Duplicate, untracked, or non-Mongo ledger mutations during API timeouts/failures.
- **Files changed:** `src/app/call/[id]/CallSessionClient.tsx`
- **Repair:** Remove both first-minute and recurring-minute Firebase transfer fallback branches. Failed verification marks the attempt failed, refreshes wallet best-effort, informs the user, and ends the call with `billing_verification_failed`.
- **Test proving repair:** `npx tsc --noEmit`, `git diff --check`, and source scan confirms no `transferCallMinuteFb` import/call remains in this call screen.
- **Result:** FIXED IN USER CALL PATH; other financial paths remain under review.

### REFUND-001 — Live call reserve refund could attempt a second direct client credit

- **Severity:** High
- **Component:** Live-to-private-call refund helper
- **Root cause:** Failure of `creditCoinsApi()` triggered a direct fallback POST to `/wallet/credit` from the client.
- **User impact:** A failed/refused refund could be retried in a way that bypassed the intended server reservation/refund process.
- **Files changed:** `src/lib/livePrivateCall.ts`
- **Repair:** Remove the direct client fallback. The helper now retains a rolled-back local record for later reconciliation only.
- **Test proving repair:** `npx tsc --noEmit`, `git diff --check`; source scan confirms the fallback is absent from this helper.
- **Result:** FIXED IN CODE; server-side reservation recovery must be validated with integration tests.

### MEDIA-001 — Android WebView permission path was incomplete before the earlier repair

- **Severity:** Critical
- **Component:** Expo Android shell / User Agora media
- **Root cause:** Android WebView requires native runtime camera/microphone permission handling in addition to browser media capture.
- **Files changed previously in this audit history:** `expo-app/App.tsx`, `src/lib/agora.ts`
- **Repair present:** Android requests `CAMERA` and `RECORD_AUDIO` through the shell bridge; Agora acquires local tracks before joining and cleans up on failure.
- **Test evidence:** Generated Android manifest contains `CAMERA` and `RECORD_AUDIO`; TypeScript checks pass.
- **Result:** FIXED IN CODE; `BLOCKED` for physical signed-build validation.

## E. Remaining Problems

### Critical

1. **No live callable Host**
   - API health showed `onlineHosts: 0`, `readyHosts: 0`; `GET /api/hosts` returned an empty list.
   - **Required resolution:** Bring up authenticated, approved Host presence and test the full User-to-Host flow on two devices.

2. **Web Stripe Checkout is unavailable**
   - `GET /api/payments/catalog?platform=web` returned all coins/VIP products with `available: false` and no prices.
   - **Required resolution:** Securely configure Stripe secret/webhook keys and the current Stripe Price IDs on the backend deployment, register the verified webhook endpoint, then test using Stripe test mode. Do not place keys in the app or repository.

3. **Real-money / real-device test gate has not been met**
   - No evidence exists for two-device call media, reconnect, backend billing, gift transfer, live-lock charge, actual Google Play test purchase, refund, RTDN, or Stripe webhook.
   - **Required resolution:** Execute controlled license-tester and Stripe sandbox scenarios; reconcile every resulting server ledger entry against wallet balances.

### High

5. **Legacy client financial and identity surfaces remain**
   - `src/lib/walletApi.ts` still exposes client-side credit/premium requests; `src/lib/livePrivateCall.ts` still invokes server refund request; session/device IDs are sent in client headers/body.
   - **Required resolution:** Backend must derive the principal from a verified bearer/Firebase session, ignore request-body user IDs/prices/coin amounts, and enforce idempotency/role ownership server-side.

6. **Legacy Firebase/AI paths remain in the production source**
   - `src/lib/firebaseWallet.ts` still defines `transferCallMinuteFb`; `useCallSessionEngine` uses Firebase session helpers; `ai_prerecorded` / `FakeLiveVideoPlayer` remain supported paths.
   - **Required resolution:** Remove or fully isolate these from paid production flows. A prerecorded/demonstration call must never be represented as a live paid Host call.

7. **Financial persistence not proven production-safe**
   - Health reports `persistence: "mongo+disk"`.
   - **Required resolution:** Make MongoDB replica-set transactions mandatory and fail closed for every wallet, call, gift, refund, and payout mutation; use disk snapshots only for recovery/migration, never as financial authority.

8. **Lint gate still fails outside the repaired call path**
   - The release-critical call files now pass scoped ESLint, but root lint still has 27 pre-existing React lifecycle errors in unrelated UI/store/welcome files.
   - **Required resolution:** Resolve or formally justify every remaining error before publication.

### Compliance and release readiness

9. **Privacy Policy and account deletion are missing from the User source**
   - No `/privacy`, terms, or account-deletion route was found.
   - **Required resolution:** Publish an HTTPS policy and deletion request/fulfillment path, link it in app/settings/store listing, and complete Play Console account-deletion declaration.

10. **Data Safety must be completed from actual behavior**
    - Code indicates collection/processing of email/name/profile/bio, profile/chat photos, chat text, call/live activity, wallet/purchase status, install/device ID, and FCM token. Camera/microphone media is used through Agora.
    - No GPS location collection was found in the User code.
    - **Required resolution:** Declare exact collection, sharing, retention, encryption, and optional/required purpose after confirming backend, Firebase, Agora, Stripe, and Play Billing behavior. Do not claim card/CVV collection; none was found in the User app.

11. **Network security needs a production review**
    - The source now configures `usesCleartextTraffic=false` for EAS production builds; the ignored local prebuild still reflects an older development configuration. WebView mixed-content behavior still needs signed-device validation.
    - **Required resolution:** Confirm the finished production manifest and test all HTTPS media/API flows; do not re-enable cleartext without a documented necessity.

12. **API cold-start/reliability risk**
    - First health request timed out after 20 seconds; a subsequent retry returned HTTP 200 in 0.54 seconds.
    - **Required resolution:** Add production monitoring, investigate startup latency, and ensure payment/call paths show retry-safe error states without duplicate mutations.

## Release Gate

**READY TO PUBLISH: NO**

Do not submit or roll out a Production Play release until all Critical blockers are resolved, an upload-key signed AAB is verified, real device tests pass, Stripe/Google sandbox purchase verification is evidenced, and the backend financial authority is fail-closed and durable.
