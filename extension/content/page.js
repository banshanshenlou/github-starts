(() => {
  "use strict";

  const root = globalThis.GhStarsHelper;
  const content = root.content;
  const { state, elements, runtime } = content;
  const { parseRepoFullName, isStarsListPage } = content.utils;
  const shared = root.shared || {};
  const t = typeof shared.t === "function"
    ? shared.t
    : (key, substitutions, fallback) => fallback || key;

  /**
   * 寻找适合挂载元数据的容器，避免破坏 GitHub 原有布局。
   */
  function findMetaHost(entry, repoFullName) {
    const anchors = Array.from(entry.querySelectorAll('a[href^="/"]'));
    const repoLink = anchors.find(
      (anchor) => parseRepoFullName(anchor.getAttribute("href")) === repoFullName
    );
    if (!repoLink) {
      return entry;
    }
    const actionSelector =
      'form[action$="/star"], form[action$="/unstar"], button[aria-label*="Star"], button[aria-label*="Unstar"]';
    let current = repoLink.parentElement;
    while (current && current !== entry) {
      if (
        current.tagName === "DIV" ||
        current.tagName === "SECTION" ||
        current.tagName === "ARTICLE"
      ) {
        if (!current.querySelector(actionSelector)) {
          return current;
        }
      }
      current = current.parentElement;
    }
    return entry;
  }

  /**
   * 生成元数据渲染键，用于跳过重复渲染。
   */
  function buildMetaKey(groupLabels, tags, note) {
    return JSON.stringify({
      groups: groupLabels,
      tags,
      note
    });
  }

  /**
   * 渲染仓库元数据行，包括分组、标签与备注。
   */
  function renderMetaRow(entry, repoFullName) {
    const meta = (state.meta.repo_meta || {})[repoFullName] || {};
    const host = findMetaHost(entry, repoFullName);
    let container = entry.querySelector(".gh-stars-helper-meta");
    if (!container) {
      container = document.createElement("div");
      container.className = "gh-stars-helper-meta";
      host.appendChild(container);
    } else if (container.parentElement !== host) {
      host.appendChild(container);
    }
    const groupPaths = content.groups.buildGroupPathMap(state.meta.groups || []);
    const groups = Array.isArray(meta.group_ids) ? meta.group_ids : [];
    const tags = Array.isArray(meta.tags) ? meta.tags : [];
    const note = meta.note || "";
    const groupLabels = groups.map((id) => groupPaths[id]).filter(Boolean);
    const metaKey = buildMetaKey(groupLabels, tags, note);

    if (
      container.dataset.ghStarsHelperMetaKey === metaKey &&
      container.dataset.ghStarsHelperMetaReady === "1"
    ) {
      return;
    }

    container.dataset.ghStarsHelperMetaKey = metaKey;
    container.dataset.ghStarsHelperMetaReady = "1";
    container.textContent = "";

    if (groups.length > 0) {
      const span = document.createElement("span");
      span.textContent = t(
        "metaLabelGroups",
        [groupLabels.join(", ")],
        `分组：${groupLabels.join(", ")}`
      );
      container.appendChild(span);
    }
    if (tags.length > 0) {
      const span = document.createElement("span");
      span.textContent = t(
        "metaLabelTags",
        [tags.join(", ")],
        `标签：${tags.join(", ")}`
      );
      container.appendChild(span);
    }
    if (note) {
      const span = document.createElement("span");
      span.textContent = t("metaLabelNote", [note], `备注：${note}`);
      container.appendChild(span);
    }

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "gh-stars-helper-inline-edit";
    editBtn.textContent = t("btnInlineEditGroup", null, "分组");
    editBtn.addEventListener("click", () => content.repo.openRepoEditor(repoFullName));
    container.appendChild(editBtn);
  }

  /**
   * 根据当前筛选条件隐藏或显示条目。
   */
  function applyFiltersToEntry(entry, repoFullName) {
    if (!state.meta) {
      return;
    }
    let visible = true;
    if (state.filter.query) {
      visible = repoFullName.toLowerCase().includes(state.filter.query.toLowerCase());
    }
    if (visible && state.filter.groupId) {
      const meta = (state.meta.repo_meta || {})[repoFullName] || {};
      const groups = Array.isArray(meta.group_ids) ? meta.group_ids : [];
      const descendants = content.groups.getDescendantGroupIds(state.meta.groups || [], state.filter.groupId);
      if (!groups.some((id) => descendants.includes(id))) {
        visible = false;
      }
    }
    if (visible && state.filter.tag) {
      const meta = (state.meta.repo_meta || {})[repoFullName] || {};
      const tags = Array.isArray(meta.tags) ? meta.tags.map((tag) => tag.toLowerCase()) : [];
      const tokens = content.groups.getTagTokens(state.filter.tag);
      if (tokens.length > 0 && !tokens.every((token) => tags.includes(token))) {
        visible = false;
      }
    }
    entry.style.display = visible ? "" : "none";
  }

  /**
   * 根据候选列表找到最合适的条目容器。
   */
  function getEntryCandidate(link) {
    const candidates = [
      { selector: "article", score: 5 },
      { selector: "div.Box-row", score: 4 },
      { selector: 'div[data-testid="repository-list-item"]', score: 4 },
      { selector: "li", score: 3 },
      { selector: "div", score: 1 }
    ];
    for (const candidate of candidates) {
      const entry = link.closest(candidate.selector);
      if (entry) {
        return { entry, score: candidate.score };
      }
    }
    return null;
  }

  /**
   * 在条目内查找仓库名，优先使用 hovercard 标识。
   */
  function findRepoFullNameInEntry(entry, starSet) {
    const anchors = Array.from(entry.querySelectorAll('a[href^="/"]'));
    let fallback = "";
    for (const anchor of anchors) {
      const repoFullName = parseRepoFullName(anchor.getAttribute("href"));
      if (!repoFullName) {
        continue;
      }
      if (starSet && !starSet.has(repoFullName)) {
        continue;
      }
      if (!fallback) {
        fallback = repoFullName;
      }
      const hoverType = anchor.getAttribute("data-hovercard-type") || "";
      const hoverUrl = anchor.getAttribute("data-hovercard-url") || "";
      if (hoverType === "repository" || hoverUrl.includes("/hovercard")) {
        return repoFullName;
      }
    }
    return fallback;
  }

  /**
   * 从 Star 表单向上查找对应条目容器。
   */
  function findEntryFromStarForm(form, repoFullName) {
    let current = form.parentElement;
    while (current && current !== document.body) {
      if (current.id === "gh-stars-helper-drawer") {
        return null;
      }
      if (current.tagName === "MAIN") {
        return null;
      }
      const anchors = Array.from(current.querySelectorAll('a[href^="/"]'));
      if (
        anchors.some(
          (anchor) => parseRepoFullName(anchor.getAttribute("href")) === repoFullName
        )
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  /**
   * 计算条目匹配度，用于选取最合适的容器。
   */
  function getEntryScore(entry) {
    if (entry.matches("article")) {
      return 5;
    }
    if (entry.matches("div.Box-row")) {
      return 4;
    }
    if (entry.matches('div[data-testid="repository-list-item"]')) {
      return 4;
    }
    if (entry.matches("li")) {
      return 3;
    }
    return 1;
  }

  /**
   * 扫描页面并注入元数据标签与筛选状态。
   */
  function updatePageEntries() {
    if (!state.meta || !isStarsListPage()) {
      return;
    }
    const main = document.querySelector("main");
    if (!main) {
      return;
    }
    const entries = new Map();
    const starItems = state.stars && state.stars.items ? state.stars.items : {};
    const starKeys = Object.keys(starItems);
    const starSet = starKeys.length > 0 ? new Set(starKeys) : null;
    const entryNodes = Array.from(
      main.querySelectorAll("article, div.Box-row, div[data-testid='repository-list-item'], li")
    );

    if (entryNodes.length > 0) {
      entryNodes.forEach((entry) => {
        if (entry.closest("#gh-stars-helper-drawer")) {
          return;
        }
        const repoFullName = findRepoFullNameInEntry(entry, starSet);
        if (!repoFullName) {
          return;
        }
        const score = getEntryScore(entry);
        const existing = entries.get(repoFullName);
        if (!existing || score > existing.score) {
          entries.set(repoFullName, { entry, score });
        }
      });
    }

    const starForms = Array.from(
      main.querySelectorAll('form[action$="/star"], form[action$="/unstar"]')
    );
    starForms.forEach((form) => {
      if (form.closest("#gh-stars-helper-drawer")) {
        return;
      }
      const repoFullName = parseRepoFullName(form.getAttribute("action"));
      if (!repoFullName) {
        return;
      }
      const entry = findEntryFromStarForm(form, repoFullName);
      if (!entry) {
        return;
      }
      const score = getEntryScore(entry);
      const existing = entries.get(repoFullName);
      if (!existing || score > existing.score) {
        entries.set(repoFullName, { entry, score });
      }
    });

    if (entries.size === 0) {
      const links = Array.from(main.querySelectorAll('a[href^="/"]'));
      links.forEach((link) => {
        if (link.closest("#gh-stars-helper-drawer")) {
          return;
        }
        const repoFullName = parseRepoFullName(link.getAttribute("href"));
        if (!repoFullName) {
          return;
        }
        if (starSet && !starSet.has(repoFullName)) {
          return;
        }
        const candidate = getEntryCandidate(link);
        if (!candidate) {
          return;
        }
        const existing = entries.get(repoFullName);
        if (!existing || candidate.score > existing.score) {
          entries.set(repoFullName, candidate);
        }
      });
    }

    entries.forEach((candidate, repoFullName) => {
      const entry = candidate.entry;
      if (entry.dataset.ghStarsHelperEntry !== "1") {
        entry.dataset.ghStarsHelperEntry = "1";
      }
      renderMetaRow(entry, repoFullName);
      applyFiltersToEntry(entry, repoFullName);
    });
  }

  /**
   * 启动 DOM 观察器，在列表变化时刷新注入内容。
   */
  function startObserver() {
    const main = document.querySelector("main");
    if (!main) {
      return;
    }
    if (runtime.observer && runtime.observedMain === main) {
      return;
    }
    if (runtime.observer) {
      runtime.observer.disconnect();
      runtime.observer = null;
    }
    runtime.observedMain = main;
    runtime.observer = new MutationObserver(() => {
      if (runtime.refreshTimer) {
        window.clearTimeout(runtime.refreshTimer);
      }
      runtime.refreshTimer = window.setTimeout(() => {
        updatePageEntries();
      }, 300);
    });
    runtime.observer.observe(main, { childList: true, subtree: true });
  }

  /**
   * 关闭 DOM 观察器，避免在非列表页面消耗资源。
   */
  function stopObserver() {
    if (!runtime.observer) {
      return;
    }
    runtime.observer.disconnect();
    runtime.observer = null;
    runtime.observedMain = null;
  }

  content.page = {
    findMetaHost,
    renderMetaRow,
    applyFiltersToEntry,
    getEntryCandidate,
    findRepoFullNameInEntry,
    findEntryFromStarForm,
    getEntryScore,
    updatePageEntries,
    startObserver,
    stopObserver
  };
})();
