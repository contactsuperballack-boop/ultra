import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { applyInspectionAction, availableActions, validateInspectionDate, todayInNigeria, formatInspectionDate, upcomingInspectionDates, type InspectionAction, type InspectionStatus } from "../../src/inspection";

describe("validateInspectionDate", () => {
  const today = "2026-11-14";
  test("tomorrow and 90 days ahead are accepted", () => {
    assert.equal(validateInspectionDate("2026-11-15", today).ok, true);
    assert.equal(validateInspectionDate("2027-02-12", today).ok, true); // exactly 90 days
  });
  test("today, the past and beyond 90 days are rejected", () => {
    assert.equal(validateInspectionDate("2026-11-14", today).ok, false);
    assert.equal(validateInspectionDate("2026-11-01", today).ok, false);
    assert.equal(validateInspectionDate("2027-02-13", today).ok, false);
  });
  test("malformed and impossible dates are rejected", () => {
    for (const d of ["", "tomorrow", "2026-13-01", "2026-02-31", "15/11/2026", "2026-1-5"]) assert.equal(validateInspectionDate(d, today).ok, false, d);
  });
  test("Nigeria's date rolls over an hour before UTC's", () => {
    assert.equal(todayInNigeria(new Date("2026-11-14T23:30:00Z")), "2026-11-15");
    assert.equal(todayInNigeria(new Date("2026-11-14T10:00:00Z")), "2026-11-14");
  });
});

describe("applyInspectionAction", () => {
  const next = (s: InspectionStatus, a: InspectionAction, who: "BUYER" | "REALTOR") => {
    const r = applyInspectionAction(s, a, who);
    return r.ok ? r.next : null;
  };
  test("the happy paths", () => {
    assert.equal(next("REQUESTED", "ACCEPT", "REALTOR"), "ACCEPTED");
    assert.equal(next("REQUESTED", "DECLINE", "REALTOR"), "DECLINED");
    assert.equal(next("REQUESTED", "RESCHEDULE", "REALTOR"), "RESCHEDULE_PROPOSED");
    assert.equal(next("RESCHEDULE_PROPOSED", "ACCEPT_RESCHEDULE", "BUYER"), "ACCEPTED");
    assert.equal(next("ACCEPTED", "COMPLETE", "REALTOR"), "COMPLETED");
    assert.equal(next("ACCEPTED", "CANCEL", "BUYER"), "CANCELLED");
  });
  test("a buyer can't accept, decline, reschedule or complete on the realtor's behalf", () => {
    for (const a of ["ACCEPT", "DECLINE", "RESCHEDULE", "COMPLETE"] as const) assert.equal(next("REQUESTED", a, "BUYER"), null, a);
  });
  test("a realtor can't accept a reschedule that is the buyer's to accept", () => {
    assert.equal(next("RESCHEDULE_PROPOSED", "ACCEPT_RESCHEDULE", "REALTOR"), null);
  });
  test("finished requests are final", () => {
    for (const s of ["DECLINED", "CANCELLED", "COMPLETED"] as const) {
      for (const a of ["ACCEPT", "DECLINE", "RESCHEDULE", "CANCEL", "ACCEPT_RESCHEDULE", "COMPLETE"] as const) {
        assert.equal(next(s, a, "REALTOR"), null, `${s}/${a}/realtor`);
        assert.equal(next(s, a, "BUYER"), null, `${s}/${a}/buyer`);
      }
    }
  });
  test("can't complete before it's confirmed", () => {
    assert.equal(next("REQUESTED", "COMPLETE", "REALTOR"), null);
  });
  test("offered buttons match the rules", () => {
    assert.deepEqual(availableActions("REQUESTED", "REALTOR").sort(), ["ACCEPT", "CANCEL", "DECLINE", "RESCHEDULE"]);
    assert.deepEqual(availableActions("REQUESTED", "BUYER"), ["CANCEL"]);
    assert.deepEqual(availableActions("RESCHEDULE_PROPOSED", "BUYER").sort(), ["ACCEPT_RESCHEDULE", "CANCEL"]);
    assert.deepEqual(availableActions("COMPLETED", "BUYER"), []);
  });
});

describe("date helpers", () => {
  test("formatInspectionDate is stable and timezone-proof", () => {
    assert.equal(formatInspectionDate("2026-11-15"), "Sun 15 Nov 2026");
    assert.equal(formatInspectionDate(new Date("2026-12-01T00:00:00Z")), "Tue 1 Dec 2026");
  });
  test("upcomingInspectionDates starts tomorrow, is consecutive, and every date validates", () => {
    const days = upcomingInspectionDates(5, "2026-11-30");
    assert.deepEqual(days, ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05"]);
    for (const d of upcomingInspectionDates(90, "2026-11-30")) assert.equal(validateInspectionDate(d, "2026-11-30").ok, true, d);
    assert.equal(upcomingInspectionDates(200, "2026-11-30").length, 90);
  });
});
