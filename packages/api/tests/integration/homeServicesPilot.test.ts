import { beforeEach, describe, expect, test } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

describe("Home Services pilot journey", () => {
  beforeEach(async () => resetDatabase());

  test("provider applies, admin verifies, provider publishes an offering, customer requests and messages, admin monitors", async () => {
    const { caller: provider } = await createAuthedCaller({ role: "BUYER", phone: "+2348070000001" });
    const { caller: customer } = await createAuthedCaller({ role: "BUYER", phone: "+2348070000002" });
    const { caller: admin } = await createAuthedCaller({ role: "ADMIN", phone: "+2348070000003" });

    const application = await provider.providers.applyForVerification({ businessName: "Pilot Solar & Security", categories: ["SOLAR", "CCTV"], idDocumentUrl: "verification-doc/pilot/provider-id.pdf" });
    expect(application.verificationStatus).toBe("PENDING_REVIEW");
    await admin.providers.adminSetVerificationStatus({ providerProfileId: application.id, status: "VERIFIED", note: "Identity and business evidence checked" });

    const offering = await provider.providers.createOffering({ category: "SOLAR", title: "Residential solar installation", description: "Design and install a residential solar and battery backup system.", priceType: "QUOTE" });
    expect(offering.active).toBe(true);
    const request = await customer.serviceRequests.create({ providerProfileId: application.id, offeringId: offering.id, category: "SOLAR", note: "I need a solar system for a three-bedroom home in Abuja." });
    expect(request.messages).toHaveLength(1);
    const customerReply = await customer.serviceRequests.reply({ serviceRequestId: request.id, message: "I can share the load assessment this afternoon." });
    expect(customerReply.senderId).toBe((await db.user.findUniqueOrThrow({ where: { phone: "+2348070000002" } })).id);
    const thread = await provider.serviceRequests.byId({ id: request.id });
    expect(thread.messages).toHaveLength(2);
    const monitored = await admin.serviceRequests.adminList({ limit: 10 });
    expect(monitored.items.some((item) => item.id === request.id)).toBe(true);
    await expect(customer.serviceRequests.adminList({ limit: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
