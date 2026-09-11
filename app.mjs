import {
  validateCatalog,
  filterTools,
  readPins,
  writePins,
  CATEGORIES,
  STATUSES,
} from "./catalog.mjs";

const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  star: '<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3L2.8 9.7l6.4-.9Z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  external:
    '<path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
  flask:
    '<path d="M9 3h6m-5 0v6L4 19a1.4 1.4 0 0 0 1.3 2h13.4A1.4 1.4 0 0 0 20 19L14 9V3M7 14h10"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  folder:
    '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  work: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12c5 4 13 4 18 0m-9 1v3"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  map: '<path d="m9 3 6 3 6-3v17l-6 3-6-3-6 3V6Zm0 0v17m6-14v17"/>',
  media: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4Z"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 3l-4 18"/>',
  museum: '<path d="m2 8 10-5 10 5H2Zm2 3v7m5-7v7m6-7v7m5-7v7M2 21h20"/>',
  chat: '<path d="M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 0 1-1-5 8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/><path d="M7 9h10M7 13h6"/>',
  check: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 9 2 2 5-5m-7 9h8m-8 3h5"/>',
  wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v12H5a3 3 0 0 1-3-3V6m19 7h-6v4h6"/>',
  sport:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.5 5.5c8 3 8 10 0 13m13-13c-8 3-8 10 0 13"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
document.querySelectorAll("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
const categories = [
  ["工作學習", "work"],
  ["生活管理", "home"],
  ["旅行文化", "map"],
  ["媒體", "media"],
  ["開發練習", "code"],
];
const state = {
  tools: [],
  query: "",
  category: "all",
  status: "all",
  scope: "all",
  pins: new Set(),
  root: "",
  loaded: false,
};
const $ = (selector) => document.querySelector(selector);
const dialog = $("#detail-dialog");
let toastTimer;
let returnFocus;
let storageWarning = null;
const fullPath = (relative) => `${state.root.replace(/\/$/, "")}/${relative}`;
const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const isHandheld = () =>
  /Android|iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function notify(message) {
  clearTimeout(toastTimer);
  if (dialog.open) {
    $("#dialog-feedback").textContent = message;
    $("#dialog-feedback").hidden = false;
    return;
  }
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 3200);
}
function showStorageWarning(message) {
  storageWarning = message;
  $("#storage-warning").textContent = message || "";
  $("#storage-warning").hidden = !message;
}

