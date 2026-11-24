-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BUYER', 'REALTOR', 'PROVIDER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "DevelopmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT', 'LAND');

-- CreateEnum
CREATE TYPE "PropertyCategory" AS ENUM ('RESIDENTIAL', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "PriceFrequency" AS ENUM ('ONE_TIME', 'PER_YEAR', 'PER_MONTH');

-- CreateEnum
CREATE TYPE "Furnishing" AS ENUM ('FURNISHED', 'UNFURNISHED', 'PARTLY_FURNISHED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "LandSizeUnit" AS ENUM ('SQM', 'PLOTS', 'ACRES', 'HECTARES');

-- CreateEnum
CREATE TYPE "LocationPrecision" AS ENUM ('EXACT', 'APPROXIMATE');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'LIVE', 'UNDER_REVIEW', 'SOLD', 'RENTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "OwnershipEvidence" AS ENUM ('OWNER_LISTING', 'AUTHORIZED_AGENT', 'AGENCY_MANDATE', 'DEVELOPER_LISTING', 'LAND_REPRESENTATIVE', 'PENDING');

-- CreateEnum
CREATE TYPE "StatementAuthorRole" AS ENUM ('OWNER', 'DEVELOPER', 'AUTHORISED_REPRESENTATIVE');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('FLOOR_PLAN', 'LIVING_ROOM', 'KITCHEN', 'BEDROOM', 'BATHROOM', 'EXTERIOR', 'OTHER');

-- CreateEnum
CREATE TYPE "InspectionKind" AS ENUM ('PHYSICAL', 'VIRTUAL', 'TITLE_DILIGENCE');

-- CreateEnum
CREATE TYPE "InspectionSlot" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'RESCHEDULE_PROPOSED', 'DECLINED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_MESSAGE', 'INSPECTION_REQUESTED', 'INSPECTION_UPDATED', 'VERIFICATION_APPROVED', 'VERIFICATION_REJECTED', 'NEW_BOOKING_REQUEST', 'BOOKING_ACCEPTED', 'BOOKING_DECLINED', 'BOOKING_COMPLETED', 'SAVED_SEARCH_MATCH', 'SERVICE_PROPOSAL_READY', 'SERVICE_PROPOSAL_ACCEPTED', 'SERVICE_PROPOSAL_DECLINED', 'SERVICE_MILESTONE_UPDATED', 'SERVICE_VISIT_SCHEDULED', 'SERVICE_VISIT_COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentTransactionType" AS ENUM ('TOPUP', 'LEAD_FEE', 'SUBSCRIPTION', 'REFUND', 'COMMISSION', 'COMMISSION_SETTLEMENT', 'MANUAL_ADJUSTMENT', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('PAINTING', 'PLUMBING', 'FUMIGATION', 'ELECTRICAL', 'SOLAR', 'CCTV', 'SECURITY_SYSTEMS', 'FURNITURE', 'CLEANING', 'MOVE_IN', 'PEST_CONTROL');

-- CreateEnum
CREATE TYPE "OfferingPriceType" AS ENUM ('FIXED', 'HOURLY', 'QUOTE');

-- CreateEnum
CREATE TYPE "ServiceTransactionType" AS ENUM ('ONE_TIME', 'INSTALLATION_PROJECT', 'RECURRING');

-- CreateEnum
CREATE TYPE "ServiceFrequency" AS ENUM ('WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "ServiceQuoteStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'DECLINED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ServiceMilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED');

-- CreateEnum
CREATE TYPE "RecurringAgreementStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ServiceOccurrenceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('REQUESTED', 'PROPOSAL_PENDING', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('DUPLICATE_LISTING', 'WRONG_PRICE', 'WRONG_LOCATION', 'FALSE_PHOTOS', 'PROPERTY_UNAVAILABLE', 'SUSPECTED_FRAUD', 'HARASSMENT', 'UNAUTHORIZED_LISTING');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('ACCOUNT', 'LISTING', 'PAYMENT', 'INSPECTION', 'HOME_SERVICES', 'SAFETY_OR_FRAUD', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'BUYER',
    "pushToken" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealtorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "cacRegistrationNo" TEXT,
    "idDocumentUrl" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "verifiedByAdminId" TEXT,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "businessVerified" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION,
    "responseTimeMins" INTEGER,
    "creditBalanceNaira" BIGINT NOT NULL DEFAULT 0,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "restrictedAt" TIMESTAMP(3),
    "restrictedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealtorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationLog" (
    "id" TEXT NOT NULL,
    "realtorProfileId" TEXT NOT NULL,
    "fromStatus" "VerificationStatus" NOT NULL,
    "toStatus" "VerificationStatus" NOT NULL,
    "note" TEXT,
    "actorAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "realtorProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ListingType" NOT NULL,
    "category" "PropertyCategory",
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "priceNaira" BIGINT NOT NULL,
    "priceCurrency" TEXT NOT NULL DEFAULT 'NGN',
    "priceFrequency" "PriceFrequency" NOT NULL DEFAULT 'ONE_TIME',
    "serviceChargeNaira" BIGINT,
    "negotiable" BOOLEAN NOT NULL DEFAULT false,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "architect" TEXT,
    "builder" TEXT,
    "developer" TEXT,
    "completionYear" INTEGER,
    "ownerStatement" TEXT,
    "statementAuthorRole" "StatementAuthorRole",
    "statementAuthorName" TEXT,
    "youtubeVideoId" TEXT,
    "model3dUrl" TEXT,
    "developmentId" TEXT,
    "unitNumber" TEXT,
    "furnishing" "Furnishing" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "landSizeUnit" "LandSizeUnit",
    "availableFrom" TIMESTAMP(3),
    "locationPrecision" "LocationPrecision" NOT NULL DEFAULT 'APPROXIMATE',
    "area" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Abuja',
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "sizeSqm" INTEGER NOT NULL,
    "videoUrl" TEXT,
    "flagReason" TEXT,
    "listingReviewed" BOOLEAN NOT NULL DEFAULT false,
    "lastReviewedAt" TIMESTAMP(3),
    "ownershipEvidence" "OwnershipEvidence" NOT NULL DEFAULT 'PENDING',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingModerationLog" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "fromStatus" "ListingStatus" NOT NULL,
    "toStatus" "ListingStatus" NOT NULL,
    "note" TEXT,
    "actorAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingPhoto" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "roomType" "RoomType",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT,

    CONSTRAINT "ListingPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedListing" (
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedListing_pkey" PRIMARY KEY ("userId","listingId")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ListingType",
    "category" "PropertyCategory",
    "area" TEXT,
    "query" TEXT,
    "minPriceNaira" BIGINT,
    "maxPriceNaira" BIGINT,
    "minBeds" INTEGER,
    "minBathrooms" INTEGER,
    "verifiedOnly" BOOLEAN NOT NULL DEFAULT false,
    "alertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastMatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Development" (
    "id" TEXT NOT NULL,
    "realtorProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Abuja',
    "architect" TEXT,
    "builder" TEXT,
    "developer" TEXT,
    "completionYear" INTEGER,
    "youtubeVideoId" TEXT,
    "status" "DevelopmentStatus" NOT NULL DEFAULT 'PENDING',
    "moderationNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Development_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionRequest" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "kind" "InspectionKind" NOT NULL,
    "preferredDate" DATE NOT NULL,
    "preferredSlot" "InspectionSlot" NOT NULL,
    "notes" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'REQUESTED',
    "proposedDate" DATE,
    "proposedSlot" "InspectionSlot",
    "scheduledDate" DATE,
    "scheduledSlot" "InspectionSlot",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "realtorProfileId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "sms" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "realtorProfileId" TEXT,
    "providerProfileId" TEXT,
    "type" "PaymentTransactionType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountNaira" BIGINT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paystack',
    "providerRef" TEXT NOT NULL,
    "inquiryId" TEXT,
    "serviceRequestId" TEXT,
    "serviceOccurrenceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "categories" "ServiceCategory"[],
    "cacRegistrationNo" TEXT,
    "idDocumentUrl" TEXT,
    "bio" TEXT,
    "serviceArea" TEXT NOT NULL DEFAULT 'Abuja',
    "contactName" TEXT,
    "contactRole" TEXT,
    "operatingSince" INTEGER,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "proofVideoIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "verifiedByAdminId" TEXT,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "businessVerified" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION,
    "responseTimeMins" INTEGER,
    "commissionOwedNaira" BIGINT NOT NULL DEFAULT 0,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "freeUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderVerificationLog" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "fromStatus" "VerificationStatus" NOT NULL,
    "toStatus" "VerificationStatus" NOT NULL,
    "note" TEXT,
    "actorAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderVerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offering" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceType" "OfferingPriceType" NOT NULL,
    "priceNaira" BIGINT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "offeringId" TEXT,
    "category" "ServiceCategory" NOT NULL,
    "transactionType" "ServiceTransactionType" NOT NULL DEFAULT 'ONE_TIME',
    "unitCount" INTEGER NOT NULL DEFAULT 1,
    "siteName" TEXT,
    "siteAddress" TEXT,
    "preferredAt" TIMESTAMP(3),
    "requestedFrequency" "ServiceFrequency",
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "agreedPriceNaira" BIGINT,
    "commissionNaira" BIGINT,
    "commissionBilled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceQuote" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "scopeSummary" TEXT NOT NULL,
    "totalPriceNaira" BIGINT NOT NULL,
    "estimatedDurationDays" INTEGER NOT NULL,
    "validUntil" TIMESTAMP(3),
    "status" "ServiceQuoteStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceMilestone" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amountNaira" BIGINT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ServiceMilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringAgreement" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "frequency" "ServiceFrequency" NOT NULL,
    "serviceScope" TEXT NOT NULL,
    "pricePerVisitNaira" BIGINT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "nextServiceAt" TIMESTAMP(3) NOT NULL,
    "status" "RecurringAgreementStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOccurrence" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ServiceOccurrenceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "finalPriceNaira" BIGINT,
    "commissionNaira" BIGINT,
    "commissionBilled" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceMessage" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "comment" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedByAdminId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "leadFeeNaira" BIGINT NOT NULL DEFAULT 500,
    "commissionRateBps" INTEGER NOT NULL DEFAULT 1000,
    "realtorSubscriptionPriceNaira" BIGINT NOT NULL DEFAULT 15000,
    "providerSubscriptionPriceNaira" BIGINT NOT NULL DEFAULT 10000,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByAdminId" TEXT,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "subject" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "SupportTicketCategory" NOT NULL DEFAULT 'OTHER',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignedAdminId" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "properties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "OtpCode_phone_createdAt_idx" ON "OtpCode"("phone", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RealtorProfile_userId_key" ON "RealtorProfile"("userId");

-- CreateIndex
CREATE INDEX "RealtorProfile_verificationStatus_idx" ON "RealtorProfile"("verificationStatus");

-- CreateIndex
CREATE INDEX "Listing_status_city_type_idx" ON "Listing"("status", "city", "type");

-- CreateIndex
CREATE INDEX "Listing_area_idx" ON "Listing"("area");

-- CreateIndex
CREATE INDEX "Listing_priceNaira_idx" ON "Listing"("priceNaira");

-- CreateIndex
CREATE INDEX "Listing_developmentId_status_idx" ON "Listing"("developmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_developmentId_unitNumber_key" ON "Listing"("developmentId", "unitNumber");

-- CreateIndex
CREATE INDEX "ListingPhoto_contentHash_idx" ON "ListingPhoto"("contentHash");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_createdAt_idx" ON "SavedSearch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedSearch_alertEnabled_type_category_idx" ON "SavedSearch"("alertEnabled", "type", "category");

-- CreateIndex
CREATE INDEX "Inquiry_buyerId_idx" ON "Inquiry"("buyerId");

-- CreateIndex
CREATE INDEX "Inquiry_listingId_idx" ON "Inquiry"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "Inquiry_listingId_buyerId_key" ON "Inquiry"("listingId", "buyerId");

-- CreateIndex
CREATE INDEX "Development_realtorProfileId_idx" ON "Development"("realtorProfileId");

-- CreateIndex
CREATE INDEX "Development_area_idx" ON "Development"("area");

-- CreateIndex
CREATE INDEX "InspectionRequest_inquiryId_idx" ON "InspectionRequest"("inquiryId");

-- CreateIndex
CREATE INDEX "InspectionRequest_buyerId_createdAt_idx" ON "InspectionRequest"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "InspectionRequest_listingId_status_idx" ON "InspectionRequest"("listingId", "status");

-- CreateIndex
CREATE INDEX "Message_inquiryId_senderId_readAt_idx" ON "Message"("inquiryId", "senderId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_providerRef_key" ON "PaymentTransaction"("providerRef");

-- CreateIndex
CREATE INDEX "PaymentTransaction_realtorProfileId_createdAt_idx" ON "PaymentTransaction"("realtorProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_providerProfileId_createdAt_idx" ON "PaymentTransaction"("providerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_serviceOccurrenceId_idx" ON "PaymentTransaction"("serviceOccurrenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_userId_key" ON "ProviderProfile"("userId");

-- CreateIndex
CREATE INDEX "ProviderProfile_verificationStatus_idx" ON "ProviderProfile"("verificationStatus");

-- CreateIndex
CREATE INDEX "Offering_providerProfileId_active_idx" ON "Offering"("providerProfileId", "active");

-- CreateIndex
CREATE INDEX "Offering_category_idx" ON "Offering"("category");

-- CreateIndex
CREATE INDEX "ServiceRequest_providerProfileId_status_idx" ON "ServiceRequest"("providerProfileId", "status");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_idx" ON "ServiceRequest"("status");

-- CreateIndex
CREATE INDEX "ServiceRequest_customerId_idx" ON "ServiceRequest"("customerId");

-- CreateIndex
CREATE INDEX "ServiceQuote_requestId_status_idx" ON "ServiceQuote"("requestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuote_requestId_version_key" ON "ServiceQuote"("requestId", "version");

-- CreateIndex
CREATE INDEX "ServiceMilestone_quoteId_sortOrder_idx" ON "ServiceMilestone"("quoteId", "sortOrder");

-- CreateIndex
CREATE INDEX "RecurringAgreement_providerProfileId_status_idx" ON "RecurringAgreement"("providerProfileId", "status");

-- CreateIndex
CREATE INDEX "RecurringAgreement_customerId_status_idx" ON "RecurringAgreement"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringAgreement_requestId_version_key" ON "RecurringAgreement"("requestId", "version");

-- CreateIndex
CREATE INDEX "ServiceOccurrence_agreementId_status_idx" ON "ServiceOccurrence"("agreementId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOccurrence_agreementId_scheduledAt_key" ON "ServiceOccurrence"("agreementId", "scheduledAt");

-- CreateIndex
CREATE INDEX "ServiceMessage_serviceRequestId_senderId_readAt_idx" ON "ServiceMessage"("serviceRequestId", "senderId", "readAt");

-- CreateIndex
CREATE INDEX "Report_listingId_idx" ON "Report"("listingId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_status_priority_createdAt_idx" ON "SupportTicket"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_requesterId_createdAt_idx" ON "SupportTicket"("requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedAdminId_status_idx" ON "SupportTicket"("assignedAdminId", "status");

-- CreateIndex
CREATE INDEX "SupportTicketMessage_ticketId_createdAt_idx" ON "SupportTicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorUserId_createdAt_idx" ON "AdminAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_createdAt_idx" ON "AdminAuditLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealtorProfile" ADD CONSTRAINT "RealtorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationLog" ADD CONSTRAINT "VerificationLog_realtorProfileId_fkey" FOREIGN KEY ("realtorProfileId") REFERENCES "RealtorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_realtorProfileId_fkey" FOREIGN KEY ("realtorProfileId") REFERENCES "RealtorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "Development"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingModerationLog" ADD CONSTRAINT "ListingModerationLog_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingPhoto" ADD CONSTRAINT "ListingPhoto_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Development" ADD CONSTRAINT "Development_realtorProfileId_fkey" FOREIGN KEY ("realtorProfileId") REFERENCES "RealtorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_realtorProfileId_fkey" FOREIGN KEY ("realtorProfileId") REFERENCES "RealtorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_realtorProfileId_fkey" FOREIGN KEY ("realtorProfileId") REFERENCES "RealtorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_serviceOccurrenceId_fkey" FOREIGN KEY ("serviceOccurrenceId") REFERENCES "ServiceOccurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderProfile" ADD CONSTRAINT "ProviderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVerificationLog" ADD CONSTRAINT "ProviderVerificationLog_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuote" ADD CONSTRAINT "ServiceQuote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuote" ADD CONSTRAINT "ServiceQuote_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMilestone" ADD CONSTRAINT "ServiceMilestone_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "ServiceQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringAgreement" ADD CONSTRAINT "RecurringAgreement_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringAgreement" ADD CONSTRAINT "RecurringAgreement_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringAgreement" ADD CONSTRAINT "RecurringAgreement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOccurrence" ADD CONSTRAINT "ServiceOccurrence_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "RecurringAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMessage" ADD CONSTRAINT "ServiceMessage_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMessage" ADD CONSTRAINT "ServiceMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
