import { expect, type APIRequestContext, type Page, type Browser } from "@playwright/test";

export const ADMIN = { email: "admin@e2e.sgsu", password: "Admin@12345" };

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

export async function adminRequest(browser: Browser) {
  const ctx = await browser.newContext();
  const r = await ctx.request.post("/api/auth/login", { data: ADMIN });
  expect(r.ok()).toBeTruthy();
  return ctx;
}

let signupSeq = 0;
export async function signupViaApi(request: APIRequestContext, email: string) {
  // Each test student signs up from its own address, as real students would; the per-IP signup
  // limit (20 per hour) stays in force and is covered by the security tests.
  signupSeq++;
  const r = await request.post("/api/auth/signup", {
    headers: { "x-forwarded-for": `10.20.${Math.floor(signupSeq / 250)}.${(signupSeq % 250) + 1}` },
    data: { fullName: `Test ${email.split("@")[0]}`, email, mobile: "9876543210", password: "Student@123", confirmPassword: "Student@123", academicLevel: "Class 12", institutionName: "E2E School" },
  });
  expect(r.status(), await r.text()).toBe(201);
}

/** Creates, generates and publishes an exam through the admin API. Returns its id and share token. */
export async function publishExamViaApi(request: APIRequestContext, over: Record<string, unknown> = {}) {
  const now = Date.now();
  const config = {
    title: `E2E ${Math.random().toString(36).slice(2, 7)}`,
    durationMinutes: 30,
    totalQuestions: 3,
    startDate: new Date(now - 60_000).toISOString(),
    endDate: new Date(now + 86_400_000).toISOString(),
    passingMarks: 0,
    subjectDistribution: [{ subject: "Physics", count: 1 }, { subject: "Chemistry", count: 1 }, { subject: "Mathematics", count: 1 }],
    ...over,
  };
  const c = await request.post("/api/admin/exams", { data: config });
  expect(c.status(), await c.text()).toBe(201);
  const { id } = await c.json();
  const g = await request.post(`/api/admin/exams/${id}/generate`);
  expect(g.ok(), await g.text()).toBeTruthy();
  const p = await request.post(`/api/admin/exams/${id}/publish`);
  expect(p.ok(), await p.text()).toBeTruthy();
  const detail = await (await request.get(`/api/admin/exams/${id}`)).json();
  return { id: id as string, token: detail.exam.shareToken as string };
}

export function mockVisibilityHidden(page: Page) {
  return page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });
}
