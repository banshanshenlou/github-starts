(() => {
  "use strict";

  const root = globalThis.GhStarsHelper;
  const content = root.content;
  const { state, elements, constants } = content;
  const shared = root.shared || {};
  const t = typeof shared.t === "function"
    ? shared.t
    : (key, substitutions, fallback) => fallback || key;
  const { decorateActionButtonWithSettingsIcon } = content.utils;
  const treeIndentStep = 16;
  const treeIndentBase = 8;

  /**
   * 按 parent_id 构建分组子节点索引，保证渲染顺序稳定。
   */
  function getGroupChildren(groups) {
    const children = {};
    groups.forEach((group) => {
      const parent = group.parent_id || "root";
      if (!children[parent]) {
        children[parent] = [];
      }
      children[parent].push(group);
    });
    Object.keys(children).forEach((key) => {
      children[key].sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        return a.name.localeCompare(b.name);
      });
    });
    return children;
  }

  /**
   * 计算分组深度，用于限制最大层级。
   */
  function getGroupDepth(groups, groupId) {
    const map = new Map(groups.map((group) => [group.id, group]));
    let depth = 1;
    let current = map.get(groupId);
    const visited = new Set();
    while (current && current.parent_id) {
      if (visited.has(current.parent_id)) {
        return Infinity;
      }
      visited.add(current.parent_id);
      depth += 1;
      current = map.get(current.parent_id);
    }
    return depth;
  }

  /**
   * 计算子树最大深度，配合父级深度判断是否合法。
   */
  function getGroupSubtreeDepth(groups, groupId) {
    const children = getGroupChildren(groups);
    /**
     * 深度优先遍历子树。
     */
    function walk(id) {
      const list = children[id] || [];
      if (list.length === 0) {
        return 1;
      }
      const depths = list.map((child) => walk(child.id));
      return 1 + Math.max(...depths);
    }
    return walk(groupId);
  }

  /**
   * 判断某分组挂载到新父级后是否满足层级限制。
   */
  function canAttachGroup(groups, groupId, newParentId) {
    if (!newParentId) {
      return true;
    }
    const parentDepth = getGroupDepth(groups, newParentId);
    const subtreeDepth = getGroupSubtreeDepth(groups, groupId);
    return parentDepth + subtreeDepth <= constants.MAX_GROUP_DEPTH;
  }

  /**
   * 构建分组路径映射，便于显示完整层级名称。
   */
  function buildGroupPathMap(groups) {
    const groupMap = new Map(groups.map((group) => [group.id, group]));
    const paths = {};
    groups.forEach((group) => {
      const parts = [];
      let current = group;
      const visited = new Set();
      while (current && !visited.has(current.id)) {
        parts.push(current.name);
        visited.add(current.id);
        if (!current.parent_id) {
          break;
        }
        current = groupMap.get(current.parent_id);
      }
      paths[group.id] = parts.reverse().join(" / ");
    });
    return paths;
  }

  /**
   * 获取某分组及其子孙分组的 ID 列表。
   */
  function getDescendantGroupIds(groups, rootId) {
    if (!rootId) {
      return [];
    }
    const children = getGroupChildren(groups);
    const result = [rootId];
    const stack = [rootId];
    while (stack.length > 0) {
      const current = stack.pop();
      const next = children[current] || [];
      next.forEach((child) => {
        result.push(child.id);
        stack.push(child.id);
      });
    }
    return result;
  }

  /**
   * 将星标信息与元数据合并为统一的数据结构。
   */
  function getRepoItems() {
    return Object.entries(state.stars.items || {}).map(([fullName, info]) => {
      const meta = (state.meta.repo_meta || {})[fullName] || {};
      return {
        fullName,
        info,
        meta
      };
    });
  }

  /**
   * 将标签过滤输入按中英文逗号与空白拆分为标准化 token。
   */
  function getTagTokens(value) {
    return value
      .split(/[,\s，]+/)
      .map((token) => token.trim().toLowerCase())
      .filter((token) => token.length > 0);
  }

  /**
   * 按当前排序策略比较仓库条目。
   */
  function compareRepoItems(a, b, sortKey) {
    if (sortKey === "name_asc") {
      return a.fullName.localeCompare(b.fullName);
    }
    if (sortKey === "name_desc") {
      return b.fullName.localeCompare(a.fullName);
    }
    if (sortKey === "meta_asc") {
      const aTime = a.meta.updated_at || "";
      const bTime = b.meta.updated_at || "";
      return aTime.localeCompare(bTime);
    }
    if (sortKey === "meta_desc") {
      const aTime = a.meta.updated_at || "";
      const bTime = b.meta.updated_at || "";
      return bTime.localeCompare(aTime);
    }
    if (sortKey === "starred_asc") {
      const aTime = a.info.starred_at || "";
      const bTime = b.info.starred_at || "";
      return aTime.localeCompare(bTime);
    }
    const aTime = a.info.starred_at || "";
    const bTime = b.info.starred_at || "";
    return bTime.localeCompare(aTime);
  }

  /**
   * 构建分组 ID -> 对象索引，便于快速访问。
   */
  function buildGroupIndex(groups) {
    const map = new Map();
    groups.forEach((group) => {
      map.set(group.id, group);
    });
    return map;
  }

  /**
   * 将选中的分组连同祖先加入目标集合，保证路径可见。
   */
  function addGroupWithAncestors(groupId, groupMap, target) {
    let current = groupMap.get(groupId);
    const visited = new Set();
    while (current && !visited.has(current.id)) {
      target.add(current.id);
      visited.add(current.id);
      if (!current.parent_id) {
        break;
      }
      current = groupMap.get(current.parent_id);
    }
  }

  /**
   * 判断仓库是否符合查询条件。
   */
  function matchesRepoFilters(item, query, tagTokens, activeGroupIds) {
    if (query && !item.fullName.toLowerCase().includes(query)) {
      return false;
    }
    if (activeGroupIds) {
      const groups = Array.isArray(item.meta.group_ids) ? item.meta.group_ids : [];
      const hasGroup = groups.some((id) => activeGroupIds.has(id));
      if (!hasGroup) {
        return false;
      }
    }
    if (tagTokens.length > 0) {
      const tags = Array.isArray(item.meta.tags)
        ? item.meta.tags.map((tag) => tag.toLowerCase())
        : [];
      const hasAll = tagTokens.every((token) => tags.includes(token));
      if (!hasAll) {
        return false;
      }
    }
    return true;
  }

  /**
   * 渲染分组树与仓库列表。
   */
  function renderGroupTree() {
    if (!elements.groupTree || !state.meta) {
      return;
    }
    elements.groupTree.textContent = "";
    const groups = state.meta.groups || [];
    const groupMap = buildGroupIndex(groups);
    const children = getGroupChildren(groups);
    const query = state.filter.query.trim().toLowerCase();
    const tagTokens = getTagTokens(state.filter.tag);
    const activeGroupIds = state.filter.groupId
      ? new Set(getDescendantGroupIds(groups, state.filter.groupId))
      : null;
    const activeGroupScope = activeGroupIds ? new Set(activeGroupIds) : null;
    if (activeGroupScope && state.filter.groupId) {
      addGroupWithAncestors(state.filter.groupId, groupMap, activeGroupScope);
    }
    const repoItems = getRepoItems();
    const repoMatches = repoItems.filter((item) =>
      matchesRepoFilters(item, query, tagTokens, activeGroupIds)
    );
    const reposByGroup = new Map();
    const ungroupedRepos = [];

    repoMatches.forEach((item) => {
      const groupIds = Array.isArray(item.meta.group_ids) ? item.meta.group_ids : [];
      if (groupIds.length === 0) {
        if (!activeGroupIds) {
          ungroupedRepos.push(item);
        }
        return;
      }
      groupIds.forEach((id) => {
        if (activeGroupIds && !activeGroupIds.has(id)) {
          return;
        }
        if (!reposByGroup.has(id)) {
          reposByGroup.set(id, []);
        }
        reposByGroup.get(id).push(item);
      });
    });

    const sortKey = state.filter.sort;
    reposByGroup.forEach((list) => {
      list.sort((a, b) => compareRepoItems(a, b, sortKey));
    });
    ungroupedRepos.sort((a, b) => compareRepoItems(a, b, sortKey));

    let visibleGroupIds = new Set();
    const hasQuery = query.length > 0;
    const hasTag = tagTokens.length > 0;
    const hasGroupFilter = Boolean(activeGroupIds);

    if (!hasQuery && !hasTag && !hasGroupFilter) {
      groups.forEach((group) => visibleGroupIds.add(group.id));
    } else if (!hasQuery && !hasTag && hasGroupFilter) {
      activeGroupScope.forEach((id) => visibleGroupIds.add(id));
    } else {
      if (hasQuery) {
        groups.forEach((group) => {
          if (group.name.toLowerCase().includes(query)) {
            addGroupWithAncestors(group.id, groupMap, visibleGroupIds);
          }
        });
      }
      reposByGroup.forEach((list, groupId) => {
        if (list.length > 0) {
          addGroupWithAncestors(groupId, groupMap, visibleGroupIds);
        }
      });
      if (hasGroupFilter) {
        visibleGroupIds = new Set(
          Array.from(visibleGroupIds).filter((id) => activeGroupScope.has(id))
        );
      }
    }

    /**
     * 渲染单个分组行。
     */
    function renderGroupRow(group, depth) {
      const row = document.createElement("div");
      row.className = "gh-stars-helper-group-row";
      row.dataset.groupId = group.id;
      row.style.paddingLeft = `${depth * treeIndentStep + treeIndentBase}px`;

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "gh-stars-helper-group-toggle";
      const repoCount = (reposByGroup.get(group.id) || []).length;
      const hasChildren = (children[group.id] || []).length > 0 || repoCount > 0;
      toggle.textContent = hasChildren ? (state.groupCollapse[group.id] ? "+" : "-") : "";
      toggle.disabled = !hasChildren;

      const name = document.createElement("span");
      name.className = "gh-stars-helper-group-name";
      name.textContent = group.name;
      if (state.filter.groupId === group.id) {
        name.classList.add("active");
      }

      const count = document.createElement("span");
      count.className = "gh-stars-helper-group-count";
      count.textContent = repoCount ? `(${repoCount})` : "";

      const actions = document.createElement("div");
      actions.className = "gh-stars-helper-group-actions";
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.textContent = "+";
      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.textContent = t("btnRename", null, "重命名");
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.textContent = t("btnDelete", null, "删除");

      actions.appendChild(addBtn);
      actions.appendChild(renameBtn);
      actions.appendChild(deleteBtn);

      row.appendChild(toggle);
      row.appendChild(name);
      row.appendChild(count);
      row.appendChild(actions);

      const toggleGroupRow = () => {
        if (!hasChildren) {
          return;
        }
        state.groupCollapse[group.id] = !state.groupCollapse[group.id];
        renderGroupTree();
      };

      toggle.addEventListener("click", () => {
        toggleGroupRow();
      });

      name.addEventListener("click", () => {
        state.filter.groupId = state.filter.groupId === group.id ? "" : group.id;
        content.ui.renderAll();
      });

      addBtn.addEventListener("click", () => addGroup(group.id));
      renameBtn.addEventListener("click", () => renameGroup(group.id));
      deleteBtn.addEventListener("click", () => deleteGroup(group.id));

      // 点击行空白区域时折叠/展开分组，避免干扰名称与操作按钮。
      row.addEventListener("click", (event) => {
        if (
          event.target.closest(".gh-stars-helper-group-toggle") ||
          event.target.closest(".gh-stars-helper-group-name") ||
          event.target.closest(".gh-stars-helper-group-actions")
        ) {
          return;
        }
        toggleGroupRow();
      });

      row.setAttribute("draggable", "true");
      row.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", group.id);
      });
      row.addEventListener("dragover", (event) => {
        event.preventDefault();
      });
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        const sourceId = event.dataTransfer.getData("text/plain");
        if (sourceId && sourceId !== group.id) {
          moveGroup(sourceId, group.id);
        }
      });

      return row;
    }

    /**
     * 渲染分组内的仓库条目。
     */
    function renderRepoRow(item, depth) {
      const row = document.createElement("div");
      row.className = "gh-stars-helper-tree-repo";
      row.style.paddingLeft = `${depth * treeIndentStep + treeIndentBase}px`;
      const indent = document.createElement("span");
      indent.className = "gh-stars-helper-tree-indent";
      indent.setAttribute("aria-hidden", "true");
      const link = document.createElement("a");
      link.className = "gh-stars-helper-tree-repo-link";
      link.href = item.info.html_url || `https://github.com/${item.fullName}`;
      const fullName = item.fullName || "";
      const parts = fullName.split("/");
      const owner = parts.length > 1 ? parts[0] : "";
      const name = parts.length > 1 ? parts.slice(1).join("/") : fullName;
      if (owner) {
        const ownerSpan = document.createElement("span");
        ownerSpan.className = "gh-stars-helper-repo-owner";
        ownerSpan.textContent = `${owner}/`;
        link.appendChild(ownerSpan);
      }
      const nameSpan = document.createElement("span");
      nameSpan.className = "gh-stars-helper-repo-name";
      nameSpan.textContent = name || fullName;
      link.appendChild(nameSpan);
      link.addEventListener("click", () => {
        content.ui.toggleDrawer(false);
      });

      const meta = document.createElement("span");
      meta.className = "gh-stars-helper-tree-repo-meta";
      const tags = Array.isArray(item.meta.tags) ? item.meta.tags : [];
      const note = item.meta.note || "";
      if (tags.length > 0) {
        const tagsSpan = document.createElement("span");
        tagsSpan.textContent = t(
          "metaLabelTags",
          [tags.join(", ")],
          `标签：${tags.join(", ")}`
        );
        meta.appendChild(tagsSpan);
      }
      if (note) {
        const noteSpan = document.createElement("span");
        noteSpan.textContent = t("metaLabelNote", [note], `备注：${note}`);
        meta.appendChild(noteSpan);
      }

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "gh-stars-helper-tree-edit";
      const buttonLabel = t("btnEdit", null, "编辑");
      editButton.textContent = buttonLabel;
      decorateActionButtonWithSettingsIcon(editButton, buttonLabel);
      editButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        content.repo.openRepoEditor(item.fullName);
      });
      row.appendChild(indent);
      row.appendChild(link);
      if (tags.length > 0 || note) {
        row.appendChild(meta);
      }
      row.appendChild(editButton);
      return row;
    }

    /**
     * 渲染未分组区域。
     */
    function renderUngrouped(depth) {
      const key = "__ungrouped__";
      const row = document.createElement("div");
      row.className = "gh-stars-helper-group-row";
      row.dataset.groupId = key;
      row.style.paddingLeft = `${depth * treeIndentStep + treeIndentBase}px`;

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "gh-stars-helper-group-toggle";
      toggle.textContent = ungroupedRepos.length > 0 ? (state.groupCollapse[key] ? "+" : "-") : "";
      toggle.disabled = ungroupedRepos.length === 0;

      const name = document.createElement("span");
      name.className = "gh-stars-helper-group-name";
      name.textContent = t("labelUngrouped", null, "未分组");

      const count = document.createElement("span");
      count.className = "gh-stars-helper-group-count";
      count.textContent = ungroupedRepos.length ? `(${ungroupedRepos.length})` : "";

      row.appendChild(toggle);
      row.appendChild(name);
      row.appendChild(count);

      toggle.addEventListener("click", () => {
        state.groupCollapse[key] = !state.groupCollapse[key];
        renderGroupTree();
      });

      elements.groupTree.appendChild(row);
      if (!state.groupCollapse[key]) {
        ungroupedRepos.forEach((item) => {
          elements.groupTree.appendChild(renderRepoRow(item, depth + 1));
        });
      }
    }

    /**
     * 深度优先渲染分组树。
     */
    function renderBranch(parentId, depth) {
      const list = children[parentId] || [];
      list.forEach((group) => {
        if (!visibleGroupIds.has(group.id)) {
          return;
        }
        elements.groupTree.appendChild(renderGroupRow(group, depth));
        if (!state.groupCollapse[group.id]) {
          const repos = reposByGroup.get(group.id) || [];
          repos.forEach((item) => {
            elements.groupTree.appendChild(renderRepoRow(item, depth + 1));
          });
          renderBranch(group.id, depth + 1);
        }
      });
    }

    if (!elements.groupTree.dataset.ghStarsHelperDropBound) {
      elements.groupTree.addEventListener("dragover", (event) => {
        event.preventDefault();
      });

      elements.groupTree.addEventListener("drop", (event) => {
        const sourceId = event.dataTransfer.getData("text/plain");
        if (sourceId) {
          moveGroup(sourceId, null);
        }
      });
      elements.groupTree.dataset.ghStarsHelperDropBound = "1";
    }

    renderBranch("root", 0);
    if (!activeGroupIds && ungroupedRepos.length > 0) {
      renderUngrouped(0);
    }
  }

  /**
   * 生成新的分组条目，确保同级排序连续。
   */
  function createGroupEntry(groups, parentId, name) {
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }
    const siblings = groups.filter((group) => (group.parent_id || null) === (parentId || null));
    const maxOrder = siblings.reduce((max, group) => Math.max(max, group.order || 0), 0);
    return {
      id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      parent_id: parentId || null,
      order: maxOrder + 1
    };
  }

  /**
   * 新增分组入口，受最大层级限制。
   */
  function addGroup(parentId) {
    if (!state.meta) {
      return;
    }
    const parentDepth = parentId ? getGroupDepth(state.meta.groups || [], parentId) : 0;
    if (parentDepth >= constants.MAX_GROUP_DEPTH) {
      content.ui.setStatus(
        t("errorGroupDepthExceeded", null, "分组层级不能超过 5 层。"),
        true
      );
      return;
    }
    content.ui.showInputModal(t("modalAddGroupTitle", null, "添加分组"), "", (name) => {
      const groups = state.meta.groups ? state.meta.groups.slice() : [];
      const entry = createGroupEntry(groups, parentId, name);
      if (!entry) {
        return;
      }
      groups.push(entry);
      content.api.updateGroups(groups);
    });
  }

  /**
   * 重命名已有分组。
   */
  function renameGroup(groupId) {
    if (!state.meta) {
      return;
    }
    const groups = state.meta.groups || [];
    const target = groups.find((group) => group.id === groupId);
    if (!target) {
      return;
    }
    content.ui.showInputModal("重命名分组", target.name, (name) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }
      const next = groups.map((group) =>
        group.id === groupId ? { ...group, name: trimmed } : group
      );
      content.api.updateGroups(next);
    });
  }

  /**
   * 收集分组及其子孙分组 ID。
   */
  function collectDescendantIds(groups, groupId) {
    const children = getGroupChildren(groups);
    const ids = [groupId];
    const stack = [groupId];
    while (stack.length > 0) {
      const current = stack.pop();
      const list = children[current] || [];
      list.forEach((child) => {
        ids.push(child.id);
        stack.push(child.id);
      });
    }
    return ids;
  }

  /**
   * 删除分组及其子树，同时提示用户确认。
   */
  function deleteGroup(groupId) {
    if (!state.meta) {
      return;
    }
    const groups = state.meta.groups || [];
    const target = groups.find((group) => group.id === groupId);
    const message = target
      ? t(
        "modalDeleteGroupMessageWithName",
        [target.name],
        `确认删除“${target.name}”及其子分组？`
      )
      : t("modalDeleteGroupMessage", null, "确认删除该分组及其子分组？");
    content.ui.showConfirmModal(t("modalDeleteGroupTitle", null, "删除分组"), message, () => {
      const idsToRemove = new Set(collectDescendantIds(groups, groupId));
      const nextGroups = groups.filter((group) => !idsToRemove.has(group.id));
      const nextMeta = { ...state.meta, groups: nextGroups };
      state.meta = nextMeta;
      content.api.updateGroups(nextGroups);
    }, { confirmText: t("btnDelete", null, "删除"), cancelText: t("btnCancel", null, "取消") });
  }

  /**
   * 移动分组到新父级，禁止移动到自身子树。
   */
  function moveGroup(sourceId, targetId) {
    if (!state.meta) {
      return;
    }
    const groups = state.meta.groups || [];
    if (sourceId === targetId) {
      return;
    }
    const source = groups.find((group) => group.id === sourceId);
    if (!source) {
      return;
    }
    const descendantIds = new Set(collectDescendantIds(groups, sourceId));
    if (targetId && descendantIds.has(targetId)) {
      return;
    }
    if (!canAttachGroup(groups, sourceId, targetId)) {
      content.ui.setStatus(
        t("errorGroupDepthExceeded", null, "分组层级不能超过 5 层。"),
        true
      );
      return;
    }
    const siblings = groups.filter((group) => (group.parent_id || null) === (targetId || null));
    const maxOrder = siblings.reduce((max, group) => Math.max(max, group.order || 0), 0);
    const next = groups.map((group) =>
      group.id === sourceId
        ? { ...group, parent_id: targetId || null, order: maxOrder + 1 }
        : group
    );
    content.api.updateGroups(next);
  }

  content.groups = {
    getGroupChildren,
    getGroupDepth,
    getGroupSubtreeDepth,
    canAttachGroup,
    buildGroupPathMap,
    getDescendantGroupIds,
    getRepoItems,
    getTagTokens,
    compareRepoItems,
    buildGroupIndex,
    addGroupWithAncestors,
    matchesRepoFilters,
    renderGroupTree,
    createGroupEntry,
    addGroup,
    renameGroup,
    collectDescendantIds,
    deleteGroup,
    moveGroup
  };
})();
