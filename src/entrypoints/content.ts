import "../content.css";
import "../shared/constants.js";
import "../shared/i18n.js";
import "../shared/messaging.js";
import "../content/context.js";
import "../content/utils.js";
import "../content/icon-anim.js";
import "../content/storage.js";
import "../content/api.js";
import "../content/groups.js";
import "../content/repo.js";
import "../content/page.js";
import "../content/ui.js";
import "../content/app.js";
import "../content-init.js";

export default defineContentScript({
  matches: ["https://github.com/*"],
  main() {
    // 入口逻辑由 content-init.js 的 IIFE 负责。
  }
});
