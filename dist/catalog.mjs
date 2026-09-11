export const CATEGORIES = ["工作學習", "生活管理", "旅行文化", "媒體", "開發練習"];
export const STATUSES = ["待確認", "開發中", "使用中", "暫停"];
export const PIN_KEY = "daily-tools.pins.v1";

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function relativePath(value) {
  return (
    text(value) &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    value.split("/").every((part) => part && part !== "." && part !== "..")
  );
}
function validUrl(value, web) {
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      (web
        ? url.protocol === "https:"
        : url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    );
  } catch {
    return false;
  }
}

export function validateCatalog(catalog) {
  requireValue(
    catalog?.schemaVersion === 1 && Array.isArray(catalog.tools),
    "工具清單格式不符，請確認 schemaVersion 與 tools。",
  );
  requireValue(
    text(catalog.workspaceRoot) &&
      catalog.workspaceRoot.startsWith("/") &&
      !catalog.workspaceRoot.includes("\0"),
    "請填入有效的 workspaceRoot。",
  );
  const ids = new Set();
  for (const tool of catalog.tools) {
    requireValue(tool && typeof tool === "object", "工具資料必須是物件。");
    requireValue(
      text(tool.id) && /^[a-z0-9-]+$/.test(tool.id) && !ids.has(tool.id),
      "工具 id 必須唯一，且使用小寫英數與連字號。",
    );
    ids.add(tool.id);
    requireValue(
      ["name", "alias", "description", "source"].every((key) => text(tool[key])),
      `${tool.id} 缺少名稱、用途或來源。`,
    );
    requireValue(
      CATEGORIES.includes(tool.category) && STATUSES.includes(tool.status),
      `${tool.id} 的分類或狀態無效。`,
    );
    requireValue(
      relativePath(tool.projectPath) && (tool.readmePath === null || relativePath(tool.readmePath)),
      `${tool.id} 的專案或 README 路徑無效。`,
    );
    requireValue(
      tool.nextAction === null || text(tool.nextAction),
      `${tool.id} 的下一步請填文字或 null。`,
    );
    requireValue(
      tool.lastReviewedAt === null ||
        (typeof tool.lastReviewedAt === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(tool.lastReviewedAt) &&
          Number.isFinite(Date.parse(tool.lastReviewedAt)) &&
          new Date(tool.lastReviewedAt).toISOString().slice(0, 10) === tool.lastReviewedAt),
      `${tool.id} 的核對日期無效。`,
    );
    requireValue(Array.isArray(tool.launches), `${tool.id} 缺少入口清單。`);
    requireValue(
      !tool.launches.length || tool.launches.filter((item) => item?.primary === true).length === 1,
      `${tool.id} 應有且只有一個主要入口。`,
    );
    for (const launch of tool.launches) {
      requireValue(
        launch && ["web", "instructions", "file"].includes(launch.type) && text(launch.label),
        `${tool.id} 的入口類型或名稱無效。`,
      );
      if (launch.type === "web")
        requireValue(validUrl(launch.url, true), `${tool.id} 的線上入口須為 HTTPS 網址。`);
      else if (launch.url !== undefined)
        requireValue(validUrl(launch.url, false), `${tool.id} 的本機網址無效。`);
      if (launch.type === "file")
        requireValue(relativePath(launch.path), `${tool.id} 的檔案入口路徑無效。`);
      if (launch.steps !== undefined)
        requireValue(
          Array.isArray(launch.steps) && launch.steps.every(text),
          `${tool.id} 的啟動步驟無效。`,
        );
      if (launch.command !== undefined)
        requireValue(
          text(launch.command) && relativePath(launch.cwd),
          `${tool.id} 的啟動指令需附上工作目錄。`,
        );
      if (launch.note !== undefined)
        requireValue(text(launch.note), `${tool.id} 的入口備註須為文字。`);
    }
  }
  return catalog;
}

export function filterTools(
  tools,
  { query = "", category = "all", status = "all", scope = "all", pins = new Set() } = {},
) {
  const words = query.trim().normalize("NFKC").toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return tools.filter((tool) => {
    const haystack = `${tool.name} ${tool.alias} ${tool.description}`
      .normalize("NFKC")
      .toLocaleLowerCase();
    return (
      words.every((word) => haystack.includes(word)) &&
      (category === "all" || tool.category === category) &&
      (status === "all" || tool.status === status) &&
      (scope === "all" || pins.has(tool.id))
    );
  });
}

export function readPins(getStorage, allowedIds) {
  try {
    const raw = getStorage().getItem(PIN_KEY);
    if (raw === null) return { pins: new Set(), warning: null };
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || !data.every((id) => typeof id === "string"))
      throw new Error("Invalid pins");
    return { pins: new Set(data.filter((id) => allowedIds.has(id))), warning: null };
  } catch {
    return {
      pins: new Set(),
      warning: "無法讀取此瀏覽器的常用設定，這次先從空清單開始。工具仍可正常使用。",
    };
  }
}

export function writePins(getStorage, pins) {
  try {
    getStorage().setItem(PIN_KEY, JSON.stringify([...pins]));
    return null;
  } catch {
    return "常用設定目前只保留在此頁，關閉或重新整理後可能消失。工具仍可正常使用。";
  }
}
