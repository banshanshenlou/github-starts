import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  manifest: {
    name: "__MSG_extensionName__",
    description: "__MSG_extensionDescription__",
    version: "0.1.11",
    default_locale: "zh_CN",
    permissions: ["storage", "alarms"],
    host_permissions: ["https://github.com/*", "https://api.github.com/*"],
    web_accessible_resources: [
      {
        resources: [
          "assets/lordicon/system-regular-63-settings-cog-hover-cog-1.svg",
          "assets/branding/logo.png",
          "assets/branding/logo-dark.png"
        ],
        matches: ["https://github.com/*"]
      }
    ]
  }
});
