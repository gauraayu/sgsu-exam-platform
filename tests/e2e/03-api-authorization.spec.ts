import { expect, test } from "@playwright/test";
import { adminRequest, publishExamViaApi, signupViaApi } from "./helpers";

test.describe("API authorization & data protection", () => {
  test("unauthenticated and student requests cannot reach admin APIs", async ({ browser, request }) => {
    for (const path of ["/api/admin/questions", "/api/admin/exams", "/api/admin/students", "/api/admin/dashboard"]) {
      expect((await request.get(path)).status()).toBe(401);
    }
    const student = await browser.newContext();
    await signupViaApi(student.request, `authz.${Date.now()}@example.com`);
    for (const path of ["/api/admin/questions", "/api/admin/exams", "/api/admin/students", "/api/admin/import/local/files"]) {
      expect((await student.request.get(path)).status()).toBe(403);
    }
    expect((await student.request.post("/api/admin/exams", { data: {} })).status()).toBe(403);
    await student.close();
  });

  test("students cannot see answer keys or other students' attempts and results", async ({ browser }) => {
    const admin = await adminRequest(browser);
    const { token } = await publishExamViaApi(admin.request, { settings: { security: { fullscreen: false } } });
    const a = await browser.newContext();
    const b = await browser.newContext();
    await signupViaApi(a.request, `ka.${Date.now()}@example.com`);
    await signupViaApi(b.request, `kb.${Date.now()}@example.com`);
    const start = await a.request.post(`/api/exams/${token}/start`, { data: { acknowledged: true } });
    expect(start.status()).toBe(201);
    const { attemptId } = await start.json();
    const view = await a.request.get(`/api/attempts/${attemptId}`);
    const text = await view.text();
    for (const k of ["correctOption", "answerKeySnapshot", "numericalAnswer", "explanation", "solutionImages"]) expect(text).not.toContain(k);
    expect((await b.request.get(`/api/attempts/${attemptId}`)).status()).toBe(403);
    expect((await b.request.get(`/api/student/results/${attemptId}`)).status()).toBe(403);
    expect((await b.request.post(`/api/attempts/${attemptId}/submit`)).status()).toBe(403);

    // Repeated / concurrent submits produce a single result.
    const submits = await Promise.all(Array.from({ length: 5 }, () => a.request.post(`/api/attempts/${attemptId}/submit`)));
    expect(submits.every((s) => s.ok())).toBeTruthy();
    const restart = await a.request.post(`/api/exams/${token}/start`, { data: { acknowledged: true } });
    expect(restart.status()).toBe(409);
    await Promise.all([a.close(), b.close(), admin.close()]);
  });

  test("invalid input is rejected, import URLs are restricted and cron requires its secret", async ({ browser, request }) => {
    expect((await request.post("/api/auth/signup", { data: { email: "x" } })).status()).toBe(422);
    expect((await request.get("/api/cron/finalize-attempts")).status()).toBe(401);
    expect((await request.get("/api/cron/finalize-attempts", { headers: { authorization: "Bearer e2e-cron" } })).status()).toBe(200);
    const admin = await adminRequest(browser);
    const bad = await admin.request.post("/api/admin/import/api", { data: { mode: "inspect", url: "https://169.254.169.254/latest/meta-data" } });
    expect(bad.status()).toBe(400);
    const host = await admin.request.post("/api/admin/import/api", { data: { mode: "inspect", url: "https://evil.example.com/rows" } });
    expect(host.status()).toBe(403);
    const http = await admin.request.post("/api/admin/import/api", { data: { mode: "inspect", url: "http://datasets-server.huggingface.co/rows" } });
    expect(http.status()).toBe(400);
    const dup = await admin.request.post("/api/auth/signup", { data: { fullName: "Dup", email: "admin@e2e.sgsu", mobile: "9876543210", password: "Admin@12345", confirmPassword: "Admin@12345", academicLevel: "Class 12", institutionName: "XY School" } });
    expect(dup.status()).toBe(409);
    await admin.close();
  });

  test("insufficient usable questions produce a clear error and no paper", async ({ browser }) => {
    const admin = await adminRequest(browser);
    const now = Date.now();
    const c = await admin.request.post("/api/admin/exams", {
      data: { title: "Too big", durationMinutes: 30, totalQuestions: 400, startDate: new Date(now).toISOString(), endDate: new Date(now + 86_400_000).toISOString(), subjectDistribution: [{ subject: "Chemistry", count: 400, difficulty: { Easy: 0, Medium: 0, Hard: 400 } }] },
    });
    const { id } = await c.json();
    const g = await admin.request.post(`/api/admin/exams/${id}/generate`);
    expect(g.status()).toBe(422);
    expect((await g.json()).error.message).toMatch(/^Only \d+ usable Hard Chemistry questions are available for the selected filters\. Please add more questions or adjust the distribution\.$/);
    await admin.close();
    void publishExamViaApi;
  });
});
