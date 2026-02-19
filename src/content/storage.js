(() => {
  "use strict";

  const root = globalThis.GhStarsHelper;
  const content = root.content;
  const { constants, runtime } = content;

  /**
   * 获取 local storage API，兼容 browser/chrome 两种命名空间。
   */
  function getLocalStorageApi() {
    if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
      return browser.storage.local;
    }
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    return null;
  }

  /**
   * 读取悬浮按钮位置，支持恢复用户拖拽后的布局。
   */
  async function loadManageButtonPosition() {
    const storage = getLocalStorageApi();
    const key = constants.STORAGE_KEYS.manageButtonPosition;
    if (!storage || typeof storage.get !== "function") {
      return null;
    }

    try {
      const data = await storage.get([key]);
      return data && Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    } catch {
      return new Promise((resolve) => {
        try {
          storage.get([key], (data) => {
            resolve(data && Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null);
          });
        } catch {
          resolve(null);
        }
      });
    }
  }

  /**
   * 保存悬浮按钮位置，跨会话保持用户偏好。
   */
  async function saveManageButtonPosition(position) {
    const storage = getLocalStorageApi();
    if (!storage || typeof storage.set !== "function") {
      return;
    }
    const payload = { [constants.STORAGE_KEYS.manageButtonPosition]: position };
    try {
      await storage.set(payload);
      return;
    } catch {
      // 回退 callback 风格，兼容旧实现。
    }
    try {
      storage.set(payload, () => {});
    } catch {
      // 忽略持久化失败，避免影响主流程交互。
    }
  }

  /**
   * 根据窗口边界修正按钮位置，避免拖出可视区域。
   */
  function setManageButtonPosition(button, left, top) {
    const rect = button.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);
    const nextLeft = Math.min(Math.max(0, left), maxLeft);
    const nextTop = Math.min(Math.max(0, top), maxTop);
    button.style.left = `${Math.round(nextLeft)}px`;
    button.style.top = `${Math.round(nextTop)}px`;
    button.style.right = "auto";
    button.style.bottom = "auto";
  }

  /**
   * 恢复默认悬浮按钮位置，用于首次安装或缺省数据。
   */
  function setDefaultManageButtonPosition(button) {
    button.style.left = "auto";
    button.style.bottom = "auto";
    button.style.top = "16px";
    button.style.right = "16px";
  }

  /**
   * 应用已保存的位置，否则回退到默认布局。
   */
  async function applyManageButtonPosition(button) {
    const position = await loadManageButtonPosition();
    if (position && Number.isFinite(position.left) && Number.isFinite(position.top)) {
      setManageButtonPosition(button, position.left, position.top);
    } else {
      setDefaultManageButtonPosition(button);
    }
  }

  /**
   * 启用按钮拖拽交互，并在拖拽结束时持久化位置。
   */
  function setupManageButtonDrag(button) {
    let dragState = null;
    const startDrag = (event) => {
      if (event.button !== 0) {
        return;
      }
      const rect = button.getBoundingClientRect();
      dragState = {
        startX: event.clientX,
        startY: event.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        moved: false
      };
      button.setPointerCapture(event.pointerId);
      event.preventDefault();
    };

    const onMove = (event) => {
      if (!dragState) {
        return;
      }
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      if (!dragState.moved && Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) {
        return;
      }
      dragState.moved = true;
      button.classList.add("dragging");
      setManageButtonPosition(button, dragState.startLeft + deltaX, dragState.startTop + deltaY);
    };

    const endDrag = () => {
      if (!dragState) {
        return;
      }
      if (dragState.moved) {
        const rect = button.getBoundingClientRect();
        saveManageButtonPosition({ left: rect.left, top: rect.top });
        runtime.suppressManageButtonClick = true;
        window.setTimeout(() => {
          runtime.suppressManageButtonClick = false;
        }, 200);
      }
      button.classList.remove("dragging");
      dragState = null;
    };

    button.addEventListener("pointerdown", startDrag);
    button.addEventListener("pointermove", onMove);
    button.addEventListener("pointerup", endDrag);
    button.addEventListener("pointercancel", endDrag);
  }

  content.storage = {
    loadManageButtonPosition,
    saveManageButtonPosition,
    setManageButtonPosition,
    setDefaultManageButtonPosition,
    applyManageButtonPosition,
    setupManageButtonDrag
  };
})();
