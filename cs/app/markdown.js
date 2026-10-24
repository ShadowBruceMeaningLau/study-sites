/* ==========================================================================
   markdown.js —— 极简 Markdown 渲染 + 轻量语法高亮（零依赖）
   支持：# 标题、- / 1. 列表、段落、`行内代码`、**粗体**、[文本](链接)、> 提示、| 表格 |
   数学：$...$ 行内公式、$$...$$ 独立成行的大公式（详见 app/mathrender.js）
   ========================================================================== */
(function (global) {
  "use strict";

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** 数学片段 -> HTML（mathrender.js：KaTeX 优先，纯 CSS 兜底） */
  function mathHtml(tex, display) {
    if (global.MATHR && global.MATHR.typeset) return global.MATHR.typeset(tex, display);
    return escapeHtml(tex);
  }

  /**
   * 行内：先抽出行内代码与数学片段占位，避免其中的 * _ 被误处理。
   */
  function inline(text) {
    var codes = [];
    var maths = [];
    var s = String(text == null ? "" : text);

    // 行内代码 `...` 优先（代码里的 $ 不当作数学）
    s = s.replace(/`([^`]+)`/g, function (_m, c) {
      codes.push(c);
      return "\u0000" + (codes.length - 1) + "\u0000";
    });
    // 数学片段 $...$（扫描器会自动放过 echo $?、$1、Outer$1.class 这类非公式美元符）
    if (global.MATHR && global.MATHR.splitMath) {
      var parts = global.MATHR.splitMath(s);
      var rebuilt = "";
      for (var p = 0; p < parts.length; p++) {
        if (parts[p].math) {
          maths.push(parts[p]);
          rebuilt += "\u0001" + (maths.length - 1) + "\u0001";
        } else rebuilt += parts[p].text;
      }
      s = rebuilt;
    }

    s = escapeHtml(s);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_m, t, href) {
      return '<a href="' + href + '" target="_blank" rel="noopener">' + t + "</a>";
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s（(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    s = s.replace(/\u0000(\d+)\u0000/g, function (_m, i) {
      return "<code>" + escapeHtml(codes[Number(i)]) + "</code>";
    });
    s = s.replace(/\u0001(\d+)\u0001/g, function (_m, i) {
      var mm = maths[Number(i)];
      var body = typeof mm === "string" ? mm : mm.text;
      var disp = typeof mm === "string" ? false : !!mm.display;
      return '<span class="math' + (disp ? " math-display-inline" : "") + '">' + mathHtml(body, disp) + "</span>";
    });
    return s;
  }

  /**
   * 纯文本（不解析 Markdown）+ 公式：转义 HTML，但 $...$ 部分照常排版。
   * 给实验面板的说明文字用——那里的字符串是用户数据，不能当 Markdown 解析。
   */
  function mathText(text) {
    var s = String(text == null ? "" : text);
    if (!(global.MATHR && global.MATHR.splitMath)) return escapeHtml(s);
    return global.MATHR.splitMath(s)
      .map(function (p) {
        if (!p.math) return escapeHtml(p.text);
        return '<span class="math' + (p.display ? " math-display-inline" : "") + '">' + mathHtml(p.text, p.display) + "</span>";
      })
      .join("");
  }

  function md(text) {
    if (!text) return "";
    var lines = String(text).replace(/\r\n/g, "\n").split("\n");
    var out = [];
    var i = 0;
    var para = [];
    var list = null; // { tag, items: [] }
    var tableBuf = [];

    function flushPara() {
      if (para.length) {
        out.push("<p>" + para.join("<br>") + "</p>");
        para = [];
      }
    }
    function flushList() {
      if (list) {
        out.push("<" + list.tag + ">" + list.items.join("") + "</" + list.tag + ">");
        list = null;
      }
    }
    /**
     * 表格行切单元格：**公式里的竖线不算分隔符**。
     * 否则 $|f_n| \le g$、$\ln|x| + C$、$O(|Q_1| \times |Q_2|)$ 这类公式会被竖线切碎，
     * 页面上就会露出一堆落单的 $。\| 转义也一并跳过。
     */
    function splitRow(r) {
      var line = r.replace(/^\||\|$/g, "");
      var cells = [];
      var buf = "";
      var inMath = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === "\\") { buf += ch + (line[i + 1] || ""); i++; continue; }
        if (ch === "$") { inMath = !inMath; buf += ch; continue; }
        if (ch === "|" && !inMath) { cells.push(buf); buf = ""; continue; }
        buf += ch;
      }
      cells.push(buf);
      return cells.map(function (c) { return c.trim(); });
    }

    function flushTable() {
      if (!tableBuf.length) return;
      var rows = tableBuf.map(splitRow);
      tableBuf = [];
      if (rows.length < 2) return;
      var head = rows[0];
      var body = rows.slice(1);
      if (/^[-: ]+$/.test(body[0].join(""))) body = body.slice(1);
      var html = "<table><thead><tr>";
      head.forEach(function (h) { html += "<th>" + inline(h) + "</th>"; });
      html += "</tr></thead><tbody>";
      body.forEach(function (r) {
        html += "<tr>";
        head.forEach(function (_h, ci) { html += "<td>" + inline(r[ci] == null ? "" : r[ci]) + "</td>"; });
        html += "</tr>";
      });
      html += "</tbody></table>";
      out.push(html);
    }
    function flushAll() { flushPara(); flushList(); flushTable(); }

    while (i < lines.length) {
      var raw = lines[i];
      var line = raw.trim();

      if (line === "") { flushAll(); i++; continue; }

      // 独立成行的大公式：$$ ... $$
      if (line.length > 4 && line.slice(0, 2) === "$$" && line.slice(-2) === "$$") {
        flushAll();
        out.push('<div class="math-display">' + mathHtml(line.slice(2, -2).trim(), true) + "</div>");
        i++;
        continue;
      }

      // 表格
      if (/^\|.*\|$/.test(line)) { flushPara(); flushList(); tableBuf.push(line); i++; continue; }
      else flushTable();

      // 标题
      var h = line.match(/^(#{1,5})\s+(.*)$/);
      if (h) {
        flushAll();
        var lvl = Math.min(6, h[1].length + 1); // # -> h2（h1 留给页面标题）
        out.push("<h" + lvl + ">" + inline(h[2]) + "</h" + lvl + ">");
        i++;
        continue;
      }

      // 引用 / 提示
      if (/^>\s?/.test(line)) {
        flushAll();
        var buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          buf.push(lines[i].trim().replace(/^>\s?/, ""));
          i++;
        }
        out.push('<div class="callout">' + buf.map(inline).join("<br>") + "</div>");
        continue;
      }

      // 有序列表
      var ol = line.match(/^(\d+)[.)]\s+(.*)$/);
      if (ol) {
        flushPara(); flushTable();
        if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; }
        list.items.push("<li>" + inline(ol[2]) + "</li>");
        i++;
        continue;
      }

      // 无序列表
      var ul = line.match(/^[-*+]\s+(.*)$/);
      if (ul) {
        flushPara(); flushTable();
        if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; }
        list.items.push("<li>" + inline(ul[1]) + "</li>");
        i++;
        continue;
      }

      // 普通段落
      flushList();
      flushTable();
      para.push(inline(line));
      i++;
    }
    flushAll();
    return out.join("\n");
  }

  /* ------------------------------------------------------------ 语法高亮 */
  var KEYWORDS = {
    c: "int char float double void long short unsigned signed struct union enum typedef static const extern return if else for while do switch case default break continue goto sizeof register volatile inline",
    cpp: "int char float double void long short unsigned signed struct class union enum typedef static const extern return if else for while do switch case default break continue goto sizeof namespace template typename public private protected virtual override new delete this using nullptr auto constexpr",
    python: "def class return if elif else for while in not and or is None True False import from as with try except finally raise lambda global nonlocal yield assert del pass break continue async await match case self",
    java: "public private protected class interface extends implements static final void int long double float boolean char String new return if else for while do switch case default break continue try catch finally throw throws import package this super null true false abstract synchronized volatile",
    js: "const let var function return if else for while do switch case default break continue class extends new this typeof instanceof async await try catch finally throw import export from of in null undefined true false",
    sql: "SELECT FROM WHERE GROUP BY HAVING ORDER LIMIT INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER DROP INDEX VIEW JOIN INNER LEFT RIGHT FULL OUTER ON AS AND OR NOT NULL IS IN EXISTS BETWEEN LIKE DISTINCT UNION ALL COUNT SUM AVG MIN MAX CASE WHEN THEN ELSE END PRIMARY KEY FOREIGN REFERENCES UNIQUE CHECK DEFAULT AUTO_INCREMENT BEGIN COMMIT ROLLBACK TRANSACTION GRANT REVOKE WITH RECURSIVE EXPLAIN",
    bash: "cd ls cp mv rm mkdir rmdir touch cat echo grep sed awk chmod chown ps kill top df du tar git make gcc gdb man sudo apt yum curl wget ssh scp ping",
    asm: "MOV ADD SUB MUL DIV INC DEC CMP JMP JE JNE JG JL JLE JGE CALL RET PUSH POP LOAD STORE AND OR XOR NOT SHL SHR LEA NOP HLT INT",
    text: ""
  };
  var TYPES = {
    c: "size_t FILE uint8_t uint16_t uint32_t uint64_t int32_t",
    cpp: "size_t string vector map set unordered_map shared_ptr unique_ptr",
    python: "int str float list dict tuple set bool bytes object",
    java: "Integer Long Double Float Boolean Character List Map Set ArrayList HashMap",
    js: "Object Array Promise Map Set Number String Boolean JSON Math",
    sql: "INT VARCHAR CHAR TEXT DATE DATETIME DECIMAL FLOAT BIGINT SMALLINT",
    asm: "EAX EBX ECX EDX ESI EDI ESP EBP AX BX CX DX R1 R2 R3 PC IR MAR MDR ACC PSW",
    bash: "",
    text: ""
  };

  /**
   * 轻量高亮：单次扫描（注释/字符串/数字/标识符），避免二次破坏。
   */
  function highlight(code, lang) {
    var L = String(lang || "text").toLowerCase();
    if (L === "text" || L === "bash") return L === "bash" ? highlightBash(code) : escapeHtml(code);
    var kw = new Set((KEYWORDS[L] || "").split(/\s+/).filter(Boolean));
    var ty = new Set((TYPES[L] || "").split(/\s+/).filter(Boolean));
    var lineComment = L === "sql" ? "--" : (L === "asm" ? ";" : "//");
    var src = String(code == null ? "" : code);
    var out = "";
    var i = 0;
    var n = src.length;

    function isIdStart(c) { return /[A-Za-z_$]/.test(c); }
    function isId(c) { return /[A-Za-z0-9_$]/.test(c); }

    while (i < n) {
      var c = src[i];

      // 行注释
      if (src.startsWith(lineComment, i) && lineComment) {
        var e = src.indexOf("\n", i);
        if (e < 0) e = n;
        out += '<span class="tok-cm">' + escapeHtml(src.slice(i, e)) + "</span>";
        i = e;
        continue;
      }
      // 块注释
      if (c === "/" && src[i + 1] === "*") {
        var e2 = src.indexOf("*/", i + 2);
        e2 = e2 < 0 ? n : e2 + 2;
        out += '<span class="tok-cm">' + escapeHtml(src.slice(i, e2)) + "</span>";
        i = e2;
        continue;
      }
      // 字符串
      if (c === '"' || c === "'") {
        var q = c, j = i + 1;
        while (j < n) {
          if (src[j] === "\\") { j += 2; continue; }
          if (src[j] === q) { j++; break; }
          if (src[j] === "\n" && q !== "`") break;
          j++;
        }
        out += '<span class="tok-st">' + escapeHtml(src.slice(i, j)) + "</span>";
        i = j;
        continue;
      }
      // 数字
      if (/[0-9]/.test(c)) {
        var j2 = i;
        while (j2 < n && /[0-9a-fA-FxX._]/.test(src[j2])) j2++;
        out += '<span class="tok-nu">' + escapeHtml(src.slice(i, j2)) + "</span>";
        i = j2;
        continue;
      }
      // 标识符 / 关键字
      if (isIdStart(c)) {
        var j3 = i;
        while (j3 < n && isId(src[j3])) j3++;
        var word = src.slice(i, j3);
        var lower = L === "sql" || L === "asm" ? word.toUpperCase() : word;
        var k = 0;
        while (k < n && src[k] === " ") k++;
        if (kw.has(lower) || kw.has(word)) out += '<span class="tok-kw">' + escapeHtml(word) + "</span>";
        else if (ty.has(word)) out += '<span class="tok-ty">' + escapeHtml(word) + "</span>";
        else if (src[j3] === "(") out += '<span class="tok-fn">' + escapeHtml(word) + "</span>";
        else out += escapeHtml(word);
        i = j3;
        continue;
      }
      out += escapeHtml(c);
      i++;
    }
    return out;
  }

  function highlightBash(code) {
    var cmds = new Set(KEYWORDS.bash.split(/\s+/));
    return escapeHtml(code).replace(/(^|\n)(\s*)([\w.-]+)/g, function (m, br, sp, cmd) {
      return cmds.has(cmd) ? br + sp + '<span class="tok-kw">' + cmd + "</span>" : m;
    });
  }

  global.MD = { md: md, inline: inline, mathText: mathText, escapeHtml: escapeHtml, highlight: highlight };
})(window);
