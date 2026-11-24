import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateModelAssetUrl } from "../../src/modelAsset";

const BASE = "https://media.ultraapp.ng";
const RID = "clx9realtor123";
const UUID = "3f2a9c1e-7b4d-4e8a-9c21-5d6e7f8a9b0c";
const good = `${BASE}/listing-model/${RID}/${UUID}.glb`;
const ok = (u: string, o = { publicBaseUrl: BASE, realtorProfileId: RID }) => validateModelAssetUrl(u, o);

describe("validateModelAssetUrl", () => {
  test("accepts exactly the presigned-upload shape", () => {
    assert.deepEqual(ok(good), { ok: true, url: good });
  });
  test("fails closed when no public base URL is configured", () => {
    assert.equal(ok(good, { publicBaseUrl: undefined, realtorProfileId: RID }).ok, false);
  });
  test("rejects other hosts and lookalike hosts", () => {
    assert.equal(ok(`https://evil.com/listing-model/${RID}/${UUID}.glb`).ok, false);
    assert.equal(ok(`https://media.ultraapp.ng.evil.com/listing-model/${RID}/${UUID}.glb`).ok, false);
    assert.equal(ok(`https://evilmedia.ultraapp.ng/listing-model/${RID}/${UUID}.glb`).ok, false);
  });
  test("rejects another realtor's folder", () => {
    assert.equal(ok(`${BASE}/listing-model/someoneelse/${UUID}.glb`).ok, false);
  });
  test("rejects http, credentials, ports, query, fragment", () => {
    assert.equal(ok(good.replace("https", "http")).ok, false);
    assert.equal(ok(good.replace("https://", "https://u:p@")).ok, false);
    assert.equal(ok(good.replace(".ng/", ".ng:8443/")).ok, false);
    assert.equal(ok(good + "?x=1").ok, false);
    assert.equal(ok(good + "#frag").ok, false);
  });
  test("rejects wrong extensions, non-uuid names and path tricks", () => {
    assert.equal(ok(good.replace(".glb", ".gltf")).ok, false);
    assert.equal(ok(good.replace(".glb", ".html")).ok, false);
    assert.equal(ok(`${BASE}/listing-model/${RID}/not-a-uuid.glb`).ok, false);
    // The URL parser collapses dot segments before validation, so we always judge (and return) the canonical path:
    assert.deepEqual(ok(`${BASE}/listing-model/${RID}/../${RID}/${UUID}.glb`), { ok: true, url: good });
    assert.equal(ok(`${BASE}/listing-model/${RID}/../other/${UUID}.glb`).ok, false); // escapes this realtor's folder
    assert.equal(ok(`${BASE}/listing-model/${RID}/%2e%2e/other/${UUID}.glb`).ok, false);
    assert.equal(ok(`${BASE}/listing-photo/${RID}/${UUID}.glb`).ok, false);
  });
  test("rejects garbage and oversized input", () => {
    assert.equal(ok("not a url").ok, false);
    assert.equal(ok("").ok, false);
    assert.equal(ok(good + "a".repeat(3000)).ok, false);
  });
  test("works when the public base has a path prefix", () => {
    const o = { publicBaseUrl: "https://cdn.example.com/ultra/", realtorProfileId: RID };
    assert.equal(ok(`https://cdn.example.com/ultra/listing-model/${RID}/${UUID}.glb`, o).ok, true);
    assert.equal(ok(`https://cdn.example.com/listing-model/${RID}/${UUID}.glb`, o).ok, false);
  });
});
