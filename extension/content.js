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
})();
