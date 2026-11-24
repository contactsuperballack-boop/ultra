import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath, landingFor } from "../../src/redirect";

describe("safeNextPath", () => {
  test("keeps same-site paths, including query strings", () => {
    assert.equal(safeNextPath("/listings/abc"), "/listings/abc");
    assert.equal(safeNextPath("/search?query=guzape"), "/search?query=guzape");
  });
  test("refuses anything that could leave the site", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "evil.com", "http://localhost/x", "/ok\nhttps://evil.com", "/ok\u0000"]) {
      assert.equal(safeNextPath(bad), "/", bad);
    }
  });
  test("refuses empty, oversized and login-loop targets", () => {
    assert.equal(safeNextPath(""), "/");
    assert.equal(safeNextPath(null), "/");
    assert.equal(safeNextPath("/" + "a".repeat(600)), "/");
    assert.equal(safeNextPath("/auth/login"), "/");
    assert.equal(safeNextPath("/auth/login?next=/x"), "/");
  });
  test("uses the fallback when given one", () => {
    assert.equal(safeNextPath("//x", "/dashboard"), "/dashboard");
  });
});

describe("landingFor", () => {
  test("each role lands somewhere sensible; buyers never see a realtor dashboard", () => {
    assert.equal(landingFor("BUYER"), "/");
    assert.equal(landingFor("REALTOR"), "/dashboard/listings");
    assert.equal(landingFor("ADMIN"), "/admin/verification");
    assert.equal(landingFor("SUPER_ADMIN"), "/admin/verification");
  });
  test("providers go to their dashboard only when Phase 2 is on", () => {
    assert.equal(landingFor("PROVIDER"), "/");
    assert.equal(landingFor("PROVIDER", { phase2Enabled: true }), "/partner/dashboard");
  });
  test("unknown roles fall back to the homepage", () => {
    assert.equal(landingFor("SOMETHING_NEW"), "/");
  });
});
