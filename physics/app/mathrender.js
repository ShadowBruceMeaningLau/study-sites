/* ==========================================================================
   mathrender.js —— 数学公式渲染（零依赖、完全离线；KaTeX 优先，纯 CSS 兜底）
   两个引擎，自动选择：1) KaTeX（vendor/katex/，本站自带，出版级排版）；2) 纯 CSS 渲染器（本文件）。
   语法（写在 $...$ 里；$$ ... $$ 表示独立成行的大公式）：
     \frac{a}{b}     分式（分数线）
     x^{2n} a_{i,j}  上下标（可嵌套）
     \sqrt{x} \sqrt[3]{x}  根号（默认平方根）
     \sum_{k=1}^{n}  求和号（上下限）
     \prod \int \oint \lim  连乘 / 积分 / 环路积分 / 极限（上下限）
     \begin{pmatrix} a & b \\ c & d \end{pmatrix}  矩阵（pmatrix/bmatrix）
     \alpha \beta \pi \theta \lambda \mu \sigma \epsilon \delta \Delta \Omega ...  希腊字母
     \le \ge \ne \approx \equiv \pm \times \div \cdot \to \Rightarrow \Leftrightarrow \in \notin \subset \subseteq \cup \cap \forall \exists \infty \partial \nabla \sum \prod \int
     \left( \right)  自适应括号（简化为普通括号）
     \text{中文}     公式里的中文必须这样包起来（裸中文会被判定为「不是公式」）
     \, \; \quad       间距
   ========================================================================== */
