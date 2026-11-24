import { describe, test, expect, beforeEach } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

describe("provider public profile (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function provider(phone: string, categories: ("PAINTING" | "PLUMBING" | "FUMIGATION" | "ELECTRICAL" | "SOLAR" | "CCTV" | "SECURITY_SYSTEMS" | "FURNITURE" | "CLEANING" | "MOVE_IN" | "PEST_CONTROL")[] = ["PAINTING"]) {
    const { caller } = await createAuthedCaller({ role: "PROVIDER", phone, provider: { businessName: "Seentrad Coatings", categories } });
    const profile = await db.providerProfile.findFirstOrThrow({ where: { user: { phone } } });
    return { caller, profile };
  }

  test("contact person, start year, specialties, equipment and videos are saved and shown publicly", async () => {
    const { caller, profile } = await provider("+2348060000001");
    await caller.providers.updateProfile({
      contactName: "Umar Sani",
      contactRole: "COO",
      operatingSince: 2019,
      specialties: ["Wall paintings", " luxury POP screeding ", "wall paintings", ""],
      equipment: ["Airless sprayers"],
      proofVideoUrls: ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    });
    const pub = await caller.providers.byId({ id: profile.id });
    expect(pub.contactName).toBe("Umar Sani");
    expect(pub.contactRole).toBe("COO");
    expect(pub.operatingSince).toBe(2019);
    expect(pub.specialties).toEqual(["Wall paintings", "luxury POP screeding"]);
    expect(pub.equipment).toEqual(["Airless sprayers"]);
    expect(pub.proofVideoIds).toEqual(["dQw4w9WgXcQ"]); // same video pasted twice is stored once, as an ID
  });

  test("a bad video link is rejected by name and nothing is saved", async () => {
    const { caller, profile } = await provider("+2348060000002");
    await expect(caller.providers.updateProfile({ proofVideoUrls: ["https://youtu.be/dQw4w9WgXcQ", "https://vimeo.com/123"] })).rejects.toThrow(/vimeo\.com\/123.*isn't a YouTube link/);
    const row = await db.providerProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(row.proofVideoIds).toEqual([]);
  });

  test("the public profile never exposes private fields", async () => {
    const { caller, profile } = await provider("+2348060000003");
    const pub = (await caller.providers.byId({ id: profile.id })) as Record<string, unknown>;
    for (const secret of ["commissionOwedNaira", "idDocumentUrl", "cacRegistrationNo"]) expect(pub).not.toHaveProperty(secret);
  });

  test("clearing the lists works", async () => {
    const { caller, profile } = await provider("+2348060000005");
    await caller.providers.updateProfile({ specialties: ["Painting"], proofVideoUrls: ["https://youtu.be/dQw4w9WgXcQ"] });
    await caller.providers.updateProfile({ specialties: [], proofVideoUrls: [] });
    const row = await db.providerProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(row.specialties).toEqual([]);
    expect(row.proofVideoIds).toEqual([]);
  });


  test("department search returns verified providers with matching active offerings", async () => {
    const { caller, profile } = await provider("+2348060000007", ["SOLAR"]);
    await caller.providers.createOffering({
      category: "SOLAR",
      title: "Residential solar installation",
      description: "Supply and installation of residential solar panels and associated security systems.",
      priceType: "QUOTE",
    });
    const energy = await caller.providers.search({ department: "SMART_HOME_INSTALLATIONS" });
    const maintenance = await caller.providers.search({ department: "ELECTRICAL_PLUMBING" });
    expect(energy.items.some((item) => item.id === profile.id)).toBe(true);
    expect(maintenance.items.some((item) => item.id === profile.id)).toBe(false);
  });


  test("public provider discovery is blocked at the API boundary when the pilot flag is off", async () => {
    const { caller } = await createAuthedCaller({ role: "BUYER", phone: "+2348060000008" });
    const previous = process.env.HOME_SERVICES_ENABLED;
    process.env.HOME_SERVICES_ENABLED = "false";
    try {
      await expect(caller.providers.search({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      if (previous === undefined) delete process.env.HOME_SERVICES_ENABLED;
      else process.env.HOME_SERVICES_ENABLED = previous;
    }
  });
});
