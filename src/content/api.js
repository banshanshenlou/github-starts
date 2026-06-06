(() => {
  "use strict";

  const root = globalThis.GhStarsHelper;
  const content = root.content;
  const { runtime } = content;
  const shared = root.shared || {};
  const t = typeof shared.t === "function"
    ? shared.t
    : (key, substitutions, fallback) => fallback || key;

  /**
   * 处理冲突选择并刷新界面状态。
   */
  async function resolveConflictDecision(decision) {
    const res = await shared.sendMessage("resolve_conflict", { decision });
    if (res.ok) {
      await refreshState();
      return true;
    }
    if (res.conflict) {
      await refreshState({ render: false });
      content.ui.showConflictDialog();
      content.ui.renderAll();
      return false;
    }
    content.ui.setStatus(res.error || t("errorResolveConflictFailed", null, "处理冲突失败。"), true);
    return false;
  }

  /**
   * 从后台拉取最新状态，并根据需要重新渲染。
   */
  async function refreshState(options) {
    const shouldRender = !options || options.render !== false;
    const res = await shared.sendMessage("get_state");
    if (!res.ok) {
      content.ui.setStatus(res.error || t("errorLoadStateFailed", null, "加载状态失败。"), true);
      return false;
    }
    content.state.config = res.state.config;
    content.state.meta = res.state.meta;
    content.state.stars = res.state.stars || {
      items: {},
      updated_at: null,
      fetched_at: null,
      etag: null,
      force_fetch: false
    };
    content.state.pendingOpsCount = res.state.pendingOpsCount || 0;
    content.state.recentPendingRepos = Array.isArray(res.state.recentPendingRepos)
      ? res.state.recentPendingRepos
      : [];
    content.state.syncStatus = res.state.syncStatus || { state: "idle", message: "", updated_at: null };
    content.state.conflict = res.state.conflict || null;
    if (shouldRender) {
      content.ui.renderAll();
    }
    return true;
  }

  /**
   * 确保元数据与配置已加载，避免在未就绪时操作。
   */
  async function ensureStateLoaded() {
    if (content.state.meta && content.state.config) {
      return true;
    }
    return refreshState({ render: false });
  }

  /**
   * 触发一次同步，并处理冲突与错误提示。
   */
  async function syncNow(source, options) {
    const settings = {
      showToast: true,
      ...(options || {})
    };
    const syncSource = source === "manual"
      ? "manual"
      : (source === "light" ? "light" : "auto");
    const syncLabel = syncSource === "manual"
      ? t("labelSyncManual", null, "手动")
      : t("labelSyncAuto", null, "自动");
    const shouldToastSyncResult = settings.showToast !== false
      && (syncSource === "manual" || syncSource === "light");
    content.state.syncStatus = {
      state: "syncing",
      message: t(
        "statusSyncingWithLabel",
        [syncLabel],
        `${syncLabel}同步中`
      ),
      updated_at: content.state.syncStatus?.updated_at || null
    };
    content.ui.renderStatus();

    const res = await shared.sendMessage("sync_now", { source: syncSource });
    if (!res.ok && res.conflict) {
      content.ui.setAsyncButtonState(content.elements.syncButton, {
        state: "error",
        label: t("buttonStateSyncFailed", null, "同步失败")
      });
      await refreshState({ render: false });
      content.ui.showConflictDialog();
      content.ui.renderAll();
      return {
        ok: false,
        conflict: true,
        error: t("errorSyncFailed", null, "同步失败。")
      };
    }
    if (!res.ok) {
      content.ui.setAsyncButtonState(content.elements.syncButton, {
        state: "error",
        label: t("buttonStateSyncFailed", null, "同步失败")
      });
      if (shouldToastSyncResult) {
        content.ui.showToast(
          t(
            "statusSyncFailedWithLabel",
            [syncLabel],
            `${syncLabel}同步失败`
          ),
          { variant: "error" }
        );
      }
      content.ui.setStatus(res.error || t("errorSyncFailed", null, "同步失败。"), true);
      await refreshState();
      return {
        ok: false,
        error: res.error || t("errorSyncFailed", null, "同步失败。")
      };
    }
    content.state.meta = res.meta || content.state.meta;
    if (res.stars) {
      content.state.stars = res.stars;
    }
    content.state.pendingOpsCount = 0;
    content.state.conflict = null;
    await refreshState();
    content.ui.setAsyncButtonState(content.elements.syncButton, {
      state: "success",
      label: t("buttonStateSynced", null, "已同步")
    });
    if (shouldToastSyncResult) {
      content.ui.showToast(
        t(
          "statusSyncedWithLabel",
          [syncLabel],
          `${syncLabel}同步完成`
        ),
        { variant: "success" }
      );
    }
    return { ok: true };
  }

  /**
   * 首次进入页面时强制执行一次完整同步，确保本机不会先基于旧状态继续操作。
   */
  async function ensureInitialFullSync() {
    if (runtime.initialFullSyncDone) {
      return true;
    }
    if (runtime.initialFullSyncPromise) {
      return runtime.initialFullSyncPromise;
    }
    runtime.initialFullSyncPromise = (async () => {
      const loaded = await ensureStateLoaded();
      if (!loaded) {
        return false;
      }
      runtime.initialFullSyncDone = true;
      if (!content.state.config || !content.state.config.hasPat || !content.state.config.gistId) {
        return true;
      }
      const result = await syncNow("auto", { showToast: false });
      return Boolean(result && result.ok);
    })();
    try {
      return await runtime.initialFullSyncPromise;
    } finally {
      runtime.initialFullSyncPromise = null;
    }
  }

  /**
   * 仅拉取远端 meta / revision，用于页面进入或打开编辑器前预热状态。
   */
  async function syncMeta(options) {
    const settings = {
      force: false,
      minIntervalMs: 0,
      render: true,
      showDialogOnConflict: false,
      showError: false,
      ...(options || {})
    };
    const loaded = await ensureStateLoaded();
    if (!loaded) {
      return { ok: false, error: true };
    }
    if (!content.state.config || !content.state.config.hasPat || !content.state.config.gistId) {
      return { ok: false, skipped: true };
    }
    if (content.state.conflict) {
      if (settings.showDialogOnConflict) {
        content.ui.showConflictDialog();
      }
      if (settings.render !== false) {
        content.ui.renderAll();
      }
      return { ok: false, conflict: true, skipped: true };
    }
    const now = Date.now();
    if (
      !settings.force
      && settings.minIntervalMs > 0
      && runtime.lastMetaSyncCheckAt
      && now - runtime.lastMetaSyncCheckAt < settings.minIntervalMs
    ) {
      return { ok: true, skipped: true };
    }

    const res = await shared.sendMessage("sync_meta");
    runtime.lastMetaSyncCheckAt = Date.now();
    if (!res.ok && res.conflict) {
      await refreshState({ render: false });
      if (settings.showDialogOnConflict) {
        content.ui.showConflictDialog();
      }
      if (settings.render !== false) {
        content.ui.renderAll();
      }
      return { ok: false, conflict: true };
    }
    if (!res.ok) {
      if (settings.showError) {
        content.ui.setStatus(res.error || t("errorSyncFailed", null, "同步失败。"), true);
      }
      await refreshState({ render: settings.render !== false });
      return { ok: false, error: true };
    }
    await refreshState({ render: settings.render !== false });
    return { ok: true };
  }

  /**
   * 更新单仓库元数据并刷新界面。
   */
  async function updateRepoMeta(repoFullName, groupIds, tags, note) {
    const res = await shared.sendMessage("update_repo_meta", {
      repoFullName,
      groupIds,
      tags,
      note
    });
    if (!res.ok) {
      content.ui.setStatus(res.error || t("errorUpdateFailed", null, "更新失败。"), true);
      return false;
    }
    content.state.meta = res.meta;
    content.state.pendingOpsCount = res.pendingOpsCount || 0;
    content.state.recentPendingRepos = Array.isArray(res.recentPendingRepos)
      ? res.recentPendingRepos
      : [];
    content.ui.renderAll();
    return true;
  }

  /**
   * 更新分组结构并刷新界面状态。
   */
  async function updateGroups(groups) {
    const res = await shared.sendMessage("update_groups", { groups });
    if (!res.ok) {
      content.ui.setStatus(res.error || t("errorUpdateFailed", null, "更新失败。"), true);
      return false;
    }
    content.state.meta = res.meta;
    content.state.pendingOpsCount = res.pendingOpsCount || 0;
    content.ui.renderAll();
    return true;
  }

  /**
   * 构建最小星标信息，保证列表渲染可用。
   */
  function buildFallbackStarInfo(repoFullName) {
    const parts = repoFullName.split("/");
    return {
      starred_at: new Date().toISOString(),
      name: parts[1] || "",
      owner: parts[0] || "",
      html_url: `https://github.com/${repoFullName}`
    };
  }

  /**
   * 本地更新星标缓存，并触发列表刷新。
   */
  function applyStarCacheLocally(repoFullName, starred, info) {
    const nextStars = {
      ...(content.state.stars || {}),
      items: { ...(content.state.stars?.items || {}) },
      updated_at: new Date().toISOString()
    };
    if (starred) {
      nextStars.items[repoFullName] = info || buildFallbackStarInfo(repoFullName);
    } else {
      delete nextStars.items[repoFullName];
    }
    content.state.stars = nextStars;
    content.ui.renderAll();
  }

  /**
   * 同步更新本地与后台星标缓存，避免列表等待完整同步。
   */
  async function updateStarCache(repoFullName, starred, info) {
    if (!repoFullName) {
      return false;
    }
    applyStarCacheLocally(repoFullName, Boolean(starred), info);
    const res = await shared.sendMessage("update_star_cache", {
      repoFullName,
      starred: Boolean(starred),
      info
    });
    if (res && res.ok && res.stars) {
      content.state.stars = res.stars;
    }
    return Boolean(res && res.ok);
  }

  content.api = {
    resolveConflictDecision,
    refreshState,
    ensureStateLoaded,
    syncNow,
    ensureInitialFullSync,
    syncMeta,
    updateRepoMeta,
    updateGroups,
    updateStarCache
  };
})();
