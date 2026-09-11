import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { validateCatalog, filterTools, readPins, writePins, PIN_KEY } from "../dist/catalog.mjs";

const catalog = JSON.parse(await readFile(new URL("../dist/tools.json", import.meta.url), "utf8"));
const copy = () => structuredClone(catalog);
const examples = catalog.tools
  .filter((tool) => ["finance", "tasks", "sports"].includes(tool.id))
  .map((tool) => ({ ...tool, status: "待確認" }));

test("現有清單有效，專案與已登錄 README 的相對路徑存在", async () => {
  assert.ok(validateCatalog(catalog).tools.length > 0);
  for (const tool of catalog.tools) {
    await access(new URL(`../../${tool.projectPath}/`, import.meta.url));
    if (tool.readmePath) await access(new URL(`../../${tool.readmePath}`, import.meta.url));
  }
});
test("名稱、別名、多字搜尋可以和分類、狀態組合", () => {
  for (const query of ["日積", "財務", "財務 日積"])
    assert.deepEqual(
      filterTools(examples, { query }).map((t) => t.id),
      ["finance"],
    );
  assert.equal(filterTools(examples, { query: "日積", category: "工作學習" }).length, 0);
  assert.equal(filterTools(examples, { category: "生活管理", status: "待確認" }).length, 2);
  assert.equal(filterTools(examples, { status: "使用中" }).length, 0);
  assert.equal(
    filterTools(examples, { scope: "pinned", pins: new Set(["sports"]) })[0].id,
    "sports",
  );
});
test("缺少入口與 README 仍是有效的待補工具", () => {
  const value = copy();
  value.tools[0].readmePath = null;
  value.tools[0].launches = [];
  const travel = validateCatalog(value).tools[0];
  assert.equal(travel.readmePath, null);
  assert.deepEqual(travel.launches, []);
});
test("重複識別碼、錯誤分類與無效日期會拒絕載入", () => {
  const duplicate = copy();
  duplicate.tools[1].id = duplicate.tools[0].id;
  assert.throws(() => validateCatalog(duplicate), /唯一/);
  const invalid = copy();
  invalid.tools[0].category = "未知分類";
  assert.throws(() => validateCatalog(invalid), /分類/);
  const date = copy();
  date.tools[0].lastReviewedAt = "2026-02-31";
  assert.throws(() => validateCatalog(date), /日期/);
});
test("阻止危險連結、目錄跳脫與沒有工作目錄的啟動指令", () => {
  for (const url of [
    "javascript:alert(1)",
    "https://user:password@example.com",
    "file:///tmp/test",
  ]) {
    const value = copy();
    value.tools[0].launches[0].url = url;
    assert.throws(() => validateCatalog(value), /HTTPS/);
  }
  const traversal = copy();
  traversal.tools[0].projectPath = "../outside";
  assert.throws(() => validateCatalog(traversal), /路徑/);
  const cwd = copy();
  delete cwd.tools[0].launches[1].cwd;
  assert.throws(() => validateCatalog(cwd), /工作目錄/);
});
test("釘選可保存與讀回，已移除的工具不會變成幽靈釘選", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  assert.equal(
    writePins(() => storage, new Set(["finance", "removed"])),
    null,
  );
  assert.deepEqual([...readPins(() => storage, new Set(["finance"])).pins], ["finance"]);
  assert.deepEqual(JSON.parse(memory.get(PIN_KEY)), ["finance", "removed"]);
});
test("儲存遭封鎖或內容損壞時回傳提示，仍可使用工具清單", () => {
  const blocked = () => {
    throw new Error("Blocked");
  };
  const result = readPins(blocked, new Set(["finance"]));
  assert.equal(result.pins.size, 0);
  assert.ok(result.warning);
  assert.ok(writePins(blocked, new Set(["finance"])));
  assert.ok(readPins(() => ({ getItem: () => "{broken" }), new Set()).warning);
  assert.equal(filterTools(catalog.tools, { query: "日積", pins: result.pins }).length, 1);
});
