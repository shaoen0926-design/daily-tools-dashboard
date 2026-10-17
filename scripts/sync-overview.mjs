import { relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import { validateCatalog } from "../dist/catalog.mjs";

const catalog = validateCatalog(
  JSON.parse(await readFile(new URL("../dist/tools.json", import.meta.url), "utf8")),
);
const readmeUrl = new URL("../../README.md", import.meta.url);
const before = await readFile(readmeUrl, "utf8");
const start = "<!-- TOOLS:START -->";
const end = "<!-- TOOLS:END -->";
if (!before.includes(start) || !before.includes(end))
  throw new Error("總目錄缺少工具表格標記，未修改檔案。");
const cell = (value) =>
  String(value)
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");
const target = (value) => encodeURI(value).replaceAll("(", "%28").replaceAll(")", "%29");
const rows = catalog.tools.map((tool) => {
  const localTarget = (path) => target(relative(dirname(fileURLToPath(readmeUrl)), resolve(tool.workspaceRoot || catalog.workspaceRoot, path)));
  const launch = tool.launches.find((item) => item.primary);
  const entry = !launch
    ? "待補入口"
    : launch.type === "web"
      ? `[${cell(launch.label)}](${target(launch.url)})`
      : cell(launch.label) + "；見工具說明";
  const readme = tool.readmePath ? `[README](${localTarget(tool.readmePath)})` : "尚缺 README";
  return `| [${cell(tool.name)}](${localTarget(tool.projectPath)}/)${tool.name === tool.alias ? '' : `｜${cell(tool.alias)}`} | ${cell(tool.description)} | ${cell(tool.category)} | ${cell(tool.origin)} | ${cell(tool.tags.join("、"))} | ${cell(tool.status)} | ${entry} | ${readme} |`;
});
const table = [
  start,
  "",
  "此表由 `dashboard/dist/tools.json` 產生；請修改清單後在 Dashboard 專案執行 `npm run sync:overview`。",
  "",
  "| 工具 | 用途 | 分類 | 來源 | 標籤 | 狀態 | 主要入口 | 專案說明 |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows,
  "",
  end,
].join("\n");
const begin = before.indexOf(start);
const finish = before.indexOf(end, begin);
if (finish < begin) throw new Error("總目錄工具表格標記順序不正確，未修改檔案。");
const after = before.slice(0, begin) + table + before.slice(finish + end.length);
if (before !== after) await writeFile(readmeUrl, after);
console.log(`已同步 ${catalog.tools.length} 個工具到日常工具 README。`);