function card(tool) {
  const web = tool.launches.find((x) => x.primary && x.type === "web");
  return `<article class="tool-card" data-tool-id="${esc(tool.id)}"><div class="card-top"><div class="tool-icon">${icon(tool.icon)}</div><button class="icon-button" data-pin="${esc(tool.id)}" aria-label="${state.pins.has(tool.id) ? "取消釘選" : "釘選"}${esc(tool.alias)}" aria-pressed="${state.pins.has(tool.id)}" title="${state.pins.has(tool.id) ? "取消常用" : "加入常用"}">${icon("star")}</button></div><div class="card-title-line"><h3>${esc(tool.alias)}</h3><span class="tool-name">${esc(tool.name)}</span></div><p class="tool-description">${esc(tool.description)}</p><div class="card-metadata"><span class="category-label">${esc(tool.category)}</span><span class="status-label">${esc(tool.status)}</span></div><div class="card-actions">${web ? `<a class="card-primary" href="${esc(web.url)}" target="_blank" rel="noopener noreferrer" aria-label="開啟${esc(tool.alias)}網站">開啟網站${icon("external")}</a>` : `<button class="card-primary" data-detail="${esc(tool.id)}" aria-label="${tool.launches.length ? "查看" + esc(tool.alias) + "啟動說明" : "查看" + esc(tool.alias) + "待補入口"}">${tool.launches.length ? "啟動說明" : "待補入口"}${icon("arrow")}</button>`}<button class="card-secondary" data-detail="${esc(tool.id)}" aria-label="${esc(tool.alias)}的詳情">詳情</button></div></article>`;
}
function render() {
  if (!state.loaded) return;
  const tools = filterTools(state.tools, state);
  const pinned = state.scope === "all" ? tools.filter((tool) => state.pins.has(tool.id)) : [];
  const regular = pinned.length ? tools.filter((tool) => !state.pins.has(tool.id)) : tools;
  $("#tool-grid").innerHTML = regular.map(card).join("");
  $("#pinned-grid").innerHTML = pinned.map(card).join("");
  $("#pinned-section").hidden = !pinned.length;
  $("#all-count").textContent = state.tools.length;
  $("#pin-count").textContent = state.pins.size;
  $("#collection-count").textContent = `${state.tools.length} 個工具`;
  $("#result-count").textContent = `${tools.length} 個`;
  $("#empty-state").hidden = tools.length > 0;
  $("#clear-filters").hidden =
    !state.query && state.category === "all" && state.status === "all" && state.scope === "all";
  $("#page-title").textContent =
    state.scope === "pinned" ? "常用工具" : state.category !== "all" ? state.category : "所有工具";
  $("#page-description").textContent =
    state.scope === "pinned" ? "把常用的留在手邊，隨時接著用。" : "從這裡，接著做你想做的事。";
  $("#empty-title").textContent =
    state.scope === "pinned" && !state.pins.size ? "還沒有常用工具" : "沒有符合的工具";
  $("#empty-description").textContent =
    state.scope === "pinned" && !state.pins.size
      ? "在工具卡片按下星號，就能把它放進常用清單。"
      : "換個關鍵字，或清除篩選再看看。";
  document.querySelectorAll("[data-scope]").forEach((button) => {
    const active = button.dataset.scope === state.scope;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-category]").forEach((button) => {
    const active = button.dataset.category === state.category;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}
function renderCategories() {
  document.querySelector("#category-nav").innerHTML = categories
    .map(
      ([name, symbol]) =>
        `<button class="nav-item" data-category="${name}" aria-pressed="false">${icon(symbol)}${name}<span class="nav-count">${state.tools.filter((t) => t.category === name).length}</span></button>`,
    )
    .join("");
}
function clearFilters() {
  state.query = "";
  state.category = "all";
  state.status = "all";
  state.scope = "all";
  $("#search").value = "";
  $("#status").value = "all";
  render();
}
function setPinned(id, pinned) {
  const tool = state.tools.find((tool) => tool.id === id);
  if (!tool) throw new Error("找不到這個工具。");
  if (pinned) state.pins.add(id);
  else state.pins.delete(id);
  showStorageWarning(writePins(() => window.localStorage, state.pins));
  render();
  notify(pinned ? `${tool.alias}已加入常用` : `${tool.alias}已取消常用`);
  return { id, pinned, saved: !storageWarning };
}
function pathBox(relative, label) {
  const value = fullPath(relative);
  return `<div class="path-box"><code>${esc(value)}</code><button data-copy="${esc(value)}" aria-label="複製${esc(label)}">複製</button></div>`;
}
function launchBox(launch) {
  const command = launch.command
    ? `cd ${shellQuote(fullPath(launch.cwd))}\n${launch.command}`
    : null;
  return `<div class="launch-box"><h4>${esc(launch.label)}</h4>${launch.note ? `<p>${esc(launch.note)}</p>` : ""}${launch.steps?.length ? `<ol>${launch.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>` : ""}${launch.path ? pathBox(launch.path, "啟動檔案路徑") : ""}${command ? `<pre><code>${esc(command)}</code></pre><button class="copy-button" data-copy="${esc(command)}" aria-label="複製${esc(launch.label)}指令">複製啟動指令</button>` : ""}${launch.url ? (launch.type === "web" ? `<a href="${esc(launch.url)}" target="_blank" rel="noopener noreferrer">開啟網站 ${icon("external")}</a>` : `<p class="local-instruction">請先啟動工具。本機網址：<span>${esc(launch.url)}</span></p><p class="mobile-instruction">手機需改用 Mac 的區網網址；localhost 只代表目前這台裝置。</p>${isHandheld() ? "" : `<a class="desktop-local-link" href="${esc(launch.url)}" target="_blank" rel="noopener noreferrer">在這台電腦開啟 ${icon("external")}</a>`}`) : ""}</div>`;
}
function showDialog(html) {
  returnFocus = document.activeElement;
  $("#dialog-feedback").hidden = true;
  $("#detail-content").innerHTML = html;
  dialog.showModal();
  document.body.classList.add("dialog-open");
  $("#close-dialog").focus();
}
function showTool(id) {
  const tool = state.tools.find((tool) => tool.id === id);
  if (!tool) return;
  showDialog(
    `<div class="detail-heading"><div class="tool-icon">${icon(tool.icon)}</div><div><h2 id="detail-title">${esc(tool.alias)}</h2><span class="tool-name">${esc(tool.name)} · ${esc(tool.category)} · ${esc(tool.status)}</span></div></div><p class="detail-description">${esc(tool.description)}</p><section class="detail-section"><h3>開啟方式</h3>${tool.launches.length ? tool.launches.map(launchBox).join("") : '<div class="launch-box"><h4>常用入口待補</h4><p>這個工具已列入目錄，確認網址或啟動流程後，就能在這裡找到入口。</p></div>'}</section><section class="detail-section"><h3>專案位置</h3>${pathBox(tool.projectPath, "專案位置")}</section><section class="detail-section"><h3>README 使用說明</h3>${tool.readmePath ? `${pathBox(tool.readmePath, "README 路徑")}<p class="path-hint">可在 Finder 按 ⇧⌘G，貼上路徑開啟。</p>` : "<p>尚未建立 README；啟動方式與資料保存位置仍待整理。</p>"}</section><section class="detail-section"><h3>下一步</h3><p>${esc(tool.nextAction || "尚未登錄，先照自己的步調使用。")}</p></section><details class="detail-source"><summary>資料來源與核對紀錄</summary><p>${esc(tool.source)}</p><p>文件核對：${esc(tool.lastReviewedAt || "待確認")}。使用狀態由你確認；文件核對不代表工具正在執行或網站可用。</p></details>`,
  );
}
function showPlayground() {
  showDialog(
    `<div class="detail-heading"><div class="tool-icon">${icon("flask")}</div><div><h2 id="detail-title">Playground</h2><span class="tool-name">小實驗與開發練習</span></div></div><p class="detail-description">留一個地方，試試還不確定的想法。</p><section class="detail-section"><h3>每次練一個觀念</h3><ol><li>在 Playground 裡，為這次實驗建立一個子資料夾。</li><li>記下目標、執行方式與結果，三行也可以。</li><li>值得持續使用時，再整理成獨立工具。</li></ol></section><section class="detail-section"><h3>資料夾位置</h3>${pathBox("playground", "Playground 資料夾")}<p class="path-hint">在 Finder 按 ⇧⌘G，貼上路徑即可前往。</p></section><section class="detail-section"><h3>使用說明</h3>${pathBox("playground/README.md", "Playground README")}</section><section class="detail-section"><h3>可以從這裡開始</h3><p>例如做一個日期計算器、練習讀取 JSON，或把清單變成可搜尋的卡片。這些是練習建議，並非已建立的實驗。</p></section>`,
  );
}
async function copyText(button) {
  const value = button.dataset.copy;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(value);
    button.textContent = "已複製";
    notify("已複製，可貼到需要的地方。");
    setTimeout(() => {
      if (button.isConnected)
        button.textContent = button.classList.contains("copy-button") ? "複製啟動指令" : "複製";
    }, 1800);
  } catch {
    let fallback = button.parentElement.querySelector(".copy-fallback");
    if (!fallback) {
      fallback = document.createElement("textarea");
      fallback.className = "copy-fallback";
      fallback.readOnly = true;
      fallback.setAttribute("aria-label", "可手動複製的內容");
      button.parentElement.append(fallback);
    }
    fallback.value = value;
    fallback.focus();
    fallback.select();
    notify("無法自動複製，請複製已選取的文字。");
  }
}
$("#search").addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});
$("#status").addEventListener("change", (event) => {
  state.status = event.target.value;
  render();
});
$("#clear-filters").addEventListener("click", () => {
  clearFilters();
  $("#search").focus();
});
$("#empty-reset").addEventListener("click", () => {
  clearFilters();
  $("#search").focus();
});
$("#retry").addEventListener("click", loadCatalog);
$("#playground-button").addEventListener("click", () => {
  if (state.loaded) showPlayground();
});
$("#close-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  document.body.classList.remove("dialog-open");
  if (returnFocus?.isConnected) returnFocus.focus();
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !dialog.open &&
    !event.target.closest("input,textarea,select,[contenteditable]")
  ) {
    event.preventDefault();
    $("#search").focus();
  }
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || !state.loaded) return;
  if (button.dataset.pin) {
    const id = button.dataset.pin;
    setPinned(id, !state.pins.has(id));
    (document.querySelector(`[data-pin="${id}"]`) || $('[data-scope="pinned"]')).focus();
  } else if (button.dataset.detail) showTool(button.dataset.detail);
  else if (button.dataset.category) {
    state.category = state.category === button.dataset.category ? "all" : button.dataset.category;
    render();
  } else if (button.dataset.scope) {
    state.scope = button.dataset.scope;
    if (state.scope === "all") state.category = "all";
    render();
  } else if (button.dataset.copy) void copyText(button);
});

