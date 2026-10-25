// ============================================================================
//  serve-all.mjs —— 一次启动五个学习站 + 统一入口，并把网址（含手机可用的局域网地址）全部打印出来
//
//  用法：node tools/serve-all.mjs [--lan | --local]
//        （不带参数时默认 --lan：监听 0.0.0.0，手机/平板连同一个 WiFi 就能打开）
//
//  为什么是「多个服务」而不是「一个服务 + 多个路径」：
//  每个站用自己的端口、自己的目录当根，所以
//    · 任何一个站挂掉/端口被占，不影响另外四个；
//    · 每个站的进度各存各的（<站>/.progress/），互不干扰；
//    · 单站启动脚本（cs\start.cmd、math\start-math.cmd…）仍然各自可用，
//      它们与本站不共享代码——工作区的约定是「删掉任意一个站，其余照常运行」。
//
//  这个文件是工作区级的启动器（和 start-all.cmd 同级地位），不属于任何一个站。
// ============================================================================
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile, rename } from "node:fs/promises";
import { extname, join, normalize, resolve, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

// 本文件在 <工作区>/tools/ 下，所以工作区根是它的上一级
const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const LAN = !argv.includes("--local");
// 由托盘启动时，输出被重定向进 tools/logs/serve-all.log：
// 窗口里那套"关闭本窗口 / Ctrl+C"的提示必须换成托盘菜单的说法。
const FROM_TRAY = argv.includes("--from-tray");
const HOST = LAN ? "0.0.0.0" : "127.0.0.1";

const SITES = [
  { key: "cs", label: "计算机", dir: "cs", port: 8123 },
  { key: "math", label: "数学", dir: "math", port: 8124 },
  { key: "physics", label: "物理", dir: "physics", port: 8125 },
  { key: "philosophy", label: "哲学", dir: "philosophy", port: 8126 },
  { key: "llm", label: "AI", dir: "llm", port: 8127 },
  // 统一入口（第 6 个目录）：五张卡片点进各站。它是独立目录，五站都不引用它，
  // 所以它起不来也不影响任何学习站；反之关掉任一学习站也不影响入口页。
  { key: "hub", label: "入口", dir: "hub", port: 8122, isHub: true }
];

/** 真正提供课程内容的站（不含统一入口）：打印「N 个学习站」时用这个数 */
const STUDY = SITES.filter((s) => !s.isHub);

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
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf"
};

/** 本机所有局域网 IPv4 地址（手机要用这个访问） */
function lanIPv4() {
  const out = [];
  const ifs = networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const ni of ifs[name] || []) {
      if (ni.family === "IPv4" && !ni.internal) out.push({ name, address: ni.address });
    }
  }
  return out;
}
// WLAN / 以太网 优先排在前面（虚拟网卡如 WSL、VMware 的地址手机连不上）
function orderedLan() {
  const all = lanIPv4();
  const isVirtual = (n) => /wsl|hyper-v|vmware|virtualbox|loopback|docker|tailscale|zerotier/i.test(n);
  return all.filter((a) => !isVirtual(a.name)).concat(all.filter((a) => isVirtual(a.name)));
}

/** 为一个站建一台静态服务器（根目录 = 该站自己的目录） */
function makeServer(ROOT) {
  return createServer(async (req, res) => {
    try {
      let urlPath = decodeURIComponent(String(req.url || "/").split("?")[0].split("#")[0]);
      if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

      // 学习进度同步：手机与电脑连同一台服务器时共用一份进度。
      // 只在 <ROOT>/.progress/ 下写一个 json，不联网、不上传。
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
          const tmp = file + ".tmp-" + process.pid;
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
}

// results 按下标预占位，这样打印顺序恒等于 SITES 的顺序
// （listen 回调的先后是不保证的，不能靠 push 的次序）
const results = new Array(SITES.length).fill(null);
let pending = SITES.length;
function finish() {
  if (--pending > 0) return;

  const lan = LAN ? orderedLan() : [];
  const pad = (s, n) => s + " ".repeat(Math.max(0, n - [...s].reduce((a, c) => a + (c.charCodeAt(0) > 127 ? 2 : 1), 0)));
  const line = "=".repeat(66);

  console.log("");
  console.log(line);
  console.log("  " + STUDY.length + " 个学习站已启动" + (LAN ? "（手机 / 平板连同一个 WiFi 即可打开）" : "（仅本机可访问）"));
  console.log(line);
  for (const r of results) {
    if (!r) continue;
    if (r.error) {
      console.log("  " + pad(r.label, 10) + " 启动失败：" + r.error);
      continue;
    }
    console.log("  " + pad(r.label, 10) + " 本机  http://127.0.0.1:" + r.port + "/index.html");
    lan.forEach((a, i) => {
      console.log("  " + " ".repeat(10) + " 手机  http://" + a.address + ":" + r.port + "/index.html" +
        (i === 0 ? "   [" + a.name + "]" : ""));
    });
  }
  console.log(line);
  if (LAN && lan.length > 1) {
    console.log("  提示：每个站的第一条局域网地址是最可能可用的那个；");
    console.log("        若手机打不开，换同一站下面的另一个地址试试。");
  } else if (LAN && !lan.length) {
    console.log("  [提示] 没找到局域网 IPv4 地址，请确认已连上 WiFi 或网线。");
  }
  if (!LAN) {
    console.log(FROM_TRAY
      ? "  [提示] 想用手机打开：右键托盘图标 → 服务 → 取消勾选「仅本机访问（关掉手机访问）」"
      : "  [提示] 想用手机打开：node tools\\serve-all.mjs --lan");
  }
  console.log("  各站各自独立：某个站端口被占只影响它自己，其余照常运行。");
  console.log(FROM_TRAY
    ? "  停止全部服务：右键托盘图标 → 退出（停止服务）"
    : "  停止全部服务：关闭本窗口，或按 Ctrl+C");
  console.log(line);
  console.log("");
}

SITES.forEach((site, i) => {
  const ROOT = join(WORKSPACE, site.dir);
  const server = makeServer(ROOT);
  server.on("error", (err) => {
    results[i] = {
      label: site.label,
      port: site.port,
      error: err && err.code === "EADDRINUSE"
        ? "端口 " + site.port + " 已被占用（可能这个站已经在运行了）"
        : String((err && err.message) || err)
    };
    finish();
  });
  server.listen(site.port, HOST, () => {
    results[i] = { label: site.label, port: site.port };
    finish();
  });
});

