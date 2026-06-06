import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const extensionPath = path.join(root, ".output", "chrome-mv3");
const outputDir = path.join(root, "output", "extension-check");
const defaultChromiumPath = "D:\\1soft\\playwright-browsers\\chromium-1208\\chrome-win64\\chrome.exe";
const startUrl = process.env.EXTENSION_CHECK_URL || "https://github.com/openai/codex";
const useLiveGithub = process.env.EXTENSION_CHECK_LIVE === "1";
const proxyServer = process.env.EXTENSION_CHECK_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "http://127.0.0.1:13067";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function findChromiumExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    defaultChromiumPath,
    chromium.executablePath()
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function getExtensionId(context) {
  const worker = context.serviceWorkers()[0]
    || await context.waitForEvent("serviceworker", { timeout: 15000 });
  return new URL(worker.url()).host;
}

async function readManageButtonState(page) {
  return page.locator("#gh-stars-helper-manage-btn").evaluate(async (button) => {
    button.classList.remove("attention", "attention-ring", "sync-indicator-syncing", "sync-indicator-success", "sync-indicator-error");
    button.classList.add("attention-ring");
    await new Promise((resolve) => window.setTimeout(resolve, 80));
    const attentionBefore = window.getComputedStyle(button, "::before");
    const attentionAfter = window.getComputedStyle(button, "::after");
    const attentionState = {
      className: button.className,
      beforeOpacity: attentionBefore.opacity,
      beforeAnimationName: attentionBefore.animationName,
      beforeAnimationDuration: attentionBefore.animationDuration,
      beforeBackgroundImage: attentionBefore.backgroundImage,
      afterOpacity: attentionAfter.opacity
    };
    button.classList.remove("attention-ring");
    button.classList.add("sync-indicator-syncing");
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const before = window.getComputedStyle(button, "::before");
    const after = window.getComputedStyle(button, "::after");
    const rect = button.getBoundingClientRect();
    return {
      className: button.className,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      attentionState,
      beforeOpacity: before.opacity,
      beforeAnimationName: before.animationName,
      beforeAnimationDuration: before.animationDuration,
      beforeBackgroundImage: before.backgroundImage,
      beforeInset: before.inset,
      afterOpacity: after.opacity,
      afterAnimationName: after.animationName,
      afterBackgroundImage: after.backgroundImage
    };
  });
}

fs.mkdirSync(outputDir, { recursive: true });
assert(fs.existsSync(extensionPath), `Missing extension output: ${extensionPath}. Run npm run build first.`);

const executablePath = findChromiumExecutable();
assert(executablePath, "Chromium/Chrome not found. Set CHROME_PATH to chrome.exe.");

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "github-stars-extension-check-"));
let context;

try {
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run"
    ],
    viewport: { width: 1366, height: 900 },
    proxy: proxyServer ? { server: proxyServer } : undefined
  });

  const extensionId = await getExtensionId(context);
  const page = await context.newPage();
  if (!useLiveGithub) {
    await page.route("https://github.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><head><title>GitHub Extension Check</title></head><body><main><h1>openai/codex</h1></main></body></html>"
      });
    });
  }
  await page.goto(startUrl, { waitUntil: "commit", timeout: 45000 });
  await page.locator("#gh-stars-helper-manage-btn").waitFor({ timeout: 20000 });

  const state = await readManageButtonState(page);
  assert(state.width >= 80 && state.height >= 28, `Unexpected manage button size: ${JSON.stringify(state)}`);
  assert(!state.attentionState.className.split(/\s+/).includes("attention"), `Old flashing attention class is still used: ${JSON.stringify(state)}`);
  assert(state.attentionState.className.includes("attention-ring"), `Initial attention ring class missing: ${JSON.stringify(state)}`);
  assert(Number.parseFloat(state.attentionState.beforeOpacity) > 0.4, `Initial attention ring is not visible: ${JSON.stringify(state)}`);
  assert(
    state.attentionState.beforeAnimationName === "gh-stars-helper-manage-attention-ring",
    `Unexpected initial attention animation: ${JSON.stringify(state)}`
  );
  assert(
    state.attentionState.beforeAnimationDuration === "0.95s",
    `Unexpected initial attention speed: ${JSON.stringify(state)}`
  );
  assert(
    state.attentionState.beforeBackgroundImage.includes("conic-gradient")
      && state.attentionState.beforeBackgroundImage.includes("rgba(251, 146, 60, 0.98)"),
    `Unexpected initial attention gradient: ${JSON.stringify(state)}`
  );
  assert(state.className.includes("sync-indicator-syncing"), `Sync indicator class missing: ${JSON.stringify(state)}`);
  assert(state.beforeOpacity === "1", `Sync runner is not visible: ${JSON.stringify(state)}`);
  assert(
    state.beforeAnimationName === "gh-stars-helper-manage-sync-ring",
    `Unexpected sync ring animation: ${JSON.stringify(state)}`
  );
  assert(
    state.beforeAnimationDuration === "4s",
    `Unexpected sync ring speed: ${JSON.stringify(state)}`
  );
  assert(
    state.beforeInset.includes("-")
      && state.beforeBackgroundImage.includes("conic-gradient")
      && state.beforeBackgroundImage.includes("rgba(9, 105, 218, 0.98)"),
    `Unexpected sync ring gradient: ${JSON.stringify(state)}`
  );
  assert(state.afterOpacity === "1", `Inner mask is not visible: ${JSON.stringify(state)}`);

  const screenshotPath = path.join(outputDir, "manage-button-sync-ring.png");
  const resultPath = path.join(outputDir, "result.json");
  await page.screenshot({ path: screenshotPath, fullPage: false, scale: "css" });
  const result = {
    ok: true,
    startUrl,
    extensionId,
    executablePath,
    extensionPath,
    state,
    screenshotPath
  };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), "utf8");
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (context) {
    await context.close();
  }
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
