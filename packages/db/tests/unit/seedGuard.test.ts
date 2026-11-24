import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { assertSeedAllowed } from "../../src/seedGuard";

describe("demo seed environment guard", () => {
  test("allows local development and staging environments", () => {
    assert.doesNotThrow(() => assertSeedAllowed(undefined));
    assert.doesNotThrow(() => assertSeedAllowed("development"));
    assert.doesNotThrow(() => assertSeedAllowed("test"));
    assert.doesNotThrow(() => assertSeedAllowed("staging"));
  });

  test("refuses to seed when NODE_ENV is production", () => {
    assert.throws(() => assertSeedAllowed("production"), /Refusing to run demo seed data in production/);
  });
});
