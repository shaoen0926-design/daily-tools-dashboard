import http from "node:http";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL("./dist/", import.meta.url));
const port = 4318;
const url = `http://127.0.0.1:${port}`;
const identity = "daily-tools-dashboard-v1";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};
const openBrowser = () => {
  if (process.platform === "darwin")
    spawn("open", [url], { stdio: "ignore" }).on("error", () => {});
};

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    const requestPath = decodeURIComponent(new URL(req.url, url).pathname);
    if (requestPath === "/__dashboard_health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ app: identity }));
      return;
    }
    const candidate = path.resolve(root, "." + (requestPath === "/" ? "/index.html" : requestPath));
    const file = await realpath(candidate);
    const relative = path.relative(root, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const content = await readFile(file);
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("找不到這個檔案。");
  }
});

server.on("error", async (error) => {
  if (error.code === "EADDRINUSE") {
    try {
      const response = await fetch(`${url}/__dashboard_health`, {
        signal: AbortSignal.timeout(1500),
      });
      const data = await response.json();
      if (data.app === identity) {
        console.log(`日常工具已啟動：${url}`);
        if (process.argv.includes("--open")) openBrowser();
        return;
      }
    } catch {}
    console.error(`連接埠 ${port} 已由其他程式使用。請先確認占用程式，再重新啟動。`);
  } else console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(`日常工具 Dashboard：${url}`);
  console.log("僅供此 Mac 使用。按 Control+C 停止。");
  if (process.argv.includes("--open")) openBrowser();
});
