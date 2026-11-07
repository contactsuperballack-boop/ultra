"use client";

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-sm text-amber-900">
        <strong>Draft — not legal advice.</strong> This page describes, in plain language, what data ULTRA
        actually collects and why, based on the current product. It has not been reviewed by a qualified
        lawyer and should not be published or relied on as your final privacy policy until it has been.
        Nigerian data protection obligations (including under the Nigeria Data Protection Act) should be
        confirmed by counsel before launch.
      </div>

      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Privacy Policy</h1>
      <p className="text-xs text-stone-400 mb-8">Last updated: draft, not yet published</p>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-stone-900 mb-2">What we collect</h2>
        <p className="text-sm text-stone-600 mb-3">We collect only what the product actually needs to function:</p>
        <ul className="text-sm text-stone-600 space-y-1.5 list-disc pl-5">
          <li><strong>Phone number</strong> — your primary identity on ULTRA. Used to sign you in via a one-time code; we do not use it for marketing without your separate consent.</li>
          <li><strong>Name</strong> — shown to realtors/buyers you message, and to admins reviewing a realtor application.</li>
          <li><strong>Listing content</strong> — photos, video, price, and description you (as a realtor) submit for a property.</li>
          <li><strong>Identity/business documents</strong> — for realtors applying for verification (ID, CAC registration). Stored privately, never shown publicly.</li>
          <li><strong>Messages</strong> — the content of inquiries and replies between buyers and realtors.</li>
          <li><strong>Push notification token</strong> — if you enable notifications on mobile, tied to your device.</li>
          <li><strong>Payment records</strong> — transaction status and amount for lead fees and subscriptions. We do not receive or store your card details — those go directly to Paystack.</li>
        </ul>
        <p className="text-sm text-stone-600 mt-3">
          We do not collect your precise location, contacts, or browsing activity outside ULTRA. IP addresses
          are used briefly for rate-limiting (preventing abuse) and are not stored long-term.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-stone-900 mb-2">Why we collect it</h2>
        <ul className="text-sm text-stone-600 space-y-1.5 list-disc pl-5">
          <li>To verify your identity and, for realtors, your right to list a property.</li>
          <li>To connect buyers and realtors directly, without exposing phone numbers until you choose to share them.</li>
          <li>To detect and flag listings priced well outside the normal range for an area, as part of keeping the marketplace trustworthy.</li>
          <li>To bill realtors for leads and subscriptions — never buyers.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-stone-900 mb-2">Who can see what</h2>
        <ul className="text-sm text-stone-600 space-y-1.5 list-disc pl-5">
          <li>Your name and listing content are visible to other users as part of normal marketplace browsing.</li>
          <li>Your phone number is never shown publicly — messaging happens in-app.</li>
          <li>Identity/verification documents are visible only to our admin team reviewing your application.</li>
          <li>We do not sell your data to third parties.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-stone-900 mb-2">Third parties we use</h2>
        <p className="text-sm text-stone-600">
          Paystack (payments), Termii (SMS verification codes), Cloudflare (file storage for photos/videos/documents).
          Each has its own privacy practices governing the data that passes through them.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-stone-900 mb-2">Your choices</h2>
        <p className="text-sm text-stone-600">
          You can request deletion of your account and associated data by contacting support (see the footer of
          this site). Some records — such as a verified transaction history — may be retained where we have a
          legitimate operational or legal reason to keep them; a lawyer should confirm exactly what applies here
          before this is finalized.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-stone-900 mb-2">Questions</h2>
        <p className="text-sm text-stone-600">
          Contact <a href="mailto:support@ultraapp.ng" className="text-emerald-800 underline">support@ultraapp.ng</a>.
        </p>
      </section>
    </main>
  );
}
