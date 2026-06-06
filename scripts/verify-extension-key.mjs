import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const expectedExtensionId = "mlhhhpainkgplfmhadkfdghniikiijam";
const pemPath = path.join(root, "extension.pem");
const manifestPaths = [
  path.join(root, ".output", "chrome-mv3", "manifest.json"),
  path.join(root, ".output", "firefox-mv3", "manifest.json")
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function deriveManifestKeyFromPem(filePath) {
  assert(fs.existsSync(filePath), `Missing fixed PEM: ${filePath}`);
  const privateKey = crypto.createPrivateKey(fs.readFileSync(filePath, "utf8"));
  return crypto.createPublicKey(privateKey).export({ type: "spki", format: "der" }).toString("base64");
}

function deriveChromeExtensionId(manifestKey) {
  return crypto
    .createHash("sha256")
    .update(Buffer.from(manifestKey, "base64"))
    .digest("hex")
    .slice(0, 32)
    .replace(/[0-9a-f]/g, (char) => String.fromCharCode("a".charCodeAt(0) + Number.parseInt(char, 16)));
}

const expectedManifestKey = deriveManifestKeyFromPem(pemPath);
const actualExtensionId = deriveChromeExtensionId(expectedManifestKey);
assert(
  actualExtensionId === expectedExtensionId,
  `extension.pem derives unexpected id: ${actualExtensionId}, expected ${expectedExtensionId}`
);

const checked = [];
for (const manifestPath of manifestPaths) {
  assert(fs.existsSync(manifestPath), `Missing build manifest: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert(typeof manifest.key === "string" && manifest.key.length > 0, `${manifestPath} is missing manifest.key`);
  assert(manifest.key === expectedManifestKey, `${manifestPath} manifest.key does not match extension.pem`);
  const manifestExtensionId = deriveChromeExtensionId(manifest.key);
  assert(
    manifestExtensionId === expectedExtensionId,
    `${manifestPath} derives unexpected id: ${manifestExtensionId}, expected ${expectedExtensionId}`
  );
  checked.push({ manifestPath, extensionId: manifestExtensionId, keyLength: manifest.key.length });
}

console.log(JSON.stringify({ ok: true, expectedExtensionId, checked }, null, 2));