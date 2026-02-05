const copy = {
  zh: {
    nav: {
      highlights: "功能亮点",
      efficiency: "效率体验",
      wechat: "公众号",
      install: "如何安装",
      sync: "同步与隐私",
      screens: "截图",
      faq: "常见问题",
      download: "下载"
    },
    theme: {
      light: "浅色",
      dark: "深色"
    },
    hero: {
      eyebrow: "浏览器扩展",
      title: "星标不再乱，收藏更有序",
      subtitle: "在 GitHub 页面内直接管理星标：分组、标签、备注，并支持 Gist 多设备同步。",
      ctaPrimary: "下载 CRX",
      ctaSecondary: "查看 GitHub",
      helper: "开源 · 无需离开 GitHub · 中英文与暗色模式",
      pills: ["分组", "标签", "同步"],
      cardTitle: "你的星标库",
      cardTag1: "前端",
      cardTag2: "灵感",
      cardTag3: "工具",
      cardDesc: "一眼找到要用的仓库"
    },
    highlights: {
      eyebrow: "功能亮点",
      title: "把星标变成可管理的收藏夹",
      subtitle: "轻量但完整的整理体系，让收藏像项目一样可维护。"
    },
    efficiency: {
      eyebrow: "效率体验",
      title: "更快、更顺、更少跳转",
      subtitle: "把时间留给阅读与评估，而不是翻找。",
      cards: [
        {
          title: "搜索更精准",
          desc: "标签与备注让检索更有语义。"
        },
        {
          title: "分组树定位",
          desc: "层级结构快速聚焦目标。"
        },
        {
          title: "内联编辑",
          desc: "Stars 与仓库页即改即存。"
        },
        {
          title: "筛选更高效",
          desc: "组合标签快速收敛范围。"
        },
        {
          title: "无需跳转",
          desc: "整理与浏览在 GitHub 内完成。"
        },
        {
          title: "排序更清晰",
          desc: "按需求排列，优先级一眼可见。"
        }
      ]
    },
    wechat: {
      eyebrow: "公众号推荐",
      title: "关注微信公众号：成为超级个体",
      subtitle: "获取更新、使用技巧与收藏方法。",
      name: "成为超级个体",
      tip: "扫码关注",
      qrAlt: "微信公众号二维码",
      qrHint: "扫码关注"
    },
    featureGroups: {
      manage: {
        title: "管理方式",
        items: [
          "星标分组：像文件夹一样管理收藏",
          "标签/备注：给每个仓库加上下文",
          "内联编辑：Stars 列表与仓库页直接修改"
        ]
      },
      efficiency: {
        title: "效率体验",
        items: [
          "搜索/筛选/排序：快速定位目标",
          "Stars 与仓库页增强：无需离开 GitHub",
          "自动语言识别：中英文界面自适配"
        ]
      },
      sync: {
        title: "同步与安全",
        items: [
          "Gist 多设备同步",
          "冲突提示与版本选择",
          "隐私可控：数据仅在本地/Gist"
        ]
      }
    },
    workflow: {
      eyebrow: "使用流程",
      title: "三步把星标整理起来",
      subtitle: "从安装到同步只需要几分钟。",
      steps: ["安装扩展", "设置 PAT 与 Gist", "开始整理与同步"]
    },
    sync: {
      eyebrow: "同步与隐私",
      title: "你掌控数据流转",
      subtitle: "本地与 Gist 双向同步，安全可控且可选择保留版本。",
      points: [
        {
          title: "只在本地与 Gist",
          desc: "数据不会上传到第三方服务器。"
        },
        {
          title: "冲突提示",
          desc: "遇到分歧可选择保留哪一份。"
        },
        {
          title: "自动语言识别",
          desc: "中英文界面根据系统自动切换。"
        },
        {
          title: "手动/自动同步",
          desc: "按需触发或定时同步。"
        },
        {
          title: "版本选择",
          desc: "明确选择保留版本，避免误覆盖。"
        },
        {
          title: "可随时撤销",
          desc: "Token 可随时撤销，仍可本地管理。"
        }
      ]
    },
    screens: {
      eyebrow: "截图",
      title: "功能截图",
      subtitle: "三张截图展示核心使用场景。",
      cards: [
        {
          label: "侧边抽屉",
          alt: "侧边抽屉界面截图",
          title: "分组树与星标列表",
          desc: "集中管理与快速筛选。"
        },
        {
          label: "Stars 列表",
          alt: "Stars 列表界面截图",
          title: "Stars 列表内联编辑",
          desc: "不离开列表，随时标注。"
        },
        {
          label: "仓库页",
          alt: "仓库页界面截图",
          title: "仓库页内联编辑",
          desc: "给每个仓库留下上下文。"
        }
      ]
    },
    install: {
      eyebrow: "如何安装",
      title: "开发者模式安装",
      subtitle: "确保浏览器允许侧载扩展。",
      steps: [
        "打开扩展管理页并启用开发者模式",
        "下载 CRX 并拖拽安装",
        "打开 Stars 列表或任意仓库页开始使用"
      ],
      tip: "打开扩展管理页",
      note: "如果 CRX 无法直接安装，请先启用开发者模式。"
    },
    faq: {
      eyebrow: "常见问题",
      title: "安装与更新说明",
      subtitle: "先看这里，避免踩坑。",
      items: [
        {
          q: "CRX 不能直接安装怎么办？",
          a: "请在扩展管理页启用开发者模式后再拖拽安装。"
        },
        {
          q: "会读取我的私有仓库吗？",
          a: "仅在你浏览相关页面时读取必要信息。"
        },
        {
          q: "如何更新？",
          a: "关注 GitHub Release，下载新版 CRX 安装覆盖。"
        }
      ]
    },
    download: {
      title: "开始整理你的星标",
      subtitle: "下载 CRX，几分钟完成安装。",
      ctaPrimary: "下载 CRX",
      ctaSecondary: "查看 GitHub"
    },
    footer: {
      tagline: "开源星标管理工具",
      github: "GitHub",
      license: "许可证",
      feedback: "反馈"
    }
  },
  en: {
    nav: {
      highlights: "Highlights",
      efficiency: "Efficiency",
      wechat: "WeChat",
      install: "Install",
      sync: "Sync & Privacy",
      screens: "Screens",
      faq: "FAQ",
      download: "Download"
    },
    theme: {
      light: "Light",
      dark: "Dark"
    },
    hero: {
      eyebrow: "Browser Extension",
      title: "Star smarter, collect better.",
      subtitle: "Manage GitHub stars in-place with groups, tags, notes, and Gist sync.",
      ctaPrimary: "Download CRX",
      ctaSecondary: "View on GitHub",
      helper: "Open-source · Stay on GitHub · Bilingual & Dark mode",
      pills: ["Groups", "Tags", "Sync"],
      cardTitle: "Your Star Library",
      cardTag1: "Frontend",
      cardTag2: "Inspiration",
      cardTag3: "Tools",
      cardDesc: "Find the right repo at a glance"
    },
    highlights: {
      eyebrow: "Highlights",
      title: "Turn stars into a curated library",
      subtitle: "Lightweight structure with enough power to keep collections healthy."
    },
    efficiency: {
      eyebrow: "Efficiency",
      title: "Faster, smoother, fewer detours",
      subtitle: "Spend time evaluating repos, not hunting for them.",
      cards: [
        {
          title: "Sharper search",
          desc: "Tags and notes add semantic context."
        },
        {
          title: "Group tree focus",
          desc: "Hierarchy narrows the scope quickly."
        },
        {
          title: "Inline edits",
          desc: "Edit on Stars list and repo pages."
        },
        {
          title: "Smarter filters",
          desc: "Combine tags to tighten results."
        },
        {
          title: "No context switching",
          desc: "Organize without leaving GitHub."
        },
        {
          title: "Clear ordering",
          desc: "Sort by need and see priorities."
        }
      ]
    },
    wechat: {
      eyebrow: "WeChat Official Account",
      title: "Follow on WeChat: 成为超级个体",
      subtitle: "Get updates, tips, and collection workflows.",
      name: "成为超级个体",
      tip: "Scan to follow",
      qrAlt: "WeChat QR code",
      qrHint: "Scan to follow"
    },
    featureGroups: {
      manage: {
        title: "Organization",
        items: [
          "Groups: organize stars like folders",
          "Tags & notes: add context to every repo",
          "Inline edit on Stars list and repo pages"
        ]
      },
      efficiency: {
        title: "Efficiency",
        items: [
          "Search / filter / sort to locate fast",
          "Enhancements without leaving GitHub",
          "Auto language switch for CN/EN"
        ]
      },
      sync: {
        title: "Sync & Trust",
        items: [
          "Gist sync across devices",
          "Conflict prompts with version choice",
          "Privacy-first: local + Gist only"
        ]
      }
    },
    workflow: {
      eyebrow: "Workflow",
      title: "Organize in three steps",
      subtitle: "From install to sync in minutes.",
      steps: ["Install the extension", "Set PAT and Gist", "Organize and sync"]
    },
    sync: {
      eyebrow: "Sync & Privacy",
      title: "You control the data flow",
      subtitle: "Bidirectional sync between local storage and Gist with safety and control.",
      points: [
        {
          title: "Local + Gist only",
          desc: "No third-party servers involved."
        },
        {
          title: "Conflict prompts",
          desc: "Choose which version to keep."
        },
        {
          title: "Auto language",
          desc: "UI follows your system language."
        },
        {
          title: "Manual or auto sync",
          desc: "Trigger on demand or on schedule."
        },
        {
          title: "Version choice",
          desc: "Pick the version to keep without surprises."
        },
        {
          title: "Revocable access",
          desc: "Revoke the token anytime and keep local data."
        }
      ]
    },
    screens: {
      eyebrow: "Screens",
      title: "Product screenshots",
      subtitle: "Three scenes that cover the core workflow.",
      cards: [
        {
          label: "Drawer",
          alt: "Drawer screenshot",
          title: "Group tree & star list",
          desc: "Centralized management and quick filtering."
        },
        {
          label: "Stars List",
          alt: "Stars list screenshot",
          title: "Inline edit on Stars list",
          desc: "Annotate without leaving the list."
        },
        {
          label: "Repo Page",
          alt: "Repository page screenshot",
          title: "Inline edit on repo page",
          desc: "Keep context on every repo."
        }
      ]
    },
    install: {
      eyebrow: "Install",
      title: "Developer mode install",
      subtitle: "Make sure sideloading is enabled.",
      steps: [
        "Open the extensions page and enable Developer mode",
        "Download the CRX and drag to install",
        "Open Stars or any repo page to start"
      ],
      tip: "Extensions page",
      note: "If the CRX fails to install, enable Developer mode first."
    },
    faq: {
      eyebrow: "FAQ",
      title: "Install & update notes",
      subtitle: "Quick answers before you start.",
      items: [
        {
          q: "Why can’t I install the CRX directly?",
          a: "Enable Developer mode, then drag the CRX into the extensions page."
        },
        {
          q: "Does it read private repos?",
          a: "Only the information needed on the pages you visit."
        },
        {
          q: "How do I update?",
          a: "Download the latest CRX from GitHub Releases and reinstall."
        }
      ]
    },
    download: {
      title: "Ready to organize your stars?",
      subtitle: "Download the CRX and install in minutes.",
      ctaPrimary: "Download CRX",
      ctaSecondary: "View on GitHub"
    },
    footer: {
      tagline: "Open-source star organizer",
      github: "GitHub",
      license: "License",
      feedback: "Feedback"
    }
  }
};

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      return;
    }
  }
};

