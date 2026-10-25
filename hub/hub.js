/* ==========================================================================
   hub.js —— 统一入口页的卡片渲染与在线状态探测
   ------------------------------------------------------------------------
   设计约束（与根 README 的独立性铁律对应）：
   1. 五个站的规模数据是**静态写死**在本文件里的，不在运行时去读各站目录。
      —— 运行时读就等于反向依赖五站，删掉任一站本页就会报错。
      这些数字取自各站 README / validate 实测，改动各站内容后应同步更新这里。
   2. 在线状态探测是**纯尽力而为**：探测失败一律显示「离线」或「未知」，
      绝不让状态探测失败阻断页面渲染或入口点击。
   3. 本页可在 file:// 下双击打开：此时没有服务器可探测，状态灯显示「未知」，
      链接仍指向 127.0.0.1，需要服务已启动才有内容。
   ========================================================================== */
(function () {
  "use strict";

  /* ---- 五站的静态元数据（改各站规模后请同步：这些是展示用的快照） ---- */
  var SITES = [
    {
      key: "cs", icon: "💻", port: 8123,
      name: "计算机科学与技术",
      sub: "本科互动学习站",
      chips: ["24 门课", "169 讲", "204 实验", "677 题"],
      highlight: "系统与底层 · 考研 408"
    },
    {
      key: "math", icon: "📐", port: 8124,
      name: "基础数学",
      sub: "本科互动学习站",
      chips: ["23 门课", "130 讲", "176 实验", "516 题"],
      highlight: "分析 / 代数 / 几何"
    },
    {
      key: "physics", icon: "🔭", port: 8125,
      name: "物理学",
      sub: "本科互动学习站",
      chips: ["26 门课", "143 讲", "224 实验"],
      highlight: "仿真实验 · 力热光电"
    },
    {
      key: "philosophy", icon: "🦉", port: 8126,
      name: "哲学本科",
      sub: "互动学习站 · 离线可用",
      chips: ["17 门课", "85 讲"],
      highlight: "含单文件离线版"
    },
    {
      key: "llm", icon: "🧠", port: 8127,
      name: "LLM · Harness · Agent",
      sub: "从零基础到 2026 前沿",
      chips: ["31 门课", "226 讲", "206 实验", "684 题"],
      highlight: "原理 + 工程 + 前沿追踪"
    }
  ];

  var PROBE_TIMEOUT = 800;   // 单站探测超时（毫秒）：宁快勿准，不能让页面卡住

  /* ------------------------------------------------------------ 工具 */
  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  /** 当前访问用的主机名：手机通过局域网 IP 打开本页时，卡片也要用同一个 IP */
  function currentHost() {
    var h = location.hostname;
    // file:// 打开时 hostname 是空串，退回 127.0.0.1（并会由提示条告知需要服务）
    return h || "127.0.0.1";
  }

  function siteUrl(port) {
    return "http://" + currentHost() + ":" + port + "/index.html";
  }

  /** 判断本页是不是用 file:// 打开的（此时探测无意义） */
  function isFileProtocol() {
    return location.protocol === "file:";
  }

  /* --------------------------------------------------------- 在线探测 */
  /**
   * 探测一个站的端口是否在服务。
   * 用 no-cors 的 GET + AbortController 超时：我们只关心「有没有响应」，
   * 不读内容，所以跨端口读不到 body 也没关系。
   * 任何异常都归为「离线」，绝不上抛——状态灯不能影响页面可用性。
   */
  function probe(port, cb) {
    if (isFileProtocol()) { cb("unknown"); return; }
    var done = false;
    var ctrl = null;
    var timer = null;

    function finish(state) {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (ctrl) { try { ctrl.abort(); } catch (e) {} }
      cb(state);
    }

    try {
      ctrl = new AbortController();
      timer = setTimeout(function () { finish("down"); }, PROBE_TIMEOUT);
      fetch("http://" + currentHost() + ":" + port + "/index.html", {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        signal: ctrl.signal
      }).then(function () {
        // no-cors 下拿到的是 opaque 响应：能走到 then 就说明端口有人在听
        finish("up");
      }).catch(function () {
        finish("down");
      });
    } catch (e) {
      finish("down");
    }
  }

  /* ------------------------------------------------------------ 卡片 */
  function buildCard(site) {
    var card = el("div", "card");
    card.setAttribute("data-site", site.key);

    /* 顶部：图标 + 标题 + 状态灯 */
    var top = el("div", "card-top");

    var icon = el("div", "card-icon");
    icon.textContent = site.icon;
    top.appendChild(icon);

    var title = el("div", "card-title");
    var h2 = el("h2");
    h2.textContent = site.name;
    var p = el("p");
    p.textContent = site.sub;
    title.appendChild(h2);
    title.appendChild(p);
    top.appendChild(title);

    var dot = el("span", "dot");
    var lamp = el("i");
    var lab = document.createElement("span");
    lab.textContent = "探测中";
    dot.appendChild(lamp);
    dot.appendChild(lab);
    top.appendChild(dot);

    card.appendChild(top);

    /* 规模 chips */
    var meta = el("div", "card-meta");
    site.chips.forEach(function (c) {
      var chip = el("span", "chip");
      chip.textContent = c;
      meta.appendChild(chip);
    });
    var hl = el("span", "chip strong");
    hl.textContent = site.highlight;
    meta.appendChild(hl);
    card.appendChild(meta);

    /* 按钮：本机打开 / 手机打开 */
    var actions = el("div", "card-actions");

    var aGo = el("a", "btn primary");
    aGo.href = siteUrl(site.port);
    aGo.textContent = "打开 →";
    actions.appendChild(aGo);

    card.appendChild(actions);

    /* 探测状态并更新灯 */
    probe(site.port, function (state) {
      dot.className = "dot " + (state === "up" ? "up" : state === "down" ? "down" : "");
      lamp.className = "";
      if (state === "up") {
        lab.textContent = "在线";
        dot.title = "该端口正在服务";
      } else if (state === "down") {
        lab.textContent = "离线";
        dot.title = "该端口没有响应：可能这个站没启动";
      } else {
        lab.textContent = "未知";
        dot.title = "用 file:// 打开本页时无法探测";
      }
    });

    return card;
  }

  /* ------------------------------------------------------------ 主题 */
  function initTheme() {
    var KEY = "hub-theme:v1";
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      // 跟随系统：浅色偏好时用浅色
      var light = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
      document.documentElement.setAttribute("data-theme", light ? "light" : "dark");
    }
    var btn = document.getElementById("btnTheme");
    if (btn) {
      btn.addEventListener("click", function () {
        var cur = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", cur);
        try { localStorage.setItem(KEY, cur); } catch (e) {}
      });
    }
  }

  /* ------------------------------------------------------------ 启动 */
  function init() {
    initTheme();

    var host = document.getElementById("cards");
    SITES.forEach(function (s) { host.appendChild(buildCard(s)); });

    /* 提示条：如实说明当前环境的能力边界 */
    var tip = document.getElementById("hubTip");
    if (tip) {
      if (isFileProtocol()) {
        tip.className = "hub-tip offline";
        tip.innerHTML = "本页是用 <code>file://</code> 直接打开的：<b>状态灯全部显示「未知」</b>（没有服务器可探测）。" +
          "下面每个「打开」按钮指向本地端口，需要先启动服务（双击 <code>start-tray.vbs</code> 或 <code>start-all.cmd</code>）才有内容。";
      } else {
        var lan = currentHost();
        var isLoopback = lan === "127.0.0.1" || lan === "localhost";
        tip.innerHTML = "当前主机：<b>" + lan + "</b>" +
          (isLoopback
            ? "（本机访问）。<b>想用手机打开</b>：让手机连同一个 WiFi，然后在手机上访问本机的局域网地址，"
              + "例如 <code>http://192.168.x.x:8122/</code>——服务启动时会在窗口里打印这个地址。"
            : "（看上去是局域网地址，手机用同一个地址即可打开本页与各站）。") +
          " 状态灯每 <b>" + PROBE_TIMEOUT + " 毫秒</b>超时；显示「离线」说明那个站没启动。";
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
