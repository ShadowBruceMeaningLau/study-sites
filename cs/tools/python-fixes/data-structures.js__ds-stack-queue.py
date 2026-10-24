# 与 C 版本行为一致：同样的入队顺序、同样的后缀表达式
# 队列与栈全部用 list 自己实现，不使用任何库


def run_circular_queue():
    """用 list 模拟循环队列，验证 front/rear 的取模回绕与判满条件"""
    MaxSize = 6
    data = [None] * MaxSize
    front = rear = 0

    def is_empty():
        return front == rear

    def is_full():
        return (rear + 1) % MaxSize == front

    def count():
        return (rear - front + MaxSize) % MaxSize

    def push(ch):
        nonlocal rear
        if is_full():
            return False
        data[rear] = ch
        rear = (rear + 1) % MaxSize
        return True

    def pop():
        nonlocal front
        if is_empty():
            return None
        ch = data[front]
        front = (front + 1) % MaxSize
        return ch

    print("循环队列 MaxSize = %d，最多容纳 %d 个元素（牺牲一个单元判满）" % (MaxSize, MaxSize - 1))
    for i in range(5):
        push(chr(ord('A') + i))
    print("入队 A~E 后 front=%d rear=%d 元素个数=%d 队满=%s"
          % (front, rear, count(), "是" if is_full() else "否"))
    pop()
    push('F')
    print("出队一个再入队 F：front=%d rear=%d 元素个数=%d 队满=%s"
          % (front, rear, count(), "是" if is_full() else "否"))


def bracket_match(s):
    """栈的经典应用：括号匹配"""
    pairs = {')': '(', ']': '[', '}': '{'}
    st = []
    for ch in s:
        if ch in "([{":
            st.append(ch)
        elif ch in pairs:
            if not st or st[-1] != pairs[ch]:
                return False
            st.pop()
    return not st


def infix_to_postfix(s):
    """中缀转后缀：运算符栈，遇到优先级不高于栈顶的运算符就先弹出"""
    prio = {'*': 2, '/': 2, '+': 1, '-': 1}
    out, st = [], []
    for ch in s:
        if ch.isdigit():
            out.append(ch)
        elif ch == '(':
            st.append(ch)
        elif ch == ')':
            while st and st[-1] != '(':
                out.append(st.pop())
            st.pop()
        elif ch in prio:
            while st and st[-1] != '(' and prio[st[-1]] >= prio[ch]:
                out.append(st.pop())
            st.append(ch)
    while st:
        out.append(st.pop())
    return "".join(out)


def eval_postfix(expr):
    """后缀求值：遇操作数入栈，遇运算符弹出两个操作数计算后回压"""
    st = []
    for ch in expr:
        if ch.isdigit():
            st.append(int(ch))
        else:
            b = st.pop()
            a = st.pop()
            if ch == '+':
                st.append(a + b)
            elif ch == '-':
                st.append(a - b)
            elif ch == '*':
                st.append(a * b)
            else:
                st.append(a // b)
    return st[0]


if __name__ == "__main__":
    run_circular_queue()
    print("括号匹配 %s -> %s" % ("([{}])", "合法" if bracket_match("([{}])") else "非法"))
    print("括号匹配 %s -> %s" % ("([)]", "合法" if bracket_match("([)]") else "非法"))

    post = infix_to_postfix("3+4*2-(1+5)")
    print("中缀 3+4*2-(1+5) 转后缀 = %s" % post)
    print("后缀求值结果 = %d（与直接计算 3+4*2-(1+5) 一致）" % eval_postfix(post))
    print("验证：(1+(2+3)*4-5)/2 的后缀为 %s" % infix_to_postfix("(1+(2+3)*4-5)/2"))

    # 工程提示：生产环境该用标准库的 deque，它的队头出队是 O(1)；
    # 而 list.pop(0) 需要把后面所有元素前移一位，是 O(n)。
    q = [i for i in range(3)]
    print("普通 list 当队列用：队头是 %d，出队后剩余 %s（注意这种写法是 O(n)）" % (q[0], q[1:]))
