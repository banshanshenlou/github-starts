(() => {
  "use strict";

  const root = globalThis.GhStarsHelper || (globalThis.GhStarsHelper = {});
  root.shared = root.shared || {};
  const shared = root.shared;
  const t = typeof shared.t === "function"
    ? shared.t
    : (key, substitutions, fallback) => fallback || key;

  /**
   * 统一获取 runtime，优先使用标准 browser API。
   */
  function getRuntime() {
    if (typeof browser !== "undefined" && browser.runtime) {
      return browser.runtime;
    }
    if (typeof chrome !== "undefined" && chrome.runtime) {
      return chrome.runtime;
    }
    return null;
  }

  /**
   * 读取 callback 风格 API 的 lastError 信息。
   */
  function getRuntimeLastErrorMessage() {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
      return chrome.runtime.lastError.message || "未知错误";
    }
    return "";
  }

  /**
   * 统一归一化后台不可用类错误提示。
   */
  function normalizeRuntimeError(rawMessage) {
    const raw = rawMessage || "未知错误";
    if (/Receiving end does not exist/i.test(raw)) {
      return t(
        "errorNoBackground",
        null,
        "未能连接后台服务，请确认浏览器支持扩展后台脚本后重试。"
      );
    }
    return raw;
  }

  /**
   * 统一封装扩展消息通道，同时兼容 callback 与 Promise 风格实现。
   */
  shared.sendMessage = function sendMessage(action, payload) {
    return new Promise((resolve) => {
      const runtime = getRuntime();
      if (!runtime || typeof runtime.sendMessage !== "function") {
        resolve({
          ok: false,
          error: t(
            "errorNoBackground",
            null,
            "未能连接后台服务，请确认浏览器支持扩展后台脚本后重试。"
          )
        });
        return;
      }
      const request = { action, ...(payload || {}) };

      // 优先尝试 callback 风格，保留 Chrome lastError 的兼容行为。
      try {
        runtime.sendMessage(request, (response) => {
          const raw = getRuntimeLastErrorMessage();
          if (raw) {
            resolve({ ok: false, error: normalizeRuntimeError(raw) });
            return;
          }
          resolve(response || { ok: false, error: t("errorNoResponse", null, "后台未返回数据。") });
        });
        return;
      } catch {
        // 忽略并回退到 Promise 风格。
      }

      // Firefox/Safari 等标准实现分支。
      try {
        const maybePromise = runtime.sendMessage(request);
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise
            .then((response) => {
              resolve(response || { ok: false, error: t("errorNoResponse", null, "后台未返回数据。") });
            })
            .catch((error) => {
              resolve({
                ok: false,
                error: normalizeRuntimeError(error && error.message ? error.message : "未知错误")
              });
            });
          return;
        }
      } catch (error) {
        resolve({
          ok: false,
          error: normalizeRuntimeError(error && error.message ? error.message : "未知错误")
        });
        return;
      }

      resolve({ ok: false, error: t("errorNoResponse", null, "后台未返回数据。") });
    });
  };
})();
