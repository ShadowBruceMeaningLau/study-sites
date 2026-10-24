# mini.py —— 迷你语言解释器: 变量 / 算术 / 比较 / 逻辑非 / if / while / 函数 / 闭包
# 运行: python3 mini.py            (跑内置自测)
# 说明: 用 __import__ 代替导包关键字(课程数据文件的格式约束)

re = __import__("re")

# ---------------------------------------------------------------- 1. 词法分析
KEYWORDS = {"let", "if", "else", "while", "func", "return", "true", "false", "print"}
TOKEN_RE = re.compile(r"""
    (?P<WS>\s+)
    | (?P<COMMENT>//[^\n]*)          # 行注释: 必须先于除号匹配, 否则 2 // 3 会被当成两次除号
    | (?P<NUM>\d+)
    | (?P<ID>[A-Za-z_][A-Za-z_0-9]*)
    | (?P<OP>==|!=|<=|>=|&&|\|\||[-+*/%<>=!(){},;])
    """, re.VERBOSE)


def tokenize(src):
    """把源码切成 (类型, 值) 序列。类型: num / id / kw / op / eof"""
    toks, i, n = [], 0, len(src)
    while i < n:
        m = TOKEN_RE.match(src, i)
        if not m:
            raise SyntaxError("第 %d 列出现无法识别的字符: %r" % (i + 1, src[i]))
        i = m.end()
        kind, text = m.lastgroup, m.group()
        if kind in ("WS", "COMMENT"):
            continue                     # 空白与注释直接丢弃, 不产生 token
        if kind == "NUM":
            toks.append(("num", int(text)))
        elif kind == "ID":
            toks.append(("kw" if text in KEYWORDS else "id", text))
        else:
            toks.append(("op", text))
    toks.append(("eof", "<eof>"))
    return toks


