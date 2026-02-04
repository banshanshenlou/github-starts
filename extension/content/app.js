(() => {
  "use strict";

  const root = globalThis.GhStarsHelper;
  const content = root.content;
  const { state, runtime } = content;
  const { isStarsListPage, isRepoPage } = content.utils;

  /**
   * 启动轮询刷新状态，保持列表实时更新。
   */
  function startPolling() {
    if (runtime.pollingTimer) {
      return;
    }
    runtime.pollingTimer = window.setInterval(() => {
      content.api.refreshState();
    }, 30000);
  }

  /**
   * 停止轮询，减少非列表页面的资源消耗。
   */
  function stopPolling() {
    if (!runtime.pollingTimer) {
      return;
    }
    window.clearInterval(runtime.pollingTimer);
    runtime.pollingTimer = null;
  }

  /**
   * 根据上次同步时间决定是否需要自动同步。
   */
  async function autoSyncIfNeeded() {
    if (!state.syncStatus || !state.syncStatus.updated_at) {
      await content.api.syncNow("auto");
      return;
    }
    const lastSync = new Date(state.syncStatus.updated_at).getTime();
    const now = Date.now();
    const twoMinutes = 2 * 60 * 1000;
    if (now - lastSync > twoMinutes) {
      await content.api.syncNow("auto");
    }
  }

  /**
   * 根据页面类型切换观察器与按钮注入逻辑。
   */
  function handlePageChange() {
    if (isStarsListPage()) {
      content.page.startObserver();
      content.api.refreshState();
      startPolling();
      autoSyncIfNeeded();
    } else {
      content.page.stopObserver();
      stopPolling();
    }
    if (isRepoPage()) {
      content.repo.ensureRepoEditButton();
      content.repo.ensureRepoStarAutoOpen();
    }
  }

  /**
   * 初始化入口，绑定事件并确保关键 UI 存在。
   */
  function init() {
    content.ui.ensureManageButton();
    content.repo.ensureStarCacheListener();
    handlePageChange();
    if (!runtime.onlineListenerAttached) {
      window.addEventListener("online", () => {
        if (state.pendingOpsCount > 0) {
          content.api.syncNow("auto");
        }
      });
      runtime.onlineListenerAttached = true;
    }
  }

  content.app = {
    startPolling,
    stopPolling,
    autoSyncIfNeeded,
    handlePageChange,
    init
  };
})();
