import { describe, expect, it } from "vitest";
import { allocate } from "@/lib/exam/allocation";

const avail = {
  Physics: { Easy: 20, Medium: 30, Hard: 15 },
  Chemistry: { Easy: 5, Medium: 10, Hard: 5 },
  Mathematics: { Easy: 15, Medium: 20, Hard: 15 },
};

describe("allocate", () => {
  it("meets subject and overall difficulty totals exactly", () => {
    const r = allocate(
      [
        { subject: "Physics", count: 35 },
        { subject: "Chemistry", count: 20 },
        { subject: "Mathematics", count: 30 },
      ],
      { Easy: 25, Medium: 40, Hard: 20 },
      avail,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const plan = r.plan as Record<string, Record<string, number>>;
    for (const [s, n] of [["Physics", 35], ["Chemistry", 20], ["Mathematics", 30]] as const) expect(Object.values(plan[s]).reduce((a, b) => a + b, 0)).toBe(n);
    for (const [d, n] of [["Easy", 25], ["Medium", 40], ["Hard", 20]] as const) expect(Object.values(plan).reduce((a, p) => a + p[d], 0)).toBe(n);
    for (const s of Object.keys(plan)) for (const d of ["Easy", "Medium", "Hard"] as const) expect(plan[s][d]).toBeLessThanOrEqual(avail[s as keyof typeof avail][d]);
  });

  it("reports the exact shortage message for a subject", () => {
    const r = allocate([{ subject: "Chemistry", count: 35 }], null, avail);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.problems[0]).toBe("Only 20 usable Chemistry questions are available for the selected filters. Please add more questions or adjust the distribution.");
  });

  it("honours subject-specific difficulty splits", () => {
    const r = allocate([{ subject: "Physics", count: 10, difficulty: { Easy: 2, Medium: 3, Hard: 5 } }], { Easy: 2, Medium: 3, Hard: 5 }, avail);
    expect(r.ok && r.plan.Physics).toEqual({ Easy: 2, Medium: 3, Hard: 5 });
    const bad = allocate([{ subject: "Chemistry", count: 10, difficulty: { Easy: 8, Medium: 1, Hard: 1 } }], null, avail);
    expect(bad.ok).toBe(false);
  });

  it("detects infeasible combinations even when totals look sufficient", () => {
    const r = allocate([{ subject: "Chemistry", count: 20 }], { Easy: 15, Medium: 5, Hard: 0 }, avail);
    expect(r.ok).toBe(false);
  });

  it("returns 'Any' cells when no difficulty split is requested", () => {
    const r = allocate([{ subject: "Physics", count: 5 }], null, avail);
    expect(r.ok && r.plan.Physics).toEqual({ Any: 5 });
  });
});
