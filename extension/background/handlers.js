(() => {
  "use strict";

  const root = globalThis.GhStarsHelperBackground;
  const { constants, utils, state, meta, github, sync } = root;
  const { nowIso, addPendingOp, withMetaWriteLock, clone } = utils;
  const shared = (globalThis.GhStarsHelper && globalThis.GhStarsHelper.shared) || {};
  const t = typeof shared.t === "function"
    ? shared.t
    : (key, substitutions, fallback) => fallback || key;

  /**
   * 注册后台事件监听，负责告警触发与消息调度。
   */
  function registerBackgroundHandlers() {
    const runtime = chrome.runtime;
    const alarms = chrome.alarms;
    const supportsAlarms = Boolean(
      alarms
      && alarms.onAlarm
      && typeof alarms.onAlarm.addListener === "function"
      && typeof alarms.create === "function"
      && typeof alarms.clear === "function"
    );

    // 兼容不支持 alarms 的浏览器，避免后台初始化阶段直接报错。
    if (supportsAlarms) {
      alarms.onAlarm.addListener(async (alarm) => {
        if (alarm && alarm.name === constants.ALARMS.RETRY) {
          const current = await state.getState();
          if (current.pendingOps.length > 0) {
            await sync.syncNowInternal("auto");
          }
        }
        if (alarm && alarm.name === constants.ALARMS.AUTO_SYNC) {
          await sync.syncNowInternal("auto");
        }
      });
    }

    if (supportsAlarms && runtime && runtime.onInstalled && typeof runtime.onInstalled.addListener === "function") {
      runtime.onInstalled.addListener(async () => {
        await alarms.create(constants.ALARMS.AUTO_SYNC, { periodInMinutes: 5 });
      });
    }

    if (supportsAlarms && runtime && runtime.onStartup && typeof runtime.onStartup.addListener === "function") {
      runtime.onStartup.addListener(async () => {
        await alarms.create(constants.ALARMS.AUTO_SYNC, { periodInMinutes: 5 });
      });
    }

    if (!runtime || !runtime.onMessage || typeof runtime.onMessage.addListener !== "function") {
      return;
    }

    runtime.onMessage.addListener((message, sender, sendResponse) => {
      const action = message && message.action ? message.action : "";
      // 统一入口内用异步 IIFE，确保 sendResponse 在异步链路里被正确调用。
      (async () => {
        if (action === "get_state") {
          const current = await state.getState();
          // 配置只暴露必要字段，避免在内容脚本侧泄露敏感信息。
          sendResponse({
            ok: true,
            state: {
              config: {
                hasPat: Boolean(current.config.pat),
                gistId: current.config.gistId,
                gistFile: current.config.gistFile
              },
              meta: current.meta,
              stars: current.stars,
              pendingOpsCount: current.pendingOps.length,
              syncStatus: current.syncStatus,
              conflict: current.conflict ? true : false
            }
          });
          return;
        }

        if (action === "get_config") {
          const current = await state.getState();
          sendResponse({ ok: true, config: current.config });
          return;
        }

        if (action === "save_config") {
          const config = message.config || {};
          // 保存前合并默认配置，确保后续读取字段完整。
          const next = {
            ...constants.DEFAULT_CONFIG,
            ...config
          };
          await state.saveState({ config: next });
          sendResponse({ ok: true });
          return;
        }

        if (action === "test_token") {
          const token = message.pat || "";
          if (!token) {
            sendResponse({ ok: false, error: t("errorPatRequired", null, "需要填写 PAT。") });
            return;
          }
          // 通过 GitHub API 校验 Token 并返回登录名用于 UI 提示。
          const res = await github.githubRequest("https://api.github.com/user", token, {});
          const user = await res.json();
          sendResponse({ ok: true, login: user.login || "" });
          return;
        }

        if (action === "create_gist") {
          const current = await state.getState();
          const config = {
            ...current.config,
            ...message.config
          };
          if (!config.pat) {
            sendResponse({ ok: false, error: t("errorPatRequired", null, "需要填写 PAT。") });
            return;
          }
          // 创建新 Gist 时初始化 meta，并将 revision 从 1 开始计数。
          const nextMeta = meta.normalizeMeta(message.meta || constants.DEFAULT_META);
          nextMeta.revision = 1;
          nextMeta.updated_at = nowIso();
          const gist = await github.createGist(config, nextMeta);
          const nextConfig = {
            ...config,
            gistId: gist.gistId
          };
          await state.saveState({ config: nextConfig, meta: nextMeta });
          sendResponse({ ok: true, gistId: gist.gistId, gistUrl: gist.gistUrl });
          return;
        }

        if (action === "sync_now") {
          // 同步走统一流程，由后台决定冲突与重试策略。
          const source = message && message.source ? message.source : "manual";
          const result = await sync.syncNowInternal(source);
          sendResponse(result);
          return;
        }

        if (action === "resolve_conflict") {
          // 冲突处理会更新本地或远端，并刷新同步状态。
          const result = await sync.resolveConflict(message.decision);
          sendResponse(result);
          return;
        }

        if (action === "update_repo_meta") {
          // 元数据写入必须串行化，避免与同步/其它写入相互覆盖。
          const result = await withMetaWriteLock(async () => {
            const current = await state.getState();
            const repoFullName = message.repoFullName;
            if (!repoFullName) {
              return { ok: false, error: t("errorRepoRequired", null, "仓库名不能为空。") };
            }
            // 变更会写入 pendingOps，等待后续同步上行。
            // 记录变更前的基线，用于冲突时判断远端是否改动同一仓库。
            const existingBase = current.pendingOps.find((op) => (
              op
              && op.type === "repo_meta"
              && op.info
              && op.info.repo === repoFullName
              && Object.prototype.hasOwnProperty.call(op.info, "base")
            ));
            const baseInfo = existingBase
              ? existingBase.info.base
              : (current.meta.repo_meta && current.meta.repo_meta[repoFullName]
                ? clone(current.meta.repo_meta[repoFullName])
                : null);
            const nextMeta = meta.applyRepoMeta(current.meta, repoFullName, {
              groupIds: message.groupIds || [],
              tags: message.tags || [],
              note: message.note || ""
            });
            const pendingOps = addPendingOp(current.pendingOps, "repo_meta", {
              repo: repoFullName,
              base: baseInfo
            });
            await state.saveState({ meta: nextMeta, pendingOps });
            await state.ensureRetryAlarm(pendingOps.length);
            return {
              ok: true,
              meta: nextMeta,
              pendingOpsCount: pendingOps.length
            };
          });
          sendResponse(result);
          return;
        }

        if (action === "update_groups") {
          // 分组更新属于结构性变更，写入前必须校验层级合法性。
          const result = await withMetaWriteLock(async () => {
            const current = await state.getState();
            const groups = Array.isArray(message.groups) ? message.groups : [];
            const error = meta.validateGroups(groups);
            if (error) {
              return { ok: false, error };
            }
            const nextMeta = meta.applyGroups(current.meta, groups);
            const pendingOps = addPendingOp(current.pendingOps, "groups", null);
            await state.saveState({ meta: nextMeta, pendingOps });
            await state.ensureRetryAlarm(pendingOps.length);
            return {
              ok: true,
              meta: nextMeta,
              pendingOpsCount: pendingOps.length
            };
          });
          sendResponse(result);
          return;
        }

        if (action === "update_star_cache") {
          const current = await state.getState();
          const repoFullName = message.repoFullName;
          if (!repoFullName) {
            sendResponse({ ok: false, error: t("errorRepoRequired", null, "仓库名不能为空。") });
            return;
          }
          // 仅更新星标缓存，不触发 meta 同步链路。
          const info = message.info && typeof message.info === "object" ? message.info : {};
          const parts = repoFullName.split("/");
          const nextStars = {
            ...current.stars,
            items: { ...(current.stars.items || {}) },
            updated_at: nowIso()
          };
          if (message.starred) {
            nextStars.items[repoFullName] = {
              starred_at: info.starred_at || nowIso(),
              name: info.name || parts[1] || "",
              owner: info.owner || parts[0] || "",
              html_url: info.html_url || `https://github.com/${repoFullName}`
            };
          } else {
            delete nextStars.items[repoFullName];
            // 取消 Star 后标记强制全量拉取，确保同步时及时清理元信息。
            nextStars.force_fetch = true;
          }
          await state.saveState({ stars: nextStars });
          sendResponse({ ok: true, stars: nextStars });
          return;
        }

        sendResponse({ ok: false, error: t("errorUnknownAction", null, "未知操作。") });
      })().catch((error) => {
        sendResponse({
          ok: false,
          error: error.message || t("errorUnexpected", null, "发生未知错误。")
        });
      });
      return true;
    });
  }

  root.handlers = {
    registerBackgroundHandlers
  };
})();
