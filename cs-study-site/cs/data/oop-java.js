window.COURSE_PACKS.push({
  id: "oop-java",
  title: "面向对象程序设计（Java）",
  icon: "☕",
  term: "大一下",
  advanced: {texts:["《Effective Java》第 3 版（精读第 2/3/4/8/10 章）","《Head First 设计模式》或《设计模式：可复用面向对象软件的基础》"],labs:["用 Java 实现并测试一个泛型容器库（List/Map 的简化版）","用 JUnit 给每个类写单元测试，覆盖率 > 80%"],project:"写一个多线程下载器或聊天服务器，要求：线程池、异常处理、接口抽象可替换实现",criteria:"能说清重载/重写/多态/虚方法表在字节码层面如何实现；代码提交前自己 review 过一遍"},
  need: "建议先学完「程序设计基础」的变量、分支、循环、函数（第 1~4 讲）。不需要任何 Java 经验。",
  hours: 64,
  blurb: "把「一堆数据和函数靠命名约定配合」的程序重构成「对象自己守自己的状态」：从类与对象的内存布局、虚方法表与动态绑定，到接口、泛型、异常、集合、并发与 SOLID 设计，每一讲都回答同一个问题——这套机制解决了什么痛点、代价是什么、什么时候不该用。",
  tags: ["核心", "程序设计", "Java", "期末重点"],
  lessons: [
    {
      id: "oop-class-object",
      title: "第 1 讲 类与对象：把数据和操作绑在一起",
      goal: "你能写出一个真正守住不变式的类（private 字段 + 校验构造器 + 行为方法），并在纸上画出 new 一个对象时栈、堆、方法区里各有什么，说清 this、static、包与访问修饰符分别解决什么问题。",
      est: 50,
      blocks: [
        {
          type: "concept",
          title: "先看没有对象的世界：数据与操作分家会怎样",
          md: "假设要管理一批银行账户。C 风格的写法是「结构体 + 一组自由函数」：\n\n- struct Account { char owner[32]; long balance; };\n- void account_deposit(struct Account* a, long amount) { a->balance += amount; }\n\n能跑，但三个问题迟早爆发：\n\n1. 谁都能改：balance 是公开字段，程序里任何一行都能写 a->balance = -100，不变式（余额不能为负）没有任何地方负责。\n2. 加一个字段要改所有函数：新增 currency 字段后，每个碰过 Account 的函数都得重新检查，编译器帮不了你。\n3. 只靠命名约定：account_deposit、account_withdraw、account_print 全靠人自觉遵守前缀，语言层面没有「这些函数属于 Account」这个概念，也就没法限制别人写 account_steal。\n\n面向对象（object-oriented）的回答是：把「状态」和「唯一被允许改变状态的那些操作」放进同一个单元——对象（object），由类（class）描述这个单元的模板。于是不变式有了唯一的守卫（方法），改动有了明确的边界（类），复用有了单位（继承：让新类自动获得已有类的字段与方法；组合：把别的对象当自己的字段持有；两者都在第 2 讲展开）。\n\n代价同样要说清：多了一层间接（调用要走方法表），程序里会多出很多小类，设计不好会得到一堆只有 getter/setter 的贫血对象。面向对象不免费，它换来的是「修改的局部性」——改一个需求时，你只需要碰一个类，而不是全局搜索。\n\n先记住这组术语（后面每讲都会用到）：对象（object）／实例（instance，同一个东西的两个叫法）；字段（field，成员变量，就是对象里存的那份数据，例如 balance）；方法（method，对象能做的操作，也就是前面说的「唯一被允许改变状态的那些操作」）；构造器（constructor，创建对象时把字段填成合法状态的那段代码，new 一个对象时调用的就是它）；封装（encapsulation，把字段藏进类里、只允许通过方法修改）；不变式（invariant，对象必须始终成立的条件，例如余额不为负）。"
        },
        {
          type: "concept",
          title: "类怎么写：字段、方法、构造器，以及 new 的时候内存里发生了什么",
          md: "一个类的骨架只有三样东西：字段（状态）、方法（行为）、构造器（怎么把对象造出来）。骨架长这样：\n\nclass Account {\n    private long balance;            // private 是访问修饰符：只有本类能访问，别的类看不见这个字段\n    Account(long init) { ... }\n    void deposit(long amount) { ... }\n}\n\n关键在于：new 一个对象时，JVM 到底做了什么？按时间顺序分五步，前两步发生在堆上，第三步之后才轮到构造器——顺序弄反就会得出「构造器里字段还是 0」这类错误结论。\n\n1. 类加载（第一次用到这个类时只做一次）：父类的静态字段（static 字段：不属于某一个对象，整个类共享同一份，例如后面用来计数的 Account.count）与静态初始化块 → 本类的静态字段与静态初始化块，各自按书写顺序执行。\n2. 在堆上分配内存，所有字段先被置为默认零值：数值 → 0，boolean → false，引用 → null。\n3. 执行父类的实例字段显式初始化与实例初始化块（按书写顺序），再执行父类构造器体。\n4. 回到本类：执行本类的实例字段显式初始化与实例初始化块（按书写顺序，所以「字段按你写的顺序生效」）。\n5. 执行本类构造器体；返回后把对象地址写进调用处的变量（栈上的引用）。\n\n内存三区域对照表（以 main 里执行 Account a = new Account(100L) 为例）：\n\n| 区域 | 谁拥有 | 这时里面有什么 |\n| 栈（stack，线程私有） | 每个线程一份 | main 栈帧的局部变量表里放引用 a，值是一个堆地址（例如 0x7f3a10）；基本类型局部变量直接放值 |\n| 堆（heap，所有线程共享） | JVM 统一分配，垃圾回收器（garbage collector）负责回收 | 对象本体：对象头（mark word + 指向类元数据的指针）+ 字段 balance，再加上对齐填充 |\n| 方法区／元空间（metaspace） | 每个类一份，所有对象共享 | 类的元数据、字段表与方法表；决定多态（同一条调用语句因为对象的实际类型不同而执行到不同实现；不熟的话先看第 2 讲）跳转的虚方法表（vtable，一张「调用哪个方法就跳到哪段代码」的地址表）就挂在这里 |\n\n表里说的线程（thread）指的是程序里一条独立的执行流：一个 Java 程序至少有 main 线程；不熟的话先看第 5 讲。\n\nthis 到底是什么：\n\n- this 是实例方法与构造器里的隐式参数，类型就是当前类，指向「这次调用所作用的对象」。所以 a.deposit(50) 里的 this 就是 a 指向的那个堆对象。\n- 写 this.balance 而不是 balance，目的是区分同名字段与参数（参数会遮蔽同名字段，这是最常见的新手 bug 来源）。\n- this(...) 出现在构造器第一行表示调用本类另一个构造器；super(...) 表示调用父类构造器。二者只能有一个，且必须在第一行，否则 javac 直接报错。\n- 静态方法里没有 this（静态方法属于类，不针对某个对象），因此静态方法不能访问实例字段——这是编译器强制的，不是风格问题。"
        },
        {
          type: "concept",
          title: "包与访问修饰符：把「边界」写进编译期，而不是写在文档里",
          md: "封装的真实含义不是「写个 getter」，而是「用编译器强制一条边界」。Java 用包（package）划分命名空间与可见范围，用四个访问级别控制成员可见性：\n\n| 修饰符 | 本类 | 同一个包 | 其它包的子类 | 其它包任意类 |\n| private | 可见 | 不可见 | 不可见 | 不可见 |\n| 默认（不写修饰符，包私有） | 可见 | 可见 | 不可见 | 不可见 |\n| protected | 可见 | 可见 | 可见（且只能通过继承访问） | 不可见 |\n| public | 可见 | 可见 | 可见 | 可见 |\n\n三条容易记错的规则：protected 对「同包」也是可见的，不只是对子类；「默认」不是关键字 default，而是什么都不写；顶层类只能用 public 或默认，想要「包外不可见」就别写 public。\n\npackage 与目录结构必须对应：声明 package edu.bank.core; 的源文件必须放在 edu/bank/core/ 目录下，否则运行时找不到类。import 只是省写全限定名，不影响可见性。\n\ngetter/setter 的取舍：很多教材教你「字段全 private，然后给每个字段配 getter 和 setter」——这只是把 public 字段换了个写法，不变式照样守不住，因为 setBalance(-100) 谁都能调。更好的做法是：\n\n- 暴露行为而不是数据：给 deposit(amount) 与 withdraw(amount)，而不是 setBalance(x)；\n- 如果确实需要 setter，就在 setter 里写校验（范围、格式、状态机约束），让非法值进不来；\n- 返回可变对象时要防御：getData() 返回内部数组或 List（列表：一种能按顺序装多个元素的集合；Java 里这类装对象的容器统称集合（Collection），第 4 讲详讲），外部改内容就等于绕过校验，应返回副本（防御性拷贝）或不可变视图（List.copyOf、Collections.unmodifiableList）——不可变指的是创建之后内容就不能再改（String 就是不可变的，List.copyOf 返回的列表也改不动）；\n- 真正的判断标准是：这个字段的变化是否需要与其它字段保持一致？需要就该由方法统一维护。"
        },
        {
          type: "code",
          lang: "java",
          title: "完整例子：一个守得住不变式的 Account",
          code: "// 保存为 AccountDemo.java（public 类名必须与文件名一致；实际项目中每个类各占一个文件）\n// 真机运行：javac -encoding UTF-8 AccountDemo.java    然后    java AccountDemo\n// 预期输出（4 行）：\n// Amy 余额 100\n// Amy 余额 150\n// 余额不足：现有 150，需要 999\n// 一共创建了 1 个账户对象\n\nclass Account {\n    private final String owner;      // private：只有本类能碰，外部改不了\n    private long balance;            // 单位：分；金额用 long/整数，避免 double 的浮点误差\n    private static int count = 0;    // static：属于类，所有对象共享同一份\n\n    Account(String owner) {          // 构造器重载 1：只给户主时余额默认 0\n        this(owner, 0L);             // this(...) 必须写在第一行：复用下面的构造器\n    }\n\n    Account(String owner, long balance) {   // 构造器重载 2\n        if (balance < 0) throw new IllegalArgumentException(\"初始余额不能为负\");\n        this.owner = owner;          // this.owner 是字段，owner 是参数\n        this.balance = balance;\n        count++;\n    }\n\n    void deposit(long amount) {      // 行为自己校验：非法参数根本进不来\n        if (amount <= 0) throw new IllegalArgumentException(\"存款必须为正\");\n        this.balance += amount;\n    }\n\n    boolean withdraw(long amount) {  // 失败是正常业务结果，用返回值而不是异常\n        if (amount <= 0 || amount > balance) return false;\n        this.balance -= amount;\n        return true;\n    }\n\n    long getBalance() { return balance; }   // 只读访问：故意不提供 setBalance\n    String getOwner() { return owner; }\n\n    static int count() { return count; }    // 静态方法：没有 this，不能碰 owner\n\n    void show() { System.out.println(owner + \" 余额 \" + balance); }\n}\n\npublic class AccountDemo {\n    public static void main(String[] args) {\n        Account a = new Account(\"Amy\", 100L);   // 栈上的引用 a 指向堆上的对象\n        a.show();                                // Amy 余额 100\n        a.deposit(50L);\n        a.show();                                // Amy 余额 150\n\n        if (!a.withdraw(999L)) {                 // 余额不足：返回 false，不改任何字段\n            System.out.println(\"余额不足：现有 \" + a.getBalance() + \"，需要 999\");\n        }\n        System.out.println(\"一共创建了 \" + Account.count() + \" 个账户对象\");\n        // 试着写 a.balance = -100; 会被 javac 拒绝：balance has private access in Account\n    }\n}"
        },
        {
          type: "code",
          lang: "python",
          title: "Python 对照：__init__、self 与类属性（class attribute）——类属性指的是写在类里、所有实例共享同一份的数据，相当于 Java 的 static 字段",
          code: "# 与上面 Java 版语义等价的 Python 版：python3 account.py\n# 预期输出（4 行）：\n# Amy 余额 100\n# Amy 余额 150\n# 取 999 成功吗: False\n# 一共创建了 1 个账户对象\n\nclass Account:\n    count = 0                       # 类属性：所有实例共享一份，相当于 Java 的 static 字段\n\n    def __init__(self, owner, balance=0):   # __init__ 相当于构造器，但此时对象已经存在\n        if balance < 0:\n            raise ValueError('初始余额不能为负')\n        self.owner = owner          # self 相当于 Java 的 this，但必须显式写进参数表\n        self.balance = balance      # 只有赋值给 self.balance 才会产生实例属性\n        Account.count += 1          # 改类属性必须写类名，写 self.count 会造出实例属性\n\n    def deposit(self, amount):\n        if amount <= 0:\n            raise ValueError('存款必须为正')\n        self.balance += amount\n\n    def withdraw(self, amount):\n        if amount <= 0 or amount > self.balance:\n            return False\n        self.balance -= amount\n        return True\n\n    def show(self):\n        print(self.owner, '余额', self.balance)\n\n    @staticmethod\n    def get_count():                # 静态方法：参数表里没有 self\n        return Account.count\n\n\na = Account('Amy', 100)\na.show()\na.deposit(50)\na.show()\nprint('取 999 成功吗:', a.withdraw(999))          # False\nprint('一共创建了', Account.get_count(), '个账户对象')   # 1\n\n# 与 Java 的两点差别：\n# 1. Python 的「私有」只是约定：_balance 表示别碰，__balance 会被改名成 _Account__balance，\n#    没有编译器强制；Java 的 private 由编译器把关，跨类访问直接编译失败。\n# 2. Python 的 self 必须自己写在参数表里；Java 的 this 是隐式参数，省着写也行。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "单步执行器：new 一个对象，盯着栈、堆、this 的变化",
          config: {
            state: { "执行到": "main 第 1 行，还没开始", "栈 main 帧": "a = 未赋值", "堆对象": "无", "this 指向": "无", "结果": "—" },
            steps: [
              {
                desc: "第 1 步：main 开始执行，栈里只有 main 的栈帧，还没有任何对象",
                state: { "执行到": "Account a = new Account(\"Amy\", 100L);（还没执行）", "栈 main 帧": "a = 未赋值", "堆对象": "无", "this 指向": "无", "结果": "—" },
                note: "引用（reference）变量本身住在栈帧的局部变量表里，它只是一个地址；此刻地址还是空的，堆上什么都没有。"
              },
              {
                desc: "第 2 步：new 先在堆上分配内存，字段被全部置为默认零值",
                state: { "执行到": "new Account(100L)：分配内存完成", "栈 main 帧": "a = 未赋值", "堆对象": "Account@1a2b：owner = null，balance = 0", "this 指向": "还没确定（构造器尚未进入）", "结果": "—" },
                note: "顺序很关键：分配内存与零值填充发生在构造器之前，所以「字段一定有默认值」是 JVM 的保证；而局部变量没有默认值，不初始化就编译不过。"
              },
              {
                desc: "第 3 步：进入构造器，压入构造器栈帧，this 被确定下来",
                state: { "执行到": "Account(String owner, long balance) 第一行", "栈 main 帧": "a = 未赋值", "堆对象": "Account@1a2b：owner = null，balance = 0", "this 指向": "Account@1a2b（就是刚分配的那个堆对象）", "结果": "构造器帧里有两个参数：owner = Amy，balance = 100" },
                note: "this 不是新对象，它就是「这次调用作用在哪个对象上」的那个引用。构造器没有返回值，但它负责把 this 指向的对象填成合法状态。"
              },
              {
                desc: "第 4 步：执行 this.owner = owner",
                state: { "执行到": "this.owner = owner;", "栈 main 帧": "a = 未赋值", "堆对象": "Account@1a2b：owner = Amy，balance = 0", "this 指向": "Account@1a2b", "结果": "参数 owner 的值写进了对象的字段" },
                note: "等号左边是 this.owner（堆上字段），右边是局部参数 owner。不写 this 时，右边的参数会遮蔽同名字段，this.balance = balance 就会变成自己赋给自己。"
              },
              {
                desc: "第 5 步：执行 this.balance = balance，count++",
                state: { "执行到": "构造器体最后一行", "栈 main 帧": "a = 未赋值", "堆对象": "Account@1a2b：owner = Amy，balance = 100", "this 指向": "Account@1a2b", "结果": "静态字段 Account.count 从 0 变成 1" },
                note: "count 是静态字段，住在方法区里的一份共享空间，不属于这个对象；这就是为什么它能统计「一共创建了几个对象」。"
              },
              {
                desc: "第 6 步：构造器返回，栈帧弹出，对象地址被写回 main 的引用 a",
                state: { "执行到": "构造器返回，回到 main", "栈 main 帧": "a = 0x1a2b（一个堆地址）", "堆对象": "Account@1a2b：owner = Amy，balance = 100", "this 指向": "随构造器栈帧一起销毁", "结果": "a 现在指向一个初始化完毕的对象" },
                note: "对象从「分配内存」那一刻就存在了，但只有构造器正常返回，调用者才拿到一个状态合法的对象。若构造器抛异常（exception：程序运行出错时抛出、能被上层捕获处理的对象，不熟的话先看第 4 讲），这个半成品对象不会被赋给 a。"
              },
              {
                desc: "第 7 步：调用 a.deposit(50L)，压入 deposit 栈帧",
                state: { "执行到": "void deposit(long amount) 第一行", "栈 main 帧": "a = 0x1a2b；deposit 帧：amount = 50", "堆对象": "Account@1a2b：owner = Amy，balance = 100", "this 指向": "0x1a2b（这次是实例方法里的 this，指向同一个对象）", "结果": "—" },
                note: "每调用一次方法就压入一个新栈帧（stack frame），里面放参数、局部变量和返回地址；栈帧随方法返回自动弹出，这也是递归太深会 StackOverflowError 的原因。"
              },
              {
                desc: "第 8 步：执行 this.balance += amount",
                state: { "执行到": "this.balance += amount;", "栈 main 帧": "a = 0x1a2b；deposit 帧：amount = 50", "堆对象": "Account@1a2b：owner = Amy，balance = 150", "this 指向": "0x1a2b", "结果": "balance：100 → 150" },
                note: "方法改的是堆上的对象字段，不是栈上的副本。所以方法返回后，调用者通过 a 看到的余额确实变了——这就是「对象是共享的可变状态」。"
              },
              {
                desc: "第 9 步：deposit 返回并弹栈，main 读到新余额",
                state: { "执行到": "a.getBalance()", "栈 main 帧": "a = 0x1a2b（deposit 帧已弹出）", "堆对象": "Account@1a2b：owner = Amy，balance = 150", "this 指向": "无（已随栈帧销毁）", "结果": "返回 150" },
                note: "对象会一直留在堆上，直到没有任何引用指向它（变成不可达对象），才可能被垃圾回收器回收。把 a 置为 null 只是断开引用，不等于立刻回收。"
              }
            ],
            tasks: [
              "把初始余额改成 1000，说出第 5、8、9 步的 state 里哪些字段会变、哪些不变。",
              "在纸上画出这 9 步对应的栈／堆／方法区三栏图，标出 a、this、count 各住在哪一栏。",
              "把 deposit 参数改成 -50，预测第 8 步会变成什么，再用真机 javac 验证（会抛 IllegalArgumentException，且 balance 仍是 150）。"
            ]
          }
        },
        {
          type: "calc",
          title: "手算演练：静态字段、实例字段与构造器的执行顺序",
          inputs: [
            { name: "静态字段声明", value: "static int total = log(\"静态字段 total = 10\", 10);" },
            { name: "实例字段 a", value: "int a = log(\"实例字段 a = 1\", 1);" },
            { name: "实例字段 b", value: "int b = log(\"实例字段 b = 2\", 2);" },
            { name: "构造器体", value: "Box() { log(\"构造器体，此时 a+b = \" + (a + b), 0); }" },
            { name: "辅助方法", value: "static int log(String s, int v) { System.out.println(s); return v; }" },
            { name: "main 里执行", value: "new Box(); new Box();" }
          ],
          outputs: [
            "第 1 行输出：静态字段 total = 10 —— 类初始化只在第一次使用这个类时发生一次，两次 new 加起来也只打印这一行",
            "第 2~4 行（第一次 new Box）：实例字段 a = 1 → 实例字段 b = 2 → 构造器体，此时 a+b = 3",
            "第 5~7 行（第二次 new Box）：又打印一遍 a = 1、b = 2、构造器体 a+b = 3，因为实例字段是每个对象一份",
            "总行数：$1 + 3 \\times 2 = 7$ 行（静态只打印一次，每次 new 打印三行）；静态行永远排在最前面",
            "构造器里 a+b = 3 说明：进入构造器体时，字段的显式初始化已经执行完毕，a=1、b=2；绝不是「构造器里字段还是 0」",
            "若在字段声明之前先写实例初始化块 { log(\"初始化块先跑\", 0); }，它会排在第 2 行之前——实例初始化块与字段初始化按书写顺序、自上而下执行"
          ],
          note: "追问两句：把静态字段写成三个，类初始化阶段就会连着打印 3 行，而且只在第一次 new 之前打印一次；如果去掉 log 前面的 static，静态字段初始化语句会立刻编译失败，报 non-static method log(String,int) cannot be referenced from a static context —— 因为类初始化时还没有任何对象，没有 this 可用。"
        },
        {
          type: "pitfall",
          title: "这一讲最容易踩的六个坑",
          items: [
            "用 == 比较两个对象比较的是引用（地址），不是内容。字符串字面量因为常量池偶尔「看起来对」：\"a\" == \"a\" 为 true，但 new String(\"a\") == \"a\" 为 false。要比内容用 equals，前提是那个类重写了 equals（重写 override：子类用自己的实现替换父类同名同参数的方法，第 2 讲详讲）。",
            "静态方法里写 this 或直接访问实例字段：编译错误 non-static variable xxx cannot be referenced from a static context。原因是静态方法属于类，调用它时不针对任何对象，根本没有 this。",
            "字段全 private 却给每个字段配 setter，等于什么都没封装：setBalance(-100) 依然能破坏不变式。要么暴露行为（deposit/withdraw），要么在 setter 里写校验。",
            "在构造器里把 this 交给别的对象（注册监听器、塞进集合、启动线程），会让别人拿到一个还没初始化完的对象；这叫 this 逸出（this escape）。",
            "getter 直接返回内部可变对象（数组、List、Date）等于开后门：外部改数组内容绕过所有校验。要返回副本或用 List.copyOf 包一层不可变视图。",
            "一个 .java 文件里最多只能有一个 public 类，且类名必须与文件名完全一致（含大小写）；忘了写访问修饰符就是「包私有」，跨包不可见，protected 对同包也可见——这两条是最常考也最常错的细节。"
          ]
        },
        {
          type: "lab",
          title: "上机：写一个守住不变式的类（约 40 分钟）",
          steps: [
            { t: "第 1 步 建工程", d: "新建目录 oop01，写一个 Account.java。记住 public 类名必须与文件名一致，一个文件最多一个 public 类。" },
            { t: "第 2 步 写类骨架", d: "字段全部 private：owner（String）、balance（long，单位分）、id（long，用 static 计数器自动分配）。写两个构造器（只给 owner 的、给 owner 与初始余额的），用 this(...) 复用。" },
            { t: "第 3 步 写行为方法", d: "deposit(long) 校验参数为正；withdraw(long) 余额不足时返回 false 而不是抛异常；transferTo(Account other, long amount) 先取后存，保证两个账户总额不变。" },
            { t: "第 4 步 写 main 验证", d: "建两个账户，做 5 次操作（存款、取款成功、取款失败、转账、非法参数），每步后打印余额；确认失败的操作一个字段都没改。" },
            { t: "第 5 步 故意破坏封装", d: "把 balance 改成 public，在 main 里写 a.balance = -100，观察程序照跑但不变式已破；改回 private 后抄下 javac 的报错（balance has private access in Account）——这就是封装在编译期生效的证据。" },
            { t: "第 6 步 打印对象", d: "直接 System.out.println(a)，输出形如 Account@1b6d3586，这是 Object.toString 的默认实现（类名 + @ + 十六进制 hashCode）；在 Account 里重写 toString 返回可读内容，再打印对比。" },
            { t: "第 7 步 提交检查", d: "编译零报错、五类操作输出符合预期、能在纸上画出引用与堆对象的指向图、能解释为什么故意不提供 setBalance。" }
          ],
          note: "常见卡点：报「类 X 是公共的，应在名为 X.java 的文件中声明」= 文件名与 public 类名不一致；报 cannot find symbol = 忘了把依赖类一起编译，或包名与目录结构不匹配。"
        }
      ],
      quiz: [
        {
          id: "oop-class-object-q1",
          type: "single",
          q: "关于 Java 中的 static 成员与实例成员，下列说法正确的是？",
          options: [
            "静态方法可以访问本类的实例字段，只要在方法里 new 一个对象并赋给 this 就行",
            "静态字段属于类，所有对象共享同一份；实例字段每个对象各有一份",
            "静态字段也随每个对象在堆上分配一份，只是习惯用「类名.字段名」来访问",
            "实例方法不能访问静态字段，只有静态方法才能访问静态字段"
          ],
          answer: 1,
          why: "B 对：static 字段在类初始化时分配一次，所有实例共享，所以能用它统计「一共 new 了几个对象」。A 错在静态方法里根本没有 this，也不允许给 this 赋值，必须显式写成局部变量才能用对象。C 把分配位置搞错了：静态字段不随对象分配。D 是反的：实例方法访问静态字段完全合法，直接写字段名或「类名.字段名」都行。"
        },
        {
          id: "oop-class-object-q2",
          type: "single",
          q: "下面的程序输出什么？\nclass Counter {\n  static int total = 0;\n  int n = 0;\n  Counter() { total++; n++; }\n}\npublic class Demo {\n  public static void main(String[] args) {\n    Counter c1 = new Counter();\n    Counter c2 = new Counter();\n    System.out.println(Counter.total + \" \" + c1.n + \" \" + c2.n);\n  }\n}",
          options: [
            "2 2 2",
            "2 1 1",
            "1 1 1",
            "2 1 2"
          ],
          answer: 1,
          why: "输出 2 1 1。total 是静态字段，两个对象共享一份，构造器执行两次就加到 2；n 是实例字段，c1 和 c2 各有一份，各自只被自己的构造器加一次，都是 1。选 2 2 2 说明把 n 也当成共享的；选 2 1 2 说明以为 c2 的构造会影响 c1 的字段；选 1 1 1 则把静态字段也当成每个对象一份。"
        },
        {
          id: "oop-class-object-q3",
          type: "fill",
          q: "在 Java 中，被 ____ 修饰的字段只能在本类内部访问，这是封装最基本的门槛（填一个关键字）。",
          answer: ["private", "Private", "PRIVATE"],
          why: "答案是 private：它对本类之外的一切（同包类、子类、其它包）都不可见，只有本类的方法能读写字段，这样不变式（例如余额不能为负）就有了唯一守卫。若用默认（包私有），同包任何类都能直接改字段；protected 更宽松（同包可见且子类可见）；public 等于把字段完全交出去。「默认」不是关键字 default，而是什么都不写，这也是常考陷阱。"
        },
        {
          id: "oop-class-object-q4",
          type: "order",
          q: "把「执行 Account a = new Account(\"Amy\", 100L) 并调用 a.deposit(50L)」的过程排成正确顺序",
          items: [
            "构造器返回，把堆上对象的地址写回栈帧里的引用变量 a",
            "在堆上为对象分配内存，所有字段先被置为默认零值（0/false/null）",
            "通过引用调用实例方法，方法栈帧里的 this 指向同一个堆对象，并修改它的字段",
            "执行本类的实例字段显式初始化与实例初始化块（按书写顺序，若有父类则父类的先执行）",
            "执行构造器体，用 this 把参数值写进对象字段"
          ],
          answer: [1, 3, 4, 0, 2],
          why: "正确顺序是：分配内存并置零值 → 实例字段显式初始化（父类优先，按书写顺序）→ 构造器体 → 返回后把地址写进引用 a → 最后才可能通过 a 调用方法。常见误解有两种：把构造器体排在字段初始化之前，会得出「构造器里字段还是 0」的错误结论；把「写回引用 a」排在分配内存之前，则混淆了「对象已经存在」与「调用者已经拿到引用」这两件事。"
        }
      ]
    },
    {
      id: "oop-inheritance-polymorphism",
      title: "第 2 讲 继承与多态：新增类型时不动老代码",
      goal: "你能说清编译期类型与运行期类型的区别，用虚方法表一步步推导出 a.speak() 最终执行哪个实现，正确使用重写、转型、instanceof、抽象类与 final，并解释 equals/hashCode/toString 的约定为什么必须成套遵守。",
      est: 55,
      blocks: [
        {
          type: "concept",
          title: "问题：没有多态时，加一种形状要改几个地方",
          md: "绘图程序要算面积。没有多态时最自然的写法是「类型标签 + switch」：\n\nenum ShapeType { CIRCLE, RECT }\n\ndouble area(Shape s) {\n    switch (s.type) {\n        case CIRCLE: return Math.PI * s.r * s.r;\n        case RECT:   return s.w * s.h;\n        default:     throw new IllegalStateException(\"未知形状\");\n    }\n}\n\n能跑。现在要加一种正六边形，数一数要改哪些地方：枚举加一项；area 的 switch 加一个分支；周长函数加一个分支；绘制函数加一个分支；导出 SVG、命中测试、面积排序的显示名……每个「按类型分支」的函数都要改。假设这样的函数有 k 个，新增一种类型就要改 k 处，而且分散在多个文件里——漏改一处，编译照样通过，运行期才走进 default 抛异常。错误被推迟到了运行时，这是最坏的失败方式。\n\n多态（polymorphism）的回答是：把「每种形状怎么算面积」写进各自的类，调用方只写 s.area()。\n\n| 维度 | 类型标签 + switch | 继承 + 重写 |\n| 新增一种类型 | 改 k 处（k = 按类型分支的函数个数） | 加 1 个类，改 0 处 |\n| 漏改的后果 | 编译通过，运行期抛异常或算错 | 抽象方法没实现，编译直接失败 |\n| 新增一种操作（例如导出 SVG） | 在每个类型的代码里各加一次 | 给抽象类加一个抽象方法，所有子类都要补实现 |\n| 适合的场景 | 类型少、操作经常增加 | 类型经常增加、操作集合稳定 |\n\n表里提到的两个词先解释：抽象类（abstract class）指的是不能直接 new、只能被继承的类；抽象方法是只有方法名和参数、没有方法体，必须由子类实现的方法——子类不实现它就编译失败，所以「漏改」会在编译期被抓出来。\n\n这张表最后一行才是重点：多态不是「免费的可扩展性」，它把扩展的代价从「新增类型」搬到了「新增操作」。所以真实项目里两种手法常常混用——这就是所谓「表达式问题（expression problem）」。本讲先学会多态这一半，第 6 讲的策略模式（把每种可替换的算法各自封成一个类，用哪个就在运行时挑哪个）会把它用到业务代码里。"
        },
        {
          type: "concept",
          title: "继承的语法与规则：extends、super、重写与重载、转型、final",
          md: "继承（inheritance）表示「是一种（is-a）」：Dog 是一种 Animal。Java 是单继承：一个类只能有一个直接父类（用 extends 指定），但可以实现多个接口（interface：一份只规定「必须提供哪些方法」的契约，一个类可以签多份；不熟的话先看第 3 讲）。不写 extends 时，类默认继承 Object。\n\nsuper 只有两种用法：super(...) 调用父类构造器，必须出现在子类构造器的第一行（不写时编译器自动插入 super()，父类没有无参构造器就编译失败）；super.method() 调用父类版本的方法实现（重写后想复用父类逻辑时必须写）。\n\n重写（override）的硬性规则：\n\n| 项目 | 规则 |\n| 方法签名 | 方法名与参数列表必须完全一致；返回类型可以协变（子类型），例如父类返回 Animal，子类可以返回 Dog |\n| 访问权限 | 不能比父类更严格：父类 protected，子类不能写成 private |\n| 异常 | 不能抛出比父类更宽的受检异常（受检异常指的是编译器强制你处理、必须 catch 或写 throws 声明的异常，不熟的话先看第 4 讲；子类可以抛更少、更窄，或不抛） |\n| 不能被重写 | private 方法（子类同名方法只是新方法）、static 方法（只能被隐藏）、final 方法 |\n| 建议 | 一律加 @Override：方法名写错时编译器立刻报错，相当于免费的安全网 |\n\n重载（overload）与重写（override）的区别——这是期末必考的一组概念：\n\n| 维度 | 重载 overload | 重写 override |\n| 发生位置 | 同一个类里（或子类新增不同参数的版本） | 子类覆盖父类的同名同参数方法 |\n| 判定依据 | 方法名相同、参数列表不同（类型、个数、顺序） | 方法名与参数列表都相同 |\n| 决定时机 | 编译期：按实参的静态类型选最匹配的版本 | 运行期：按对象的实际类型选实现 |\n| 返回类型 | 可以不同，且不参与重载判定 | 必须相同或是其子类型 |\n| 与多态的关系 | 无关，只是「同名方法多份」 | 多态的核心机制 |\n\n类型转换：向上转型（upcast，子类引用赋给父类变量）自动完成、永远安全，代价是「只能调用父类声明过的方法」；向下转型（downcast，父类引用赋给子类变量）必须显式强转，转错就抛 ClassCastException，所以先用 instanceof 判断：\n\nif (s instanceof Circle c) { double r = c.radius(); }   // Java 16+ 模式匹配，判断与取值一步到位\n\nfinal 的三种用法要分清：final 变量只能赋值一次（基本类型值不可改，引用类型只是引用不可改、对象内容照样能改）；final 方法不能被重写；final 类不能被继承（String、Integer 都是 final 类，所以谁也没法「扩展」它们）。"
        },
        {
          type: "concept",
          title: "动态绑定：javac 只管左边，JVM 才管右边",
          md: "这是全课最重要的一节。看两行代码：\n\nAnimal a = new Dog();\na.speak();\n\na 的编译期类型（静态类型，static type）是 Animal，运行期类型（实际类型，runtime type）是 Dog。两个类型分别管一件事：\n\n- javac 用编译期类型做检查：Animal 里必须有 speak()，否则编译失败；至于调用哪个实现，javac 不管。\n- JVM 用运行期类型做选择：执行时看 a 指向的那个对象到底是什么类，再决定跑谁的 speak。\n\n编译结果是 invokevirtual Animal.speak:()V —— 注意指令里记的是 Animal 的 speak，而不是 Dog 的。JVM 拿到这条指令后做三步：从对象头里找到实际类 Dog 的元数据 → 在该类的虚方法表（virtual method table，vtable）里按下标取出 speak 槽位的地址 → 间接跳转过去执行。\n\n虚方法表长什么样（槽位顺序继承自父类，重写只是替换槽位内容，新方法追加在后面）：\n\n| 槽位下标 | Object | Animal | Dog | Cat |\n| 0 | toString | toString | toString | toString |\n| 1 | equals | equals | equals | equals |\n| 2 | hashCode | hashCode | hashCode | hashCode |\n| 3 | （无） | speak -> Animal.speak | speak -> Dog.speak | speak -> Cat.speak |\n| 4 | （无） | （无） | fetch -> Dog.fetch | （无） |\n\n关键推论：speak 在第 3 槽这件事，编译器在编译期就知道并写进了指令，所以运行期不需要「按名字查找方法」，只要取表、按下标取地址、间接调用——多态的额外成本就是一次内存访问加一次间接跳转，热点代码还会被 JIT 内联掉。这也解释了另一条规则：Dog 独有的 fetch() 无法通过 Animal 类型的引用调用，因为编译期 Animal 的表里根本没有这个槽位。\n\n四类方法不走虚方法表：private 方法（编译期直接用 invokespecial 调，不参与重写）、static 方法（属于类，按编译期类型选择，叫隐藏 hiding 而不是重写）、构造器（不可能被继承）、final 方法（编译器知道没人能改，可以放心直接调用）。接口方法用 invokeinterface，查找比类方法略复杂（Java 8 起用 itable + 内联缓存优化），日常写代码可以认为成本接近。\n\n最后补上 Object 的三个约定（第 4 讲会用它解释 HashMap 的查找失败；HashMap 是一种按「键」直接查到「值」的集合，例如用学号查到学生，第 4 讲详讲）：toString 默认返回「类名@十六进制 hashCode」，重写后用于打印；equals 默认比较引用（等价于 ==），要按内容比较必须重写，且必须满足自反、对称、传递、一致性；hashCode 的契约是「equals 相等的两个对象，hashCode 必须相等」——所以两个方法要一起重写。"
        },
        {
          type: "code",
          lang: "java",
          title: "完整例子：从 switch 改造到多态（新增形状不动老代码）",
          code: "// 保存为 ShapeDemo.java，真机运行：javac -encoding UTF-8 ShapeDemo.java    然后    java ShapeDemo\n// 预期输出（5 行）：\n// 圆 面积 3.14\n// 矩形 面积 6.00\n// 正六边形 面积 10.39\n// 圆\n// 运行期类型：Circle\n//\n// 【改造前的样子】加一种形状要改 k 处，漏改一处编译还能过：\n// double area(Shape s) {\n//     switch (s.type) {\n//         case CIRCLE: return Math.PI * s.r * s.r;\n//         case RECT:   return s.w * s.h;\n//         default:     throw new IllegalStateException(\"未知形状\");\n//     }\n// }\n\nabstract class Shape {                        // 抽象类：不能 new，只能被继承\n    private final String name;                // final 字段：构造器里赋一次值就不能再改\n    protected Shape(String name) { this.name = name; }\n    abstract double area();                   // 抽象方法：没有方法体，子类必须实现\n    public String getName() { return name; }\n    public String describe() {                // 模板方法：内部调用虚方法 area()\n        return String.format(\"%s 面积 %.2f\", name, area());\n    }\n    @Override public String toString() { return name; }   // 重写 Object.toString：打印对象时给出可读内容\n}\n\nclass Circle extends Shape {\n    private final double r;\n    Circle(double r) { super(\"圆\"); this.r = r; }        // 先构造父类部分，再初始化自己\n    @Override double area() { return Math.PI * r * r; }\n}\n\nclass Rect extends Shape {\n    private final double w, h;\n    Rect(double w, double h) { super(\"矩形\"); this.w = w; this.h = h; }\n    @Override double area() { return w * h; }\n}\n\nclass Hexagon extends Shape {                 // 新增形状 = 只加这一个类\n    private final double a;\n    Hexagon(double a) { super(\"正六边形\"); this.a = a; }\n    @Override double area() { return 3 * Math.sqrt(3) / 2 * a * a; }\n}\n\npublic class ShapeDemo {\n    public static void main(String[] args) {\n        Shape[] shapes = { new Circle(1), new Rect(2, 3), new Hexagon(2) };\n        for (Shape s : shapes) {\n            System.out.println(s.describe());   // 同一条语句，三种行为：多态\n        }\n        Shape s = shapes[0];\n        System.out.println(s);                                      // 圆：调用的是重写后的 toString\n        System.out.println(\"运行期类型：\" + s.getClass().getSimpleName());   // Circle：编译期类型是 Shape\n        // s.fetch();  编译错误：Shape 里没有 fetch —— 编译期类型决定「能调用哪些方法」\n    }\n}\n\n// 想验证动态绑定，把 main 改成：\n//     Shape s = new Circle(1);\n//     System.out.println(s.getClass().getName());   // 运行期类型：Circle\n// 再加一个子类 Triangle，main 的循环体一个字都不用改，输出自动多一行。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "单步执行器：Animal a = new Dog(); a.speak() 到底调了谁",
          config: {
            state: { "源码": "Animal a = new Dog(); a.speak();", "引用（编译期类型）": "Animal", "实际对象（运行期类型）": "尚未创建", "方法表第 3 槽": "—", "最终调用的方法": "—", "输出": "—" },
            steps: [
              {
                desc: "第 1 步：javac 只看左边 —— 检查 Animal 类型里有没有 speak()",
                state: { "源码": "Animal a = new Dog(); a.speak();", "引用（编译期类型）": "Animal", "实际对象（运行期类型）": "还没 new，尚不存在", "方法表第 3 槽": "编译期只知道 Animal 的表：第 3 槽 = Animal.speak", "最终调用的方法": "未定", "输出": "—" },
                note: "如果 Animal 里没有 speak()，这行代码编译就失败——这就是编译期类型的唯一职责：保证「这个方法一定存在」。它不决定调用哪个实现。"
              },
              {
                desc: "第 2 步：编译结果是一条 invokevirtual 指令，目标写的是 Animal.speak",
                state: { "源码": "编译产物：invokevirtual Animal.speak:()Ljava/lang/String;", "引用（编译期类型）": "Animal", "实际对象（运行期类型）": "尚未创建", "方法表第 3 槽": "编译器已把「第 3 槽」这个下标焊死在指令里", "最终调用的方法": "指令里只有符号引用，没有地址", "输出": "—" },
                note: "注意：指令里写的是 Animal.speak 而不是 Dog.speak。编译期根本不知道运行时会 new 出哪个子类（可能来自另一个 jar 包）。"
              },
              {
                desc: "第 3 步：运行期执行 new Dog()，堆上创建对象，对象头记录实际类",
                state: { "源码": "new Dog()", "引用（编译期类型）": "Animal", "实际对象（运行期类型）": "Dog@7c30a502（对象头里存着指向 Dog 类元数据的指针）", "方法表第 3 槽": "Dog 的表：第 3 槽 = Dog.speak", "最终调用的方法": "未定", "输出": "—" },
                note: "对象头是运行期类型信息的唯一来源：JVM 拿到一个引用，先读对象头，才知道它到底是 Dog 还是 Cat。"
              },
              {
                desc: "第 4 步：把 Dog 对象的地址写进引用 a（a 的编译期类型仍是 Animal）",
                state: { "源码": "Animal a = new Dog();", "引用（编译期类型）": "Animal（不会因为赋了 Dog 就变）", "实际对象（运行期类型）": "Dog@7c30a502", "方法表第 3 槽": "Dog 的表：第 3 槽 = Dog.speak", "最终调用的方法": "未定", "输出": "—" },
                note: "向上转型是自动的、永远安全的：Dog 是一种 Animal。反过来（Animal 赋给 Dog 变量）必须强转并可能失败。"
              },
              {
                desc: "第 5 步：执行 a.speak()，JVM 先通过对象头找到实际类 Dog",
                state: { "源码": "a.speak()", "引用（编译期类型）": "Animal", "实际对象（运行期类型）": "Dog@7c30a502", "方法表第 3 槽": "正在读取 Dog 的虚方法表", "最终调用的方法": "查表中", "输出": "—" },
                note: "这一步就是动态绑定（dynamic binding）或延迟绑定：方法地址在运行期才确定，而不是编译期写死。"
              },
              {
                desc: "第 6 步：查 Dog 方法表第 3 槽，取出真实实现地址",
                state: { "源码": "a.speak()", "引用（编译期类型）": "Animal", "实际对象（运行期类型）": "Dog@7c30a502", "方法表第 3 槽": "Dog.speak（Dog 重写了 speak，槽位内容被替换）", "最终调用的方法": "Dog.speak", "输出": "—" },
                note: "若 Dog 没有重写 speak，第 3 槽里仍然是 Animal.speak 的地址——同一个槽位、同一套调用代码，行为却不同，这就是多态的全部秘密。"
              },
              {
                desc: "第 7 步：间接跳转执行 Dog.speak，返回字符串",
                state: { "源码": "a.speak()", "引用（编译期类型）": "Animal", "实际对象（运行期类型）": "Dog@7c30a502", "方法表第 3 槽": "Dog.speak", "最终调用的方法": "Dog.speak", "输出": "汪汪" },
                note: "整条链路的开销 = 读对象头 + 查表 + 间接跳转，比直接调用多两次内存访问；热点方法会被 JIT 内联，几乎免费。"
              },
              {
                desc: "第 8 步：把 new Dog() 换成 new Cat()，同一行源码、同一条指令，行为变了",
                state: { "源码": "Animal a = new Cat(); a.speak();（源码一个字没改）", "引用（编译期类型）": "Animal", "实际对象（运行期类型）": "Cat@1b6d3586", "方法表第 3 槽": "Cat 的表：第 3 槽 = Cat.speak", "最终调用的方法": "Cat.speak", "输出": "喵" },
                note: "调用点（invokevirtual 指令、槽位下标）完全没变，变的只是对象头指向的类。所以新增子类不需要重新编译调用方。"
              },
              {
                desc: "第 9 步：新增 Cow 子类，main 的循环体一行都不用改",
                state: { "源码": "for (Animal a : animals) a.speak();", "引用（编译期类型）": "Animal（循环变量的类型）", "实际对象（运行期类型）": "每轮不同：Dog / Cat / Cow", "方法表第 3 槽": "各自类表里都有自己的 speak", "最终调用的方法": "运行期逐个决定", "输出": "汪汪 / 喵 / 哞" },
                note: "这就是开闭原则（对扩展开放、对修改关闭）在语言层面的落地：扩展靠加类，修改点为零。反过来说，如果哪天要给 Animal 加一个新方法，所有子类都得改——多态的代价在「加操作」这一侧。"
              }
            ],
            tasks: [
              "在第 6 步里，如果 Dog 没有重写 speak，说出第 3 槽应该显示什么，最终输出会变成什么。",
              "用真机 javac 跑一遍：把 speak() 从 Animal 里删掉，观察 a.speak() 的编译错误（cannot find symbol），理解「编译期检查」管的是什么。",
              "给 Animal 加一个 fetch() 抽象方法，数一数要改几个文件——亲手体验一次多态在「加操作」方向的代价。"
            ]
          }
        },
        {
          type: "interactive",
          lab: "cpulab",
          title: "指令级：一次虚方法调用在机器层面长什么样",
          config: {
            regs: { "R1": 0, "R2": 0, "R3": 0, "R4": 0 },
            mem: { "0x1000": 2100, "0x1002": 3300, "0x1004": 4100 },
            program: [
              { asm: "LOAD R1, [0x1000] / 读对象头里的类指针 -> 指向 Dog 的类元数据", note: "对象头（object header）是运行期类型的唯一来源：JVM 拿到引用后先读它，才知道这个对象实际是什么类。地址 2100 就是 Dog 类元数据的首地址。" },
              { asm: "LOAD R2, [0x1002] / 取出该类的虚方法表基址", note: "每个类在方法区里有一张虚方法表（vtable）。槽位顺序继承自父类：重写只替换槽位内容，新增方法追加在后面，所以父类的槽位下标在子类里不会变。" },
              { asm: "LOAD R3, [0x1004] / 读第 3 槽 = speak 的实现地址", note: "编译器在编译期就把「speak 在第 3 槽」算好写进了 invokevirtual 指令，运行期只需要按下标取地址，不需要按方法名查找——这是多态便宜的原因。" },
              { asm: "CALL [R3] / 间接调用：跳到表里查到的地址，而不是指令里的常量", note: "CALL 的目标来自寄存器（表项），这叫间接调用（indirect call），对应字节码 invokevirtual；接口方法调用是 invokeinterface，多一步 itable 查找。" },
              { asm: "ADD R4, 1 / 计数：完成一次虚方法调用", note: "整条链路只比直接调用多了「读对象头 + 查表」两次内存访问和一次间接跳转；热点代码还会被 JIT 编译时内联（inline）掉，最终和直接调用一样快。" },
              { asm: "NOP / 空操作，便于观察寄存器状态", note: "真实机器上这里会是方法体本身：压栈、执行、返回。示例把它省略成一条空操作，好把注意力留在「怎么找到方法」上。" },
              { asm: "HLT / 停机", note: "对照记忆：private 方法与构造器是 invokespecial（编译期直接定位，不查表）；static 方法按编译期类型调用，叫隐藏而不是重写；final 方法编译器知道没人能改，也可以直接调用。" }
            ],
            legend: "内存 0x1000 存的是对象头里的类指针（2100 -> Dog 类元数据），0x1002 存的是虚方法表基址（3300），0x1004 存的是表里第 3 槽的内容（4100 -> Dog.speak 的机器码入口）。栈里会看到 CALL 压入的返回地址：这就是「间接调用之后还能回到调用点」的保证。"
          }
        },
        {
          type: "code",
          lang: "python",
          title: "Python 对照：没有编译期类型，动态绑定靠属性查找与 MRO",
          code: "# python3 poly.py\n# 预期输出：\n# 旺财 说 汪汪\n# 咪咪 说 喵\n# ['Dog', 'Animal', 'object']\n# 旺财 新学会 握手\n\nclass Animal:\n    def __init__(self, name):\n        self.name = name\n\n    def speak(self):\n        return '...'\n\n    def describe(self):          # 模板方法：self.speak() 在运行期才决定用谁的实现\n        return self.name + ' 说 ' + self.speak()\n\n\nclass Dog(Animal):\n    def speak(self):\n        return '汪汪'\n\n\nclass Cat(Animal):\n    def speak(self):\n        return '喵'\n\n\nfor a in (Dog('旺财'), Cat('咪咪')):\n    print(a.describe())          # 同一行代码，两种行为\n\nprint([c.__name__ for c in Dog.__mro__])   # 方法解析顺序：Dog -> Animal -> object\n\n# Python 里变量没有编译期类型约束：a 能调用哪些方法，要到运行期查属性才知道。\nd = Dog('旺财')\nd.handshake = lambda: '握手'          # 猴子补丁：只给这一个对象挂方法\nprint(d.name, '新学会', d.handshake())\n\n# 与 Java 的差别：Java 在编译期就锁定「能调用哪些方法」（Animal 的表里没有 fetch 就编译不过），\n# 拼错方法名会立刻报错；Python 只在运行期抛 AttributeError，灵活但更依赖测试和类型注解。"
        },
        {
          type: "calc",
          title: "手算演练：重载看编译期，重写看运行期",
          inputs: [
            { name: "父类 A", value: "String f(Object o) { return \"A.f(Object)\"; } 与 String f(String s) { return \"A.f(String)\"; }" },
            { name: "子类 B", value: "class B extends A { @Override String f(Object o) { return \"B.f(Object)\"; } }" },
            { name: "语句 1", value: "A a = new B(); Object o = \"hi\"; a.f(\"hi\")" },
            { name: "语句 2", value: "a.f(o)   // o 的编译期类型是 Object" },
            { name: "语句 3", value: "B b = new B(); b.f(\"hi\")" }
          ],
          outputs: [
            "语句 1 输出 A.f(String)：实参 \"hi\" 的静态类型是 String，javac 在重载里选最具体的 A.f(String)；B 没有重写 f(String)（它只重写了 f(Object)），所以运行期沿继承拿到 A 的实现",
            "语句 2 输出 B.f(Object)：实参 o 的静态类型是 Object，选中的签名是 f(Object)；这个方法被 B 重写了，运行期按实际类型 B 查表 -> B.f(Object)",
            "语句 3 输出 A.f(String)：b 的静态类型是 B，但 B 里没有 f(String)，继承自 A 的 f(String) 也没被重写，结果与语句 1 相同",
            "两条规则合起来记：重载在编译期按实参的静态类型选签名，重写在运行期按对象的实际类型选实现；两个机制正交，可以同时发生在一行代码里",
            "追问：若在 B 里再写 String f(String s)，那就是重写 A.f(String)（不是重载），语句 1 与语句 3 都会变成 B.f(String)",
            "再追问：若在 B 里写 String f(Integer i)，这是新增重载；调用 b.f(1) 时实参静态类型是 int，先装箱成 Integer（装箱就是把 int 这类基本类型的值自动包成 Integer 对象，反过来从对象里取出基本类型叫拆箱），选中 f(Integer) 而不是 f(Object)"
          ],
          note: "验证方法：在 A 与 B 的每个方法体第一行加 System.out.println(\"进入 xxx\")，用真机 javac 跑一遍，打印顺序就是上面推出来的选择顺序。"
        },
        {
          type: "pitfall",
          title: "这一讲最容易踩的六个坑",
          items: [
            "private、static、final 方法不参与动态绑定：private 方法编译期就定死（子类写同名方法只是新方法，不是重写）；static 方法是隐藏——Parent p = new Child(); p.kind() 调用的是 Parent 的版本；final 方法谁都改不了。",
            "在父类构造器里调用可被重写的方法：此时子类字段的显式初始化还没执行，方法里读到的是 0/null，看起来像「莫名其妙的数据丢失」。规则：构造器里不要调用可被子类重写的方法。",
            "重写 equals 时把参数写成自己的类型（equals(MyType) 而不是 equals(Object)）就变成了重载，HashMap 永远用不到它；加上 @Override 编译器会立刻告诉你写错了。",
            "向下转型前不判断 instanceof 就强转，运行期抛 ClassCastException。Java 16+ 可以直接 if (x instanceof Circle c) 判断与绑定一步完成。",
            "重写 equals 却不重写 hashCode：放进 HashMap/HashSet 后按内容去找会找不到（第 4 讲会单步演示这次失败）。equals 还必须满足自反、对称、传递、一致性，并且对 null 一律返回 false。",
            "把继承当成「复用代码」的快捷键：只为了省几行代码去 extends 一个语义不相干的类，会连它的字段和行为一起继承过来，耦合死得更紧。判断标准是 is-a：Dog 是一种 Animal 才继承，否则用组合（把对象作为字段持有）。"
          ]
        }
      ],
      quiz: [
        {
          id: "oop-inheritance-polymorphism-q1",
          type: "single",
          q: "关于 Java 中方法的重载（overload）与重写（override），下列说法正确的是？",
          options: [
            "重载由运行期对象的实际类型决定调用哪个版本，重写由编译期类型决定",
            "重载要求方法名相同、参数列表不同，由编译期按实参的静态类型决定；重写要求方法名与参数列表都相同，由运行期按实际类型决定",
            "重写可以改变参数列表，只要返回类型相同即可",
            "同一个类里两个方法如果只有返回类型不同，就构成重载，可以同时存在"
          ],
          answer: 1,
          why: "B 是标准定义：重载是编译期的静态选择（选最匹配的签名），重写是运行期的动态绑定（查虚方法表选实现）。A 把两者说反了。C 错在重写必须保持参数列表完全一致，改了参数列表就变成新增重载，编译期各调各的。D 错在返回类型不参与重载判定，只有返回类型不同的两个同名同参数方法会直接编译报错。"
        },
        {
          id: "oop-inheritance-polymorphism-q2",
          type: "single",
          q: "下面程序输出什么？\nclass Parent {\n  static String kind() { return \"Parent\"; }\n  String name() { return \"Parent\"; }\n}\nclass Child extends Parent {\n  static String kind() { return \"Child\"; }\n  @Override String name() { return \"Child\"; }\n}\npublic class Demo {\n  public static void main(String[] args) {\n    Parent p = new Child();\n    System.out.println(p.kind() + \" \" + p.name());\n  }\n}",
          options: [
            "Parent Child",
            "Child Child",
            "Parent Parent",
            "Child Parent"
          ],
          answer: 0,
          why: "输出 Parent Child。静态方法不参与动态绑定：p.kind() 在编译期就按引用类型 Parent 定位到 Parent.kind()，运行期 new 出来的 Child 完全不影响它，这叫方法隐藏（hiding）。实例方法 name() 是重写，走虚方法表，按实际类型 Child 调用。顺带一提，用引用调用静态方法虽然合法，但编译器会提示应该写成 Parent.kind()，因为这样写很容易让人误以为有多态效果。"
        },
        {
          id: "oop-inheritance-polymorphism-q3",
          type: "fill",
          q: "JVM 在运行期要执行一个被重写的方法时，会通过对象的实际类型去查该类的 ____ 表（英文缩写 vtable），按下标取出真实实现地址后再跳转。",
          answer: ["虚方法", "虚方法表", "vtable", "VTable", "虚函数"],
          why: "答案是虚方法表（virtual method table，简称 vtable）。每个类在方法区里有一张表，槽位顺序继承自父类：重写只是把对应槽位替换成子类实现的地址，新增方法追加在后面，所以槽位下标在编译期就能固定，运行期只需按下标取地址并间接跳转。若答「符号表」就混淆了编译期的东西：符号引用在类加载/首次执行时解析，而多态的选择发生在每次调用时的对象头上。"
        },
        {
          id: "oop-inheritance-polymorphism-q4",
          type: "order",
          q: "把一次虚方法调用（Animal a = new Dog(); a.speak();）从编译到执行的过程排成正确顺序",
          items: [
            "JVM 从对象头里读出实际类 Dog 的元数据",
            "javac 按引用的编译期类型 Animal 检查 speak() 存在，生成 invokevirtual 指令并记下 speak 的槽位下标",
            "按下标取出实际类虚方法表里该槽位的内容，得到真实实现入口",
            "把返回地址压栈，间接跳转到该地址执行方法体",
            "方法返回，靠栈里的返回地址回到调用点的下一条指令"
          ],
          answer: [1, 0, 2, 3, 4],
          why: "顺序是：编译期检查并定槽位 → 运行期读对象头拿实际类 → 查表取实现地址 → 压返回地址后间接跳转 → 返回。要点在于「槽位下标」是编译期固定的，而「槽位里装哪个实现」是运行期按对象实际类型取的；把查表放到编译期，或者把返回地址压栈放到跳转之后，都是对调用约定的误解。"
        }
      ]
    },
    {
      id: "oop-interface-generics",
      title: "第 3 讲 接口、内部类与泛型：契约与类型参数",
      goal: "你能用接口给互不相关的类定契约并解释默认方法为什么能救活老接口，用 lambda 与匿名内部类写回调，用泛型类/泛型方法/通配符写出免强转的安全代码，并说清类型擦除带来的四条限制。",
      est: 55,
      blocks: [
        {
          type: "concept",
          title: "问题：单继承不够用，没有泛型就只能靠强转",
          md: "先看一个真实需求：给「所有能保存的东西」写一段自动保存代码。File、Socket、编辑器缓冲区三者毫无血缘关系，可它们都需要 save()。用抽象类行不通——Java 是单继承，编辑器已经继承了 Window，不能再去继承 Saveable。\n\n接口（interface）的回答：把「能做什么」从「是什么」里拆出来。\n\ninterface Saveable { void save(String target); }\n\n三个类各自 implements Saveable，一段代码就能处理所有实现者：void backup(Saveable s) { s.save(\"bak\"); }。调用方只依赖接口，不依赖具体类——这就是「面向接口编程」，也是第 6 讲依赖倒置原则的语法基础。\n\n再看第二个需求：一个可以装任何东西的容器。Java 5 之前只有「原始类型」的集合：\n\nList list = new ArrayList();\nlist.add(\"hello\");\nlist.add(Integer.valueOf(42));      // 编译器不管：什么都能塞\nString s = (String) list.get(1);    // 取出时必须强转，这里运行期抛 ClassCastException\n\n两个毛病：类型错误只能在运行期暴露，而且每个取出点都要写强转，代码里全是噪音。\n\n泛型（generics）的回答：给容器加上类型参数 List<String>，编译器就知道 add 只能收 String、get 一定返回 String，强转由编译器自动插入（字节码里的 checkcast）。代价是类型参数在运行期被擦除（type erasure，指的是泛型的类型信息在编译完成后就被抹掉、运行时看不见），于是有了不能 new T()、不能 instanceof List<String>、不能重载 f(List<String>) 与 f(List<Integer>) 这几条限制——第 7 个方块会把擦除过程单步走一遍。\n\n一句话总结这一讲：接口解决「行为契约与多继承」，泛型解决「类型安全与免强转」，两者合起来才是 Java 的抽象工具箱；只有接口没有泛型，抽象就是空的，只有泛型没有接口，扩展就没有统一入口。"
        },
        {
          type: "concept",
          title: "接口：语法、默认方法、菱形冲突与「接口还是抽象类」",
          md: "接口里能写什么（都是 Java 8 之后的完整能力）：抽象方法（默认 public abstract）、常量（默认 public static final）、默认方法（default，带方法体）、静态方法（static，靠接口名调用）、私有方法（Java 9+，给默认方法复用）、嵌套类型。接口不能有实例字段，也不能被 new。\n\n一个类可以 implements 多个接口；如果同时又继承类又要实现接口，extends 必须写在 implements 前面：class C extends P implements A, B。\n\n默认方法（default method）解决的是「接口演化」问题：给一个已经被一百个类实现的接口加抽象方法，这一百个类全部编译失败。加了默认方法以后，老实现类什么都不用改——Java 8 正是靠这一招给 Collection 加上 stream()、forEach()、removeIf() 的。\n\n多接口带来的菱形问题（diamond problem）与三条裁决规则：\n\n1. 类优先：如果父类里已经有同名具体方法，就用父类的，接口的默认方法被忽略。\n2. 更具体的接口优先：如果 B 继承 A，那么 B 的默认实现胜过 A 的。\n3. 仍然冲突就编译报错：必须在实现类里显式重写，并用 A.super.hello() 指名调用某一个版本——编译器宁可报错也不替你猜。\n\n接口与抽象类怎么选（这是期末简答题的常客）：\n\n| 维度 | 接口 | 抽象类 |\n| 语义 | can-do，一种能力或角色 | is-a，一种分类，共享状态与实现 |\n| 多继承 | 一个类可实现多个接口 | 只能继承一个父类 |\n| 状态 | 不能有实例字段，只能有常量 | 可以有实例字段与构造器 |\n| 方法构成 | 抽象方法 + default/static/private 方法 | 抽象方法与具体方法自由混合 |\n| 演进风险 | 加默认方法不破坏老实现，但可能引入菱形冲突 | 加具体方法基本安全，改字段要小心 |\n| 典型例子 | Comparable、Runnable、Saveable | AbstractList、模板方法骨架 |\n\n一句话决策：多个不相关的类要共享一种能力，用接口；一族类要共享字段与部分实现，用抽象类；需要同时满足时，让抽象类去 implements 接口。"
        },
        {
          type: "concept",
          title: "内部类与 lambda：回调的本质是把「一段代码」装进对象",
          md: "先问一个问题：排序时要自定义比较规则，按钮点击时要执行一段代码，这段「代码」怎么当参数传给别的方法？Java 的方法不是一等公民，不能单独传递，于是只能把代码塞进一个对象里。这就是内部类与匿名内部类存在的原因——回调（callback）的载体。\n\n四种内部类对照：\n\n| 种类 | 写法 | 特点 | 典型用途 |\n| 成员内部类 | class Outer { class Inner {} } | 依赖外部实例，可直接访问外部所有成员（含 private）；创建要写 outer.new Inner() | 逻辑上从属于外部对象 |\n| 静态嵌套类 | class Outer { static class Inner {} } | 不持有外部实例引用，等价于普通类，只是名字归组 | Builder、Map.Entry |\n| 局部内部类 | 写在方法体里 | 作用域只有该方法，可访问 effectively final 的局部变量 | 一次性辅助类 |\n| 匿名内部类 | new Runnable() { public void run() {...} } | 没有名字，只创建一个实例 | 回调、事件监听 |\n\n匿名内部类为什么只能访问「事实上不变（effectively final）」的局部变量？因为局部变量住在栈上，方法一返回就没了；而内部类对象可能活得更久（被注册进监听器列表）。Java 的做法是把变量值拷贝进内部类对象，若还允许你改原变量，两边就不一致了——干脆规定不能改。\n\nlambda 表达式是函数式接口（functional interface：只有一个抽象方法的接口）的简写：\n\nRunnable r = () -> System.out.println(\"跑\");\nComparator<String> byLen = (x, y) -> x.length() - y.length();\n\n三点实操差异：匿名内部类会生成单独的 class 文件（Outer$1.class），lambda 用 invokedynamic 在运行期生成，通常不落额外文件；lambda 里的 this 指向外部类实例，匿名内部类里的 this 指向自己那个匿名对象；方法引用（System.out::println、String::length）只是 lambda 的进一步简写。\n\n把握一条判断标准：只要一段代码要「留给别人将来调用」，它就必须变成一个对象——接口是它的类型，lambda 是最短的写法。"
        },
        {
          type: "code",
          lang: "java",
          title: "完整例子：接口 + 默认方法 + 匿名内部类 + lambda",
          code: "// 保存为 CallbackDemo.java，真机运行：javac -encoding UTF-8 CallbackDemo.java    然后    java CallbackDemo\n// 预期输出（8 行，顺序如下）：\n// [文本] 加锁 + 校验编码\n// 文本已保存：报告.txt\n// [默认] 检查权限\n// 上传到服务器：数据.csv\n// [默认] 检查权限\n// 写入日志：审计.log\n// 打印到纸张：合同.pdf\n// [cy, bob, alice]\n\nimport java.util.Arrays;\nimport java.util.Comparator;\nimport java.util.List;\n\n@FunctionalInterface\ninterface Saveable {\n    void save(String target);                       // 唯一的抽象方法：决定它是函数式接口\n\n    default void beforeSave() {                     // 默认方法：实现类不写也能用\n        System.out.println(\"[默认] 检查权限\");\n    }\n\n    default void saveAll(String... targets) {       // 默认方法里可以调用抽象方法\n        for (String t : targets) {\n            beforeSave();                           // 运行期按实际类型决定调谁的 beforeSave\n            save(t);\n        }\n    }\n\n    static Saveable toPrinter(String prefix) {      // 接口静态方法：工具方法挂在接口上\n        return target -> System.out.println(prefix + target);   // lambda 就是 Saveable 的实现\n    }\n}\n\nclass TextFile implements Saveable {\n    @Override public void save(String target) {\n        System.out.println(\"文本已保存：\" + target);\n    }\n    @Override public void beforeSave() {            // 覆盖默认实现\n        System.out.println(\"[文本] 加锁 + 校验编码\");\n    }\n}\n\npublic class CallbackDemo {\n    public static void main(String[] args) {\n        Saveable text = new TextFile();\n        text.saveAll(\"报告.txt\");\n\n        // 匿名内部类：把一段代码装进对象（回调的经典写法）\n        Saveable net = new Saveable() {\n            @Override public void save(String target) {\n                System.out.println(\"上传到服务器：\" + target);\n            }\n        };\n        net.saveAll(\"数据.csv\");                     // 没重写 beforeSave，用默认的\n\n        // lambda：同一个函数式接口，短得多，语义完全等价\n        Saveable log = t -> System.out.println(\"写入日志：\" + t);\n        log.saveAll(\"审计.log\");\n\n        // 接口静态工厂 + 方法引用风格的 lambda\n        Saveable printer = Saveable.toPrinter(\"打印到纸张：\");\n        printer.save(\"合同.pdf\");                     // 直接调用 save，不经过 saveAll\n\n        // lambda 与匿名内部类一起用于排序：Comparator 也是函数式接口\n        List<String> names = Arrays.asList(\"bob\", \"alice\", \"cy\");\n        names.sort(Comparator.comparingInt(String::length));\n        System.out.println(names);                   // [cy, bob, alice]\n    }\n}"
        },
        {
          type: "code",
          lang: "java",
          title: "完整例子：泛型类、泛型方法、通配符与擦除证据",
          code: "// 保存为 GenericsDemo.java，真机运行：javac -encoding UTF-8 GenericsDemo.java    然后    java GenericsDemo\n// 预期输出（5 行）：\n// 盒子: hello\n// 最大值: 9\n// 求和: 6.0\n// 同一份字节码: true\n// 类名: java.util.ArrayList\n//\n// 看擦除证据（编译后执行）：\n//   javap -p -c Box            会看到 void set(java.lang.Object) 与 java.lang.Object get()\n//   javap -p -c StringBox      会看到两个 set：\n//       void set(java.lang.String);    <- 你自己写的\n//       void set(java.lang.Object);    <- 编译器生成的桥接方法（bridge），内部 checkcast 后转调 set(String)\n\nimport java.util.ArrayList;\nimport java.util.List;\n\nclass Box<T> {                                  // 泛型类：T 是类型参数\n    private T value;\n    void set(T value) { this.value = value; }\n    T get() { return value; }\n}\n\nclass StringBox extends Box<String> {           // 父类擦除后是 set(Object)，子类写的是 set(String)\n    @Override void set(String value) {\n        System.out.println(\"设置字符串：\" + value);\n        super.set(value);\n    }\n}\n\npublic class GenericsDemo {\n    static <T extends Comparable<T>> T max(List<T> list) {   // 泛型方法 + 类型参数上界\n        T best = list.get(0);\n        for (T t : list) {\n            if (t.compareTo(best) > 0) best = t;\n        }\n        return best;\n    }\n\n    static double sumOf(List<? extends Number> nums) {       // 上界通配符：可以读，不能写\n        double s = 0;\n        for (Number n : nums) s += n.doubleValue();\n        return s;\n    }\n\n    public static void main(String[] args) {\n        Box<String> box = new Box<>();\n        box.set(\"hello\");                                    // 编译期就检查：只能放 String\n        System.out.println(\"盒子: \" + box.get());\n\n        System.out.println(\"最大值: \" + max(List.of(3, 9, 2)));\n\n        List<Integer> ints = new ArrayList<>();\n        ints.add(1); ints.add(2); ints.add(3);\n        System.out.println(\"求和: \" + sumOf(ints));           // List<Integer> 可传给 List<? extends Number>\n\n        List<String> a1 = new ArrayList<>();\n        List<Integer> a2 = new ArrayList<>();\n        System.out.println(\"同一份字节码: \" + (a1.getClass() == a2.getClass()));\n        System.out.println(\"类名: \" + a1.getClass().getName());\n\n        // 下面注释掉的代码演示「擦除的代价」：强转能骗过编译器，错误被推迟到运行期\n        // List<String> bad = (List<String>) (List<?>) ints;\n        // String s = bad.get(0);            // 运行期抛 ClassCastException: Integer cannot be cast to String\n    }\n}"
        },
        {
          type: "code",
          lang: "python",
          title: "Python 对照：Protocol 契约、鸭子类型与泛型函数",
          code: "# python3 contract.py\n# 预期输出（4 行）：\n# 文本已保存：报告.txt\n# 上传到服务器：数据.csv\n# 最大值: 9\n# 求和: 6.0\n\nfrom typing import Protocol, Sequence, TypeVar\n\n\nclass Saveable(Protocol):                 # 结构化子类型：只要求「有 save 方法」，不要求显式继承\n    def save(self, target: str) -> None: ...\n\n\nclass TextFile:\n    def save(self, target):\n        print('文本已保存：' + target)\n\n\nclass Uploader:\n    def save(self, target):\n        print('上传到服务器：' + target)\n\n\ndef save_all(items: Sequence[Saveable], target: str) -> None:\n    for it in items:\n        it.save(target)\n\n\nsave_all([TextFile()], '报告.txt')\nsave_all([Uploader()], '数据.csv')\n\n\nclass Comparable(Protocol):               # 用 Protocol 表达「上界」：能比较大小\n    def __gt__(self, other): ...\n\n\nT = TypeVar('T', bound=Comparable)        # 类型变量：相当于 Java 的 <T extends Comparable<T>>\n\n\ndef maximum(items: Sequence[T]) -> T:     # 泛型函数：T 由调用处推断\n    best = items[0]\n    for x in items:\n        if x > best:\n            best = x\n    return best\n\n\nprint('最大值:', maximum([3, 9, 2]))\nprint('求和:', float(sum([1, 2, 3])))\n\n# 与 Java 的关键差别：\n# 1. Python 的约束由 mypy/pyright 这类静态检查器读注解来查，运行期注解只是元数据；\n#    Java 的泛型检查在 javac 里强制执行，运行期再把类型参数擦掉（字节码里没有 T）。\n# 2. Protocol 是「隐式实现」：类不需要写 implements；Java 的接口是「显式声明」的契约。\n#    隐式契约更灵活，但改名/漏写方法只能靠类型检查器或测试发现。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "单步执行器：泛型擦除与桥接方法是怎么产生的",
          config: {
            state: { "源码": "class Box<T> { void set(T v){...} T get(){...} }", "编译期类型检查": "尚未开始", "擦除后的签名": "未知", "字节码里的方法": "未知", "运行期": "尚未运行" },
            steps: [
              {
                desc: "第 1 步：源码里 T 是一个「类型参数」，写在类名后面",
                state: { "源码": "class Box<T> { private T v; void set(T v) {...} T get() {...} }", "编译期类型检查": "Box<String> box 表示这次使用中 T = String", "擦除后的签名": "还没有字节码", "字节码里的方法": "—", "运行期": "尚未运行" },
                note: "泛型是编译期的类型参数化：同一个类可以按不同 T 使用，编译器为每次使用做检查。"
              },
              {
                desc: "第 2 步：编译器做类型检查 —— box.set(\"hi\") 合法，box.set(42) 直接编译失败",
                state: { "源码": "Box<String> box = new StringBox(); box.set(\"hi\");", "编译期类型检查": "通过：T 被推断为 String，set 只能接受 String", "擦除后的签名": "还没到这一步", "字节码里的方法": "—", "运行期": "尚未运行" },
                note: "这就是泛型的全部价值：把类型错误从运行期提前到编译期。若写成 box.set(42)，javac 报「不兼容的类型: int 无法转换为 String」。"
              },
              {
                desc: "第 3 步：擦除 —— T 无上界，一律擦成 Object",
                state: { "源码": "class Box<T>", "编译期类型检查": "已通过", "擦除后的签名": "void set(Object v) 与 Object get()", "字节码里的方法": "Box 里只有 set(Object)、get()", "运行期": "尚未运行" },
                note: "规则：类型参数擦除到它的最左边界；无上界就是 Object，写 T extends Number 就擦成 Number。所以字节码里完全看不到 T 的痕迹。"
              },
              {
                desc: "第 4 步：子类 StringBox 写的是 set(String)，与擦除后的 set(Object) 签名不同",
                state: { "源码": "class StringBox extends Box<String> { @Override void set(String v) {...} }", "编译期类型检查": "已通过（@Override 也认可这是重写）", "擦除后的签名": "父类方法签名是 set(Object)，子类方法是 set(String)", "字节码里的方法": "编译器发现签名不匹配，需要补桥接方法", "运行期": "尚未运行" },
                note: "注意 @Override 检查的是「源码层面」的重写关系，此时它还成立；但擦除之后，两个方法的描述符并不相同。"
              },
              {
                desc: "第 5 步：编译器生成桥接方法（bridge method）",
                state: { "源码": "StringBox（源码没写这个方法）", "编译期类型检查": "已通过", "擦除后的签名": "set(Object)", "字节码里的方法": "set(String)（你写的）+ set(Object)（生成的桥接方法：checkcast String 后转调 set(String)）", "运行期": "尚未运行" },
                note: "桥接方法让「父类签名的调用」也能落到你的实现上。用 javap -p -c StringBox 能亲眼看到这两个方法。"
              },
              {
                desc: "第 6 步：调用点编译成按擦除后签名调用，并插入 checkcast",
                state: { "源码": "box.set(\"hi\"); String s = box.get();", "编译期类型检查": "已通过", "擦除后的签名": "set(Object)、get() 返回 Object", "字节码里的方法": "invokevirtual Box.set(Object)；get 之后紧跟 checkcast String", "运行期": "尚未运行" },
                note: "强转是编译器替你插进去的：所以写代码时看不到 (String)，但字节码里有 checkcast。"
              },
              {
                desc: "第 7 步：运行期一切正常 —— \"hi\" 本来就是 String",
                state: { "源码": "同上", "编译期类型检查": "已通过", "擦除后的签名": "set(Object)", "字节码里的方法": "checkcast String 成功", "运行期": "s = \"hi\"，输出正常" },
                note: "类型检查在编译期完成 + 运行期 checkcast 兜底，正常路径下泛型是零成本的（除了装箱）。"
              },
              {
                desc: "第 8 步：用原始类型绕过检查，错误被推迟到运行期",
                state: { "源码": "Box raw = box; raw.set(42);   // 只有 unchecked 警告", "编译期类型检查": "被绕过：原始类型关闭泛型检查", "擦除后的签名": "set(Object) 接受任何对象", "字节码里的方法": "checkcast String 失败", "运行期": "抛 ClassCastException: Integer cannot be cast to String" },
                note: "教训：泛型只保护「编译器看得到的代码」。反射、原始类型、强转都能绕过它，所以框架代码里常见 @SuppressWarnings(\"unchecked\") 与运行期检查并存。"
              },
              {
                desc: "第 9 步：记下擦除带来的四条限制",
                state: { "源码": "—", "编译期类型检查": "—", "擦除后的签名": "—", "字节码里的方法": "—", "运行期": "—" },
                note: "限制 1：不能 new T()、new T[]（运行期不知道 T 是什么）。限制 2：不能 instanceof Box<String>，只能 instanceof Box<?>。限制 3：不能重载 f(List<String>) 与 f(List<Integer>)，擦除后签名相同会报 name clash。限制 4：静态成员不能用类的类型参数（静态成员属于类，不属于某次具体使用）。"
              }
            ],
            tasks: [
              "在真机上执行 javap -p -c StringBox，把输出里两个 set 方法的描述符抄下来，解释哪一个是你写的、哪一个是编译器生成的。",
              "把 Box<T> 改成 Box<T extends Number>，说出第 3 步「擦除后的签名」会变成什么。",
              "试着写 void f(List<String> a) 与 void f(List<Integer> b) 两个重载，把 javac 的报错信息抄进笔记。"
            ]
          }
        },
        {
          type: "calc",
          title: "手算演练：擦除后的签名与桥接方法个数",
          inputs: [
            { name: "泛型类", value: "class Box<T> { private T v; void set(T v){...} T get(){...} }" },
            { name: "子类", value: "class StringBox extends Box<String> { @Override void set(String v){...} }（只重写 set）" },
            { name: "语句 1", value: "Box<String> box = new StringBox(); box.set(\"hi\");" },
            { name: "语句 2", value: "String s = box.get();" },
            { name: "语句 3", value: "Box raw = box; raw.set(42); 然后用 box.get() 取出来当 String 用" }
          ],
          outputs: [
            "Box 擦除后只有两个方法：void set(Object) 与 Object get()；T 没有上界，所以擦除到 Object，字节码里看不到 T",
            "StringBox 的字节码里有 2 个 set：set(String)（源码里写的，1 个）与 set(Object)（编译器生成的桥接方法，1 个），所以桥接方法个数 = 1",
            "语句 1 编译成对 set(Object) 的调用，实参 \"hi\" 在编译期已经通过检查，不需要额外强转；桥接方法内部再做 checkcast String 并转调 set(String)",
            "语句 2 在调用点插入 checkcast String，所以对调用者来说返回类型就是 String；正常路径下这一步永远不会失败",
            "语句 3 只有 unchecked 警告，编译能过；堆里被塞进一个 Integer，之后任何按 String 取出的地方都会抛 ClassCastException —— 错误从编译期被推迟到了运行期",
            "推广：桥接方法的个数 = 子类中「源码层面重写、但擦除后描述符与父类不同」的方法个数；本例中只有 set 一个，所以是 1 个；若父类方法返回 T 而子类返回具体类型 String（协变），也会额外生成桥接方法"
          ],
          note: "验证方法：javac GenericsDemo.java 后执行 javap -p -c Box 与 javap -p -c StringBox，数一数 set 出现了几次、参数描述符分别是什么。"
        },
        {
          type: "pitfall",
          title: "这一讲最容易踩的七个坑",
          items: [
            "泛型不能是基本类型：List<int> 直接编译错误，必须写 List<Integer>。自动装箱（autoboxing，把 int 这类基本类型的值自动包成 Integer 对象）会在循环里反复创建对象，百万级数据时内存与耗时都明显上升，这时考虑 int[]、IntStream 或第三方集合库。",
            "不能 new T()、不能 new T[]，也不能写 instanceof Box<String>（只能 instanceof Box<?>）。要创建泛型数组只能靠反射 Array.newInstance，或者让调用方传入 IntFunction<T[]> 工厂。",
            "静态成员不能使用类的类型参数：static T value; 编译报错。原因是静态成员属于类本身，而 T 属于「某一次具体使用」，两者生命周期对不上。",
            "泛型类的类型参数在运行期全部擦除，所以没有 MyException<String> 这种异常类型，catch 子句里也不能出现类型参数。",
            "通配符的方向记牢（PECS：Producer Extends, Consumer Super）：List<? extends Number> 只能读（add 任何非 null 值都编译不过），List<? super Integer> 只能写（读出来只能当 Object）。",
            "两个同名方法只有泛型参数不同会冲突：f(List<String>) 与 f(List<Integer>) 擦除后都是 f(List)，编译器报 name clash，必须改方法名或换设计。",
            "默认方法不是「免费的多继承」：它有菱形冲突要手工裁决，而且不能访问实现类的实例字段（接口没有实例字段）。想共享状态，还是得用抽象类。"
          ]
        }
      ],
      quiz: [
        {
          id: "oop-interface-generics-q1",
          type: "single",
          q: "在设计一个类型层次时，下面关于「用接口还是用抽象类」的判断，正确的是？",
          options: [
            "只要想复用代码就必须用接口，抽象类已经被淘汰了",
            "多个互不相关的类要共享一种能力（例如都能保存）时优先用接口；一族类要共享字段与部分实现时用抽象类",
            "接口里可以有实例字段，所以接口完全可以替代抽象类",
            "一个类如果实现了接口，就不能再继承任何父类"
          ],
          answer: 1,
          why: "B 对：接口表达 can-do 的能力契约，且一个类可以实现多个接口，正好解决「编辑器已经继承了 Window，还想具备 Saveable 能力」这类问题；抽象类表达 is-a，能带实例字段与构造器，适合共享状态加部分实现。A 是口号式结论，抽象类在模板方法、骨架实现里依然不可替代。C 错在接口不能有实例字段，只能有 public static final 常量。D 错在可以同时 extends 一个类并 implements 多个接口，只要 extends 写在前面。"
        },
        {
          id: "oop-interface-generics-q2",
          type: "single",
          q: "下面的程序输出什么？\ninterface Greet { default String hello() { return \"接口默认实现\"; } }\nclass Parent { public String hello() { return \"父类实现\"; } }\nclass Child extends Parent implements Greet { }\npublic class Demo {\n  public static void main(String[] args) {\n    System.out.println(new Child().hello());\n  }\n}",
          options: [
            "接口默认实现",
            "父类实现",
            "编译错误：默认方法与父类方法冲突",
            "运行期抛异常"
          ],
          answer: 1,
          why: "输出「父类实现」。默认方法的冲突裁决第一条规则就是「类优先」：父类里已经有具体方法，接口的默认实现被忽略，这样才不会悄悄改变已有继承体系的行为。只有当父类里没有这个方法时才会用接口的默认实现。若两个接口都提供了同名默认方法且互不继承，才是编译错误，必须在实现类里显式重写并用 接口名.super.方法名() 指定用哪一个。"
        },
        {
          id: "oop-interface-generics-q3",
          type: "fill",
          q: "Java 泛型只在编译期做类型检查，类型参数在运行期会被 ____（填两个字），所以 List<String> 与 List<Integer> 的 getClass() 结果完全相同。",
          answer: ["擦除", "类型擦除", "erasure"],
          why: "答案是擦除（type erasure）。类型参数在编译后被替换成它的最左边界（无上界就是 Object），因此运行期拿不到 T 的任何信息，于是不能 new T()、不能 instanceof Box<String>、不能重载 f(List<String>) 与 f(List<Integer>)。注意别答成「擦掉」：擦除是编译器用边界替换并插入 checkcast 的有规则过程，不是简单地删掉。"
        },
        {
          id: "oop-interface-generics-q4",
          type: "order",
          q: "把「源码里的 Box<String> box = new StringBox(); box.set(\"hi\"); String s = box.get();」在编译与运行两个阶段的处理排成正确顺序",
          items: [
            "编译器按类型参数做静态检查：box 的 T 是 String，set 只能接受 String，否则编译失败",
            "把类型参数擦除到最左边界（无上界则为 Object），得到 set(Object) 与 Object get() 这样的签名",
            "对子类中重写的方法，如果擦除后描述符与父类不同，生成桥接方法并在其中插入 checkcast 后转调真实实现",
            "在调用点插入 checkcast，把 get() 返回的 Object 转回 String",
            "运行期执行时字节码里已无类型参数；若有人用原始类型混入错误类型，最后那一步 checkcast 抛 ClassCastException"
          ],
          answer: [0, 1, 2, 3, 4],
          why: "顺序是：编译期静态检查 → 擦除类型参数 → 生成桥接方法 → 调用点插入 checkcast → 运行期执行。核心理解是「检查靠编译期，转换靠编译器插入的 checkcast」；把擦除放到检查之前，或者以为运行期还能拿到 T 的信息（那样就能 new T()、instanceof 泛型类型了），都是对类型擦除的误解。"
        }
      ]
    },
    {
      id: "oop-exception-collection",
      title: "第 4 讲 异常与集合框架：出错路径与数据组织",
      goal: "你能根据「能不能恢复」选出受检或非受检异常，准确说出 try-catch-finally 与 return 相遇时的执行顺序，按需选对集合实现类，并解释 equals/hashCode 契约被破坏后 HashMap 为什么找不回元素。",
      est: 55,
      blocks: [
        {
          type: "concept",
          title: "异常体系与语法陷阱：从错误码到 finally 与 try-with-resources",
          md: "C 风格的错误处理是「返回错误码 + 出参」：int read_config(Config* out) 返回 0 成功、-1 文件不存在、-2 格式错误、-3 权限不足。三个问题迟早爆发：\n\n1. 调用者可以无视返回值：编译器不提醒你，忘记写 if (ret != 0) 也能编译通过，错误被静默吞掉，程序带着半初始化状态继续跑。\n2. 错误要一层层往上传：中间每一层都得写 if (ret != 0) return ret; 这些样板代码和业务逻辑混在一起，真正的主流程被淹没。\n3. 没有上下文：拿到一个 -3，不知道是哪个文件、哪个值、哪条调用链导致的，也分不清「可恢复」和「致命」。\n\nJava 的异常机制（exception）把正常路径与出错路径分开：方法要么正常返回，要么抛出一个异常对象。这个对象自带四样信息——异常类型（哪一类错误）、message（人能读的说明）、堆栈轨迹（stack trace，出错的完整调用链）、cause（异常链，底层原因）。异常沿调用栈自动向上传播，谁有能力处理谁就 catch，没人处理就由 JVM 打印堆栈并终止该线程。\n\n异常体系的层次与「要不要处理」：\n\n| 层次 | 典型例子 | 处理策略 |\n| Throwable | 所有可抛出对象的根 | 一般不直接使用 |\n| Error | OutOfMemoryError、StackOverflowError | 不要 catch：JVM 级故障，程序无法恢复，能做的只是记录与退出 |\n| Exception（受检 checked） | IOException、SQLException、InterruptedException | 必须处理：catch 或 throws 声明，编译器强制 |\n| RuntimeException（非受检 unchecked） | NullPointerException、IllegalArgumentException、IndexOutOfBoundsException | 不强制：通常代表代码有 bug，正确做法是修代码而不是 catch |\n\n为什么这样分？受检异常代表「可预期的外部故障」——文件不存在、网络中断、磁盘满，调用者有能力补救（换路径、重试、提示用户），所以编译器强制你面对它；RuntimeException 代表「你的代码写错了」——数组越界、空指针、参数非法，编译器逼你处理毫无意义，你该做的是让这种情况永不发生。\n\n一条底线：不要写 catch (Exception e) { } 把一切吞掉。那不是健壮，那是把 bug 藏起来，等它在你最不希望的时候以更难看的方式爆出来。\n\n以上是「为什么需要异常」。接下来的语法与陷阱部分，每个结论都会直接出现在考题里。\n\ntry-catch-finally 的执行顺序必须背下来（这几个结论会直接出现在考题里）：\n\n1. try 里抛异常 → 从上到下找第一个匹配的 catch（所以子类异常必须写在父类前面，否则编译报错）→ 执行 catch → 执行 finally；\n2. try 正常结束 → 跳过 catch → 执行 finally；\n3. try 或 catch 里遇到 return / break / continue → 先把 return 表达式的值算出来存进「待返回槽」，再执行 finally，最后才真正返回；\n4. finally 里也有 return → 它直接覆盖待返回槽里的值，并且会吞掉正在传播的异常（这是最难查的 bug 之一）；\n5. finally 里自己抛异常 → 原来要抛的异常被顶掉（原异常丢失，只能靠 addSuppressed 或异常链保留）。\n\n把第 3 条说精确一点，它有个反直觉的推论：\n\ntry { return x; } finally { x = 2; }   // 返回的是进入 finally 之前的那个值\n\n因为 return x 在进入 finally 之前就把值拷贝进了待返回槽，finally 里改的只是局部变量 x。但如果返回的是对象引用，finally 里修改对象内容（例如 sb.append(\"B\")）你是能看到的——因为拷贝的是引用，指向的还是同一个堆对象。区分「改引用」与「改对象」是理解这条规则的关键。\n\ntry-with-resources（Java 7+）是资源管理的正确姿势：\n\ntry (InputStream in = new FileInputStream(\"a.txt\")) { ... }   // 离开 try 时自动调用 in.close()\n\n资源类型必须实现 AutoCloseable；close() 在 return 之前自动执行；最关键的改进是：如果 try 体抛了异常、close() 又抛异常，close 的异常会被 addSuppressed 挂到主异常上（printStackTrace 里显示为 Suppressed:），而手写 finally 很容易让 close 的异常把真正的错误顶掉。\n\n异常链（exception chaining）是保留根因的唯一办法：\n\nthrow new ServiceException(\"保存订单失败\", e);          // 对：保留 cause，堆栈里出现 Caused by\nthrow new ServiceException(e.getMessage());            // 错：堆栈断链，排查时看不到真正的出错点\n\n自定义异常：继承 Exception（受检）或 RuntimeException（非受检）；构造器至少提供 (String message) 与 (String message, Throwable cause)；类名用 Exception 结尾。throws 声明写在方法签名上，告诉调用者「这个受检异常我不处理，交给你」；重写方法时不能抛出比父类更宽的受检异常（第 2 讲的规则在这里再次出现）。"
        },
        {
          type: "code",
          lang: "java",
          title: "完整例子：finally 的返回值陷阱、try-with-resources 与异常链",
          code: "// 保存为 ExceptDemo.java，真机运行：javac -encoding UTF-8 ExceptDemo.java    然后    java ExceptDemo\n// 预期输出（12 行，顺序如下）：\n// f1() = 1\n// f2() = 2\n// f3() = AB\n// 打开 文件\n// 使用 数据\n// 关闭 文件\n// 打开 文件\n// 使用 数据\n// 关闭 文件\n// 捕获：读失败\n// 上层看到：保存 订单 失败\n// 根因：磁盘满了\n\nclass Resource implements AutoCloseable {\n    private final String name;\n    Resource(String name) { this.name = name; System.out.println(\"打开 \" + name); }\n    String read() { return \"数据\"; }\n    @Override public void close() { System.out.println(\"关闭 \" + name); }   // 离开 try 时自动调用\n}\n\nclass ServiceException extends RuntimeException {          // 自定义业务异常（非受检）\n    ServiceException(String message, Throwable cause) { super(message, cause); }\n}\n\npublic class ExceptDemo {\n    static int f1() {                 // finally 改局部变量：不影响已经算好的返回值\n        int x = 1;\n        try { return x; } finally { x = 2; }\n    }\n\n    static int f2() {                 // finally 里 return：直接覆盖待返回槽\n        try { return 1; } finally { return 2; }\n    }\n\n    static StringBuilder f3() {        // 返回对象引用：finally 修改对象内容会被看到\n        StringBuilder sb = new StringBuilder(\"A\");\n        try { return sb; } finally { sb.append(\"B\"); }\n    }\n\n    static void readFile(boolean fail) throws java.io.IOException {\n        try (Resource r = new Resource(\"文件\")) {              // 自动关闭，且异常不会被 close 顶掉\n            System.out.println(\"使用 \" + r.read());\n            if (fail) throw new java.io.IOException(\"读失败\");\n        }\n    }\n\n    static void save(String name) {\n        try {\n            throw new java.io.IOException(\"磁盘满了\");\n        } catch (java.io.IOException e) {\n            throw new ServiceException(\"保存 \" + name + \" 失败\", e);   // 异常链：保留根因\n        }\n    }\n\n    public static void main(String[] args) {\n        System.out.println(\"f1() = \" + f1());         // 1\n        System.out.println(\"f2() = \" + f2());         // 2\n        System.out.println(\"f3() = \" + f3());         // AB\n\n        try {\n            readFile(false);                          // 正常路径：内部仍会自动 close\n            readFile(true);                           // 异常路径：close 先执行，异常再向上传播\n        } catch (java.io.IOException e) {\n            System.out.println(\"捕获：\" + e.getMessage());\n        }\n\n        try {\n            save(\"订单\");\n        } catch (ServiceException e) {\n            System.out.println(\"上层看到：\" + e.getMessage());\n            System.out.println(\"根因：\" + e.getCause().getMessage());\n        }\n    }\n}\n\n// 动手改两处，立刻能看出区别：\n// 1. 把 f2 的 finally 改成 { System.out.println(\"清理\"); }（不 return），返回值就变回 1。\n// 2. 在 Resource.close() 里加一句 throw new RuntimeException(\"关闭失败\")，观察 try-with-resources\n//    输出里的 Suppressed: 段——主异常（读失败）没有被顶掉，这是它比手写 finally 更可靠的原因。"
        },
        {
          type: "code",
          lang: "python",
          title: "Python 对照：try/finally、with 上下文管理器与哈希（hash，把内容算成一个固定数字，内容相同数字就相同）契约",
          code: "# python3 except_collect.py\n# 预期输出（9 行）：\n# f1() = 1\n# f2() = 2\n# 打开 文件\n# 使用 数据\n# 关闭 文件\n# 捕获: 读失败\n# 根因: 磁盘满了\n# 未重写 __hash__ 的类: None\n# 字典查找: 值A\n#\n# 运行提示：Python 会对 finally 里的 return 给出 SyntaxWarning（Java 只是不报错而已），\n# 两个语言都不推荐这种写法——它既覆盖返回值又吞掉异常，是最难查的 bug 来源之一。\n\n\nclass Resource:                      # 上下文管理器：相当于 Java 的 AutoCloseable\n    def __init__(self, name):\n        self.name = name\n        print('打开', name)\n\n    def read(self):\n        return '数据'\n\n    def __enter__(self):             # 进入 with 时调用\n        return self\n\n    def __exit__(self, exc_type, exc, tb):\n        print('关闭', self.name)     # 离开 with 时一定执行，等价于 Java 里自动调用的 close()\n        return False                 # 返回 False：不吞掉异常，让它继续向外传播\n\n\ndef f1():\n    x = 1\n    try:\n        return x                     # 返回值先算好并保存起来\n    finally:\n        x = 2                        # 只改局部变量，不影响已保存的返回值\n\n\ndef f2():\n    try:\n        return 1\n    finally:\n        return 2                     # finally 里的 return 覆盖前面的返回值\n\n\nprint('f1() =', f1())                # 1：与 Java 的结论完全一致\nprint('f2() =', f2())                # 2\n\n\ntry:\n    with Resource('文件') as r:      # 相当于 Java 的 try-with-resources\n        print('使用', r.read())\n        raise IOError('读失败')\nexcept IOError as e:\n    print('捕获:', e)\n\n\nclass ServiceError(RuntimeError):    # 自定义异常\n    pass\n\n\ndef save(name):\n    try:\n        raise IOError('磁盘满了')\n    except IOError as e:\n        raise ServiceError('保存 ' + name + ' 失败') from e   # 异常链：保留根因\n\n\ntry:\n    save('订单')\nexcept ServiceError as e:\n    print('根因:', e.__cause__)       # 相当于 Java 的 e.getCause()\n\n\nclass Key:                           # 反面教材：没重写 __hash__ 与 __eq__\n    def __init__(self, key_id):\n        self.id = key_id\n\n\nclass GoodKey:\n    def __init__(self, key_id):\n        self.id = key_id\n\n    def __hash__(self):\n        return hash(self.id)         # 相当于 Java 的 hashCode()\n\n    def __eq__(self, other):         # 相当于 Java 的 equals()\n        return isinstance(other, GoodKey) and self.id == other.id\n\n\nd = {}\nd[Key('A')] = '值A'\nprint('未重写 __hash__ 的类:', d.get(Key('A')))     # None：放得进，取不出\ng = {}\ng[GoodKey('A')] = '值A'\nprint('字典查找:', g.get(GoodKey('A')))            # 值A\n\n# 与 Java 的差别：Python 用 __enter__/__exit__ 这对协议实现上下文管理器，with 是语法支持；\n# Java 的 try-with-resources 要求类型实现 AutoCloseable，能力由接口约束。\n# 但哈希契约两个语言一模一样：__eq__ 相等 -> __hash__ 必须相等，字典与 HashMap 都靠它干活。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "单步执行器：try-finally 里的 return 到底返回了哪个值",
          config: {
            state: { "执行到": "方法开始前", "局部变量 x": "—", "待返回槽": "空", "finally 做了什么": "—", "最终返回": "—" },
            steps: [
              {
                desc: "第 1 步：进入方法 f1，局部变量 x = 1",
                state: { "执行到": "int x = 1;", "局部变量 x": "1", "待返回槽": "空", "finally 做了什么": "还没到", "最终返回": "未定" },
                note: "待返回槽是 JVM 里的一个临时位置（可以理解成「返回值先存这里」）。理解这个槽，后面所有反直觉结论都能推出来。"
              },
              {
                desc: "第 2 步：执行 try 里的 return x —— 先求值放进待返回槽，还没有真正返回",
                state: { "执行到": "return x;（求值阶段）", "局部变量 x": "1", "待返回槽": "1（拷贝，不是引用 x 本身）", "finally 做了什么": "还没到", "最终返回": "未定" },
                note: "注意「拷贝」两个字：槽里存的是值 1，与局部变量 x 已经没有关系了。"
              },
              {
                desc: "第 3 步：进入 finally，执行 x = 2",
                state: { "执行到": "finally { x = 2; }", "局部变量 x": "2", "待返回槽": "1（不受影响）", "finally 做了什么": "把局部变量 x 改成 2", "最终返回": "未定" },
                note: "finally 一定执行：无论 try 是正常结束、抛异常还是正在 return。但它改的是局部变量，改不到待返回槽。"
              },
              {
                desc: "第 4 步：finally 结束，方法真正返回",
                state: { "执行到": "方法返回", "局部变量 x": "随栈帧销毁", "待返回槽": "1", "finally 做了什么": "已结束", "最终返回": "1" },
                note: "所以 f1() 返回 1，不是 2。这就是考题里最爱考的那一问。"
              },
              {
                desc: "第 5 步：换一种写法 —— finally 里也写 return 2",
                state: { "执行到": "try { return 1; } finally { return 2; }", "局部变量 x": "—", "待返回槽": "先被写成 1，又被 finally 的 return 覆盖成 2", "finally 做了什么": "return 2：直接改写待返回槽并终止方法", "最终返回": "2" },
                note: "finally 里的 return 不仅覆盖返回值，还会吞掉正在传播的异常（若 try 里抛了异常，那个异常就此消失）。所以规范上禁止在 finally 里写 return。"
              },
              {
                desc: "第 6 步：如果返回的是对象引用，结论反过来了",
                state: { "执行到": "StringBuilder sb = new StringBuilder(\"A\"); try { return sb; } finally { sb.append(\"B\"); }", "局部变量 x": "—", "待返回槽": "存的是引用（指向堆上的 StringBuilder 对象）", "finally 做了什么": "sb.append(\"B\")：改的是堆对象的内部字符数组", "最终返回": "同一个对象的字符串形式：AB" },
                note: "改「引用」不影响返回值，改「对象内容」会影响——因为待返回槽里拷贝的是引用，它和 finally 里的 sb 指向同一个堆对象。f3() 因此输出 AB。"
              },
              {
                desc: "第 7 步：对比 try-with-resources 的关闭时机",
                state: { "执行到": "try (Resource r = new Resource(\"文件\")) { ... return; }", "局部变量 x": "—", "待返回槽": "返回值先算好", "finally 做了什么": "编译器插入的 close() 在 return 之前执行", "最终返回": "关闭完成后才真正返回" },
                note: "顺序是：算返回值 → 调用 close() → 返回。若 close() 抛异常而 try 体没抛，close 的异常成为主异常。"
              },
              {
                desc: "第 8 步：try 体与 close 都抛异常时，谁活下来",
                state: { "执行到": "try { throw new IOException(\"读失败\"); } 且 close() 也抛异常", "局部变量 x": "—", "待返回槽": "无（抛异常路径）", "finally 做了什么": "close() 的异常被 addSuppressed 挂到主异常上", "最终返回": "向上抛 IOException: 读失败（附带 Suppressed: 关闭失败）" },
                note: "这就是 try-with-resources 比手写 finally 更可靠的地方：信息不丢。手写 finally 时很容易让 close 的异常把真正的错误顶掉。"
              }
            ],
            tasks: [
              "把第 5 步的 finally 改成只有 System.out.println（不 return），预测并验证返回值变成 1。",
              "写下 try { return 1; } finally { throw new RuntimeException(\"x\"); } 的执行结果，再用真机验证（答案是抛出异常，1 被丢弃）。",
              "在真机上跑 try-with-resources 例子并在 close() 里抛异常，把输出里的 Suppressed 段抄进笔记。"
            ]
          }
        },
        {
          type: "concept",
          title: "集合框架：选哪个实现类，先问三个问题",
          md: "Java 集合的顶层是两条线：Collection（单个元素的容器，下面分 List 有序可重复、Set 不重复、Queue 队列）和 Map（键值对，独立成一条线，不属于 Collection）。日常 90% 的选择集中在下表这几种实现上：\n\n| 实现类 | 底层结构 | 有序性 | 按下标/查找 | 增删 | 典型场景 |\n| ArrayList | 动态数组 | 保持插入顺序 | 下标 $O(1)$ | 尾部 $O(1)$ 均摊，中间 $O(n)$ | 读多写少，默认首选 |\n| LinkedList | 双向链表 | 保持插入顺序 | $O(n)$ | 已持有节点时 $O(1)$ | 频繁在两端增删（当栈/队列） |\n| ArrayDeque | 环形数组 | 保持插入顺序 | 两端 $O(1)$ | 两端 $O(1)$ | 栈与队列的首选，比 LinkedList 更快 |\n| HashSet | 哈希表 | 无序 | 均摊 $O(1)$ | 均摊 $O(1)$ | 去重、判断存在 |\n| TreeSet | 红黑树 | 按比较器排序 | $O(\\log n)$ | $O(\\log n)$ | 需要有序遍历、范围查询 |\n| HashMap | 哈希表 | 键无序 | 均摊 $O(1)$ | 均摊 $O(1)$ | 最常用的映射 |\n| TreeMap | 红黑树 | 按键排序 | $O(\\log n)$ | $O(\\log n)$ | 需要按 key 排序或范围查询 |\n| LinkedHashMap | 哈希表 + 双向链表 | 插入序或访问序 | 均摊 $O(1)$ | 均摊 $O(1)$ | 需要保持顺序；访问序可做 LRU 缓存 |\n\n三个提问决定选型：要不要去重（要 → Set）？要不要有序（插入序用 LinkedHashSet/LinkedHashMap，排序用 Tree 系列）？主要操作是按下标访问还是按键查找（前者 ArrayList，后者 HashMap）？\n\n为什么 ArrayList 比 LinkedList 常用：数组在内存里连续，缓存友好；每个元素只存一个引用，而链表节点还要多存两个指针。教科书说「链表插入快」，但那要求你已经持有目标节点的引用；按下标插入时，链表仍然要先遍历 $O(n)$ 找位置，实际往往更慢。\n\nHashMap 内部的三件事（这是本讲的重点）：\n\n1. 算哈希：h = key.hashCode(); h = h ^ (h >>> 16) —— 把高 16 位异或到低位，减少「低位相同」导致的碰撞；\n2. 定位桶：index = h & (capacity - 1) —— 容量始终是 2 的幂，所以位运算等价于取模但更快；默认容量 16；\n3. 解决冲突：同一个桶里的元素组成链表（Java 8 起尾插），桶内元素 ≥ 8 且表容量 ≥ 64 时转成红黑树（查询从 $O(n)$ 改善为 $O(\\log n)$）；元素数超过「容量 × 负载因子 0.75」就扩容成 2 倍并重新分布。\n\n迭代器与并发修改异常（ConcurrentModificationException）：for-each 只是迭代器（Iterator，一个「游标」对象：用 hasNext() 问还有没有下一个元素、用 next() 把它取出来）的语法糖。迭代过程中如果通过集合自身的 add/remove 改变了结构（modCount 是集合内部记录修改次数的计数器，它一变就说明结构被改过），下一次 next() 会抛这个异常。它是「快速失败（fail-fast）」检测——让错误尽早暴露，而不是线程安全机制。正确做法：用 iterator.remove()，用 removeIf，或者先把要删的元素收集起来再统一删。"
        },
        {
          type: "code",
          lang: "java",
          title: "完整例子：equals/hashCode 契约被破坏后，元素放得进却取不出",
          code: "// 保存为 MapDemo.java，真机运行：javac -encoding UTF-8 MapDemo.java    然后    java MapDemo\n// 预期输出（7 行）：\n// bad.get(new Key(\"A\")) = null\n// bad.size() = 1\n// 第一次 put 返回 null\n// 第二次 put（同内容 key）返回：值A\n// good.get(new GoodKey(\"A\")) = 值B\n// good.size() = 1\n// 遍历: {Key(A)=值B}\n\nimport java.util.HashMap;\nimport java.util.Map;\nimport java.util.Objects;\n\nclass Key {                       // 反面教材：没有重写 equals 与 hashCode\n    final String id;\n    Key(String id) { this.id = id; }\n    @Override public String toString() { return \"Key(\" + id + \")\"; }\n}\n\nclass GoodKey {\n    final String id;\n    GoodKey(String id) { this.id = id; }\n\n    @Override public boolean equals(Object o) {\n        if (this == o) return true;\n        if (!(o instanceof GoodKey g)) return false;   // Java 16+ 模式匹配；JDK 8 请写成两行\n        return Objects.equals(id, g.id);\n    }\n\n    @Override public int hashCode() { return Objects.hash(id); }   // 必须与 equals 一起重写\n\n    @Override public String toString() { return \"Key(\" + id + \")\"; }\n}\n\npublic class MapDemo {\n    public static void main(String[] args) {\n        Map<Key, String> bad = new HashMap<>();\n        bad.put(new Key(\"A\"), \"值A\");\n        System.out.println(\"bad.get(new Key(\\\"A\\\")) = \" + bad.get(new Key(\"A\")));   // null：找不回来\n        System.out.println(\"bad.size() = \" + bad.size());                            // 1：东西还在里面\n\n        Map<GoodKey, String> good = new HashMap<>();\n        System.out.println(\"第一次 put 返回 \" + good.put(new GoodKey(\"A\"), \"值A\"));   // null\n        System.out.println(\"第二次 put（同内容 key）返回：\" + good.put(new GoodKey(\"A\"), \"值B\"));   // 值A\n        System.out.println(\"good.get(new GoodKey(\\\"A\\\")) = \" + good.get(new GoodKey(\"A\")));        // 值B\n        System.out.println(\"good.size() = \" + good.size());                          // 1：视作同一个 key\n        System.out.println(\"遍历: \" + good);                                          // {Key(A)=值B}\n\n        // HashSet 就是「只有 key 的 HashMap」，同样的契约问题会让 contains 永远返回 false\n        // TreeMap/TreeSet 不看 hashCode，它们用 compareTo：Key 没实现 Comparable 就直接抛\n        // ClassCastException，实现了但 compareTo 与 equals 不一致时会出现「去重不干净」。\n    }\n}"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "单步执行器：HashMap 为什么「放得进、取不出」",
          config: {
            state: { "操作": "还没开始", "key 的哈希": "—", "桶下标": "—", "桶里有什么": "空", "equals 比较次数": 0, "结果": "—" },
            steps: [
              {
                desc: "第 1 步：准备一个没有重写 equals/hashCode 的 Key 类",
                state: { "操作": "class Key { final String id; Key(String id){this.id=id;} }", "key 的哈希": "继承 Object.hashCode：按对象身份生成", "桶下标": "—", "桶里有什么": "空", "equals 比较次数": 0, "结果": "两个内容相同的 Key(\"A\") 是两个完全不同的对象" },
                note: "Object.hashCode 的默认实现按「对象身份」给出一个数（不同对象几乎必然不同），Object.equals 则等价于 ==（比地址）。所以内容相同的两个对象默认既不 equals 也不 同哈希。"
              },
              {
                desc: "第 2 步：创建 k1 = new Key(\"A\")，算出它的哈希",
                state: { "操作": "Key k1 = new Key(\"A\");", "key 的哈希": "身份哈希 h1（示例 0x5A3C1E07）", "桶下标": "h1 & 15 = 11", "桶里有什么": "空", "equals 比较次数": 0, "结果": "k1 的桶是 11 号" },
                note: "桶下标 = hash & (capacity - 1)，容量默认 16，所以是 hash 的低 4 位。"
              },
              {
                desc: "第 3 步：map.put(k1, \"值A\")，11 号桶是空的，直接放进去",
                state: { "操作": "map.put(k1, \"值A\")", "key 的哈希": "h1", "桶下标": "11", "桶里有什么": "11 号桶：[k1 -> 值A]", "equals 比较次数": 0, "结果": "size = 1，一次 equals 都没调用" },
                note: "桶为空时直接挂上，不需要比较——这也是哈希表平均 $O(1)$ 的原因。"
              },
              {
                desc: "第 4 步：创建 k2 = new Key(\"A\")：内容相同，但是另一个对象",
                state: { "操作": "Key k2 = new Key(\"A\");", "key 的哈希": "身份哈希 h2（示例 0x0F7B2D91，与 h1 不同）", "桶下标": "h2 & 15 = 3", "桶里有什么": "11 号桶：[k1 -> 值A]；3 号桶：空", "equals 比较次数": 0, "结果": "k2 落在完全不同的桶里" },
                note: "关键点：哈希不同 → 桶不同。此时「内容相同」这件事还没有任何机会被检查到。"
              },
              {
                desc: "第 5 步：map.get(k2)：先算哈希，找到 3 号桶，空的，返回 null",
                state: { "操作": "map.get(k2)", "key 的哈希": "h2", "桶下标": "3", "桶里有什么": "3 号桶：空", "equals 比较次数": 0, "结果": "返回 null（元素其实还在 11 号桶里）" },
                note: "失败的原因不是 equals 判错了，而是根本没走到那个桶——连门都没找到。"
              },
              {
                desc: "第 6 步：修复 —— 重写 equals 与 hashCode（基于 id）",
                state: { "操作": "class GoodKey { equals 比较 id；hashCode 返回 Objects.hash(id) }", "key 的哈希": "两个内容相同的对象哈希相同（都由 id 算出）", "桶下标": "都是同一个下标", "桶里有什么": "同一个桶", "equals 比较次数": 0, "结果": "重新 put 后：同内容 key 被视为同一个 key" },
                note: "契约：equals 相等 → hashCode 必须相等。反过来不要求（哈希相同、内容不同的元素会落在同一个桶里，靠链表串起来）。"
              },
              {
                desc: "第 7 步：再次 get，这次走进了正确的桶",
                state: { "操作": "good.get(new GoodKey(\"A\"))", "key 的哈希": "与已存入的 key 相同", "桶下标": "同一个桶", "桶里有什么": "[k1 -> 值A]", "equals 比较次数": 1, "结果": "返回 值A" },
                note: "桶内比较顺序是「先比 hash，再比 == ，最后才 equals」：哈希不同直接跳过，避免昂贵的 equals 调用。"
              },
              {
                desc: "第 8 步：只重写 equals、不重写 hashCode 会怎样",
                state: { "操作": "只写 equals，hashCode 仍是身份哈希", "key 的哈希": "不同", "桶下标": "不同", "桶里有什么": "元素在另一个桶里", "equals 比较次数": 0, "结果": "依然返回 null" },
                note: "这就解释了为什么两个方法必须成对重写：HashMap 先用哈希缩小范围，再用 equals 确认相等，缺一不可。"
              },
              {
                desc: "第 9 步：TreeMap 的规则不同，但同样有契约",
                state: { "操作": "Map<Key,String> t = new TreeMap<>()", "key 的哈希": "不看哈希", "桶下标": "—", "桶里有什么": "红黑树（按比较结果排序）", "equals 比较次数": 0, "结果": "Key 没实现 Comparable 时直接抛 ClassCastException" },
                note: "TreeMap/TreeSet 用 compareTo 判断相等：compareTo 返回 0 就视为同一个 key（哪怕 equals 是 false）。所以「compareTo 与 equals 保持一致」是另一条常被忽略的契约。"
              }
            ],
            tasks: [
              "把 Key 的 hashCode 改成 return 1（所有对象同哈希），观察程序行为变化：能取回元素了吗？桶里会发生什么？",
              "给 Key 只加 equals 不加 hashCode，用真机验证第 8 步的结论。",
              "写一个 HashSet<Key>，验证 add 两个内容相同的 Key 后 size 是 2；重写两个方法后变成 1。"
            ]
          }
        },
        {
          type: "calc",
          title: "手算演练：哈希冲突时桶内的比较次数",
          inputs: [
            { name: "key 类", value: "hashCode() 恒定返回 1；equals 按 id 比较内容" },
            { name: "表容量", value: "默认 16，负载因子 0.75（阈值 12）" },
            { name: "桶下标", value: "1 & 15 = 1（三个 key 全部落在 1 号桶）" },
            { name: "操作序列", value: "put(k1) -> put(k2) -> put(k3) -> get(k3) -> get(k4)" },
            { name: "k4", value: "与 k1..k3 同哈希，但内容是新的（不存在于表中）" }
          ],
          outputs: [
            "put(k1)：1 号桶为空，直接放入，equals 比较 0 次",
            "put(k2)：桶里已有 k1，先比 hash（相同）再 equals(k1) 不等 -> 挂到链表，equals 比较 1 次",
            "put(k3)：依次与 k1、k2 比较都返回 false -> 挂上，equals 比较 2 次；三次插入累计 $0 + 1 + 2 = 3 = 3 \\times 2/2$ 次",
            "get(k3)：比 k1（1 次）-> 比 k2（2 次）-> 比 k3（3 次，相等）返回，共 3 次 equals",
            "get(k4)：与桶内 3 个节点各比一次都不等 -> 3 次 equals 后返回 null",
            "一般规律：同一个桶里已有 n 个元素时，插入第 n+1 个要比较 n 次，插入 n 个累计约 $n(n-1)/2$ 次；查找最坏 n 次 —— 哈希退化时 HashMap 的均摊 $O(1)$ 退化成 $O(n)$",
            "保护机制：桶内元素达到 8 个且表容量至少 64 时转成红黑树，最坏查找变成 $O(\\log n)$；容量不足 64 时优先扩容而不是树化",
            "扩容：$16 \\times 0.75 = 12$（容量 × 负载因子 = 阈值）；插入第 13 个元素后触发扩容成 32（新阈值 24），元素被重新分布到新桶里"
          ],
          note: "追问：如果三个 key 的 hashCode 互不相同但下标相同（例如 1、17、33 在容量 16 时都落到 1 号桶），比较次数完全一样——决定桶内长度的是「下标」，不是「哈希值」。"
        },
        {
          type: "pitfall",
          title: "这一讲最容易踩的八个坑",
          items: [
            "在 finally 里写 return：会覆盖返回值并吞掉正在传播的异常，编译器不报错。finally 只应该做清理（关资源、还原状态）。",
            "catch (Exception e) { } 空捕获：把 bug 藏起来，程序带着错误状态继续跑，问题在更远处以更奇怪的方式爆发。至少记录日志，或包装成业务异常往上抛。",
            "用 e.printStackTrace() 代替异常处理：控制台刷一堆堆栈，流程却继续往下走，等于没处理。要么恢复到一致状态，要么包装后抛出。",
            "包装异常时丢掉 cause：throw new ServiceException(e.getMessage()) 会让堆栈断链，排查时看不到根因；正确写法是 new ServiceException(\"保存订单失败\", e)。",
            "迭代过程中用集合自身的方法增删元素：抛 ConcurrentModificationException；应该用 iterator.remove()、removeIf，或先收集再统一删除。",
            "HashMap 的 key 没正确实现 hashCode/equals：放得进、取不出；key 还应尽量不可变——如果参与哈希计算的字段被改了，同样再也找不回来。",
            "自动装箱陷阱：Map<String,Integer> 的 get 对不存在的 key 返回 null，直接拿去参与 int 运算就 NPE（用 getOrDefault）；两个 Integer 用 == 比较时，超出 -128~127 缓存范围就是 false（要用 equals）。",
            "ArrayList 的 remove 重载陷阱：List<Integer> 上写 remove(1) 删的是下标 1，想按值删要写 remove(Integer.valueOf(1))——正是第 2 讲「重载看静态类型」的真实事故现场。"
          ]
        }
      ],
      quiz: [
        {
          id: "oop-exception-collection-q1",
          type: "single",
          q: "关于 try-catch-finally 与 return 的关系，下列说法正确的是？",
          options: [
            "try { return 1; } finally { return 2; } 返回 1，因为 finally 只在抛异常时执行",
            "try { int x = 1; return x; } finally { x = 2; } 返回 2，因为 finally 一定会执行",
            "try { return 1; } finally { return 2; } 返回 2，finally 里的 return 会覆盖前面的返回值",
            "finally 在 return 之后执行，因此 finally 里的任何语句都不可能影响返回值"
          ],
          answer: 2,
          why: "C 对：finally 里的 return 直接改写「待返回槽」，把 try 里的返回值覆盖掉，还会顺带吞掉正在传播的异常。A 错在 finally 总会执行（正常结束、抛异常、遇到 return 三种情况都走）。B 错在 return x 在进入 finally 之前就把值拷贝进待返回槽了，finally 改局部变量 x 影响不到它，实际返回 1（若 x 是对象引用且 finally 修改了对象内容，那才会被看到）。D 的「之后执行」顺序说对了，但结论错了。"
        },
        {
          id: "oop-exception-collection-q2",
          type: "single",
          q: "下面的程序输出什么？\npublic class T {\n  static int f() {\n    int x = 1;\n    try { x = 2; return x; } finally { x = 3; }\n  }\n  public static void main(String[] args) { System.out.println(f()); }\n}",
          options: ["1", "2", "3", "编译错误：finally 不能修改局部变量"],
          answer: 1,
          why: "输出 2。执行顺序是：try 里把 x 改成 2 → return x 求值得到 2 并存入待返回槽 → finally 把 x 改成 3（只改局部变量）→ 方法返回待返回槽里的 2。选 3 是把「finally 一定执行」误当成「finally 改的都会生效」；选 1 是漏看了 try 里的赋值；D 纯属虚构，finally 完全可以修改局部变量，只是改不到待返回槽。若 finally 里写 return x; 才会输出 3。"
        },
        {
          id: "oop-exception-collection-q3",
          type: "fill",
          q: "把两个 equals 相等但 hashCode 不同的对象作为 key 存入 HashMap 后，用内容相同的另一个对象去 get，返回 ____（填一个 Java 字面量）。",
          answer: ["null", "空", "NULL"],
          why: "返回 null。HashMap 先用 hashCode 定位桶，再用 equals 确认相等；hashCode 不同就落到了不同的桶，get 时找到的那个桶是空的，equals 一次都不会被调用，所以「东西还在表里，就是取不出来」。修复办法是把 equals 与 hashCode 成对重写；HashSet 同理（它内部就是 HashMap 的 key 集合）。注意 TreeMap 不用哈希而用 compareTo，规则不同但同样要求与 equals 保持一致。"
        },
        {
          id: "oop-exception-collection-q4",
          type: "order",
          q: "把 HashMap.get(key) 的执行过程排成正确顺序",
          items: [
            "计算扰动后的哈希：h = key.hashCode() ^ (h >>> 16)",
            "用 h & (capacity - 1) 算出桶下标，定位到数组中的槽位",
            "如果该槽位为空，说明 key 不存在，直接返回 null",
            "遍历桶内的链表或红黑树：先比较 hash，再比较引用 == 或调用 equals",
            "命中则返回对应的 value；全部不匹配则返回 null"
          ],
          answer: [0, 1, 2, 3, 4],
          why: "顺序是：算哈希 → 定位桶 → 空桶短路 → 桶内先比 hash 再比 equals → 命中返回或返回 null。两个设计细节值得记住：桶为空时立刻返回，避免无意义的比较；桶内先比 hash 再比 equals，因为哈希是一个 int 比较（极快），而 equals 可能很贵，先比 hash 能挡掉绝大多数比较。把「先 equals 再比 hash」写进顺序里，说明还没理解这两步的代价差异。"
        }
      ]
    },
    {
      id: "oop-io-concurrency",
      title: "第 5 讲 I/O 与并发基础：装饰器与线程安全",
      goal: "你能解释为什么读一个文件要套四层流、并写出正确关闭资源的装饰器链；能说清 count++ 为什么会丢更新、synchronized 与 volatile 各保证什么，并按参数算出线程池会拒绝第几个任务。",
      est: 55,
      blocks: [
        {
          type: "concept",
          title: "问题：为什么读一个文件要套四层流",
          md: "先看三个必须解决的痛点，它们共同决定了 Java I/O 库长成现在这样：\n\n1. 数据源五花八门：磁盘文件、网络 socket、内存数组、标准输入、压缩包内部。如果每种设备一套 API，业务代码换一个来源就要重写。\n2. 单位不一样：字节（byte）是设备的真实单位（图片、压缩包、序列化数据必须按字节处理）；字符（char）是人的单位（文本文件必须先按字符集解码）。混用就是乱码。\n3. 效率：每一次 read() 都可能触发一次系统调用（system call，用户态切到内核态）。一次只读 1 字节去读 1 MB 文件，就是一百万次系统调用——开销远大于真正搬运数据的时间。\n\n装饰器模式（decorator pattern）的回答：把所有输入源统一抽象成 InputStream，只留下最基础的 read()；然后用「包装」的方式一层层叠加能力，每一层都实现同一个接口并持有被包装的对象，因此可以任意嵌套、自由组合：\n\n| 层 | 类 | 提供的能力 |\n| 数据源 | FileInputStream | 从文件按字节读（最基础，也最慢） |\n| 缓冲 | BufferedInputStream | 一次读一大块进内存，read() 先在缓冲区取（把百万次系统调用降到几千次） |\n| 类型解析 | DataInputStream | readInt()、readUTF()：把 4 个字节拼成一个 int |\n| 解码 | InputStreamReader | 字节到字符，按指定字符集解码 |\n| 按行读 | BufferedReader | readLine()：按行切分，文本处理最常用 |\n\n为什么说 I/O 是装饰器模式的教科书案例：这些能力是正交的（缓冲 × 类型解析 × 解码 × 按行），可以任意组合。如果用继承来实现组合，4 种可选能力需要 2 的 4 次方 = 16 个子类（BufferedDataInputStream、BufferedUtf8LineInputStream……），而且顺序还得固定；用装饰器只需要 5 个类，新增一种能力只加一个类、不改老代码。第 6 讲会把这个数字算成一道手算题。\n\n一句话认识 NIO：java.nio 用 Channel + Buffer + Selector 把「一个连接一个线程、阻塞等数据」换成「少量线程监听大量连接的就绪事件」，是高并发服务器的基石；但普通文件读写用传统 IO 加缓冲就够了，不必为了「新」而用 NIO。\n\n最后一个现实提醒：不加缓冲的逐字节读写在小文件上看不出差别，文件一旦到几 MB，差距往往是几十倍——原因就是上面第 3 条的系统调用次数。"
        },
        {
          type: "code",
          lang: "java",
          title: "完整例子：装饰器链读写文本与二进制（JDK 11+）",
          code: "// 保存为 IoDemo.java，真机运行：javac -encoding UTF-8 IoDemo.java    然后    java IoDemo\n// 程序会在当前目录生成 demo-io.txt 与 demo-io.bin 两个文件。\n// 预期输出（4 行）：\n// 文件大小：20 字节\n// 读回：第一行|第二行|\n// 二进制读回：int=20240501，UTF=订单，double=3.5\n// NIO 一行读全部：[第一行, 第二行]\n\nimport java.io.BufferedInputStream;\nimport java.io.BufferedOutputStream;\nimport java.io.BufferedReader;\nimport java.io.BufferedWriter;\nimport java.io.DataInputStream;\nimport java.io.DataOutputStream;\nimport java.io.IOException;\nimport java.io.InputStreamReader;\nimport java.io.OutputStreamWriter;\nimport java.nio.charset.StandardCharsets;\nimport java.nio.file.Files;\nimport java.nio.file.Path;\n\npublic class IoDemo {\n    public static void main(String[] args) throws IOException {\n        Path text = Path.of(\"demo-io.txt\");\n        Path bin  = Path.of(\"demo-io.bin\");\n\n        // 装饰器链：文件(字节) -> 缓冲 -> 解码(字符) -> 按行缓冲\n        try (BufferedWriter w = new BufferedWriter(\n                new OutputStreamWriter(\n                    new BufferedOutputStream(Files.newOutputStream(text)), StandardCharsets.UTF_8))) {\n            w.write(\"第一行\");\n            w.write('\\n');     // 用 \\n 而不是 newLine()，避免平台差异（Windows 的 newLine() 是 \\r\\n）\n            w.write(\"第二行\");\n            w.write('\\n');\n        }   // 离开 try 自动 close，缓冲区里的数据被 flush 到磁盘\n\n        // 3 个汉字 * 3 字节 * 2 行 + 2 个换行 = 20\n        System.out.println(\"文件大小：\" + Files.size(text) + \" 字节\");\n\n        StringBuilder sb = new StringBuilder();\n        try (BufferedReader r = new BufferedReader(\n                new InputStreamReader(Files.newInputStream(text), StandardCharsets.UTF_8))) {\n            String line;\n            while ((line = r.readLine()) != null) {\n                sb.append(line).append('|');\n            }\n        }\n        System.out.println(\"读回：\" + sb);\n\n        // 二进制：DataOutputStream 把 int 写成 4 字节，把字符串写成「2 字节长度 + 改进版 UTF-8」\n        try (DataOutputStream out = new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(bin)))) {\n            out.writeInt(20240501);\n            out.writeUTF(\"订单\");\n            out.writeDouble(3.5);\n        }\n        try (DataInputStream in = new DataInputStream(new BufferedInputStream(Files.newInputStream(bin)))) {\n            System.out.println(\"二进制读回：int=\" + in.readInt() + \"，UTF=\" + in.readUTF() + \"，double=\" + in.readDouble());\n        }\n\n        // NIO 的日常用法：一行读完，适合小文件；大文件仍要用流，避免一次把内存吃光\n        System.out.println(\"NIO 一行读全部：\" + Files.readAllLines(text, StandardCharsets.UTF_8));\n\n        Files.deleteIfExists(text);\n        Files.deleteIfExists(bin);\n    }\n}"
        },
        {
          type: "concept",
          title: "并发：为什么 count++ 会丢数据，synchronized 与 volatile 各管什么",
          md: "线程存在的三个理由：响应性（界面线程不能被慢操作卡住）、吞吐量（一个线程等磁盘时另一个线程可以用 CPU）、结构性（定时任务、监听、后台任务分开写更清楚）。代价同样明确：一旦多个线程共享可变状态，就会出现竞态（race condition），而这类 bug 往往「跑一百次才对一次」，极难复现。\n\n进程与线程的区别（进程 process：一个正在运行的程序实例，拥有自己独立的内存空间；线程则是它内部的一条执行流）：\n\n| 维度 | 进程 | 线程 |\n| 资源 | 独立地址空间、独立的文件描述符表 | 共享所属进程的堆与方法区，只有虚拟机栈和程序计数器私有 |\n| 切换开销 | 大（换页表、影响缓存与 TLB） | 小（同一地址空间，只换栈与寄存器） |\n| 通信方式 | 需要 IPC（管道、共享内存、socket） | 直接读写共享变量（方便，也正是危险所在） |\n| 隔离性 | 一个进程崩溃不影响别人 | 一个线程未捕获异常可能拖垮整个进程 |\n\n三种创建方式：extends Thread（不推荐，白白占掉唯一的继承名额）、implements Runnable（推荐，还能配合 lambda 与线程池）、implements Callable + Future（能拿到返回值、能抛异常）。\n\n线程生命周期：NEW（new 出来还没 start）→ RUNNABLE（可运行，包含正在跑和排队等 CPU）→ BLOCKED（等 synchronized 锁）／WAITING（wait、join 无限等）／TIMED_WAITING（sleep、wait(ms)、join(ms)）→ TERMINATED（终止后不能重启，再次 start 抛 IllegalThreadStateException）。\n\n竞态的本质：count++ 不是一步，而是「读 count → 加 1 → 写回」三步。两个线程完全可能都读到旧值 0，各自加 1 后都写回 1——一次自增凭空消失，这叫丢失更新（lost update）。\n\nsynchronized 同时提供两件事：互斥（同一时刻只有一个线程能进入临界区——锁可以理解成一把钥匙，只有拿到钥匙的线程才能进入它保护的那段代码）与可见性（退出同步块时把工作内存的修改刷新到主内存，进入时重新读取）。修饰实例方法锁的是 this，修饰静态方法锁的是该类的 Class 对象，修饰代码块锁的是你给的那个对象——必须所有线程用同一个锁对象，否则等于没锁。\n\nvolatile 只提供可见性与禁止指令重排序，不提供原子性。所以 volatile int count; 然后 count++ 依然会丢更新；它的正确用途是「一个线程写、多个线程读」的状态标志位，例如 volatile boolean running = true。\n\nwait/notify 是线程间协作：必须在 synchronized 块里调用（否则 IllegalMonitorStateException）；wait() 会释放锁并进入等待队列，notify/notifyAll() 唤醒等待者。判断条件永远用 while 而不是 if——因为存在虚假唤醒（spurious wakeup）与被唤醒后条件又被别人改掉的情况。\n\n线程池（Executor 框架）的思想：线程的创建与销毁有成本，任务来了才 new 一个线程、任务多就无限 new，最终会耗尽内存。线程池把线程复用起来——任务先放进队列，固定几个工作线程循环取任务执行。为什么生产代码不用 Executors 的快捷工厂？因为 newFixedThreadPool/newCachedThreadPool 用的是无界队列，任务堆积时线程数永远不涨，最后 OutOfMemoryError；正确做法是直接 new ThreadPoolExecutor 并把 7 个参数写清楚。\n\n并发容器与原子类一句话：ConcurrentHashMap 用 CAS 加桶级锁替代「整表加锁」，读几乎无锁，吞吐远高于 Collections.synchronizedMap；CopyOnWriteArrayList 适合读多写极少（每次写都复制整个数组）；AtomicInteger 用 CPU 的 CAS 指令实现无锁自增；CountDownLatch、CompletableFuture 负责线程间的等待与异步组合。"
        },
        {
          type: "code",
          lang: "java",
          title: "完整例子：竞态、加锁、线程池与并发容器",
          code: "// 保存为 ConcurrencyDemo.java，真机运行：javac -encoding UTF-8 ConcurrencyDemo.java    然后    java ConcurrencyDemo\n// 预期输出（4 行）：\n// 不加锁：187643（每次运行的具体数字都不同，但几乎必然小于 200000）\n// 加锁后：200000\n// 线程池完成任务数：8\n// ConcurrentHashMap 累加结果：20000\n\nimport java.util.concurrent.ArrayBlockingQueue;\nimport java.util.concurrent.ConcurrentHashMap;\nimport java.util.concurrent.ExecutorService;\nimport java.util.concurrent.ThreadPoolExecutor;\nimport java.util.concurrent.TimeUnit;\nimport java.util.concurrent.atomic.AtomicInteger;\n\npublic class ConcurrencyDemo {\n    static int counter = 0;                 // 共享变量：读-改-写三步不是原子操作\n    static final Object LOCK = new Object();// 锁对象必须是所有线程共享的同一个对象\n\n    static void race(boolean locked) throws InterruptedException {\n        counter = 0;\n        Runnable task = () -> {\n            for (int i = 0; i < 100_000; i++) {\n                if (locked) {\n                    synchronized (LOCK) { counter++; }   // 互斥 + 可见性\n                } else {\n                    counter++;                            // 三步可以被任意穿插\n                }\n            }\n        };\n        Thread t1 = new Thread(task);\n        Thread t2 = new Thread(task);\n        t1.start(); t2.start();\n        t1.join(); t2.join();               // 等两个线程都结束再读结果\n    }\n\n    public static void main(String[] args) throws Exception {\n        race(false);\n        System.out.println(\"不加锁：\" + counter + \"（每次运行的具体数字都不同，但几乎必然小于 200000）\");\n\n        race(true);\n        System.out.println(\"加锁后：\" + counter);        // 一定是 200000\n\n        // 线程池：核心 2 个线程、最多 4 个、队列容量 2；任务太多时由提交线程自己跑（背压）\n        ExecutorService pool = new ThreadPoolExecutor(\n                2, 4, 60L, TimeUnit.SECONDS,\n                new ArrayBlockingQueue<>(2),\n                new ThreadPoolExecutor.CallerRunsPolicy());\n        AtomicInteger done = new AtomicInteger();\n        for (int i = 0; i < 8; i++) {\n            pool.execute(done::incrementAndGet);   // 8 个任务：池内线程 + 队列，超出的由 main 代跑（CallerRunsPolicy）\n        }\n        pool.shutdown();                            // 不 shutdown，非守护线程会让程序不退出\n        pool.awaitTermination(5, TimeUnit.SECONDS);\n        System.out.println(\"线程池完成任务数：\" + done.get());\n\n        // 并发容器：两个线程各累加 10000 次，ConcurrentHashMap.merge 是原子的\n        ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();\n        Runnable acc = () -> {\n            for (int i = 0; i < 10_000; i++) map.merge(\"k\", 1, Integer::sum);\n        };\n        Thread a = new Thread(acc), b = new Thread(acc);\n        a.start(); b.start(); a.join(); b.join();\n        System.out.println(\"ConcurrentHashMap 累加结果：\" + map.get(\"k\"));   // 20000\n\n        // 对照实验：把 volatile 加到普通计数器上，丢更新依旧发生——\n        // volatile 保证「每次读到的都是最新值」，但读-改-写三步之间照样能被切换。\n    }\n}"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "单步执行器：两个线程各加一次，为什么结果只有 1",
          config: {
            state: { "时刻": "初始", "线程 A": "准备执行 count++", "线程 B": "准备执行 count++", "共享变量 count": 0, "说明": "两个线程共享同一个 count" },
            steps: [
              {
                desc: "第 1 步：count = 0，两个线程都要执行一次 count++",
                state: { "时刻": "T0", "线程 A": "准备执行 count++（读->改->写三步）", "线程 B": "准备执行 count++", "共享变量 count": 0, "说明": "count++ 在字节码里是 getstatic / iconst_1 / iadd / putstatic，不是一个原子操作" },
                note: "正确结果本该是 2。下面看看它是怎么变成 1 的。"
              },
              {
                desc: "第 2 步：线程 A 读到 count 的值 0，存进自己的寄存器",
                state: { "时刻": "T1", "线程 A": "读到 count = 0（中间值存在 A 的寄存器里）", "线程 B": "还没开始这一轮", "共享变量 count": 0, "说明": "A 只完成了「读」" },
                note: "每个线程都有自己的工作内存（可以理解成 CPU 寄存器/缓存），读到的值不会自动同步给别人。"
              },
              {
                desc: "第 3 步：时间片切换，线程 B 也读到 count = 0",
                state: { "时刻": "T2", "线程 A": "被挂起，寄存器里存着 0", "线程 B": "读到 count = 0（B 也拿到旧值）", "共享变量 count": 0, "说明": "两次读都发生在任何一次写之前——竞态窗口" },
                note: "关键点：A 的写还没发生，所以 B 看到的是旧值。这就是竞态（race condition）。"
              },
              {
                desc: "第 4 步：线程 A 恢复执行，写回 1",
                state: { "时刻": "T3", "线程 A": "0 + 1 = 1，写回 count", "线程 B": "还在准备写", "共享变量 count": 1, "说明": "A 的一次自增生效了" },
                note: "到这一步一切正常，问题出在下一步：B 用的是自己 T2 时刻读到的旧值。"
              },
              {
                desc: "第 5 步：线程 B 写回它算好的 1，A 的成果被覆盖",
                state: { "时刻": "T4", "线程 A": "结束", "线程 B": "0 + 1 = 1，写回 count（覆盖了 A 的结果）", "共享变量 count": 1, "说明": "丢失更新：两次自增只留下一次" },
                note: "B 并没有「算错」，它只是基于过期数据计算。这类 bug 的可怕之处是偶发：跑一百次可能只错几次。"
              },
              {
                desc: "第 6 步：最终结果 1，而不是期望的 2",
                state: { "时刻": "T5", "线程 A": "已结束", "线程 B": "已结束", "共享变量 count": 1, "说明": "结果 = 1（期望 2）：一次更新凭空消失" },
                note: "把 count 换成 int，把 100 次换成 10 万次，就是上面代码里「不加锁：187643」那个数字的来源。"
              },
              {
                desc: "第 7 步：加锁重来 —— 线程 A 先拿到锁，B 被挡住",
                state: { "时刻": "T6", "线程 A": "进入 synchronized 块，持有锁", "线程 B": "到达同步块，状态变成 BLOCKED，排队等锁", "共享变量 count": 0, "说明": "同一时刻只有一个线程能进入临界区" },
                note: "synchronized 的第一重保证是互斥：临界区代码不可能交错执行。"
              },
              {
                desc: "第 8 步：A 在锁内完成读-改-写，退出时刷新主内存并释放锁",
                state: { "时刻": "T7", "线程 A": "读 0 -> 加 1 -> 写回 1，然后退出同步块", "线程 B": "仍在等锁", "共享变量 count": 1, "说明": "A 的结果已经写回主内存" },
                note: "第二重保证是可见性：退出同步块时刷新到主内存，进入时重新读取，B 不可能再看到过期值。"
              },
              {
                desc: "第 9 步：B 拿到锁，读到的必然是 1",
                state: { "时刻": "T8", "线程 A": "结束", "线程 B": "获得锁，读 1 -> 加 1 -> 写回 2，退出", "共享变量 count": 2, "说明": "两次自增都生效" },
                note: "这就是「加锁后：200000」的原因。锁把「读-改-写」打包成了一个不可分割的整体。"
              },
              {
                desc: "第 10 步：换成 volatile 会怎样？仍然会丢更新",
                state: { "时刻": "T9", "线程 A": "volatile 只保证「读到的值是最新的」", "线程 B": "读-改-写三步之间照样能被切换", "共享变量 count": "可能又是 1", "说明": "volatile 不提供原子性，解决不了这个 bug" },
                note: "volatile 的适用场景是「一个线程写、多个线程读」的标志位；要原子自增就用 synchronized 或 AtomicInteger（CAS 无锁）。"
              }
            ],
            tasks: [
              "把第 3 步的切换点挪到「A 写回之后」，重画一遍状态表，说明为什么这时候结果是 2。",
              "在真机上把 race(box, false) 跑 5 次，记录每次的数字，解释为什么它们各不相同。",
              "把普通 int 换成 AtomicInteger 再跑一次，确认结果永远是 200000，并说明 CAS 与加锁的区别。"
            ]
          }
        },
        {
          type: "code",
          lang: "python",
          title: "Python 对照：GIL 存在，为什么还要加锁",
          code: "# python3 race.py\n# 预期输出（第一行的具体数字每次可能略有浮动，但一定远小于 200）：\n# 不加锁: 100 （远小于 200 ，发生了丢失更新）\n# 加锁后: 2000\n# GIL 保护的原子操作: 4000\n\nimport threading\nimport time\n\nROUNDS = 100\ncounter = 0\nlock = threading.Lock()\n\n\ndef unsafe_worker():\n    global counter\n    for _ in range(ROUNDS):\n        tmp = counter            # 读\n        time.sleep(0.0005)       # 放大竞态窗口：让另一个线程也读到同一个旧值\n        counter = tmp + 1        # 改 + 写\n\n\nt1 = threading.Thread(target=unsafe_worker)\nt2 = threading.Thread(target=unsafe_worker)\nt1.start(); t2.start(); t1.join(); t2.join()\nprint('不加锁:', counter, '（远小于', ROUNDS * 2, '，发生了丢失更新）')\n\n\ndef safe_worker():\n    global counter\n    for _ in range(1000):\n        with lock:               # 同一时刻只有一个线程能进入\n            counter += 1\n\n\ncounter = 0\nt3 = threading.Thread(target=safe_worker)\nt4 = threading.Thread(target=safe_worker)\nt3.start(); t4.start(); t3.join(); t4.join()\nprint('加锁后:', counter)        # 一定是 2000\n\n# GIL 保证的是「单条字节码」的原子性，不是「一组操作」的原子性：\n# counter += 1 会被拆成 LOAD / ADD / STORE 多条字节码，中间可以切换线程；\n# 而 list.append 是单个 C 函数调用，不会被 GIL 打断，所以下面两个线程的结果一定准确。\nshared_list = []\n\n\ndef append_worker():\n    for _ in range(2000):\n        shared_list.append(1)    # 单条原子操作\n\n\nt5 = threading.Thread(target=append_worker)\nt6 = threading.Thread(target=append_worker)\nt5.start(); t6.start(); t5.join(); t6.join()\nprint('GIL 保护的原子操作:', len(shared_list))\n\n# 与 Java 的差别：Java 没有 GIL，两个线程可以真正同时跑在多核上，\n# 所以 Java 的竞态更「频繁」也更需要 synchronized/volatile/原子类；\n# Python 想利用多核必须换多进程（multiprocessing），线程只适合 I/O 密集任务。"
        },
        {
          type: "calc",
          title: "手算演练：ThreadPoolExecutor 会拒绝第几个任务",
          inputs: [
            { name: "线程池参数", value: "corePoolSize = 2，maximumPoolSize = 4，workQueue = ArrayBlockingQueue(2)" },
            { name: "任务序列", value: "连续快速提交 7 个耗时任务（提交速度远快于执行速度，执行期间没有任务完成）" },
            { name: "调度规则", value: "核心未满 -> 建核心线程；否则尝试入队；队列满且未达 maximum -> 建新线程；否则执行拒绝策略" },
            { name: "默认拒绝策略", value: "AbortPolicy：抛 RejectedExecutionException" }
          ],
          outputs: [
            "任务 1、2：线程数 < corePoolSize(2) -> 各创建一个核心线程直接执行（线程 2 个，队列 0 个）",
            "任务 3、4：核心已满 -> 进入队列（线程 2 个，队列 2/2，已满）",
            "任务 5、6：队列已满且线程数 2 < maximum(4) -> 各创建一个非核心线程执行（线程 4 个，队列仍满）",
            "任务 7：线程数已达 maximum 且队列已满 -> 触发拒绝策略，抛 RejectedExecutionException",
            "汇总：同时在跑 4 个、排队 2 个、被拒 1 个；也就是说这个配置最多同时容纳 $4 + 2 = 6$ 个任务",
            "换成 CallerRunsPolicy：任务 7 由提交它的线程（例如 main）直接执行，不丢弃、起到背压作用，本例 7 个任务全部完成",
            "换成无界队列（Executors.newFixedThreadPool 的内部做法）：队列永远不满 -> 线程数永远停在 2 -> 任务无限堆积 -> 内存耗尽 OutOfMemoryError，这就是生产代码不推荐 Executors 快捷工厂的原因",
            "若队列换成容量 0 的 SynchronousQueue（newCachedThreadPool 的做法）：任务 1、2 建核心线程，3、4 扩容到 maximum=4，任务 5、6、7 因池满且无法入队全部被拒 —— 队列容量直接决定「先排队还是先加线程」"
          ],
          note: "记住这个反直觉点：任务先排队、排不下才加线程，而不是先加线程。所以「核心 2、最大 4、队列 2」时，第 7 个任务就被拒了，而不是等到第 5 个。"
        },
        {
          type: "pitfall",
          title: "这一讲最容易踩的八个坑",
          items: [
            "以为 volatile 能替代锁：volatile 只保证可见性与禁止重排序，count++ 这类读-改-写依然会丢更新。要原子性就用 synchronized 或 AtomicInteger。",
            "锁对象不是同一个：synchronized (new Object()) 每次都是新锁，等于没加锁；synchronized 修饰实例方法锁的是 this，不同对象之间并不互斥——要跨对象互斥就得锁同一个静态对象或 Class。",
            "死锁：两个线程以相反的顺序获取两把锁，互相等待。预防办法是全局统一加锁顺序、用 tryLock 带超时、把临界区尽量缩小。",
            "分不清 start() 与 run()：调用 run() 只是普通方法调用，还在当前线程里执行，必须 start() 才会创建新线程；同一个 Thread 对象 start 两次抛 IllegalThreadStateException。",
            "线程池用完不 shutdown：非守护线程还活着，程序不退出；同时要明确拒绝策略，别让任务被静默丢弃。",
            "I/O 流不 flush、不 close：数据还留在缓冲区里，文件里什么都没有；用 try-with-resources 让编译器保证关闭，BufferedWriter 需要立刻落盘时再手动 flush。",
            "读写文本不指定字符集：默认编码在 Windows(GBK) 与 Linux(UTF-8) 之间不一致，必然乱码；所有转换点都显式写 StandardCharsets.UTF_8。",
            "在 synchronized 块里做耗时 I/O 或等待网络：锁的持有时间被拉长，所有线程排队，吞吐量直接崩掉——锁只保护共享状态，不要保护慢操作。"
          ]
        },
        {
          type: "lab",
          title: "上机：I/O 与并发的两组实验（约 60 分钟）",
          steps: [
            { t: "实验 1 缓冲的威力", d: "写一个程序统计大文本文件的行数：版本 A 用 FileInputStream 逐字节读并数换行符，版本 B 用 BufferedReader.readLine()。用 System.nanoTime() 各测 3 次取平均，记录倍数差距，并解释差距来自系统调用次数。" },
            { t: "实验 2 生产者消费者", d: "用 BlockingQueue<String>（容量 5）写 2 个生产者、3 个消费者；生产结束后放入毒丸（特殊字符串 END），消费者读到毒丸就退出——体会「用数据传递停止信号」比用标志位更可靠。" },
            { t: "实验 3 手写阻塞队列", d: "把 BlockingQueue 换成 ArrayList + synchronized + wait/notify 自己实现 put/take，注意条件判断必须用 while 而不是 if。跑通后再换回 BlockingQueue，说出它替你处理了哪些边界情况。" },
            { t: "实验 4 线程池参数", d: "用 new ThreadPoolExecutor(2, 4, 60, TimeUnit.SECONDS, new ArrayBlockingQueue<>(2)) 提交 7 个任务，每个任务打印自己的编号与线程名；标出哪一个被拒绝，再把拒绝策略换成 CallerRunsPolicy 观察变化。" },
            { t: "实验 5 计数器对比", d: "用 synchronized、AtomicInteger、LongAdder 三种方式各写一个 4 线程 × 10 万次的自增计数器，打印耗时与结果，解释为什么结果都必须正确而耗时不同。" },
            { t: "提交标准", d: "能解释每一个数字的来源；能回答「volatile 在这个场景下为什么不够用」；代码里没有一处忘记关闭的流、没有一处 new Object() 当锁。" }
          ],
          note: "调试建议：并发 bug 不要靠加打印来猜（打印本身会改变时序）。先把状态画成上面的单步表，确认「哪两次操作之间可以发生切换」，再决定加锁的位置与粒度。"
        }
      ],
      quiz: [
        {
          id: "oop-io-concurrency-q1",
          type: "single",
          q: "关于 volatile 与 synchronized 的语义，下列说法正确的是？",
          options: [
            "volatile 能保证 count++ 的原子性，因此用 volatile 替代 synchronized 效率更高",
            "volatile 只保证可见性与禁止指令重排序，count++ 这种读-改-写仍会丢失更新，需要 synchronized 或 AtomicInteger",
            "synchronized 只保证互斥，可见性必须靠 volatile 补齐",
            "synchronized 修饰实例方法时锁的是 Class 对象，所以同一个类的所有实例之间互斥"
          ],
          answer: 1,
          why: "B 对：volatile 让每次读都拿到主内存的最新值，但 count++ 是「读-改-写」三步，中间依然可能被切换，所以两个线程各加一次仍可能只加出 1。A 把可见性误当成原子性。C 反了：synchronized 同时提供互斥与可见性（退出同步块时刷新主内存），根本不需要 volatile 补齐。D 错在修饰实例方法锁的是 this（当前对象），只有静态方法锁的才是 Class 对象；锁不同对象的两个线程之间并不互斥。"
        },
        {
          id: "oop-io-concurrency-q2",
          type: "single",
          q: "count 初始为 0，两个线程按下面标出的顺序执行 count++（读->改->写三步）：\nA 读 count 得到 0\nB 读 count 得到 0\nA 写回 count = 1\nB 写回 count = 1\n最终 count 的值是多少？",
          options: ["0", "1", "2", "无法确定，取决于机器核数"],
          answer: 1,
          why: "结果是 1。两次自增只生效一次：B 在 A 写回之前就读到了旧值 0，于是它算出的结果也是 1，写回时把 A 的成果覆盖掉了。这叫丢失更新（lost update），根源是「读-改-写」不是原子操作。选 2 说明只数了自增次数、没看时序；选「无法确定」不成立——题目已经把交错顺序完全确定了，结果必然是 1。修复方式是给临界区加锁或用 AtomicInteger 的 CAS 自增。"
        },
        {
          id: "oop-io-concurrency-q3",
          type: "fill",
          q: "ThreadPoolExecutor 的调度顺序是：核心线程未满就创建核心线程；否则尝试入队；队列已满且线程数未达到 ____ 时才创建新线程；否则执行拒绝策略。",
          answer: ["maximumPoolSize", "最大线程数", "max", "maximumpoolsize"],
          why: "答案是 maximumPoolSize（最大线程数）。这条顺序反直觉：任务先排队，排不下才扩容线程，所以「核心 2、最大 4、队列 2」的池在第 7 个任务上就会被拒绝，而不是第 5 个。另外记住两种极端：无界队列让线程数永远停在 corePoolSize（任务无限堆积会 OOM，Executors.newFixedThreadPool 就是这样）；容量 0 的 SynchronousQueue 让任务永远先尝试扩容线程（newCachedThreadPool 的做法）。"
        },
        {
          id: "oop-io-concurrency-q4",
          type: "order",
          q: "把「两个线程各对共享变量 count 自增一次」在加锁后的正确执行顺序排出来（count 初值为 0）",
          items: [
            "线程 A 进入 synchronized 块获得锁，线程 B 若此时到达则进入 BLOCKED 状态排队",
            "线程 A 读取 count，得到 0",
            "线程 A 计算 0 + 1 并把 1 写回 count",
            "线程 A 退出同步块：释放锁，同时把工作内存中的修改刷新到主内存",
            "线程 B 获得锁，此时读到的是 1（synchronized 顺带保证了可见性），写回 2 后释放锁"
          ],
          answer: [0, 1, 2, 3, 4],
          why: "顺序是：A 拿锁 -> A 读 -> A 写 -> A 释放并刷新主内存 -> B 拿锁后读到最新值。两个要点：互斥让读-改-写之间不可能插入另一个线程的操作，可见性让 B 不可能再读到过期值——这两件事是同一把锁一起提供的。把「刷新主内存」排在释放锁之后，或者让 B 在 A 持锁期间读值，都会破坏这个保证。"
        }
      ]
    },
    {
      id: "oop-design-practice",
      title: "第 6 讲 面向对象设计实践：原则、模式与测试",
      goal: "你能用 SOLID 诊断一段糟糕的设计并说出重构方向，按场景选用工厂/单例/策略/观察者/适配器/装饰器，把 UML 类图与 Java 代码互相翻译，并为关键规则写出 JUnit 单元测试。",
      est: 55,
      blocks: [
        {
          type: "concept",
          title: "问题：代码为什么会「越改越烂」",
          md: "一个真实的演化故事：订单结算最初只支持一种支付方式，一个 if 就够了。半年后加了微信、支付宝、会员积分（loyalty points，即消费攒下的点数，下次结算能抵现金；跟数学里的积分不是一回事）、组合支付，又加了优惠券、会员折扣、跨境税——每次需求都往同一个 SettlementService 里塞一个分支、一个字段，最后它有两千行，谁都不敢改，改一行要回归测试三天。\n\n腐烂的根源不是水平不够，而是三件事：变化点没有被隔离（所有变化都砸在同一个类里）、依赖方向错了（业务逻辑直接依赖具体实现与框架细节）、抽象粒度不对（一个类承担了太多变化原因）。\n\nSOLID 五原则就是五条「把变化关进笼子」的经验法则：\n\n| 原则 | 一句话 | 违反时的信号 |\n| 单一职责 SRP | 一个类只有一个引起它变化的原因 | 类名里出现 And、Manager、Util；改一个需求要动同一个类里几处不相干的方法 |\n| 开闭原则 OCP | 对扩展开放，对修改关闭 | 新增一种类型就要改 switch 或 if-else 链 |\n| 里氏替换 LSP | 子类必须能替换父类而不破坏正确性 | 子类抛「不支持该操作」异常；父类方法在子类里被改成空实现 |\n| 接口隔离 ISP | 接口要小而专，不逼实现者实现用不到的方法 | 实现类里到处是 throw new UnsupportedOperationException() |\n| 依赖倒置 DIP | 高层与低层都依赖抽象，抽象不依赖细节 | 业务类里直接 new 具体实现、直接 import 框架或数据库类 |\n\n必须强调：SOLID 是启发式经验，不是法律。为了「将来可能扩展」提前抽象，比重复代码更贵——多一层接口就多一层理解和调试成本。判断依据永远是「这个变化真的发生过，或者明确可预见」。过早抽象与过晚抽象都是设计缺陷，前者更常见于学生作业。"
        },
        {
          type: "steps",
          title: "SOLID 落地：每条原则的「违反信号 -> 重构手法」",
          items: [
            { t: "单一职责 SRP", d: "违反：OrderService 里同时做参数校验、价格计算、发短信、写数据库，改短信模板也要重新测试价格逻辑。重构：拆成 OrderValidator、PriceCalculator、Notifier、OrderRepository，OrderService 只保留流程编排（它变成很薄的一层）。检验方法：试着用一句话描述这个类的职责，如果需要用「并且」就说明该拆了。" },
            { t: "开闭原则 OCP", d: "违反：checkout 方法里 switch (payType) 有九个分支，加一种支付方式必须改它。重构：抽出 Payment 策略接口 + 注册表工厂，业务方法只写 PaymentFactory.of(type).pay(amount)；新增方式 = 新增一个类 + 注册一行，老代码零修改。下一个方块的代码就是这条的完整演示。" },
            { t: "里氏替换 LSP", d: "违反：Square extends Rectangle，但 setWidth 必须同时改高，于是「长方形面积 = 宽 × 高」的推理在子类上失效——这就是典型的「为了复用继承」。重构：不要用继承表达数学上的特例，让 Square 与 Rectangle 都实现 Shape 接口各自提供 area()。检验方法：任何使用父类的地方替换成子类，程序行为是否仍然正确。" },
            { t: "接口隔离 ISP", d: "违反：一个 Machine 接口里塞了 print、scan、fax，简单打印机只能对 scan 抛 UnsupportedOperationException（客户端被迫依赖它不需要的方法）。重构：拆成 Printer、Scanner、Fax 三个小接口，多功能机同时实现多个，普通打印机只实现 Printer。" },
            { t: "依赖倒置 DIP", d: "违反：UserService 里直接 new MySQLUserRepository()、方法签名里出现 HttpServletRequest。重构：定义 UserRepository 接口，UserService 通过构造器接收接口类型（构造器注入），具体实现与框架细节只出现在最外层的 main／配置里。好处：单元测试可以注入内存版实现，不用起数据库。" },
            { t: "组合优于继承", d: "违反：为了复用「打日志」能力让 OrderService extends Logger。重构：把 Logger 作为字段持有（has-a），需要对外表现某种能力时实现对应接口。继承只用于表达 is-a，复用实现优先用组合与委托。" },
            { t: "每次重构都要能回答", d: "改动前后各问一次：这次隔离了哪个变化点？下次同类需求我要碰几个文件？如果答案是「还是要碰三个文件」，说明抽象没做对，只是把代码搬了个家。" }
          ]
        },
        {
          type: "code",
          lang: "java",
          title: "完整例子：把 switch 改造成策略 + 工厂（违反 OCP -> 遵守 OCP）",
          code: "// 保存为 CheckoutDemo.java，真机运行：javac -encoding UTF-8 CheckoutDemo.java    然后    java CheckoutDemo\n// 预期输出（5 行）：\n// [改造前] 微信支付 100 元\n// [改造前] 支付宝支付 100 元\n// [改造前] 未知支付方式 -> 抛异常\n// [改造后] 微信支付 100 元\n// [改造后] 积分支付 100 元（新增方式没有改一行老代码）\n\nimport java.util.HashMap;\nimport java.util.Map;\n\n// ============ 改造前：分支堆在一个方法里，新增一种支付方式必须改这个方法 ============\nclass BadCheckout {\n    static void pay(String type, int amount) {\n        switch (type) {\n            case \"wechat\": System.out.println(\"[改造前] 微信支付 \" + amount + \" 元\"); break;\n            case \"alipay\": System.out.println(\"[改造前] 支付宝支付 \" + amount + \" 元\"); break;\n            default: throw new IllegalArgumentException(\"未知支付方式: \" + type);\n        }\n    }\n}\n\n// ============ 改造后：策略接口 + 注册表工厂 ============\n@FunctionalInterface\ninterface Payment {                       // 策略接口：把「怎么支付」这件可变的事抽出来\n    void pay(int amount);\n}\n\nclass WechatPay implements Payment {\n    @Override public void pay(int amount) { System.out.println(\"[改造后] 微信支付 \" + amount + \" 元\"); }\n}\n\nclass Alipay implements Payment {\n    @Override public void pay(int amount) { System.out.println(\"[改造后] 支付宝支付 \" + amount + \" 元\"); }\n}\n\nclass PointPay implements Payment {       // 新增方式：只加这一个类，下面业务代码一个字都不改\n    @Override public void pay(int amount) { System.out.println(\"[改造后] 积分支付 \" + amount + \" 元\"); }\n}\n\nclass PaymentFactory {                    // 简单工厂 / 注册表：把「选哪个实现」集中到一处\n    private static final Map<String, Payment> REGISTRY = new HashMap<>();\n    static void register(String type, Payment p) { REGISTRY.put(type, p); }\n    static Payment of(String type) {\n        Payment p = REGISTRY.get(type);\n        if (p == null) throw new IllegalArgumentException(\"未知支付方式: \" + type);\n        return p;\n    }\n}\n\npublic class CheckoutDemo {\n    static void checkout(String type, int amount) {   // 业务方法只依赖抽象，永远不用改\n        PaymentFactory.of(type).pay(amount);\n    }\n\n    public static void main(String[] args) {\n        BadCheckout.pay(\"wechat\", 100);\n        BadCheckout.pay(\"alipay\", 100);\n        try {\n            BadCheckout.pay(\"point\", 100);            // 老代码不认识新方式\n        } catch (IllegalArgumentException e) {\n            System.out.println(\"[改造前] 未知支付方式 -> 抛异常\");\n        }\n\n        PaymentFactory.register(\"wechat\", new WechatPay());\n        PaymentFactory.register(\"alipay\", new Alipay());\n        PaymentFactory.register(\"point\", new PointPay());\n        checkout(\"wechat\", 100);\n        checkout(\"point\", 100);\n    }\n}"
        },
        {
          type: "code",
          lang: "java",
          title: "完整例子：单例（singleton，一个类在程序里只允许存在一个实例对象）的五种写法与线程安全",
          code: "// 保存为 SingletonDemo.java，真机运行：javac -encoding UTF-8 SingletonDemo.java    然后    java SingletonDemo\n// 预期输出（5 行）：\n// 饿汉式：同一个实例 true\n// 静态内部类：同一个实例 true\n// 枚举：同一个实例 true\n// 双重检查：8 个线程拿到同一个实例 true，构造次数 1\n// 枚举单例还可以带方法：枚举单例\n\nimport java.util.concurrent.atomic.AtomicInteger;\n\npublic class SingletonDemo {\n\n    // 写法 1 饿汉式：类加载时就创建。简单、天生线程安全；代价是没用到也会占用内存\n    static class Eager {\n        private static final Eager INSTANCE = new Eager();\n        private Eager() { }\n        static Eager getInstance() { return INSTANCE; }\n    }\n\n    // 写法 2 懒汉式（非线程安全，反面教材）：两个线程可能都通过 null 检查\n    static class UnsafeLazy {\n        private static UnsafeLazy instance;\n        private UnsafeLazy() { }\n        static UnsafeLazy getInstance() {\n            if (instance == null) instance = new UnsafeLazy();   // 竞态窗口就在这里\n            return instance;\n        }\n    }\n    // 写法 3 给 getInstance 加 synchronized：修好了，但每次读都要抢锁，读多写少时是浪费\n\n    // 写法 4 双重检查锁定（DCL）：只在第一次创建时加锁\n    static class Dcl {\n        private static volatile Dcl instance;   // volatile 必不可少：禁止「先发布引用、后完成构造」的重排序\n        static final AtomicInteger CREATED = new AtomicInteger();\n        private Dcl() { CREATED.incrementAndGet(); }\n        static Dcl getInstance() {\n            if (instance == null) {             // 第一次检查：无锁快速路径\n                synchronized (Dcl.class) {\n                    if (instance == null) {     // 第二次检查：拿到锁后重新确认\n                        instance = new Dcl();\n                    }\n                }\n            }\n            return instance;\n        }\n    }\n\n    // 写法 5 静态内部类（推荐）：懒加载 + 线程安全，靠 JVM 的类初始化锁保证，不需要 volatile\n    static class Holder {\n        private Holder() { }\n        private static class Inner { static final Holder INSTANCE = new Holder(); }\n        static Holder getInstance() { return Inner.INSTANCE; }\n    }\n\n    // 写法 6 枚举（最推荐）：天然单例，还能防反射与反序列化破坏\n    enum EnumSingleton {\n        INSTANCE;\n        String hello() { return \"枚举单例\"; }\n    }\n\n    public static void main(String[] args) throws InterruptedException {\n        System.out.println(\"饿汉式：同一个实例 \" + (Eager.getInstance() == Eager.getInstance()));\n        System.out.println(\"静态内部类：同一个实例 \" + (Holder.getInstance() == Holder.getInstance()));\n        System.out.println(\"枚举：同一个实例 \" + (EnumSingleton.INSTANCE == EnumSingleton.INSTANCE));\n\n        Runnable r = Dcl::getInstance;\n        Thread[] ts = new Thread[8];\n        for (int i = 0; i < ts.length; i++) { ts[i] = new Thread(r); ts[i].start(); }\n        for (Thread t : ts) t.join();\n        System.out.println(\"双重检查：8 个线程拿到同一个实例 \" + (Dcl.getInstance() == Dcl.getInstance())\n                + \"，构造次数 \" + Dcl.CREATED.get());\n        System.out.println(\"枚举单例还可以带方法：\" + EnumSingleton.INSTANCE.hello());\n    }\n}"
        },
        {
          type: "concept",
          title: "UML 与代码的对应关系、设计模式速查、单元测试入门",
          md: "UML（Unified Modeling Language，统一建模语言：用一套标准图形描述类与类之间的关系，本课只看其中的类图）类图不是画着好看的文档，它与代码之间是可以逐项对照翻译的：\n\n| UML 元素 | 代码里的对应物 |\n| 类框分三栏（类名／属性／方法） | class 声明；字段；方法签名；可见性用 + public、- private、# protected 表示 |\n| 关联（普通实线，可带箭头） | 一个类持有另一个类的字段（引用） |\n| 聚合（空心菱形） | 整体与部分可独立存在：字段是 List<Part>，Part 由外部创建后传进来 |\n| 组合（实心菱形） | 部分随整体同生共死：在构造器里自己创建，外部拿不到 |\n| 继承（实线 + 空心三角） | extends |\n| 实现（虚线 + 空心三角） | implements |\n| 依赖（虚线箭头） | 只出现在方法参数、局部变量、返回值里，不持有为字段 |\n| 多重性 1、0..1、1..* | 单个字段、可空字段、List 或数组 |\n\n读图练习法：拿一份自己的代码，逐行判断「这一行在图上是什么」，画完再反过来照着图检查代码有没有多余依赖——这一步能发现大量「本该是依赖却写成了关联」的隐式耦合。\n\n常用设计模式（design pattern，指的是前人从大量项目里总结出来、可以反复套用的设计套路，每个模式都在解决一类反复出现的问题）速查（重点看「解决什么问题」和「代价」）：\n\n| 模式 | 解决的问题 | JDK 里的例子 | 代价 |\n| 工厂方法 | 把「创建哪个实现」从业务代码里挪走 | Executors.newFixedThreadPool、Calendar.getInstance | 多一层间接，断点要多跳一次 |\n| 单例 | 全局唯一实例 | Runtime.getRuntime()、枚举单例 | 全局可变状态，难测试；能用依赖注入就别用单例 |\n| 策略 | 把可替换的算法从 if-else 里抽出来 | Comparator、上一个方块的 Payment | 类数量增加 |\n| 观察者 | 一对多通知，发布者不认识订阅者 | 事件监听器、Spring 的 ApplicationEvent | 通知顺序与异常处理要额外设计 |\n| 适配器 | 让不兼容的接口能一起工作 | InputStreamReader（字节流适配成字符流）、Arrays.asList | 多一层对象，调试时类型变复杂 |\n| 装饰器 | 动态叠加能力，替代子类爆炸 | BufferedInputStream、Collections.unmodifiableList | 包装层次多，instanceof 判断会失效 |\n\n单元测试入门（JUnit 5）：\n\n| 注解／概念 | 作用 |\n| @Test | 标记一个测试方法（JUnit 5 不要求 public） |\n| @BeforeEach / @AfterEach | 每个测试方法执行前后各一次，用来准备与清理 |\n| @BeforeAll / @AfterAll | 静态方法，整个测试类前后各一次 |\n| @DisplayName | 给测试起一个人能读的名字 |\n| assertEquals / assertTrue / assertThrows / assertAll | 断言相等、为真、抛指定异常、分组断言 |\n| 测试替身 | stub（返回预设值）、fake（简化实现，如内存版仓库）、mock（校验调用行为）、spy（部分真实） |\n\n三条实践准则：一个测试只验证一个行为；测试名写清「在什么条件下、期望什么」；测试不依赖执行顺序、不依赖真实数据库与网络。写不出测试，往往说明这个类的依赖太硬——这正是 DIP 要解决的问题。"
        },
        {
          type: "code",
          lang: "python",
          title: "Python 对照：观察者、装饰器与测试替身",
          code: "# python3 design.py\n# 预期输出（6 行）：\n# 邮件通知: 订单 1001 已创建\n# 短信通知: 订单 1001 已创建\n# 邮件通知: 订单 1002 已创建\n# （已记录日志）\n# 折扣价: 90.0\n# 测试通过: 3 个\n\nimport unittest\nfrom unittest.mock import Mock\n\n\n# 1) 观察者模式：主题只认识「可调用对象」，不认识具体订阅者\nclass OrderService:\n    def __init__(self):\n        self._observers = []\n\n    def subscribe(self, observer):\n        self._observers.append(observer)\n\n    def create(self, order_id):\n        for obs in self._observers:\n            obs(order_id)             # 回调：Python 里函数本身就是一等对象，不需要包装类\n\n\ndef email_notifier(order_id):\n    print('邮件通知: 订单', order_id, '已创建')\n\n\ndef sms_notifier(order_id):\n    print('短信通知: 订单', order_id, '已创建')\n\n\nsvc = OrderService()\nsvc.subscribe(email_notifier)\nsvc.subscribe(sms_notifier)\nsvc.create(1001)\n\n\n# 2) 装饰器模式：Python 用 @ 语法直接支持「包装函数并叠加能力」\ndef with_log(func):\n    def wrapper(order_id):\n        func(order_id)\n        print('（已记录日志）')\n    return wrapper\n\n\nsvc2 = OrderService()\nsvc2.subscribe(with_log(email_notifier))   # 只给这一次订阅加了日志能力\nsvc2.create(1002)\n\n\n# 3) 策略模式：把可替换的算法写成参数\ndef no_discount(price):\n    return price\n\n\ndef vip_discount(price):\n    return price * 0.9\n\n\ndef checkout(price, strategy=no_discount):\n    return strategy(price)\n\n\nprint('折扣价:', checkout(100, vip_discount))\n\n\n# 4) 单元测试与测试替身：不用数据库、不用网络，直接替换依赖\nclass StubRepo:\n    def __init__(self):\n        self.saved = []\n\n    def save(self, order_id):          # stub：只记录，不做真实持久化\n        self.saved.append(order_id)\n\n\nclass OrderServiceTest(unittest.TestCase):\n    def test_create_notifies_all_observers(self):\n        repo = StubRepo()\n        svc = OrderService()\n        svc.subscribe(repo.save)\n        svc.create(2001)\n        self.assertEqual(repo.saved, [2001])\n\n    def test_vip_discount(self):\n        self.assertAlmostEqual(checkout(100, vip_discount), 90.0)\n\n    def test_mock_records_calls(self):\n        watcher = Mock()               # mock：不做事，只校验「被调用了、参数对不对」\n        svc = OrderService()\n        svc.subscribe(watcher)\n        svc.create(2002)\n        watcher.assert_called_once_with(2002)\n\n\nif __name__ == '__main__':\n    suite = unittest.TestLoader().loadTestsFromTestCase(OrderServiceTest)\n    result = unittest.TextTestRunner(verbosity=0).run(suite)\n    print('测试通过:', result.testsRun - len(result.failures) - len(result.errors), '个')"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "单步执行器：单例在多线程下被 new 了两次",
          config: {
            state: { "时刻": "初始", "线程 T1": "准备调用 getInstance()", "线程 T2": "准备调用 getInstance()", "静态字段 instance": "null", "已创建实例数": 0 },
            steps: [
              {
                desc: "第 1 步：无锁懒汉单例，instance 还是 null，两个线程同时进来",
                state: { "时刻": "T0", "线程 T1": "准备执行 if (instance == null)", "线程 T2": "准备执行 if (instance == null)", "静态字段 instance": "null", "已创建实例数": 0 },
                note: "getInstance() 里的「检查 + 创建 + 赋值」三步不是原子操作，这就是漏洞所在。"
              },
              {
                desc: "第 2 步：T1 判断 instance == null 成立，准备创建",
                state: { "时刻": "T1", "线程 T1": "判断成立：instance 是 null", "线程 T2": "尚未执行判断", "静态字段 instance": "null", "已创建实例数": 0 },
                note: "此刻 T1 只是「决定要创建」，还没有真正把对象写回去。"
              },
              {
                desc: "第 3 步：时间片切换，T2 也判断 instance == null 成立",
                state: { "时刻": "T2", "线程 T1": "被挂起", "线程 T2": "判断成立：instance 仍是 null", "静态字段 instance": "null", "已创建实例数": 0 },
                note: "T1 还没写回，所以 T2 看到的还是 null。两个线程都认为自己该创建实例——竞态窗口形成。"
              },
              {
                desc: "第 4 步：T1 创建对象 A 并写回 instance",
                state: { "时刻": "T3", "线程 T1": "instance = new Singleton()（对象 A）", "线程 T2": "已通过判断，准备创建", "静态字段 instance": "对象 A", "已创建实例数": 1 },
                note: "如果程序在这里结束，一切看起来都正常——所以这个 bug 在测试环境极难复现。"
              },
              {
                desc: "第 5 步：T2 创建对象 B 并覆盖 instance",
                state: { "时刻": "T4", "线程 T1": "已经拿着对象 A 继续干活", "线程 T2": "instance = new Singleton()（对象 B）", "静态字段 instance": "对象 B（对象 A 被丢弃）", "已创建实例数": 2 },
                note: "单例被破坏：T1 用 A、后来的线程用 B。配置读了两份、缓存各存一份、计数器对不上——这类问题极难排查。"
              },
              {
                desc: "第 6 步：最粗暴的修复 —— 给整个方法加 synchronized",
                state: { "时刻": "T5", "线程 T1": "拿到类锁，执行判断与创建", "线程 T2": "BLOCKED，等锁", "静态字段 instance": "对象 A（只创建 1 次）", "已创建实例数": 1 },
                note: "正确但低效：每一次 getInstance() 都要抢锁，即使实例早就创建好了。读多写少时这是明显的浪费。"
              },
              {
                desc: "第 7 步：双重检查锁定（DCL）—— 只在第一次创建时加锁",
                state: { "时刻": "T6", "线程 T1": "第一次检查为 null -> 加锁 -> 第二次检查 -> 创建", "线程 T2": "第一次检查时已非 null，直接返回，完全不进锁", "静态字段 instance": "对象 A", "已创建实例数": 1 },
                note: "两次检查缺一不可：外层检查保证性能（大多数调用不进锁），内层检查保证正确（等锁期间别人可能已经创建好了）。"
              },
              {
                desc: "第 8 步：DCL 必须给 instance 加 volatile",
                state: { "时刻": "T7", "线程 T1": "instance = new Dcl() 分为三步：分配内存 -> 初始化 -> 赋引用", "线程 T2": "可能看到「已赋引用但尚未初始化」的对象", "静态字段 instance": "volatile 禁止这种重排序", "已创建实例数": 1 },
                note: "没有 volatile 时，JIT 或 CPU 可能把「赋引用」提前到「初始化」之前，于是另一个线程拿到一个半成品对象（字段全是 0/null）。这就是著名的 DCL 失效问题。"
              },
              {
                desc: "第 9 步：更省心的两种写法",
                state: { "时刻": "T8", "线程 T1": "静态内部类：靠 JVM 类初始化锁保证，天然懒加载 + 线程安全", "线程 T2": "枚举单例：天然单例，还能防反射与反序列化破坏", "静态字段 instance": "不再需要手写同步代码", "已创建实例数": 1 },
                note: "结论：单例的推荐写法是枚举（最稳）或静态内部类（最直观）；DCL 只在你需要读懂老代码时用得上。另外单例本身是全局可变状态，能用依赖注入替代就别用单例。"
              }
            ],
            tasks: [
              "把上面 9 步画成时序图（两条竖线代表两个线程），标出竞态窗口发生在哪两步之间。",
              "在真机上把 SingletonDemo 的 Dcl 去掉 volatile，跑 100 次统计构造次数是否出现过 2（可能不出现，说明这类 bug 的隐蔽性）。",
              "把 UnsafeLazy 换成 Holder 写法，说明为什么它连 volatile 都不需要。"
            ]
          }
        },
        {
          type: "calc",
          title: "手算演练：装饰器省下了多少个子类",
          inputs: [
            { name: "需求", value: "输入流需要 4 种可选能力：缓冲 B、类型解析 D、字符解码 C、按行读 L" },
            { name: "方案 A", value: "用继承为每种能力组合各写一个类（组合顺序固定）" },
            { name: "方案 B", value: "用装饰器：1 个基础实现 + 每种能力 1 个装饰器类" },
            { name: "参考案例", value: "支付 3 种方式 × 3 种渠道，改造前在一个方法里写 9 个分支" }
          ],
          outputs: [
            "方案 A：4 种能力取任意子集共有 $2^4 = 16$ 种组合，因此需要 16 个子类（每种组合一个类），新增第 5 种能力就变成 32 个，翻倍增长",
            "方案 B：只需要 $1 + 4 = 5$ 个类（1 个基础实现 + 4 个装饰器类），就能组合出全部 16 种行为；新增第 5 种能力只需加 1 个类（5 -> 6）",
            "若还要求嵌套顺序可变（先缓冲还是先解码），可能的装饰链有 $1 + 4 + 12 + 24 + 24 = 65$ 种（其中非空链 64 种）；方案 A 要写 64 个子类，方案 B 仍然是那 5 个类",
            "通用公式：n 种可选能力，继承方案需要 $2^n$ 个子类，装饰器方案只需要 $n + 1$ 个类；这就是「子类爆炸」与「组合优于继承」的量化依据",
            "支付案例：违反 OCP 时是 1 个类里的 $3 \\times 3 = 9$ 个分支，加一种支付方式要改这个类并新增 3 个分支",
            "支付案例重构后：$3 + 1 + 1 = 5$ 个类（3 个策略类 + 1 个注册表工厂 + 1 个编排类）；新增一种支付方式只需加 1 个类、修改 0 处老代码",
            "结论：类数量不是越少越好，真正要优化的是「一次需求变动需要碰几个文件」；装饰器/策略用更多小类换来了更少的修改触点"
          ],
          note: "追问：装饰器方案也不是没有代价——对象被套了多层，调试时调用栈变深，instanceof 判断会失效（拿到的可能是包装类而不是原始类型）。所以只有在「能力需要自由组合」时才用它，固定的一两个变体直接写死更清楚。"
        },
        {
          type: "lab",
          title: "上机：从需求到类的完整设计（图书借阅系统，约 90 分钟）",
          steps: [
            { t: "第 1 步 读需求，圈名词与动词", d: "需求：读者可以借书与还书；同一本书同一时刻只能被一个读者借走；借期 30 天，超期每天罚 0.5 元；会员超期免罚金。把名词圈出来（读者、图书、借阅记录、罚金规则），动词圈出来（借、还、算罚金、判断是否可借）。" },
            { t: "第 2 步 名词变类，动词变方法", d: "候选类：Book（isbn、title、是否在架上）、Reader（id、name、是否会员）、Loan（book、reader、borrowDate、dueDate、returnDate）、LoanService（borrow／return）、FinePolicy（接口：算罚金）。合并同义概念，删掉不该成为类的名词。" },
            { t: "第 3 步 画 UML 类图", d: "确定关系：Loan 与 Book、Reader 是关联（持有引用）；LoanService 依赖 BookRepository（接口，虚线依赖）；StandardFinePolicy 与 VipFinePolicy 实现 FinePolicy（虚线空心三角）；LoanService 组合一个 FinePolicy（实心菱形）。标出多重性：一个 Reader 对应 0..* 个 Loan。" },
            { t: "第 4 步 翻译成 Java 骨架", d: "先写接口与字段，方法体先用 return 0 / throw new UnsupportedOperationException() 占位；确认能编译。此时类图与代码应当能逐项对上（每个字段在图上都能找到，每个箭头在代码里都有对应写法）。" },
            { t: "第 5 步 写 JUnit 5 测试固定规则", d: "用 @BeforeEach 建一个内存版 BookRepository（测试替身 fake）；写三条 @Test：同一本书不能借两次（assertThrows 期望 IllegalStateException）、超期 3 天罚金 1.5 元（assertEquals）、未超期罚金 0 元；再加一条会员超期罚金 0 元。" },
            { t: "第 6 步 测试驱动重构", d: "把罚金计算从 LoanService 里抽成 FinePolicy 接口（OCP + DIP），加一种「员工免罚金」策略时只加一个类，一行老代码都不改——用测试保证重构没改变行为。" },
            { t: "第 7 步 自查与提交", d: "检查清单：测试全绿；每个类能用一句话说出「它只因为什么而改变」（SRP 检验）；依赖方向都指向抽象；新增一个罚金策略要改几个文件（答案应该是 0 个旧文件 + 1 个新文件）。" }
          ],
          note: "如果时间不够，只做第 1~5 步也能拿到大部分收获：圈名词动词、画图、写测试这三件事，恰恰是学生作业里最常被跳过、也最能拉开差距的三步。"
        }
      ],
      quiz: [
        {
          id: "oop-design-practice-q1",
          type: "single",
          q: "下面哪种做法最符合开闭原则（OCP）的落地要求？",
          options: [
            "把所有可能的业务规则都提前抽象成接口，即使现在只有一种实现",
            "把按类型分支的 switch 换成策略接口加注册表工厂，新增类型时只添加新类而不修改已有代码",
            "把 switch 语句拆成多个更小的 switch 分散到不同方法里",
            "给方法加上 final 关键字，禁止别人修改这个方法的逻辑"
          ],
          answer: 1,
          why: "B 对：开闭原则的核心是「扩展靠新增，修改不碰老代码」，策略加工厂把选择的逻辑集中到注册表，新增一种类型只加一个类。A 是过度设计——为想象中的变化提前抽象，比重复代码更贵。C 只是把同一个变化点摊开，新增类型时仍然要改所有小 switch。D 与开闭原则无关，final 只是禁止重写，反而降低了扩展性。"
        },
        {
          id: "oop-design-practice-q2",
          type: "single",
          q: "下面的懒汉单例在多线程下有 bug：\nclass S {\n  private static S instance;\n  static int count = 0;\n  private S() { count++; }\n  static S get() { if (instance == null) instance = new S(); return instance; }\n}\n两个线程同时第一次调用 S.get()，最终 count 的值可能是？",
          options: [
            "一定是 1",
            "一定是 2",
            "可能是 1，也可能是 2",
            "编译错误：静态方法不能访问静态字段"
          ],
          answer: 2,
          why: "答案是「可能是 1，也可能是 2」。两个线程都可能通过 instance == null 检查，于是各自 new 一个对象，构造器执行两次；如果时间片切换恰好发生在检查与赋值之间，就会创建两个实例，单例被破坏。修复方式有：整个方法加 synchronized（正确但每次都要抢锁）、双重检查锁定（instance 必须 volatile，否则可能拿到未初始化完的对象）、静态内部类（靠 JVM 类初始化锁）、枚举（最简洁且能防反射与反序列化）。D 是虚构的错误，静态方法访问静态字段完全合法。"
        },
        {
          id: "oop-design-practice-q3",
          type: "fill",
          q: "在 Java 中，实现单例最简洁、并且天然能防住反射与反序列化破坏的写法是使用 ____ 类型（填一个 Java 关键字）。",
          answer: ["enum", "枚举"],
          why: "答案是 enum。枚举实例由 JVM 在类初始化时创建，天生唯一且线程安全；反射无法调用它的私有构造器（Constructor.newInstance 对枚举会直接抛异常），反序列化也只会返回同一个实例。相比之下，饿汉式怕反射、静态内部类怕反射与反序列化，双重检查锁定还要小心 volatile 与重排序。注意枚举单例的代价：它是立即加载（不是懒加载），并且继承自 Enum 不能再继承别的类。"
        },
        {
          id: "oop-design-practice-q4",
          type: "order",
          q: "把「从需求到类的设计过程」排成正确的先后顺序",
          items: [
            "从需求里圈出名词与动词：名词作为类的候选，动词作为方法的候选",
            "合并同义概念、删掉不该成为类的名词，确定每个类的单一职责",
            "画出 UML 类图：确定关联、继承、实现、依赖关系与多重性，并标明依赖方向",
            "把类图翻译成 Java 骨架：接口、字段、方法签名，方法体先留空占位",
            "写 JUnit 测试固定行为（含正常与异常路径），再补实现并重构到测试全绿"
          ],
          answer: [0, 1, 2, 3, 4],
          why: "顺序是：找候选概念 -> 收敛职责 -> 画关系图 -> 落成代码骨架 -> 用测试固定行为再补实现。两个容易搞反的地方：先画图再想职责（应该在画图前就把职责收敛好，否则图上会出现一个包办一切的上帝类）；先写实现再补测试（应该先用测试固定规则，重构时才有安全网，这也正是第 5 步放在实现之前的原因）。"
        }
      ]
    }
  ]
});