function getCopyValue(lang, key) {
  return key.split(".").reduce((acc, part) => {
    if (acc == null) {
      return acc;
    }
    if (Array.isArray(acc)) {
      const index = Number(part);
      return Number.isNaN(index) ? acc[part] : acc[index];
    }
    return acc[part];
  }, copy[lang]);
}

function updateButtons(buttons, activeValue, dataKey) {
  buttons.forEach((button) => {
    const value = button.dataset[dataKey];
    const isActive = value === activeValue;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function applyLanguage(lang, persist) {
  const i18nNodes = document.querySelectorAll("[data-i18n]");
  const listNodes = document.querySelectorAll("[data-i18n-list]");
  const faqContainer = document.querySelector("[data-i18n-faq]");
  const attrNodes = document.querySelectorAll("[data-i18n-attr]");

  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";

  i18nNodes.forEach((node) => {
    const value = getCopyValue(lang, node.dataset.i18n);
    if (typeof value === "string") {
      node.textContent = value;
    }
  });

  attrNodes.forEach((node) => {
    const raw = node.dataset.i18nAttr;
    if (!raw) {
      return;
    }
    raw
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        const [attr, key] = item.split(":").map((part) => part.trim());
        if (!attr || !key) {
          return;
        }
        const value = getCopyValue(lang, key);
        if (typeof value === "string") {
          node.setAttribute(attr, value);
        }
      });
  });

  listNodes.forEach((list) => {
    const items = getCopyValue(lang, list.dataset.i18nList);
    if (!Array.isArray(items)) {
      return;
    }
    list.textContent = "";
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
  });

  if (faqContainer) {
    const items = getCopyValue(lang, faqContainer.dataset.i18nFaq);
    if (Array.isArray(items)) {
      faqContainer.textContent = "";
      items.forEach((item, index) => {
        const detail = document.createElement("details");
        if (index === 0) {
          detail.open = true;
        }
        const summary = document.createElement("summary");
        summary.textContent = item.q;
        const content = document.createElement("p");
        content.textContent = item.a;
        detail.appendChild(summary);
        detail.appendChild(content);
        faqContainer.appendChild(detail);
      });
    }
  }

  if (persist) {
    storage.set("ghsm-lang", lang);
  }
}

function applyTheme(theme, persist) {
  document.documentElement.dataset.theme = theme;
  if (persist) {
    storage.set("ghsm-theme", theme);
  }
}

function initReveal() {
  const revealItems = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );
  revealItems.forEach((item) => observer.observe(item));
}

