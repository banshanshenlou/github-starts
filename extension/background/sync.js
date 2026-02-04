(() => {
  "use strict";

  const root = globalThis.GhStarsHelperBackground;
  const { utils, state, github, meta, constants } = root;
  const { nowIso, addPendingOp, withMetaWriteLock, clone } = utils;
  const shared = (globalThis.GhStarsHelper && globalThis.GhStarsHelper.shared) || {};
  const t = typeof shared.t === "function"
    ? shared.t
    : (key, substitutions, fallback) => fallback || key;

  let syncLock = false;

  /**
   * 判断是否需要全量拉取星标列表，避免频繁同步带来的延迟。
   */
  function shouldFetchStars(syncSource, stars) {
    if (syncSource === "manual") {
      return true;
    }
    if (stars && stars.force_fetch) {
      return true;
    }
    if (!stars || !stars.items || Object.keys(stars.items).length === 0) {
      return true;
    }
    const lastFetchedAt = stars.fetched_at ? new Date(stars.fetched_at).getTime() : 0;
    const lastFetchedTime = Number.isNaN(lastFetchedAt) ? 0 : lastFetchedAt;
    if (!lastFetchedTime) {
      return true;
    }
    const intervalMs = constants.STARS_SYNC_INTERVAL_MINUTES * 60 * 1000;
    return Date.now() - lastFetchedTime >= intervalMs;
  }

  /**
   * 规范化仓库元数据，用于忽略顺序与更新时间的内容比较。
   */
  function normalizeRepoMetaInfo(info) {
    if (!info || typeof info !== "object") {
      return { group_ids: [], tags: [], note: "" };
    }
    const normalizeList = (list) => Array.from(new Set(
      (Array.isArray(list) ? list : [])
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0)
    )).sort();
    return {
      group_ids: normalizeList(info.group_ids),
      tags: normalizeList(info.tags),
      note: typeof info.note === "string" ? info.note.trim() : ""
    };
  }

  /**
   * 判断仓库元数据是否等价，忽略 updated_at 的差异。
   */
  function isSameRepoMetaInfo(left, right) {
    const a = normalizeRepoMetaInfo(left);
    const b = normalizeRepoMetaInfo(right);
    if (a.note !== b.note) {
      return false;
    }
    if (a.group_ids.length !== b.group_ids.length || a.tags.length !== b.tags.length) {
      return false;
    }
    for (let i = 0; i < a.group_ids.length; i += 1) {
      if (a.group_ids[i] !== b.group_ids[i]) {
        return false;
      }
    }
    for (let i = 0; i < a.tags.length; i += 1) {
      if (a.tags[i] !== b.tags[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * 收集 repo_meta 操作的基线信息，缺失基线或混入其它类型则不自动合并。
   */
  function collectRepoMetaBases(pendingOps) {
    if (!Array.isArray(pendingOps) || pendingOps.length === 0) {
      return null;
    }
    const bases = new Map();
    for (const op of pendingOps) {
      if (!op || op.type !== "repo_meta") {
        return null;
      }
      const info = op.info;
      if (!info || typeof info.repo !== "string") {
        return null;
      }
      if (!Object.prototype.hasOwnProperty.call(info, "base")) {
        return null;
      }
      if (!bases.has(info.repo)) {
        bases.set(info.repo, info.base || null);
      }
    }
    return bases;
  }

  /**
   * 在远端同仓库未改动时进行轻量合并，仅合并 repo_meta 并清理无效分组引用。
   */
  function buildAutoMergedMeta(localMeta, remoteMeta, pendingOps) {
    const bases = collectRepoMetaBases(pendingOps);
    if (!bases) {
      return null;
    }
    const safeRemote = meta.normalizeMeta(clone(remoteMeta));
    const safeLocal = meta.normalizeMeta(clone(localMeta));
    const remoteRepoMeta = safeRemote.repo_meta || {};
    for (const [repo, base] of bases) {
      if (!isSameRepoMetaInfo(base, remoteRepoMeta[repo])) {
        return null;
      }
    }
    const localRepoMeta = safeLocal.repo_meta || {};
    bases.forEach((_, repo) => {
      if (Object.prototype.hasOwnProperty.call(localRepoMeta, repo)) {
        remoteRepoMeta[repo] = localRepoMeta[repo];
      } else {
        delete remoteRepoMeta[repo];
      }
    });
    safeRemote.repo_meta = remoteRepoMeta;
    return meta.applyGroups(safeRemote, safeRemote.groups || []);
  }

  /**
   * 执行一次完整同步流程，负责拉取星标、对齐元数据并处理冲突。
   */
  async function syncNowInternal(source) {
    return withMetaWriteLock(async () => {
      // 同步流程必须独占，避免与其它元数据写入并发导致覆盖。
      if (syncLock) {
        return { ok: false, error: t("errorSyncInProgress", null, "同步进行中。") };
      }
      syncLock = true;
      try {
        const syncSource = source === "auto" ? "auto" : "manual";
        const syncLabel = syncSource === "auto"
          ? t("labelSyncAuto", null, "自动")
          : t("labelSyncManual", null, "手动");
        const syncingMessage = t(
          "statusSyncingWithLabel",
          [syncLabel],
          `${syncLabel}同步中`
        );
        const doneMessage = t(
          "statusSyncedWithLabel",
          [syncLabel],
          `${syncLabel}同步完成`
        );
        // 先写同步中状态，让 UI 及时反馈。
        await state.setSyncStatus("syncing", syncingMessage);
        const current = await state.getState();
        const config = current.config;

        if (!config.pat) {
          // 配置缺失时直接返回错误，并保持可见状态提示。
          await state.setSyncStatus("error", t("errorPatRequired", null, "需要填写 PAT。"));
          return { ok: false, error: t("errorPatRequired", null, "需要填写 PAT。") };
        }
        if (!config.gistId) {
          await state.setSyncStatus("error", t("errorGistIdRequired", null, "需要填写 Gist ID。"));
          return { ok: false, error: t("errorGistIdRequired", null, "需要填写 Gist ID。") };
        }

        const shouldFetchStarList = shouldFetchStars(syncSource, current.stars);
        const starsPromise = shouldFetchStarList
          ? github.fetchStarredRepos(config.pat, { etag: current.stars.etag })
          : Promise.resolve({ skipped: true });
        const remotePromise = github.fetchGistMeta(config);

        // 并行拉取星标与 Gist，缩短同步整体耗时。
        const [starsResult, remote] = await Promise.all([starsPromise, remotePromise]);
        let stars = current.stars;
        let hasFreshStars = false;

        if (!starsResult.skipped) {
          const fetchedAt = nowIso();
          if (starsResult.notModified) {
            stars = {
              ...current.stars,
              etag: starsResult.etag || current.stars.etag || null,
              fetched_at: fetchedAt,
              force_fetch: false
            };
          } else {
            stars = {
              items: starsResult.items,
              updated_at: starsResult.updated_at,
              fetched_at: fetchedAt,
              etag: starsResult.etag || null,
              force_fetch: false
            };
          }
          await state.saveState({ stars });
          hasFreshStars = true;
        }

        let nextMeta = current.meta;
        let pendingOps = current.pendingOps.slice();

        if (hasFreshStars) {
          // 仅在星标列表新鲜时执行清理，避免使用过期数据误删元信息。
          const cleanup = meta.removeUnstarred(nextMeta, stars.items);
          nextMeta = cleanup.meta;
          if (cleanup.removed.length > 0) {
            pendingOps = addPendingOp(pendingOps, "cleanup", { count: cleanup.removed.length });
          }
        }
        if (remote.missingFile) {
          pendingOps = addPendingOp(pendingOps, "init", null);
        }

        if (pendingOps.length > 0) {
          // 本地有待同步变更时，需要比对 revision 以避免覆盖远端更新。
          if (remote.meta.revision !== nextMeta.revision) {
            const autoMerged = buildAutoMergedMeta(nextMeta, remote.meta, pendingOps);
            if (!autoMerged) {
              await state.saveState({
                meta: nextMeta,
                pendingOps,
                conflict: { remoteMeta: remote.meta, etag: remote.etag }
              });
              await state.setSyncStatus(
                "conflict",
                t("statusRemoteChanged", null, "远端版本已变更。")
              );
              await state.ensureRetryAlarm(pendingOps.length);
              return { ok: false, conflict: true };
            }

            const updatedMeta = {
              ...autoMerged,
              revision: remote.meta.revision + 1,
              updated_at: nowIso()
            };
            try {
              await github.updateGist(config, updatedMeta, remote.etag);
            } catch (error) {
              if (error && error.code === "etag_mismatch") {
                await state.saveState({
                  meta: nextMeta,
                  pendingOps,
                  conflict: { remoteMeta: remote.meta, etag: remote.etag }
                });
                await state.setSyncStatus(
                  "conflict",
                  t("statusRemoteChanged", null, "远端版本已变更。")
                );
                await state.ensureRetryAlarm(pendingOps.length);
                return { ok: false, conflict: true };
              }
              await state.setSyncStatus(
                "error",
                error.message || t("errorSyncFailed", null, "同步失败。")
              );
              await state.saveState({ meta: nextMeta, pendingOps });
              await state.ensureRetryAlarm(pendingOps.length);
              return { ok: false, error: error.message || t("errorSyncFailed", null, "同步失败。") };
            }

            await state.saveState({
              meta: updatedMeta,
              pendingOps: [],
              conflict: null
            });
            await state.setSyncStatus("idle", doneMessage);
            await state.ensureRetryAlarm(0);
            return {
              ok: true,
              meta: updatedMeta,
              stars
            };
          }

          const updatedMeta = {
            ...nextMeta,
            revision: remote.meta.revision + 1,
            updated_at: nowIso()
          };

          try {
            // 使用 ETag 进行乐观并发控制，防止写入覆盖远端新版本。
            await github.updateGist(config, updatedMeta, remote.etag);
          } catch (error) {
            if (error && error.code === "etag_mismatch") {
              // 远端版本变化时进入冲突流程，等待用户决策。
              await state.saveState({
                meta: nextMeta,
                pendingOps,
                conflict: { remoteMeta: remote.meta, etag: remote.etag }
              });
              await state.setSyncStatus(
                "conflict",
                t("statusRemoteChanged", null, "远端版本已变更。")
              );
              await state.ensureRetryAlarm(pendingOps.length);
              return { ok: false, conflict: true };
            }
            // 其它错误保留本地变更，等待重试。
            await state.setSyncStatus(
              "error",
              error.message || t("errorSyncFailed", null, "同步失败。")
            );
            await state.saveState({ meta: nextMeta, pendingOps });
            await state.ensureRetryAlarm(pendingOps.length);
            return { ok: false, error: error.message || t("errorSyncFailed", null, "同步失败。") };
          }

          // 写入成功后清空待同步队列并更新本地 meta。
          await state.saveState({
            meta: updatedMeta,
            pendingOps: [],
            conflict: null
          });
          await state.setSyncStatus("idle", doneMessage);
          await state.ensureRetryAlarm(0);
          return {
            ok: true,
            meta: updatedMeta,
            stars
          };
        }

        let finalMeta = nextMeta;
        if (remote.meta.revision > nextMeta.revision) {
          // 远端版本更新且本地无变更时，直接采用远端。
          finalMeta = remote.meta;
        }
        await state.saveState({
          meta: finalMeta,
          pendingOps: [],
          conflict: null
        });
        await state.setSyncStatus("idle", doneMessage);
        await state.ensureRetryAlarm(0);
        return { ok: true, meta: finalMeta, stars };
      } catch (error) {
        // 兜底错误处理，保证同步状态可见。
        await state.setSyncStatus(
          "error",
          error.message || t("errorSyncFailed", null, "同步失败。")
        );
        return { ok: false, error: error.message || t("errorSyncFailed", null, "同步失败。") };
      } finally {
        syncLock = false;
      }
    });
  }

  /**
   * 处理冲突决策，支持保留远端或保留本地版本。
   */
  async function resolveConflict(decision) {
    return withMetaWriteLock(async () => {
      const current = await state.getState();
    if (!current.conflict) {
      return { ok: false, error: t("errorNoConflict", null, "没有需要处理的冲突。") };
    }
      const config = current.config;
      if (decision === "keep_remote") {
        // 选择远端版本会丢弃本地 pendingOps，确保状态一致。
        await state.saveState({
          meta: current.conflict.remoteMeta,
          pendingOps: [],
          conflict: null
        });
        await state.setSyncStatus("idle", t("statusAppliedRemote", null, "已应用远端版本"));
        await state.ensureRetryAlarm(0);
        return { ok: true, meta: current.conflict.remoteMeta };
      }
      if (decision === "keep_local") {
        // 保留本地时提升 revision，并覆盖远端 Gist。
        const updatedMeta = {
          ...current.meta,
          revision: current.conflict.remoteMeta.revision + 1,
          updated_at: nowIso()
        };
        try {
          await github.updateGist(config, updatedMeta, current.conflict.etag);
        } catch (error) {
          if (error && error.code === "etag_mismatch") {
            // 再次冲突时保持冲突态，等待用户重新选择。
            await state.setSyncStatus(
              "conflict",
              t("statusRemoteChanged", null, "远端版本已变更。")
            );
            await state.saveState({
              conflict: { remoteMeta: current.conflict.remoteMeta, etag: current.conflict.etag }
            });
            return { ok: false, conflict: true };
          }
          await state.setSyncStatus(
            "error",
            error.message || t("errorSyncFailed", null, "同步失败。")
          );
          return { ok: false, error: error.message || t("errorSyncFailed", null, "同步失败。") };
        }
        await state.saveState({
          meta: updatedMeta,
          pendingOps: [],
          conflict: null
        });
        await state.setSyncStatus("idle", t("statusAppliedLocal", null, "已应用本地版本"));
        await state.ensureRetryAlarm(0);
        return { ok: true, meta: updatedMeta };
      }
      return { ok: false, error: t("errorInvalidConflictDecision", null, "冲突处理选项无效。") };
    });
  }

  root.sync = {
    syncNowInternal,
    resolveConflict
  };
})();
