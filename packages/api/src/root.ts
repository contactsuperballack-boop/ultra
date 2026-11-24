import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { listingsRouter } from "./routers/listings";
import { inquiriesRouter } from "./routers/inquiries";
import { realtorsRouter } from "./routers/realtors";
import { savedListingsRouter } from "./routers/savedListings";
import { savedSearchesRouter } from "./routers/savedSearches";
import { notificationsRouter } from "./routers/notifications";
import { paymentsRouter } from "./routers/payments";
import { uploadsRouter } from "./routers/uploads";
import { providersRouter } from "./routers/providers";
import { serviceRequestsRouter } from "./routers/serviceRequests";
import { adminRouter } from "./routers/admin";
import { inspectionsRouter } from "./routers/inspections";
import { developmentsRouter } from "./routers/developments";
import { dashboardsRouter } from "./routers/dashboards";
import { supportRouter } from "./routers/support";

export const appRouter = router({
  auth: authRouter,
  listings: listingsRouter,
  inquiries: inquiriesRouter,
  inspections: inspectionsRouter,
  developments: developmentsRouter,
  dashboards: dashboardsRouter,
  support: supportRouter,
  realtors: realtorsRouter,
  savedListings: savedListingsRouter,
  savedSearches: savedSearchesRouter,
  notifications: notificationsRouter,
  payments: paymentsRouter,
  uploads: uploadsRouter,
  // Priority-checklist fix — general "find any account" admin tool,
  // closing the gap where only realtors/providers (and only via
  // admin/payments' narrow use of their search endpoints) could be
  // looked up, never a plain buyer. See routers/admin.ts for the full
  // reasoning.
  admin: adminRouter,
  // Phase 2 — Home Services (Blueprint §13)
  providers: providersRouter,
  serviceRequests: serviceRequestsRouter,
});

// Exported so both the Next.js API route and the Expo app can share
// a fully-typed client without duplicating request/response shapes.
export type AppRouter = typeof appRouter;
