import { expect, test } from "@playwright/test";
import { adminRequest, login, mockVisibilityHidden, publishExamViaApi, signupViaApi } from "./helpers";

test.describe("exam security & integrity", () => {
  test("tab-switch warnings: 1st and 2nd warn, duplicates coalesce, 3rd confirmed violation terminates", async ({ browser, page }) => {
    const admin = await adminRequest(browser);
    const { token } = await publishExamViaApi(admin.request, { settings: { security: { fullscreen: false, tabSwitchWarnings: true, maxWarnings: 3 } } });
    const email = `tab.${Date.now()}@example.com`;
    await signupViaApi(page.request, email);
    await page.goto(`/exam/${token}`);
    await page.getByText("I have read and understood the instructions").click();
    await page.getByRole("button", { name: "Start exam" }).click();
    await expect(page.getByText("Question 1")).toBeVisible();

    await mockVisibilityHidden(page);
    await expect(page.getByText(/Warning 1 of 3/)).toBeVisible();
    await mockVisibilityHidden(page); // same burst → coalesced, not counted
    await page.getByRole("button", { name: "I understand — continue" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText(/Warning 2 of 3/)).toHaveCount(0);

    await page.waitForTimeout(2200);
    await mockVisibilityHidden(page);
    await expect(page.getByText(/Warning 2 of 3/)).toBeVisible();
    await page.getByRole("button", { name: "I understand — continue" }).click();
    await page.waitForTimeout(2200);
    await mockVisibilityHidden(page);
    await expect(page.getByText("Your exam was submitted automatically")).toBeVisible();
    await page.getByRole("button", { name: "View result" }).click();
    await expect(page.getByText("Submitted automatically after the warning limit was reached")).toBeVisible();
    await admin.close();
  });

  test("fullscreen exit is detected and the exam is gated until fullscreen is restored", async ({ browser, page }) => {
    const admin = await adminRequest(browser);
    const { token } = await publishExamViaApi(admin.request, { settings: { security: { fullscreen: true, fullscreenExitWarnings: true, tabSwitchWarnings: false, maxWarnings: 3 } } });
    await signupViaApi(page.request, `fs.${Date.now()}@example.com`);
    await page.goto(`/exam/${token}`);
    await page.getByText("I have read and understood the instructions").click();
    await page.getByRole("button", { name: "Start exam" }).click();
    await expect(page.getByText("Question 1")).toBeVisible();
    const gate = page.getByRole("button", { name: "Return to fullscreen" });
    if (await gate.isVisible().catch(() => false)) await gate.click();
    const inFs = await page.evaluate(() => !!document.fullscreenElement);
    if (inFs) {
      await page.evaluate(() => document.exitFullscreen());
      await expect(page.getByText(/Warning 1 of 3: you left fullscreen mode/)).toBeVisible();
    } else {
      // Headless environments may refuse fullscreen; the gate itself must still be enforced.
      await expect(page.getByText("This exam must be taken in fullscreen")).toBeVisible();
    }
    await admin.close();
  });

  test("camera-required exam: fake camera passes the system check; denial blocks start and offers an accommodation", async ({ browser }) => {
    const admin = await adminRequest(browser);
    const { token } = await publishExamViaApi(admin.request, { settings: { security: { fullscreen: false, tabSwitchWarnings: false, camera: true, microphone: true, soundMonitoring: true } } });

    const ok = await browser.newContext({ permissions: ["camera", "microphone"] });
    const p1 = await ok.newPage();
    await signupViaApi(p1.request, `cam.${Date.now()}@example.com`);
    await p1.goto(`/exam/${token}`);
    await p1.getByRole("button", { name: "Allow camera" }).click();
    await p1.getByRole("button", { name: "Allow microphone" }).click();
    await expect(p1.getByLabel("Camera preview")).toBeVisible();
    await p1.getByText("I have read and understood the instructions").click();
    await expect(p1.getByRole("button", { name: "Start exam" })).toBeEnabled();
    await p1.getByRole("button", { name: "Start exam" }).click();
    await expect(p1.getByText(/Camera on \(not recorded\)/)).toBeVisible();
    await expect(p1.getByText(/sound level monitored locally/)).toBeVisible();
    await ok.close();

    const denied = await browser.newContext();
    await denied.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
    });
    const p2 = await denied.newPage();
    await signupViaApi(p2.request, `nocam.${Date.now()}@example.com`);
    await p2.goto(`/exam/${token}`);
    await p2.getByRole("button", { name: "Allow camera" }).click();
    await expect(p2.getByText("Permission was denied or no camera was found.")).toBeVisible();
    await p2.getByText("I have read and understood the instructions").click();
    await expect(p2.getByRole("button", { name: "Start exam" })).toBeDisabled();
    await p2.getByRole("button", { name: "Request an accommodation" }).click();
    await p2.getByLabel("Reason").fill("My laptop has no working webcam or microphone.");
    await p2.getByRole("button", { name: "Send request" }).click();
    await expect(p2.getByText("pending")).toBeVisible();
    await denied.close();
    await admin.close();
  });

  test("offline answers are kept locally and saved when the connection returns", async ({ browser, page, context }) => {
    const admin = await adminRequest(browser);
    const { token } = await publishExamViaApi(admin.request, { settings: { security: { fullscreen: false, tabSwitchWarnings: false } } });
    await signupViaApi(page.request, `net.${Date.now()}@example.com`);
    await page.goto(`/exam/${token}`);
    await page.getByText("I have read and understood the instructions").click();
    await page.getByRole("button", { name: "Start exam" }).click();
    await expect(page.getByText("Question 1")).toBeVisible();
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByText(/Connection interrupted\. Your saved answers are safe\./)).toBeVisible();
    await page.getByRole("radio").nth(2).click();
    await page.waitForTimeout(1200);
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText(/Saved \d/)).toBeVisible({ timeout: 15_000 });
    const attemptId = page.url().split("/").pop();
    const r = await page.request.get(`/api/attempts/${attemptId}`);
    const body = await r.json();
    expect(Object.values(body.answers as Record<string, { selectedOption: number | null }>).some((a) => a.selectedOption !== null)).toBeTruthy();
    await admin.close();
  });

  test("student login redirects back to the original exam link", async ({ browser, page }) => {
    const admin = await adminRequest(browser);
    const { token } = await publishExamViaApi(admin.request);
    const email = `redir.${Date.now()}@example.com`;
    const tmp = await browser.newContext();
    await signupViaApi(tmp.request, email);
    await tmp.close();
    await page.goto(`/exam/${token}`);
    await page.getByRole("link", { name: "I already have an account" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Student@123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`/exam/${token}$`));
    await admin.close();
    void login;
  });
});
