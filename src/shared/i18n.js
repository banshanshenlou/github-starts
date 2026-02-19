(() => {
  "use strict";

  const root = globalThis.GhStarsHelper || (globalThis.GhStarsHelper = {});
  root.shared = root.shared || {};
  const shared = root.shared;

  /**
   * 获取 i18n API，优先使用标准 browser 命名空间。
   */
  function getI18nApi() {
    if (typeof browser !== "undefined" && browser.i18n) {
      return browser.i18n;
    }
    if (typeof chrome !== "undefined" && chrome.i18n) {
      return chrome.i18n;
    }
    return null;
  }

  /**
   * 统一获取多语言文本，缺失时回退到默认值。
   */
  shared.t = function t(key, substitutions, fallback) {
    const i18n = getI18nApi();
    if (i18n && typeof i18n.getMessage === "function") {
      const message = i18n.getMessage(key, substitutions);
      if (message) {
        return message;
      }
    }
    if (typeof fallback === "string" && fallback.length > 0) {
      return fallback;
    }
    return key;
  };

  /**
   * 批量应用 data-i18n 属性，覆盖文本与常用属性。
   */
  shared.applyI18n = function applyI18n(rootEl) {
    if (typeof document === "undefined") {
      return;
    }
    const scope = rootEl || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) {
        return;
      }
      el.textContent = shared.t(key, null, el.textContent);
    });
    scope.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (!key) {
        return;
      }
      el.innerHTML = shared.t(key, null, el.innerHTML);
    });
    const attrKeys = [
      { attr: "placeholder", data: "data-i18n-placeholder" },
      { attr: "title", data: "data-i18n-title" },
      { attr: "aria-label", data: "data-i18n-aria-label" }
    ];
    attrKeys.forEach(({ attr, data }) => {
      scope.querySelectorAll(`[${data}]`).forEach((el) => {
        const key = el.getAttribute(data);
        if (!key) {
          return;
        }
        const fallback = el.getAttribute(attr) || "";
        el.setAttribute(attr, shared.t(key, null, fallback));
      });
    });
    const i18n = getI18nApi();
    if (document.documentElement && i18n && typeof i18n.getUILanguage === "function") {
      document.documentElement.lang = i18n.getUILanguage();
    }
  };
})();
