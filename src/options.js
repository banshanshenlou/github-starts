const sharedRoot = window.GhStarsHelper ? window.GhStarsHelper.shared : null;
const sendMessage = sharedRoot ? sharedRoot.sendMessage : null;
const t = sharedRoot && typeof sharedRoot.t === "function"
  ? sharedRoot.t
  : (key, substitutions, fallback) => fallback || key;
const defaultGistFile = sharedRoot && sharedRoot.DEFAULT_GIST_FILE
  ? sharedRoot.DEFAULT_GIST_FILE
  : "stars-metadata.json";

const statusEl = document.getElementById("status");
const patInput = document.getElementById("pat");
const gistIdInput = document.getElementById("gistId");
const gistFileInput = document.getElementById("gistFile");
const saveBtn = document.getElementById("save");
const testBtn = document.getElementById("test");
const createBtn = document.getElementById("create");

/**
 * 更新设置页的状态提示。
 */
function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", Boolean(isError));
}

/**
 * 加载当前配置并回填表单。
 */
async function loadConfig() {
  if (!sendMessage) {
    setStatus(t("errorInitFailed", null, "扩展初始化失败。"), true);
    return;
  }
  const res = await sendMessage("get_config");
  if (!res.ok) {
    setStatus(res.error || t("statusLoadConfigFailed", null, "加载配置失败。"), true);
    return;
  }
  const config = res.config || {};
  patInput.value = config.pat || "";
  gistIdInput.value = config.gistId || "";
  gistFileInput.value = config.gistFile || defaultGistFile;
}

saveBtn.addEventListener("click", async () => {
  if (!sendMessage) {
    setStatus(t("errorInitFailed", null, "扩展初始化失败。"), true);
    return;
  }
  const config = {
    pat: patInput.value.trim(),
    gistId: gistIdInput.value.trim(),
    gistFile: gistFileInput.value.trim() || defaultGistFile
  };
  const res = await sendMessage("save_config", { config });
  if (!res.ok) {
    setStatus(res.error || t("statusSaveFailed", null, "保存失败。"), true);
    return;
  }
  setStatus(t("statusSaved", null, "已保存。"));
});

testBtn.addEventListener("click", async () => {
  if (!sendMessage) {
    setStatus(t("errorInitFailed", null, "扩展初始化失败。"), true);
    return;
  }
  const pat = patInput.value.trim();
  const res = await sendMessage("test_token", { pat });
  if (!res.ok) {
    setStatus(res.error || t("statusTokenTestFailed", null, "Token 测试失败。"), true);
    return;
  }
  setStatus(t("statusTokenOk", [res.login || ""], `Token 验证通过：${res.login || ""}`));
});

createBtn.addEventListener("click", async () => {
  if (!sendMessage) {
    setStatus(t("errorInitFailed", null, "扩展初始化失败。"), true);
    return;
  }
  const config = {
    pat: patInput.value.trim(),
    gistFile: gistFileInput.value.trim() || defaultGistFile
  };
  const res = await sendMessage("create_gist", { config });
  if (!res.ok) {
    setStatus(res.error || t("statusCreateGistFailed", null, "创建 Gist 失败。"), true);
    return;
  }
  gistIdInput.value = res.gistId;
  setStatus(t("statusGistCreated", [res.gistId], `Gist 已创建：${res.gistId}`));
});

if (sharedRoot && typeof sharedRoot.applyI18n === "function") {
  sharedRoot.applyI18n(document);
}

loadConfig();
