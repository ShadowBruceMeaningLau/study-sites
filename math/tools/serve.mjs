// ============================================================================
//  serve.mjs —— 零依赖静态服务器（供 start-math.cmd 使用）
//  用法：node tools/serve.mjs [端口] [--lan | --host <监听地址>]
//  默认只监听 127.0.0.1（仅本机可访问）。
//  加 --lan 则监听 0.0.0.0，并把「手机/平板可以打开的局域网地址」打印出来
//  （手机需与本机连同一个 WiFi）。不加 --lan 时完全是原来的行为。
// ============================================================================
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile, rename } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { existsSync } from "node:fs";

const argv = process.argv.slice(2);
let hostArg = null;
const hostIdx = argv.indexOf("--host");
if (hostIdx >= 0) { hostArg = argv[hostIdx + 1]; argv.splice(hostIdx, 2); }
const lanIdx = argv.indexOf("--lan");
if (lanIdx >= 0) { hostArg = "0.0.0.0"; argv.splice(lanIdx, 1); }

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(argv[0] || process.env.PORT || 8124);
const HOST = hostArg || process.env.HOST || "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

/** 站点入口在 ROOT 里的相对路径（打印可直接打开的地址用） */
function entryPath() {
  if (existsSync(join(ROOT, "index.html"))) return "/index.html";
  if (existsSync(join(ROOT, "cs", "index.html"))) return "/cs/index.html";
  if (existsSync(join(ROOT, "math", "index.html"))) return "/math/index.html";
  return "/";
}

/** 本机所有局域网 IPv4 地址（手机要用这个访问） */
function lanIPv4() {
  const out = [];
  const ifs = networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const ni of ifs[name] || []) {
      if (ni.family === "IPv4" && !ni.internal) out.push({ name: name, address: ni.address });
    }
  }
  return out;
}

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(String(req.url || "/").split("?")[0].split("#")[0]);
    if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

    // ------------------------------------------------------------------
    //  学习进度同步接口（可选功能）
    //  手机和电脑都连这台服务器时，两边读写同一份进度文件，进度就是同一份。
    //  只会在 <ROOT>/.progress/ 下写一个 json，不联网、不上传任何地方。
    // ------------------------------------------------------------------
    if (urlPath.startsWith("/api/progress/")) {
      const key = urlPath.slice("/api/progress/".length);
      if (!/^[A-Za-z0-9:_-]{1,64}$/.test(key)) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("400 进度键名不合法");
        return;
      }
      const dir = join(ROOT, ".progress");
      const file = join(dir, key.replace(/:/g, "_") + ".json");

      if (req.method === "GET" || req.method === "HEAD") {
        const raw = await readFile(file, "utf8").catch(() => null);
        const body = Buffer.from(raw === null ? "null" : raw, "utf8");
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": body.length,
          "Cache-Control": "no-store"
        });
        res.end(req.method === "HEAD" ? undefined : body);
        return;
      }

      if (req.method === "POST") {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 8 * 1024 * 1024) {
            res.writeHead(413, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("413 进度数据太大");
            return;
          }
          chunks.push(chunk);
        }
        let parsed = null;
        try { parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (e) { parsed = undefined; }
        if (parsed === undefined || parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("400 进度必须是一个 JSON 对象");
          return;
        }
        await mkdir(dir, { recursive: true });
        const tmp = file + ".tmp-" + process.pid;   // 先写临时文件再改名，避免读到写了一半的内容
        await writeFile(tmp, JSON.stringify(parsed), "utf8");
        await rename(tmp, file);
        const ok = Buffer.from('{"ok":true}', "utf8");
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": ok.length,
          "Cache-Control": "no-store"
        });
        res.end(ok);
        return;
      }

      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8", "Allow": "GET, POST" });
      res.end("405 只支持 GET / POST");
      return;
    }

    // 进度目录不通过静态文件对外提供（只是整洁起见，内容本身没有隐私）
    if (urlPath.startsWith("/.progress/")) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }

    // 防目录穿越：规范化后必须仍在 ROOT 之内
    const target = resolve(join(ROOT, normalize(urlPath)));
    if (target !== ROOT && !target.startsWith(ROOT + sep)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("403 Forbidden");
      return;
    }
    const info = await stat(target).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found: " + urlPath);
      return;
    }
    const body = await readFile(target);
    res.writeHead(200, {
      "Content-Type": MIME[extname(target).toLowerCase()] || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": "no-cache"
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("500 " + String((err && err.message) || err));
  }
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error("\n[错误] 端口 " + PORT + " 已被占用，请先关掉占用它的程序，" +
      "或改用其它端口：node math\\tools\\serve.mjs 8125");
  } else {
    console.error("\n[错误] " + String((err && err.message) || err));
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const entry = entryPath();
  const lan = HOST === "0.0.0.0" || HOST === "::" ? lanIPv4() : [];
  console.log("");
  console.log("============================================================");
  console.log("  基础数学 本科学习站 已启动");
  console.log("  本机浏览器:  http://127.0.0.1:" + PORT + entry);
  if (lan.length) {
    console.log("");
    console.log("  手机 / 平板（需与本机连同一个 WiFi）:");
    for (const a of lan) console.log("    http://" + a.address + ":" + PORT + entry + "   [" + a.name + "]");
    console.log("  [注意] 同一网络下的设备都能打开这个站；不用时关掉本窗口即可。");
  } else if (HOST !== "127.0.0.1") {
    console.log("  [提示] 没找到局域网 IPv4 地址，请确认已连上 WiFi 或网线。");
  } else {
    console.log("  [提示] 现在只允许本机访问。想用手机打开：node tools\\serve.mjs " + PORT + " --lan");
  }
  console.log("  停止服务: 关闭本窗口，或按 Ctrl+C");
  console.log("============================================================");
  console.log("");
});
