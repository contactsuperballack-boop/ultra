# Services taxonomy — migration plan (MVP pilot implementation)

Status: **approved for the MVP pilot by product-owner decision (2026-11-23).** Home Services is included in the Abuja pilot. The canonical department/specialty mapping is recorded below and in `docs/HOME_SERVICES_MVP_PILOT.md`; the schema change is additive and retains all legacy enum values. Feature flags remain fail-closed and must be enabled explicitly in pilot environments.

## 1. Where the legacy enum is used

| Place | Field | Meaning |
|---|---|---|
| `ProviderProfile.categories` | `ServiceCategory[]` | trades a provider is verified for; offerings must be a subset |
| `ProviderOffering.category` | `ServiceCategory` | the trade an offering belongs to |
| `ServiceRequest.category` | `ServiceCategory` | denormalised from the offering so a request survives offering edits |
| `providers.ts`, `serviceRequests.ts` | `SERVICE_CATEGORIES` | API input validation |
| web / mobile | label maps and pickers | provider verification, offerings, requests, public lists |

Legacy values: `PAINTING`, `PLUMBING`, `FUMIGATION`, `ELECTRICAL`.

## 2. Approved departments and specialty mapping

| Department | Granular specialties | Legacy values retained |
|---|---|---|
| Smart Home Installations | `SOLAR`, `CCTV`, `SECURITY_SYSTEMS` | none |
| Luxury | `PAINTING`, `FURNITURE` | `PAINTING` |
| Electrical & Plumbing | `ELECTRICAL`, `PLUMBING` | `ELECTRICAL`, `PLUMBING` |
| Cleaning & Move-In | `CLEANING`, `MOVE_IN` | none |
| Fumigation & Pest Control | `FUMIGATION`, `PEST_CONTROL` | `FUMIGATION` |

Departments are a derived customer-facing grouping. Verification, offerings and requests store granular specialties. Existing providers are not automatically granted any newly introduced specialty.

## 3. Schema and API implementation

1. Add the seven specialty values `SOLAR`, `CCTV`, `SECURITY_SYSTEMS`, `FURNITURE`, `CLEANING`, `MOVE_IN`, `PEST_CONTROL` to the existing `ServiceCategory` enum. Retain the four legacy values.
2. Add a pure mapping in `packages/db` (`specialtyToDepartment`, `departmentSpecialties`) with unit tests, used by the API and both apps so the grouping lives in one place.
3. Nothing in `ProviderProfile`, `ProviderOffering` or `ServiceRequest` changes shape, so **no data backfill is needed**: every existing row already holds a valid specialty.

## 4. Rollout steps

1. Add the new enum values while retaining the four legacy values.
2. Ship the department/specialty mapping module and its unit tests.
3. Update API validation and web/mobile pickers to group specialties under the five departments.
4. Preserve existing provider verification exactly: a provider verified for `PLUMBING` remains eligible for Plumbing, but is **not** verified for any newly introduced specialty until an admin reviews it.
5. Run `pnpm verify:migration` and the integration suite against a clean database.
6. After migration and integration gates pass, enable `HOME_SERVICES_ENABLED` in the approved pilot environment.

## 5. Product-scope status

The five departments and their initial specialties are now specified by `docs/PRODUCT_SCOPE.md`. Any further specialty expansion requires a separate product decision and migration review.

## 6. Not touched by this plan

Production data, the `Review`/rating model, commission rules, and the home-services launch decision itself.
