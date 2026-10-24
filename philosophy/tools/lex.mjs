/* ==========================================================================
   lex.mjs —— 共用的源码扫描工具
   数据文件里最容易犯、后果最严重的错误，是「字符串里出现真实换行」：
   整个文件会被 JS 解析器拒绝，学习站直接加载不出这门课。

   这里提供一个小型词法扫描器，正确区分：
     · 字符串（单引号 / 双引号 / 模板字符串）
     · 行注释与块注释
     · 正则字面量（与除法运算符区分）
     · 英文撇号（Oxford World's Classics、Kierkegaard's）——它不是字符串定界符
   只有「同一个字符串里出现 \n」才报错。

   供 validate-curriculum.mjs / validate-reading.mjs 共用，避免三份拷贝各自漂移。
   ========================================================================== */

const isIdChar = (c) => /[A-Za-z0-9_$]/.test(c);
const KEYWORDS = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "do", "else", "case", "yield", "await"]);

/**
 * 找出「字符串里出现真实换行」的起始行号；没有则返回 0。
 * 关键改进（旧版曾误报）：英文里的撇号（'s、't、L'existentialisme、World's）
 * 不构成字符串边界——只有当单引号出现在"可能开始一个字符串"的位置时才算。
 */
export function findUnterminatedString(src) {
  let line = 1;
  let prevWord = "";
  let prevSignificant = "";

  const regexAllowed = () =>
    prevSignificant === "" ||
    "(,=:[!&|?{};+-*%~^<>".includes(prevSignificant) ||
    KEYWORDS.has(prevWord);

  /** 单引号出现在字母/数字/右括号之后时，按撇号处理（英文所有格、缩写） */
  const isApostrophe = (i) =>
    i > 0 && /[A-Za-z0-9_$)\]]/.test(src[i - 1]) &&
    // 后面不是空格/标点（那才像字符串开头），并且前面不是 = ( , : 之类的赋值位置
    !/[\s,;:=([{]/.test(src[i - 1]);

  let i = 0;
  while (i < src.length) {
    const c = src[i];

    if (c === "\n") { line++; i++; continue; }
    if (c === " " || c === "\t" || c === "\r") { i++; continue; }

    // 行注释
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    // 块注释
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; }
      i += 2;
      continue;
    }
    // 正则字面量
    if (c === "/" && regexAllowed()) {
      let j = i + 1, inClass = false, closed = false;
      while (j < src.length) {
        const d = src[j];
        if (d === "\\") { j += 2; continue; }
        if (d === "\n") break;
        if (d === "[") inClass = true;
        else if (d === "]") inClass = false;
        else if (d === "/" && !inClass) { closed = true; break; }
        j++;
      }
      if (closed) {
        i = j + 1;
        while (i < src.length && isIdChar(src[i])) i++;
        prevSignificant = "/"; prevWord = "";
        continue;
      }
    }

    // 英文撇号：跳过，不当作字符串边界
    if (c === "'" && isApostrophe(i)) { i++; prevSignificant = "'"; continue; }

    // 字符串
    if (c === '"' || c === "'" || c === "`") {
      const quote = c, startLine = line;
      i++;
      let terminated = false;
      while (i < src.length) {
        const d = src[i];
        if (d === "\\") { i += 2; continue; }
        if (d === "\n") break;                 // 换行 => 字符串未闭合
        // 双引号字符串里的英文撇号不影响；单引号字符串里遇到未转义的单引号即结束
        if (d === quote) { terminated = true; i++; break; }
        i++;
      }
      if (!terminated) return startLine;
      prevSignificant = quote; prevWord = "";
      continue;
    }

    // 标识符 / 数字
    if (isIdChar(c)) {
      let j = i;
      while (j < src.length && isIdChar(src[j])) j++;
      prevWord = src.slice(i, j);
      prevSignificant = "a";
      i = j;
      continue;
    }

    prevSignificant = c;
    if (!isIdChar(c)) prevWord = "";
    i++;
  }
  return 0;
}

/** 检测真正的模块语法（不误伤英文术语，如 existential import） */
export function findModuleSyntax(src) {
  const out = [];
  src.split(/\r?\n/).forEach((l, i) => {
    if (/^\s*(import|export)\b/.test(l) || /\brequire\s*\(/.test(l)) {
      out.push({ line: i + 1, text: l.trim().slice(0, 140) });
    }
  });
  return out;
}