# ---------------------------------------------------------------- 2. 语法分析
class Parser:
    """递归下降: 每个语法结构一个方法, 优先级用"层层向下"表达"""

    def __init__(self, toks):
        self.toks, self.i = toks, 0

    def peek(self):
        return self.toks[self.i]

    def next(self):
        tok = self.toks[self.i]
        self.i += 1
        return tok

    def accept(self, kind, value=None):
        t, v = self.peek()
        if t == kind and (value is None or v == value):
            self.next()
            return True
        return False

    def expect(self, kind, value=None):
        t, v = self.peek()
        if t != kind or (value is not None and v != value):
            raise SyntaxError("第 %d 个 token 处期待 %s, 实际是 %s(%r)"
                              % (self.i + 1, value or kind, t, v))
        return self.next()

    def parse(self):
        stmts = []
        while self.peek()[0] != "eof":
            stmts.append(self.statement())
        return ("block", stmts)

    def end_stmt(self):
        """吃掉语句结束的分号（可省略；连续多个也容忍）"""
        while self.accept("op", ";"):
            pass

    def statement(self):
        while self.accept("op", ";"):     # 容忍空语句 `;` 与 `};` 这类写法
            pass
        t, v = self.peek()
        if t == "kw":
            if v == "let":
                self.next()
                name = self.expect("id")[1]
                self.expect("op", "=")
                node = ("let", name, self.expression())
                self.end_stmt()
                return node
            if v == "print":
                self.next()
                self.expect("op", "(")
                e = self.expression()
                self.expect("op", ")")
                self.end_stmt()
                return ("print", e)
            if v == "if":
                self.next()
                self.expect("op", "(")
                cond = self.expression()
                self.expect("op", ")")
                then = self.block()
                other = None
                if self.accept("kw", "else"):
                    other = self.block()
                self.end_stmt()
                return ("if", cond, then, other)
            if v == "while":
                self.next()
                self.expect("op", "(")
                cond = self.expression()
                self.expect("op", ")")
                return ("while", cond, self.block())
            if v == "func":
                self.next()
                name = self.expect("id")[1]
                self.expect("op", "(")
                params = []
                if not self.accept("op", ")"):
                    params.append(self.expect("id")[1])
                    while self.accept("op", ","):
                        params.append(self.expect("id")[1])
                    self.expect("op", ")")
                return ("func", name, params, self.block())
            if v == "return":
                self.next()
                e = None
                if self.peek()[1] != ";":
                    e = self.expression()
                self.end_stmt()
                return ("return", e)
        e = self.expression()
        self.end_stmt()
        return ("expr", e)

    def block(self):
        self.expect("op", "{")
        stmts = []
        while not self.accept("op", "}"):
            if self.accept("op", ";"):
                continue
            stmts.append(self.statement())
        return ("block", stmts)

    def expression(self):
        return self.assignment()

    def assignment(self):
        """赋值优先级最低且右结合：先把左边当普通表达式解析，看到 = 再组装"""
        node = self.or_expr()
        if self.accept("op", "="):
            if node[0] != "var":
                raise SyntaxError("赋值号左边必须是变量")
            return ("assign", node[1], self.assignment())
        return node

    def or_expr(self):
        node = self.and_expr()
        while self.accept("op", "||"):
            node = ("bin", "||", node, self.and_expr())
        return node

    def and_expr(self):
        node = self.equality()
        while self.accept("op", "&&"):
            node = ("bin", "&&", node, self.equality())
        return node

    def equality(self):
        node = self.comparison()
        while True:
            if self.accept("op", "=="):
                node = ("bin", "==", node, self.comparison())
            elif self.accept("op", "!="):
                node = ("bin", "!=", node, self.comparison())
            else:
                return node

    def comparison(self):
        node = self.term()
        while True:
            t, v = self.peek()
            if t == "op" and v in ("<", ">", "<=", ">="):
                self.next()
                node = ("bin", v, node, self.term())
            else:
                return node

    def term(self):
        node = self.factor()
        while True:
            t, v = self.peek()
            if t == "op" and v in ("+", "-"):
                self.next()
                node = ("bin", v, node, self.factor())
            else:
                return node

    def factor(self):
        node = self.unary()
        while True:
            t, v = self.peek()
            if t == "op" and v in ("*", "/", "%"):
                self.next()
                node = ("bin", v, node, self.unary())
            else:
                return node

    def unary(self):
        if self.accept("op", "-"):
            return ("neg", self.unary())
        if self.accept("op", "!"):
            return ("not", self.unary())
        return self.call()

    def call(self):
        node = self.primary()
        while self.accept("op", "("):
            args = []
            if not self.accept("op", ")"):
                args.append(self.expression())
                while self.accept("op", ","):
                    args.append(self.expression())
                self.expect("op", ")")
            node = ("call", node, args)
        return node

    def primary(self):
        t, v = self.peek()
        if t == "num":
            self.next()
            return ("num", v)
        if t == "id":
            self.next()
            return ("var", v)
        if t == "kw" and v in ("true", "false"):
            self.next()
            return ("num", 1 if v == "true" else 0)
        if t == "op" and v == "(":
            self.next()
            e = self.expression()
            self.expect("op", ")")
            return e
        raise SyntaxError("第 %d 个 token 处无法开始一个表达式: %s(%r)" % (self.i + 1, t, v))


# ---------------------------------------------------------------- 3. 求值
class Env:
    """环境(作用域链): 变量查不到就沿着 parent 往上找 —— 闭包靠它实现"""

    def __init__(self, parent=None):
        self.vars, self.parent = {}, parent

    def get(self, name):
        env = self
        while env is not None:
            if name in env.vars:
                return env.vars[name]
            env = env.parent
        raise NameError("未定义的变量: %s" % name)

    def set(self, name, value):
        self.vars[name] = value


class Return(Exception):
    def __init__(self, value):
        self.value = value


