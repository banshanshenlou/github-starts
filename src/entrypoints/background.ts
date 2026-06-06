import "../shared/constants.js";
import "../shared/i18n.js";
import "../background/constants.js";
import "../background/utils.js";
import "../background/meta.js";
import "../background/github.js";
import "../background/state.js";
import "../background/debug.js";
import "../background/sync.js";
import "../background/handlers.js";

export default defineBackground(() => {
  const typedGlobal = globalThis as typeof globalThis & {
    GhStarsHelperBackground?: {
      handlers?: {
        registerBackgroundHandlers?: () => void;
      };
    };
  };
  const backgroundRoot = typedGlobal.GhStarsHelperBackground as {
    handlers?: {
      registerBackgroundHandlers?: () => void;
    };
  } | undefined;
  const register = backgroundRoot?.handlers?.registerBackgroundHandlers;
  if (typeof register !== "function") {
    console.error("[github-stars-manager] 后台初始化失败：未找到注册函数");
    return;
  }
  register();
});
