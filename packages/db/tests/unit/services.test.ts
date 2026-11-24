import test from "node:test";
import assert from "node:assert/strict";
import { HOME_SERVICE_DEPARTMENTS, HOME_SERVICE_SPECIALTIES, serviceCategoriesForDepartment, serviceDepartmentLabel } from "../../src/services";

test("Home Services exposes the five departments approved in PRODUCT_SCOPE", () => {
  assert.deepEqual(HOME_SERVICE_DEPARTMENTS.map((item) => item.value), [
    "SMART_HOME_INSTALLATIONS", "LUXURY", "ELECTRICAL_PLUMBING", "CLEANING_MOVE_IN", "FUMIGATION_PEST_CONTROL",
  ]);
});

test("legacy categories remain mapped to their approved department", () => {
  assert.deepEqual(serviceCategoriesForDepartment("LUXURY"), ["PAINTING", "FURNITURE"]);
  assert.deepEqual(serviceCategoriesForDepartment("ELECTRICAL_PLUMBING"), ["ELECTRICAL", "PLUMBING"]);
  assert.deepEqual(serviceCategoriesForDepartment("FUMIGATION_PEST_CONTROL"), ["FUMIGATION", "PEST_CONTROL"]);
});

test("all approved specialties belong to exactly one department", () => {
  const values = HOME_SERVICE_SPECIALTIES.map((item) => item.value);
  assert.equal(new Set(values).size, values.length);
  assert.equal(values.length, 11);
});

test("specialty labels are human-readable", () => {
  assert.equal(serviceDepartmentLabel("SECURITY_SYSTEMS"), "Security systems");
  assert.equal(serviceDepartmentLabel("PLUMBING"), "Plumbing");
});
