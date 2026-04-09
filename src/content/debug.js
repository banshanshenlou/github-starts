(() => {
  "use strict";

  const root = globalThis.GhStarsHelper;
  const content = root.content;
  const shared = root.shared || {};

  function trimString(value, maxLength) {
    const text = String(value);
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength)}…`;
  }

  function normalizePayload(value, depth) {
    if (depth <= 0) {
      return "[depth-limit]";
    }
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === "string") {
      return trimString(value, 240);
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.slice(0, 20).map((item) => normalizePayload(item, depth - 1));
    }
    if (value instanceof Error) {
      return {
        name: value.name,
        message: trimString(value.message || "", 240)
      };
    }
    if (typeof value === "object") {
      const output = {};
      Object.keys(value).slice(0, 20).forEach((key) => {
        output[key] = normalizePayload(value[key], depth - 1);
      });
      return output;
    }
    return trimString(value, 240);
  }

  function shouldTryLog() {
    if (!content.state || !content.state.config) {
      return true;
    }
    return Boolean(content.state.config.debugLogging);
  }

  function getRepoName() {
    if (!content.utils || typeof content.utils.getRepoFullNameFromPage !== "function") {
      return "";
    }
    try {
      return content.utils.getRepoFullNameFromPage() || "";
    } catch {
      return "";
    }
  }

  function log(event, data) {
    if (!shouldTryLog() || !shared.sendMessage) {
      return;
    }
    void shared.sendMessage("append_debug_log", {
      entry: {
        side: "content",
        event,
        pageUrl: window.location.href,
        repo: getRepoName(),
        data: normalizePayload(data || {}, 4)
      }
    });
  }

  async function getLogs() {
    if (!shared.sendMessage) {
      return { ok: false, error: "后台不可用" };
    }
    return shared.sendMessage("get_debug_logs");
  }

  content.debug = {
    log,
    getLogs
  };
})();
