/**
 * HTTP load test against a running server using synthetic accounts.
 *   BASE_URL=http://localhost:3000 EXAM_TOKEN=<share-token> STUDENTS=50 npm run load-test
 * Each virtual student signs up, starts the exam, autosaves every answer one by one and submits.
 */
import "./_env";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.EXAM_TOKEN;
const N = Number(process.env.STUDENTS ?? 50);
if (!TOKEN) throw new Error("Set EXAM_TOKEN to a published exam's share token.");

type Timing = { name: string; ms: number; ok: boolean };
const timings: Timing[] = [];

async function call(name: string, cookie: string, path: string, init: RequestInit = {}) {
  const t = performance.now();
  const res = await fetch(BASE + path, { ...init, headers: { "Content-Type": "application/json", cookie, "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, ...(init.headers ?? {}) } });
  timings.push({ name, ms: performance.now() - t, ok: res.ok });
  return res;
}

async function student(i: number) {
  const email = `load-${Date.now()}-${i}@loadtest.sgsu`;
  const signup = await call("signup", "", "/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ fullName: `Load Student ${i}`, email, mobile: "9876543210", password: "Load@12345", confirmPassword: "Load@12345", academicLevel: "Class 12", institutionName: "Load Test" }),
  });
  const cookie = (signup.headers.get("set-cookie") ?? "").split(";")[0];
  const start = await call("start", cookie, `/api/exams/${TOKEN}/start`, { method: "POST", body: JSON.stringify({ acknowledged: true }) });
  const { attemptId } = await start.json();
  const attempt = await (await call("load-attempt", cookie, `/api/attempts/${attemptId}`)).json();
  for (const q of attempt.questions as { id: string; options: { id: number }[] }[]) {
    await call("autosave", cookie, `/api/attempts/${attemptId}/answers`, { method: "PATCH", body: JSON.stringify({ answers: [{ examQuestionId: q.id, selectedOption: q.options[0]?.id ?? 1 }] }) });
  }
  await call("submit", cookie, `/api/attempts/${attemptId}/submit`, { method: "POST" });
}

async function main() {
  const t0 = performance.now();
  const results = await Promise.allSettled(Array.from({ length: N }, (_, i) => student(i)));
  const total = (performance.now() - t0) / 1000;
  const failed = results.filter((r) => r.status === "rejected");
  const byName = new Map<string, Timing[]>();
  timings.forEach((t) => byName.set(t.name, [...(byName.get(t.name) ?? []), t]));
  const pct = (arr: number[], p: number) => arr.sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))];
  console.table(
    [...byName].map(([name, ts]) => ({ step: name, requests: ts.length, errors: ts.filter((t) => !t.ok).length, p50_ms: Math.round(pct(ts.map((t) => t.ms), 50)), p95_ms: Math.round(pct(ts.map((t) => t.ms), 95)), max_ms: Math.round(Math.max(...ts.map((t) => t.ms))) })),
  );
  console.log(`${N} concurrent students · ${timings.length} requests in ${total.toFixed(1)} s · ${(timings.length / total).toFixed(1)} req/s · ${failed.length} student flow(s) failed`);
  failed.slice(0, 3).forEach((f) => console.log((f as PromiseRejectedResult).reason));
}

void main();
