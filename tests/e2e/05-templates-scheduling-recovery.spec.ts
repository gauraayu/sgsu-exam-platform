import { expect, test, type Page } from "@playwright/test";
import { ADMIN, adminRequest, login, publishExamViaApi, signupViaApi } from "./helpers";

/**
 * Exam templates, automatic scheduling and network recovery.
 * Runs after 01–04 (question bank already imported). Server-clock transitions are also covered
 * with a controlled clock in tests/integration/templates-scheduling-recovery.test.ts.
 */
test.describe.configure({ mode: "serial" });

const NO_FS = { settings: { security: { fullscreen: false, tabSwitchWarnings: false, fullscreenExitWarnings: false } } };

async function newStudent(page: Page, tag: string) {
  const email = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@e2e.sgsu`;
  await signupViaApi(page.request, email);
  return email;
}

async function startFromLink(page: Page, token: string) {
  await page.goto(`/exam/${token}`);
  await page.getByText("I have read and understood the instructions").click();
  await page.getByRole("button", { name: "Start Examination" }).click();
  await page.waitForURL(/\/attempt\/[a-f\d]{24}$/);
  await expect(page.getByText("Question 1", { exact: true })).toBeVisible();
  return page.url().split("/").pop()!;
}

async function serverAnswers(page: Page, attemptId: string) {
  const r = await page.request.get(`/api/attempts/${attemptId}`);
  const body = await r.json();
  return body as { status: string; deadlineAt: string; warningCount: number; answers: Record<string, { selectedOption: number | null; seq: number }>; questions: { id: string }[] };
}

async function goOffline(page: Page) {
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
}
async function goOnline(page: Page) {
  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
}

test.describe("Exam templates", () => {
  let templateId = "";
  let examId = "";

  test("admin creates a PCM template; it persists across sign-in", async ({ page, browser }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/exam-templates");
    await expect(page.getByRole("heading", { name: "Exam Templates" })).toBeVisible();
    await page.getByRole("link", { name: "Create template" }).first().click();
    await page.getByRole("listitem").filter({ hasText: "PCM Entrance Assessment" }).click();
    await expect(page.getByLabel("Template name")).toHaveValue("PCM Entrance Assessment");
    await page.getByLabel("Template name").fill("E2E PCM Template");
    await expect(page.getByLabel("Duration (minutes)")).toHaveValue("120");
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Template is valid.")).toBeVisible();
    await page.getByRole("button", { name: "Create template" }).click();
    await page.waitForURL(/\/admin\/exam-templates$/);
    const card = page.getByTestId("template-card").filter({ hasText: "E2E PCM Template" });
    await expect(card).toBeVisible();
    await expect(card.getByText("Physics 35")).toBeVisible();

    // Signed in again in a fresh session, the template is still there (stored in MongoDB).
    const admin = await adminRequest(browser);
    const list = await (await admin.request.get("/api/admin/exam-templates")).json();
    const t = list.templates.find((x: { name: string }) => x.name === "E2E PCM Template");
    expect(t).toBeTruthy();
    expect(t.totalQuestions).toBe(100);
    expect(t.schedulingDefaults.startBehavior).toBe("immediate");
    templateId = t.id;
    await admin.close();
  });

  test("admin creates an examination from the template with its settings", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/exams/new?mode=template");
    await page.getByTestId("pick-template").filter({ hasText: "E2E PCM Template" }).click();
    await expect(page.getByText(/Settings copied from the template “E2E PCM Template”/)).toBeVisible();
    await expect(page.getByLabel("Exam title")).toHaveValue("E2E PCM Template");
    await expect(page.getByLabel("Duration (minutes)")).toHaveValue("120");
    await page.getByLabel("Exam title").fill("E2E From Template");
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Generate examination" }).click();
    await page.waitForURL(/\/admin\/exams\/[a-f\d]{24}$/);
    examId = page.url().split("/").pop()!;
    await expect(page.getByText(/Created from the template/)).toBeVisible();
    await expect(page.getByText(/100 questions · generated/)).toBeVisible();
    const detail = await (await page.request.get(`/api/admin/exams/${examId}`)).json();
    expect(detail.exam.templateId).toBe(templateId);
    expect(detail.exam.durationMinutes).toBe(120);
    expect(detail.exam.status).toBe("draft"); // never published without confirmation
    expect(detail.exam.scheduleMode).toBe("immediate");
  });

  test("editing the template leaves earlier exams unchanged; duplicate and archive work", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const t = (await (await page.request.get(`/api/admin/exam-templates/${templateId}`)).json()).template;
    const patched = await page.request.patch(`/api/admin/exam-templates/${templateId}`, { data: { ...t, duration: 75, markingScheme: { ...t.markingScheme, correct: 2 } } });
    expect(patched.ok(), await patched.text()).toBeTruthy();
    const detail = await (await page.request.get(`/api/admin/exams/${examId}`)).json();
    expect(detail.exam.durationMinutes).toBe(120);
    expect(detail.exam.marking.correct).toBe(4);

    await page.goto("/admin/exam-templates");
    const card = page.getByTestId("template-card").filter({ hasText: "E2E PCM Template" }).first();
    await card.getByRole("button", { name: /Actions for/ }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    const copy = page.getByTestId("template-card").filter({ hasText: "E2E PCM Template (Copy)" });
    await expect(copy).toBeVisible();
    await copy.getByRole("button", { name: /Actions for/ }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Archive template" }).click();
    await expect(copy).toHaveCount(0);

    await page.goto("/admin/exams/new?mode=template");
    await expect(page.getByTestId("pick-template").filter({ hasText: "E2E PCM Template" }).first()).toBeVisible();
    await expect(page.getByTestId("pick-template").filter({ hasText: "(Copy)" })).toHaveCount(0);
  });
});

test.describe("Scheduling and availability", () => {
  test("scheduled exam: blocked before start (UI and API), opens when the schedule says so", async ({ page, browser }) => {
    const admin = await adminRequest(browser);
    const start = new Date(Date.now() + 2 * 3_600_000);
    const { id, token } = await publishExamViaApi(admin.request, { ...NO_FS, title: "E2E Scheduled", startDate: start.toISOString(), endDate: new Date(start.getTime() + 3_600_000).toISOString() });
    const share = await (await admin.request.get(`/api/admin/exams/${id}/share`)).json();
    expect(share.window).toBe("scheduled");

    await newStudent(page, "sched");
    await page.goto(`/exam/${token}`);
    await expect(page.getByTestId("availability-message")).toHaveText(/^This examination is scheduled to begin on .+ at .+ IST\.$/);
    await expect(page.getByRole("button", { name: "Start Examination" })).toHaveCount(0);
    await expect(page.getByRole("timer")).toContainText("Opens in");
    // Calling the API directly cannot bypass the schedule.
    const direct = await page.request.post(`/api/exams/${token}/start`, { data: { acknowledged: true } });
    expect(direct.status()).toBeGreaterThanOrEqual(400);
    expect(await direct.text()).toContain("scheduled to begin");
    // The same rule applies through the access code.
    await page.goto(`/student/exams?code=${share.accessCode}`);
    await expect(page.getByTestId("code-message")).toContainText("This examination is scheduled to begin on");

    // Admin opens it now (Edit schedule → Start immediately). Link and code stay the same.
    const r = await admin.request.patch(`/api/admin/exams/${id}/schedule`, { data: { scheduleMode: "immediate", accessValidityMinutes: 60, timezone: "Asia/Kolkata", hardEnd: false } });
    expect(r.ok(), await r.text()).toBeTruthy();
    const after = await (await admin.request.get(`/api/admin/exams/${id}/share`)).json();
    expect(after.accessCode).toBe(share.accessCode);
    expect(after.path).toBe(share.path);
    expect(after.window).toBe("active");

    await page.goto(`/exam/${token}`);
    await page.getByText("I have read and understood the instructions").click();
    await page.getByRole("button", { name: "Start Examination" }).click();
    await page.waitForURL(/\/attempt\//);
    await admin.close();
  });

  test("admin sees schedule details, edits time zone; link and code survive a new sign-in", async ({ page, browser }) => {
    const admin = await adminRequest(browser);
    const start = new Date(Date.now() + 5 * 86_400_000);
    const { id } = await publishExamViaApi(admin.request, { ...NO_FS, title: "E2E TZ", startDate: start.toISOString(), endDate: new Date(start.getTime() + 86_400_000).toISOString() });
    const before = await (await admin.request.get(`/api/admin/exams/${id}/share`)).json();
    await admin.close();

    await login(page, ADMIN.email, ADMIN.password);
    await page.goto(`/admin/exams/${id}`);
    await expect(page.getByTestId("exam-lifecycle")).toHaveText("Scheduled");
    const card = page.getByTestId("schedule-card");
    await expect(card.getByTestId("current-availability")).toContainText("Opens in");
    await card.getByRole("button", { name: "Edit schedule" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Time zone").selectOption("UTC");
    await dlg.getByLabel("Start date & time").fill("2030-01-15T10:00");
    await dlg.getByLabel("End date & time").fill("2030-01-15T18:00");
    await dlg.getByRole("button", { name: "Save schedule" }).click();
    await expect(card.getByTestId("schedule-start")).toContainText("UTC");
    const detail = await (await page.request.get(`/api/admin/exams/${id}`)).json();
    expect(detail.exam.startDate).toBe("2030-01-15T10:00:00.000Z");
    expect(detail.exam.timezone).toBe("UTC");

    // Same instant, shown in IST after switching the zone back.
    await card.getByRole("button", { name: "Edit schedule" }).click();
    await page.getByRole("dialog").getByLabel("Time zone").selectOption("Asia/Kolkata");
    await expect(page.getByRole("dialog").getByLabel("Start date & time")).toHaveValue("2030-01-15T15:30");
    await page.getByRole("dialog").getByRole("button", { name: "Save schedule" }).click();
    await expect(card.getByTestId("schedule-start")).toContainText("IST");

    // A brand-new admin session gets the same link and code.
    const again = await adminRequest(browser);
    const after = await (await again.request.get(`/api/admin/exams/${id}/share`)).json();
    expect(after.accessCode).toBe(before.accessCode);
    expect(after.path).toBe(before.path);
    await page.goto("/admin/exams?status=scheduled");
    await expect(page.getByRole("link", { name: "E2E TZ" })).toBeVisible();
    await again.close();
  });

  test("expired and manually closed exams reject new attempts with the right message", async ({ page, browser }) => {
    const admin = await adminRequest(browser);
    const short = await publishExamViaApi(admin.request, { ...NO_FS, title: "E2E Short window", startDate: new Date(Date.now() - 60_000).toISOString(), endDate: new Date(Date.now() + 6_000).toISOString() });
    const closed = await publishExamViaApi(admin.request, { ...NO_FS, title: "E2E Closed" });
    expect((await admin.request.post(`/api/admin/exams/${closed.id}/close`)).ok()).toBeTruthy();
    await admin.close();

    await newStudent(page, "late");
    await page.goto(`/exam/${closed.token}`);
    await expect(page.getByTestId("availability-message")).toHaveText("This examination has been closed by the administrator.");
    await page.waitForTimeout(7_000); // the short window ends
    await page.goto(`/exam/${short.token}`);
    await expect(page.getByTestId("availability-message")).toHaveText("This examination is no longer accepting new attempts.");
    const direct = await page.request.post(`/api/exams/${short.token}/start`, { data: { acknowledged: true } });
    expect(await direct.text()).toContain("no longer accepting new attempts");
  });

  test("students see in-app notices for exams they opened", async ({ page, browser }) => {
    const admin = await adminRequest(browser);
    const start = new Date(Date.now() + 3_600_000);
    const { token } = await publishExamViaApi(admin.request, { ...NO_FS, title: "E2E Notice exam", startDate: start.toISOString(), endDate: new Date(start.getTime() + 3_600_000).toISOString() });
    await admin.close();
    await newStudent(page, "notice");
    await page.goto(`/exam/${token}`);
    await page.goto("/student");
    const notices = page.getByTestId("notices");
    await expect(notices.getByText("Upcoming examination")).toBeVisible();
    await expect(notices.getByText("E2E Notice exam")).toBeVisible();
  });
});

test.describe("Network recovery and answer autosave", () => {
  test("disconnect, queue, reconnect, refresh and submit without losing work", async ({ page, browser }) => {
    const admin = await adminRequest(browser);
    const { token } = await publishExamViaApi(admin.request, {
      ...NO_FS,
      totalQuestions: 9,
      subjectDistribution: [{ subject: "Physics", count: 3 }, { subject: "Chemistry", count: 3 }, { subject: "Mathematics", count: 3 }],
      durationMinutes: 60,
    });
    await admin.close();
    await newStudent(page, "net");
    const attemptId = await startFromLink(page, token);
    const deadline0 = (await serverAnswers(page, attemptId)).deadlineAt;

    // Five answers, confirmed by the server.
    for (let i = 0; i < 5; i++) {
      await page.getByRole("radio").nth(i % 4).click();
      await page.getByRole("button", { name: "Save & Next" }).click();
      await expect(page.getByText(`Question ${i + 2}`, { exact: true })).toBeVisible();
    }
    await expect(page.getByTestId("save-status")).toContainText("Saved");
    const s1 = await serverAnswers(page, attemptId);
    expect(Object.values(s1.answers).filter((a) => a.selectedOption !== null)).toHaveLength(5);

    // Connection drops; a change is kept locally and the UI says so.
    await goOffline(page);
    await expect(page.getByTestId("connection-banner")).toContainText("Connection interrupted. Your saved answers are safe. Unsaved responses will synchronize when the connection returns.");
    await page.getByRole("radio").nth(2).click();
    await expect(page.getByTestId("save-status")).toContainText(/Connection lost · 1 unsaved|Unsaved changes/);
    const q6 = s1.questions[5].id;
    const queued = await page.evaluate((id) => JSON.parse(localStorage.getItem(`sgsu-attempt:${id}`) ?? "null"), attemptId);
    expect(queued.pending[q6]).toMatchObject({ examQuestionId: q6, selectedOption: expect.any(Number) });
    expect(JSON.stringify(queued)).not.toMatch(/correctOption|answerKey|questionText/);

    // Connection returns: verified with the server, then synchronised.
    await goOnline(page);
    await expect(page.getByTestId("save-status")).toContainText("Saved", { timeout: 20_000 });
    await expect(page.getByTestId("connection-banner")).toHaveCount(0);
    const s2 = await serverAnswers(page, attemptId);
    expect(s2.answers[q6].selectedOption).not.toBeNull();

    // Refresh: same attempt, same answers, same question, same deadline, no new warnings.
    await page.reload();
    await expect(page.getByText("Question 6", { exact: true })).toBeVisible();
    expect(page.url()).toContain(attemptId);
    await expect(page.getByRole("radio").nth(2)).toHaveAttribute("aria-checked", "true");
    const s3 = await serverAnswers(page, attemptId);
    expect(s3.deadlineAt).toBe(deadline0);
    expect(s3.warningCount).toBe(0);

    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Submit exam" }).click();
    await expect(page.getByText("Your exam has been submitted")).toBeVisible();
    expect(await page.evaluate((id) => localStorage.getItem(`sgsu-attempt:${id}`), attemptId)).toBeNull();
  });

  test("lost acknowledgement, stale requests and rapid changes keep the newest answer", async ({ page, browser }) => {
    const admin = await adminRequest(browser);
    const { token } = await publishExamViaApi(admin.request, NO_FS);
    await admin.close();
    await newStudent(page, "ack");
    const attemptId = await startFromLink(page, token);

    // The server saves the change but the response never arrives.
    let dropped = 0;
    await page.route(`**/api/attempts/${attemptId}/answers`, async (route) => {
      if (route.request().method() === "PATCH" && dropped === 0 && (route.request().postData() ?? "").includes('"selectedOption"')) {
        dropped++;
        await route.fetch(); // reaches the server
        return route.abort("connectionreset"); // …but the acknowledgement is lost
      }
      return route.continue();
    });
    await page.getByRole("radio").nth(1).click();
    await expect(page.getByTestId("save-status")).not.toContainText("Saved", { timeout: 5_000 });
    // Rapid changes while the retry is pending; the last one must win.
    await page.getByRole("radio").nth(3).click();
    await page.getByRole("radio").nth(0).click();
    await page.unroute(`**/api/attempts/${attemptId}/answers`);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByTestId("save-status")).toContainText("Saved", { timeout: 20_000 });
    const s = await serverAnswers(page, attemptId);
    const qid = s.questions[0].id;
    const chosen = s.answers[qid];
    expect(chosen.selectedOption).not.toBeNull();
    await expect(page.getByRole("radio").nth(0)).toHaveAttribute("aria-checked", "true");

    // An old request arriving late does not overwrite the newer server answer.
    const late = await page.request.patch(`/api/attempts/${attemptId}/answers`, { data: { answers: [{ examQuestionId: qid, selectedOption: chosen.selectedOption === 1 ? 2 : 1, seq: 1 }] } });
    expect((await late.json()).applied).toEqual([]);
    expect((await serverAnswers(page, attemptId)).answers[qid].selectedOption).toBe(chosen.selectedOption);
  });

  test("browser closed while offline: queued answers sync when the exam is reopened", async ({ browser }) => {
    const admin = await adminRequest(browser);
    const { token } = await publishExamViaApi(admin.request, NO_FS);
    await admin.close();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await newStudent(page, "reopen");
    const attemptId = await startFromLink(page, token);
    await goOffline(page);
    await page.getByRole("radio").nth(1).click();
    await expect(page.getByTestId("save-status")).toContainText(/unsaved|Unsaved/);
    await page.close({ runBeforeUnload: false });
    await ctx.setOffline(false);
    const reopened = await ctx.newPage();
    await reopened.goto(`/attempt/${attemptId}`);
    await expect(reopened.getByTestId("save-status")).toContainText("Saved", { timeout: 20_000 });
    const s = await serverAnswers(reopened, attemptId);
    expect(s.answers[s.questions[0].id].selectedOption).not.toBeNull();
    await ctx.close();
  });

  test("submit while offline stays pending, then submits once after reconnection", async ({ page, browser }) => {
    const admin = await adminRequest(browser);
    const { token } = await publishExamViaApi(admin.request, NO_FS);
    await admin.close();
    await newStudent(page, "offsubmit");
    const attemptId = await startFromLink(page, token);
    await page.getByRole("radio").nth(0).click();
    await expect(page.getByTestId("save-status")).toContainText("Saved");
    await goOffline(page);
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Submit exam" }).click();
    await expect(page.getByTestId("connection-banner")).toContainText("Submission pending");
    await expect(page.getByText("Your exam has been submitted")).toHaveCount(0);
    await goOnline(page);
    await expect(page.getByText("Your exam has been submitted")).toBeVisible({ timeout: 20_000 });
    const s = await serverAnswers(page, attemptId);
    expect(s.status).toBe("submitted");
  });

  test("another session finalised the attempt: this tab stops editing and says so", async ({ page, browser }) => {
    const admin = await adminRequest(browser);
    const { token } = await publishExamViaApi(admin.request, NO_FS);
    await admin.close();
    await newStudent(page, "twotabs");
    const attemptId = await startFromLink(page, token);
    expect((await page.request.post(`/api/attempts/${attemptId}/submit`)).ok()).toBeTruthy(); // e.g. a second tab
    await page.getByRole("radio").nth(1).click();
    await expect(page.getByText("Your exam has been submitted")).toBeVisible({ timeout: 20_000 });
  });

  test("queues from another account are ignored; sign-out clears local queues", async ({ page, browser }) => {
    const admin = await adminRequest(browser);
    const { token } = await publishExamViaApi(admin.request, NO_FS);
    await admin.close();
    await newStudent(page, "owner");
    const attemptId = await startFromLink(page, token);
    const s0 = await serverAnswers(page, attemptId);
    const qid = s0.questions[0].id;
    // A queue written under a different account must never be replayed.
    await page.evaluate(
      ([id, q]) =>
        localStorage.setItem(
          `sgsu-attempt:${id}`,
          JSON.stringify({ v: 1, owner: "000000000000000000000000", attemptId: id, seq: 9e12, pending: { [q]: { examQuestionId: q, selectedOption: 4, seq: 9e12, updatedAt: Date.now(), syncStatus: "pending" } }, events: [], index: 0, submitPending: null, touchedAt: Date.now() }),
        ),
      [attemptId, qid],
    );
    await page.reload();
    await expect(page.getByText("Question 1", { exact: true })).toBeVisible();
    await page.waitForTimeout(1500);
    expect((await serverAnswers(page, attemptId)).answers[qid]?.selectedOption ?? null).toBeNull();

    await page.goto("/student");
    await page.evaluate(() => localStorage.setItem("sgsu-attempt:leftover", "{}"));
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("sgsu-attempt:")))).toEqual([]);
  });

  test("when browser storage is unavailable the student is told, and answers still save", async ({ browser }) => {
    const admin = await adminRequest(browser);
    const { token } = await publishExamViaApi(admin.request, NO_FS);
    await admin.close();
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException("QuotaExceededError", "QuotaExceededError");
      };
    });
    const page = await ctx.newPage();
    await newStudent(page, "nostore");
    const attemptId = await startFromLink(page, token);
    await page.getByRole("radio").nth(1).click();
    await expect(page.getByText(/not allowing the exam to keep unsaved answers on this device/)).toBeVisible();
    await expect(page.getByTestId("save-status")).toContainText("Saved");
    const s = await serverAnswers(page, attemptId);
    expect(s.answers[s.questions[0].id].selectedOption).not.toBeNull();
    await ctx.close();
  });
});
