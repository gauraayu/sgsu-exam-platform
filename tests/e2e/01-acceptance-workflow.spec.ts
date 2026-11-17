import { expect, test } from "@playwright/test";
import { ADMIN, login } from "./helpers";

/**
 * Final acceptance workflow:
 * Admin Login → Local JSONL Import → MongoDB Question Bank → Question Verification → Generate Exam → Preview → Publish →
 * Share Link → Student Signup → Permanent Account → Start Test → Answer → Autosave → Refresh/Resume → Submit →
 * Automatic Evaluation → Student Result → Admin Results → Export Report.
 */
test.describe.serial("acceptance workflow", () => {
  let examUrl = "";
  let examId = "";
  const studentEmail = `riya.${Date.now()}@example.com`;

  test("admin signs in and lands on the dashboard", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Examination Dashboard" })).toBeVisible();
    await expect(page.getByText("Registered students", { exact: true })).toBeVisible();
  });

  test("admin imports the local JSONL datasets into MongoDB", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/import/local");
    await expect(page.getByText("train.jsonl").first()).toBeVisible();
    await page.getByRole("button", { name: "Select all" }).click();
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.getByText("Import preview")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("5,446")).toBeVisible();
    // Curation policy is on by default: unusable questions are listed as removed, not imported.
    await expect(page.getByText("Removed by curation policy")).toBeVisible();
    await expect(page.getByText("AI-solved answer keys", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^Import [\d,]+ new question/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Import" }).click();
    await expect(page.getByText("Import complete")).toBeVisible({ timeout: 60_000 });

    // Re-import is idempotent
    await page.getByRole("button", { name: "Import more" }).click();
    await page.getByRole("button", { name: "Select all" }).click();
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.getByText("Import preview")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Import 0 new question(s)" })).toBeDisabled();
  });

  test("admin browses questions subject-wise in the question bank (no review step)", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/questions");
    for (const subject of ["Physics", "Chemistry", "Mathematics"]) {
      await page.getByRole("tab", { name: new RegExp(`^${subject}`) }).click();
      await expect(page.getByRole("tab", { name: new RegExp(`^${subject}`) })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByText(`Topics · ${subject === "Mathematics" ? "Maths" : subject}`)).toBeVisible();
      await expect(page.locator("tbody tr").first()).toBeVisible();
    }
    await page.getByRole("checkbox", { name: "Select all on this page" }).click();
    await expect(page.getByRole("button", { name: "Verify", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Clear selection" }).click();
    // Questions with figures that could not be verified were removed; an AI-solved key is shown for confirmation.
    await page.goto("/admin/questions?search=P-20-Q7");
    await expect(page.getByText(/No questions/i).first()).toBeVisible();
    await page.goto("/admin/questions?subject=Physics&search=P-02-Q45");
    await page.getByRole("button", { name: /convex lens/i }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText("Reviewer notes")).toBeVisible();
    await expect(drawer.getByText(/Answer key solved by AI reviewer/)).toBeVisible();
  });

  test("admin creates an exam with the wizard, generates, previews, replaces a question and publishes", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/exams/new?mode=custom");
    await page.getByLabel("Exam title").fill("SGSU PCM Entrance Assessment — E2E");
    await page.getByLabel("Total questions").fill("5");
    const istNow = new Date(Date.now() + 330 * 60_000 - 5 * 60_000).toISOString().slice(0, 16);
    await page.getByLabel("Start date & time").fill(istNow); // default time zone: IST
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Physics questions").fill("2");
    await page.getByLabel("Chemistry questions").fill("2");
    await page.getByLabel("Mathematics questions").fill("1");
    await expect(page.getByText("5 / 5")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("Allow answer review").click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Configuration is valid")).toBeVisible();
    await page.getByRole("button", { name: "Create draft exam" }).click();
    await expect(page).toHaveURL(/\/admin\/exams\/[a-f\d]{24}$/);
    examId = page.url().split("/").pop()!;

    await page.getByRole("button", { name: "Generate paper" }).click();
    await expect(page.getByText("Q5", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Physics\s*2/).first()).toBeVisible();

    await page.getByRole("button", { name: "Replace" }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Replace" }).click();
    await expect(page.getByText("Question replaced.")).toBeVisible();

    await page.getByRole("button", { name: "Publish" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Publish exam" }).click();
    await expect(page.getByText("Share this examination")).toBeVisible();
    examUrl = (await page.getByTestId("share-link").innerText()).trim();
    await expect(page.getByTestId("share-code")).toHaveText(/^SGSU-[A-Z2-9]{6}$/);
    expect(examUrl).toMatch(/\/exam\/sgsu-pcm-entrance-assessment-e2e-[a-z0-9]{6}$/);
    // QR codes were removed: only the link and the access code are offered.
    await expect(page.getByAltText(/QR code/)).toHaveCount(0);
  });

  test("student opens the link, signs up once and returns to the same exam", async ({ page }) => {
    await page.goto(examUrl);
    await expect(page.getByRole("heading", { name: "SGSU PCM Entrance Assessment — E2E" })).toBeVisible();
    await page.getByRole("link", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/signup\?next=/);
    await page.getByLabel("Full name").fill("Riya Sharma");
    await page.getByLabel("Email").fill(studentEmail);
    await page.getByLabel("Mobile number").fill("9876543210");
    await page.getByLabel("Academic level").selectOption("Class 12");
    await page.getByLabel("School / college").fill("Delhi Public School, Bhopal");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("Exam@2026");
    await page.getByRole("textbox", { name: "Confirm password" }).fill("Exam@2026");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(examUrl);
    await expect(page.getByText("Begin your exam")).toBeVisible();
  });

  test("student takes the exam: answers, autosave, refresh/resume, submit, result", async ({ page }) => {
    await login(page, studentEmail, "Exam@2026");
    await page.goto(examUrl);
    await page.getByText("I have read and understood the instructions").click();
    await page.getByRole("button", { name: "Start exam" }).click();
    await expect(page).toHaveURL(/\/attempt\/[a-f\d]{24}$/);
    const fsGate = page.getByRole("button", { name: "Return to fullscreen" });
    if (await fsGate.isVisible().catch(() => false)) await fsGate.click();

    await expect(page.getByText("Question 1")).toBeVisible();
    const fsGate2 = page.getByRole("button", { name: "Return to fullscreen" });
    if (await fsGate2.isVisible().catch(() => false)) await fsGate2.click();
    const options = page.getByRole("radio");
    await options.nth(1).click();
    await expect(options.nth(1)).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Save & Next" }).click();
    await expect(page.getByText("Question 2")).toBeVisible();
    await page.getByRole("radio").nth(0).click();
    await page.getByRole("button", { name: "Mark for review" }).click();
    await expect(page.getByText(/Saved \d/)).toBeVisible({ timeout: 10_000 });
    const timerBefore = await page.getByRole("timer").innerText();

    await page.reload();
    // The page returns to the question the student was on (Question 2).
    await expect(page.getByText("Question 2", { exact: true })).toBeVisible();
    // After a refresh the browser leaves fullscreen; the exam is gated until the student re-enters it.
    const gate = page.getByRole("button", { name: "Return to fullscreen" });
    await expect(gate).toBeVisible();
    await gate.click();
    await expect(gate).toBeHidden();
    await expect(page.getByText(/Warning \d of 3/)).toHaveCount(0);
    await expect(page.getByRole("radio").nth(0)).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: /^Question 1, answered/ }).click();
    await expect(page.getByRole("radio").nth(1)).toHaveAttribute("aria-checked", "true");
    const toSeconds = (t: string) => t.replace(/[^\d:]/g, "").split(":").map(Number).reduce((a, b) => a * 60 + b, 0);
    const timerAfter = await page.getByRole("timer").innerText();
    expect(toSeconds(timerAfter)).toBeLessThanOrEqual(toSeconds(timerBefore));
    expect(toSeconds(timerAfter)).toBeGreaterThan(118 * 60);

    await page.getByRole("button", { name: /^Question 2, answered marked/ }).click();
    await expect(page.getByRole("radio").nth(0)).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Clear response" }).click();
    await expect(page.getByRole("radio").nth(0)).toHaveAttribute("aria-checked", "false");

    await page.getByRole("button", { name: "Submit", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Submit your exam?")).toBeVisible();
    await dialog.getByRole("button", { name: "Submit exam" }).click();
    await expect(page.getByText("Your exam has been submitted")).toBeVisible();
    await page.getByRole("button", { name: "View result" }).click();
    await expect(page.getByText("Marks obtained")).toBeVisible();
    await expect(page.getByText("Subject-wise performance")).toBeVisible();
    await expect(page.getByText("Answer review")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Physics" })).toBeVisible();
  });

  test("the same account cannot attempt the exam twice, and the account persists across sessions", async ({ page }) => {
    await login(page, studentEmail, "Exam@2026");
    await expect(page).toHaveURL(/\/student$/);
    await page.goto(examUrl);
    await expect(page.getByText("You have completed this exam")).toBeVisible();
    await page.goto("/student/history");
    await expect(page.getByRole("cell", { name: "SGSU PCM Entrance Assessment — E2E" })).toBeVisible();
  });

  test("admin sees the participant, results and exports Excel / CSV / PDF", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto(`/admin/exams/${examId}/monitor`);
    await expect(page.getByText("Riya Sharma")).toBeVisible();
    await page.goto(`/admin/exams/${examId}/results`);
    await expect(page.getByText("Riya Sharma")).toBeVisible();
    await page.getByRole("button", { name: "Details" }).first().click();
    await expect(page.getByText("Responses")).toBeVisible();
    await page.keyboard.press("Escape");

    for (const [format, magic, type] of [["xlsx", "PK", "spreadsheetml"], ["pdf", "%PDF", "application/pdf"], ["csv", "Rank,Student ID", "text/csv"]] as const) {
      const r = await page.request.get(`/api/admin/exams/${examId}/export?format=${format}`);
      expect(r.status()).toBe(200);
      expect(r.headers()["content-type"]).toContain(type);
      const body = await r.body();
      expect(body.subarray(0, magic.length).toString()).toBe(magic);
      if (format === "csv") expect(body.toString()).toContain("Riya Sharma");
    }

    await page.goto("/admin/students");
    await expect(page.getByRole("link", { name: "Riya Sharma" })).toBeVisible();
    const st = await page.request.get("/api/admin/students/export?format=xlsx");
    expect(st.status()).toBe(200);
  });
});
