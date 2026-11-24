# Stage 10 — Mobile Parity, Security & UX Refinement

## Implemented in this pass

### Mobile account and notification parity
- Added mobile notification preference controls for push, email, SMS and WhatsApp using the existing `notifications.preferences` and `notifications.updatePreferences` API.
- Kept channel availability honest in the interface: in-app history remains available, while email/SMS/WhatsApp delivery depends on provider integrations being enabled. Persisting a preference does not imply that a delivery provider is configured.
- Added a role-aware `My dashboard` shortcut from the mobile profile to the existing web dashboard routes: buyer, realtor, provider and administrator.
- Removed the hard-coded placeholder WhatsApp support number from the mobile profile. Support now uses only build-configured WhatsApp/email details, falls back to the configured web support page, and otherwise explains that no support contact has been configured.

### Security hardening
- Production Expo builds now fail configuration if `API_URL` is not HTTPS. Development builds retain the localhost default.
- Added `Permissions-Policy` to disable camera, microphone and geolocation browser capabilities by default.
- Added `Cross-Origin-Opener-Policy: same-origin` alongside the existing frame, MIME-sniffing, HSTS and referrer protections.
- No secrets or production credentials were added.

### Existing mobile capabilities retained
- SecureStore-backed access and refresh tokens.
- Proactive access-token refresh.
- Push registration and sign-out token deregistration.
- Existing buyer search, listing details, saved listings, messaging, notifications, mortgage placeholder and Home Services provider discovery.

## Explicit boundaries
- This pass improves access to existing mobile and web workflows; it does not claim that every web dashboard workflow has been rebuilt natively in React Native.
- Provider, realtor and administrator operational dashboards remain web surfaces opened from mobile.
- Email, SMS and WhatsApp delivery are still not configured merely because their preference toggles are now exposed.
- No biometric login, device attestation, certificate pinning, full CSP, offline write queue, or native Home Services request/quote lifecycle was added.
- Full CSP is still deferred until browser testing can verify Next.js hydration, model-viewer, maps and video embeds.

## Verification status
- TypeScript/TSX syntax parsing and JavaScript syntax checks are run for this archive.
- Full TypeScript typecheck, Expo prebuild, iOS/Android native builds, device testing, browser E2E, dependency audit and staging security tests require the workspace dependencies and platform toolchains; they must not be inferred from syntax parsing.
- Verify production API URL enforcement by running Expo config with `APP_VARIANT=production` and a non-HTTPS `API_URL` (expected to fail), then with the real HTTPS staging URL (expected to pass).
- Verify notification preference changes against the API for each role and confirm disabled push preferences prevent delivery.

## Release gate
1. Apply all pending Stage 03–09 migrations to a backed-up staging database.
2. Run Prisma validation/client generation, full API/web/mobile typechecks and unit/integration suites.
3. Build the Expo iOS and Android preview binaries with real staging configuration.
4. Test sign-in, refresh, sign-out token deregistration, notification preferences, support links and dashboard hand-offs on physical devices.
5. Run browser security-header checks and staging authorization tests for buyer, realtor, provider, admin and super-admin accounts.
6. Complete E2E regression across property search, enquiry, inspection, Home Services and support before pilot release.
