import "../shared/constants.js";
import "../shared/i18n.js";
import "../background/constants.js";
import "../background/utils.js";
import "../background/meta.js";
import "../background/github.js";
import "../background/state.js";
import "../background/sync.js";
import "../background/handlers.js";

export default defineBackground(() => {
  const register = globalThis.GhStarsHelperBackground?.handlers?.registerBackgroundHandlers;
  if (typeof register !== "function") {
    console.error("[github-stars-manager] 后台初始化失败：未找到注册函数");
    return;
  }
  register();
});
