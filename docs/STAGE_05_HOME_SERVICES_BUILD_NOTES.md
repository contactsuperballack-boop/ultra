# Stage 05 — Home Services appointment refinements

This is an addendum to [`STAGE_05_BUILD_NOTES.md`](STAGE_05_BUILD_NOTES.md), which documents the complete one-time, installation-project, recurring-agreement and bulk-request implementation.

This addendum records the one-time appointment and service-location improvements:

- `ServiceRequest.preferredAt` stores the customer's requested appointment separately from the provider-confirmed `scheduledAt`.
- The customer request form collects a service address for all transaction types and an optional preferred appointment for one-time work.
- Preferred and confirmed appointment times must be future dates. If the customer supplies a preferred time, the provider must confirm an appointment before accepting.
- Provider, customer and admin interfaces distinguish preferred and confirmed appointment times.
- Service addresses are customer-supplied operational details and are not verified property addresses or public listing coordinates.

Integration tests cover preferred-time capture, rejection of past times, and the requirement for provider confirmation before acceptance. Tests have been added but not executed in this environment.
