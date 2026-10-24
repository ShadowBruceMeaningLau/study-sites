/* ==========================================================================
   python-basics-ai.js —— 课程 2《Python 编程基础（AI 方向）》
   格式契约见 llm/CONTENT-SPEC.md；结构契约见 cs/CONTENT-SPEC.md。
   全部代码为纯标准库 Python，不依赖 numpy / torch / requests。
   ========================================================================== */
window.COURSE_PACKS.push({
  id: "python-basics-ai",
  title: "Python 编程基础（AI 方向）",
  icon: "🐍",
  term: "主线 A · LLM 基础与原理",
  hours: 40,
  blurb: "一门只为 AI 服务的 Python 课：从第一行 print 一路走到能读写文件、装包、用标准库向本机大模型发请求。全程只用 Python 自带的东西，不装任何重型依赖，每段代码都能当场跑出结果。",
  tags: ["零基础", "核心"],
  need: "零基础可学：本课从第一行 print 讲起，不假设任何编程经验；凡是新出现的名词都在它第一次出现的地方解释清楚，也不需要任何其他语言的基础。",
  advanced: {
    texts: ["Python 官方教程（中文版）第 1~7 章", "Python 标准库文档中的 json / urllib.request / math 三节", "Ollama 本地服务接口说明（本机 127.0.0.1:11434 的 HTTP 接口）"],
    labs: ["用标准库写一个命令行小工具：读入一个 JSON 文件，把里面的分数从高到低排序后打印", "给最后一讲的脚本加一层循环，让你能在终端里连续追问同一个模型"],
    project: "写一个 chat.py：读取本机已安装的模型列表，让你选一个模型，用 while 循环连续对话，并把每一次问答追加写入 chat-log.json（全程只用标准库）",
    criteria: "能独立写出 50 行以内、只用标准库的 Python 脚本；能读写 JSON 文件；能向本机模型服务发出一个请求并把回复打印出来。"
  },
  lessons: [
    /* ================================================== py-1 */
    {
      id: "py-1",
      title: "第一行代码到变量",
      goal: "能写出一段用变量存值、用 f-string 拼出结果的 Python 程序，并在自己的电脑上成功运行。",
      est: 30,
      blocks: [
        {
          type: "concept",
          title: "程序就是一份写给计算机的指令清单",
          md: "计算机不会猜你的意思。你写的每一行都是一个明确的动作，它会从上到下一条一条执行。\n\n本课的第一个动作叫 **print**（就是指「把括号里的东西显示到屏幕上」的那条指令）。想在屏幕上看到字，就必须写成 print 加上一对圆括号。\n\n- print('你好') 会显示：你好\n- print(1 + 2) 会显示：3\n\n圆括号里放什么，它就显示什么。这是你和程序之间最直接的对话方式。"
        },
        {
          type: "analogy",
          title: "变量像贴了名字的储物柜",
          md: "想象一排储物柜。你往 3 号柜里放进一个书包，然后在柜门上贴一张纸条写着「小明的包」。以后你说「把小明那个包给我」，管理员就知道去 3 号柜拿。\n\n变量干的就是这件事：把值放进一个位置，再给这个位置起个名字。之后你只需要用名字，就能把值取回来，而不必记住它到底存在哪里。"
        },
        {
          type: "concept",
          title: "变量：给一个值起个名字",
          md: "**变量**（variable，就是指给一个值起个名字，之后用这个名字就能把值取回来）用等号来创建：\n\n- name = '小明' 的意思是「把右边的值交给左边这个名字管」\n- 等号不是数学里的「相等」，而是「把右边装进左边」\n\n名字可以自己起，但要遵守两条规矩：只能用字母、数字、下划线，且不能以数字开头；不能和 Python 已经用掉的关键字（比如 print、for）重名。"
        },
        {
          type: "concept",
          title: "文字和数字是两种不同的东西",
          md: "**字符串**（string，就是指被一对引号包起来的一段文字）必须带引号，单引号双引号都可以：'你好' 和 \"你好\" 是同一个东西。引号的作用是告诉 Python「这里面是文字，不要当代码看」。\n\n不带引号的数字是真正的数，可以直接做加减乘除：12 + 1 得到 13。而字符串的加法是「接起来」：'小' + '明' 得到 '小明'。\n\n这两个区别非常要紧：'12' 是文字，12 是数字，前者不能直接和数字相加。"
        },
        {
          type: "code",
          lang: "python",
          title: "第一段程序：存进去、拼出来、打印",
          code: "# 井号开头的是注释，Python 会跳过它，只写给人看\nname = '小明'            # 变量 name 里装了一段文字\nage = 12                 # 变量 age 里装了一个整数\n\nprint('你好，' + name)   # 加号把两段文字接起来，显示：你好，小明\nprint(age + 1)           # 数字可以直接加，显示：13\n\n# f-string：在引号前加一个 f，就能把变量的值直接嵌进文字里\nmessage = f'{name} 今年 {age} 岁，明年 {age + 1} 岁'\nprint(message)           # 显示：小明 今年 12 岁，明年 13 岁\n\nprint(type(name))        # type 用来查看一个值是什么类型，显示：<class 'str'>\nprint(type(age))         # 显示：<class 'int'>"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "实验台：一行一行看变量怎么变",
          config: {
            state: {
              "本步开始前": "内存里一个变量都还没有",
              "累计输出": "（无）"
            },
            steps: [
              {
                desc: "第 1 步：执行 name = '小明'，把一段文字装进名为 name 的变量",
                state: { name: "小明", age: "（还没有值）", message: "（还没有值）" },
                note: "变量是「先有值，才有名字」的关系：右边先算出来，再交给左边。"
              },
              {
                desc: "第 2 步：执行 age = 12，把整数 12 装进名为 age 的变量",
                state: { name: "小明", age: "12", message: "（还没有值）" },
                note: "同一个程序里可以有任意多个变量，它们互不干扰。"
              },
              {
                desc: "第 3 步：执行 print('你好，' + name)，把两段文字接起来显示",
                state: { name: "小明", age: "12", message: "（还没有值）", "本步输出": "你好，小明" },
                note: "字符串的加号是「接起来」，不是算术加法。"
              },
              {
                desc: "第 4 步：执行 print(age + 1)，数字相加得到 13 并显示",
                state: { name: "小明", age: "12", message: "（还没有值）", "本步输出": "13" },
                note: "age 本身没有被改变，13 只是这一次计算的结果，没有被存下来。"
              },
              {
                desc: "第 5 步：执行 message = f'...'，把变量嵌进文字后存进新变量",
                state: { name: "小明", age: "12", message: "小明 今年 12 岁，明年 13 岁" },
                note: "f-string 里的大括号是一个「填空位」，填进去的是变量当前的值。"
              },
              {
                desc: "第 6 步：执行 print(message)，把拼好的整句话显示出来",
                state: { name: "小明", age: "12", message: "小明 今年 12 岁，明年 13 岁", "本步输出": "小明 今年 12 岁，明年 13 岁" },
                note: "到这一步，程序执行完了，屏幕上留下了三行输出。"
              }
            ]
          }
        },
        {
          type: "pitfall",
          title: "新手最常踩的四个坑",
          items: [
            "引号用了中文全角引号：写成 print(“你好”) 会报 SyntaxError，必须是英文半角引号。",
            "该加引号的文字没加：print(你好) 会让 Python 去找一个叫「你好」的变量，找不到就报 NameError。",
            "把等号当成了数学等号：a = a + 1 在 Python 里完全合法，意思是「把 a 现在的值加 1，再装回 a」。",
            "混用文字和数字：'12' + 1 会报 TypeError，因为文字和数字不能直接相加；要先用 int('12') 把文字变成整数。"
          ]
        }
      ],
      quiz: [
        {
          id: "py-1-q1",
          type: "single",
          q: "下面哪一行能把文字「你好」显示到屏幕上？",
          options: ["print(你好)", "print('你好')", "show('你好')", "你好.print()"],
          answer: 1,
          why: "正确项是 B：print 后面跟一对圆括号，文字必须带引号，所以 print('你好') 成立。A 没加引号，Python 会去找一个叫「你好」的变量，找不到就报 NameError。C 里的 show 不是 Python 的内置指令，会报 NameError。D 把顺序写反了，字符串本身没有 print 这个方法（会报 AttributeError）。"
        },
        {
          id: "py-1-q2",
          type: "single",
          q: "关于变量，下面哪种说法是对的？",
          options: [
            "变量是硬盘上的一个文件",
            "变量是给一个值起的名字，之后可以用这个名字取回那个值",
            "变量只能装数字，不能装文字",
            "变量是一条以 # 开头的注释"
          ],
          answer: 1,
          why: "正确项是 B，这正是变量的定义。A 混淆了变量与文件：变量活在程序运行期间的内存里，程序结束就没了。C 说错了，变量既能装数字也能装文字，还能装列表、字典等。D 混淆了变量与注释，注释以 # 开头且不会被当成代码执行。"
        },
        {
          id: "py-1-q3",
          type: "fill",
          q: "要把字符串 '小' 和字符串 '明' 接成 '小明'，中间用哪个运算符？",
          answer: ["+", "加号", "＋"],
          why: "字符串之间的加号表示「把它们接起来」，'小' + '明' 得到 '小明'。注意这个加号只对「两边都是字符串」成立；如果一边是数字，比如 '12' + 1，会报 TypeError，需要先用 int('12') 转成数字。"
        }
      ],
      checklist: [
        "我能说清变量是什么，并写出 a = 1 后立刻用 print(a) 看到结果",
        "我能区分 '12' 和 12，并说出它们相加时会发生什么",
        "我在自己的电脑上跑通了本讲那段带 f-string 的程序"
      ]
    },

    /* ================================================== py-2 */
    {
      id: "py-2",
      title: "列表、字典与循环",
      goal: "能用列表存一串数据、用字典按键查值，并用 for 循环把每一项都处理一遍。",
      est: 35,
      blocks: [
        {
          type: "concept",
          title: "列表：把一串值排好队",
          md: "**列表**（list，就是指按顺序排好的一串值，用一对方括号括起来，值之间用逗号隔开）适合存放「同类的很多个东西」，比如一门课所有学生的分数。\n\n- scores = [88, 92, 75, 60]\n- 列表里的每一个东西叫一个**元素**（element，就是指列表里的单独一项）\n- 列表的**长度**（就是指里面一共有几项）用 len(scores) 得到，这里得到 4\n\n列表可以装数字，也可以装文字，甚至可以混着装，但实际写代码时最好让一个列表只装一类东西。"
        },
        {
          type: "concept",
          title: "下标：从 0 开始数位置",
          md: "**下标**（index，就是指元素在列表里的位置编号，第一个元素的编号是 0 而不是 1）用方括号写在列表名后面：\n\n- scores[0] 是第一个元素 88\n- scores[3] 是第四个元素 60\n- scores[-1] 是最后一个元素，也就是 60\n\n**切片**（slice，就是指一次取出连续的一小段）写成 scores[1:3]，意思是「从下标 1 开始取，取到下标 3 之前停下」，得到 [92, 75]——注意含头不含尾，右边那个数字取不到。"
        },
        {
          type: "code",
          lang: "python",
          title: "先跑起来：列表的取、加、算",
          code: "scores = [88, 92, 75, 60]     # 列表：一串按顺序排好的分数\nprint(scores[0])              # 下标 0 是第一个元素，显示 88\nprint(scores[-1])             # 下标 -1 是最后一个元素，显示 60\nprint(len(scores))            # len 求长度，显示 4\n\nscores.append(95)             # append 表示在末尾追加一个元素\nprint(scores)                 # 显示 [88, 92, 75, 60, 95]\nprint(scores[1:3])            # 切片，含头不含尾，显示 [92, 75]\nprint(max(scores), min(scores))   # max 最大值，min 最小值，显示 95 60\nprint(sum(scores) / len(scores))  # sum 求和后除以个数，显示平均分 82.0"
        },
        {
          type: "concept",
          title: "字典：用名字去查东西",
          md: "**字典**（dictionary，就是指用「键」去查「值」的一张对照表，用一对花括号括起来）适合存放「有名字的几项信息」，比如一个学生的姓名、年龄、班级。\n\n- student = {'name': '小明', 'age': 12}\n- **键**（key，就是指用来查的那个名字）写在冒号左边，**值**（value，就是指查出来的内容）写在冒号右边\n- 用 student['name'] 就能取出 '小明'\n- 想安全地取值、取不到时给个默认值，可以写 student.get('city', '未填写')\n\n字典的键必须唯一：同一个键写两次，后面的会盖掉前面的。列表靠位置找东西，字典靠名字找东西。"
        },
        {
          type: "concept",
          title: "for 循环：把同一件事做很多遍",
          md: "**循环**（loop，就是指把同一段代码重复执行很多遍）是让程序替你干重复活的关键。**for 循环**的固定写法是「for 一个临时名字 in 一串东西:」，然后换行缩进写要重复做的事。\n\n- for s in scores: 的意思是「把 scores 里的每一项依次取出来交给 s，每取一次就跑一遍下面的缩进代码」\n- 遍历字典时拿到的是键：for k in student: 里 k 依次是 'name'、'age'\n- 想同时拿到键和值，用 student.items()\n\n缩进（行首的空格）在 Python 里不是排版，而是语法：缩进的代码才属于这个循环。同一个程序里缩进要统一用 4 个空格。"
        },
        {
          type: "code",
          lang: "python",
          title: "循环的四段小练习",
          code: "scores = [88, 92, 75, 60]\n\n# 1. 累加：把每一项加到 total 上\ntotal = 0\nfor s in scores:\n    total = total + s\nprint('总分', total)                 # 显示 总分 315\n\n# 2. 一边循环一边挑出及格的\npassed = []\nfor s in scores:\n    if s >= 80:                      # if 表示「如果满足条件就做下面缩进的事」\n        passed.append(s)\nprint('80 分以上', passed)            # 显示 80 分以上 [88, 92]\n\n# 3. 带上位置编号：enumerate 同时给出下标和元素\nfor i, s in enumerate(scores):\n    print(i, s)                      # 依次显示 0 88 / 1 92 / 2 75 / 3 60\n\n# 4. 遍历字典\nstudent = {'name': '小明', 'age': 12, 'city': '杭州'}\nfor key in student:                  # 直接遍历字典拿到的是键\n    print(key, '->', student[key])\n\nfor key, value in student.items():   # items 同时给出键和值\n    print(key, '=', value)\n\n# 5. 按固定次数循环：range(3) 给出 0 1 2\nfor i in range(3):\n    print('第', i + 1, '次')"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "实验台：盯着 total 和 s 看循环怎么走",
          config: {
            state: {
              "scores": "88 | 92 | 75 | 60",
              "total": "（还没开始累加）",
              "s": "（还没取到任何一项）"
            },
            steps: [
              {
                desc: "第 0 步（准备）：total 归零，准备开始遍历 scores = [88, 92, 75, 60]",
                state: { s: "（还没开始）", total: "0", scores: "88 | 92 | 75 | 60" },
                note: "循环开始前先把累加器清零，这一步漏掉会把上一轮的结果带进来。"
              },
              {
                desc: "第 1 轮：s 取到第一项 88，执行 total = 0 + 88",
                state: { s: "88", total: "88", scores: "88 | 92 | 75 | 60" },
                note: "total = total + s 里的 total 在等号两边都出现，这是累加的固定写法。"
              },
              {
                desc: "第 2 轮：s 取到 92，执行 total = 88 + 92",
                state: { s: "92", total: "180", scores: "88 | 92 | 75 | 60" },
                note: "每一轮结束后，s 的值都会被下一项覆盖，只有 total 会不断累积。"
              },
              {
                desc: "第 3 轮：s 取到 75，执行 total = 180 + 75",
                state: { s: "75", total: "255", scores: "88 | 92 | 75 | 60" },
                note: "到这一步，前 3 项都已经处理过了。"
              },
              {
                desc: "第 4 轮：s 取到 60，执行 total = 255 + 60",
                state: { s: "60", total: "315", scores: "88 | 92 | 75 | 60" },
                note: "列表里没有更多项了，循环自动结束，不需要手写「什么时候停」。"
              },
              {
                desc: "循环结束：print('总分', total) 显示 总分 315，平均分是 315 除以 4",
                state: { s: "60（保留着最后一轮的值）", total: "315", "平均分": "78.75" },
                note: "318 除以 4 是 78.75；写成 total / len(scores) 就不怕列表长度以后变了。"
              }
            ]
          }
        },
        {
          type: "pitfall",
          title: "循环与下标的四个坑",
          items: [
            "下标从 0 开始：长度是 4 的列表，合法下标只有 0 到 3，写 scores[4] 会报 IndexError。",
            "忘了缩进或缩进不统一：循环体必须统一缩进，混用空格和制表符会报 IndentationError。",
            "一边循环一边删元素：这会打乱后来的编号，容易漏掉几项；更稳妥的做法是先挑出要留下的项组成新列表。",
            "字典取不存在的键：student['city'] 在键不存在时会报 KeyError，拿不准就用 student.get('city')，取不到会得到 None 而不是报错。"
          ]
        }
      ],
      quiz: [
        {
          id: "py-2-q1",
          type: "single",
          q: "列表 values = [10, 20, 30] 里，数字 20 的下标是几？",
          options: ["0", "1", "2", "3"],
          answer: 1,
          why: "正确项是 B。下标从 0 开始数，所以 10 的下标是 0，20 的下标是 1，30 的下标是 2。选 A 是以为从 1 开始数；选 C 是把它当成了最后一个元素的下标；选 D 的 3 已经越界，这个列表长度只有 3，合法下标最大是 2。"
        },
        {
          id: "py-2-q2",
          type: "multi",
          q: "关于字典，下面哪些说法是对的？（多选）",
          options: [
            "字典用键来查值",
            "同一个字典里，键必须唯一",
            "字典里的项可以用下标按位置取出，比如 student[0]",
            "student['name'] 可以取出键 name 对应的值"
          ],
          answer: [0, 1, 3],
          why: "A、B、D 都对：字典的用途就是按键查值，键重复时后面的会盖掉前面的，取值写成 student['name']。C 是错的：方括号里写整数是按位置取列表元素的做法，字典要的是键；对字典写 student[0] 会去找一个叫 0 的键，找不到就报 KeyError。"
        },
        {
          id: "py-2-q3",
          type: "fill",
          q: "想知道列表里一共有多少项，用哪个 Python 内置函数？",
          answer: ["len", "len()", "len 函数"],
          why: "len 用来求长度，写成 len(scores)，返回值就是项数。容易混淆的是 sum（求和）和 max（求最大），它们都不会告诉你「有几项」。"
        }
      ],
      checklist: [
        "我能说出列表和字典各自适合装什么样的数据，并各写一个例子",
        "我能手算一段 for 循环的累加过程，算出每一轮之后累加器的值",
        "我跑通了本讲那段五小节的代码，并能解释 enumerate 和 items 各自多给了什么"
      ]
    },

    /* ================================================== py-3 */
    {
      id: "py-3",
      title: "函数与模块",
      goal: "能把重复的代码打包成函数反复调用，并用 import 借来标准库已有的能力，不用自己重写。",
      est: 35,
      blocks: [
        {
          type: "analogy",
          title: "函数像自动售货机",
          md: "自动售货机有三个特点：投进去固定的东西（硬币、选择），机器内部做一串你看不见的动作，最后从出口吐出结果。你不需要知道里面怎么运作，只需要知道「投什么、出什么」。\n\n函数就是这样一台机器：你把数据递进去，它跑完内部那串代码，把结果交回给你。写一次，可以在程序里用无数次。"
        },
        {
          type: "concept",
          title: "函数：把一段代码打包并起个名字",
          md: "**函数**（function，就是指把一段代码打包起来并起个名字，之后用这个名字就能再执行一次那串代码）用 def 来定义：\n\n- def 后面跟函数名和一对圆括号，行尾必须有英文冒号\n- 换行缩进写函数体，也就是「这台机器内部要做的事」\n- 定义只是把机器造出来，不会运行；要让它跑，得在后面写一次函数名加括号去调用\n\n函数名最好用能说明动作的写法，比如 area_of_circle、to_int，读到名字就知道它干什么。"
        },
        {
          type: "concept",
          title: "参数与返回值：投进去什么，吐出来什么",
          md: "**参数**（parameter，就是指调用函数时递进去的那个值，函数用形参名接住它）写在圆括号里：def greet(name) 里的 name 就是形参。\n\n- 可以给参数一个默认值：def greet(name, greeting='你好')，调用时只写 greet('小明') 就用默认的「你好」\n- **返回值**（return value，就是指函数跑完后交回给调用处的结果）用 return 交出去\n- 遇到 return，函数立刻结束并把值交给调用它的那一行；没有写 return 的函数，返回值是 None\n\n关键区别：函数里直接 print 是「把结果显示给人看」，而 return 是「把结果交给程序继续用」。想让函数的结果能被后续计算使用，就必须 return。"
        },
        {
          type: "code",
          lang: "python",
          title: "定义、调用、带默认值、返回值",
          code: "import math                     # import 把标准库里的 math 借进来用\n\ndef area_of_circle(r):\n    '''给半径 r，返回圆的面积。三个引号中间的内容是说明文字，不影响运行。'''\n    return math.pi * r * r\n\ndef greet(name, greeting='你好'):\n    return greeting + '，' + name + '！'\n\ndef describe(scores):\n    '''给一串分数，返回一句概括。'''\n    if not scores:              # 空列表时直接返回，避免除以 0\n        return '一个分数都没有'\n    return f'共 {len(scores)} 项，最高 {max(scores)}，平均 {sum(scores) / len(scores):.1f}'\n\nprint(area_of_circle(2))          # 显示 12.566370614359172\nprint(greet('小明'))               # 显示 你好，小明！\nprint(greet('小红', '早上好'))      # 显示 早上好，小红！\nprint(describe([88, 92, 75, 60])) # 显示 共 4 项，最高 92，平均 78.8\nprint(describe([]))               # 显示 一个分数都没有\n\n# 返回值可以被继续拿去计算：面积乘以高度就是体积\nprint(area_of_circle(2) * 3)      # 显示 37.69911184307752"
        },
        {
          type: "concept",
          title: "模块与 import：不用什么都自己写",
          md: "**模块**（module，就是指一个装着若干现成函数和常量的文件，别人写好放在 Python 自带库里）用 import 关键字借进当前程序。\n\n- import math 之后，用 math.pi 拿到圆周率，用 math.sqrt(9) 拿到 3.0\n- from math import sqrt 可以只借一个函数，之后直接写 sqrt(9)\n- 本课用得最多的是 math（数学）、json（读写结构化文字）、urllib.request（发网络请求）\n\nimport 的规矩很简单：写在文件开头，想用哪个模块就借哪个，没借就报 NameError。Python 自带的标准库覆盖了非常多的常见需求，先学会借力，比自己从零造要好得多。"
        },
        {
          type: "code",
          lang: "python",
          title: "把程序入口写清楚",
          code: "import math\n\ndef circle_area(r):\n    return math.pi * r * r\n\ndef main():\n    '''把主流程收进一个函数，方便单独调用和测试。'''\n    for r in [1, 2, 3]:\n        print(f'半径 {r} 的圆面积是 {circle_area(r):.2f}')\n\n# 下面这一行是 Python 程序的常见写法：\n# 直接运行本文件时 __name__ 的值是字符串 __main__，条件成立，于是执行 main()；\n# 当本文件被别人 import 时，条件不成立，main() 不会自动跑。\nif __name__ == '__main__':\n    main()"
        },
        {
          type: "pitfall",
          title: "函数相关的四个坑",
          items: [
            "只 print 不 return：想让结果参与后续计算却只写了 print，调用处拿到的会是 None，再拿它做加法就报 TypeError。",
            "忘记调用：只写了 greet 而没有写 greet('小明')，程序什么都不会发生，因为定义不等于执行。",
            "把默认值写成可变对象：def f(items=[]) 会让这个空列表在多次调用之间被共用，越加越多；需要空列表时写 def f(items=None) 再在函数里判断。",
            "名字被覆盖：先定义了 len = 5，之后 len('abc') 就会失败，因为内置名字被你的变量盖住了；变量名别用 print、len、sum 这些内置名。"
          ]
        }
      ],
      quiz: [
        {
          id: "py-3-q1",
          type: "single",
          q: "函数里的 return 起什么作用？",
          options: [
            "把结果打印到屏幕上",
            "把结果交回给调用它的那一行，函数随即结束",
            "让程序立即退出",
            "用来声明一个新变量"
          ],
          answer: 1,
          why: "正确项是 B：return 把值交回调用处，并且立刻结束函数。A 混淆了 print 与 return：print 只是显示给人看，调用处拿到的是 None。C 是把 return 和系统退出混为一谈，退出整个程序要用 sys.exit。D 说反了，return 是交回值，定义变量用等号。"
        },
        {
          id: "py-3-q2",
          type: "single",
          q: "写法 def greet(name, greeting='你好') 里的 greeting='你好' 是什么意思？",
          options: [
            "调用时必须传入 greeting，否则报错",
            "调用时不传 greeting 时，就用「你好」这个默认值",
            "把 greeting 定义成一个全局变量",
            "给函数写了一条注释"
          ],
          answer: 1,
          why: "正确项是 B，这就是参数默认值：greet('小明') 会得到「你好，小明！」，而 greet('小红', '早上好') 会用传入的值覆盖默认值。A 说反了，有默认值的参数恰恰是可省的。C 混淆了形参与全局变量。D 混淆了默认值与注释。"
        },
        {
          id: "py-3-q3",
          type: "fill",
          q: "想借来 Python 标准库里的数学模块，在文件开头要写哪一条语句？",
          answer: ["import math", "import math 模块", "import math", "import math（导入 math 模块）"],
          why: "写成 import math，之后用 math.pi、math.sqrt 这样的带前缀名字调用。想省掉前缀可以写 from math import sqrt，但这时就只有 sqrt 可用，要用 pi 还得再借一次。"
        }
      ],
      checklist: [
        "我能说清 print 与 return 的区别，并各写一个例子",
        "我能定义一个带默认值参数的函数，并解释不传参数时会发生什么",
        "我跑通了本讲两个代码块，并改动过其中一个参数看输出变化"
      ]
    },

    /* ================================================== py-4 */
    {
      id: "py-4",
      title: "文件读写与 JSON",
      goal: "能把数据写进文件再读回来，并用 JSON 在「结构化的数据」和「一段文字」之间来回转换。",
      est: 35,
      blocks: [
        {
          type: "concept",
          title: "文件：让数据在程序结束后还活着",
          md: "变量活在程序运行期间，程序一结束它们就没了。想让结果留下来，就得写进**文件**（file，就是指硬盘上一段有名字、可以反复读写的存储空间）。\n\n读写文件的三件套：\n\n- **打开**：open('demo.txt', 'w')，第一个参数是文件名，第二个是**模式**（mode，就是指这次是读还是写）\n- **操作**：写入用 f.write('文字')，读取用 f.read()\n- **关闭**：用完之后要关闭，让系统把数据真正落盘\n\n模式的含义：'w' 是覆盖写入（文件原有内容会被清空），'a' 是追加写入（新内容接在后面），'r' 是只读。"
        },
        {
          type: "concept",
          title: "with：不用手动关文件",
          md: "**with 语句**（就是指「进入这一段时打开文件，离开这一段时自动关闭它」的写法）把打开和关闭打包成一对：\n\n- with open('demo.txt', 'w', encoding='utf-8') as f: 换行缩进写操作\n- 缩进块一结束，文件自动关闭，即使中间报错也会关\n\n**encoding**（编码，就是指规定文字用哪套规则变成硬盘上的字节）一定要写 'utf-8'，否则中文在 Windows 上容易变成乱码。"
        },
        {
          type: "code",
          lang: "python",
          title: "写一个文件，再读回来",
          code: "# 写：w 模式会清空原内容，utf-8 保证中文不乱码\nwith open('demo.txt', 'w', encoding='utf-8') as f:\n    f.write('第一行：机器学习\\n')      # \\n 是换行符，写进去才是真的换行\n    f.write('第二行：梯度下降\\n')\n\n# 追加：a 模式在文件末尾接着写，不会清空\nwith open('demo.txt', 'a', encoding='utf-8') as f:\n    f.write('第三行：反向传播\\n')\n\n# 读：r 模式，读回来的整体是一个字符串\nwith open('demo.txt', 'r', encoding='utf-8') as f:\n    text = f.read()\nprint(text)                       # 显示三行内容\nprint('总字符数', len(text))       # 显示总字符数 42\n\n# 按行读：readlines 返回一个列表，每一项是一行（末尾带换行符）\nwith open('demo.txt', 'r', encoding='utf-8') as f:\n    lines = f.readlines()\nprint('行数', len(lines))          # 显示行数 3\nfor i, line in enumerate(lines):\n    print(i + 1, line.strip())     # strip 去掉行尾多余的换行符和空格\n\n# 先判断文件在不在，避免读一个不存在的文件时报错\nimport os\nprint('文件存在吗', os.path.exists('demo.txt'))   # 显示 文件存在吗 True"
        },
        {
          type: "concept",
          title: "JSON：把列表和字典变成一段文字",
          md: "**JSON**（读作「杰森」，就是指一种通用的文字格式：它能把列表、字典这类结构原样写成一串文字，也能从这串文字还原回结构）是程序之间交换数据时最常见的格式。\n\n它和 Python 的对应关系几乎一一对应：\n\n- Python 的字典对应 JSON 的对象（花括号里写「键: 值」）\n- Python 的列表对应 JSON 的数组（方括号里排一串值）\n- Python 的字符串、数字、真假值对应 JSON 的字符串、数字、true / false\n\n四个常用函数：json.dumps 把结构变成文字，json.loads 把文字还原成结构，json.dump 直接写进文件，json.load 直接从文件读。"
        },
        {
          type: "code",
          lang: "python",
          title: "JSON 的两次来回",
          code: "import json\n\ndata = {'name': '小明', 'age': 12, 'scores': [88, 92, 75]}   # 字典里套着列表\n\ntext = json.dumps(data, ensure_ascii=False)   # 结构 -> 文字\nprint(text)                                   # 显示 {\"name\": \"小明\", ...}\n\nback = json.loads(text)                       # 文字 -> 结构\nprint(back['scores'][1])                      # 先按键取列表，再按下标取，显示 92\nprint(type(back))                             # 显示 <class 'dict'>\n\n# 直接写进文件，indent=2 让文件里带缩进、更好读\nwith open('data.json', 'w', encoding='utf-8') as f:\n    json.dump(data, f, ensure_ascii=False, indent=2)\n\n# 直接从文件读回来\nwith open('data.json', 'r', encoding='utf-8') as f:\n    loaded = json.load(f)\nprint(loaded['name'], len(loaded['scores']))  # 显示 小明 3\n\n# 一个小练习：把分数从高到低排好，再存成新的 JSON\nranking = {'name': data['name'], 'sorted': sorted(data['scores'], reverse=True)}\nprint(json.dumps(ranking, ensure_ascii=False))  # 显示 {\"name\": \"小明\", \"sorted\": [92, 88, 75]}"
        },
        {
          type: "pitfall",
          title: "文件与 JSON 的五个坑",
          items: [
            "忘了 encoding='utf-8'：在 Windows 上写中文可能变成乱码，或者读的时候报 UnicodeDecodeError。",
            "用 'w' 模式想追加内容：'w' 会把原文件清空，要接着写末尾得用 'a'。",
            "把 write 当 print 用：f.write 不会自动换行，也不会自动加空格，要换行必须自己写进换行符。",
            "json.dumps 不写 ensure_ascii=False：中文会被写成类似 \\u5c0f\\u660e 的转义序列，人看着很痛苦（数据本身没错，只是不好读）。",
            "读一个不存在的文件：会报 FileNotFoundError，先用 os.path.exists 判断，或者用 try 把这段读操作包起来。"
          ]
        }
      ],
      quiz: [
        {
          id: "py-4-q1",
          type: "single",
          q: "用 with open('demo.txt', 'w') as f: 这种写法，主要好处是什么？",
          options: [
            "文件读写速度会变快",
            "离开 with 的缩进块时文件会被自动关闭，即使中间报错也会关",
            "文件会被自动加密",
            "可以省掉写文件名"
          ],
          answer: 1,
          why: "正确项是 B：with 把打开和关闭配成一对，缩进块一结束就关闭文件。A 是错觉，with 不改变读写速度。C 与关闭文件无关，加密要另写代码。D 说错了，文件名照样要写，with 管的是自动关闭。"
        },
        {
          id: "py-4-q2",
          type: "fill",
          q: "要把一个字典变成一段 JSON 文字，用 json 模块里的哪个函数？",
          answer: ["json.dumps", "dumps", "dumps()", "json.dumps()"],
          why: "用 json.dumps，末尾的 s 可以理解成 string（结果是一段文字）。对应的反向操作是 json.loads，把文字还原成字典。要直接写进文件则用 json.dump（不带 s）。"
        },
        {
          id: "py-4-q3",
          type: "single",
          q: "open 时写 encoding='utf-8' 的作用是什么？",
          options: [
            "把文件压缩变小",
            "规定文件里的文字用哪套编码保存，避免中文出现乱码",
            "给文件加密码",
            "把文件内容按字母排序"
          ],
          answer: 1,
          why: "正确项是 B：编码规定了文字与字节之间的换算规则，读写两端用同一套规则才不会乱码。A、C、D 都与编码无关，分别是压缩、加密、排序干的事。"
        }
      ],
      checklist: [
        "我能写一个文件再读回来，并说清 'w' 与 'a' 的区别",
        "我能把一个字典存成 JSON 文件，再读回来取出其中的一个字段",
        "我知道为什么读写中文文件要写 encoding='utf-8'"
      ]
    },

    /* ================================================== py-5 */
    {
      id: "py-5",
      title: "错误处理与调试",
      goal: "程序报错时能读懂错误信息、定位到行号，并用 try/except 让程序在意外情况下不至于直接崩掉。",
      est: 30,
      blocks: [
        {
          type: "concept",
          title: "报错信息是你的朋友，不是敌人",
          md: "Python 出错时会打印一段叫 **Traceback**（回溯信息，就是指从出错的那一行往上倒着列出调用链的报错记录）的内容。读它只需要看三处：\n\n1. 最后一行：错误的类型和原因，比如 ValueError: invalid literal for int() with base 10: 'abc'\n2. 倒数第二段的箭头行：出错的具体文件和行号\n3. 往上几段：是谁调用了谁，帮你找到源头\n\n常见错误类型：SyntaxError 是写法本身有问题（比如少了冒号）；NameError 是用了一个没定义过的名字；TypeError 是类型不匹配（文字加数字）；KeyError 是字典里没有这个键；IndexError 是下标越界；ValueError 是值本身不合法（把 'abc' 转成整数）。"
        },
        {
          type: "analogy",
          title: "try/except 像电路里的保险丝",
          md: "电流一旦异常，保险丝先熔断，整台机器不会烧掉。try/except 就是代码里的保险丝：把「可能出意外的动作」放进 try，把「出意外时怎么办」放进 except。\n\n它不是让你掩盖问题，而是让你决定「这种意外发生时，程序接下来该怎么走」——是给个默认值，是提示用户重输，还是记下日志。"
        },
        {
          type: "concept",
          title: "异常：运行途中撞上的意外",
          md: "**异常**（exception，就是指程序运行过程中撞上的意外情况，会把当前这一行打断并向上抛）是可以被接住的：\n\n- try: 里放可能抛异常的代码\n- except 后面写你要接住的异常类型，比如 except ValueError:\n- 加 as e 可以把异常对象接住，print 出来看它说了什么\n- 想无论成功失败都执行一段收尾代码，用 finally:\n\n只接你能处理的异常，并且写明类型。写成 except: 把所有异常一网打尽，会让真正的错误被悄悄吞掉，这是很危险的习惯。"
        },
        {
          type: "code",
          lang: "python",
          title: "把可能出错的地方包起来",
          code: "def to_int(text):\n    '''把文字转成整数；转不了就返回 None，而不是让程序崩掉。'''\n    try:\n        return int(text)          # 可能失败的一行放进 try\n    except ValueError:            # 只接住「值不合法」这一类异常\n        return None\n\nprint(to_int('42'))    # 显示 42\nprint(to_int('abc'))   # 显示 None\n\nnumbers = [1, 2, 3]\ntry:\n    print(numbers[10])            # 下标越界，会抛 IndexError\nexcept IndexError as e:\n    print('越界了：', e)           # 显示 越界了： list index out of range\nfinally:\n    print('这一段无论成功失败都会执行')\n\n# 把异常接住之后，可以给用户一个能看懂的说法\ndef read_number(prompt):\n    while True:                   # 一直问，直到得到合法输入为止\n        raw = input(prompt)\n        try:\n            return float(raw)\n        except ValueError:\n            print('这不是一个数字，请重新输入。')\n\ndef safe_divide(a, b):\n    '''除法；除以 0 时给出友好提示。'''\n    try:\n        return a / b\n    except ZeroDivisionError:\n        print('除数不能是 0')\n        return None\n\nprint(safe_divide(10, 2))   # 显示 5.0\nprint(safe_divide(10, 0))   # 显示 除数不能是 0 然后 None"
        },
        {
          type: "steps",
          title: "调试三招：从「不知道哪错了」到「知道哪错了」",
          items: [
            { t: "先读最后一行", d: "错误类型和原因几乎都在最后一行。看到 ValueError 就往「某个值不合法」的方向想，看到 KeyError 就去找那个键。" },
            { t: "在关键位置打印中间值", d: "在循环里 print(i, s, total)，看哪一轮开始不对。很多错误不是写错，而是某一轮的值和你以为的不一样。" },
            { t: "缩小范围", d: "把一半代码注释掉，看错误还在不在；还在这半，不在另一半。反复对半切，几次就能锁定到具体一行。" },
            { t: "把假设写成断言", d: "用 assert len(scores) > 0, '分数列表不能为空' 把「我以为一定是这样」的条件写成代码，不成立时立刻报出来。" }
          ]
        },
        {
          type: "pitfall",
          title: "错误处理的四个坑",
          items: [
            "用 except: 一把抓：真正的错误会被静默吞掉，程序带着错误的数据继续跑，后面更难查；要写明具体异常类型。",
            "在 try 里塞太多代码：一段几百行都在 try 里，出错时根本不知道是哪一行；try 里只放真正可能出意外的那几句。",
            "只捕获不处理：except 里写一个 pass 什么都不做，等于把问题藏起来；至少要打印或记录一条信息。",
            "把语法错误当异常处理：SyntaxError 是写代码时就错了，try/except 接不住，只能改代码。"
          ]
        }
      ],
      quiz: [
        {
          id: "py-5-q1",
          type: "single",
          q: "程序报错时打印的 Traceback，最后一行通常告诉你什么？",
          options: [
            "程序一共运行了多少秒",
            "错误的类型和具体原因",
            "文件保存在哪个目录",
            "程序里一共有几个变量"
          ],
          answer: 1,
          why: "正确项是 B：最后一行是错误类型加上具体原因，比如 ValueError: invalid literal for int()。A 是运行耗时，与报错无关。C 是路径信息，出现在上面几段的箭头行附近。D 与报错无关。"
        },
        {
          id: "py-5-q2",
          type: "single",
          q: "try/except 的作用是什么？",
          options: [
            "让程序运行得更快",
            "把可能出错的代码放在 try 里，出错时执行 except 中的处理，而不是让程序直接崩掉",
            "在运行前检查出所有语法错误",
            "自动把错误日志写到文件"
          ],
          answer: 1,
          why: "正确项是 B。A 是错觉，try/except 不提升速度，反而有极小开销。C 说错了，语法错误在运行前就被解释器发现，接不住；try/except 管的是运行途中抛出的异常。D 也不对，写日志要自己调用日志功能，不是 try/except 自动完成的。"
        },
        {
          id: "py-5-q3",
          type: "fill",
          q: "把文字 '42' 变成整数 42，用哪个 Python 内置函数？",
          answer: ["int", "int()", "int 函数"],
          why: "用 int('42')，得到整数 42。如果文字不是合法数字，比如 int('abc')，会抛出 ValueError；这正是本讲用 try/except 接住的那一类异常。想变成小数用 float。"
        }
      ],
      checklist: [
        "我能拿到一段故意写错的代码，从 Traceback 最后一行说出错在哪一类问题上",
        "我能写一个用 try/except 包住的转换函数，让它在非法输入时返回一个默认值",
        "我能说出为什么不该写不带类型的 except:"
      ]
    },

    /* ================================================== py-6 */
    {
      id: "py-6",
      title: "用标准库向本机大模型发一个请求",
      goal: "能用 urllib 与 json 向本机运行的模型服务发出 HTTP 请求，拿到回复并打印出来。",
      est: 45,
      blocks: [
        {
          type: "concept",
          title: "接口：程序之间怎么说话",
          md: "**接口**（API，就是指一套预先约定好的「怎么问、怎么答」的规矩，程序照着它发问就能拿到结果）是程序之间协作的入口。你用浏览器打开网页，本质上也是发了一次请求、收了一份回复。\n\n两个词必须分清：\n\n- **请求**（request，就是指你发出去的那条消息），包含地址、方法（常见的有 GET 取数据和 POST 提交数据）、头部（描述这次请求的元信息）和正文（要提交的内容）\n- **响应**（response，就是指对方回给你的那条消息），包含状态码（200 表示成功，404 表示没找到）和正文（结果本身）\n\n跑在本机的模型服务也一样，它只是监听了一个本地地址，等着你用 HTTP 去问它。"
        },
        {
          type: "concept",
          title: "本机模型服务：地址和两个接口",
          md: "Ollama 是一个能在自己电脑上跑大模型的工具，装好并启动后，它会在本机开一个服务，默认地址是 http://127.0.0.1:11434。这里的 127.0.0.1 表示「这台电脑自己」，11434 是端口号（端口，就是指同一台机器上区分不同服务的编号）。\n\n两个最常用的接口：\n\n- POST http://127.0.0.1:11434/api/generate：给一个提示词，拿一次回复；参数里写 stream: False 表示等全部生成完再一次性返回\n- GET http://127.0.0.1:11434/api/tags：列出本机已经拉下来的模型\n\n用浏览器直接访问第二个地址也能看到结果，因为它是一个 GET 请求。看到一串模型名单，就说明服务已经跑起来了。"
        },
        {
          type: "code",
          lang: "python",
          title: "先看看本机有哪些模型（GET 请求）",
          code: "import json\nimport urllib.request\n\nURL = 'http://127.0.0.1:11434/api/tags'   # 本机服务的地址\n\ntry:\n    with urllib.request.urlopen(URL, timeout=5) as resp:\n        data = json.loads(resp.read().decode('utf-8'))   # 读字节 -> 解开码 -> 变成字典\n    names = [m.get('name') for m in data.get('models', [])]\n    print('本机已有的模型：')\n    for n in names:\n        print(' -', n)\n    if not names:\n        print('（一个都没有，可以先在命令行执行 ollama pull qwen2.5:3b）')\nexcept Exception as e:\n    print('连不上本机模型服务：', e)\n    print('请先确认 Ollama 已经启动（在命令行执行 ollama serve，或从开始菜单打开它）。')"
        },
        {
          type: "code",
          lang: "python",
          title: "正式提问（POST 请求）",
          code: "import json\nimport urllib.request\n\nURL = 'http://127.0.0.1:11434/api/generate'\npayload = {\n    'model': 'qwen2.5:3b',        # 换成本机真实存在的模型名\n    'prompt': '用一句话解释什么是变量',\n    'stream': False               # 一次性把完整回复返回，便于直接取字段\n}\n\nbody = json.dumps(payload).encode('utf-8')   # 文字 -> 字节，网络只能传字节\nreq = urllib.request.Request(\n    URL,\n    data=body,                                 # 有 data 就是 POST 请求\n    headers={'Content-Type': 'application/json'}   # 告诉对方正文是 JSON 格式\n)\n\ntry:\n    with urllib.request.urlopen(req, timeout=120) as resp:\n        result = json.loads(resp.read().decode('utf-8'))\n    print(result['response'])                  # 模型回复就在 response 字段里\nexcept Exception as e:\n    print('请求失败：', e)\n    print('排查顺序：服务是否启动 -> 模型名是否写对 -> 端口是否被别的程序占用。')"
        },
        {
          type: "concept",
          title: "为什么先讲「一次性返回」而不是流式",
          md: "模型是一个字一个字生成的。**流式返回**（streaming，就是指服务边生成边把片段推给你，你能看到字一个个蹦出来）体验更好，但每次收到的是一小段不完整的 JSON，解析起来要多写几层判断。\n\n本讲先用 stream: False 拿到完整结果，把「发请求、解 JSON、取字段」这条主链走通。等你把这条链跑顺了，再去碰流式，就不会两件事同时卡住。\n\n另外要养成一个习惯：凡是网络请求都写 timeout。网络可能一直不回应，没有超时的程序会永远卡在那里。"
        },
        {
          type: "lab",
          title: "上机任务：让本机模型回答你的问题",
          steps: [
            "确认 Ollama 已经启动：在浏览器访问 http://127.0.0.1:11434/api/tags，能看到模型名单就说明服务在跑。",
            "把本讲第二段代码存成 ask.py，把 model 换成名单里真实存在的模型名，然后运行 python ask.py。",
            "把 prompt 换成你自己的问题再跑一次，观察回复内容的变化。",
            "加一层循环：让程序连续问你三次「请输入问题」，每次都发一次请求并打印回复，输入空行时结束。",
            "把三次问答整理成一个列表，用 json.dump 写入 ask-log.json，再用 json.load 读回来打印，确认文件内容可读。"
          ],
          note: "验收标准：ask.py 能跑通并打印出模型回复；ask-log.json 里能看到三次问答的结构化记录（含问题、回复两个字段）；整个过程只用 Python 标准库，没有安装 requests 等第三方包。"
        },
        {
          type: "pitfall",
          title: "网络请求的五个坑",
          items: [
            "服务没启动：报 URLError 或连接被拒绝，先去浏览器访问 /api/tags 确认服务活着。",
            "模型名写错：服务会返回错误信息，通常是 model not found；用 /api/tags 里的名字精确复制。",
            "不写 timeout：网络卡住时程序会一直等；本讲两段代码都写了 timeout，抄的时候不要删。",
            "把 bytes 当 str 用：resp.read() 出来的是字节，必须 .decode('utf-8') 才是文字，反过来发出去前要 .encode('utf-8')。",
            "第一次请求特别慢：模型要先加载进显存（显存就是指显卡自带的那块内存，模型的参数要先放进去才能开始算），等十几秒甚至更久都正常，别急着以为程序坏了。"
          ]
        }
      ],
      quiz: [
        {
          id: "py-6-q1",
          type: "single",
          q: "本机 Ollama 服务默认监听的地址是哪个？",
          options: ["127.0.0.1:11434", "127.0.0.1:8127", "0.0.0.0:80", "localhost:3000"],
          answer: 0,
          why: "正确项是 A：Ollama 默认在本机 11434 端口提供服务。B 的 8127 是本学习站的本地预览端口，与模型服务无关。C 的 80 是网页服务的常用端口。D 的 3000 是很多开发脚手架的习惯端口，都不是 Ollama 的默认值。"
        },
        {
          id: "py-6-q2",
          type: "single",
          q: "发请求前要把 JSON 文字 encode('utf-8')，为什么？",
          options: [
            "为了压缩体积",
            "因为网络只能传字节，必须把文字变成字节",
            "为了给内容加密",
            "为了让服务端能按字母排序"
          ],
          answer: 1,
          why: "正确项是 B：HTTP 传输的是字节流，encode 把文字按 utf-8 规则变成字节；收到响应后要用 decode('utf-8') 变回文字。A、C、D 都与编码无关，压缩、加密、排序都是另外的机制。"
        },
        {
          id: "py-6-q3",
          type: "multi",
          q: "下面哪些是 Python 自带的标准库模块，不需要额外安装？（多选）",
          options: ["json", "urllib.request", "os", "requests"],
          answer: [0, 1, 2],
          why: "A、B、C 都是随 Python 一起装好的标准库：json 负责结构化文字，urllib.request 负责发网络请求，os 负责路径与文件判断。D 的 requests 是第三方包，必须先 pip install requests 才能 import；本讲正是用它来对照说明「标准库也能发请求」。"
        }
      ],
      checklist: [
        "我能用浏览器访问 /api/tags 确认本机模型服务是否在运行，并说出里面有哪些模型",
        "我能独立跑通那段 POST 请求代码，并把 prompt 换成自己的问题得到回复",
        "我能说清 encode 与 decode 各自在哪一步用、为什么要用"
      ]
    }
  ]
});
