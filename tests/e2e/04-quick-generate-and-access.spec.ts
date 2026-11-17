import { expect, test, type Page } from "@playwright/test";
import { ADMIN, adminRequest, login, publishExamViaApi, signupViaApi } from "./helpers";

/**
 * Quick Generate, default settings, permanent link + access code, student code access, single attempt,
 * wizard auto-save, consistent sign-in page and absence of QR codes.
 * Runs after 01–03, so the full question bank (PCM + aptitude) is already imported.
 */
test.describe.configure({ mode: "serial" });

async function shareValues(page: Page) {
  await expect(page.getByText("Share this examination")).toBeVisible();
  const link = (await page.getByTestId("share-link").innerText()).trim();
  const code = (await page.getByTestId("share-code").innerText()).trim();
  return { link, code };
}

test.describe("Quick Generate, sharing and code access", () => {
  let examId = "";
  let link = "";
  let code = "";

  test("both Sign in buttons on the home page open the same branded sign-in page", async ({ page }) => {
    await page.setViewportSize({ width: 1020, height: 760 }); // narrower than a typical laptop: the brand panel must stay
    for (const where of ["header", "hero"] as const) {
      await page.goto("/");
      const btn = where === "header" ? page.getByRole("banner").getByRole("link", { name: "Sign in" }) : page.getByRole("main").getByRole("link", { name: /^Sign in/ });
      await btn.click();
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
      await expect(page.getByRole("complementary").getByRole("heading", { name: "SGSU Smart Assessment Portal" })).toBeVisible();
    }
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Have an examination code?" })).toBeVisible();
    await expect(page.getByText("Quantitative Aptitude").first()).toBeVisible();
  });

  test("admin creates an exam with Quick Generate (PCM) and publishes it", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/exams/new");
    await expect(page.getByRole("radio", { name: /Quick Generate/ })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("checkbox", { name: /^Physics/ }).click();
    await page.getByRole("checkbox", { name: /^Chemistry/ }).click();
    await page.getByRole("checkbox", { name: /^Mathematics/ }).click();
    const plan = page.getByTestId("quick-plan");
    await expect(plan).toContainText("SGSU PCM Entrance Assessment");
    await expect(plan).toContainText(/Physics\s*35/);
    await expect(plan).toContainText(/Mathematics\s*30/);
    await expect(plan).toContainText("Easy 30 · Medium 45 · Hard 25");
    await page.getByRole("button", { name: "Generate examination" }).click();
    await page.waitForURL(/\/admin\/exams\/[a-f0-9]{24}$/, { timeout: 60_000 });
    examId = page.url().split("/").pop()!;
    await expect(page.getByText("Q100", { exact: true })).toBeVisible({ timeout: 30_000 });

    const admin = await adminRequest(page.context().browser()!);
    const detail = await (await admin.request.get(`/api/admin/exams/${examId}`)).json();
    expect(detail.exam.generationMode).toBe("quick");
    expect(detail.distribution.subjects).toEqual({ Physics: 35, Chemistry: 35, Mathematics: 30 });
    expect(detail.distribution.difficulties).toEqual({ Easy: 30, Medium: 45, Hard: 25 });

    await page.getByRole("button", { name: "Publish" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Publish exam" }).click();
    ({ link, code } = await shareValues(page));
    expect(link).toMatch(/\/exam\/sgsu-pcm-entrance-assessment-[a-z0-9]{6}$/);
    expect(code).toMatch(/^SGSU-[A-Z2-9]{6}$/);
    await admin.close();
  });

  test("link and code stay the same after refresh, logout/login and from All Examinations; copy works; no QR anywhere", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto(`/admin/exams/${examId}`);
    expect(await shareValues(page)).toEqual({ link, code });
    await page.reload();
    expect(await shareValues(page)).toEqual({ link, code });

    await page.getByRole("button", { name: "Copy link" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
    await page.getByRole("button", { name: "Copy code" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
    await expect(page.locator('img[alt*="QR" i]')).toHaveCount(0);
    await expect(page.getByText(/QR code/i)).toHaveCount(0);

    await page.context().clearCookies();
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/exams?status=active");
    const row = page.getByRole("row", { name: /SGSU PCM Entrance Assessment/ }).first();
    await expect(row).toContainText(code);
    await row.getByRole("button", { name: "Exam actions" }).click();
    await page.getByRole("menuitem", { name: "Share examination" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("share-link")).toHaveText(link);
    await expect(dialog.getByTestId("share-code")).toHaveText(code);
    await expect(dialog.getByText("Remaining validity")).toBeVisible();
    await expect(dialog.getByText(/QR/i)).toHaveCount(0);
  });

  test("a student joins with the code, and the link and the code share one attempt", async ({ page, browser }) => {
    const email = `code-${Date.now()}@e2e.sgsu`;
    const ctx = await browser.newContext();
    await signupViaApi(ctx.request, email);
    await ctx.close();
    await login(page, email, "Student@123");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Examinations", exact: true }).click();
    await page.getByLabel("Examination code").fill("SGSU-ZZZZZ2");
    await page.getByRole("button", { name: "Find examination" }).click();
    await expect(page.getByText("Invalid examination code. Please verify the code and try again.")).toBeVisible();

    await page.getByLabel("Examination code").fill(code.toLowerCase());
    await page.getByRole("button", { name: "Find examination" }).click();
    const result = page.getByTestId("code-result");
    await expect(result).toContainText("SGSU PCM Entrance Assessment");
    await expect(result).toContainText("100 questions");
    await result.getByRole("link", { name: /start examination/i }).click();
    await expect(page).toHaveURL(new RegExp(`${new URL(link).pathname}$`));
    await page.getByText("I have read and understood the instructions").click();
    await page.getByRole("button", { name: "Start exam" }).click();
    await page.waitForURL(/\/attempt\//);
    const attemptUrl = page.url();

    // Same student, by code again: the existing attempt is recognised, not a new one.
    await page.goto("/student/exams");
    await page.getByLabel("Examination code").fill(code);
    await page.getByRole("button", { name: "Find examination" }).click();
    await expect(page.getByTestId("code-result")).toContainText("In progress");
    await page.getByTestId("code-result").getByRole("link", { name: /Continue examination/ }).click();
    await page.getByText("I have read and understood the instructions").click();
    await page.getByRole("button", { name: /Resume exam/ }).click();
    await page.waitForURL(/\/attempt\//);
    expect(page.url()).toBe(attemptUrl);

    const admin = await adminRequest(browser);
    const mon = await (await admin.request.get(`/api/admin/exams/${examId}/monitoring`)).json();
    expect(mon.rows.filter((r: { email: string }) => r.email === email)).toHaveLength(1);
    await admin.close();
  });

  test("published exams stay hidden from students until opened by link or code", async ({ page, browser }) => {
    const admin = await adminRequest(browser);
    const title = `Hidden ${Date.now()}`;
    const { id } = await publishExamViaApi(admin.request, { title });
    const share = await (await admin.request.get(`/api/admin/exams/${id}/share`)).json();
    await admin.close();

    const email = `hidden-${Date.now()}@e2e.sgsu`;
    const ctx = await browser.newContext();
    await signupViaApi(ctx.request, email);
    await ctx.close();
    await login(page, email, "Student@123");
    await page.goto("/student");
    await expect(page.getByText("No active examination")).toBeVisible();
    await expect(page.getByText(title)).toHaveCount(0);
    await page.goto("/student/exams");
    await expect(page.getByText("No examinations yet")).toBeVisible();
    await expect(page.getByText(title)).toHaveCount(0);

    await page.getByLabel("Examination code").fill(share.accessCode);
    await page.getByRole("button", { name: "Find examination" }).click();
    await page.getByTestId("code-result").getByRole("link").first().click();
    await page.getByText("I have read and understood the instructions").click();
    await page.getByRole("button", { name: "Start exam" }).click();
    await page.waitForURL(/\/attempt\//);
    await page.goto("/student/exams");
    await expect(page.getByText(title)).toBeVisible();
  });

  test("closed exams reject new attempts by code with a clear message", async ({ page, browser }) => {
    const admin = await adminRequest(browser);
    const { id } = await publishExamViaApi(admin.request, { title: `Closed ${Date.now()}` });
    const share = await (await admin.request.get(`/api/admin/exams/${id}/share`)).json();
    expect((await admin.request.post(`/api/admin/exams/${id}/close`)).ok()).toBeTruthy();
    const after = await (await admin.request.get(`/api/admin/exams/${id}/share`)).json();
    expect(after.accessCode).toBe(share.accessCode); // kept for reference
    expect(after.window).toBe("closed");
    await admin.close();

    const email = `closed-${Date.now()}@e2e.sgsu`;
    const ctx = await browser.newContext();
    await signupViaApi(ctx.request, email);
    await ctx.close();
    await login(page, email, "Student@123");
    // A code typed on the home page carries through sign-in to the Examinations page.
    await page.goto(`/student/exams?code=${share.accessCode}`);
    await expect(page.getByText("This examination has been closed by the administrator.")).toBeVisible();
  });

  test("default examination settings persist and drive the next Quick Generate", async ({ page, browser }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/settings/exam-defaults");
    await page.getByLabel("Total questions").fill("30");
    await page.getByLabel("Duration").fill("45");
    await page.getByRole("button", { name: "Save as default" }).click();
    await expect(page.getByText(/Default examination settings saved/)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Total questions")).toHaveValue("30");
    await expect(page.getByLabel("Duration")).toHaveValue("45");

    const admin = await adminRequest(browser);
    const r = await admin.request.post("/api/admin/exams/quick-generate", { data: { subjects: ["Quantitative Aptitude", "Logical Reasoning", "Verbal Ability"] } });
    expect(r.status(), await r.text()).toBe(201);
    const made = await r.json();
    expect(made.title).toBe("SGSU Aptitude Assessment");
    expect(made.counts).toEqual({ "Quantitative Aptitude": 12, "Logical Reasoning": 11, "Verbal Ability": 7 });
    const detail = await (await admin.request.get(`/api/admin/exams/${made.id}`)).json();
    expect(detail.exam).toMatchObject({ totalQuestions: 30, durationMinutes: 45 });
    expect(detail.paper).toHaveLength(30);
    // the earlier PCM exam is unchanged
    const pcm = await (await admin.request.get(`/api/admin/exams/${examId}`)).json();
    expect(pcm.exam).toMatchObject({ totalQuestions: 100, durationMinutes: 120 });
    await admin.close();
  });

  test("the custom wizard auto-saves and offers to resume after leaving", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/exams/new?mode=custom");
    await page.getByLabel("Exam title").fill("Half-finished draft E2E");
    await expect(page.getByText(/Draft saved automatically/)).toBeVisible({ timeout: 10_000 });
    await page.goto("/admin");
    await page.goto("/admin/exams/new?mode=custom");
    await expect(page.getByText("You have an unsaved examination draft")).toBeVisible();
    await expect(page.getByText("“Half-finished draft E2E”")).toBeVisible();
    await page.getByRole("button", { name: "Resume draft" }).click();
    await expect(page.getByLabel("Exam title")).toHaveValue("Half-finished draft E2E");
    await page.reload();
    await page.getByRole("button", { name: "Discard and start new" }).click();
    await expect(page.getByLabel("Exam title")).toHaveValue("");
    await page.reload();
    await expect(page.getByText("You have an unsaved examination draft")).toHaveCount(0);
  });
});