(function (global) {
  "use strict";

  var SYMBOLS = {
    alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε",
    zeta: "ζ", eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ",
    nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ",
    phi: "φ", chi: "χ", psi: "ψ", omega: "ω",
    Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
    Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
    le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠", approx: "≈",
    equiv: "≡", sim: "∼", propto: "∝", pm: "±", mp: "∓", times: "×", div: "÷",
    cdot: "·", ast: "∗", to: "→", rightarrow: "→", leftarrow: "←",
    Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔", leftrightarrow: "↔",
    in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", supset: "⊃", supseteq: "⊇",
    cup: "∪", cap: "∩", emptyset: "∅", forall: "∀", exists: "∃", nexists: "∄",
    infty: "∞", partial: "∂", nabla: "∇", angle: "∠", perp: "⊥", parallel: "∥",
    circ: "∘", star: "⋆", bullet: "•", oplus: "⊕", otimes: "⊗",
    ldots: "…", cdots: "⋯", dots: "…", vdots: "⋮", ddots: "⋱",
    quad: "\u2003", qquad: "\u2003\u2003", ",": "\u2009", ";": "\u2005", " ": " ",
    colon: ":", lbrace: "{", rbrace: "}", langle: "⟨", rangle: "⟩",
    lceil: "⌈", rceil: "⌉", lfloor: "⌊", rfloor: "⌋", vert: "|", Vert: "‖",
    degree: "°", prime: "′", therefore: "∴", because: "∵", square: "□", checkmark: "✓"
  };

  /** 大运算符（需要把上下限放在正上下方） */
  var BIG_OPS = { sum: "∑", prod: "∏", int: "∫", oint: "∮", lim: "lim", max: "max", min: "min", sup: "sup", inf: "inf", limsup: "lim sup", liminf: "lim inf", bigcup: "⋃", bigcap: "⋂" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ------------------------------------------------------------ 解析器 */
  function Parser(src) {
    this.s = String(src == null ? "" : src);
    this.i = 0;
  }
  Parser.prototype.peek = function () { return this.s[this.i]; };
  Parser.prototype.eof = function () { return this.i >= this.s.length; };

  /** 解析到 end 为止（end 为终止符集合，如 "}"） */
  Parser.prototype.parseGroup = function (stopAt) {
    var out = "";
    while (!this.eof()) {
      var ch = this.s[this.i];
      if (stopAt && stopAt.indexOf(ch) >= 0) break;
      out += this.parseUnit();
    }
    return out;
  };

  /** 取一个"原子"：{...} 整体、单个字符、或 \命令 */
  Parser.prototype.parseAtom = function () {
    var ch = this.s[this.i];
    if (ch === "{") {
      this.i++;
      var inner = this.parseGroup("}");
      if (this.s[this.i] === "}") this.i++;
      return { html: inner, single: false };
    }
    if (ch === "\\") return { html: this.parseCommand(), single: false };
    this.i++;
    return { html: esc(ch), single: true };
  };

  /** 解析上下标：^ 与 _ 可任意顺序、可组合 */
  Parser.prototype.parseScripts = function (baseHtml) {
    var sup = null, sub = null;
    while (this.peek() === "^" || this.peek() === "_") {
      var isSup = this.peek() === "^";
      this.i++;
      var atom = this.parseAtom();
      if (isSup) sup = atom.html; else sub = atom.html;
    }
    if (sup === null && sub === null) return baseHtml;
    if (sup !== null && sub !== null) {
      return '<span class="mr-script"><span class="mr-sup">' + sup + '</span><span class="mr-sub">' + sub + "</span></span>" + baseHtml;
    }
    if (sup !== null) return baseHtml + '<sup class="mr-sup">' + sup + "</sup>";
    return baseHtml + '<sub class="mr-sub">' + sub + "</sub>";
  };

  /** 大运算符：把上下限放在正上下方 */
  Parser.prototype.parseBigOp = function (name) {
    var sym = BIG_OPS[name];
    var lower = null, upper = null;
    while (this.peek() === "_" || this.peek() === "^") {
      var isSub = this.peek() === "_";
      this.i++;
      var atom = this.parseAtom();
      if (isSub) lower = atom.html; else upper = atom.html;
    }
    var html = '<span class="mr-bigop"><span class="mr-bigop-sym">' + esc(sym) + "</span>";
    if (upper !== null) html += '<span class="mr-bigop-lim mr-bigop-up">' + upper + "</span>";
    if (lower !== null) html += '<span class="mr-bigop-lim mr-bigop-low">' + lower + "</span>";
    html += "</span>";
    // 大运算符后面可以再有下标（如 \sum_{i} x_i 之后的 ^ 极少见，这里仍支持）
    return html;
  };

  Parser.prototype.parseCommand = function () {
    this.i++; // 跳过反斜杠
    var m = /^[A-Za-z]+/.exec(this.s.slice(this.i));
    var name = m ? m[0] : this.s[this.i] || "";
    this.i += name.length;

    // 分式
    if (name === "frac" || name === "dfrac" || name === "tfrac") {
      var num = this.parseAtom().html;
      var den = this.parseAtom().html;
      return '<span class="mr-frac"><span class="mr-num">' + num + '</span><span class="mr-den">' + den + "</span></span>";
    }
    // 根号
    if (name === "sqrt") {
      var deg = null;
      if (this.peek() === "[") {
        this.i++;
        deg = this.parseGroup("]");
        if (this.s[this.i] === "]") this.i++;
      }
      var body = this.parseAtom().html;
      return '<span class="mr-sqrt">' + (deg ? '<span class="mr-sqrt-deg">' + deg + "</span>" : "") +
        '<span class="mr-sqrt-sign">√</span><span class="mr-sqrt-body">' + body + "</span></span>";
    }
    // 文本
    if (name === "text" || name === "mathrm" || name === "operatorname") {
      var t = this.parseAtom().html;
      return '<span class="mr-text">' + t + "</span>";
    }
    // 自适应括号（简化为普通括号）
    if (name === "left" || name === "right") {
      var next = this.s[this.i];
      if (next === "\\") return this.parseCommand();
      this.i++;
      if (next === ".") return "";
      var mapped = SYMBOLS[next] || next;
      return '<span class="mr-delim">' + esc(mapped) + "</span>";
    }
    // 矩阵
    if (name === "begin") {
      var envAtom = this.parseAtom().html;
      var env = envAtom.replace(/<[^>]*>/g, "").trim();
      var body = [];
      var depth = 1;
      // 收集到 \end{env}
      var start = this.i;
      var endIdx = this.s.indexOf("\\end", this.i);
      var raw = endIdx >= 0 ? this.s.slice(start, endIdx) : this.s.slice(start);
      this.i = endIdx >= 0 ? endIdx : this.s.length;
      if (this.s.startsWith("\\end", this.i)) {
        var mEnd = /^\\end\{[^}]*\}/.exec(this.s.slice(this.i));
        if (mEnd) this.i += mEnd[0].length;
      }
      var rows = raw.split(/\\\\/).map(function (r) { return r.trim(); }).filter(Boolean);
      var maxCols = 1;
      var grid = rows.map(function (r) {
        var cells = r.split("&").map(function (c) { return c.trim(); });
        maxCols = Math.max(maxCols, cells.length);
        return cells;
      });
      var html = '<span class="mr-matrix ' + (env === "bmatrix" ? "mr-bmatrix" : "mr-pmatrix") + '">';
      if (env === "bmatrix") html += '<span class="mr-matrix-br">[</span>';
      else html += '<span class="mr-matrix-br">(</span>';
      html += '<span class="mr-matrix-body">';
      grid.forEach(function (cells) {
        html += '<span class="mr-matrix-row">';
        for (var c = 0; c < maxCols; c++) {
          var cell = cells[c] == null ? "" : new Parser(cells[c]).parse();
          html += '<span class="mr-matrix-cell">' + cell + "</span>";
        }
        html += "</span>";
      });
      html += "</span>";
      html += '<span class="mr-matrix-br">' + (env === "bmatrix" ? "]" : ")") + "</span></span>";
      void body; void depth;
      return html;
    }
    // 大运算符
    if (BIG_OPS[name]) return this.parseBigOp(name);
    // 希腊字母与符号
    if (SYMBOLS[name] != null) return '<span class="mr-sym">' + esc(SYMBOLS[name]) + "</span>";
    // 未知命令：原样输出命令名（避免吞掉内容）
    return '<span class="mr-unknown">' + esc(name) + "</span>";
  };

  Parser.prototype.parseUnit = function () {
    var ch = this.s[this.i];
    if (ch === "^" || ch === "_") {
      // 没有底数的上下标：直接作为前一个字符的后缀处理不了，退化为普通上下标
      this.i++;
      var atom = this.parseAtom();
      return (ch === "^" ? '<sup class="mr-sup">' : '<sub class="mr-sub">') + atom.html + (ch === "^" ? "</sup>" : "</sub>");
    }
    if (ch === "{") {
      this.i++;
      var inner = this.parseGroup("}");
      if (this.s[this.i] === "}") this.i++;
      return this.parseScripts(inner);
    }
    if (ch === "\\") {
      var cmd = this.parseCommand();
      return this.parseScripts(cmd);
    }
    // 普通字符
    this.i++;
    if (ch === " ") return " ";
    if (ch === "~") return "\u00a0";
    // 常见运算符周围留出间距
    if ("=+<>≈≤≥≠→⇒⇔±×÷∈⊂∪∩".indexOf(ch) >= 0) {
      return this.parseScripts('<span class="mr-op">' + esc(ch) + "</span>");
    }
    if (/[a-zA-Z0-9]/.test(ch)) return this.parseScripts('<span class="mr-var">' + esc(ch) + "</span>");
    return this.parseScripts(esc(ch));
  };

  Parser.prototype.parse = function () {
    return this.parseGroup(null);
  };

  /** 对外接口：把 $...$ 片段渲染成 HTML */
  function render(tex) {
    try {
      return new Parser(tex).parse();
    } catch (e) {
      return '<span class="mr-error" title="' + esc(e.message) + '">' + esc(tex) + "</span>";
    }
  }

  /* ------------------------------------------------ KaTeX 桥接（首选引擎） */
  /**
   * 首选 KaTeX：vendor/katex/katex.min.js 就摆在站点里，离线也能用，
   * 排版质量是出版级的（真正的 TeX 度量、斜体变量、伸缩括号）。
   * 万一那个文件被删了，就退回上面这个纯 CSS 渲染器，公式仍然看得懂。
   */
  function katexLib() {
    var k = global.katex;
    return k && typeof k.renderToString === "function" ? k : null;
  }

  /**
   * 判断 $...$ 之间到底是不是公式。中文写作里出现 $ 的地方不少
   * （shell 的 echo $?、SQL 的 $1 占位符、Java 编译出的 Outer$1.class、
   *   价格「5$ 还是 6$」），必须挡住误判，否则会把正文当公式排版。
   * 返回 "" 表示「是公式」，否则返回不是公式的原因（供 audit-math.mjs 报给作者看）。
   */
  var RE_CJK = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/;
  var RE_TEXTCMD = /\\(text|mathrm|operatorname|mbox|textbf|textit)\{[^{}]*\}/g;

  function whyNotMath(body) {
    var s = String(body == null ? "" : body);
    if (!s) return "空的 $...$";
    if (/^\s|\s$/.test(s)) return "首尾有空格（像是被两个 $ 夹住的一段文字）";
    if (/["]|==|!=|&&/.test(s)) return "含引号或程序运算符（像是代码片段）";
    // || 要分情况：$|\vec a||\vec b|$ 里的 || 是两根绝对值竖线（含 \ ^ _ { 等数学记号），
    // 而 $a || b$ 这种是代码里的逻辑或。只有后者才拒绝。
    if (/\|\|/.test(s) && !/[\\^_{}]/.test(s)) return "含 ||（像是代码里的逻辑或）";
    if (/\s{3,}/.test(s)) return "中间有连续空白（像是两段文字）";
    if (/^[\s{}]*$/.test(s)) return "里面只有花括号（例如 ${} 占位符）";
    var bare = s.replace(RE_TEXTCMD, "");
    if (RE_CJK.test(bare)) return "公式里直接写了中文（要包在 \\text{...} 里）";
    // 以数字开头：既要挡住 $1 这类占位符，又不能误伤 $10 - 3 + 2$、$2n$、$3n \log n$ 这种正常算式。
    // 程序味儿的判据一律看「去掉 \text{...} 之后」的内容，否则 $1\text{ KB} = 1024\text{ B}$ 会被误杀。
    if (/^[0-9]/.test(s)) {
      // 下面两条是"程序味儿"判据，只在整段**没有任何数学记号**时才生效。
      // 否则会误杀物理里极常见的写法（被浏览器级验证抓到过的真实误判）：
      //   $2mgL$、$3GMu^2/c^2$  → 命中"数字后面跟一串字母"，其实是单摆分界线能量与 Binet 项
      //   $6\pi GM/(a(1-e^2)c^2)$ → 命中"含全大写关键字 GM"，其实是水星进动公式
      var hasMathMark = /[\\^_{}]/.test(s);
      if (!hasMathMark && /^[0-9]+[a-z]{3,}$/.test(s)) return "数字后面跟一串小写字母（像是 $1abc 这类占位符）";
      if (/;/.test(bare)) return "含分号（像是代码语句）";
      if (!hasMathMark && /\b[A-Z]{2,}\b/.test(bare)) return "含全大写关键字（像是 SQL 片段）";
    }
    return "";
  }

  function looksLikeMath(body) {
    return whyNotMath(body) === "";
  }

  /** 一个公式片段 -> HTML。display=true 表示独立成行的大公式。 */
  function typeset(tex, display) {
    var k = katexLib();
    if (k) {
      try {
        return k.renderToString(tex, {
          displayMode: !!display,
          throwOnError: true,     // 写错了要立刻知道，而不是悄悄渲染成红字
          strict: false,          // 允许 \text{中文}、\, 之类的宽松写法
          trust: false
        });
      } catch (e) {
        return '<span class="mr-error" title="' + esc(e.message) + '">' + esc(tex) + "</span>";
      }
    }
    return render(tex);
  }

  /**
   * 把一段文本按 $...$（行内）与 $$...$$（大公式）切成 [{math, display, text}]。
   * \$ 表示字面美元符；$ 必须同行配对，且要过 looksLikeMath 这一关。
   */
  function splitMath(text) {
    var s = String(text == null ? "" : text);
    var parts = [];
    var buf = "";
    var i = 0;
    while (i < s.length) {
      var c = s[i];
      if (c === "\\" && s[i + 1] === "$") { buf += "$"; i += 2; continue; }
      if (c !== "$") { buf += c; i++; continue; }
      // $$ ... $$ 大公式（整个片段按 display 模式排版）
      if (s[i + 1] === "$") {
        var j2 = i + 2;
        var close2 = -1;
        while (j2 < s.length && s[j2] !== "\n") {
          if (s[j2] === "\\") { j2 += 2; continue; }
          if (s[j2] === "$" && s[j2 + 1] === "$") { close2 = j2; break; }
          j2++;
        }
        // 大公式习惯写成 $$ 公式 $$（$ 与公式之间带空格），所以要先把首尾空白去掉再判定
        var dbody = close2 > -1 ? s.slice(i + 2, close2).trim() : "";
        if (close2 > -1 && looksLikeMath(dbody)) {
          if (buf) { parts.push({ math: false, text: buf }); buf = ""; }
          parts.push({ math: true, display: true, text: dbody });
          i = close2 + 2;
          continue;
        }
      }
      var j = i + 1;
      var close = -1;
      while (j < s.length && s[j] !== "\n") {
        if (s[j] === "\\") { j += 2; continue; }
        if (s[j] === "$") { close = j; break; }
        j++;
      }
      var body = close > -1 ? s.slice(i + 1, close) : "";
      if (close > -1 && looksLikeMath(body)) {
        if (buf) { parts.push({ math: false, text: buf }); buf = ""; }
        parts.push({ math: true, display: false, text: body });
        i = close + 1;
        continue;
      }
      buf += c;
      i++;
    }
    if (buf) parts.push({ math: false, text: buf });
    return parts;
  }

  /**
   * 在任意文本里把所有 $...$ 渲染掉。
   * 注意：非公式部分**原样返回**，调用方负责转义（markdown.js 就是这么用的）。
   */
  function renderInline(text) {
    return splitMath(text)
      .map(function (p) {
        if (!p.math) return p.text;
        return '<span class="math' + (p.display ? " math-display-inline" : "") + '">' + typeset(p.text, p.display) + "</span>";
      })
      .join("");
  }

  global.MATHR = {
    render: render,              // 纯 CSS 渲染器（KaTeX 缺席时的保底）
    typeset: typeset,            // 统一入口：KaTeX 优先
    splitMath: splitMath,
    renderInline: renderInline,
    looksLikeMath: looksLikeMath,
    whyNotMath: whyNotMath,
    engine: function () { return katexLib() ? "katex" : "css"; },
    SYMBOLS: SYMBOLS,
    BIG_OPS: BIG_OPS
  };
})(typeof window !== "undefined" ? window : globalThis);
