/* ==========================================================================
   labs.js —— 交互式实验组件（零依赖，全部在前端实时计算）
   pathlab / schedlab / cpulab / pagelab / arbitlab / datalab / tokenlab / attnlab / samplab
   （LLM 站新增六类实验 tokenlab/attnlab/samplab/ragsteps/agenttrace/protolab 随波次加入）
   每个渲染函数签名：render(host, config, ctx)  ctx = { onInteract }
   ========================================================================== */
(function (global) {
  "use strict";

  var Colors = ["#5aa9ff", "#7d7bff", "#45d19a", "#ffc55c", "#ff9a76", "#7ad3ff", "#c58bff", "#ff7ab6"];

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }
  function btn(label, cls) {
    var b = document.createElement("button");
    b.className = "btn sm " + (cls || "");
    b.textContent = label;
    var _c = b.addEventListener.bind(b);
    void _c;
    return b;
  }
  function on(node, ev, fn) {
    node.addEventListener(ev, fn);
    return node;
  }
  function num(v) { return Number(v); }
  function fmt(x) { return Number.isInteger(x) ? String(x) : Number(x).toFixed(2); }

  /* ====================================================== 1. pathlab 寻路 */
  function renderPathlab(host, cfg, ctx) {
    var grid = cfg.grid || [];
    var h = grid.length, w = h ? grid[0].length : 0;
    var start = cfg.start || [0, 0], end = cfg.end || [h - 1, w - 1];
    var DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    var passable = function (r, c) { return r >= 0 && r < h && c >= 0 && c < w && grid[r][c] !== 0; };

    function bfs() {
      var dist = {}, prev = {}, order = [];
      var q = [start];
      dist[start.join(",")] = 0;
      while (q.length) {
        var cur = q.shift();
        order.push(cur);
        if (cur[0] === end[0] && cur[1] === end[1]) break;
        for (var i = 0; i < 4; i++) {
          var nr = cur[0] + DIRS[i][0], nc = cur[1] + DIRS[i][1], k = nr + "," + nc;
          if (passable(nr, nc) && !(k in dist)) { dist[k] = dist[cur.join(",")] + 1; prev[k] = cur; q.push([nr, nc]); }
        }
      }
      return { dist: dist, prev: prev, order: order };
    }

    function dijkstra() {
      var dist = {}, prev = {}, order = [], done = {};
      dist[start.join(",")] = 0;
      var pq = [[0, start]];
      while (pq.length) {
        pq.sort(function (a, b) { return a[0] - b[0]; });
        var top = pq.shift(), d = top[0], cur = top[1], ck = cur.join(",");
        if (done[ck]) continue;
        done[ck] = true;
        order.push(cur);
        if (cur[0] === end[0] && cur[1] === end[1]) break;
        for (var i = 0; i < 4; i++) {
          var nr = cur[0] + DIRS[i][0], nc = cur[1] + DIRS[i][1], k = nr + "," + nc;
          if (!passable(nr, nc)) continue;
          var nd = d + grid[nr][nc];
          if (!(k in dist) || nd < dist[k]) { dist[k] = nd; prev[k] = cur; pq.push([nd, [nr, nc]]); }
        }
      }
      return { dist: dist, prev: prev, order: order };
    }

    var algo = cfg.algo === "dijkstra" ? "dijkstra" : "bfs";
    var result = algo === "dijkstra" ? dijkstra() : bfs();
    var path = [], k = end.join(",");
    if (k in result.dist) {
      var cur = end;
      while (cur) { path.unshift(cur); cur = result.prev[cur.join(",")]; }
    }

    var bar = el("div", "lab-bar");
    var cells = [];
    var gridBox = el("div", "grid-lab");
    gridBox.style.gridTemplateColumns = "repeat(" + w + ", 34px)";
    for (var r = 0; r < h; r++) {
      for (var c = 0; c < w; c++) {
        var cell = el("div", "cell");
        var isS = r === start[0] && c === start[1];
        var isE = r === end[0] && c === end[1];
        if (grid[r][c] === 0) { cell.className = "cell wall"; cell.textContent = ""; }
        else {
          cell.textContent = isS ? "S" : isE ? "E" : String(grid[r][c]);
          if (isS) cell.className = "cell start";
          if (isE) cell.className = "cell end";
        }
        cell.dataset.key = r + "," + c;
        gridBox.appendChild(cell);
        cells.push(cell);
      }
    }
    var cellAt = {};
    cells.forEach(function (c2) { cellAt[c2.dataset.key] = c2; });

    var info = el("div", "lab-stat");
    var stepBox = el("div", "lab-note", "");

    var algoBox = el("div", "lab-bar");
    ["bfs", "dijkstra"].forEach(function (a) {
      var b = btn(a === "bfs" ? "BFS（无权最短）" : "Dijkstra（带权最短路）", a === algo ? "ok" : "ghost");
      on(b, "click", function () { ctx.rerender({ lab: "pathlab", title: "", config: Object.assign({}, cfg, { algo: a }) }); });
      algoBox.appendChild(b);
    });

    var t = 0, timer = null;
    function paint(step) {
      cells.forEach(function (c2) { c2.classList.remove("visited", "path", "cur"); });
      for (var i = 0; i < Math.min(step, result.order.length); i++) {
        var key = result.order[i].join(",");
        if (cellAt[key]) cellAt[key].classList.add("visited");
      }
      if (step >= result.order.length) {
        path.forEach(function (p) { cellAt[p.join(",")].classList.add("path"); });
        var cost = 0;
        for (var j = 1; j < path.length; j++) cost += grid[path[j][0]][path[j][1]];
        info.textContent = path.length
          ? "路径长度 " + path.length + " 格 ｜ 累计代价 " + cost + " ｜ 扩展节点 " + result.order.length + " 个"
          : "不可达：" + (algo === "bfs" ? "BFS" : "Dijkstra") + " 扩展了 " + result.order.length + " 个节点仍未到达终点";
      } else if (step > 0) {
        cellAt[result.order[step - 1].join(",")].classList.add("cur");
        info.textContent = "已扩展 " + step + " 个节点 ｜ 当前：" + result.order[step - 1].join(",");
      } else info.textContent = "点击「单步」或「播放」开始";
      stepBox.textContent = "格子里的数字 = 进入该格的代价（1 最小）；BFS 只看格数，Dijkstra 看代价总和 —— 对比同一张图上的路径差异。";
    }

    var bStep = btn("▶ 单步"), bPlay = btn("⏵ 播放"), bReset = btn("↺ 重置", "ghost");
    on(bStep, "click", function () { if (t < result.order.length) { t++; paint(t); } ctx.onInteract(); });
    on(bReset, "click", function () { t = 0; if (timer) { clearInterval(timer); timer = null; bPlay.textContent = "⏵ 播放"; } paint(0); });
    on(bPlay, "click", function () {
      if (timer) { clearInterval(timer); timer = null; bPlay.textContent = "⏵ 播放"; return; }
      bPlay.textContent = "⏸ 暂停";
      timer = setInterval(function () {
        if (t >= result.order.length) { clearInterval(timer); timer = null; bPlay.textContent = "⏵ 播放"; return; }
        t++; paint(t);
      }, 180);
      ctx.onInteract();
    });

    bar.appendChild(bStep); bar.appendChild(bPlay); bar.appendChild(bReset);
    bar.appendChild(el("div", "spacer"));
    bar.appendChild(info);

    host.appendChild(algoBox);
    host.appendChild(bar);
    var body = el("div", "lab-panel");
    body.style.overflowX = "auto";
    body.appendChild(gridBox);
    host.appendChild(body);
    host.appendChild(stepBox);
    paint(0);
  }

  /* ============================================ 2. schedlab 调度 / Gantt */
  function buildTimeline(procs, algo, quantum) {
    var tl = [];
    var ps = procs.map(function (p, i) {
      return { name: p.name, arrival: num(p.arrival), burst: num(p.burst), left: num(p.burst), prio: num(p.prio == null ? i + 1 : p.prio), start: -1, end: -1, id: i };
    });
    var t = 0, done = 0, n = ps.length, guard = 0;
    var ready = [];
    var pushArrivals = function (upto) { ps.forEach(function (p) { if (p.arrival <= upto && p.left > 0 && ready.indexOf(p) < 0 && !p.inQ) { ready.push(p); p.inQ = true; } }); };
    ps.forEach(function (p) { p.inQ = false; });

    if (algo === "RR") {
      var q = [], qFlag = {};
      var arrivalOrder = ps.slice().sort(function (a, b) { return a.arrival - b.arrival || a.id - b.id; });
      var ai = 0;
      var last = null;
      while (done < n && guard++ < 5000) {
        while (ai < n && arrivalOrder[ai].arrival <= t) { q.push(arrivalOrder[ai]); qFlag[arrivalOrder[ai].id] = true; ai++; }
        if (!q.length) {
          if (last && last.end === t) { last.idle = true; }
          tl.push({ name: "空闲", from: t, to: arrivalOrder[ai].arrival });
          t = arrivalOrder[ai].arrival;
          continue;
        }
        var cur = q.shift();
        qFlag[cur.id] = false;
        if (cur.start < 0) cur.start = t;
        var run = Math.min(quantum, cur.left);
        tl.push({ name: cur.name, from: t, to: t + run, slice: true });
        t += run; cur.left -= run;
        if (cur.left === 0) { cur.end = t; done++; }
        while (ai < n && arrivalOrder[ai].arrival <= t) { q.push(arrivalOrder[ai]); qFlag[arrivalOrder[ai].id] = true; ai++; }
        if (cur.left > 0) q.push(cur);
      }
      return { tl: tl, ps: ps };
    }

    var current = null;
    while (done < n && guard++ < 5000) {
      pushArrivals(t);
      // 过滤已完成的
      var cands = ps.filter(function (p) { return p.arrival <= t && p.left > 0 && !p.finished; });
      if (!cands.length) {
        var nxt = ps.filter(function (p) { return p.left > 0; }).sort(function (a, b) { return a.arrival - b.arrival; })[0];
        tl.push({ name: "空闲", from: t, to: nxt.arrival });
        t = nxt.arrival;
        current = null;
        continue;
      }
      var pick;
      if (algo === "FCFS") pick = cands.slice().sort(function (a, b) { return a.arrival - b.arrival || a.id - b.id; })[0];
      else if (algo === "SJF") pick = cands.slice().sort(function (a, b) { return a.burst - b.burst || a.arrival - b.arrival || a.id - b.id; })[0];
      else if (algo === "SRTF") pick = cands.slice().sort(function (a, b) { return a.left - b.left || a.arrival - b.arrival || a.id - b.id; })[0];
      else if (algo === "优先级") pick = cands.slice().sort(function (a, b) { return a.prio - b.prio || a.arrival - b.arrival || a.id - b.id; })[0];
      else pick = cands[0];

      if (pick !== current) {
        if (current && current.left > 0) tl.push({ name: current.name, from: current._t0, to: t });
        else if (current && current.left === 0) { /* 已结束 */ }
        current = pick;
        current._t0 = t;
        if (current.start < 0) current.start = t;
      }
      // 推进到下一个事件点
      var nextArrival = ps.filter(function (p) { return p.arrival > t && p.left > 0; })
        .sort(function (a, b) { return a.arrival - b.arrival; })[0];
      var canRun = (algo === "FCFS" || algo === "SJF" || algo === "优先级");
      var step = canRun ? current.left : 1;
      if (!canRun && nextArrival) step = Math.min(step, nextArrival.arrival - t);
      // SRTF 逐单位推进即可
      current.left -= step;
      t += step;
      if (current.left === 0) {
        current.end = t;
        current.finished = true;
        done++;
        tl.push({ name: current.name, from: current._t0, to: t });
        current = null;
      }
    }
    void ready;
    return { tl: tl, ps: ps };
  }

  function metrics(ps, tl) {
    var total = 0, wait = 0, n = ps.length;
    var finish = {}, firstStart = {};
    tl.forEach(function (s) {
      if (s.name === "空闲") return;
      finish[s.name] = Math.max(finish[s.name] || 0, s.to);
      if (firstStart[s.name] == null) firstStart[s.name] = s.from;
    });
    ps.forEach(function (p) {
      var f = finish[p.name];
      total += f - p.arrival;
      wait += f - p.arrival - p.burst;
    });
    return { avgTurn: total / n, avgWait: wait / n, finish: finish, firstStart: firstStart };
  }

  function renderSchedlab(host, cfg, ctx) {
    var procs = cfg.procs || [];
    var quantum = num(cfg.quantum || 2);
    var algos = cfg.algos && cfg.algos.length ? cfg.algos : ["FCFS", "SJF", "RR"];
    var pick = algos[0];

    var bar = el("div", "lab-bar");
    var holder = el("div");
    var note = el("div", "lab-note", "带权周转时间 = 周转时间 / 服务时间；时间片轮转的时间片 q = " + quantum + "。");

    function draw() {
      holder.innerHTML = "";
      var built = buildTimeline(procs, pick, quantum);
      var m = metrics(built.ps, built.tl);
      var total = built.tl.length ? built.tl[built.tl.length - 1].to : 0;

      var wrap = el("div", "gantt");
      var axis = el("div", "gantt-axis");
      for (var i = 0; i < total; i++) axis.appendChild(el("span", null, String(i)));
      wrap.appendChild(axis);

      var row = el("div", "gantt-row");
      row.appendChild(el("div", "nm", "CPU"));
      var track = el("div", "gantt-track");
      built.tl.forEach(function (s) {
        var seg = el("div", "gantt-cell", s.name === "空闲" ? "" : s.name);
        seg.style.flex = String(s.to - s.from);
        var idx = procs.findIndex(function (p) { return p.name === s.name; });
        seg.style.background = s.name === "空闲" ? "repeating-linear-gradient(45deg,#2a3140,#2a3140 4px,#232a36 4px,#232a36 8px)" : Colors[(idx < 0 ? 0 : idx) % Colors.length];
        seg.title = s.name + "：" + s.from + " → " + s.to;
        track.appendChild(seg);
      });
      row.appendChild(track);
      wrap.appendChild(row);

      // 每个进程一行甘特（标出运行区间）
      built.ps.forEach(function (p, pi) {
        var r2 = el("div", "gantt-row");
        r2.appendChild(el("div", "nm", p.name));
        var tr2 = el("div", "gantt-track");
        for (var tt = 0; tt < total; tt++) {
          var busy = built.tl.some(function (s) { return s.name === p.name && s.from <= tt && s.to > tt; });
          var cell = el("div", "gantt-cell");
          cell.style.flex = "1";
          cell.style.background = busy ? Colors[pi % Colors.length] : "transparent";
          tr2.appendChild(cell);
        }
        r2.appendChild(tr2);
        wrap.appendChild(r2);
      });
      holder.appendChild(wrap);

      var tbl = el("table", "mini");
      tbl.innerHTML = "<tr><th>进程</th><th>到达</th><th>服务</th>" + (pick === "优先级" ? "<th>优先级</th>" : "") + "<th>完成</th><th>周转</th><th>带权周转</th></tr>";
      var tt2 = 0, tw2 = 0;
      built.ps.forEach(function (p) {
        var f = m.finish[p.name];
        var turn = f - p.arrival, wturn = turn / p.burst;
        tt2 += turn; tw2 += wturn;
        var tr3 = el("tr");
        tr3.innerHTML = "<td>" + p.name + "</td><td>" + p.arrival + "</td><td>" + p.burst + "</td>" +
          (pick === "优先级" ? "<td>" + p.prio + "</td>" : "") +
          "<td>" + f + "</td><td>" + turn + "</td><td>" + fmt(wturn) + "</td>";
        tbl.appendChild(tr3);
      });
      holder.appendChild(el("div", "lab-bar")).appendChild(el("div", "lab-stat",
        "平均周转时间 " + fmt(m.avgTurn) + " ｜ 平均带权周转时间 " + fmt(tt2 / built.ps.length) + " ｜ 平均等待时间 " + fmt(m.avgWait)));
      holder.appendChild(tbl);
    }

    algos.forEach(function (a) {
      var b = btn(a, a === pick ? "ok" : "ghost");
      on(b, "click", function () {
        pick = a;
        Array.prototype.forEach.call(bar.querySelectorAll("button"), function (x) { x.className = "btn sm ghost"; });
        b.className = "btn sm ok";
        draw();
        ctx.onInteract();
      });
      bar.appendChild(b);
    });

    host.appendChild(bar);
    host.appendChild(holder);
    host.appendChild(note);
    draw();
  }

  /* ===================================================== 3. cpulab 指令执行 */
  function renderCpulab(host, cfg, ctx) {
    var regs = Object.assign({}, cfg.regs || {});
    var mem = Object.assign({}, cfg.mem || {});
    var prog = (cfg.program || []).map(function (p) {
      var asm = String(p.asm || "");
      var codePart = asm.split("/")[0].trim();
      return { asm: asm, code: codePart, note: p.note || "", raw: p };
    });

    function parseOperand(tok) {
      tok = String(tok).trim().replace(/,$/, "");
      if (/^\[.*\]$/.test(tok)) {
        var inner = tok.slice(1, -1).trim();
        if (/^0x[0-9a-f]+$/i.test(inner)) return { kind: "mem", addr: parseInt(inner, 16), label: tok };
        if (/^\d+$/.test(inner)) return { kind: "mem", addr: parseInt(inner, 10), label: tok };
        return { kind: "memreg", reg: inner, label: tok };
      }
      if (/^R\d+$/i.test(tok)) return { kind: "reg", reg: tok.toUpperCase(), label: tok };
      if (/^0x[0-9a-f]+$/i.test(tok)) return { kind: "imm", value: parseInt(tok, 16), label: tok };
      if (/^-?\d+$/.test(tok)) return { kind: "imm", value: parseInt(tok, 10), label: tok };
      if (tok === "") return { kind: "none", label: "" };
      return { kind: "label", label: tok };
    }
    function read(op) {
      if (!op) return 0;
      if (op.kind === "reg") return num(regs[op.reg] || 0);
      if (op.kind === "imm") return op.value;
      if (op.kind === "mem") return num(mem["0x" + op.addr.toString(16)] != null ? mem["0x" + op.addr.toString(16)] : 0);
      if (op.kind === "memreg") return num(mem["0x" + num(regs[op.reg] || 0).toString(16)] || 0);
      return 0;
    }
    function addrKey(op) {
      if (op.kind === "mem") return "0x" + op.addr.toString(16);
      if (op.kind === "memreg") return "0x" + num(regs[op.reg] || 0).toString(16);
      return null;
    }

    function stepOnce(pcState) {
      if (pcState.pc >= prog.length) return { done: true, desc: "程序结束（PC 越界）" };
      var ins = prog[pcState.pc];
      var parts = ins.code.split(/\s+/);
      var op = String(parts[0] || "").toUpperCase();
      var operands = ins.code.split(/\s+/).slice(1).join(" ").split(",").map(parseOperand);
      var desc = ins.code;
      var pcNext = pcState.pc + 1;

      if (op === "LOAD") { regs[operands[0].reg] = read(operands[1]); desc += "  →  " + operands[0].reg + " = " + regs[operands[0].reg]; }
      else if (op === "STORE") { var k = addrKey(operands[1]); if (k) mem[k] = read(operands[0]); desc += "  →  " + k + " = " + read(operands[0]); }
      else if (op === "MOV") { regs[operands[0].reg] = read(operands[1]); desc += "  →  " + operands[0].reg + " = " + regs[operands[0].reg]; }
      else if (op === "ADD") { regs[operands[0].reg] = num(regs[operands[0].reg] || 0) + read(operands[1]); desc += "  →  " + operands[0].reg + " = " + regs[operands[0].reg]; }
      else if (op === "SUB") { regs[operands[0].reg] = num(regs[operands[0].reg] || 0) - read(operands[1]); desc += "  →  " + operands[0].reg + " = " + regs[operands[0].reg]; }
      else if (op === "INC") { regs[operands[0].reg] = num(regs[operands[0].reg] || 0) + 1; desc += "  →  " + operands[0].reg + " = " + regs[operands[0].reg]; }
      else if (op === "DEC") { regs[operands[0].reg] = num(regs[operands[0].reg] || 0) - 1; desc += "  →  " + operands[0].reg + " = " + regs[operands[0].reg]; }
      else if (op === "CMP") { pcState.lastCmp = read(operands[0]) - read(operands[1]); desc += "  →  标志 = " + (pcState.lastCmp === 0 ? "ZF(=)" : pcState.lastCmp < 0 ? "SF(<)" : ">0"); }
      else if (op === "JMP") { pcNext = prog.findIndex(function (p) { return p.code.split(/[\s,]+/).indexOf(operands[0].label) >= 0; }); if (pcNext < 0) pcNext = pcState.pc + 1; desc += "  →  PC = " + pcNext; }
      else if (op === "JZ" || op === "JE") { var jk = prog.findIndex(function (p) { return p.code.split(/[\s,]+/).indexOf(operands[0].label) >= 0; }); if (pcState.lastCmp === 0 && jk >= 0) pcNext = jk; desc += "  →  " + (pcState.lastCmp === 0 ? "跳转到 " + pcNext : "不跳转"); }
      else if (op === "JNZ" || op === "JNE") { var jk2 = prog.findIndex(function (p) { return p.code.split(/[\s,]+/).indexOf(operands[0].label) >= 0; }); if (pcState.lastCmp !== 0 && jk2 >= 0) pcNext = jk2; desc += "  →  " + (pcState.lastCmp !== 0 ? "跳转到 " + pcNext : "不跳转"); }
      else if (op === "PUSH") { pcState.stack.push(read(operands[0])); desc += "  →  栈顶 = " + pcState.stack[pcState.stack.length - 1]; }
      else if (op === "POP") { var v = pcState.stack.pop(); if (operands[0] && operands[0].reg) regs[operands[0].reg] = num(v == null ? 0 : v); desc += "  →  " + (operands[0] ? operands[0].reg : "?") + " = " + (v == null ? 0 : v); }
      else if (op === "CALL") { pcState.stack.push(pcState.pc + 1); var ck = prog.findIndex(function (p) { return p.code.split(/[\s,]+/).indexOf(operands[0].label) >= 0; }); if (ck >= 0) pcNext = ck; desc += "  →  压入返回地址 " + (pcState.pc + 1); }
      else if (op === "RET") { var ra = pcState.stack.pop(); if (ra != null) pcNext = num(ra); desc += "  →  返回 " + pcNext; }
      else if (op === "HLT" || op === "NOP") { desc += "  →  停机/空操作"; if (op === "HLT") pcState.halt = true; }
      else desc += "  →  （演示指令：仅展示语义）";

      pcState.pc = pcNext;
      if (pcState.halt || pcState.pc >= prog.length) pcState.halt = true;
      return { done: pcState.halt, desc: desc, insIndex: pcState.pc - 1 };
    }

    var pcState = { pc: 0, stack: [], lastCmp: null, halt: false };
    var hist = [];
    function snapshot(desc) {
      hist.push({
        desc: desc,
        state: Object.assign({ PC: pcState.pc, 栈: pcState.stack.length ? pcState.stack.join(",") : "空" }, regs, mem)
      });
    }
    snapshot("初始状态：PC=0，等待取指");
    var guard = 0;
    while (!pcState.halt && guard++ < 60) {
      var r = stepOnce(pcState);
      snapshot(r.desc);
    }

    var idx = 0;
    var bar = el("div", "lab-bar");
    var bPrev = btn("‹ 上一步", "ghost"), bNext = btn("下一步 ›"), bPlay = btn("⏵ 自动"), bReset = btn("↺ 重置", "ghost");
    var stat = el("div", "lab-stat");
    var body;
    var codeBox = el("div", "lab-panel");
    var stateBox = el("div", "lab-panel");
    var ganttLike = el("div");

    function draw() {
      var h = hist[Math.min(idx, hist.length - 1)];
      codeBox.innerHTML = "";
      var tbl = el("table", "mini");
      tbl.style.width = "100%";
      tbl.innerHTML = "<tr><th>#</th><th style='text-align:left'>指令 / 阶段</th></tr>";
      prog.forEach(function (p, i) {
        var tr = el("tr");
        var active = h.state.PC === i;
        tr.innerHTML = "<td>" + i + "</td><td style='text-align:left" + (active ? ";background:rgba(90,169,255,.18)" : "") + "'>" + (active ? "▶ " : "") + MD.escapeHtml(p.code) + "</td>";
        tbl.appendChild(tr);
      });
      codeBox.appendChild(tbl);

      stateBox.innerHTML = "";
      var kv = el("div", "kv");
      Object.keys(h.state).forEach(function (k2) {
        kv.appendChild(el("div", "item", "<div class='k'>" + k2 + "</div><div class='v'>" + MD.escapeHtml(String(h.state[k2])) + "</div>"));
      });
      stateBox.appendChild(el("div", "lab-stat", "第 " + idx + " / " + (hist.length - 1) + " 步"));
      stateBox.appendChild(kv);
      var cur = prog[Math.min(Math.max(0, h.state.PC - 1), prog.length - 1)];
      stat.textContent = h.desc;
      ganttLike.innerHTML = cur && cur.note ? "<div class='lab-note'>🔍 " + MD.mathText(cur.note) + "</div>" : "";
    }

    var timer2 = null;
    on(bNext, "click", function () { if (idx < hist.length - 1) { idx++; draw(); } ctx.onInteract(); });
    on(bPrev, "click", function () { if (idx > 0) { idx--; draw(); } });
    on(bReset, "click", function () { idx = 0; if (timer2) { clearInterval(timer2); timer2 = null; bPlay.textContent = "⏵ 自动"; } draw(); });
    on(bPlay, "click", function () {
      if (timer2) { clearInterval(timer2); timer2 = null; bPlay.textContent = "⏵ 自动"; return; }
      bPlay.textContent = "⏸ 暂停";
      timer2 = setInterval(function () {
        if (idx >= hist.length - 1) { clearInterval(timer2); timer2 = null; bPlay.textContent = "⏵ 自动"; return; }
        idx++; draw();
      }, 700);
      ctx.onInteract();
    });

    bar.appendChild(bPrev); bar.appendChild(bNext); bar.appendChild(bPlay); bar.appendChild(bReset);
    bar.appendChild(el("div", "spacer")); bar.appendChild(stat);
    host.appendChild(bar);
    var cols = el("div");
    cols.style.display = "grid";
    cols.style.gridTemplateColumns = "minmax(0,1.1fr) minmax(0,1fr)";
    cols.style.gap = "10px";
    cols.appendChild(codeBox); cols.appendChild(stateBox);
    host.appendChild(cols);
    host.appendChild(ganttLike);
    if (cfg.legend) host.appendChild(el("div", "lab-note", MD.mathText(cfg.legend)));
    draw();
  }

  /* ===================================================== 4. pagelab 页面置换 */
  function runPage(refs, frames, algo) {
    var fr = new Array(frames).fill(null);
    var rows = [], faults = 0, hits = 0;
    var fifoQ = [], used = {}, counters = {}, clockPtr = 0, refBits = new Array(frames).fill(0), loaded = {};
    for (var i = 0; i < refs.length; i++) {
      var page = refs[i];
      var hit = fr.indexOf(page) >= 0;
      var victim = null, victimIdx = -1;
      if (hit) {
        hits++;
        used[page] = i;
        if (algo === "CLOCK") refBits[fr.indexOf(page)] = 1;
      } else {
        faults++;
        if (fr.indexOf(null) >= 0) victimIdx = fr.indexOf(null);
        else if (algo === "FIFO") { victim = fifoQ.shift(); victimIdx = fr.indexOf(victim); }
        else if (algo === "LRU") {
          var lru = Infinity;
          fr.forEach(function (p, k) { var u = p == null ? -1 : (used[p] == null ? -1 : used[p]); if (u < lru) { lru = u; victimIdx = k; } });
          victim = fr[victimIdx];
        } else if (algo === "OPT") {
          var far = -1;
          fr.forEach(function (p, k) {
            var nxt = refs.indexOf(p, i + 1);
            if (nxt < 0) nxt = Infinity;
            if (nxt > far) { far = nxt; victimIdx = k; }
          });
          victim = fr[victimIdx];
        } else if (algo === "CLOCK") {
          var guard = 0;
          while (guard++ < frames * 3) {
            if (refBits[clockPtr] === 0) { victimIdx = clockPtr; break; }
            refBits[clockPtr] = 0;
            clockPtr = (clockPtr + 1) % frames;
          }
          if (victimIdx < 0) victimIdx = clockPtr;
          victim = fr[victimIdx];
          clockPtr = (victimIdx + 1) % frames;
        }
        if (victim != null) { delete loaded[victim]; var qi = fifoQ.indexOf(victim); if (qi >= 0) fifoQ.splice(qi, 1); used[victim] = -1; }
        fr[victimIdx] = page;
        if (algo !== "CLOCK") fifoQ.push(page);
        refBits[victimIdx] = 1;
        used[page] = i;             // LRU 必须记录新装入页的最近使用时刻，否则下一次会误淘汰它
        loaded[page] = true;
      }
      rows.push({ ref: page, hit: hit, frames: fr.slice(), victim: victim });
    }
    return { rows: rows, faults: faults, hits: hits };
  }

  function renderPagelab(host, cfg, ctx) {
    var refs = cfg.refs || [];
    var frames = num(cfg.frames || 3);
    var algos = cfg.algos && cfg.algos.length ? cfg.algos : ["FIFO", "LRU"];
    var res = {};
    algos.forEach(function (a) { res[a] = runPage(refs, frames, a); });

    var bar = el("div", "lab-bar");
    var holder = el("div");
    var summary = el("div", "lab-stat");
    var cur = algos[0];

    function drawSummary() {
      summary.innerHTML = algos.map(function (a) {
        var d = res[a];
        return "「" + a + "」缺页 " + d.faults + " 次（缺页率 " + ((d.faults / refs.length) * 100).toFixed(1) + "%）";
      }).join("　｜　");
    }
    function draw() {
      holder.innerHTML = "";
      var d = res[cur];
      var tbl = el("table", "mini");
      var head = "<tr><th>访问页</th>";
      for (var f = 0; f < frames; f++) head += "<th>页框 " + f + "</th>";
      head += "<th>结果</th></tr>";
      tbl.innerHTML = head;
      d.rows.forEach(function (r) {
        var tr = el("tr");
        tr.innerHTML = "<td>" + r.ref + "</td>" + r.frames.map(function (p) {
          return "<td>" + (p == null ? "–" : p) + "</td>";
        }).join("") + "<td class='" + (r.hit ? "hit" : "miss") + "'>" + (r.hit ? "命中" : "缺页" + (r.victim != null ? "（淘汰 " + r.victim + "）" : "")) + "</td>";
        tbl.appendChild(tr);
      });
      holder.appendChild(tbl);
      var kv = el("div", "lab-bar");
      kv.appendChild(el("div", "lab-stat", "算法 " + cur + "：缺页 " + d.faults + " 次，命中 " + d.hits + " 次，缺页率 " + ((d.faults / refs.length) * 100).toFixed(1) + "%"));
      holder.appendChild(kv);
    }

    algos.forEach(function (a) {
      var b = btn(a, a === cur ? "ok" : "ghost");
      on(b, "click", function () {
        cur = a;
        Array.prototype.forEach.call(bar.querySelectorAll("button"), function (x) { x.className = "btn sm ghost"; });
        b.className = "btn sm ok";
        draw(); drawSummary(); ctx.onInteract();
      });
      bar.appendChild(b);
    });
    host.appendChild(bar);
    host.appendChild(summary);
    host.appendChild(holder);
    if (cfg.legend) host.appendChild(el("div", "lab-note", MD.mathText(cfg.legend)));
    draw(); drawSummary();
  }

  /* ====================================================== 5. arbitlab 位模式 */
  function renderArbitlab(host, cfg, ctx) {
    var bits = num(cfg.bits || 8);
    var arr = new Array(bits).fill(0);
    var modes = cfg.modes && cfg.modes.length ? cfg.modes : ["无符号", "原码", "反码", "补码", "移码"];
    var bar = el("div", "lab-bar");
    var bitBox = el("div");
    var kv = el("div", "kv");
    var note = el("div", "lab-note", cfg.legend || "点击每一位切换 0/1；下方同步给出该位模式在不同编码下的解释。");

    function valueOf() {
      var s = arr.join("");
      return parseInt(s || "0", 2);
    }
    function toBits(v) {
      var s = (v >>> 0).toString(2);
      return s.slice(-bits).padStart(bits, "0");
    }
    function twosValue() {
      var u = valueOf();
      var half = Math.pow(2, bits - 1);
      return u >= half ? u - Math.pow(2, bits) : u;
    }
    function render() {
      bitBox.innerHTML = "";
      var row = el("div", "bit-row");
      var idxRow = el("div", "bit-row");
      arr.forEach(function (b, i) {
        var btn2 = el("button", "bit" + (b ? " on" : ""), String(b));
        on(btn2, "click", function () { arr[i] = arr[i] ? 0 : 1; render(); ctx.onInteract(); });
        row.appendChild(btn2);
        var ix = el("div", "bit-idx", String(bits - 1 - i));
        ix.style.width = "32px";
        idxRow.appendChild(ix);
      });
      bitBox.appendChild(row);
      bitBox.appendChild(idxRow);

      var u = valueOf();
      var sign = arr[0];
      var mag = parseInt(arr.slice(1).join("") || "0", 2);
      var inv = parseInt(arr.slice(1).map(function (x) { return x ? "0" : "1"; }).join("") || "0", 2);
      var biasKey = "移码（偏置 " + Math.pow(2, bits - 1) + "）";
      var data = {
        "二进制": arr.join(""),
        "十六进制": "0x" + u.toString(16).toUpperCase(),
        "无符号": String(u),
        "原码值": (sign ? "-" : "+") + mag,
        "反码值": sign ? String(-inv) : String(mag),
        "补码值": String(twosValue()),
        "位数": bits + " 位，可表示范围（补码）: " + (-Math.pow(2, bits - 1)) + " ~ " + (Math.pow(2, bits - 1) - 1)
      };
      data[biasKey] = String(u - Math.pow(2, bits - 1));
      if (bits === 32) {
        var exp = parseInt(arr.slice(1, 9).join(""), 2);
        var frac = parseInt(arr.slice(9).join(""), 2) / Math.pow(2, 23);
        var val = exp === 0 ? Math.pow(-1, sign) * frac * Math.pow(2, -126)
          : exp === 255 ? (frac === 0 ? (sign ? "-∞" : "+∞") : "NaN")
            : Math.pow(-1, sign) * (1 + frac) * Math.pow(2, exp - 127);
        data["IEEE754 单精度"] = "符号 " + sign + " / 阶码 " + exp + " / 尾数 " + arr.slice(9).join("") + " → " + (typeof val === "number" ? val.toExponential(6) : val);
      }
      kv.innerHTML = "";
      var modeWanted = function (prefix) {
        return modes.some(function (m) { return m.indexOf(prefix) === 0; });
      };
      var show = Object.keys(data).filter(function (k) {
        if (k === "原码值" || k === "反码值" || k === "补码值" || k === biasKey) {
          return modeWanted(k.indexOf("移码") === 0 ? "移码" : k.slice(0, 2));
        }
        if (k === "IEEE754 单精度") return modeWanted("IEEE754") || bits === 32;
        return true;
      });
      show.forEach(function (k) { kv.appendChild(el("div", "item", "<div class='k'>" + k + "</div><div class='v'>" + MD.escapeHtml(String(data[k])) + "</div>")); });
    }

    var presets = [
      { n: "全 0", v: function () { return new Array(bits).fill(0); } },
      { n: "最小负数（补码）", v: function () { return ("1" + new Array(bits).fill(0).join("")).slice(-bits).split("").map(Number); } },
      { n: "最大正数（补码）", v: function () { return ("0" + new Array(bits).fill(1).join("")).slice(-bits).split("").map(Number); } },
      { n: "-1 的补码", v: function () { return new Array(bits).fill(1); } },
      { n: "+127", v: function () { return toBits(127).split("").map(Number); } },
      { n: "-128", v: function () { return toBits(128).split("").map(Number); } }
    ];
    presets.forEach(function (p) {
      var b = btn(p.n, "ghost");
      on(b, "click", function () { var nv = p.v(); for (var i = 0; i < bits; i++) arr[i] = nv[i] || 0; render(); ctx.onInteract(); });
      bar.appendChild(b);
    });
    host.appendChild(bar);
    host.appendChild(bitBox);
    host.appendChild(kv);
    host.appendChild(note);
    render();
  }

  /* ========================================== 7. tokenlab：BPE 逐步合并 */
  /**
   * config: { text, merges:[[a,b],...], steps:[{desc, tokens:[...], ids:[...], note}] }
   * 渲染器自己重算每一步（校验 config 与计算一致），并把"当前合并规则"高亮出来。
   */
  function renderTokenlab(host, cfg, ctx) {
    var text = String(cfg.text || "");
    var merges = cfg.merges || [];
    // 字符级起点：每个字符一个 token（BPE 的白话起点）
    var startTokens = Array.from(text);
    var startIds = startTokens.map(function (c) {
      return cfg.vocab && cfg.vocab[c] !== undefined ? cfg.vocab[c] : ("ord " + c.charCodeAt(0));
    });
    var steps = cfg.steps || [];
    var idx = 0;
    var bar = el("div", "lab-bar");
    var bPrev = btn("‹ 上一步", "ghost"), bNext = btn("下一步 ›"), bPlay = btn("⏵ 自动");
    var counter = el("div", "lab-stat");
    var body = el("div", "lab-panel");
    var noteBox = el("div", "lab-note");

    function draw() {
      var s = steps[Math.min(idx, steps.length - 1)] || { desc: "", tokens: [], ids: [], note: "" };
      counter.textContent = "第 " + (idx + 1) + " / " + (steps.length + 1) + " 步（含起点）";
      body.innerHTML = "";
      body.appendChild(el("div", "lab-stat", MD.mathText(s.desc || "")));
      // 当前 token 序列（tokenlab 的核心展示：token 与 id 一一对应）
      var table = el("div", "lab-token-table");
      (s.tokens || []).forEach(function (tk, i) {
        var cell = el("div", "lab-token-cell");
        cell.appendChild(el("div", "lab-token", MD.escapeHtml(tk)));
        cell.appendChild(el("div", "lab-token-id", String(s.ids && s.ids[i] !== undefined ? s.ids[i] : "?")));
        table.appendChild(cell);
      });
      body.appendChild(table);
      // 合并规则总览：已用过的步骤高亮
      var rules = el("div", "lab-token-rules");
      (merges || []).forEach(function (m, mi) {
        var chip = el("span", "lab-token-rule" + (mi < idx ? " done" : ""));
        chip.textContent = String(m[0]) + " + " + String(m[1]) + " → " + String(m[0]) + String(m[1]);
        rules.appendChild(chip);
      });
      body.appendChild(rules);
      noteBox.innerHTML = s.note ? "💡 " + MD.mathText(s.note) : "";
    }
    var timer = null;
    on(bNext, "click", function () { if (idx < steps.length) { idx++; draw(); } });
    on(bPrev, "click", function () { if (idx > 0) { idx--; draw(); } });
    on(bPlay, "click", function () {
      if (timer) { clearInterval(timer); timer = null; bPlay.textContent = "⏵ 自动"; return; }
      bPlay.textContent = "⏸ 暂停";
      timer = setInterval(function () {
        if (idx >= steps.length) { clearInterval(timer); timer = null; bPlay.textContent = "⏵ 自动"; return; }
        idx++; draw();
      }, 1100);
    });
    bar.appendChild(bPrev); bar.appendChild(bNext); bar.appendChild(bPlay);
    bar.appendChild(el("div", "spacer")); bar.appendChild(counter);
    host.appendChild(bar);
    host.appendChild(body);
    host.appendChild(noteBox);
    draw();
  }

  /* ================================================== 8. attnlab 注意力手算 */
  /**
   * config: { seq:["词1",...], Q:[[..]], K:[[..]], V:[[..]],
   *           steps:[{desc, scores:[[..]], weights:[[..]], out:[[..]], note}] }
   * 渲染器自己重算 scores/weights/out（校验 config 与计算一致），权重做热力显示。
   */
  function renderAttnlab(host, cfg, ctx) {
    var seq = cfg.seq || [];
    var Q = cfg.Q || [], K = cfg.K || [], V = cfg.V || [];
    var steps = cfg.steps || [];
    var idx = 0;
    var bar = el("div", "lab-bar");
    var bPrev = btn("‹ 上一步", "ghost"), bNext = btn("下一步 ›"), bPlay = btn("⏵ 自动");
    var counter = el("div", "lab-stat");
    var body = el("div", "lab-panel");
    var noteBox = el("div", "lab-note");

    // 纯数值的 softmax（温度 1）
    function softmax(arr) {
      var mx = Math.max.apply(null, arr);
      var ex = arr.map(function (x) { return Math.exp(x - mx); });
      var s = ex.reduce(function (a, b) { return a + b; }, 0);
      return ex.map(function (x) { return x / s; });
    }
    // 向量点积
    function dot(a, b) {
      var n = 0;
      for (var i = 0; i < a.length; i++) n += a[i] * b[i];
      return n;
    }
    // 权重 × V 求和
    function mix(w, Vs) {
      var out = new Array(Vs[0].length).fill(0);
      for (var i = 0; i < Vs.length; i++)
        for (var j = 0; j < out.length; j++) out[j] += w[i] * Vs[i][j];
      return out;
    }
    function heat(v, mx) {
      // 0..1 转成绿（低）→ 黄 → 红（高）背景
      var t = Math.max(0, Math.min(1, mx > 0 ? v / mx : 0));
      var r = Math.round(255), g = Math.round(255 - 160 * t), b = Math.round(120 - 120 * t);
      return "rgb(" + r + "," + Math.max(0, g) + "," + Math.max(0, b) + ")";
    }

    function draw() {
      var s = steps[Math.min(idx, steps.length - 1)] || { desc: "", scores: [], weights: [], out: [], note: "" };
      counter.textContent = "第 " + (idx + 1) + " / " + steps.length + " 步";
      body.innerHTML = "";
      body.appendChild(el("div", "lab-stat", MD.mathText(s.desc || "")));
      // 注意力权重热力图：行=查询词，列=键词
      var ws = s.weights || [];
      if (ws.length) {
        var cap = el("div", "lab-attn-cap", "注意力权重（颜色越深 = 关注越多）");
        var table = el("div", "lab-attn-grid");
        var head = el("div", "lab-attn-row");
        head.appendChild(el("div", "lab-attn-hcell", ""));
        seq.forEach(function (k) { head.appendChild(el("div", "lab-attn-hcell", MD.escapeHtml(k))); });
        table.appendChild(head);
        ws.forEach(function (row, i) {
          var tr = el("div", "lab-attn-row");
          tr.appendChild(el("div", "lab-attn-hcell", MD.escapeHtml(seq[i] || "q" + i)));
          var mx = Math.max.apply(null, row.map(Math.abs));
          row.forEach(function (w) {
            var c = el("div", "lab-attn-cell", fmt(w));
            c.style.background = heat(w, mx);
            c.style.color = "#111";
            tr.appendChild(c);
          });
          table.appendChild(tr);
        });
        body.appendChild(cap);
        body.appendChild(table);
      }
      // 输出向量
      if ((s.out || []).length) {
        body.appendChild(el("div", "lab-attn-out", "加权输出 = " + s.out.map(fmt).join(", ")));
      }
      noteBox.innerHTML = s.note ? "💡 " + MD.mathText(s.note) : "";
    }
    var timer = null;
    on(bNext, "click", function () { if (idx < steps.length - 1) { idx++; draw(); } });
    on(bPrev, "click", function () { if (idx > 0) { idx--; draw(); } });
    on(bPlay, "click", function () {
      if (timer) { clearInterval(timer); timer = null; bPlay.textContent = "⏵ 自动"; return; }
      bPlay.textContent = "⏸ 暂停";
      timer = setInterval(function () {
        if (idx >= steps.length - 1) { clearInterval(timer); timer = null; bPlay.textContent = "⏵ 自动"; return; }
        idx++; draw();
      }, 1000);
    });
    bar.appendChild(bPrev); bar.appendChild(bNext); bar.appendChild(bPlay);
    bar.appendChild(el("div", "spacer")); bar.appendChild(counter);
    host.appendChild(bar);
    host.appendChild(body);
    host.appendChild(noteBox);
    draw();
  }

  /* ================================================== 9. datalab 通用单步器 */
  function renderDatalab(host, cfg) {
    var steps = cfg.steps || [];
    var idx = 0;
    var bar = el("div", "lab-bar");
    var bPrev = btn("‹ 上一步", "ghost"), bNext = btn("下一步 ›"), bPlay = btn("⏵ 自动");
    var counter = el("div", "lab-stat");
    var body = el("div", "lab-panel");
    var noteBox = el("div", "lab-note");

    function draw() {
      var s = steps[Math.min(idx, steps.length - 1)] || { desc: "", state: {} };
      counter.textContent = "第 " + (idx + 1) + " / " + steps.length + " 步";
      body.innerHTML = "";
      body.appendChild(el("div", "lab-stat", MD.mathText(s.desc || "")));
      var kv = el("div", "kv");
      kv.style.marginTop = "8px";
      Object.keys(s.state || {}).forEach(function (k) {
        var v = s.state[k];
        var val = Array.isArray(v) ? v.join(" | ") : String(v);
        kv.appendChild(el("div", "item", "<div class='k'>" + MD.escapeHtml(k) + "</div><div class='v'>" + MD.escapeHtml(val) + "</div>"));
      });
      body.appendChild(kv);
      noteBox.innerHTML = s.note ? "💡 " + MD.mathText(s.note) : "";
    }
    var timer = null;
    on(bNext, "click", function () { if (idx < steps.length - 1) { idx++; draw(); } });
    on(bPrev, "click", function () { if (idx > 0) { idx--; draw(); } });
    on(bPlay, "click", function () {
      if (timer) { clearInterval(timer); timer = null; bPlay.textContent = "⏵ 自动"; return; }
      bPlay.textContent = "⏸ 暂停";
      timer = setInterval(function () {
        if (idx >= steps.length - 1) { clearInterval(timer); timer = null; bPlay.textContent = "⏵ 自动"; return; }
        idx++; draw();
      }, 900);
    });
    bar.appendChild(bPrev); bar.appendChild(bNext); bar.appendChild(bPlay);
    bar.appendChild(el("div", "spacer")); bar.appendChild(counter);
    host.appendChild(bar);
    host.appendChild(body);
    host.appendChild(noteBox);
    draw();
  }

  /* ================================================== 10. samplab 采样策略 */
  /* config = {
       prompt?: string,
       logits: [{ token: string, logit: number }, ...],   // 至少 2 条
       temperature?: number, topK?: number, topP?: number, seed?: number,
       steps?: [{ desc, temperature, topK, topP, note }]  // 预设场景，可省略
     } */
  function renderSamplab(host, cfg) {
    var rows0 = cfg.logits || [];
    var T = cfg.temperature == null ? 1 : num(cfg.temperature);
    var K = cfg.topK == null ? 0 : num(cfg.topK);
    var P = cfg.topP == null ? 1 : num(cfg.topP);
    var seed = (cfg.seed == null ? 20261024 : num(cfg.seed)) >>> 0;
    var drawCount = 0, lastPick = null;
    var steps = cfg.steps || [], sIdx = 0, timer = null;

    /* 说明：本组件里的“随机抽一个”用固定种子的线性同余发生器（LCG），
       每次点“抽一次”就换一个种子——这样同一个种子必然抽出同一个结果，
       方便你在课堂上复现“为什么这次抽到的是它”。 */
    function rnd() { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; }

    var wrap = el("div", "lab-samp");
    if (cfg.prompt) wrap.appendChild(el("div", "lab-stat", MD.mathText(cfg.prompt)));

    var ctl = el("div", "lab-samp-ctl");
    function slider(label, min, max, step, val, onInput) {
      var box = el("div", "lab-samp-slider");
      box.appendChild(el("div", "lab-samp-slabel", label));
      var input = document.createElement("input");
      input.type = "range"; input.min = String(min); input.max = String(max);
      input.step = String(step); input.value = String(val);
      var out = el("span", "lab-samp-sval", String(val));
      input.addEventListener("input", function () { out.textContent = input.value; onInput(num(input.value)); });
      box.appendChild(input); box.appendChild(out);
      return { box: box, input: input, out: out };
    }
    var sT = slider("温度 T（越低越保守）", 0.1, 3, 0.1, T, function (v) { T = v; draw(); });
    var sK = slider("只留前 K 个（0=不限）", 0, rows0.length, 1, K, function (v) { K = v; draw(); });
    var sP = slider("累计概率 p（top-p）", 0.05, 1, 0.05, P, function (v) { P = v; draw(); });
    ctl.appendChild(sT.box); ctl.appendChild(sK.box); ctl.appendChild(sP.box);

    var bDraw = btn("🎲 按当前设置抽一次"), bReset = btn("↺ 复位", "ghost");
    var bPrev = btn("‹ 上个场景", "ghost"), bNext = btn("下个场景 ›", "ghost"), bPlay = btn("⏵ 自动播放");
    ctl.appendChild(bDraw); ctl.appendChild(bReset);
    if (steps.length) { ctl.appendChild(bPrev); ctl.appendChild(bNext); ctl.appendChild(bPlay); }
    wrap.appendChild(ctl);

    var result = el("div", "lab-stat");
    var sceneBox = el("div", "lab-stat scene");
    var table = el("div", "lab-samp-table");
    var note = el("div", "lab-note");
    wrap.appendChild(sceneBox);
    wrap.appendChild(result);
    wrap.appendChild(table);
    wrap.appendChild(note);
    host.appendChild(wrap);

    function softmax(items, temp) {
      var t = temp <= 0 ? 1e-6 : temp;
      var mx = Math.max.apply(null, items.map(function (r) { return r.logit; }));
      var ex = items.map(function (r) { return Math.exp((r.logit - mx) / t); });
      var sum = ex.reduce(function (a, b) { return a + b; }, 0) || 1;
      return ex.map(function (e) { return e / sum; });
    }

    function draw() {
      var probs = softmax(rows0, T);
      var order = rows0.map(function (r, i) { return i; })
        .sort(function (a, b) { return probs[b] - probs[a]; });
      var keep = {};
      var lim = (K > 0 ? Math.min(K, order.length) : order.length);
      order.slice(0, lim).forEach(function (i) { keep[i] = true; });
      // top-p：从高到低累加，达到 p 就停（至少保留 1 个）
      var acc = 0, used = 0;
      for (var j = 0; j < order.length; j++) {
        var i2 = order[j];
        if (!keep[i2]) continue;
        acc += probs[i2]; used++;
        if (acc >= P) { break; }
      }
      var allowed = {};
      order.slice(0, Math.max(1, used)).forEach(function (i3) { allowed[i3] = true; });
      Object.keys(keep).forEach(function (k) { if (!allowed[k]) delete keep[k]; });

      // 在保留集合内重新归一化
      var mass = 0;
      rows0.forEach(function (r, i) { if (keep[i]) mass += probs[i]; });
      mass = mass || 1;
      var finalP = rows0.map(function (r, i) { return keep[i] ? probs[i] / mass : 0; });

      table.innerHTML = "";
      var head = el("div", "lab-samp-row head");
      ["候选词", "原始 logit", "÷T 后概率", "是否保留", "归一化后概率", ""].forEach(function (h) {
        head.appendChild(el("div", "lab-samp-cell", h));
      });
      table.appendChild(head);
      rows0.forEach(function (r, i) {
        var tr = el("div", "lab-samp-row" + (keep[i] ? "" : " dim"));
        tr.appendChild(el("div", "lab-samp-cell tok", MD.escapeHtml(r.token)));
        tr.appendChild(el("div", "lab-samp-cell", fmt(r.logit)));
        tr.appendChild(el("div", "lab-samp-cell", (probs[i] * 100).toFixed(1) + "%"));
        tr.appendChild(el("div", "lab-samp-cell", keep[i] ? "✅ 保留" : "✂️ 剪掉"));
        tr.appendChild(el("div", "lab-samp-cell", keep[i] ? (finalP[i] * 100).toFixed(1) + "%" : "0%"));
        var barCell = el("div", "lab-samp-cell");
        var barBox = el("div", "lab-samp-bar");
        var fill = el("div", "lab-samp-fill");
        fill.style.width = Math.round(finalP[i] * 100) + "%";
        barBox.appendChild(fill);
        barCell.appendChild(barBox);
        tr.appendChild(barCell);
        if (lastPick === i) tr.appendChild(el("div", "lab-samp-pick", "← 刚抽到"));
        table.appendChild(tr);
      });
      result.innerHTML = MD.mathText(
        "当前设置：T = " + T + "，top-k = " + (K > 0 ? K : "不限") + "，top-p = " + P +
        "；还有 " + Object.keys(keep).length + " 个候选词有非零概率（原始共 " + rows0.length + " 个）。"
      );
      note.innerHTML = steps.length && steps[sIdx] && steps[sIdx].note ? "💡 " + MD.mathText(steps[sIdx].note) : "";
    }

    function applyScene(i) {
      var s = steps[Math.max(0, Math.min(i, steps.length - 1))];
      if (!s) return;
      sIdx = Math.max(0, Math.min(i, steps.length - 1));
      if (s.temperature != null) { T = num(s.temperature); sT.input.value = String(T); sT.out.textContent = String(T); }
      if (s.topK != null) { K = num(s.topK); sK.input.value = String(K); sK.out.textContent = String(K); }
      if (s.topP != null) { P = num(s.topP); sP.input.value = String(P); sP.out.textContent = String(P); }
      lastPick = null;
      sceneBox.innerHTML = s.desc ? MD.mathText(s.desc) : "";
      draw();
    }

    on(bDraw, "click", function () {
      var probs = softmax(rows0, T);
      var order = rows0.map(function (r, i) { return i; }).sort(function (a, b) { return probs[b] - probs[a]; });
      var keep = {}, lim = K > 0 ? Math.min(K, order.length) : order.length;
      order.slice(0, lim).forEach(function (i) { keep[i] = true; });
      var mass = 0;
      rows0.forEach(function (r, i) { if (keep[i]) mass += probs[i]; });
      mass = mass || 1;
      var u = rnd() * mass, acc = 0, pick = order[0];
      // 按概率从高到低累加，累计值第一次越过 u 的那个候选词就是本次抽到的词
      for (var j = 0; j < order.length; j++) {
        var i4 = order[j];
        if (!keep[i4]) continue;
        acc += probs[i4];
        pick = i4;
        if (acc >= u) break;
      }
      lastPick = pick;
      drawCount++;
      result.innerHTML = MD.mathText(
        "第 " + drawCount + " 次抽样（种子 " + (seed >>> 0) + "）抽到：" +
        "「" + MD.escapeHtml(rows0[pick].token) + "」"
      );
      draw();
    });
    on(bReset, "click", function () {
      T = cfg.temperature == null ? 1 : num(cfg.temperature);
      K = cfg.topK == null ? 0 : num(cfg.topK);
      P = cfg.topP == null ? 1 : num(cfg.topP);
      sT.input.value = String(T); sT.out.textContent = String(T);
      sK.input.value = String(K); sK.out.textContent = String(K);
      sP.input.value = String(P); sP.out.textContent = String(P);
      lastPick = null; drawCount = 0;
      draw();
    });
    if (steps.length) {
      on(bPrev, "click", function () { applyScene(sIdx - 1); });
      on(bNext, "click", function () { applyScene(sIdx + 1); });
      on(bPlay, "click", function () {
        if (timer) { clearInterval(timer); timer = null; bPlay.textContent = "⏵ 自动播放"; return; }
        bPlay.textContent = "⏸ 暂停";
        timer = setInterval(function () {
          if (sIdx >= steps.length - 1) { clearInterval(timer); timer = null; bPlay.textContent = "⏵ 自动播放"; return; }
          applyScene(sIdx + 1);
        }, 1600);
      });
    }
    draw();
  }

  /* ============================================ 11. ragsteps RAG 四步流水线 */
  /**
   * config: { query:"查询", docs:[{id, text}], chunkSize:120, qemb:[..]?, emb:{docId:[..]},
   *           steps:[{desc, stage:"chunk|embed|retrieve|prompt", data, note}] }
   * 渲染器真算两件事：① 按句边界把文档打包成块；② 给了 qemb 就用余弦相似度真排序。
   */
  function renderRagsteps(host, cfg, ctx) {
    var docs = cfg.docs || [];
    var size = Number(cfg.chunkSize) || 120;
    var steps = cfg.steps || [];
    var qemb = cfg.qemb || null;
    var emb = cfg.emb || {};
    var STAGES = ["chunk", "embed", "retrieve", "prompt"];
    var STAGE_CN = { chunk: "① 切分", embed: "② 嵌入", retrieve: "③ 检索", prompt: "④ 拼提示" };
    var idx = 0;

    function splitSentences(t) {
      var out = [], buf = "";
      for (var i = 0; i < t.length; i++) {
        var ch = t.charAt(i);
        buf += ch;
        if ("。！？；!?;\n".indexOf(ch) >= 0) { if (buf.replace(/\s+/g, "")) { out.push(buf.trim()); } buf = ""; }
      }
      if (buf.replace(/\s+/g, "")) { out.push(buf.trim()); }
      return out;
    }
    // 按句子打包：尽量塞满 chunkSize，但不把一句话劈成两半
    function chunkText(t, sz) {
      var chunks = [], cur = "";
      splitSentences(String(t || "")).forEach(function (s) {
        if (cur && (cur + s).length > sz) { chunks.push(cur); cur = s; } else { cur += s; }
      });
      if (cur) { chunks.push(cur); }
      return chunks;
    }
    function cos(a, b) {
      var d = 0, na = 0, nb = 0;
      for (var i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
      return (na && nb) ? d / Math.sqrt(na * nb) : 0;
    }
    var allChunks = [];
    docs.forEach(function (d) {
      chunkText(d.text, size).forEach(function (c, i) { allChunks.push({ doc: d.id, i: i, text: c }); });
    });
    var ranking = null;
    if (qemb && qemb.length) {
      ranking = docs.map(function (d) {
        var e = emb[d.id];
        return { id: d.id, score: (e && e.length === qemb.length) ? cos(qemb, e) : null };
      }).filter(function (r) { return r.score !== null; }).sort(function (a, b) { return b.score - a.score; });
    }
    // 小向量条形图（0.25 / -0.8 这种玩具向量也能看清正负）
    function vecBars(vec) {
      var box = el("div", "lab-vec");
      var mx = Math.max.apply(null, vec.map(function (x) { return Math.abs(x); })) || 1;
      vec.forEach(function (x) {
        var cell = el("div", "lab-vec-cell");
        var fill = el("div", "lab-vec-fill" + (x < 0 ? " neg" : ""));
        fill.style.height = Math.max(2, Math.round(Math.abs(x) / mx * 100)) + "%";
        cell.appendChild(fill);
        cell.appendChild(el("div", "lab-vec-num", String(Math.round(x * 100) / 100)));
        box.appendChild(cell);
      });
      return box;
    }

    var bar = el("div", "lab-bar");
    var bPrev = btn("‹ 上一步", "ghost"), bNext = btn("下一步 ›"), bPlay = btn("⏵ 自动");
    var counter = el("div", "lab-stat");
    var stageBar = el("div", "lab-stagebar");
    var body = el("div", "lab-panel");
    var noteBox = el("div", "lab-note");

    function draw() {
      var s = steps[Math.min(idx, steps.length - 1)] || { desc: "", stage: "chunk", data: "", note: "" };
      counter.textContent = "第 " + (idx + 1) + " / " + steps.length + " 步";
      stageBar.innerHTML = "";
      STAGES.forEach(function (k) {
        stageBar.appendChild(el("span", "lab-stage" + (k === s.stage ? " on" : ""), STAGE_CN[k]));
      });
      body.innerHTML = "";
      body.appendChild(el("div", "lab-stat", MD.mathText(s.desc || "")));

      if (s.stage === "chunk") {
        body.appendChild(el("div", "lab-sub", "共 " + docs.length + " 篇文档 → " + allChunks.length + " 个块"
          + "（chunkSize=" + size + "；按句边界打包，不切断句子）"));
        var box = el("div", "lab-chunks");
        allChunks.forEach(function (c) {
          var chip = el("div", "lab-chunk");
          chip.appendChild(el("div", "lab-chunk-head", MD.escapeHtml(c.doc) + " 第 " + (c.i + 1) + " 块 · " + c.text.length + " 字"));
          chip.appendChild(el("div", "lab-chunk-body", MD.escapeHtml(c.text)));
          box.appendChild(chip);
        });
        body.appendChild(box);
      } else if (s.stage === "embed") {
        body.appendChild(el("div", "lab-sub", "每篇文档 → 一个向量（这里画的是玩具向量；真实模型通常 768 维以上）"));
        docs.forEach(function (d) {
          var row = el("div", "lab-embed-row");
          row.appendChild(el("div", "lab-embed-name", MD.escapeHtml(d.id)));
          var e = emb[d.id];
          row.appendChild(e && e.length ? vecBars(e) : el("div", "lab-sub", "（config 未给 " + MD.escapeHtml(d.id) + " 的向量）"));
          body.appendChild(row);
        });
      } else if (s.stage === "retrieve") {
        if (ranking && ranking.length) {
          body.appendChild(el("div", "lab-sub", "余弦相似度排序（渲染器真算）：越接近 1 越像"));
          var mx = ranking[0].score || 1;
          ranking.forEach(function (r, i) {
            var row = el("div", "lab-rank");
            row.appendChild(el("div", "lab-rank-no", "第 " + (i + 1)));
            row.appendChild(el("div", "lab-rank-name", MD.escapeHtml(r.id)));
            var track = el("div", "lab-rank-track");
            var fill = el("div", "lab-rank-fill");
            fill.style.width = Math.max(3, Math.round(r.score / (mx || 1) * 100)) + "%";
            track.appendChild(fill);
            row.appendChild(track);
            row.appendChild(el("div", "lab-rank-score", String(Math.round(r.score * 1000) / 1000)));
            body.appendChild(row);
          });
        } else {
          body.appendChild(el("div", "lab-sub", "（config 未给 qemb，这里无法真算相似度——看下面的说明文字）"));
        }
        if (s.data) { body.appendChild(el("div", "lab-data", MD.escapeHtml(s.data))); }
      } else if (s.data) {
        body.appendChild(el("div", "lab-data", MD.escapeHtml(s.data)));
      }
      noteBox.innerHTML = s.note ? "💡 " + MD.mathText(s.note) : "";
    }
    var timer = null;
    on(bNext, "click", function () { if (idx < steps.length - 1) { idx++; draw(); } });
    on(bPrev, "click", function () { if (idx > 0) { idx--; draw(); } });
    on(bPlay, "click", function () {
      if (timer) { clearInterval(timer); timer = null; bPlay.textContent = "⏵ 自动"; return; }
      bPlay.textContent = "⏸ 暂停";
      timer = setInterval(function () {
        if (idx >= steps.length - 1) { clearInterval(timer); timer = null; bPlay.textContent = "⏵ 自动"; return; }
        idx++; draw();
      }, 1400);
    });
    bar.appendChild(bPrev); bar.appendChild(bNext); bar.appendChild(bPlay);
    bar.appendChild(el("div", "spacer")); bar.appendChild(counter);
    host.appendChild(bar);
    host.appendChild(stageBar);
    host.appendChild(body);
    host.appendChild(noteBox);
    draw();
  }

  /* ============================================ 12. agenttrace ReAct 回放 */
  /**
   * config: { task:"任务描述", steps:[{desc, kind:"thought|action|observation|finish", text, note}] }
   * 把「思考 → 行动 → 观察」的循环一步步展开，让人看清 agent 并不是一口气给出答案。
   */
  function renderAgenttrace(host, cfg, ctx) {
    var steps = cfg.steps || [];
    var KIND = {
      thought: { icon: "🤔", cn: "思考", cls: "thought" },
      action: { icon: "🔧", cn: "行动", cls: "action" },
      observation: { icon: "👀", cn: "观察", cls: "observation" },
      finish: { icon: "✅", cn: "收尾", cls: "finish" }
    };
    var shown = Math.min(1, steps.length);
    var bar = el("div", "lab-bar");
    var bNext = btn("下一步 ›"), bAll = btn("全部展开", "ghost"), bReset = btn("⟲ 重来", "ghost");
    var counter = el("div", "lab-stat");
    var body = el("div", "lab-panel");
    body.appendChild(el("div", "lab-task", "🎯 任务：" + MD.escapeHtml(String(cfg.task || ""))));
    var list = el("div", "lab-trace");
    body.appendChild(list);

    function draw() {
      counter.textContent = "已展开 " + Math.min(shown, steps.length) + " / " + steps.length + " 步";
      list.innerHTML = "";
      steps.slice(0, shown).forEach(function (s, i) {
        var k = KIND[s.kind] || { icon: "•", cn: String(s.kind || "?"), cls: "other" };
        var card = el("div", "lab-trace-card " + k.cls + (i === shown - 1 ? " cur" : ""));
        var head = el("div", "lab-trace-head");
        head.appendChild(el("span", "lab-trace-icon", k.icon));
        head.appendChild(el("span", "lab-trace-kind", k.cn));
        head.appendChild(el("span", "lab-trace-desc", MD.mathText(s.desc || "")));
        card.appendChild(head);
        if (s.text) { card.appendChild(el("div", "lab-trace-text", MD.escapeHtml(s.text))); }
        if (s.note) { card.appendChild(el("div", "lab-note", "💡 " + MD.mathText(s.note))); }
        list.appendChild(card);
      });
      if (shown >= steps.length && steps.length) {
        list.appendChild(el("div", "lab-trace-end", "—— 轨迹结束 ——"));
      }
      bNext.disabled = shown >= steps.length;
    }
    on(bNext, "click", function () { if (shown < steps.length) { shown++; draw(); } });
    on(bAll, "click", function () { shown = steps.length; draw(); });
    on(bReset, "click", function () { shown = Math.min(1, steps.length); draw(); });
    bar.appendChild(bReset); bar.appendChild(bNext); bar.appendChild(bAll);
    bar.appendChild(el("div", "spacer")); bar.appendChild(counter);
    host.appendChild(bar);
    host.appendChild(body);
    draw();
  }

  /* ============================================ 13. protolab 角色连线图 */
  /**
   * config: { scenario:"场景描述", parties:[{name, role}], links:[{from, to, proto, desc}],
   *           steps:[{desc, note}] }
   * 角色卡片 + 协议连线：每走一步点亮一条连线，讲清「谁跟谁、用什么协议」说话。
   */
  function renderProtoplab(host, cfg, ctx) {
    var parties = cfg.parties || [];
    var links = cfg.links || [];
    var steps = cfg.steps || [];
    var idx = 0;
    var bar = el("div", "lab-bar");
    var bPrev = btn("‹ 上一步", "ghost"), bNext = btn("下一步 ›"), bPlay = btn("⏵ 自动");
    var counter = el("div", "lab-stat");
    var body = el("div", "lab-panel");
    var noteBox = el("div", "lab-note");
    var partyBox = el("div", "lab-parties");
    var linkBox = el("div", "lab-links");

    body.appendChild(el("div", "lab-task", "🧩 场景：" + MD.escapeHtml(String(cfg.scenario || ""))));
    parties.forEach(function (p) {
      var card = el("div", "lab-party");
      card.appendChild(el("div", "lab-party-name", MD.escapeHtml(String(p.name || ""))));
      card.appendChild(el("div", "lab-party-role", MD.escapeHtml(String(p.role || ""))));
      partyBox.appendChild(card);
    });
    body.appendChild(partyBox);
    body.appendChild(linkBox);

    function draw() {
      var s = steps[Math.min(idx, steps.length - 1)] || { desc: "", note: "" };
      counter.textContent = "第 " + (idx + 1) + " / " + steps.length + " 步";
      linkBox.innerHTML = "";
      links.forEach(function (l, i) {
        var lit = steps.length ? (i <= idx) : true;
        var row = el("div", "lab-link" + (lit ? " on" : ""));
        row.appendChild(el("span", "lab-link-ends", MD.escapeHtml(String(l.from)) + " ⇄ " + MD.escapeHtml(String(l.to))));
        row.appendChild(el("span", "lab-link-proto", MD.escapeHtml(String(l.proto || ""))));
        if (l.desc) { row.appendChild(el("span", "lab-link-desc", MD.escapeHtml(String(l.desc)))); }
        linkBox.appendChild(row);
      });
      var txt = s.desc ? MD.mathText(s.desc) : "";
      if (s.note) { txt += (txt ? "　" : "") + "💡 " + MD.mathText(s.note); }
      noteBox.innerHTML = txt;
    }
    if (!steps.length) {
      host.appendChild(body);
      host.appendChild(noteBox);
      draw();
      return;
    }
    var timer = null;
    on(bNext, "click", function () { if (idx < steps.length - 1) { idx++; draw(); } });
    on(bPrev, "click", function () { if (idx > 0) { idx--; draw(); } });
    on(bPlay, "click", function () {
      if (timer) { clearInterval(timer); timer = null; bPlay.textContent = "⏵ 自动"; return; }
      bPlay.textContent = "⏸ 暂停";
      timer = setInterval(function () {
        if (idx >= steps.length - 1) { clearInterval(timer); timer = null; bPlay.textContent = "⏵ 自动"; return; }
        idx++; draw();
      }, 1400);
    });
    bar.appendChild(bPrev); bar.appendChild(bNext); bar.appendChild(bPlay);
    bar.appendChild(el("div", "spacer")); bar.appendChild(counter);
    host.appendChild(bar);
    host.appendChild(body);
    host.appendChild(noteBox);
    draw();
  }

  /* ------------------------------------------------------------ 导出 */
  var RENDERERS = {
    pathlab: renderPathlab,
    schedlab: renderSchedlab,
    cpulab: renderCpulab,
    pagelab: renderPagelab,
    arbitlab: renderArbitlab,
    datalab: renderDatalab,
    tokenlab: renderTokenlab,
    attnlab: renderAttnlab,
    samplab: renderSamplab,
    ragsteps: renderRagsteps,
    agenttrace: renderAgenttrace,
    protolab: renderProtoplab
  };

  global.LABS = {
    render: function (host, block, ctx) {
      var fn = RENDERERS[block.lab];
      if (!fn) { host.textContent = "未知实验类型：" + block.lab; return; }
      fn(host, block.config || {}, ctx || { onInteract: function () {} });
    },
    types: Object.keys(RENDERERS),
    runPage: runPage
  };
})(window);
