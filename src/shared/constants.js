(() => {
  "use strict";

  const root = globalThis.GhStarsHelper || (globalThis.GhStarsHelper = {});
  root.shared = root.shared || {};
  const shared = root.shared;

  // 共享常量用于保持背景页、内容脚本与设置页的规则一致。
  shared.DEFAULT_GIST_FILE = "stars-metadata.json";
  shared.MAX_GROUP_DEPTH = 5;
})();
