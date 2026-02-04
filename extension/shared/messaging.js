(() => {
  "use strict";

  const root = globalThis.GhStarsHelper || (globalThis.GhStarsHelper = {});
  root.shared = root.shared || {};
  const shared = root.shared;
  const t = typeof shared.t === "function"
    ? shared.t
    : (key, substitutions, fallback) => fallback || key;

  /**
   * 统一封装扩展消息通道，避免 chrome.runtime.lastError 导致回调异常。
   */
  shared.sendMessage = function sendMessage(action, payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action, ...(payload || {}) }, (response) => {
        if (chrome.runtime.lastError) {
          const raw = chrome.runtime.lastError.message || "未知错误";
          const normalized = /Receiving end does not exist/i.test(raw)
            ? t(
              "errorNoBackground",
              null,
              "未能连接后台服务，请确认浏览器支持扩展后台脚本后重试。"
            )
            : raw;
          resolve({ ok: false, error: normalized });
          return;
        }
        resolve(response || { ok: false, error: t("errorNoResponse", null, "后台未返回数据。") });
      });
    });
  };
})();
