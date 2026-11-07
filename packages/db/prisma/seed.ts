import { PrismaClient, ListingType, ListingStatus, VerificationStatus, UserRole, ServiceCategory, OfferingPriceType } from "@prisma/client";
import { checkPriceBand } from "../src/priceBand";

const db = new PrismaClient();

async function main() {
  console.log("Seeding ULTRA dev database...");

  // ── Verified realtor ──
  const realtorUser = await db.user.upsert({
    where: { phone: "+2348012345678" },
    update: {},
    create: {
      phone: "+2348012345678",
      phoneVerified: true,
      name: "Adaeze Okafor",
      role: UserRole.REALTOR,
      realtorProfile: {
        create: {
          agencyName: "Adaeze Okafor Realty",
          cacRegistrationNo: "RC-1234567",
          verificationStatus: VerificationStatus.VERIFIED,
          verifiedAt: new Date(),
          rating: 4.9,
          responseTimeMins: 126,
        },
      },
    },
    include: { realtorProfile: true },
  });

  const realtorProfileId = realtorUser.realtorProfile!.id;

  // ── Buyer ──
  const buyer = await db.user.upsert({
    where: { phone: "+2348099999999" },
    update: {},
    create: {
      phone: "+2348099999999",
      phoneVerified: true,
      name: "Tari Briggs",
      role: UserRole.BUYER,
    },
  });

  // ── Admin & Super Admin ──
  await db.user.upsert({
    where: { phone: "+2348011110000" },
    update: {},
    create: { phone: "+2348011110000", phoneVerified: true, name: "Ops Admin", role: UserRole.ADMIN },
  });
  await db.user.upsert({
    where: { phone: "+2348022220000" },
    update: {},
    create: { phone: "+2348022220000", phoneVerified: true, name: "Founder", role: UserRole.SUPER_ADMIN },
  });

  // ── Listings — mirrors the seed data used in the HomeApp prototype.
  // Status and flagReason are DERIVED from the real checkPriceBand logic
  // below rather than hand-written, specifically because a hand-written
  // flagReason for the Guzape listing previously drifted out of sync with
  // what the actual price-band math computes (caught by
  // packages/api/tests/unit/priceBand.test.ts — see that file's last case).
  const listings = [
    { title: "4-Bed Detached Duplex", area: "Maitama", priceNaira: 185_000_000n, bedrooms: 4, bathrooms: 5, sizeSqm: 420, type: ListingType.SALE },
    { title: "3-Bed Terrace with BQ", area: "Jabi", priceNaira: 95_000_000n, bedrooms: 3, bathrooms: 4, sizeSqm: 260, type: ListingType.SALE },
    { title: "2-Bed Flat, Furnished", area: "Wuse 2", priceNaira: 4_500_000n, bedrooms: 2, bathrooms: 2, sizeSqm: 110, type: ListingType.RENT },
    { title: "5-Bed Mansion, Pool", area: "Asokoro", priceNaira: 420_000_000n, bedrooms: 5, bathrooms: 6, sizeSqm: 680, type: ListingType.SALE },
    // Deliberately priced well below Guzape's band (₦80,000–250,000/m²) —
    // ~₦54,167/m² — so this listing demonstrates the UNDER_REVIEW path with
    // a real, computed flag reason rather than a scripted one. A
    // suspiciously cheap plot is also a realistic fraud signal in its own
    // right (Blueprint §5's duplicate-plot / title-fraud risk).
    { title: "Serviced Plot, Fenced", area: "Guzape", priceNaira: 65_000_000n, bedrooms: null, bathrooms: null, sizeSqm: 1200, type: ListingType.LAND },
    { title: "3-Bed Bungalow", area: "Gwarinpa", priceNaira: 3_200_000n, bedrooms: 3, bathrooms: 3, sizeSqm: 180, type: ListingType.RENT },
  ];

  for (const l of listings) {
    const flagReason = checkPriceBand(l.area, Number(l.priceNaira), l.sizeSqm);
    const status = flagReason ? ListingStatus.UNDER_REVIEW : ListingStatus.LIVE;
    await db.listing.create({
      data: {
        ...l,
        realtorProfileId,
        status,
        flagReason,
        description: `A well-finished property in ${l.area}, one of Abuja's most sought-after districts. Listed by a verified realtor.`,
        publishedAt: status === ListingStatus.LIVE ? new Date() : null,
      },
    });
  }

  console.log(`Seeded: 1 realtor (verified), 1 buyer, ${listings.length} listings.`);

  // ── Phase 2 — verified service provider with offerings across all 4
  // launch categories, so /services has something to show immediately
  // after seeding, same reasoning as the realtor/listings seed above.
  const providerUser = await db.user.upsert({
    where: { phone: "+2348033334444" },
    update: {},
    create: {
      phone: "+2348033334444",
      phoneVerified: true,
      name: "Chinedu Eze",
      role: UserRole.PROVIDER,
      providerProfile: {
        create: {
          businessName: "Chinedu Home Services",
          categories: [ServiceCategory.PAINTING, ServiceCategory.PLUMBING, ServiceCategory.ELECTRICAL],
          cacRegistrationNo: "RC-9876543",
          verificationStatus: VerificationStatus.VERIFIED,
          verifiedAt: new Date(),
          bio: "Ten years fixing up homes across Abuja — painting, plumbing, and electrical work, done right the first time.",
          serviceArea: "Abuja",
          rating: 4.8,
          responseTimeMins: 45,
          freeUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
      },
    },
    include: { providerProfile: true },
  });

  const providerProfileId = providerUser.providerProfile!.id;

  const offerings = [
    {
      category: ServiceCategory.PAINTING,
      title: "Standard 3-bedroom interior painting",
      description: "Full interior repaint — walls, ceilings, and trim. Premium washable paint included, two coats.",
      priceType: OfferingPriceType.FIXED,
      priceNaira: 180_000n,
    },
    {
      category: ServiceCategory.PLUMBING,
      title: "General plumbing callout",
      description: "Leak repairs, tap/fixture replacement, blocked drains. Billed hourly plus parts.",
      priceType: OfferingPriceType.HOURLY,
      priceNaira: 8_000n,
    },
    {
      category: ServiceCategory.ELECTRICAL,
      title: "Full house rewiring",
      description: "Complete rewire for older properties — quoted after an on-site assessment.",
      priceType: OfferingPriceType.QUOTE,
      priceNaira: null,
    },
  ];

  for (const o of offerings) {
    await db.offering.create({ data: { ...o, providerProfileId } });
  }

  console.log(`Seeded: 1 service provider (verified), ${offerings.length} offerings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
