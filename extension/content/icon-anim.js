(() => {
  "use strict";

  const root = globalThis.GhStarsHelper;
  const content = root.content;

  const SETTINGS_ICON_STATIC_SRC = "assets/lordicon/system-regular-63-settings-cog-hover-cog-1.svg";
  const SETTINGS_ICON_ANIMATION_MS = 950;
  let hasConsumedIntroAnimation = false;

  /**
   * 将相对资源路径转换为扩展内可访问路径，避免依赖外网。
   */
  function getAssetUrl(relativePath) {
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      typeof chrome.runtime.getURL === "function"
    ) {
      return chrome.runtime.getURL(relativePath);
    }
    return relativePath;
  }

  /**
   * 当前页面生命周期内仅首个图标触发一次开场动画，避免重复干扰阅读。
   */
  function shouldPlayIntroAnimation() {
    if (hasConsumedIntroAnimation) {
      return false;
    }
    hasConsumedIntroAnimation = true;
    return true;
  }

  /**
   * 创建设置图标容器，始终使用透明背景 SVG，动画交由 CSS 执行。
   */
  function createSettingsIconContainer() {
    const wrapper = document.createElement("span");
    wrapper.className = "gh-stars-helper-settings-icon";
    wrapper.dataset.ghStarsHelperAnimating = "0";

    const image = document.createElement("img");
    image.className = "gh-stars-helper-settings-icon-image";
    image.alt = "";
    image.decoding = "async";
    image.src = getAssetUrl(SETTINGS_ICON_STATIC_SRC);
    wrapper.appendChild(image);

    return wrapper;
  }

  /**
   * 通过切换 class 触发一次旋转动画，避免换图造成白底闪烁。
   */
  function playSettingsIconAnimation(wrapper) {
    if (!wrapper || wrapper.dataset.ghStarsHelperAnimating === "1") {
      return;
    }
    wrapper.dataset.ghStarsHelperAnimating = "1";
    wrapper.classList.remove("is-animating");
    void wrapper.offsetWidth;
    wrapper.classList.add("is-animating");

    window.setTimeout(() => {
      if (!wrapper.isConnected) {
        return;
      }
      wrapper.classList.remove("is-animating");
      wrapper.dataset.ghStarsHelperAnimating = "0";
    }, SETTINGS_ICON_ANIMATION_MS);
  }

  /**
   * 将操作按钮替换为离线动态图标，兼顾首屏惊艳感与悬停反馈。
   */
  function decorateActionButtonWithSettingsIcon(button, labelText) {
    if (!button || button.dataset.ghStarsHelperIconized === "1") {
      return;
    }
    const normalizedLabel = (labelText || button.textContent || "").trim() || "编辑";
    const playIntro = shouldPlayIntroAnimation();
    const icon = createSettingsIconContainer();

    button.dataset.ghStarsHelperIconized = "1";
    button.classList.add("gh-stars-helper-icon-button");
    button.setAttribute("aria-label", normalizedLabel);
    button.title = normalizedLabel;
    button.textContent = "";

    const srOnlyText = document.createElement("span");
    srOnlyText.className = "gh-stars-helper-sr-only";
    srOnlyText.textContent = normalizedLabel;

    button.appendChild(icon);
    button.appendChild(srOnlyText);

    button.addEventListener("mouseenter", () => {
      playSettingsIconAnimation(icon);
    });
    button.addEventListener("focus", () => {
      playSettingsIconAnimation(icon);
    });

    if (playIntro) {
      window.setTimeout(() => {
        if (!button.isConnected) {
          return;
        }
        playSettingsIconAnimation(icon);
      }, 100);
    }
  }

  const originalUtils = content.utils || {};
  content.utils = {
    ...originalUtils,
    decorateActionButtonWithSettingsIcon
  };
})();
