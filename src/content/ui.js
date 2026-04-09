(() => {
  "use strict";

  const root = globalThis.GhStarsHelper;
  const content = root.content;
  const shared = root.shared || {};
  const { state, elements, runtime } = content;
  const MANAGE_BUTTON_LOGO_LIGHT_SRC = "assets/branding/logo.png";
  const MANAGE_BUTTON_LOGO_DARK_SRC = "assets/branding/logo-dark.png";
  const DRAWER_OPEN_META_SYNC_INTERVAL_MS = 15000;
  const SETTINGS_LOG_EXPORT_PREFIX = "github-stars-debug";
  const ASYNC_BUTTON_SUCCESS_RESET_MS = 1500;
  const TOAST_AUTO_CLOSE_MS = 2200;
  const buttonResetTimers = new WeakMap();
  const t = typeof shared.t === "function"
    ? shared.t
    : (key, substitutions, fallback) => fallback || key;

  /**
   * 获取 runtime API，兼容 browser/chrome 双命名空间。
   */
  function getRuntimeApi() {
    if (typeof browser !== "undefined" && browser.runtime) {
      return browser.runtime;
    }
    if (typeof chrome !== "undefined" && chrome.runtime) {
      return chrome.runtime;
    }
    return null;
  }

  /**
   * 将扩展内相对资源路径转换为可访问 URL。
   */
  function getExtensionAssetUrl(relativePath) {
    const runtimeApi = getRuntimeApi();
    if (runtimeApi && typeof runtimeApi.getURL === "function") {
      return runtimeApi.getURL(relativePath);
    }
    return relativePath;
  }

  /**
   * 获取当前最上层的弹框遮罩。
   */
  function getTopModalOverlay() {
    const overlays = Array.from(document.querySelectorAll(".gh-stars-helper-modal-overlay"));
    if (overlays.length === 0) {
      return null;
    }
    return overlays[overlays.length - 1];
  }

  /**
   * 关闭指定弹框遮罩，优先触发显式取消按钮。
   */
  function closeModalOverlay(overlay) {
    if (!overlay) {
      return false;
    }
    const cancelButton = overlay.querySelector(
      ".gh-stars-helper-modal-cancel, .gh-stars-helper-cancel"
    );
    if (cancelButton) {
      cancelButton.click();
      return true;
    }
    overlay.remove();
    return true;
  }

  /**
   * 处理 Esc 快捷键，优先关闭弹框，其次收起侧边抽屉。
   */
  function handleGlobalKeydown(event) {
    if (event.key !== "Escape") {
      return;
    }
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const fromModal = path.some(
      (node) =>
        node &&
        node.classList &&
        node.classList.contains("gh-stars-helper-modal-overlay")
    );
    const overlay = getTopModalOverlay();
    if (overlay) {
      event.preventDefault();
      closeModalOverlay(overlay);
      return;
    }
    if (fromModal) {
      event.preventDefault();
      return;
    }
    if (elements.drawer && elements.drawer.classList.contains("open")) {
      event.preventDefault();
      toggleDrawer(false);
    }
  }

  /**
   * 绑定全局 Esc 处理器，避免重复注册。
   */
  function ensureEscHandler() {
    if (runtime.escHandlerAttached) {
      return;
    }
    document.addEventListener("keydown", handleGlobalKeydown);
    runtime.escHandlerAttached = true;
  }

  /**
   * 确保悬浮管理按钮存在。
   */
  function ensureManageButton() {
    ensureEscHandler();
    if (elements.manageButton) {
      if (!elements.manageButton.isConnected) {
        // BFCache / 页面切换后节点可能已脱离文档，需要丢弃旧引用后重建。
        elements.manageButton = null;
      } else {
        if (content.debug) {
          content.debug.log("manage_button.ensure.skip", {
            isConnected: Boolean(elements.manageButton.isConnected)
          });
        }
        return;
      }
    }
    if (!document.body) {
      return;
    }
    const button = document.createElement("button");
    button.id = "gh-stars-helper-manage-btn";
    button.className = "gh-stars-helper-manage-btn floating";
    button.type = "button";
    const buttonLabel = t("manageButtonLabel", null, "github-starts");
    button.setAttribute("aria-label", buttonLabel);
    button.title = buttonLabel;

    const logoLight = document.createElement("img");
    logoLight.className = "gh-stars-helper-manage-logo gh-stars-helper-manage-logo-light";
    logoLight.alt = "";
    logoLight.decoding = "async";
    logoLight.src = getExtensionAssetUrl(MANAGE_BUTTON_LOGO_LIGHT_SRC);

    const logoDark = document.createElement("img");
    logoDark.className = "gh-stars-helper-manage-logo gh-stars-helper-manage-logo-dark";
    logoDark.alt = "";
    logoDark.decoding = "async";
    logoDark.src = getExtensionAssetUrl(MANAGE_BUTTON_LOGO_DARK_SRC);

    const srOnlyText = document.createElement("span");
    srOnlyText.className = "gh-stars-helper-sr-only";
    srOnlyText.textContent = buttonLabel;

    button.appendChild(logoLight);
    button.appendChild(logoDark);
    button.appendChild(srOnlyText);
    button.addEventListener("click", () => {
      if (content.debug) {
        content.debug.log("manage_button.click", {
          suppressManageButtonClick: Boolean(runtime.suppressManageButtonClick)
        });
      }
      if (runtime.suppressManageButtonClick) {
        return;
      }
      toggleDrawer(true);
    });
    document.body.appendChild(button);
    if (content.debug) {
      content.debug.log("manage_button.created", {
        bodyReady: Boolean(document.body)
      });
    }
    // 首次注入时闪烁两下，提示悬浮按钮入口。
    window.requestAnimationFrame(() => {
      button.classList.add("attention");
      button.addEventListener(
        "animationend",
        () => {
          button.classList.remove("attention");
        },
        { once: true }
      );
    });
    content.storage.setupManageButtonDrag(button);
    elements.manageButton = button;
    window.requestAnimationFrame(() => {
      content.storage.applyManageButtonPosition(button);
    });
    if (!runtime.manageButtonResizeAttached) {
      let resizeRaf = null;
      window.addEventListener("resize", () => {
        if (!elements.manageButton) {
          return;
        }
        if (resizeRaf) {
          return;
        }
        resizeRaf = window.requestAnimationFrame(() => {
          resizeRaf = null;
          content.storage.applyManageButtonPosition(elements.manageButton);
        });
      });
      runtime.manageButtonResizeAttached = true;
    }
  }

  /**
   * 统一标签分隔符，确保中英文逗号都能被正常识别。
   */
  function normalizeCommaInput(value) {
    return value.replace(/，/g, ",");
  }

  /**
   * 绑定输入框清空按钮，并保持可见状态与输入值同步。
   */
  function bindInputClear(input, clearButton) {
    if (!input || !clearButton) {
      return;
    }
    const syncVisibility = () => {
      clearButton.classList.toggle("visible", input.value.length > 0);
    };
    clearButton.addEventListener("click", () => {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    });
    input.addEventListener("input", syncVisibility);
    syncVisibility();
  }

  /**
   * 清理按钮的自动恢复定时器，避免旧状态覆盖最新交互结果。
   */
  function clearAsyncButtonResetTimer(button) {
    const timer = buttonResetTimers.get(button);
    if (timer) {
      window.clearTimeout(timer);
      buttonResetTimers.delete(button);
    }
  }

  /**
   * 为异步按钮登记默认文案，统一后续状态切换的视觉基线。
   */
  function prepareAsyncButton(button, idleLabel) {
    if (!button) {
      return;
    }
    button.classList.add("gh-stars-helper-async-button");
    if (!button.dataset.ghStarsHelperIdleLabel) {
      const label = typeof idleLabel === "string" && idleLabel
        ? idleLabel
        : String(button.textContent || "").trim();
      button.dataset.ghStarsHelperIdleLabel = label;
    }
    if (!button.dataset.ghStarsHelperAsyncState) {
      button.dataset.ghStarsHelperAsyncState = "idle";
    }
  }

  /**
   * 获取当前按钮视觉状态，便于渲染链路避免错误覆盖短暂成功/失败态。
   */
  function getAsyncButtonState(button) {
    if (!button) {
      return "idle";
    }
    return button.dataset.ghStarsHelperAsyncState || "idle";
  }

  /**
   * 统一切换异步按钮状态：默认、加载、成功、失败。
   */
  function setAsyncButtonState(button, options) {
    if (!button) {
      return;
    }
    const config = options && typeof options === "object" ? options : {};
    const nextState = config.state || "idle";
    prepareAsyncButton(button, config.idleLabel);
    clearAsyncButtonResetTimer(button);
    button.classList.remove("is-pending", "is-success", "is-error");
    button.dataset.ghStarsHelperAsyncState = nextState;
    if (nextState === "pending") {
      button.classList.add("is-pending");
    } else if (nextState === "success") {
      button.classList.add("is-success");
    } else if (nextState === "error") {
      button.classList.add("is-error");
    }
    const label = typeof config.label === "string" && config.label
      ? config.label
      : (button.dataset.ghStarsHelperIdleLabel || String(button.textContent || "").trim());
    button.textContent = label;
    button.disabled = nextState === "pending" ? true : Boolean(config.disabled);
    button.setAttribute("aria-busy", nextState === "pending" ? "true" : "false");
    if (nextState === "success") {
      const resetMs = Number.isFinite(config.autoResetMs)
        ? config.autoResetMs
        : ASYNC_BUTTON_SUCCESS_RESET_MS;
      if (resetMs > 0) {
        const timer = window.setTimeout(() => {
          buttonResetTimers.delete(button);
          resetAsyncButtonState(button);
        }, resetMs);
        buttonResetTimers.set(button, timer);
      }
    }
  }

  /**
   * 将异步按钮恢复为初始白色态，失败态会在下一次点击前由调用方主动重置。
   */
  function resetAsyncButtonState(button) {
    if (!button) {
      return;
    }
    setAsyncButtonState(button, {
      state: "idle",
      label: button.dataset.ghStarsHelperIdleLabel || String(button.textContent || "").trim(),
      autoResetMs: 0
    });
  }

  /**
   * 展示页面级轻提示，用于“按钮已关闭/弹窗已销毁”后的结果反馈。
   */
  function showToast(message, options) {
    if (!message || !document.body) {
      return;
    }
    const config = options && typeof options === "object" ? options : {};
    const variant = config.variant === "error" ? "error" : "success";
    const existing = document.querySelector(".gh-stars-helper-toast");
    if (existing) {
      existing.remove();
    }
    if (runtime.toastTimer) {
      window.clearTimeout(runtime.toastTimer);
      runtime.toastTimer = null;
    }
    const toast = document.createElement("div");
    toast.className = `gh-stars-helper-toast gh-stars-helper-toast-${variant}`;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.textContent = message;
    document.body.appendChild(toast);
    window.requestAnimationFrame(() => {
      toast.classList.add("visible");
    });
    runtime.toastTimer = window.setTimeout(() => {
      toast.classList.remove("visible");
      window.setTimeout(() => {
        if (toast.isConnected) {
          toast.remove();
        }
      }, 180);
      runtime.toastTimer = null;
    }, Number.isFinite(config.durationMs) ? config.durationMs : TOAST_AUTO_CLOSE_MS);
  }

  /**
   * 查找分组树最近的可滚动容器，兼容抽屉主体与未来嵌套布局。
   */
  function getGroupTreeScrollContainer() {
    if (!elements.groupTree) {
      return null;
    }
    let current = elements.groupTree;
    while (current) {
      const overflowY = window.getComputedStyle(current).overflowY;
      const isScrollable = /(auto|scroll|overlay)/.test(overflowY)
        && current.scrollHeight - current.clientHeight > 1;
      if (isScrollable) {
        return current;
      }
      current = current.parentElement;
    }
    return elements.groupTree;
  }

  /**
   * 快速滚动分组树到顶部或底部。
   */
  function scrollGroupTreeToBoundary(position) {
    const container = getGroupTreeScrollContainer();
    if (!container) {
      return;
    }
    const targetTop = position === "bottom" ? container.scrollHeight : 0;
    if (typeof container.scrollTo === "function") {
      container.scrollTo({ top: targetTop, behavior: "smooth" });
      return;
    }
    container.scrollTop = targetTop;
  }

  /**
   * 清理抽屉相关节点引用，供页面恢复后重新注入使用。
   */
  function resetDrawerElements() {
    elements.overlay = null;
    elements.drawer = null;
    elements.starsCount = null;
    elements.groupsCount = null;
    elements.statusText = null;
    elements.pendingText = null;
    elements.syncButton = null;
    elements.optionsButton = null;
    elements.helpButton = null;
    elements.optionsHint = null;
    elements.optionsMessage = null;
    elements.optionsLink = null;
    elements.conflictBox = null;
    elements.conflictDesc = null;
    elements.conflictLocalLine = null;
    elements.conflictCloudLine = null;
    elements.conflictRecentRepos = null;
    elements.conflictHint = null;
    elements.conflictKeepRemote = null;
    elements.conflictKeepLocal = null;
    elements.conflictOpenGist = null;
    elements.searchInput = null;
    elements.tagInput = null;
    elements.sortSelect = null;
    elements.sectionTitle = null;
    elements.sectionActions = null;
    elements.groupTree = null;
  }

  /**
   * 创建抽屉与遮罩结构，并绑定交互事件。
   */
  function ensureDrawer() {
    if (elements.drawer) {
      const drawerConnected = Boolean(elements.drawer.isConnected);
      const overlayConnected = Boolean(elements.overlay && elements.overlay.isConnected);
      if (!drawerConnected || !overlayConnected) {
        resetDrawerElements();
      } else {
        if (content.debug) {
          content.debug.log("drawer.ensure.skip", {
            isConnected: drawerConnected
          });
        }
        return;
      }
    }
    const overlay = document.createElement("div");
    overlay.id = "gh-stars-helper-overlay";
    overlay.className = "gh-stars-helper-overlay";

    const drawer = document.createElement("aside");
    drawer.id = "gh-stars-helper-drawer";
    drawer.className = "gh-stars-helper-drawer";
    drawer.innerHTML = `
      <div class="gh-stars-helper-header">
        <div class="gh-stars-helper-title">${t("appName", null, "Stars Manager")}</div>
        <div class="gh-stars-helper-stats">
          <span class="gh-stars-helper-stat-item">
            <span class="gh-stars-helper-stat-label">${t("labelStarsColon", null, "星标:")}</span>
            <span class="gh-stars-helper-stat-value gh-stars-helper-stars-count">0</span>
          </span>
          <span class="gh-stars-helper-stat-item">
            <span class="gh-stars-helper-stat-label">${t("labelGroupsColon", null, "分组:")}</span>
            <span class="gh-stars-helper-stat-value gh-stars-helper-groups-count">0</span>
          </span>
        </div>
        <button class="gh-stars-helper-close" type="button">×</button>
      </div>
      <div class="gh-stars-helper-status">
        <div class="gh-stars-helper-status-row">
          <div class="gh-stars-helper-status-info">
            <span class="gh-stars-helper-status-text"></span>
            <span class="gh-stars-helper-pending"></span>
          </div>
          <div class="gh-stars-helper-status-actions">
            <button class="gh-stars-helper-sync" type="button">${t("btnSync", null, "同步")}</button>
            <button class="gh-stars-helper-options" type="button">${t("btnSettings", null, "设置")}</button>
            <button class="gh-stars-helper-help" type="button">${t("btnHelp", null, "帮助")}</button>
          </div>
        </div>
        <div class="gh-stars-helper-options-hint">
          <span class="gh-stars-helper-options-message"></span>
          <a class="gh-stars-helper-options-link" href="#" target="_blank" rel="noopener">
            ${t("linkOpenSettings", null, "打开设置")}
          </a>
        </div>
        <div class="gh-stars-helper-conflict">
          <div class="gh-stars-helper-conflict-title">${t("conflictTitle", null, "检测到同步冲突")}</div>
          <div class="gh-stars-helper-conflict-desc">
            ${t("conflictDesc", null, "本机有未同步修改，同时云端版本也变化了。")}
          </div>
          <div class="gh-stars-helper-conflict-meta">
            <div class="gh-stars-helper-conflict-local-line"></div>
            <div class="gh-stars-helper-conflict-cloud-line"></div>
            <div class="gh-stars-helper-conflict-recent-repos"></div>
          </div>
          <div class="gh-stars-helper-conflict-hint"></div>
          <div class="gh-stars-helper-conflict-actions">
            <button class="gh-stars-helper-conflict-remote" type="button">${t("conflictKeepRemote", null, "使用云端版本")}</button>
            <button class="gh-stars-helper-conflict-local" type="button">${t("conflictKeepLocal", null, "保留本机修改")}</button>
            <button class="gh-stars-helper-conflict-open" type="button">${t("conflictOpenGist", null, "打开 Gist")}</button>
          </div>
        </div>
      </div>
      <div class="gh-stars-helper-filters">
        <div class="gh-stars-helper-input-wrap">
          <input class="gh-stars-helper-search" type="search" placeholder="${t("placeholderSearchUnified", null, "搜索仓库、分组或备注")}" />
          <button class="gh-stars-helper-input-clear gh-stars-helper-search-clear" type="button" aria-label="${t("ariaClearSearch", null, "清空搜索")}">×</button>
        </div>
        <select class="gh-stars-helper-sort">
          <option value="starred_desc">${t("sortStarredDesc", null, "星标时间（新到旧）")}</option>
          <option value="starred_asc">${t("sortStarredAsc", null, "星标时间（旧到新）")}</option>
          <option value="name_asc">${t("sortNameAsc", null, "名称（A-Z）")}</option>
          <option value="name_desc">${t("sortNameDesc", null, "名称（Z-A）")}</option>
          <option value="meta_desc">${t("sortMetaDesc", null, "元数据更新时间（新到旧）")}</option>
          <option value="meta_asc">${t("sortMetaAsc", null, "元数据更新时间（旧到新）")}</option>
        </select>
      </div>
      <div class="gh-stars-helper-body">
        <div class="gh-stars-helper-groups">
          <div class="gh-stars-helper-section-header">
            <span class="gh-stars-helper-section-title">${t("sectionGroups", null, "分组")}</span>
            <div class="gh-stars-helper-section-actions">
              <div class="gh-stars-helper-tree-quick-actions">
                <button
                  class="gh-stars-helper-tree-quick gh-stars-helper-tree-quick-top"
                  type="button"
                  aria-label="${t("btnTreeScrollTop", null, "滚动到顶部")}"
                  title="${t("btnTreeScrollTop", null, "滚动到顶部")}">
                  <span class="gh-stars-helper-tree-quick-icon" aria-hidden="true"></span>
                </button>
                <button
                  class="gh-stars-helper-tree-quick gh-stars-helper-tree-quick-bottom"
                  type="button"
                  aria-label="${t("btnTreeScrollBottom", null, "滚动到底部")}"
                  title="${t("btnTreeScrollBottom", null, "滚动到底部")}">
                  <span class="gh-stars-helper-tree-quick-icon" aria-hidden="true"></span>
                </button>
                <button
                  class="gh-stars-helper-tree-quick gh-stars-helper-tree-quick-expand"
                  type="button"
                  aria-label="${t("btnExpandAllGroups", null, "展开全部分组")}"
                  title="${t("btnExpandAllGroups", null, "展开全部分组")}">
                  <span class="gh-stars-helper-tree-quick-icon" aria-hidden="true"></span>
                </button>
                <button
                  class="gh-stars-helper-tree-quick gh-stars-helper-tree-quick-collapse"
                  type="button"
                  aria-label="${t("btnCollapseAllGroups", null, "折叠全部分组")}"
                  title="${t("btnCollapseAllGroups", null, "折叠全部分组")}">
                  <span class="gh-stars-helper-tree-quick-icon" aria-hidden="true"></span>
                </button>
              </div>
              <button class="gh-stars-helper-add-group" type="button">${t("btnAddGroup", null, "新增")}</button>
            </div>
          </div>
          <div class="gh-stars-helper-group-tree"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    if (content.debug) {
      content.debug.log("drawer.created");
    }

    elements.overlay = overlay;
    elements.drawer = drawer;
    elements.starsCount = drawer.querySelector(".gh-stars-helper-stars-count");
    elements.groupsCount = drawer.querySelector(".gh-stars-helper-groups-count");
    elements.statusText = drawer.querySelector(".gh-stars-helper-status-text");
    elements.pendingText = drawer.querySelector(".gh-stars-helper-pending");
    elements.syncButton = drawer.querySelector(".gh-stars-helper-sync");
    elements.optionsButton = drawer.querySelector(".gh-stars-helper-options");
    elements.helpButton = drawer.querySelector(".gh-stars-helper-help");
    elements.optionsHint = drawer.querySelector(".gh-stars-helper-options-hint");
    elements.optionsMessage = drawer.querySelector(".gh-stars-helper-options-message");
    elements.optionsLink = drawer.querySelector(".gh-stars-helper-options-link");
    elements.conflictBox = drawer.querySelector(".gh-stars-helper-conflict");
    elements.conflictDesc = drawer.querySelector(".gh-stars-helper-conflict-desc");
    elements.conflictLocalLine = drawer.querySelector(".gh-stars-helper-conflict-local-line");
    elements.conflictCloudLine = drawer.querySelector(".gh-stars-helper-conflict-cloud-line");
    elements.conflictRecentRepos = drawer.querySelector(".gh-stars-helper-conflict-recent-repos");
    elements.conflictHint = drawer.querySelector(".gh-stars-helper-conflict-hint");
    elements.conflictKeepRemote = drawer.querySelector(".gh-stars-helper-conflict-remote");
    elements.conflictKeepLocal = drawer.querySelector(".gh-stars-helper-conflict-local");
    elements.conflictOpenGist = drawer.querySelector(".gh-stars-helper-conflict-open");
    elements.searchInput = drawer.querySelector(".gh-stars-helper-search");
    elements.sortSelect = drawer.querySelector(".gh-stars-helper-sort");
    elements.sectionTitle = drawer.querySelector(".gh-stars-helper-section-title");
    elements.sectionActions = drawer.querySelector(".gh-stars-helper-section-actions");
    elements.groupTree = drawer.querySelector(".gh-stars-helper-group-tree");
    const searchClear = drawer.querySelector(".gh-stars-helper-search-clear");
    const addGroupButton = drawer.querySelector(".gh-stars-helper-add-group");
    const treeQuickTopButton = drawer.querySelector(".gh-stars-helper-tree-quick-top");
    const treeQuickBottomButton = drawer.querySelector(".gh-stars-helper-tree-quick-bottom");
    const treeQuickExpandButton = drawer.querySelector(".gh-stars-helper-tree-quick-expand");
    const treeQuickCollapseButton = drawer.querySelector(".gh-stars-helper-tree-quick-collapse");

    prepareAsyncButton(elements.syncButton, t("btnSync", null, "同步"));

    overlay.addEventListener("click", () => toggleDrawer(false));
    drawer.querySelector(".gh-stars-helper-close").addEventListener("click", () => toggleDrawer(false));
    elements.syncButton.addEventListener("click", () => content.api.syncNow("manual"));
    elements.optionsButton.addEventListener("click", () => openOptions());
    elements.helpButton.addEventListener("click", () => openHelpModal());
    if (elements.conflictKeepRemote) {
      elements.conflictKeepRemote.addEventListener("click", async () => {
        prepareAsyncButton(elements.conflictKeepRemote, t("conflictKeepRemote", null, "使用云端版本"));
        setAsyncButtonState(elements.conflictKeepRemote, {
          state: "pending",
          label: t("buttonStateApplying", null, "处理中...")
        });
        const ok = await content.api.resolveConflictDecision("keep_remote");
        if (!ok) {
          setAsyncButtonState(elements.conflictKeepRemote, {
            state: "error",
            label: t("buttonStateApplyFailed", null, "处理失败")
          });
          return;
        }
        showToast(t("statusAppliedRemote", null, "已应用远端版本"), {
          variant: "success"
        });
      });
    }
    if (elements.conflictKeepLocal) {
      elements.conflictKeepLocal.addEventListener("click", async () => {
        prepareAsyncButton(elements.conflictKeepLocal, t("conflictKeepLocal", null, "保留本机修改"));
        setAsyncButtonState(elements.conflictKeepLocal, {
          state: "pending",
          label: t("buttonStateApplying", null, "处理中...")
        });
        const ok = await content.api.resolveConflictDecision("keep_local");
        if (!ok) {
          setAsyncButtonState(elements.conflictKeepLocal, {
            state: "error",
            label: t("buttonStateApplyFailed", null, "处理失败")
          });
          return;
        }
        showToast(t("statusAppliedLocal", null, "已应用本地版本"), {
          variant: "success"
        });
      });
    }
    if (elements.conflictOpenGist) {
      elements.conflictOpenGist.addEventListener("click", () => openGistFromConfig());
    }
    elements.searchInput.addEventListener("input", (event) => {
      state.filter.query = event.target.value.trim();
      state.filter.tag = "";
      state.filter.groupId = "";
      renderAll();
    });
    elements.sortSelect.addEventListener("change", (event) => {
      state.filter.sort = event.target.value;
      renderAll();
    });
    bindInputClear(elements.searchInput, searchClear);
    if (treeQuickTopButton) {
      treeQuickTopButton.addEventListener("click", () => scrollGroupTreeToBoundary("top"));
    }
    if (treeQuickBottomButton) {
      treeQuickBottomButton.addEventListener("click", () => scrollGroupTreeToBoundary("bottom"));
    }
    if (treeQuickExpandButton) {
      treeQuickExpandButton.addEventListener("click", () => content.groups.expandAllGroups());
    }
    if (treeQuickCollapseButton) {
      treeQuickCollapseButton.addEventListener("click", () => content.groups.collapseAllGroups());
    }
    if (addGroupButton) {
      addGroupButton.addEventListener("click", () => content.groups.addGroup(null));
    }
  }

  /**
   * 切换侧边抽屉显示状态。
   */
  function toggleDrawer(open) {
    if (!elements.drawer || !elements.overlay) {
      ensureDrawer();
    }
    if (!elements.drawer || !elements.overlay) {
      return;
    }
    const shouldOpen = open === undefined ? !elements.drawer.classList.contains("open") : open;
    elements.drawer.classList.toggle("open", shouldOpen);
    elements.overlay.classList.toggle("open", shouldOpen);
    if (elements.manageButton) {
      elements.manageButton.classList.toggle("hidden", shouldOpen);
    }
    if (content.debug) {
      content.debug.log("drawer.toggle", {
        shouldOpen,
        hasManageButton: Boolean(elements.manageButton),
        manageButtonConnected: Boolean(elements.manageButton && elements.manageButton.isConnected)
      });
    }
    if (shouldOpen) {
      content.api.refreshState();
      void content.api.syncMeta({
        minIntervalMs: DRAWER_OPEN_META_SYNC_INTERVAL_MS,
        render: true,
        showDialogOnConflict: false
      });
    }
  }

  /**
   * 清理抽屉顶部的配置提示。
   */
  function clearOptionsHint() {
    if (elements.optionsHint) {
      elements.optionsHint.classList.remove("visible");
    }
  }

  /**
   * 显示配置提示，引导用户打开设置页面。
   */
  function showOptionsHint(url, message) {
    if (elements.optionsMessage) {
      elements.optionsMessage.textContent = message;
    }
    if (elements.optionsLink) {
      elements.optionsLink.href = url;
    }
    if (elements.optionsHint) {
      elements.optionsHint.classList.add("visible");
    }
  }

  /**
   * 弹出设置窗口并处理配置保存逻辑。
   */
  function openSettingsModal() {
    clearOptionsHint();
    const existing = document.querySelector(".gh-stars-helper-settings-overlay");
    if (existing) {
      existing.remove();
    }
    const overlay = document.createElement("div");
    overlay.className = "gh-stars-helper-modal-overlay gh-stars-helper-settings-overlay";
    overlay.innerHTML = `
      <div class="gh-stars-helper-modal gh-stars-helper-settings-modal">
        <h3>${t("modalSettingsTitle", null, "设置")}</h3>
        <details class="gh-stars-helper-setup-guide">
          <summary>${t("setupTitle", null, "初始化步骤")}</summary>
          <div class="gh-stars-helper-setup-content">
            <p><strong>${t("setupStep1Title", null, "1. 生成 PAT")}</strong></p>
            <p>
              ${t("setupStep1DescPrefix", null, "访问")}
              <a href="https://github.com/settings/tokens?type=classic" target="_blank" rel="noopener">
                ${t("setupStep1DescLink", null, "GitHub Token 设置")}
              </a>
              ${t("setupStep1DescSuffix", null, "，点击 Generate new token (classic)，勾选权限：")}
            </p>
            <ul>
              <li>${t("setupStep1ScopeGist", null, "<code>gist</code> 和 <code>read:user</code>（必需）")}</li>
              <li>${t("setupStep1ScopeRepo", null, "<code>repo</code>（同步私有仓库星标时需要）")}</li>
            </ul>
            <p><strong>${t("setupStep2Title", null, "2. 创建 Gist")}</strong></p>
            <p>
              ${t("setupStep2DescPrefix", null, "填写上面生成的 PAT，点击下方\"创建 Gist\"按钮自动创建；或手动访问")}
              <a href="https://gist.github.com/" target="_blank" rel="noopener">
                ${t("setupStep2DescLink", null, "Gist")}
              </a>
              ${t("setupStep2DescSuffix", null, "创建私有 Gist，文件名为")}
              ${t("setupStep2DescFile", null, "<code>stars-metadata.json</code>")}
            </p>
            <p><strong>${t("setupStep3Title", null, "3. 保存配置")}</strong></p>
            <p>${t("setupStep3Desc", null, "填写 PAT、Gist ID、Gist 文件名后，点击\"保存\"并\"测试 Token\"验证")}</p>
          </div>
        </details>
        <div class="gh-stars-helper-field">
          <label>${t("fieldPat", null, "PAT")}</label>
          <input class="gh-stars-helper-input gh-stars-helper-input-pat" type="password" placeholder="${t("placeholderPat", null, "ghp_xxx")}" />
        </div>
        <div class="gh-stars-helper-field">
          <label>${t("fieldGistId", null, "Gist ID")}</label>
          <input class="gh-stars-helper-input gh-stars-helper-input-gist-id" type="text" placeholder="${t("placeholderGistId", null, "请输入 Gist ID")}" />
        </div>
        <div class="gh-stars-helper-field">
          <label>${t("fieldGistFile", null, "Gist 文件名")}</label>
          <input class="gh-stars-helper-input gh-stars-helper-input-gist-file" type="text" placeholder="${t("placeholderGistFile", null, "stars-metadata.json")}" />
        </div>
        <div class="gh-stars-helper-field">
          <label>
            <input class="gh-stars-helper-input-debug-logging" type="checkbox" />
            ${t("fieldDebugLogging", null, "启用诊断日志")}
          </label>
        </div>
        <div class="gh-stars-helper-modal-actions gh-stars-helper-settings-actions">
          <button class="gh-stars-helper-save" type="button">${t("btnSave", null, "保存")}</button>
          <button class="gh-stars-helper-test" type="button">${t("btnTestToken", null, "测试 Token")}</button>
          <button class="gh-stars-helper-create" type="button">${t("btnCreateGist", null, "创建 Gist")}</button>
          <button class="gh-stars-helper-export-debug" type="button">${t("btnExportDebugLogs", null, "导出日志")}</button>
          <button class="gh-stars-helper-cancel" type="button">${t("btnClose", null, "关闭")}</button>
        </div>
        <div class="gh-stars-helper-settings-status" role="status"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    const statusEl = overlay.querySelector(".gh-stars-helper-settings-status");
    const patInput = overlay.querySelector(".gh-stars-helper-input-pat");
    const gistIdInput = overlay.querySelector(".gh-stars-helper-input-gist-id");
    const gistFileInput = overlay.querySelector(".gh-stars-helper-input-gist-file");
    const debugLoggingInput = overlay.querySelector(".gh-stars-helper-input-debug-logging");
    const saveButton = overlay.querySelector(".gh-stars-helper-save");
    const testButton = overlay.querySelector(".gh-stars-helper-test");
    const createButton = overlay.querySelector(".gh-stars-helper-create");
    const exportDebugButton = overlay.querySelector(".gh-stars-helper-export-debug");
    const cancelButton = overlay.querySelector(".gh-stars-helper-cancel");
    const defaultGistFile = shared.DEFAULT_GIST_FILE || "stars-metadata.json";

    prepareAsyncButton(saveButton, t("btnSave", null, "保存"));
    prepareAsyncButton(testButton, t("btnTestToken", null, "测试 Token"));
    prepareAsyncButton(createButton, t("btnCreateGist", null, "创建 Gist"));
    prepareAsyncButton(exportDebugButton, t("btnExportDebugLogs", null, "导出日志"));

    // 更新设置弹窗内的状态提示。
    const setLocalStatus = (message, isError) => {
      if (!statusEl) {
        return;
      }
      statusEl.textContent = message;
      statusEl.classList.toggle("error", Boolean(isError));
    };

    // 关闭设置弹窗并释放 DOM。
    const cleanup = () => {
      overlay.remove();
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        cleanup();
      }
    });
    if (cancelButton) {
      cancelButton.addEventListener("click", cleanup);
    }

    if (saveButton) {
      saveButton.addEventListener("click", async () => {
        setAsyncButtonState(saveButton, {
          state: "pending",
          label: t("buttonStateSaving", null, "保存中...")
        });
        const config = {
          pat: patInput.value.trim(),
          gistId: gistIdInput.value.trim(),
          gistFile: gistFileInput.value.trim() || defaultGistFile,
          debugLogging: Boolean(debugLoggingInput && debugLoggingInput.checked)
        };
        const res = await shared.sendMessage("save_config", { config });
        if (!res.ok) {
          setLocalStatus(res.error || t("statusSaveFailed", null, "保存失败。"), true);
          setAsyncButtonState(saveButton, {
            state: "error",
            label: t("buttonStateSaveFailed", null, "保存失败")
          });
          return;
        }
        if (content.debug) {
          content.debug.log("settings.save", {
            debugLogging: Boolean(config.debugLogging)
          });
        }
        setLocalStatus(t("statusSaved", null, "已保存。"));
        setAsyncButtonState(saveButton, {
          state: "success",
          label: t("buttonStateSaved", null, "已保存")
        });
        content.api.refreshState();
      });
    }

    if (testButton) {
      testButton.addEventListener("click", async () => {
        setAsyncButtonState(testButton, {
          state: "pending",
          label: t("buttonStateTestingToken", null, "测试中...")
        });
        const pat = patInput.value.trim();
        const res = await shared.sendMessage("test_token", { pat });
        if (!res.ok) {
          setLocalStatus(res.error || t("statusTokenTestFailed", null, "Token 测试失败。"), true);
          setAsyncButtonState(testButton, {
            state: "error",
            label: t("buttonStateTokenFailed", null, "测试失败")
          });
          return;
        }
        setLocalStatus(
          t("statusTokenOk", [res.login || ""], `Token 验证通过：${res.login || ""}`)
        );
        setAsyncButtonState(testButton, {
          state: "success",
          label: t("buttonStateTokenOk", null, "测试通过")
        });
      });
    }

    if (createButton) {
      createButton.addEventListener("click", async () => {
        setAsyncButtonState(createButton, {
          state: "pending",
          label: t("buttonStateCreatingGist", null, "创建中...")
        });
        const config = {
          pat: patInput.value.trim(),
          gistFile: gistFileInput.value.trim() || defaultGistFile
        };
        const res = await shared.sendMessage("create_gist", { config });
        if (!res.ok) {
          setLocalStatus(res.error || t("statusCreateGistFailed", null, "创建 Gist 失败。"), true);
          setAsyncButtonState(createButton, {
            state: "error",
            label: t("buttonStateGistFailed", null, "创建失败")
          });
          return;
        }
        gistIdInput.value = res.gistId;
        setLocalStatus(
          t("statusGistCreated", [res.gistId], `Gist 已创建：${res.gistId}`)
        );
        setAsyncButtonState(createButton, {
          state: "success",
          label: t("buttonStateGistCreated", null, "已创建")
        });
        content.api.refreshState();
      });
    }

    if (exportDebugButton) {
      exportDebugButton.addEventListener("click", async () => {
        setAsyncButtonState(exportDebugButton, {
          state: "pending",
          label: t("buttonStateExportingDebug", null, "导出中...")
        });
        const result = await content.debug.getLogs();
        if (!result.ok) {
          setLocalStatus(result.error || t("statusExportDebugFailed", null, "导出日志失败。"), true);
          setAsyncButtonState(exportDebugButton, {
            state: "error",
            label: t("buttonStateExportDebugFailed", null, "导出失败")
          });
          return;
        }
        const exportedAt = new Date();
        const timestamp = exportedAt.toISOString().replace(/[:.]/g, "-");
        const payload = {
          exportedAt: exportedAt.toISOString(),
          userAgent: navigator.userAgent,
          pageUrl: window.location.href,
          enabled: Boolean(result.enabled),
          count: Array.isArray(result.logs) ? result.logs.length : 0,
          logs: Array.isArray(result.logs) ? result.logs : []
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json;charset=utf-8"
        });
        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = `${SETTINGS_LOG_EXPORT_PREFIX}-${timestamp}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(downloadUrl);
        if (content.debug) {
          content.debug.log("settings.export_debug", {
            count: payload.count
          });
        }
        setLocalStatus(
          t(
            "statusExportDebugOk",
            [String(payload.count)],
            `已导出 ${payload.count} 条日志。`
          )
        );
        setAsyncButtonState(exportDebugButton, {
          state: "success",
          label: t("buttonStateExportDebugOk", null, "已导出")
        });
      });
    }

    (async () => {
      const res = await shared.sendMessage("get_config");
      if (!res.ok) {
        setLocalStatus(res.error || t("statusLoadConfigFailed", null, "加载配置失败。"), true);
        return;
      }
      const config = res.config || {};
      patInput.value = config.pat || "";
      gistIdInput.value = config.gistId || "";
      gistFileInput.value = config.gistFile || defaultGistFile;
      if (debugLoggingInput) {
        debugLoggingInput.checked = Boolean(config.debugLogging);
      }
    })();
  }

  /**
   * 打开设置入口，便于后续扩展。
   */
  function openOptions() {
    openSettingsModal();
  }

  /**
   * 打开使用帮助说明。
   */
  function openHelpModal() {
    const existing = document.querySelector(".gh-stars-helper-help-overlay");
    if (existing) {
      existing.remove();
    }
    const overlay = document.createElement("div");
    overlay.className = "gh-stars-helper-modal-overlay gh-stars-helper-help-overlay";
    overlay.innerHTML = `
      <div class="gh-stars-helper-modal gh-stars-helper-settings-modal">
        <h3>${t("modalHelpTitle", null, "使用帮助")}</h3>
        <div class="gh-stars-helper-setup-content">
          <p><strong>${t("helpBasicsTitle", null, "基本功能")}</strong></p>
          <p>${t("helpBasicsDesc", null, "管理 GitHub 星标仓库，支持分组、标签、备注，通过 Gist 在多设备间同步。")}</p>

          <p><strong>${t("helpGroupsTitle", null, "分组管理")}</strong></p>
          <ul>
            <li>${t("helpGroupsItem1", null, "点击分组名称即可过滤星标列表")}</li>
            <li>${t("helpGroupsItem2", null, "支持拖拽分组调整层级")}</li>
            <li>${t("helpGroupsItem3", null, "点击分组操作按钮可新增、重命名或删除")}</li>
          </ul>

          <p><strong>${t("helpReposTitle", null, "仓库管理")}</strong></p>
          <ul>
            <li>${t("helpReposItem1", null, "在列表中点击编辑按钮可管理分组、标签和备注")}</li>
            <li>${t("helpReposItem2", null, "在仓库详情页可快速编辑当前仓库信息")}</li>
            <li>${t("helpReposItem3", null, "如果未 Star 会自动 Star 并打开编辑器")}</li>
          </ul>

          <p><strong>${t("helpSyncTitle", null, "同步")}</strong></p>
          <ul>
            <li>${t("helpSyncItem1", null, "点击同步按钮手动拉取最新星标与元数据")}</li>
            <li>${t("helpSyncItem2", null, "检测到冲突时可选择保留本机修改或使用云端版本")}</li>
          </ul>
        </div>
        <div class="gh-stars-helper-modal-actions">
          <button class="gh-stars-helper-cancel" type="button">${t("btnClose", null, "关闭")}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector(".gh-stars-helper-cancel").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  /**
   * 打开配置中的 Gist 页面。
   */
  function openGistFromConfig() {
    const gistId = state.config && state.config.gistId ? state.config.gistId : "";
    if (gistId) {
      window.open(`https://gist.github.com/${gistId}`, "_blank", "noopener");
    }
  }

  /**
   * 将冲突时间格式化为简短可读文本，避免在抽屉里塞入过长 ISO 字符串。
   */
  function formatConflictTime(value) {
    if (!value || typeof value !== "string") {
      return t("conflictTimeUnknown", null, "未知");
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return t("conflictTimeUnknown", null, "未知");
    }
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${month}-${day} ${hours}:${minutes}`;
  }

  /**
   * 汇总冲突双方的关键信息，帮助用户快速判断该保留本机还是云端。
   */
  function getConflictSummary() {
    const conflict = state.conflict && typeof state.conflict === "object" ? state.conflict : null;
    const remoteMeta = conflict && conflict.remoteMeta && typeof conflict.remoteMeta === "object"
      ? conflict.remoteMeta
      : {};
    const recentPendingRepos = Array.isArray(state.recentPendingRepos) ? state.recentPendingRepos : [];
    const localRevision = Number.isFinite(state.meta && state.meta.revision) ? String(state.meta.revision) : "-";
    const remoteRevision = Number.isFinite(remoteMeta.revision) ? String(remoteMeta.revision) : "-";
    const pendingCount = Number.isFinite(state.pendingOpsCount) ? String(state.pendingOpsCount) : "0";
    const localUpdatedAt = formatConflictTime(state.meta && state.meta.updated_at);
    const remoteUpdatedAt = formatConflictTime(remoteMeta.updated_at);
    return {
      desc: t("conflictDesc", null, "本机有未同步修改，同时云端版本也变化了。"),
      localLine: t(
        "conflictSummaryLocal",
        [localRevision, pendingCount, localUpdatedAt],
        `本机：修订 ${localRevision}，待同步 ${pendingCount} 项，最近修改 ${localUpdatedAt}`
      ),
      cloudLine: t(
        "conflictSummaryCloud",
        [remoteRevision, remoteUpdatedAt],
        `云端：修订 ${remoteRevision}，最近修改 ${remoteUpdatedAt}`
      ),
      recentReposLine: recentPendingRepos.length > 0
        ? t(
          "conflictRecentPendingRepos",
          [recentPendingRepos.join("、")],
          `本机最近修改仓库：${recentPendingRepos.join("、")}`
        )
        : "",
      hint: Number(pendingCount) > 0
        ? t(
          "conflictHintPending",
          null,
          "如果刚刚在这台设备上改过分组、标签或备注且还没同步，选“保留本机修改”；如果想以 Gist 最新内容为准，选“使用云端版本”。"
        )
        : t(
          "conflictHintNoPending",
          null,
          "这台设备当前没有明显的待同步修改；如果不确定，通常优先选“使用云端版本”。"
        )
    };
  }

  /**
   * 将冲突摘要同步到抽屉提示区，保证用户不点弹窗也能理解两边差异。
   */
  function renderConflictInfo() {
    const hasConflict = Boolean(state.conflict);
    if (elements.conflictBox) {
      elements.conflictBox.classList.toggle("visible", hasConflict);
    }
    if (!hasConflict) {
      return;
    }
    const summary = getConflictSummary();
    if (elements.conflictDesc) {
      elements.conflictDesc.textContent = summary.desc;
    }
    if (elements.conflictLocalLine) {
      elements.conflictLocalLine.textContent = summary.localLine;
    }
    if (elements.conflictCloudLine) {
      elements.conflictCloudLine.textContent = summary.cloudLine;
    }
    if (elements.conflictRecentRepos) {
      elements.conflictRecentRepos.textContent = summary.recentReposLine || "";
      elements.conflictRecentRepos.style.display = summary.recentReposLine ? "" : "none";
    }
    if (elements.conflictHint) {
      elements.conflictHint.textContent = summary.hint;
    }
  }

  /**
   * 显示冲突处理对话框。
   */
  function showConflictDialog() {
    if (!elements.drawer) {
      return;
    }
    const existing = document.querySelector(".gh-stars-helper-conflict-overlay");
    if (existing) {
      existing.remove();
    }
    const summary = getConflictSummary();
    const overlay = document.createElement("div");
    overlay.className = "gh-stars-helper-modal-overlay gh-stars-helper-conflict-overlay";

    const modal = document.createElement("div");
    modal.className = "gh-stars-helper-modal";

    const title = document.createElement("h3");
    title.textContent = t("conflictTitle", null, "检测到同步冲突");

    const desc = document.createElement("p");
    desc.textContent = summary.desc;

    const localLine = document.createElement("p");
    localLine.textContent = summary.localLine;

    const cloudLine = document.createElement("p");
    cloudLine.textContent = summary.cloudLine;

    const recentReposLine = document.createElement("p");
    recentReposLine.textContent = summary.recentReposLine;

    const hint = document.createElement("p");
    hint.textContent = summary.hint;

    const actions = document.createElement("div");
    actions.className = "gh-stars-helper-modal-actions";

    const keepRemoteButton = document.createElement("button");
    keepRemoteButton.className = "gh-stars-helper-keep-remote";
    keepRemoteButton.type = "button";
    keepRemoteButton.textContent = t("conflictKeepRemote", null, "使用云端版本");

    const keepLocalButton = document.createElement("button");
    keepLocalButton.className = "gh-stars-helper-keep-local";
    keepLocalButton.type = "button";
    keepLocalButton.textContent = t("conflictKeepLocal", null, "保留本机修改");

    const openGistButton = document.createElement("button");
    openGistButton.className = "gh-stars-helper-open-gist";
    openGistButton.type = "button";
    openGistButton.textContent = t("conflictOpenGist", null, "打开 Gist");

    const cancelButton = document.createElement("button");
    cancelButton.className = "gh-stars-helper-cancel";
    cancelButton.type = "button";
    cancelButton.textContent = t("btnCancel", null, "取消");

    actions.appendChild(keepRemoteButton);
    actions.appendChild(keepLocalButton);
    actions.appendChild(openGistButton);
    actions.appendChild(cancelButton);

    modal.appendChild(title);
    modal.appendChild(desc);
    modal.appendChild(localLine);
    modal.appendChild(cloudLine);
    if (summary.recentReposLine) {
      modal.appendChild(recentReposLine);
    }
    modal.appendChild(hint);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 关闭冲突弹窗并恢复页面交互。
    const cleanup = () => {
      overlay.remove();
    };

    prepareAsyncButton(keepRemoteButton, t("conflictKeepRemote", null, "使用云端版本"));
    prepareAsyncButton(keepLocalButton, t("conflictKeepLocal", null, "保留本机修改"));

    cancelButton.addEventListener("click", cleanup);
    keepRemoteButton.addEventListener("click", async () => {
      setAsyncButtonState(keepRemoteButton, {
        state: "pending",
        label: t("buttonStateApplying", null, "处理中...")
      });
      const ok = await content.api.resolveConflictDecision("keep_remote");
      if (!ok) {
        setAsyncButtonState(keepRemoteButton, {
          state: "error",
          label: t("buttonStateApplyFailed", null, "处理失败")
        });
        return;
      }
      showToast(t("statusAppliedRemote", null, "已应用远端版本"), {
        variant: "success"
      });
      cleanup();
    });
    keepLocalButton.addEventListener("click", async () => {
      setAsyncButtonState(keepLocalButton, {
        state: "pending",
        label: t("buttonStateApplying", null, "处理中...")
      });
      const ok = await content.api.resolveConflictDecision("keep_local");
      if (!ok) {
        setAsyncButtonState(keepLocalButton, {
          state: "error",
          label: t("buttonStateApplyFailed", null, "处理失败")
        });
        return;
      }
      showToast(t("statusAppliedLocal", null, "已应用本地版本"), {
        variant: "success"
      });
      cleanup();
    });
    openGistButton.addEventListener("click", () => {
      openGistFromConfig();
      cleanup();
    });
  }

  /**
   * 更新抽屉状态文本。
   */
  function setStatus(message, isError) {
    if (!elements.statusText) {
      return;
    }
    elements.statusText.textContent = message;
    elements.statusText.classList.toggle("error", Boolean(isError));
  }

  /**
   * 渲染同步状态、错误提示与待同步数量。
   */
  function renderStatus() {
    if (!elements.statusText || !elements.pendingText) {
      return;
    }
    const status = state.syncStatus || { state: "idle", message: "" };
    let text = "";
    if (status.state === "syncing") {
      text = status.message || t("statusSyncing", null, "同步中...");
      if (elements.syncButton) {
        setAsyncButtonState(elements.syncButton, {
          state: "pending",
          label: t("buttonStateSyncing", null, "同步中...")
        });
      }
      elements.statusText.classList.add("syncing");
    } else {
      if (elements.syncButton && getAsyncButtonState(elements.syncButton) === "pending") {
        resetAsyncButtonState(elements.syncButton);
      }
      elements.statusText.classList.remove("syncing");
    }
    if (status.state === "error") {
      const errorLabel = t("statusErrorPrefix", null, "错误: ");
      text = `${errorLabel}${status.message || t("errorSyncFailed", null, "同步失败")}`;
      if (elements.syncButton) {
        setAsyncButtonState(elements.syncButton, {
          state: "error",
          label: t("buttonStateSyncFailed", null, "同步失败")
        });
      }
    } else if (status.state === "conflict") {
      text = t("statusConflictPrompt", null, "检测到同步冲突：请在侧边栏选择保留本机或云端。");
    } else if (!state.config || !state.config.hasPat || !state.config.gistId) {
      text = t("statusNeedConfig", null, "需要配置");
    } else if (status.state !== "syncing") {
      text = status.message || t("statusSynced", null, "已同步");
      if (status.updated_at) {
        const lastSync = new Date(status.updated_at);
        const now = new Date();
        const diffMs = now - lastSync;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) {
          text += ` (${t("statusJustNow", null, "刚刚")})`;
        } else if (diffMins < 60) {
          text += ` (${t("statusMinutesAgo", [diffMins], `${diffMins}分钟前`)})`;
        } else {
          const diffHours = Math.floor(diffMins / 60);
          text += ` (${t("statusHoursAgo", [diffHours], `${diffHours}小时前`)})`;
        }
      }
    }
    if (state.pendingOpsCount > 0) {
      elements.pendingText.textContent = t(
        "statusPendingOps",
        [state.pendingOpsCount],
        `待同步: ${state.pendingOpsCount}`
      );
    } else {
      elements.pendingText.textContent = "";
    }
    renderConflictInfo();
    elements.statusText.textContent = text;
  }

  /**
   * 渲染统计信息。
   */
  function renderStats() {
    if (!elements.starsCount || !elements.groupsCount) {
      return;
    }
    const starsCount = Object.keys(state.stars?.items || {}).length;
    const groupsCount = (state.meta?.groups || []).length;
    elements.starsCount.textContent = starsCount;
    elements.groupsCount.textContent = groupsCount;
  }

  /**
   * 执行全量 UI 刷新。
   */
  function renderAll() {
    const hasSearchQuery = Boolean((state.filter.query || "").trim());
    if (elements.sectionTitle) {
      elements.sectionTitle.textContent = hasSearchQuery
        ? t("sectionResults", null, "结果")
        : t("sectionGroups", null, "分组");
    }
    if (elements.sectionActions) {
      elements.sectionActions.style.display = hasSearchQuery ? "none" : "";
    }
    renderStats();
    renderStatus();
    content.groups.renderGroupTree();
    content.page.updatePageEntries();
  }

  /**
   * 使用 DOM 构建输入弹窗，避免字符串插值引入注入风险。
   */
  function showInputModal(title, defaultValue, callback, options) {
    const config = options && typeof options === "object" ? options : {};
    const inputOverlay = document.createElement("div");
    inputOverlay.className = "gh-stars-helper-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "gh-stars-helper-modal";

    const header = document.createElement("h3");
    header.textContent = title;

    const field = document.createElement("div");
    field.className = "gh-stars-helper-field";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "gh-stars-helper-input";
    input.placeholder = t("inputPlaceholderName", null, "输入名称");
    input.value = defaultValue || "";

    field.appendChild(input);

    const actions = document.createElement("div");
    actions.className = "gh-stars-helper-modal-actions";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "gh-stars-helper-modal-confirm";
    confirmBtn.textContent = t("btnConfirm", null, "确定");

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "gh-stars-helper-modal-cancel";
    cancelBtn.textContent = t("btnCancel", null, "取消");

    const messageEl = document.createElement("div");
    messageEl.className = "gh-stars-helper-modal-message";
    messageEl.setAttribute("role", "status");
    messageEl.setAttribute("aria-live", "polite");
    actions.appendChild(messageEl);
    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);

    modal.appendChild(header);
    modal.appendChild(field);
    modal.appendChild(actions);
    inputOverlay.appendChild(modal);

    prepareAsyncButton(confirmBtn, config.confirmText || t("btnConfirm", null, "确定"));
    let isSubmitting = false;
    const setModalMessage = (message, stateName) => {
      if (!messageEl) {
        return;
      }
      messageEl.textContent = message || "";
      messageEl.dataset.state = stateName || "";
    };

    const handleConfirm = async () => {
      const value = input.value.trim();
      if (!value || isSubmitting) {
        return;
      }
      isSubmitting = true;
      setModalMessage("", "");
      setAsyncButtonState(confirmBtn, {
        state: "pending",
        label: config.pendingLabel || t("buttonStateApplying", null, "处理中..."),
        autoResetMs: 0
      });
      cancelBtn.disabled = true;
      input.disabled = true;
      let result;
      try {
        result = await Promise.resolve(callback(value));
      } catch (error) {
        result = {
          ok: false,
          message: error instanceof Error ? error.message : String(error || "")
        };
      }
      const failed = result === false || (result && typeof result === "object" && result.ok === false);
      if (failed) {
        isSubmitting = false;
        setAsyncButtonState(confirmBtn, {
          state: "error",
          label: config.errorLabel || t("buttonStateApplyFailed", null, "处理失败"),
          autoResetMs: 0
        });
        cancelBtn.disabled = false;
        input.disabled = false;
        setModalMessage(
          (result && typeof result === "object" && result.message)
            || config.errorMessage
            || t("errorUpdateFailed", null, "更新失败。"),
          "error"
        );
        input.focus();
        input.select();
        return;
      }
      inputOverlay.remove();
    };
    const handleCancel = () => {
      if (isSubmitting) {
        return;
      }
      inputOverlay.remove();
    };
    confirmBtn.addEventListener("click", () => {
      void handleConfirm();
    });
    cancelBtn.addEventListener("click", handleCancel);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleConfirm();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    });
    inputOverlay.addEventListener("click", (e) => {
      if (e.target === inputOverlay) {
        handleCancel();
      }
    });
    document.body.appendChild(inputOverlay);
    input.focus();
    input.select();
  }

  /**
   * 显示确认弹窗，统一侧边抽屉内的危险操作提示样式。
   */
  function showConfirmModal(title, message, onConfirm, options) {
    const config = options && typeof options === "object" ? options : {};
    const confirmText = config.confirmText || t("btnConfirm", null, "确定");
    const cancelText = config.cancelText || t("btnCancel", null, "取消");
    const singleAction = Boolean(config.singleAction);
    const overlay = document.createElement("div");
    overlay.className = "gh-stars-helper-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "gh-stars-helper-modal";

    const header = document.createElement("h3");
    header.textContent = title;

    const description = document.createElement("p");
    description.textContent = message;

    const actions = document.createElement("div");
    actions.className = "gh-stars-helper-modal-actions";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "gh-stars-helper-modal-confirm";
    confirmBtn.textContent = confirmText;

    actions.appendChild(confirmBtn);
    let cancelBtn = null;
    if (!singleAction) {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "gh-stars-helper-modal-cancel";
      cancelBtn.textContent = cancelText;
      actions.appendChild(cancelBtn);
    }

    modal.appendChild(header);
    modal.appendChild(description);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    const cleanup = () => {
      overlay.remove();
    };
    confirmBtn.addEventListener("click", async () => {
      try {
        await Promise.resolve(onConfirm && onConfirm());
      } finally {
        cleanup();
      }
    });
    if (cancelBtn) {
      cancelBtn.addEventListener("click", cleanup);
    }
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        cleanup();
      }
    });
    document.body.appendChild(overlay);
  }

  /**
   * 显示单按钮提示弹窗，替代移动端不稳定的原生 alert。
   */
  function showNoticeModal(title, message, options) {
    const config = options && typeof options === "object" ? options : {};
    showConfirmModal(title, message, null, {
      ...config,
      singleAction: true,
      confirmText: config.confirmText || t("btnGotIt", null, "知道了")
    });
  }

  content.ui = {
    ensureManageButton,
    ensureDrawer,
    toggleDrawer,
    clearOptionsHint,
    showOptionsHint,
    openSettingsModal,
    openOptions,
    openHelpModal,
    openGistFromConfig,
    showConflictDialog,
    prepareAsyncButton,
    getAsyncButtonState,
    setAsyncButtonState,
    resetAsyncButtonState,
    showToast,
    setStatus,
    renderStatus,
    renderStats,
    renderAll,
    showInputModal,
    showConfirmModal,
    showNoticeModal
  };
})();
