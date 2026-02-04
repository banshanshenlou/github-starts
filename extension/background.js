"use strict";

// 按模块拆分后台逻辑，保持服务工作线程入口简洁。
importScripts(
  "shared/constants.js",
  "shared/i18n.js",
  "background/constants.js",
  "background/utils.js",
  "background/meta.js",
  "background/github.js",
  "background/state.js",
  "background/sync.js",
  "background/handlers.js"
);

globalThis.GhStarsHelperBackground.handlers.registerBackgroundHandlers();
