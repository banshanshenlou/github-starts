(() => {
  "use strict";

  const root = globalThis.GhStarsHelperBackground;
  const { constants } = root;

  /**
   * 生成当前时间的 ISO 字符串，用于可读审计字段。
   */
  function nowIso() {
    return new Date().toISOString();
  }

  /**
   * 深拷贝纯 JSON 数据，避免引用被后续修改污染。
   */
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * 统一清洗标签，去空格、去空值并去重。
   */
  function sanitizeTags(tags) {
    if (!Array.isArray(tags)) {
      return [];
    }
    const cleaned = tags
      .map((tag) => String(tag).trim())
      .filter((tag) => tag.length > 0);
    return Array.from(new Set(cleaned));
  }

  /**
   * 过滤非法分组 ID，确保只保留当前分组集合内的有效值。
   */
  function sanitizeGroupIds(groupIds, groups) {
    if (!Array.isArray(groupIds)) {
      return [];
    }
    const validIds = new Set(groups.map((group) => group.id));
    const cleaned = groupIds
      .map((id) => String(id).trim())
      .filter((id) => id.length > 0 && validIds.has(id));
    return Array.from(new Set(cleaned));
  }

  /**
   * 串行化元数据写入与同步，避免并发读写覆盖造成分组与备注丢失。
   */
  let metaWriteChain = Promise.resolve();
  function withMetaWriteLock(task) {
    const run = () => Promise.resolve().then(task);
    const next = metaWriteChain.then(run, run);
    metaWriteChain = next.catch(() => {});
    return next;
  }

  /**
   * 追加待同步操作，并限制队列长度防止无限增长。
   */
  function addPendingOp(ops, type, info) {
    const next = Array.isArray(ops) ? ops.slice() : [];
    next.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: nowIso(),
      type,
      info: info || null
    });
    if (next.length > constants.MAX_PENDING_OPS) {
      next.splice(0, next.length - constants.MAX_PENDING_OPS);
    }
    return next;
  }

  /**
   * 构建分组索引，便于后续层级与路径计算。
   */
  function buildGroupIndex(groups) {
    const map = new Map();
    groups.forEach((group) => {
      map.set(group.id, group);
    });
    return map;
  }

  /**
   * 计算某分组深度，检测循环时返回 Infinity 以阻止非法树。
   */
  function computeGroupDepth(groupId, groupMap) {
    let depth = 1;
    let current = groupMap.get(groupId);
    const visited = new Set();
    while (current && current.parent_id) {
      if (visited.has(current.parent_id)) {
        return Infinity;
      }
      visited.add(current.parent_id);
      depth += 1;
      current = groupMap.get(current.parent_id);
    }
    return depth;
  }

  root.utils = {
    nowIso,
    clone,
    sanitizeTags,
    sanitizeGroupIds,
    addPendingOp,
    buildGroupIndex,
    computeGroupDepth,
    withMetaWriteLock
  };
})();
