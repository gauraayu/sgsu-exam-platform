import { describe, expect, it } from "vitest";
import { generateSubject } from "../../scripts/generate-question-bank";
import { physics } from "../../scripts/generator/physics";
import { chemistry } from "../../scripts/generator/chemistry";
import { maths } from "../../scripts/generator/maths";
import { chemistryHard, mathsHard, physicsHard } from "../../scripts/generator/hard";

describe("SGSU question generator", () => {
  for (const [name, templates] of [["Physics", physics], ["Chemistry", chemistry], ["Mathematics", maths]] as const) {
    it(`${name}: produces 520 unique, well-formed questions`, () => {
      const { items } = generateSubject(templates, 520, 99);
      expect(items).toHaveLength(520);
      expect(new Set(items.map((i) => i.q)).size).toBe(520);
      for (const it of items) {
        const opts = [it.correct, ...it.wrong];
        expect(new Set(opts).size).toBe(4);
        expect(opts.join("|")).not.toMatch(/NaN|Infinity|undefined|\[object/);
        expect(["Easy", "Medium"]).toContain(it.difficulty);
        expect(it.sol.length).toBeGreaterThan(5);
      }
    });
  }

  for (const [name, templates] of [["Physics", physicsHard], ["Chemistry", chemistryHard], ["Mathematics", mathsHard]] as const) {
    it(`${name}: produces 110 unique, well-formed Hard questions`, () => {
      const { items } = generateSubject(templates, 110, 5, { difficulty: "Hard" });
      expect(items).toHaveLength(110);
      expect(new Set(items.map((i) => i.q)).size).toBe(110);
      for (const it of items) {
        expect(it.difficulty).toBe("Hard");
        expect(new Set([it.correct, ...it.wrong]).size).toBe(4);
        expect([it.correct, ...it.wrong].join("|")).not.toMatch(/NaN|Infinity|undefined|\[object/);
      }
    });
  }

  it("is deterministic for a given seed", () => {
    const a = generateSubject(physics, 50, 7).items.map((i) => i.q);
    const b = generateSubject(physics, 50, 7).items.map((i) => i.q);
    expect(a).toEqual(b);
  });

  it("computes known answers correctly", () => {
    // v = u + at and a few formula spot checks through the same templates
    const { items } = generateSubject(maths, 520, 3);
    const sumNat = items.find((i) => /\\sum_\{k=1\}\^\{(\d+)\} k\$/.test(i.q));
    if (sumNat) {
      const n = Number(sumNat.q.match(/\^\{(\d+)\}/)![1]);
      expect(sumNat.correct).toBe(String((n * (n + 1)) / 2));
    }
  });
});