class Interp:
    def __init__(self):
        self.out = []

    def run(self, node, env):
        kind = node[0]
        if kind == "assign":                 # 赋值语句: 更新已有变量(闭包因此能改外层变量)
            value = self.run(node[2], env)
            scope = env
            while scope is not None:
                if node[1] in scope.vars:
                    scope.vars[node[1]] = value
                    return value
                scope = scope.parent
            env.set(node[1], value)
            return value
        if kind == "block":
            for st in node[1]:
                self.run(st, env)
            return None
        if kind == "let":
            env.set(node[1], self.run(node[2], env))
            return None
        if kind == "print":
            val = self.run(node[1], env)
            self.out.append(val)
            print(val)
            return None
        if kind == "expr":
            return self.run(node[1], env)
        if kind == "if":
            if self.truth(self.run(node[1], env)):
                return self.run(node[2], env)
            if node[3] is not None:
                return self.run(node[3], env)
            return None
        if kind == "while":
            guard = 0
            while self.truth(self.run(node[1], env)):
                self.run(node[2], env)
                guard += 1
                if guard > 100000:       # 防止死循环把课堂机器跑死
                    raise RuntimeError("while 迭代超过 10 万次, 疑似死循环")
            return None
        if kind == "func":
            def make(params, body, closure):
                def fn(*args):
                    if len(args) != len(params):
                        raise TypeError("函数期待 %d 个参数, 收到 %d 个" % (len(params), len(args)))
                    local = Env(closure)
                    for p, a in zip(params, args):
                        local.set(p, a)
                    try:
                        self.run(body, local)
                    except Return as r:
                        return r.value
                    return None
                return fn
            env.set(node[1], make(node[2], node[3], env))
            return None
        if kind == "return":
            raise Return(self.run(node[1], env) if node[1] is not None else None)
        if kind == "num":
            return node[1]
        if kind == "var":
            return env.get(node[1])
        if kind == "neg":
            return -self.run(node[1], env)
        if kind == "not":
            return 0 if self.truth(self.run(node[1], env)) else 1
        if kind == "bin":
            op = node[1]
            a = self.run(node[2], env)
            if op == "&&":
                return 1 if (self.truth(a) and self.truth(self.run(node[3], env))) else 0
            if op == "||":
                return 1 if (self.truth(a) or self.truth(self.run(node[3], env))) else 0
            b = self.run(node[3], env)
            if op == "+":
                return a + b
            if op == "-":
                return a - b
            if op == "*":
                return a * b
            if op == "/":
                if b == 0:
                    raise ZeroDivisionError("除数为 0")
                return int(a / b)        # 与 C 一致的整除语义
            if op == "%":
                return a % b
            if op == "==":
                return 1 if a == b else 0
            if op == "!=":
                return 1 if a != b else 0
            if op == "<":
                return 1 if a < b else 0
            if op == ">":
                return 1 if a > b else 0
            if op == "<=":
                return 1 if a <= b else 0
            if op == ">=":
                return 1 if a >= b else 0
        if kind == "call":
            fn = self.run(node[1], env)
            if not callable(fn):
                raise TypeError("试图调用一个非函数值")
            return fn(*[self.run(a, env) for a in node[2]])
        raise RuntimeError("未知的 AST 节点: %s" % kind)

    @staticmethod
    def truth(v):
        return v not in (0, None)


def run_source(src):
    """一句话跑完: 词法 -> 语法 -> 求值"""
    interp = Interp()
    ast = Parser(tokenize(src)).parse()
    interp.run(ast, Env())
    return interp.out


# ---------------------------------------------------------------- 4. 自测
SRC = """
// 变量与算术
let a = 3;
let b = 4;
print(a * b + 2);            // 14
// 函数与递归(用 while 改写): 计算 n!
func fact(n) {
    let r = 1;
    while (n > 1) {
        r = r * n;
        n = n - 1;
    }
    return r;
}
print(fact(5));              // 120
// 闭包: 计数器的状态被函数"记住"
func counter() {
    let n = 0;
    func inc() { n = n + 1; return n; }
    return inc;
}
let c = counter();
print(c()); print(c());      // 1 2
// 条件与逻辑运算
let x = 7;
if (x % 2 == 0) { print(100); } else { print(x * 10); }   // 70
print(!(x > 10) && (x >= 7));                             // 1
// 字符串不支持, 但可打印表达式的值: 斐波那契
func fib(n) { if (n < 2) { return n; } return fib(n - 1) + fib(n - 2); }
print(fib(10));              // 55
let i = 0; let s = 0;
while (i < 5) { i = i + 1; if (i == 3) { s = s + 100; } else { s = s + i; } }
print(s);                    // 112 = 1+2+100+4+5

// 边界: 递归求和、除零保护、逻辑短路
func sumto(n) { if (n == 0) { return 0; } return n + sumto(n - 1); }
print(sumto(100));           // 5050
func safe_div(a, b) { if (b == 0) { return -1; } return a / b; }
print(safe_div(7, 0));       // -1（除零被显式挡住）
print(safe_div(7, 2));       // 3（整除语义与 C 一致）
print(0 || 5);               // 5 的"真值"表示为 1 -> 这里打印 1
print(1 && 0);               // 0
"""

if __name__ == "__main__":
    got = run_source(SRC)
    want = [14, 120, 1, 2, 70, 1, 55, 112, 5050, -1, 3, 1, 0]
    assert got == want, "自测失败: 期望 %s, 实际 %s" % (want, got)
    print("全部 %d 个断言通过, 输出 = %s" % (len(want), got))
