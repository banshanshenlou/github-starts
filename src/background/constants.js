(() => {
  "use strict";

  const root = globalThis.GhStarsHelperBackground || (globalThis.GhStarsHelperBackground = {});
  const shared = (globalThis.GhStarsHelper && globalThis.GhStarsHelper.shared) || {};
  const defaultGistFile = shared.DEFAULT_GIST_FILE || "stars-metadata.json";
  const maxGroupDepth = Number.isFinite(shared.MAX_GROUP_DEPTH) ? shared.MAX_GROUP_DEPTH : 5;

  // 统一配置与状态结构，保证持久化数据稳定可迁移。
  root.constants = {
    STORAGE_KEYS: {
      config: "config",
      meta: "meta",
      pendingOps: "pendingOps",
      stars: "stars",
      syncStatus: "syncStatus",
      conflict: "conflict",
      debugLogs: "debugLogs"
    },
    DEFAULT_CONFIG: {
      pat: "",
      gistId: "",
      gistFile: defaultGistFile,
      debugLogging: false
    },
    DEFAULT_META: {
      schema_version: 1,
      revision: 0,
      updated_at: null,
      groups: [],
      repo_meta: {}
    },
    DEFAULT_STARS: {
      items: {},
      updated_at: null,
      fetched_at: null,
      etag: null,
      force_fetch: false
    },
    DEFAULT_SYNC_STATUS: {
      state: "idle",
      message: "",
      updated_at: null
    },
    ALARMS: {
      RETRY: "stars-helper-retry",
      AUTO_SYNC: "stars-helper-auto-sync"
    },
    MAX_DEBUG_LOGS: 400,
    MAX_PENDING_OPS: 200,
    STARS_SYNC_INTERVAL_MINUTES: 30,
    MAX_GROUP_DEPTH: maxGroupDepth
  };
})();
