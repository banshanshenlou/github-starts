(() => {
  "use strict";

  const root = globalThis.GhStarsHelperBackground;
  const { constants, utils } = root;
  const { clone, sanitizeTags, sanitizeGroupIds, buildGroupIndex, computeGroupDepth, nowIso } = utils;
  const shared = (globalThis.GhStarsHelper && globalThis.GhStarsHelper.shared) || {};
  const t = typeof shared.t === "function"
    ? shared.t
    : (key, substitutions, fallback) => fallback || key;

  /**
   * 规范化元数据结构，保证字段完整并避免脏数据流入。
   */
  function normalizeMeta(meta) {
    const next = clone(constants.DEFAULT_META);
    if (!meta || typeof meta !== "object") {
      return next;
    }

    if (typeof meta.schema_version === "number") {
      next.schema_version = meta.schema_version;
    }
    if (typeof meta.revision === "number") {
      next.revision = meta.revision;
    }
    if (typeof meta.updated_at === "string") {
      next.updated_at = meta.updated_at;
    }

    if (Array.isArray(meta.groups)) {
      next.groups = meta.groups
        .filter((group) => group && typeof group.id === "string" && typeof group.name === "string")
        .map((group) => ({
          id: group.id,
          name: group.name.trim(),
          parent_id: typeof group.parent_id === "string" ? group.parent_id : null,
          order: Number.isFinite(group.order) ? group.order : 0
        }));
    }

    if (meta.repo_meta && typeof meta.repo_meta === "object") {
      next.repo_meta = meta.repo_meta;
    }

    if (!Array.isArray(next.groups)) {
      next.groups = [];
    }
    if (!next.repo_meta || typeof next.repo_meta !== "object") {
      next.repo_meta = {};
    }

    return next;
  }

  /**
   * 校验分组树合法性，确保层级无环且深度符合限制。
   */
  function validateGroups(groups) {
    if (!Array.isArray(groups)) {
      return t("errorGroupsNotArray", null, "分组列表必须为数组。");
    }
    const ids = new Set();
    const groupMap = buildGroupIndex(groups);
    for (const group of groups) {
      if (!group.id || !group.name) {
        return t("errorGroupMissingField", null, "分组缺少 ID 或名称。");
      }
      if (ids.has(group.id)) {
        return t("errorGroupIdDuplicate", null, "分组 ID 必须唯一。");
      }
      ids.add(group.id);
    }
    for (const group of groups) {
      if (group.parent_id && !groupMap.has(group.parent_id)) {
        return t("errorGroupParentInvalid", null, "分组父级 ID 无效。");
      }
      const depth = computeGroupDepth(group.id, groupMap);
      if (!Number.isFinite(depth)) {
        return t("errorGroupCycle", null, "分组树存在循环。");
      }
      if (depth > constants.MAX_GROUP_DEPTH) {
        return t("errorGroupDepthExceeded", null, "分组层级不能超过 5 层。");
      }
    }
    return null;
  }

  /**
   * 按仓库更新元数据，空内容时自动清理以减少冗余。
   */
  function applyRepoMeta(meta, repoFullName, update) {
    const next = normalizeMeta(meta);
    const groupIds = sanitizeGroupIds(update.groupIds, next.groups);
    const tags = sanitizeTags(update.tags);
    const note = typeof update.note === "string" ? update.note.trim() : "";
    if (groupIds.length === 0 && tags.length === 0 && note.length === 0) {
      delete next.repo_meta[repoFullName];
      return next;
    }
    next.repo_meta[repoFullName] = {
      group_ids: groupIds,
      tags,
      note,
      updated_at: nowIso()
    };
    return next;
  }

  /**
   * 替换分组列表，并同步清洗仓库关联信息。
   */
  function applyGroups(meta, groups) {
    const next = normalizeMeta(meta);
    next.groups = groups.map((group) => ({
      id: String(group.id),
      name: String(group.name).trim(),
      parent_id: group.parent_id ? String(group.parent_id) : null,
      order: Number.isFinite(group.order) ? group.order : 0
    }));
    const validIds = new Set(next.groups.map((group) => group.id));
    Object.keys(next.repo_meta).forEach((repo) => {
      const info = next.repo_meta[repo];
      if (!info || typeof info !== "object") {
        delete next.repo_meta[repo];
        return;
      }
      const groupIds = Array.isArray(info.group_ids) ? info.group_ids : [];
      const filtered = groupIds.filter((id) => validIds.has(id));
      info.group_ids = Array.from(new Set(filtered));
      const tags = sanitizeTags(info.tags);
      const note = typeof info.note === "string" ? info.note.trim() : "";
      if (info.group_ids.length === 0 && tags.length === 0 && note.length === 0) {
        delete next.repo_meta[repo];
        return;
      }
      info.tags = tags;
      info.note = note;
      if (!info.updated_at) {
        info.updated_at = nowIso();
      }
    });
    return next;
  }

  /**
   * 清理已取消星标的仓库元数据，避免脏数据累积。
   */
  function removeUnstarred(meta, starItems) {
    const next = normalizeMeta(meta);
    const starSet = new Set(Object.keys(starItems || {}));
    const removed = [];
    Object.keys(next.repo_meta).forEach((repo) => {
      if (!starSet.has(repo)) {
        removed.push(repo);
        delete next.repo_meta[repo];
      }
    });
    return { meta: next, removed };
  }

  root.meta = {
    normalizeMeta,
    validateGroups,
    applyRepoMeta,
    applyGroups,
    removeUnstarred
  };
})();
