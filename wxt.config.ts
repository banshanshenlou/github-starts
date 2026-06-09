import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  manifest: {
    name: "__MSG_extensionName__",
    description: "__MSG_extensionDescription__",
    version: "0.1.13",
    default_locale: "zh_CN",
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApFFAVg/OygEgrB6Rnp37y61MKetAqyK5kEwITZ9Q/tn1OBOYbCJpPl66MjzRAigg1MnrndbawoFtKRVS/rUyn5wgBUj2GOfFq3QF3IAC2MEXMkXBgwE+vZU6A7ZG6l5hplg7VZOZAb0OZhEiz8LVjunbXqPGhKjbrabqszUR7LH/SCc5L8YA5RLUgRTs+Nd269rNH4ADopKfpuF3IaJWbvSBnOlKZVnFixyUX96PMehGCqGtTuO6b7OK6OoOaeSVpSzcajvXxIysNCrd1ekneoPPTYyx+Kqyb/PesRjpetAI8mcn3iGecD0zvQUOdI5nQIjg6YizpZBNwfjQMfCS3wIDAQAB",
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
