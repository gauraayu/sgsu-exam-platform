import { describe, expect, it } from "vitest";
import { apportion, DEFAULT_PRESETS, formatTitle, planDifficulty, planSubjects, subjectsLabel } from "@/lib/exam/quick";
import { examDefaultsSchema } from "@/lib/validation/exam-defaults";
import { newAccessCode, normalizeAccessCode } from "@/services/exam.service";

describe("Quick Generate planning", () => {
  it("apportions exactly to the total with deterministic tie-breaking", () => {
    expect(apportion(100, [30, 45, 25])).toEqual([30, 45, 25]);
    expect(apportion(90, [30, 45, 25])).toEqual([27, 41, 22]); // 27 + 40.5 + 22.5 → remainders .5,.5 → earlier first
    expect(apportion(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(apportion(7, [0, 0])).toEqual([4, 3]);
    for (let t = 1; t <= 200; t += 17) expect(apportion(t, [3, 7, 11, 2]).reduce((a, n) => a + n, 0)).toBe(t);
  });

  it("uses a preset when the selected subjects match it exactly (any order)", () => {
    expect(planSubjects(100, ["Mathematics", "Physics", "Chemistry"], DEFAULT_PRESETS)).toEqual({ counts: { Physics: 35, Chemistry: 35, Mathematics: 30 }, preset: "PCM" });
    expect(planSubjects(100, ["Verbal Ability", "Logical Reasoning", "Quantitative Aptitude"], DEFAULT_PRESETS).counts).toEqual({ "Quantitative Aptitude": 40, "Logical Reasoning": 35, "Verbal Ability": 25 });
    // preset scaled when the total differs
    const scaled = planSubjects(60, ["Physics", "Chemistry", "Mathematics"], DEFAULT_PRESETS).counts;
    expect(scaled).toEqual({ Physics: 21, Chemistry: 21, Mathematics: 18 });
  });

  it("splits evenly in canonical order when no preset matches", () => {
    expect(planSubjects(100, ["Mathematics", "Physics"], DEFAULT_PRESETS)).toEqual({ counts: { Physics: 50, Mathematics: 50 }, preset: null });
    expect(planSubjects(100, ["Verbal Ability", "Physics", "Logical Reasoning"], DEFAULT_PRESETS).counts).toEqual({ Physics: 34, "Logical Reasoning": 33, "Verbal Ability": 33 });
    expect(planSubjects(100, ["Chemistry"], DEFAULT_PRESETS).counts).toEqual({ Chemistry: 100 });
  });

  it("plans difficulty counts that sum to the total", () => {
    expect(planDifficulty(100, { Easy: 30, Medium: 45, Hard: 25 })).toEqual({ Easy: 30, Medium: 45, Hard: 25 });
    const d = planDifficulty(37, { Easy: 30, Medium: 45, Hard: 25 });
    expect(d.Easy + d.Medium + d.Hard).toBe(37);
  });

  it("builds meaningful titles", () => {
    expect(subjectsLabel(["Physics", "Chemistry", "Mathematics"])).toBe("PCM Entrance");
    expect(subjectsLabel(["Quantitative Aptitude", "Logical Reasoning", "Verbal Ability"])).toBe("Aptitude");
    expect(subjectsLabel(["Physics"])).toBe("Physics");
    expect(subjectsLabel(["Physics", "Quantitative Aptitude"])).toBe("Physics & Quant");
    expect(formatTitle("SGSU {subjects} Assessment", ["Chemistry", "Physics", "Mathematics"], new Date("2026-11-16T10:00:00Z"))).toBe("SGSU PCM Entrance Assessment");
    expect(formatTitle("SGSU {subjects} Test · {date}", ["Logical Reasoning"], new Date("2026-11-16T10:00:00Z"))).toBe("SGSU Logical Reasoning Test · 16 Nov 2026");
  });

  it("validates default settings (difficulty must total 100%)", () => {
    const base = {
      totalQuestions: 100, durationMinutes: 120, difficultyPercent: { Easy: 30, Medium: 45, Hard: 25 }, marking: { correct: 4, incorrect: 1, unanswered: 0 }, passingPercentage: 40,
      shuffleQuestions: true, shuffleOptions: true, security: { oneAttempt: true, fullscreen: true, tabSwitchWarnings: true, fullscreenExitWarnings: true, maxWarnings: 3, terminateOnMaxWarnings: true, camera: false, microphone: false, soundMonitoring: false },
      resultRelease: "immediate", allowAnswerReview: false, defaultValidityDays: 7,
    };
    expect(examDefaultsSchema.safeParse(base).success).toBe(true);
    const bad = examDefaultsSchema.safeParse({ ...base, difficultyPercent: { Easy: 30, Medium: 45, Hard: 30 } });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0].message).toMatch(/add up to 105%/);
  });
});

describe("Exam access codes", () => {
  it("are SGSU-XXXXXX with unambiguous characters and are effectively unique", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const c = newAccessCode();
      expect(c).toMatch(/^SGSU-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
      seen.add(c);
    }
    expect(seen.size).toBeGreaterThan(4990);
  });
  it("accept lower case, spaces and a missing prefix when typed", () => {
    expect(normalizeAccessCode(" sgsu-7k92qf ")).toBe("SGSU-7K92QF");
    expect(normalizeAccessCode("7K92QF")).toBe("SGSU-7K92QF");
    expect(normalizeAccessCode("SGSU 7K9 2QF")).toBe("SGSU-7K92QF");
    expect(normalizeAccessCode("SGSU-123")).toBeNull();
  });
});
