import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { cleanList, splitList } from "../../src/textLists";

describe("text lists", () => {
  test("cleanList trims, collapses spaces, drops empties and duplicates (case-insensitive)", () => {
    assert.deepEqual(cleanList(["  Wall   paintings ", "", "wall paintings", "POP screeding"]), ["Wall paintings", "POP screeding"]);
  });
  test("cleanList caps count and length and tolerates non-strings", () => {
    assert.equal(cleanList(Array.from({ length: 40 }, (_, i) => `item ${i}`)).length, 12);
    assert.equal(cleanList(["x".repeat(200)])[0].length, 60);
    assert.deepEqual(cleanList([undefined as unknown as string, 5 as unknown as string, "ok"]), ["ok"]);
  });
  test("splitList accepts commas and new lines", () => {
    assert.deepEqual(splitList("Abuja, Kaduna\nJalingo,, abuja"), ["Abuja", "Kaduna", "Jalingo"]);
    assert.deepEqual(splitList("   "), []);
  });
});
