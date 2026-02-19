import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, ".output");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(filePath) {
  assert(fs.existsSync(filePath), `缺少文件: ${filePath}`);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function ensureFileExists(filePath) {
  assert(fs.existsSync(filePath), `缺少文件: ${filePath}`);
}

function verifyCommonManifest(manifest, browserName) {
  assert(manifest.manifest_version === 3, `${browserName}: manifest_version 必须为 3`);
  assert(Array.isArray(manifest.permissions), `${browserName}: permissions 缺失`);
  assert(manifest.permissions.includes("storage"), `${browserName}: 需包含 storage 权限`);
  assert(manifest.permissions.includes("alarms"), `${browserName}: 需包含 alarms 权限`);
  assert(Array.isArray(manifest.host_permissions), `${browserName}: host_permissions 缺失`);
  assert(
    manifest.host_permissions.includes("https://github.com/*"),
    `${browserName}: host_permissions 缺少 github.com`
  );
  assert(
    manifest.host_permissions.includes("https://api.github.com/*"),
    `${browserName}: host_permissions 缺少 api.github.com`
  );
  assert(Array.isArray(manifest.content_scripts), `${browserName}: content_scripts 缺失`);
  assert(manifest.content_scripts.length > 0, `${browserName}: content_scripts 为空`);
  assert(manifest.options_ui && manifest.options_ui.page === "options.html", `${browserName}: options_ui 配置异常`);
}

function verifyBrowserOutput(browserDir, browserName, expectedBackgroundMode) {
  const manifestPath = path.join(browserDir, "manifest.json");
  const manifest = readJson(manifestPath);
  verifyCommonManifest(manifest, browserName);

  if (expectedBackgroundMode === "service_worker") {
    assert(
      manifest.background && manifest.background.service_worker === "background.js",
      `${browserName}: background.service_worker 配置异常`
    );
  } else if (expectedBackgroundMode === "scripts") {
    assert(
      manifest.background
      && Array.isArray(manifest.background.scripts)
      && manifest.background.scripts.includes("background.js"),
      `${browserName}: background.scripts 配置异常`
    );
  }

  ensureFileExists(path.join(browserDir, "background.js"));
  ensureFileExists(path.join(browserDir, "options.html"));
  ensureFileExists(path.join(browserDir, "_locales", "zh_CN", "messages.json"));
  ensureFileExists(path.join(browserDir, "_locales", "en", "messages.json"));
  ensureFileExists(path.join(browserDir, "assets", "branding", "manage-logo.png"));
  ensureFileExists(path.join(browserDir, "assets", "lordicon", "system-regular-63-settings-cog-hover-cog-1.svg"));

  const contentScript = manifest.content_scripts[0];
  assert(Array.isArray(contentScript.js) && contentScript.js.length > 0, `${browserName}: content script js 配置为空`);
  assert(Array.isArray(contentScript.css) && contentScript.css.length > 0, `${browserName}: content script css 配置为空`);

  for (const scriptPath of contentScript.js) {
    ensureFileExists(path.join(browserDir, scriptPath));
  }
  for (const cssPath of contentScript.css) {
    ensureFileExists(path.join(browserDir, cssPath));
  }

  return {
    browser: browserName,
    manifestVersion: manifest.manifest_version,
    contentScriptCount: manifest.content_scripts.length
  };
}

function main() {
  const chromeDir = path.join(outputDir, "chrome-mv3");
  const firefoxDir = path.join(outputDir, "firefox-mv3");

  assert(fs.existsSync(chromeDir), "缺少 .output/chrome-mv3，请先执行 npm run build");
  assert(fs.existsSync(firefoxDir), "缺少 .output/firefox-mv3，请先执行 npm run build:firefox");

  const chrome = verifyBrowserOutput(chromeDir, "chrome-mv3", "service_worker");
  const firefox = verifyBrowserOutput(firefoxDir, "firefox-mv3", "scripts");

  const chromeZip = path.join(outputDir, "github-stars-manager-0.1.4-chrome.zip");
  const firefoxZip = path.join(outputDir, "github-stars-manager-0.1.4-firefox.zip");
  ensureFileExists(chromeZip);
  ensureFileExists(firefoxZip);

  console.log("跨浏览器构建校验通过:");
  console.log(`- ${chrome.browser}: manifest v${chrome.manifestVersion}, content_scripts=${chrome.contentScriptCount}`);
  console.log(`- ${firefox.browser}: manifest v${firefox.manifestVersion}, content_scripts=${firefox.contentScriptCount}`);
  console.log(`- zip: ${path.basename(chromeZip)}, ${path.basename(firefoxZip)}`);
}

main();
