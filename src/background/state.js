(() => {
  "use strict";

  const root = globalThis.GhStarsHelperBackground;
  const { constants, utils } = root;
  const { clone, nowIso } = utils;

  /**
   * 获取 storage.local API，兼容 browser/chrome 命名空间。
   */
  function getStorageLocalApi() {
    if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
      return browser.storage.local;
    }
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    return null;
  }

  /**
   * 获取 alarms API，兼容 browser/chrome 命名空间。
   */
  function getAlarmsApi() {
    if (typeof browser !== "undefined" && browser.alarms) {
      return browser.alarms;
    }
    if (typeof chrome !== "undefined" && chrome.alarms) {
      return chrome.alarms;
    }
    return null;
  }

  /**
   * 读取存储，优先 Promise 风格并回退 callback 风格。
   */
  async function readStorage(keys) {
    const storage = getStorageLocalApi();
    if (!storage || typeof storage.get !== "function") {
      return {};
    }
    try {
      const data = await storage.get(keys);
      return data && typeof data === "object" ? data : {};
    } catch {
      return new Promise((resolve) => {
        try {
          storage.get(keys, (data) => {
            resolve(data && typeof data === "object" ? data : {});
          });
        } catch {
          resolve({});
        }
      });
    }
  }

  /**
   * 写入存储，优先 Promise 风格并回退 callback 风格。
   */
  async function writeStorage(partial) {
    const storage = getStorageLocalApi();
    if (!storage || typeof storage.set !== "function") {
      return;
    }
    try {
      await storage.set(partial);
      return;
    } catch {
      // 回退 callback 风格，兼容旧实现。
    }
    try {
      await new Promise((resolve) => {
        storage.set(partial, () => resolve());
      });
    } catch {
      // 忽略写入失败，调用方负责状态展示。
    }
  }

  /**
   * 读取全量状态，并补齐默认值。
   */
  async function getState() {
    const data = await readStorage([
      constants.STORAGE_KEYS.config,
      constants.STORAGE_KEYS.meta,
      constants.STORAGE_KEYS.pendingOps,
      constants.STORAGE_KEYS.stars,
      constants.STORAGE_KEYS.syncStatus,
      constants.STORAGE_KEYS.conflict
    ]);
    const config = data.config
      ? { ...constants.DEFAULT_CONFIG, ...data.config }
      : { ...constants.DEFAULT_CONFIG };
    const meta = root.meta.normalizeMeta(data.meta || constants.DEFAULT_META);
    const pendingOps = Array.isArray(data.pendingOps) ? data.pendingOps : [];
    const stars = data.stars && typeof data.stars === "object"
      ? { ...clone(constants.DEFAULT_STARS), ...data.stars }
      : clone(constants.DEFAULT_STARS);
    const syncStatus = data.syncStatus || clone(constants.DEFAULT_SYNC_STATUS);
    const conflict = data.conflict || null;
    return { config, meta, pendingOps, stars, syncStatus, conflict };
  }

  /**
   * 以局部更新方式写入状态，避免覆盖未改动字段。
   */
  async function saveState(partial) {
    await writeStorage(partial);
  }

  /**
   * 更新同步状态并写入时间戳。
   */
  async function setSyncStatus(state, message) {
    await saveState({
      syncStatus: {
        state,
        message: message || "",
        updated_at: nowIso()
      }
    });
  }

  /**
   * 根据待同步数量设置重试闹钟。
   */
  async function ensureRetryAlarm(pendingCount) {
    const alarms = getAlarmsApi();
    if (!alarms || typeof alarms.create !== "function" || typeof alarms.clear !== "function") {
      // 兼容缺少 alarms API 的环境，跳过自动重试调度。
      return;
    }
    if (pendingCount > 0) {
      await alarms.create(constants.ALARMS.RETRY, { delayInMinutes: 2 });
    } else {
      await alarms.clear(constants.ALARMS.RETRY);
    }
  }

  root.state = {
    getState,
    saveState,
    setSyncStatus,
    ensureRetryAlarm
  };
})();
