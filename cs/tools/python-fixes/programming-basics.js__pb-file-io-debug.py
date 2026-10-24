# 写文件：'w' 是覆盖模式，'a' 是追加模式
with open('scores.txt', 'w', encoding='utf-8') as f:
    f.write('Li Ming 91\n')
    f.write('Wang Fang 85\n')
    # 离开 with 块时文件自动关闭，即使中间抛异常也会关 —— 比手写 close 更安全

# 读文件：逐行迭代，line 末尾带换行符，用 rstrip 去掉
with open('scores.txt', encoding='utf-8') as f:
    for line in f:
        name, sep, score = line.rstrip().rpartition(' ')   # 从右边切出分数，名字含空格也不怕
        if not sep:
            continue
        print(name, '->', score)

# 输出（与 C 版本完全一致）：
# Li Ming -> 91
# Wang Fang -> 85

# 陷阱：直接 line.split() 会得到 ['Li', 'Ming', '91'] 三个元素，
# 写成 name, score = line.split() 会抛 ValueError: too many values to unpack
with open('scores.txt', encoding='utf-8') as f:
    rows = [line.split() for line in f]
    print(rows)      # [['Li', 'Ming', '91'], ['Wang', 'Fang', '85']]

# 文件不存在时抛 FileNotFoundError，捕获后可以给出友好提示
try:
    with open('no_such_file.txt', encoding='utf-8') as f:
        print(f.read())
except FileNotFoundError:
    print('文件不存在，请检查路径')
