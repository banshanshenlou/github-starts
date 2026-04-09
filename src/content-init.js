(() => {
  "use strict";

  if (window.__ghStarsHelperInitialized) {
    return;
  }
  window.__ghStarsHelperInitialized = true;

  const app = globalThis.GhStarsHelper && globalThis.GhStarsHelper.content
    ? globalThis.GhStarsHelper.content.app
    : null;
  if (!app) {
    return;
  }

  const init = () => app.init();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  document.addEventListener("turbo:load", init);
  window.addEventListener("pageshow", (event) => {
    const debug = globalThis.GhStarsHelper
      && globalThis.GhStarsHelper.content
      && globalThis.GhStarsHelper.content.debug;
    if (debug && typeof debug.log === "function") {
      debug.log("page.pageshow", {
        persisted: Boolean(event.persisted),
        readyState: document.readyState
      });
    }
    // BFCache 恢复时不会重新执行内容脚本初始化，这里补一次幂等 init 以重建丢失的 UI。
    init();
  });
})();
