(() => {
  "use strict";

  const root = globalThis.GhStarsHelperBackground;
  const { constants, utils } = root;
  const { clone, nowIso } = utils;
  const shared = (globalThis.GhStarsHelper && globalThis.GhStarsHelper.shared) || {};
  const defaultGistFile = shared.DEFAULT_GIST_FILE || "stars-metadata.json";

  /**
   * 解析分页 Link 头，返回下一页 URL。
   */
  function parseNextLink(header) {
    if (!header) {
      return null;
    }
    const parts = header.split(",");
    for (const part of parts) {
      const section = part.split(";");
      if (section.length < 2) {
        continue;
      }
      const url = section[0].trim();
      const rel = section[1].trim();
      if (rel === 'rel="next"') {
        return url.slice(1, -1);
      }
    }
    return null;
  }

  /**
   * 提取 GitHub API 错误信息，优先使用响应体中的 message。
   */
  async function extractError(res) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.message) {
        message = data.message;
      }
    } catch {
      try {
        const text = await res.text();
        if (text) {
          message = text;
        }
      } catch {
        // 忽略解析失败
      }
    }
    return message;
  }

  /**
   * 统一 GitHub API 请求，自动注入必需头与错误处理。
   */
  async function githubRequest(url, token, options) {
    const headers = new Headers(options && options.headers ? options.headers : {});
    headers.set("Accept", headers.get("Accept") || "application/vnd.github+json");
    headers.set("X-GitHub-Api-Version", "2022-11-28");
    if (token) {
      headers.set("Authorization", `token ${token}`);
    }
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const message = await extractError(res);
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }
    return res;
  }

  /**
   * 读取 Gist 原始内容，处理大文件被截断的场景。
   */
  async function fetchRaw(url, token) {
    const headers = new Headers();
    if (token) {
      headers.set("Authorization", `token ${token}`);
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const message = await extractError(res);
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }
    return res.text();
  }

  /**
   * 拉取星标列表单页，支持 ETag 以减少不必要的响应体下载。
   */
  async function fetchStarredPage(url, token, etag) {
    const headers = new Headers();
    headers.set("Accept", "application/vnd.github.star+json");
    headers.set("X-GitHub-Api-Version", "2022-11-28");
    if (token) {
      headers.set("Authorization", `token ${token}`);
    }
    if (etag) {
      headers.set("If-None-Match", etag);
    }
    const res = await fetch(url, { headers });
    if (res.status === 304) {
      return {
        notModified: true,
        etag: res.headers.get("etag") || etag,
        link: null,
        list: []
      };
    }
    if (!res.ok) {
      const message = await extractError(res);
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }
    const list = await res.json();
    return {
      notModified: false,
      etag: res.headers.get("etag"),
      link: res.headers.get("link"),
      list
    };
  }

  /**
   * 拉取用户星标列表，并以 full_name 作为索引。
   */
  async function fetchStarredRepos(token, options) {
    const etag = options && options.etag ? options.etag : "";
    let url = "https://api.github.com/user/starred?per_page=100&sort=created&direction=desc";
    const items = {};
    let cachedEtag = etag || null;
    let isFirstPage = true;
    while (url) {
      const page = await fetchStarredPage(url, token, isFirstPage ? etag : "");
      if (isFirstPage && page.notModified) {
        return { notModified: true, etag: page.etag || cachedEtag };
      }
      const list = Array.isArray(page.list) ? page.list : [];
      list.forEach((entry) => {
        if (!entry || !entry.repo) {
          return;
        }
        const repo = entry.repo;
        const fullName = repo.full_name;
        if (!fullName) {
          return;
        }
        items[fullName] = {
          starred_at: entry.starred_at || null,
          name: repo.name || "",
          owner: repo.owner && repo.owner.login ? repo.owner.login : "",
          html_url: repo.html_url || ""
        };
      });
      if (isFirstPage) {
        cachedEtag = page.etag || cachedEtag;
      }
      url = parseNextLink(page.link);
      isFirstPage = false;
    }
    return { items, updated_at: nowIso(), etag: cachedEtag };
  }

  /**
   * 拉取 Gist 元数据并解析本地缓存结构。
   */
  async function fetchGistMeta(config) {
    const res = await githubRequest(`https://api.github.com/gists/${config.gistId}`, config.pat, {});
    const etag = res.headers.get("etag");
    const gist = await res.json();
    const fileName = config.gistFile || defaultGistFile;
    const file = gist.files && gist.files[fileName] ? gist.files[fileName] : null;
    if (!file) {
      return {
        meta: clone(constants.DEFAULT_META),
        etag,
        gistUrl: gist.html_url,
        missingFile: true
      };
    }
    let content = file.content || "";
    if (file.truncated && file.raw_url) {
      content = await fetchRaw(file.raw_url, config.pat);
    }
    let parsed = clone(constants.DEFAULT_META);
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = clone(constants.DEFAULT_META);
    }
    return {
      meta: root.meta.normalizeMeta(parsed),
      etag,
      gistUrl: gist.html_url,
      missingFile: false
    };
  }

  /**
   * 更新 Gist 内容，使用 ETag 进行并发控制。
   */
  async function updateGist(config, meta, etag) {
    const fileName = config.gistFile || defaultGistFile;
    const body = {
      files: {
        [fileName]: {
          content: JSON.stringify(meta, null, 2)
        }
      }
    };
    const headers = new Headers();
    headers.set("Accept", "application/vnd.github+json");
    headers.set("X-GitHub-Api-Version", "2022-11-28");
    headers.set("Content-Type", "application/json");
    if (config && config.pat) {
      headers.set("Authorization", `token ${config.pat}`);
    }
    const res = await fetch(`https://api.github.com/gists/${config.gistId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body)
    });
    if (res.status === 412) {
      const error = new Error("ETag mismatch");
      error.code = "etag_mismatch";
      throw error;
    }
    if (!res.ok) {
      const message = await extractError(res);
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }
    const updated = await res.json();
    return { gistUrl: updated.html_url, etag: res.headers.get("etag") };
  }

  /**
   * 创建新的私有 Gist，并返回 ID 与 URL。
   */
  async function createGist(config, meta) {
    const fileName = config.gistFile || defaultGistFile;
    const body = {
      public: false,
      files: {
        [fileName]: {
          content: JSON.stringify(meta, null, 2)
        }
      }
    };
    const res = await githubRequest("https://api.github.com/gists", config.pat, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const gist = await res.json();
    return { gistId: gist.id, gistUrl: gist.html_url };
  }

  root.github = {
    parseNextLink,
    extractError,
    githubRequest,
    fetchRaw,
    fetchStarredRepos,
    fetchGistMeta,
    updateGist,
    createGist
  };
})();
