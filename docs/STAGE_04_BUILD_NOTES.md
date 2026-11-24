# ULTRA — Stage 04 Build Notes

**Scope:** Core property marketplace completion — discovery and trust signals.

## Implemented

### Saved-search alerts
- Added `SavedSearch` to Prisma with owner relation, category/type, text, price, bedroom/bathroom and verified-realtor criteria.
- Added authenticated `savedSearches` tRPC procedures: list, create, enable/disable alerts and delete.
- Added a save-search-alert flow to the property browser and a saved-search management page. Filters are restored when a buyer reopens a saved search.
- Added `SAVED_SEARCH_MATCH` notifications. Alerts are generated only after an administrator changes a listing to `LIVE`; pending, rejected and removed listings do not trigger them.
- Alert matching checks listing type, property category, area/text, price range, bedroom/bathroom minima and verified-realtor requirement.
- Notifications use the shared notification helper, so in-app history is durable and push delivery is best-effort when a user has a registered token.
- Saved searches are private to their owner. API mutations are rate-limited; users can create at most 20 saved searches.

### Photo-based duplicate review
- Added browser-side 64-bit difference hashing (dHash) before image optimisation/upload.
- The listing creation API accepts optional 16-character hexadecimal dHash values and stores them in `ListingPhoto.contentHash`.
- Duplicate candidate lookup now includes same-area listings and, when the new listing has hashes, listings with stored image fingerprints across areas, so perceptually similar reused photos can be detected.
- Duplicate detection compares 64-bit dHash values with a Hamming-distance threshold of six bits; legacy/non-dHash values still use exact-match comparison. Added an index on `ListingPhoto.contentHash` for candidate lookup.
- Image matches contribute to the existing duplicate review score. They never auto-delete or auto-reject a listing; the existing human moderation queue remains the decision point.
- Hash calculation is best-effort: unsupported or malformed image decode skips the signal rather than blocking a valid listing submission.

### Search quality
- Added minimum bathroom filtering to the public listing search API and browser filters.
- Added buyer-facing Saved properties and My inspections pages, linked from Account. Inspection actions are exposed from the existing shared state machine.
- Added side-by-side comparison for up to four properties, persisted locally in the browser. The comparison API returns LIVE listings only and preserves the buyer's selected order.
- Tightened saved-listing API access: buyers can only save LIVE listings and the saved-property list excludes listings that are no longer public. Account deactivation now deletes the user's saved properties and saved-search preferences.
- Land searches ignore bedroom, bathroom and building-category filters.
- Rental price labels now respect `PER_MONTH` versus `PER_YEAR` on listing cards and detail pages.

### Navigation and notifications
- Added Saved searches to signed-in navigation.
- Saved-search notifications link directly to the matching listing.

## Tests added or updated
- Duplicate-detection unit tests for near-identical dHash values and dissimilar values.
- Search-filter unit test confirms land ignores bedroom/bathroom filters.
- Listing integration test for minimum bathroom search.
- Listing integration test confirms comparison excludes non-public listings and preserves selection order.
- Saved-listing integration test for non-public listing protection.
- Inspection integration test for buyer dashboard ownership and available actions.
- Listing integration test for matching image hashes across different areas.
- Saved-search integration tests for owner isolation, alert toggling, deletion, authentication and publish-triggered matching notifications.
- Integration reset helper now clears `SavedSearch`.

## Explicitly not included in this stage

- Map-based search with property markers. The current Listing model has no coordinates and the product requires approximate-location privacy by default. A proper implementation needs an explicit location capture/geocoding and map-provider decision; this stage does not invent coordinates or display misleading pins.
- Email alerts. Saved-search notifications currently use the existing in-app notification record and registered push-token path; email delivery requires an email provider and verified templates/configuration.
- Background job infrastructure. Matching runs inline after a successful moderation decision at current pilot scale. A queue should replace this before high-volume launch.

## Verification status

- TypeScript/TSX syntax transpilation: 219 workspace source files parsed; zero syntax diagnostics. Package manifest JSON validation passed. A direct dHash near-match check passed.
- Prisma schema validation/client generation: not run (Prisma CLI/dependencies unavailable in this environment; Corepack could not download pnpm because registry access is unavailable).
- Unit/integration tests: added/updated but not executed (no installed workspace dependencies or test PostgreSQL/Redis services available in this environment).
- Next.js typecheck/build: not run.
- Migration baseline: not generated; Stage 03 migration verification remains the required release gate.

Do not describe Stage 04 as fully verified until the local install, Prisma generation/migration, test suite and web build pass.