async function loadCatalog() {
  $("#error-state").hidden = true;
  $("#empty-state").hidden = true;
  $("#pinned-section").hidden = true;
  $("#tool-grid").innerHTML = '<div class="loading-state" role="status">正在整理你的工具…</div>';
  state.loaded = false;
  try {
    const response = await fetch("./tools.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("找不到工具清單檔案，請確認 dist/tools.json 存在。");
    const catalog = validateCatalog(await response.json());
    state.tools = catalog.tools;
    state.root = catalog.workspaceRoot;
    state.loaded = true;
    const { pins, warning } = readPins(
      () => window.localStorage,
      new Set(state.tools.map((tool) => tool.id)),
    );
    state.pins = pins;
    showStorageWarning(warning);
    renderCategories();
    render();
    registerAgentTools();
  } catch (error) {
    $("#tool-grid").innerHTML = "";
    $("#error-state").hidden = false;
    $("#error-description").textContent =
      error instanceof SyntaxError
        ? "工具清單不是有效的 JSON。請檢查 dist/tools.json 的逗號與括號，再重新載入。"
        : error instanceof TypeError
          ? "請使用「啟動日常工具.command」開啟本機網頁，避免直接雙擊 index.html。"
          : error.message || "工具清單無法載入，請稍後重試。";
  }
}

let agentToolsRegistered = false;
function registerAgentTools() {
  const context = document.modelContext;
  if (!context?.registerTool || agentToolsRegistered) return;
  agentToolsRegistered = true;
  const lifecycle = new AbortController();
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
  const tools = [
    {
      name: "search_daily_tools",
      title: "搜尋日常工具",
      description:
        "在目前工具目錄套用搜尋與篩選，回傳符合工具的名稱及入口類型，不開啟網站或執行程式。",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          category: { type: "string", enum: ["all", ...CATEGORIES] },
          status: { type: "string", enum: ["all", ...STATUSES] },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        if (
          !input ||
          typeof input !== "object" ||
          Object.keys(input).some((key) => !["query", "category", "status"].includes(key)) ||
          (input.query !== undefined && typeof input.query !== "string") ||
          (input.category !== undefined && !["all", ...CATEGORIES].includes(input.category)) ||
          (input.status !== undefined && !["all", ...STATUSES].includes(input.status))
        )
          throw new Error("搜尋條件無效。");
        state.query = input.query || "";
        state.category = input.category || "all";
        state.status = input.status || "all";
        state.scope = "all";
        $("#search").value = state.query;
        $("#status").value = state.status;
        render();
        return {
          tools: filterTools(state.tools, state).map((tool) => ({
            id: tool.id,
            name: tool.name,
            alias: tool.alias,
            launchTypes: tool.launches.map((launch) => launch.type),
          })),
        };
      },
    },
    {
      name: "set_daily_tool_pinned",
      title: "設定常用工具",
      description: "把指定工具加入或移出此瀏覽器的常用清單；不刪除工具。",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" }, pinned: { type: "boolean" } },
        required: ["id", "pinned"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute(input) {
        if (
          !input ||
          typeof input.id !== "string" ||
          typeof input.pinned !== "boolean" ||
          Object.keys(input).some((key) => !["id", "pinned"].includes(key))
        )
          throw new Error("請提供工具 id 與 pinned 布林值。");
        return setPinned(input.id, input.pinned);
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(
        () => {},
      );
    } catch {}
  }
}
await loadCatalog();
