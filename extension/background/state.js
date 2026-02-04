(() => {
  "use strict";

  const root = globalThis.GhStarsHelperBackground;
  const { constants, utils } = root;
  const { clone, nowIso } = utils;

  /**
   * 读取全量状态，并补齐默认值。
   */
  async function getState() {
    const data = await chrome.storage.local.get([
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
    await chrome.storage.local.set(partial);
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
    const alarms = chrome.alarms;
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
