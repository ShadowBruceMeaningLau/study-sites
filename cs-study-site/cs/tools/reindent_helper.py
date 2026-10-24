"""reindent_helper.py —— 读 stdin 的 Python 源码，输出按逻辑嵌套重新缩进的版本。

原理：用 Python 自带的 tokenize 模块取得 INDENT/DEDENT 序列（这是语法层面的权威嵌套信息），
因此即使原缩进宽度被压坏或放大，只要嵌套结构还有意义，就能还原成标准的 4 空格缩进。
不同深度的语句原样保留，只改行首空白。
"""
import sys
import tokenize
import io

# 用法：python reindent_helper.py <输入文件路径> [输出文件路径]
# 说明：受限环境下"向子进程 stdin 写管道"可能被拒绝，因此用文件传参。
if len(sys.argv) < 2:
    sys.stderr.write("usage: reindent_helper.py <in.py> [out.py]\n")
    sys.exit(3)

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    src = fh.read()
try:
    toks = list(tokenize.generate_tokens(io.StringIO(src).readline))
except Exception as exc:  # 词法层面就坏了，交给上层处理
    sys.stderr.write("tokenize failed: %s\n" % exc)
    sys.exit(2)

lines = src.split("\n")
depth = 0
out = []
for t in toks:
    if t.type == tokenize.INDENT:
        depth += 1
    elif t.type == tokenize.DEDENT:
        depth = max(0, depth - 1)
    elif t.type in (tokenize.NEWLINE, tokenize.NL, tokenize.COMMENT, tokenize.ENDMARKER):
        pass

# 逐行处理：用 token 的 (行号, 列号) 判断每行首个 token 所处的深度
indent_of_line = {}
depth = 0
for t in toks:
    if t.type == tokenize.INDENT:
        depth += 1
        continue
    if t.type == tokenize.DEDENT:
        depth = max(0, depth - 1)
        continue
    if t.type in (tokenize.NEWLINE, tokenize.NL, tokenize.COMMENT, tokenize.INDENT, tokenize.DEDENT, tokenize.ENDMARKER):
        continue
    row = t.start[0]
    if row not in indent_of_line:
        indent_of_line[row] = depth

for i, raw in enumerate(lines, start=1):
    stripped = raw.strip()
    if stripped == "":
        out.append("")
        continue
    d = indent_of_line.get(i)
    if d is None:
        # 注释行或续行：保持其相对位置（用上一个可见行的深度）
        d = indent_of_line.get(max([k for k in indent_of_line if k < i], default=1), 0)
        if stripped.startswith("#"):
            out.append("    " * d + stripped)
        else:
            out.append("    " * (d + 1) + stripped)
        continue
    out.append("    " * d + stripped)

result = "\n".join(out)
if len(sys.argv) >= 3:
    with open(sys.argv[2], "w", encoding="utf-8") as fh:
        fh.write(result)
else:
    sys.stdout.write(result)
