(() => {
  "use strict";

  const root = globalThis.GhStarsHelper;
  const content = root.content;
  const { state, elements, runtime } = content;
  const shared = root.shared || {};
  const t = typeof shared.t === "function"
    ? shared.t
    : (key, substitutions, fallback) => fallback || key;
  const { getRepoFullNameFromPage, isRepoPage, decorateActionButtonWithSettingsIcon } = content.utils;
  const AUTO_SYNC_AFTER_SAVE_DELAY_MS = 5000;

  /**
   * 判断是否允许触发自动同步，避免缺少配置或冲突状态下反复弹错。
   */
  function canTriggerAutoSync() {
    if (!state.config || !state.config.hasPat || !state.config.gistId) {
      return false;
    }
    if (state.conflict) {
      return false;
    }
    if (state.syncStatus && state.syncStatus.state === "syncing") {
      return false;
    }
    return true;
  }

  /**
   * 保存后延迟触发自动同步，合并短时间内的连续编辑。
   */
  function scheduleAutoSyncAfterSave() {
    if (!canTriggerAutoSync()) {
      return;
    }
    if (runtime.repoAutoSyncTimer) {
      window.clearTimeout(runtime.repoAutoSyncTimer);
    }
    runtime.repoAutoSyncTimer = window.setTimeout(() => {
      runtime.repoAutoSyncTimer = null;
      if (!canTriggerAutoSync()) {
        return;
      }
      if (state.pendingOpsCount <= 0) {
        return;
      }
      content.api.syncNow("auto");
    }, AUTO_SYNC_AFTER_SAVE_DELAY_MS);
  }

  /**
   * 打开仓库元数据编辑器。
   */
  async function openRepoEditor(repoFullName) {
    const loaded = await content.api.ensureStateLoaded();
    if (!loaded) {
      return;
    }
    if (!state.meta) {
      return;
    }
    const meta = (state.meta.repo_meta || {})[repoFullName] || {};
    const overlay = document.createElement("div");
    overlay.className = "gh-stars-helper-modal-overlay";

    const groupList = document.createElement("div");
    groupList.className = "gh-stars-helper-group-list";
    let selectedGroupIds = new Set(Array.isArray(meta.group_ids) ? meta.group_ids : []);
    let searchInput = null;
    let searchClearButton = null;
    let listContainer = null;
    let listShell = null;

    /**
     * 扁平化分组树，便于渲染缩进列表。
     */
    function getFlatGroups() {
      const groups = state.meta.groups || [];
      const children = content.groups.getGroupChildren(groups);
      const result = [];
      const walk = (parentId, depth) => {
        const list = children[parentId] || [];
        list.forEach((group) => {
          result.push({ group, depth });
          walk(group.id, depth + 1);
        });
      };
      walk("root", 0);
      return result;
    }

    /**
     * 更新分组滚动区状态，驱动滚动提示与底部反馈。
     */
    const updateGroupListScrollState = () => {
      if (!listContainer || !listShell) {
        return;
      }
      const maxScroll = listContainer.scrollHeight - listContainer.clientHeight;
      const canScroll = maxScroll > 2;
      const atBottom = canScroll && listContainer.scrollTop >= maxScroll - 2;
      listShell.classList.toggle("gh-stars-helper-group-scrollable", canScroll);
      listShell.classList.toggle("gh-stars-helper-group-scroll-bottom", atBottom);
    };

    /**
     * 阻止滚动传递到页面，避免编辑弹窗滚动穿透。
     */
    const handleGroupListWheel = (event) => {
      if (!listContainer) {
        return;
      }
      const maxScroll = listContainer.scrollHeight - listContainer.clientHeight;
      if (maxScroll <= 0) {
        return;
      }
      const delta = event.deltaY;
      const atTop = listContainer.scrollTop <= 0;
      const atBottom = listContainer.scrollTop >= maxScroll - 1;
      if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
        event.preventDefault();
      }
    };

    /**
     * 统一标签分隔符，确保中英文逗号都能被识别。
     */
    function normalizeTagInput(value) {
      return value.replace(/，/g, ",");
    }

    /**
     * 绑定输入框清空按钮，并保持按钮状态同步。
     */
    function bindInputClear(input, clearButton, normalize) {
      if (!input || !clearButton) {
        return;
      }
      const syncVisibility = () => {
        clearButton.classList.toggle("visible", input.value.length > 0);
      };
      if (typeof normalize === "function") {
        const normalized = normalize(input.value);
        if (normalized !== input.value) {
          input.value = normalized;
        }
      }
      clearButton.addEventListener("click", () => {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      });
      input.addEventListener("input", () => {
        if (typeof normalize === "function") {
          const normalized = normalize(input.value);
          if (normalized !== input.value) {
            input.value = normalized;
          }
        }
        syncVisibility();
      });
      syncVisibility();
    }

    /**
     * 在编辑器内新增子分组，并自动选中。
     */
    async function handleAddChildGroup(parentId) {
      if (!state.meta) {
        return;
      }
      const parentDepth = parentId ? content.groups.getGroupDepth(state.meta.groups || [], parentId) : 0;
      if (parentDepth >= content.constants.MAX_GROUP_DEPTH) {
        window.alert(t("errorGroupDepthExceeded", null, "分组层级不能超过 5 层。"));
        return;
      }
      content.ui.showInputModal(t("modalAddGroupTitle", null, "添加分组"), "", async (name) => {
        const groups = state.meta.groups ? state.meta.groups.slice() : [];
        const entry = content.groups.createGroupEntry(groups, parentId, name);
        if (!entry) {
          return;
        }
        const ok = await content.api.updateGroups(groups.concat(entry));
        if (!ok) {
          return;
        }
        selectedGroupIds.add(entry.id);
        renderGroupOptions(searchInput ? searchInput.value : "");
      });
    }

    /**
     * 渲染分组选项列表，支持关键字筛选。
     */
    function renderGroupOptions(query) {
      groupList.textContent = "";
      const keyword = (query || "").trim().toLowerCase();
      const flatGroups = getFlatGroups();
      flatGroups.forEach(({ group, depth }) => {
        if (keyword && !group.name.toLowerCase().includes(keyword)) {
          return;
        }
        const row = document.createElement("label");
        row.className = "gh-stars-helper-group-option";
        row.style.paddingLeft = `${depth * 12}px`;
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = group.id;
        checkbox.checked = selectedGroupIds.has(group.id);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            selectedGroupIds.add(group.id);
          } else {
            selectedGroupIds.delete(group.id);
          }
        });
        const span = document.createElement("span");
        span.textContent = group.name;
        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.className = "gh-stars-helper-group-add-child";
        addButton.textContent = "+";
        addButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          handleAddChildGroup(group.id);
        });
        row.appendChild(checkbox);
        row.appendChild(span);
        row.appendChild(addButton);
        groupList.appendChild(row);
      });
      updateGroupListScrollState();
    }

    overlay.innerHTML = `
      <div class="gh-stars-helper-modal">
        <h3 class="gh-stars-helper-modal-title"></h3>
        <div class="gh-stars-helper-field">
          <label>${t("labelGroups", null, "分组")}</label>
          <div class="gh-stars-helper-group-controls"></div>
          <div class="gh-stars-helper-group-list-shell">
            <div class="gh-stars-helper-group-list-container"></div>
            <div class="gh-stars-helper-group-scroll-hint" aria-hidden="true"></div>
            <div class="gh-stars-helper-group-scroll-edge" aria-hidden="true"></div>
          </div>
        </div>
        <div class="gh-stars-helper-field">
          <label>${t("labelTags", null, "标签")}</label>
          <div class="gh-stars-helper-input-wrap">
            <input class="gh-stars-helper-input-tags" type="text" placeholder="${t("placeholderTagsExample", null, "标签1，标签2")}" />
            <button class="gh-stars-helper-input-clear gh-stars-helper-tags-clear" type="button" aria-label="${t("ariaClearTags", null, "清空标签")}">×</button>
          </div>
        </div>
        <div class="gh-stars-helper-field">
          <label>${t("labelNote", null, "备注")}</label>
          <textarea class="gh-stars-helper-input-note" rows="2"></textarea>
        </div>
        <div class="gh-stars-helper-modal-actions">
          <button class="gh-stars-helper-save" type="button">${t("btnSave", null, "保存")}</button>
          <button class="gh-stars-helper-cancel" type="button">${t("btnCancel", null, "取消")}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const titleEl = overlay.querySelector(".gh-stars-helper-modal-title");
    titleEl.textContent = t("repoEditorTitle", [repoFullName], `编辑 ${repoFullName}`);
    const controls = overlay.querySelector(".gh-stars-helper-group-controls");
    const searchWrap = document.createElement("div");
    searchWrap.className = "gh-stars-helper-input-wrap";
    searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "gh-stars-helper-group-search";
    searchInput.placeholder = t("placeholderSearchGroup", null, "搜索分组");
    searchClearButton = document.createElement("button");
    searchClearButton.type = "button";
    searchClearButton.className = "gh-stars-helper-input-clear gh-stars-helper-search-clear";
    searchClearButton.setAttribute(
      "aria-label",
      t("ariaClearSearch", null, "清空搜索")
    );
    searchClearButton.textContent = "×";
    searchWrap.appendChild(searchInput);
    searchWrap.appendChild(searchClearButton);
    controls.appendChild(searchWrap);
    listShell = overlay.querySelector(".gh-stars-helper-group-list-shell");
    listContainer = overlay.querySelector(".gh-stars-helper-group-list-container");
    if (listContainer) {
      listContainer.addEventListener("scroll", updateGroupListScrollState);
      listContainer.addEventListener("wheel", handleGroupListWheel, { passive: false });
    }
    const rootRow = document.createElement("div");
    rootRow.className = "gh-stars-helper-group-root";
    const rootLabel = document.createElement("span");
    rootLabel.className = "gh-stars-helper-group-root-label";
    rootLabel.textContent = t("labelGroupRoot", null, "根分组");
    const rootAddButton = document.createElement("button");
    rootAddButton.type = "button";
    rootAddButton.className = "gh-stars-helper-group-add-child";
    rootAddButton.textContent = "+";
    rootAddButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleAddChildGroup(null);
    });
    rootRow.appendChild(rootLabel);
    rootRow.appendChild(rootAddButton);
    listContainer.appendChild(rootRow);
    listContainer.appendChild(groupList);
    renderGroupOptions("");

    const tagsInput = overlay.querySelector(".gh-stars-helper-input-tags");
    const tagsClearButton = overlay.querySelector(".gh-stars-helper-tags-clear");
    const noteInput = overlay.querySelector(".gh-stars-helper-input-note");
    tagsInput.value = Array.isArray(meta.tags) ? meta.tags.join(", ") : "";
    noteInput.value = meta.note || "";

    // 关闭编辑器弹窗并释放 DOM。
    const cleanup = () => overlay.remove();
    const handleSave = () => {
      const tags = normalizeTagInput(tagsInput.value)
        .split(/[,\s]+/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      const note = noteInput.value.trim();
      const savePromise = content.api.updateRepoMeta(
        repoFullName,
        Array.from(selectedGroupIds),
        tags,
        note
      );
      cleanup();
      Promise.resolve(savePromise).then((ok) => {
        if (ok) {
          scheduleAutoSyncAfterSave();
        }
      });
    };
    overlay.querySelector(".gh-stars-helper-cancel").addEventListener("click", cleanup);
    overlay.querySelector(".gh-stars-helper-save").addEventListener("click", handleSave);
    // 支持 Ctrl+Enter 快速保存。
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.ctrlKey) {
        event.preventDefault();
        handleSave();
      }
    });
    bindInputClear(searchInput, searchClearButton);
    bindInputClear(tagsInput, tagsClearButton, normalizeTagInput);
    searchInput.addEventListener("input", () => {
      renderGroupOptions(searchInput.value);
    });
  }

  /**
   * 判断元素是否可见，用于过滤隐藏的 Star 表单。
   */
  function isElementVisible(element) {
    if (!element) {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * 查找 Star 表单，优先匹配可见元素。
   */
  function findRepoStarForm(repoFullName) {
    const forms = Array.from(document.querySelectorAll("form[action]"));
    const filtered = repoFullName
      ? forms.filter((form) => getRepoFullNameFromStarForm(form) === repoFullName)
      : forms;
    const visible = filtered.filter((form) => isElementVisible(form));
    const pickList = visible.length > 0 ? visible : filtered;
    return (
      pickList.find((form) => normalizeStarActionPath(form.getAttribute("action")).endsWith("/unstar")) ||
      pickList[0] ||
      null
    );
  }

  /**
   * 在 Star 表单中获取提交按钮。
   */
  function findRepoStarButton(starForm) {
    if (!starForm) {
      return null;
    }
    return starForm.querySelector('button[type="submit"]') || starForm.querySelector("button");
  }

  /**
   * 归一化 Star 表单 action，统一处理绝对/相对路径。
   */
  function normalizeStarActionPath(action) {
    if (!action || typeof action !== "string") {
      return "";
    }
    if (action.startsWith("http")) {
      try {
        const url = new URL(action);
        return url.pathname || "";
      } catch {
        return "";
      }
    }
    return action.split(/[?#]/)[0] || "";
  }

  /**
   * 解析严格仓库路径（仅接受 /owner/repo）。
   */
  function parseStrictRepoFullName(href) {
    if (!href || typeof href !== "string") {
      return "";
    }
    if (href.startsWith("http")) {
      try {
        const url = new URL(href);
        href = url.pathname;
      } catch {
        return "";
      }
    }
    const path = href.split(/[?#]/)[0] || "";
    const match = path.match(/^\/([^/]+)\/([^/]+)\/?$/);
    if (!match) {
      return "";
    }
    const owner = match[1].toLowerCase();
    if (owner === "topics" || owner === "search" || owner === "stars") {
      return "";
    }
    return `${match[1]}/${match[2]}`;
  }

  /**
   * 规范化按钮文本，兼容中英文状态判断。
   */
  function getButtonTextToken(button) {
    if (!button) {
      return "";
    }
    return String(button.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /**
   * 判断按钮是否为仓库 Star 按钮（排除话题 Star 与筛选按钮）。
   */
  function isRepositoryStarButton(button) {
    if (!button) {
      return false;
    }
    const label = String(button.getAttribute("aria-label") || "").toLowerCase();
    if (label.includes("topic") || label.includes("this topic") || label.includes("主题")) {
      return false;
    }
    if (label.includes("repository") && (label.includes("star") || label.includes("unstar"))) {
      return true;
    }
    const text = getButtonTextToken(button);
    return text === "star"
      || text === "unstar"
      || text === "starred"
      || text === "星标"
      || text === "已加星标"
      || text === "取消星标";
  }

  /**
   * 从 Star 按钮附近卡片提取仓库名，兜底 React 列表等无表单场景。
   */
  function getRepoFullNameFromButtonContext(starButton) {
    if (!starButton) {
      return "";
    }
    let current = starButton;
    for (let depth = 0; depth < 10 && current && current !== document.body; depth += 1) {
      const links = Array.from(current.querySelectorAll('a[href^="/"]'));
      for (const link of links) {
        const repoFullName = parseStrictRepoFullName(link.getAttribute("href"));
        if (repoFullName) {
          return repoFullName;
        }
      }
      current = current.parentElement;
    }
    return "";
  }

  /**
   * 为给定仓库定位 Star 控件，兼容 form/button 两种结构。
   */
  function findRepoStarControl(repoFullName) {
    const form = findRepoStarForm(repoFullName);
    const formButton = findRepoStarButton(form);
    if (formButton) {
      return { form, button: formButton };
    }
    if (!repoFullName) {
      return { form: null, button: null };
    }
    const repoLinks = Array.from(
      document.querySelectorAll(`a[href='/${repoFullName}'], a[href='/${repoFullName}/']`)
    );
    for (const link of repoLinks) {
      let current = link;
      for (let depth = 0; depth < 8 && current && current !== document.body; depth += 1) {
        const candidate = Array.from(current.querySelectorAll("button")).find((button) =>
          isRepositoryStarButton(button)
        );
        if (candidate) {
          return { form: null, button: candidate };
        }
        current = current.parentElement;
      }
    }
    return { form: null, button: null };
  }

  /**
   * 判断当前 Star 表单是否属于“话题 Star”，避免误触发仓库编辑逻辑。
   */
  function isTopicStarForm(starForm) {
    if (!starForm) {
      return false;
    }
    const actionPath = normalizeStarActionPath(starForm.getAttribute("action"));
    if (actionPath.startsWith("/topics/")) {
      return true;
    }
    const contextInput = starForm.querySelector('input[name="context"]');
    const context = contextInput ? String(contextInput.value || "").trim().toLowerCase() : "";
    return context === "topic";
  }

  /**
   * 从 Star 表单中提取仓库全名，仅接受 owner/repo/(un)star 结构。
   */
  function getRepoFullNameFromStarForm(starForm) {
    if (!starForm || isTopicStarForm(starForm)) {
      return "";
    }
    const actionPath = normalizeStarActionPath(starForm.getAttribute("action"));
    const match = actionPath.match(/^\/([^/]+)\/([^/]+)\/(star|unstar)\/?$/);
    if (!match) {
      return "";
    }
    return `${match[1]}/${match[2]}`;
  }

  /**
   * 判断当前 Star 状态，兼容不同的 GitHub DOM 结构。
   */
  function getStarState(starForm, starButton) {
    const actionPath = normalizeStarActionPath(starForm ? starForm.getAttribute("action") : "");
    if (actionPath.endsWith("/unstar")) {
      return true;
    }
    if (actionPath.endsWith("/star")) {
      return false;
    }
    const label = starButton ? starButton.getAttribute("aria-label") || "" : "";
    const lower = label.toLowerCase();
    if (lower.includes("unstar")) {
      return true;
    }
    if (lower.includes("star")) {
      return false;
    }
    const pressed = starButton ? starButton.getAttribute("aria-pressed") : null;
    if (pressed === "true") {
      return true;
    }
    if (pressed === "false") {
      return false;
    }
    const text = getButtonTextToken(starButton);
    if (text === "star" || text === "星标") {
      return false;
    }
    if (text === "starred" || text === "unstar" || text === "已加星标" || text === "取消星标") {
      return true;
    }
    return null;
  }

  /**
   * 轮询等待 Star 状态切换到期望值。
   */
  function waitForStarState(starForm, starButton, expected, timeoutMs) {
    const timeout = Number.isFinite(timeoutMs) ? timeoutMs : 4000;
    return new Promise((resolve) => {
      const start = Date.now();
      const timer = window.setInterval(() => {
        const current = getStarState(starForm, starButton);
        if (current === expected) {
          window.clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeout) {
          window.clearInterval(timer);
          resolve(false);
        }
      }, 200);
    });
  }

  /**
   * 轮询等待 Star 状态切换完成。
   */
  function waitForStarred(starForm, starButton, timeoutMs) {
    return waitForStarState(starForm, starButton, true, timeoutMs);
  }

  /**
   * 读取仓库的 Star 状态。
   */
  function getRepoStarState(repoFullName) {
    const control = findRepoStarControl(repoFullName);
    const form = control.form;
    const button = control.button;
    return getStarState(form, button);
  }

  /**
   * 按仓库名等待 Star 状态切换到期望值。
   */
  function waitForRepoStarState(repoFullName, expected, timeoutMs) {
    const timeout = Number.isFinite(timeoutMs) ? timeoutMs : 4000;
    return new Promise((resolve) => {
      const start = Date.now();
      const timer = window.setInterval(() => {
        const current = getRepoStarState(repoFullName);
        if (current === expected) {
          window.clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeout) {
          window.clearInterval(timer);
          resolve(false);
        }
      }, 200);
    });
  }

  /**
   * 按仓库名等待 Star 状态切换。
   */
  function waitForStarredByRepo(repoFullName, timeoutMs) {
    return waitForRepoStarState(repoFullName, true, timeoutMs);
  }

  /**
   * 构建星标缓存条目，用于本地快速渲染。
   */
  function buildStarInfo(repoFullName, starredAt) {
    const parts = repoFullName.split("/");
    return {
      starred_at: starredAt || new Date().toISOString(),
      name: parts[1] || "",
      owner: parts[0] || "",
      html_url: `https://github.com/${repoFullName}`
    };
  }

  /**
   * 更新星标缓存，避免等待完整同步。
   */
  async function applyStarCacheUpdate(repoFullName, starred, starredAt) {
    if (!repoFullName) {
      return;
    }
    const info = starred ? buildStarInfo(repoFullName, starredAt) : null;
    await content.api.updateStarCache(repoFullName, starred, info);
  }

  /**
   * 确保仓库已 Star，必要时触发点击并等待结果。
   */
  async function ensureRepoStarred(starForm, starButton) {
    const current = getStarState(starForm, starButton);
    if (current === true) {
      return { ok: true, already: true };
    }
    if (current === false) {
      starButton.click();
      const starred = await waitForStarred(starForm, starButton, 5000);
      return { ok: starred, already: false };
    }
    return { ok: false, unknown: true };
  }

  /**
   * 在仓库 Star 后自动弹出编辑器。
   */
  async function triggerRepoAutoEditor(repoFullName, starForm, starButton) {
    if (runtime.repoAutoOpenInProgress) {
      return;
    }
    runtime.repoAutoOpenInProgress = true;
    const starred = await waitForStarredByRepo(repoFullName, 5000);
    if (starred) {
      await openRepoEditor(repoFullName);
    }
    runtime.repoAutoOpenInProgress = false;
  }

  /**
   * 监听 Star/Unstar 点击并同步本地缓存。
   */
  async function handleStarToggleClick(event) {
    if (!event.isTrusted) {
      return;
    }
    const target = event.target;
    if (!target || !(target instanceof Element)) {
      return;
    }
    const starForm = target.closest("form[action]");
    const starButton = starForm ? findRepoStarButton(starForm) : target.closest("button");
    if (!starButton || !starButton.contains(target)) {
      return;
    }
    if (starButton.closest("#gh-stars-helper-drawer")) {
      return;
    }
    const repoFullName = starForm
      ? (getRepoFullNameFromStarForm(starForm) || getRepoFullNameFromPage())
      : getRepoFullNameFromButtonContext(starButton);
    if (!repoFullName) {
      return;
    }
    if (!starForm && !isRepositoryStarButton(starButton)) {
      return;
    }
    const current = getStarState(starForm, starButton);
    if (current === null) {
      return;
    }
    const expected = current === true ? false : true;
    const done = await waitForRepoStarState(repoFullName, expected, 5000);
    if (!done) {
      return;
    }
    await applyStarCacheUpdate(repoFullName, expected);
    if (isRepoPage()) {
      // GitHub 切换 Star 状态时会重建操作区域，重新补回内联编辑按钮。
      window.requestAnimationFrame(() => {
        ensureRepoEditButton();
      });
    }
  }

  /**
   * 监听 Star 点击，自动进入编辑流程。
   */
  function handleRepoStarClick(event) {
    if (!event.isTrusted) {
      return;
    }
    const target = event.target;
    if (!target || !(target instanceof Element)) {
      return;
    }
    const starForm = target.closest("form[action]");
    const starButton = starForm ? findRepoStarButton(starForm) : target.closest("button");
    if (!starButton || !starButton.contains(target)) {
      return;
    }
    if (starButton.closest("#gh-stars-helper-drawer")) {
      return;
    }
    if (!starForm && !isRepositoryStarButton(starButton)) {
      return;
    }
    const current = getStarState(starForm, starButton);
    if (current === true) {
      return;
    }
    const repoFullName = starForm
      ? (getRepoFullNameFromStarForm(starForm) || getRepoFullNameFromPage())
      : getRepoFullNameFromButtonContext(starButton);
    if (!repoFullName) {
      return;
    }
    triggerRepoAutoEditor(repoFullName, starForm, starButton);
  }

  /**
   * 启用自动打开编辑器的监听器。
   */
  function ensureRepoStarAutoOpen() {
    if (runtime.repoStarAutoOpenAttached) {
      return;
    }
    document.addEventListener("click", handleRepoStarClick, true);
    runtime.repoStarAutoOpenAttached = true;
  }

  /**
   * 启用星标缓存监听，保证列表及时刷新。
   */
  function ensureStarCacheListener() {
    if (runtime.starCacheListenerAttached) {
      return;
    }
    document.addEventListener("click", handleStarToggleClick, true);
    runtime.starCacheListenerAttached = true;
  }

  /**
   * 点击内联编辑按钮时确保已 Star 并打开编辑器。
   */
  async function handleRepoEditClick(repoFullName, starForm, editButton) {
    if (editButton) {
      editButton.disabled = true;
    }
    const starButton = findRepoStarButton(starForm);
    if (!starButton) {
      window.alert(t("errorStarButtonMissing", null, "未找到 Star 按钮，请手动 Star 后再试。"));
      if (editButton) {
        editButton.disabled = false;
      }
      return;
    }
    const result = await ensureRepoStarred(starForm, starButton);
    if (!result.ok) {
      window.alert(t("errorAutoStarFailed", null, "无法自动 Star，请手动 Star 后再点击编辑。"));
      if (editButton) {
        editButton.disabled = false;
      }
      return;
    }
    if (!result.already) {
      await applyStarCacheUpdate(repoFullName, true);
    }
    await openRepoEditor(repoFullName);
    if (editButton) {
      editButton.disabled = false;
    }
  }

  /**
   * 在仓库页插入内联编辑按钮。
   */
  function ensureRepoEditButton() {
    const repoFullName = getRepoFullNameFromPage();
    if (!repoFullName) {
      return;
    }
    const starForm = findRepoStarForm(repoFullName);
    if (!starForm) {
      return;
    }
    const container = starForm.parentElement || starForm;
    if (!container) {
      return;
    }
    const existing = container.querySelector(".gh-stars-helper-repo-inline-edit");
    if (existing) {
      elements.repoEditButton = existing;
      return;
    }
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "gh-stars-helper-repo-inline-edit";
    const buttonLabel = t("btnEdit", null, "编辑");
    editButton.textContent = buttonLabel;
    decorateActionButtonWithSettingsIcon(editButton, buttonLabel);
    editButton.addEventListener("click", () => {
      handleRepoEditClick(repoFullName, starForm, editButton);
    });
    container.insertBefore(editButton, starForm.nextSibling);
    elements.repoEditButton = editButton;
  }

  content.repo = {
    openRepoEditor,
    isElementVisible,
    findRepoStarForm,
    findRepoStarButton,
    getStarState,
    waitForStarred,
    getRepoStarState,
    waitForStarredByRepo,
    ensureRepoStarred,
    triggerRepoAutoEditor,
    handleRepoStarClick,
    ensureRepoStarAutoOpen,
    ensureStarCacheListener,
    handleRepoEditClick,
    ensureRepoEditButton
  };
})();
