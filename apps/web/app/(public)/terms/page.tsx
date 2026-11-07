"use client";

export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-sm text-amber-900">
        <strong>Draft — not legal advice.</strong> This page reflects how ULTRA actually operates today. It has
        not been reviewed by a qualified lawyer and should not be published or relied on as your final Terms
        of Service until it has been — especially the liability, dispute, and refund sections.
      </div>

      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Terms of Service</h1>
      <p className="text-xs text-stone-400 mb-8">Last updated: draft, not yet published</p>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-stone-900 mb-2">What ULTRA is</h2>
        <p className="text-sm text-stone-600">
          ULTRA is a marketplace connecting property buyers/renters with real estate agencies ("realtors") in
          Abuja. We provide the platform, identity and listing verification, and messaging — we are not a party
          to any sale, rental, or agreement between a buyer and a realtor, and we do not hold or transfer
          property title.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-stone-900 mb-2">Verification is not a guarantee</h2>
        <p className="text-sm text-stone-600">
          We check realtor identity, business registration where provided, and listing details for consistency
          and typical pricing for the area. This reduces — it does not eliminate — the risk of fraud or
          inaccurate listings. Verification is not a guarantee of property title, condition, or a realtor's
          conduct. Buyers should independently verify any property before completing a transaction, including
          through their own legal counsel.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-stone-900 mb-2">For realtors</h2>
        <ul className="text-sm text-stone-600 space-y-1.5 list-disc pl-5">
          <li>You must be verified before publishing a listing, and must provide accurate identity and business information.</li>
          <li>Listings must accurately represent the property — price, photos, and description must match reality.</li>
          <li>Off-plan or pre-construction properties are not permitted on ULTRA at this time.</li>
          <li>A per-lead fee applies when a buyer contacts you through a listing, drawn from your prepaid balance. If your balance is insufficient, the buyer's message still reaches you — the shortfall is tracked and may be followed up on separately.</li>
          <li>A Premium subscription, where purchased, affects listing placement in search results only — it does not affect verification status or listing accuracy requirements.</li>
          <li>We may remove a listing or suspend an account for inaccurate information, repeated buyer complaints, or fraud indicators.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-stone-900 mb-2">For buyers</h2>
        <ul className="text-sm text-stone-600 space-y-1.5 list-disc pl-5">
          <li>Messaging a realtor through ULTRA is free — buyers are never charged.</li>
          <li>ULTRA does not process property payments, deposits, or rent — those happen directly between you and the realtor, outside the platform, through your own arrangement.</li>
          <li>We encourage keeping initial contact and viewing arrangements in-app, which helps our trust and reputation systems work as intended.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-stone-900 mb-2">Payments</h2>
        <p className="text-sm text-stone-600">
          Realtor payments (lead-fee top-ups and subscriptions) are processed by Paystack. We do not store your
          card details. Refund eligibility for unused balance or a disputed subscription charge will be
          addressed on a case-by-case basis — contact support.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-stone-900 mb-2">Limitation of liability</h2>
        <p className="text-sm text-stone-600">
          ULTRA is provided "as is." To the fullest extent permitted by law, we are not liable for losses
          arising from a property transaction, a realtor's conduct, or inaccurate listing information, beyond
          our role in operating the platform. <em>This section in particular needs qualified legal drafting
          before publication — the language above is a placeholder, not a finished liability clause.</em>
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-stone-900 mb-2">Questions or disputes</h2>
        <p className="text-sm text-stone-600">
          Contact <a href="mailto:support@ultraapp.ng" className="text-emerald-800 underline">support@ultraapp.ng</a>{" "}
          or reach us via WhatsApp (see the footer).
        </p>
      </section>
    </main>
  );
}
