export function SiteFooter() {
  return (
    <footer className="border-t border-stone-200 mt-16">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between gap-4 text-xs text-stone-500">
        <span>ULTRA — Verified Property Marketplace, Abuja</span>
        <div className="flex gap-4">
          <a href="/privacy" className="hover:text-emerald-800">
            Privacy Policy
          </a>
          <a href="/terms" className="hover:text-emerald-800">
            Terms of Service
          </a>
          <a href="mailto:support@ultraapp.ng" className="hover:text-emerald-800">
            support@ultraapp.ng
          </a>
          <a href="https://wa.me/2348000000000" target="_blank" rel="noreferrer" className="hover:text-emerald-800">
            WhatsApp support
          </a>
        </div>
      </div>
    </footer>
  );
}
