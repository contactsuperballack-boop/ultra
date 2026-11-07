/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ultra/api", "@ultra/db"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.r2.dev" }],
  },
  // Security audit fix (Medium finding — "No Security Headers Configured").
  // Applied to every route via the wildcard source, not per-page, since
  // there's no reason any page on this site should ever be framed by
  // another origin or leak referrer data to a third-party link target.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking protection — no page on this site is meant to be
          // embedded in a frame anywhere, so DENY rather than SAMEORIGIN.
          { key: "X-Frame-Options", value: "DENY" },
          // Belt-and-suspenders with X-Frame-Options via CSP's frame-ancestors,
          // since CSP is the modern control and browsers vary in which they
          // honor. Deliberately NOT a full CSP (script-src/style-src etc.) yet —
          // this codebase currently loads no third-party scripts (confirmed:
          // no <script src> to an external host anywhere in the app), so a
          // strict CSP is easy to adopt now while that stays true, but writing
          // one blind, untested, in an environment with no browser to verify
          // it against, risks silently breaking the app (e.g. Next.js's own
          // inline hydration scripts need 'unsafe-inline' or a nonce, and a
          // wrong CSP fails closed, not open). Scoping this pass to the
          // frame-ancestors directive alone — unambiguous, low-risk, real
          // value — and leaving a full CSP as a follow-up done WITH a real
          // browser to test against, not guessed at here.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Prevents MIME-sniffing a response into an unintended content type.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Enforces HTTPS for a year, including subdomains, once the site is
          // actually served over HTTPS (harmless locally over http — browsers
          // ignore HSTS on non-HTTPS origins).
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Buyer/realtor/admin URLs can contain listing IDs, but nothing
          // secret (no tokens in URLs anywhere in this app — confirmed,
          // auth is header-based) — strict-origin-when-cross-origin is a
          // reasonable default rather than leaking full URLs to external
          // link targets for no benefit.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
