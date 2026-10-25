#!/usr/bin/env node
/**
 * 一次性工具（用完即删）：在本地模拟「GitHub Pages 子路径托管」。
 *
 * 为什么需要它：GitHub Pages 的地址是 https://<user>.github.io/<repo>/，
 * 也就是**所有站都挂在一个子路径下**。这会让「按端口拼地址」的代码全部失效
 * （hub 的五张卡片会指向 http://user.github.io:8123/ 这种不存在的地址）。
 * 在推送之前必须先在本地用同样的子路径形态验一遍，否则要等线上才发现。
 *
 * 做法：起一台服务器，把工作区整体挂到 /simrepo/ 前缀下，
 * 再让无头浏览器访问 /simrepo/hub/index.html，检查卡片链接是否变成相对路径。
 *
 * 用法：node tools/_serve_subpath.mjs <port>     （前台常驻，Ctrl+C 停）
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PREFIX = "/simrepo";          // 模拟仓库名
const PORT = Number(process.argv[2] || 8199);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(String(req.url || "/").split("?")[0]);
    if (!p.startsWith(PREFIX)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 只服务 " + PREFIX + " 前缀");
      return;
    }
    p = p.slice(PREFIX.length) || "/";
    if (p === "/") p = "/index.html";

    const target = resolve(join(WORKSPACE, normalize(p)));
    if (target !== WORKSPACE && !target.startsWith(WORKSPACE + sep)) {
      res.writeHead(403); res.end("403"); return;
    }
    const info = await stat(target).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found: " + p);
      return;
    }
    const body = await readFile(target);
    res.writeHead(200, {
      "Content-Type": MIME[extname(target).toLowerCase()] || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500); res.end("500 " + e.message);
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log("subpath sim: http://127.0.0.1:" + PORT + PREFIX + "/hub/index.html");
});
