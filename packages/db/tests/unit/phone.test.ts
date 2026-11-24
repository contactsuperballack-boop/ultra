import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeNigerianPhone, formatNigerianPhone } from "../../src/phone";

describe("normalizeNigerianPhone", () => {
  const want = "+2348031234567";
  test("accepts every way people write the same number", () => {
    for (const input of ["08031234567", "8031234567", "2348031234567", "+2348031234567", "+234 803 123 4567", "0803 123 4567", "0803-123-4567", "+2340803 123 4567", "002348031234567", "(0803) 123.4567", "  +234 803 123 4567  "]) {
      assert.equal(normalizeNigerianPhone(input), want, input);
    }
  });
  test("accepts 7xx and 9xx mobile ranges", () => {
    assert.equal(normalizeNigerianPhone("07012345678"), "+2347012345678");
    assert.equal(normalizeNigerianPhone("09012345678"), "+2349012345678");
  });
  test("rejects wrong lengths, landline-style starts, foreign numbers and junk", () => {
    for (const bad of ["", "+234", "0803123456", "080312345678", "+2341234567890", "+14155552671", "abc", "0803 123 456a", "+234 803 123 4567 8", "0603 123 4567"]) {
      assert.equal(normalizeNigerianPhone(bad), null, bad);
    }
    assert.equal(normalizeNigerianPhone(undefined), null);
    assert.equal(normalizeNigerianPhone(null), null);
  });
  test("output always matches the API's +234 + 10 digits rule", () => {
    assert.match(normalizeNigerianPhone("0803 123 4567")!, /^\+234\d{10}$/);
  });
  test("formatNigerianPhone groups for display and leaves other input alone", () => {
    assert.equal(formatNigerianPhone("+2348031234567"), "+234 803 123 4567");
    assert.equal(formatNigerianPhone("nope"), "nope");
  });
});
