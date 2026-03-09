(() => {
  "use strict";

  const root = globalThis.GhStarsHelper;
  const content = root.content;
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
  async function syncNow(source) {
    const syncSource = source === "auto" ? "auto" : "manual";
    const syncLabel = syncSource === "auto"
      ? t("labelSyncAuto", null, "自动")
      : t("labelSyncManual", null, "手动");
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
      await refreshState({ render: false });
      content.ui.showConflictDialog();
      content.ui.renderAll();
      return;
    }
    if (!res.ok) {
      content.ui.setStatus(res.error || t("errorSyncFailed", null, "同步失败。"), true);
      await refreshState();
      return;
    }
    content.state.meta = res.meta || content.state.meta;
    if (res.stars) {
      content.state.stars = res.stars;
    }
    content.state.pendingOpsCount = 0;
    content.state.conflict = null;
    await refreshState();
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
    updateRepoMeta,
    updateGroups,
    updateStarCache
  };
})();