function init() {
  const langButtons = document.querySelectorAll("[data-lang-option]");
  const themeButtons = document.querySelectorAll("[data-theme-option]");
  const storedLang = storage.get("ghsm-lang");
  const storedTheme = storage.get("ghsm-theme");
  const browserLang = (navigator.language || "").toLowerCase();
  const defaultLang = browserLang.startsWith("zh") ? "zh" : "en";
  const themeQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const defaultTheme = themeQuery && themeQuery.matches ? "dark" : "light";
  const activeLang = storedLang || defaultLang;
  const activeTheme = storedTheme || defaultTheme;

  applyLanguage(activeLang, Boolean(storedLang));
  applyTheme(activeTheme, Boolean(storedTheme));
  updateButtons(langButtons, activeLang, "langOption");
  updateButtons(themeButtons, activeTheme, "themeOption");

  langButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextLang = button.dataset.langOption;
      applyLanguage(nextLang, true);
      updateButtons(langButtons, nextLang, "langOption");
    });
  });

  themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextTheme = button.dataset.themeOption;
      applyTheme(nextTheme, true);
      updateButtons(themeButtons, nextTheme, "themeOption");
    });
  });

  if (!storedTheme && themeQuery) {
    themeQuery.addEventListener("change", (event) => {
      applyTheme(event.matches ? "dark" : "light", false);
      updateButtons(themeButtons, event.matches ? "dark" : "light", "themeOption");
    });
  }

  initReveal();
  document.body.classList.add("is-loaded");
}

document.addEventListener("DOMContentLoaded", init);
