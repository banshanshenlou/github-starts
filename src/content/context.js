(() => {
  "use strict";

  const root = globalThis.GhStarsHelper || (globalThis.GhStarsHelper = {});
  root.content = root.content || {};
  const content = root.content;
  const shared = root.shared || {};
  const maxGroupDepth = Number.isFinite(shared.MAX_GROUP_DEPTH) ? shared.MAX_GROUP_DEPTH : 5;

  // 内容脚本的常量与运行时上下文。
  content.constants = {
    STORAGE_KEYS: {
      manageButtonPosition: "ghStarsHelperManageButtonPosition"
    },
    MAX_GROUP_DEPTH: maxGroupDepth
  };

  content.state = {
    config: null,
    meta: null,
    stars: { items: {}, updated_at: null, fetched_at: null, etag: null, force_fetch: false },
    pendingOpsCount: 0,
    recentPendingRepos: [],
    syncStatus: { state: "idle", message: "", updated_at: null },
    conflict: null,
    filter: {
      query: "",
      tag: "",
      groupId: "",
      sort: "starred_desc"
    },
    groupCollapse: {}
  };

  content.elements = {
    manageButton: null,
    overlay: null,
    drawer: null,
    starsCount: null,
    groupsCount: null,
    statusText: null,
    pendingText: null,
    syncButton: null,
    optionsButton: null,
    helpButton: null,
    optionsHint: null,
    optionsMessage: null,
    optionsLink: null,
    conflictBox: null,
    conflictDesc: null,
    conflictLocalLine: null,
    conflictCloudLine: null,
    conflictRecentRepos: null,
    conflictHint: null,
    conflictKeepRemote: null,
    conflictKeepLocal: null,
    conflictOpenGist: null,
    searchInput: null,
    tagInput: null,
    sortSelect: null,
    sectionTitle: null,
    sectionActions: null,
    groupTree: null,
    repoEditButton: null
  };

  content.runtime = {
    observer: null,
    refreshTimer: null,
    pollingTimer: null,
    onlineListenerAttached: false,
    manageButtonResizeAttached: false,
    suppressManageButtonClick: false,
    observedMain: null,
    repoStarAutoOpenAttached: false,
    starCacheListenerAttached: false,
    repoAutoOpenInProgress: false,
    initialFullSyncDone: false,
    initialFullSyncPromise: null,
    lastRepoAutoOpenIntentKey: "",
    lastRepoAutoOpenIntentTime: 0,
    lastStarToggleIntentKey: "",
    lastStarToggleIntentTime: 0,
    pendingStarStateRepo: "",
    pendingStarStateExpected: null,
    pendingStarStateExpiresAt: 0,
    lastMetaSyncCheckAt: 0,
    escHandlerAttached: false,
    repoAutoSyncTimer: null,
    toastTimer: null,
    groupTreeScrollTop: 0,
    manageButtonSyncIndicatorState: "",
    manageButtonSyncIndicatorTimer: null,
    manageButtonLastSyncState: ""
  };
})();
