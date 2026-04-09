(() => {
  "use strict";

  const root = globalThis.GhStarsHelperBackground;
  const { constants, state } = root;

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

  async function appendLog(entry) {
    const current = await state.getState();
    if (!current.config || !current.config.debugLogging) {
      return { ok: true, skipped: true };
    }
    const nextEntry = {
      ts: new Date().toISOString(),
      side: entry && entry.side ? String(entry.side) : "background",
      event: entry && entry.event ? String(entry.event) : "unknown",
      pageUrl: entry && entry.pageUrl ? trimString(entry.pageUrl, 400) : "",
      repo: entry && entry.repo ? trimString(entry.repo, 200) : "",
      data: normalizePayload(entry && entry.data ? entry.data : {}, 4)
    };
    const logs = Array.isArray(current.debugLogs) ? current.debugLogs.slice() : [];
    logs.push(nextEntry);
    const maxLogs = Number.isFinite(constants.MAX_DEBUG_LOGS) ? constants.MAX_DEBUG_LOGS : 400;
    await state.saveState({
      debugLogs: logs.slice(-maxLogs)
    });
    return { ok: true };
  }

  async function getLogs() {
    const current = await state.getState();
    return {
      ok: true,
      enabled: Boolean(current.config && current.config.debugLogging),
      logs: Array.isArray(current.debugLogs) ? current.debugLogs : []
    };
  }

  root.debug = {
    appendLog,
    getLogs
  };
})();
