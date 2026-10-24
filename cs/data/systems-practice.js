window.COURSE_PACKS.push({
  id: "systems-practice",
  title: "系统能力实战项目",
  icon: "🛠️",
  term: "大三下~大四（实践课）",
  advanced: {texts:["《深入理解计算机系统》第 8~10 章（并发与 I/O）","《UNIX 环境高级编程》APUE（查手册用）"],labs:["把课程里的迷你项目逐个改造成「能跑真实负载」的版本","用 valgrind/ASan/perf 做一次完整性能与内存剖析"],project:"任选一个做到生产级：shell（含作业控制）、内存分配器（过 CSAPP trace）、HTTP 服务器（过 ab/wrk 压测）",criteria:"项目有测试、有 README、有性能数据；能被别人 clone 下来一次跑通"},
  need: "建议先学完「程序设计基础」「操作系统」；本课的六个项目都要自己写代码（C 或 Python）。",
  hours: 48,
  blurb: "把操作系统、组成原理、网络、编译的知识变成能跑起来的代码：六课六个可交付小项目——迷你 shell、堆分配器、调度模拟器、Cache 模拟器与矩阵优化、TCP/HTTP 服务器、迷你语言解释器。每课都走完「需求 → 关键设计 → 核心代码 → 测试方法 → 延伸挑战」，验收标准写成可执行的测试，而不是「看起来对了」。",
  tags: ["系统方向核心", "项目制", "动手写代码", "需要 Linux 环境"],
  lessons: [
{
  id: "sp-shell",
  title: "项目一：写一个迷你 shell",
  goal: "能用 C 写出一个支持管道、重定向、内建命令与 Ctrl-C 处理的迷你 shell，并说清 fork/exec/wait 三件套的分工、为什么必须处理僵尸进程、以及前台进程组与信号的关系。",
  est: 55,
  blocks: [
    {
      type: "concept",
      title: "shell 到底做了什么：把一行文本变成一串进程",
      md: "你每天敲的 ls -l | grep .c > out.txt 背后是一条固定的流水线：**读入一行 → 词法切分 → 解析出管道与重定向结构 → 创建进程 → 在子进程里装载程序 → 父进程等待 → 回收退出状态**。shell 自己不做 ls 的活，它只负责「造进程」和「接管道」。\n\n**为什么 fork 与 exec 要分成两步**：如果只有一个「创建并运行新程序」的调用，父进程就没机会在装载之前修改子进程的状态。拆成两步后，两次调用之间可以做很多事：dup2() 把管道接到标准输入输出上、关闭不需要的文件描述符（file descriptor，fd）、设置进程组、切换工作目录。POSIX 里本来也有 posix_spawn() 这种一步到位的接口，但管道与重定向的实现几乎都要靠 fork + dup2 的组合。\n\n**为什么必须有 wait**：子进程结束后，内核要保留它的退出状态（exit status）等父进程来取。这段「已经死了但还没被收尸」的状态叫**僵尸进程（zombie）**。僵尸不占内存页，但占一个进程表项（task struct + pid），长跑的 shell 或服务器如果不 wait，迟早把 pid 耗尽。\n\n**只用 fork/exec/wait 就能写出 shell 吗**：能，但少了四件让 shell 变得好用的东西——内建命令（必须改父进程自己的状态，不能放子进程）、管道、重定向、以及终端的作业控制（job control）。本项目就是把这四件事一件件补上。"
    },
    {
      type: "steps",
      title: "实现顺序：从「只能跑一条命令」到「管道 + 重定向 + 内建命令」",
      items: [
        { t: "第 1 步：读一行（readline）", d: "用 fgets 或 getline 读入，处理行尾的 \\n，并处理 EOF（Ctrl-D）。学生最常在这里翻车：忘了 EOF 检查会变成死循环，while(1) 里疯狂刷提示符。要点：scanf 读字符串遇空格即停，不适合解析命令行，请用 fgets。" },
        { t: "第 2 步：切分与内建命令分流", d: "按空格切出 argv；先判断是不是内建命令（cd / exit / pwd），是则直接在当前进程执行并 continue，绝不 fork。原因：子进程 cd 只改子进程自己的工作目录，父 shell 的位置不变，用户会看到「cd 没生效」。" },
        { t: "第 3 步：fork + exec + wait 跑通单条外部命令", d: "fork 返回 0 是子进程、大于 0 是父进程（返回值就是子进程 pid）、小于 0 是失败。子进程调用 execvp(file, argv)，返回就意味着装载失败，必须 perror 后 _exit(127)。父进程 waitpid 取状态。" },
        { t: "第 4 步：接管道", d: "n 条命令需要 n-1 个管道，且一定要在 fork 之前把所有管道都创建好，否则后面的子进程拿不到前面的读端。子进程里用 dup2 把前一管道读端接到 fd 0、后一管道写端接到 fd 1，然后关掉全部原始 fd。父进程也必须关掉管道两端，否则读端永远不会收到 EOF。" },
        { t: "第 5 步：加重定向", d: "解析 > 与 <，把它们前后切开，open 出 fd 后用 dup2 覆盖 1 或 0。注意 open 失败要报错并跳过该命令。重定向在管道接好之后再 dup2 会互相覆盖，正确顺序是：先接管道，再用重定向覆盖管道端（cmd1 > f | cmd2 这种反直觉写法在真 shell 里行为也一样，可以自己验证）。" },
        { t: "第 6 步：Ctrl-C 与前台进程组", d: "shell 启动时把 SIGINT、SIGQUIT 设为忽略（SIG_IGN），否则 Ctrl-C 会把 shell 自己一起杀掉。这样终端产生的 SIGINT 只会送到前台进程组，子进程照常被终止。想更完整就实现作业控制：把子进程放进新进程组再用 tcsetpgrp 交给终端。" },
        { t: "编译与常见报错", d: "gcc -Wall -Wextra -O0 -g -o minishell minishell.c。常见错误：implicit declaration of fork → 缺 #include <unistd.h>；undefined reference to execvp → 也是缺 unistd.h；warning: implicit declaration of strtok → 缺 <string.h>；undefined reference to pow → 忘了 -lm；段错误首选 gcc -g 后用 gdb/valgrind 定位。" },
        { t: "运行期常见错误", d: "「管道只输出一半就卡住」几乎总是父进程忘了关闭管道写端；「提示符重复出现」是子进程执行完 exec 失败后没有退出，又回到了循环；「grep 之后 shell 立刻退出」是读循环没处理 fgets 的 NULL。" }
      ]
    },
    {
      type: "code",
      lang: "c",
      title: "迷你 shell 完整实现（单文件，可编译运行）",
      code: "/* minishell.c —— 迷你 shell：内建命令 + 管道 + 重定向 + Ctrl-C 处理\n * 编译: gcc -Wall -Wextra -O0 -g -o minishell minishell.c\n * 运行: ./minishell\n * 支持: ls -l | grep .c | wc -l        echo hi > out.txt        cd /tmp        exit\n */\n#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <unistd.h>\n#include <fcntl.h>\n#include <signal.h>\n#include <sys/wait.h>\n#include <sys/types.h>\n\n#define MAX_CMD  16    /* 一条管道最多 16 段命令 */\n#define MAX_ARG  64    /* 每段命令最多 64 个参数 */\n#define MAX_LINE 1024\n\n/* 一段命令: argv[0] 是程序名, 以 NULL 结尾 */\ntypedef struct {\n    char *argv[MAX_ARG];\n    char *infile;    /* < 的文件名, 没有则 NULL */\n    char *outfile;   /* > 的文件名, 没有则 NULL */\n} cmd_t;\n\n/* 内建命令必须在父进程里执行: cd 改的是当前进程的工作目录 */\nstatic int is_builtin(const char *name)\n{\n    return strcmp(name, \"cd\") == 0 ||\n           strcmp(name, \"exit\") == 0 ||\n           strcmp(name, \"pwd\") == 0;\n}\n\nstatic int run_builtin(cmd_t *c)\n{\n    if (strcmp(c->argv[0], \"exit\") == 0) return 0;              /* 返回 0 = 结束 shell */\n    if (strcmp(c->argv[0], \"cd\") == 0) {\n        const char *dir = c->argv[1] ? c->argv[1] : getenv(\"HOME\");\n        if (!dir || chdir(dir) != 0) perror(\"cd\");\n        return 1;\n    }\n    if (strcmp(c->argv[0], \"pwd\") == 0) {\n        char buf[1024];\n        if (getcwd(buf, sizeof(buf))) printf(\"%s\\n\", buf);\n        else perror(\"pwd\");\n        return 1;\n    }\n    return 1;\n}\n\n/* Ctrl-C 产生的 SIGINT 只应杀死前台子进程, 不能杀掉 shell 自己 */\nstatic void setup_signals(void)\n{\n    struct sigaction sa;\n    memset(&sa, 0, sizeof(sa));\n    sa.sa_handler = SIG_IGN;\n    sigemptyset(&sa.sa_mask);\n    sa.sa_flags = 0;\n    sigaction(SIGINT,  &sa, NULL);\n    sigaction(SIGQUIT, &sa, NULL);\n}\n\n/* 把一行切成若干段命令, 识别 | > < ; 返回段数, 失败返回 -1 */\nstatic int parse_line(char *line, cmd_t cmds[])\n{\n    int ncmd = 0;\n    char *save1 = NULL, *seg = NULL;\n\n    for (int i = 0; i < MAX_CMD; i++) {          /* 先把结构清零, 避免残留指针 */\n        cmds[i].infile = NULL;\n        cmds[i].outfile = NULL;\n        for (int j = 0; j < MAX_ARG; j++) cmds[i].argv[j] = NULL;\n    }\n\n    seg = strtok_r(line, \"|\", &save1);\n    while (seg != NULL && ncmd < MAX_CMD) {\n        cmd_t *c = &cmds[ncmd];\n        int argc = 0;\n        char *save2 = NULL;\n        char *tok = strtok_r(seg, \" \\t\\n\", &save2);\n\n        while (tok != NULL && argc < MAX_ARG - 1) {\n            if (strcmp(tok, \">\") == 0 || strcmp(tok, \"<\") == 0) {\n                int is_out = (tok[0] == '>');\n                char *file = strtok_r(NULL, \" \\t\\n\", &save2);\n                if (file == NULL) { fprintf(stderr, \"语法错误: 重定向缺少文件名\\n\"); return -1; }\n                if (is_out) c->outfile = file; else c->infile = file;\n            } else {\n                c->argv[argc++] = tok;\n            }\n            tok = strtok_r(NULL, \" \\t\\n\", &save2);\n        }\n        c->argv[argc] = NULL;\n        if (argc > 0) ncmd++;\n        seg = strtok_r(NULL, \"|\", &save1);\n    }\n    return ncmd;\n}\n\n/* 执行一条管道; 返回最后一段命令的退出状态 */\nstatic int run_pipeline(cmd_t cmds[], int ncmd)\n{\n    int pipes[MAX_CMD - 1][2];\n    pid_t pids[MAX_CMD];\n\n    /* 关键: 先把所有管道建好, 再 fork */\n    for (int i = 0; i < ncmd - 1; i++) {\n        if (pipe(pipes[i]) < 0) { perror(\"pipe\"); return -1; }\n    }\n\n    for (int i = 0; i < ncmd; i++) {\n        pid_t pid = fork();\n        if (pid < 0) { perror(\"fork\"); return -1; }\n\n        if (pid == 0) {\n            /* ---- 子进程: 只做「摆好 fd」+ exec, 不碰父进程状态 ---- */\n            if (i > 0) {                       /* 上一段的写端 -> 本段标准输入 */\n                if (dup2(pipes[i - 1][0], STDIN_FILENO) < 0) { perror(\"dup2\"); _exit(1); }\n            }\n            if (i < ncmd - 1) {                /* 本段标准输出 -> 下一段的读端 */\n                if (dup2(pipes[i][1], STDOUT_FILENO) < 0) { perror(\"dup2\"); _exit(1); }\n            }\n            /* 重定向优先级最高, 放在管道之后覆盖 */\n            if (cmds[i].infile) {\n                int fd = open(cmds[i].infile, O_RDONLY);\n                if (fd < 0) { perror(cmds[i].infile); _exit(1); }\n                dup2(fd, STDIN_FILENO); close(fd);\n            }\n            if (cmds[i].outfile) {\n                int fd = open(cmds[i].outfile, O_WRONLY | O_CREAT | O_TRUNC, 0644);\n                if (fd < 0) { perror(cmds[i].outfile); _exit(1); }\n                dup2(fd, STDOUT_FILENO); close(fd);\n            }\n            for (int k = 0; k < ncmd - 1; k++) {   /* 关掉多余的 fd, 否则管道读端等不到 EOF */\n                close(pipes[k][0]);\n                close(pipes[k][1]);\n            }\n            execvp(cmds[i].argv[0], cmds[i].argv);\n            fprintf(stderr, \"%s: 命令未找到\\n\", cmds[i].argv[0]);\n            _exit(127);                        /* exec 返回 = 失败, 必须退出 */\n        }\n        pids[i] = pid;\n    }\n\n    /* ---- 父进程: 关掉自己的管道副本, 然后等待 ---- */\n    for (int i = 0; i < ncmd - 1; i++) {\n        close(pipes[i][0]);\n        close(pipes[i][1]);\n    }\n\n    int status = 0;\n    for (int i = 0; i < ncmd; i++) {\n        int st = 0;\n        waitpid(pids[i], &st, 0);              /* 不收尸就产生僵尸进程 */\n        if (i == ncmd - 1) status = st;\n    }\n    return status;\n}\n\nint main(void)\n{\n    char line[MAX_LINE];\n    cmd_t cmds[MAX_CMD];\n\n    setup_signals();\n    while (1) {\n        printf(\"minish> \");\n        fflush(stdout);\n        if (fgets(line, sizeof(line), stdin) == NULL) { printf(\"\\n\"); break; }  /* Ctrl-D 退出 */\n        if (line[0] == '\\n') continue;\n\n        int ncmd = parse_line(line, cmds);\n        if (ncmd <= 0) continue;\n\n        if (is_builtin(cmds[0].argv[0])) {     /* 内建命令不 fork */\n            if (run_builtin(&cmds[0]) == 0) break;\n            continue;\n        }\n        run_pipeline(cmds, ncmd);\n    }\n    return 0;\n}\n"
    },
    {
      type: "interactive",
      lab: "cpulab",
      title: "单步看 fork 之后父子进程各走哪条路",
      config: {
        regs: { R1: 4321, R2: 0 },
        mem: { "0x10": 3, "0x18": 1, "0x20": 0 },
        program: [
          { asm: "LOAD R1, [0x10] / 读入命令行字符数, 解析出 3 段命令: ls | grep .c | wc -l", note: "shell 先在父进程里把命令行解析成命令数组，此时还没有任何新进程。" },
          { asm: "MOV R2, 0 / R2 将接收 fork 的返回值：0 = 子进程，>0 = 子进程 pid", note: "记住：fork 一次调用、两个返回点，父子各自从下一条指令继续。" },
          { asm: "PUSH R1 / fork 系统调用：内核复制父进程的地址空间与 fd 表", note: "复制意味着父子各有一份变量副本，子进程改变量不会影响父进程——这是最重要的性质。" },
          { asm: "CMP R2, 0 / 子进程分支：dup2 接好管道后 execvp 装载 ls", note: "子进程里 exec 成功后代码段整体被替换，原来的 shell 代码不复存在。" },
          { asm: "JZ CHILD_PATH / 子进程路径：execvp 失败才继续往下走", note: "exec 返回只有一种含义：装载失败。此时必须 _exit，否则会跑回父进程的循环。" },
          { asm: "STORE R1, [0x20] / 父进程路径：记录子进程 pid，供 waitpid 使用", note: "父进程没被替换，继续执行 shell 的代码。" },
          { asm: "LOAD R1, [0x18] / waitpid(pid, &st, 0)：阻塞直到子进程结束并收尸", note: "waitpid 同时解决两件事：等待完成 + 回收进程表项（避免僵尸）。" },
          { asm: "HLT / 父进程回到提示符，等待下一行输入", note: "整个 shell 就是这三件事的无限循环：读入、造进程、收尸。" }
        ],
        legend: "把每一步和 minishell.c 的 run_pipeline 对照：fork 之前建好管道 → 子进程 dup2 → execvp → 父进程 close + waitpid。"
      }
    },
    {
      type: "calc",
      title: "算一算：一条 ls -l | grep .c | wc -l 发起多少次系统调用",
      inputs: [
        { name: "命令行", value: "ls -l | grep .c | wc -l，3 段命令、2 个管道" },
        { name: "每段命令的固定开销", value: "fork 1 次 + close 4 次（清掉 2 个管道的两端）+ dup2 2 次（接读写端）+ execve 1 次，共 8 次" },
        { name: "父进程额外开销", value: "pipe 2 次 + fork 3 次 + close 4 次 + waitpid 3 次，共 12 次" },
        { name: "命令本身的 I/O", value: "3 个程序各自的 open/read/write/close，约 60 次（与命令内容有关）" }
      ],
      outputs: [
        "shell 自身为这条管道发起的系统调用 $= 3 \\times 8 + 12 = 36$ 次",
        "加上命令自身的 I/O：$36 + 60 = 96$ 次，其中 shell 的调度类调用占 $\\frac{36}{96} = 37.5\\%$",
        "创建的进程数 = 3 个；管道数 = 2 个；临时 fd 峰值 $= 2 \\times 2\\,(\\text{父}) + 2 \\times 2\\,(\\text{子}) = 8$ 个",
        "若把 3 段拆成 3 条独立命令（不用管道），系统调用降到 $3 \\times 8 + 3 \\times 2 = 30$ 次，但中间结果要落盘，I/O 次数反而上升",
        "结论：管道的价值不是省系统调用，而是省「中间文件 + 额外的读写拷贝」，同时让 3 个程序真正并行"
      ],
      note: "这个估算说明：shell 的成本主要在进程创建（fork 3 次）与 fd 管理上。这也是为什么现代 shell 会在无管道、单命令时用 exec 直接替换自身（exec 优化），省掉一次 fork。"
    },
    {
      type: "code",
      lang: "bash",
      title: "验收脚本与观察命令（Linux）",
      code: "# ---------- 1. 编译并做基本功能验收 ----------\ngcc -Wall -Wextra -O0 -g -o minishell minishell.c && echo 编译通过\n\n./minishell <<'EOF'\necho hello world\nls -l | grep .c | wc -l\necho 重定向测试 > /tmp/ms_out.txt\ncat < /tmp/ms_out.txt\ncd /tmp\npwd\nexit\nEOF\n\n# ---------- 2. 检查僵尸进程: 另开一个终端连续执行 ----------\n# 在 minishell 里跑一条后台/长命令后立刻查看, 正常应看不到 Z 状态\nps -eo pid,ppid,stat,comm | grep -E 'Z|minishell'\n\n# ---------- 3. 检查 fd 泄漏: 反复跑管道, 观察 fd 数量是否稳定 ----------\npid=$(pgrep -n minishell)\nfor i in 1 2 3 4 5; do ls -l | grep .c | wc -l > /dev/null; done\nls -l /proc/$pid/fd | wc -l      # 反复执行后这个数字不应持续增长\n\n# ---------- 4. 观察系统调用与信号 ----------\nstrace -f -e trace=process,desc ./minishell <<'EOF'\nls -l | wc -l\nEOF\n# 观察输出里的 clone/fork、execve、pipe、dup2、close、wait4 顺序\n\n# 5. Ctrl-C 测试(交互式): 运行 sleep 100 后按 Ctrl-C,\n#    预期: sleep 被杀掉, minishell 继续存活并打印新提示符\n"
    },
    {
      type: "pitfall",
      title: "五个会真实咬人的坑",
      items: [
        "僵尸进程（zombie）：子进程结束后状态位一直保留到父进程 wait。写服务器时若 fork 后不 wait，ps 里会堆满 Z 状态进程，最终 pid 耗尽无法再创建进程。长跑服务要处理 SIGCHLD（注意信号可能合并，必须在循环里用 waitpid(-1, &st, WNOHANG) 直到返回 0）。",
        "fork 后父子各有一份变量：在子进程里 cd 或修改全局变量，父进程完全看不到。这正是 cd/exit 必须做成内建命令的原因；这也是为什么子进程里要立刻 exec 或 _exit，而不是 return——从 main 返回会把父进程的 stdio 缓冲区复制一份并再刷一次，输出会重复。",
        "管道卡死（hang）：父进程忘了关管道写端，或子进程在 dup2 之后没关原始 fd，导致 wc -l 永远等不到 EOF。判断口诀：读端只有在「所有写端都被关闭」时才会读到 0。",
        "信号处理位置错误：既不能在父进程里简单忽略所有信号（那样 Ctrl-C 连子进程也杀不掉），也不能不管（那样 Ctrl-C 会把 shell 一起终止）。正确做法是把 SIGINT 设为 SIG_IGN 让终端只杀前台进程组，或完整实现 tcsetpgrp 作业控制。",
        "段错误（segfault）的三个高频来源：argv 数组没有以 NULL 结尾导致 execvp 越界读；strtok 返回 NULL 后没检查就 strcmp；parse 出来的指针指向被下一次 fgets 覆盖的缓冲区（必须复制或每次重新解析）。用 gcc -g 加 gdb 的 bt 命令能立刻定位。"
      ]
    },
    {
      type: "lab",
      title: "上机：分四个里程碑交付迷你 shell",
      steps: [
        "里程碑 1（基础版）：实现读入 + 切分 + fork/exec/wait，能用绝对路径与 PATH 命令执行 ls -l、/bin/echo hi。验收：输入不存在的命令时打印「命令未找到」而不是崩溃。",
        "里程碑 2（内建命令）：加入 cd / exit / pwd，证明 cd 会真正改变父进程工作目录（cd /tmp 之后 pwd 输出 /tmp）。验收：cd /tmp 后 pwd 输出 /tmp。",
        "里程碑 3（管道与重定向）：实现 ls -l | grep .c | wc -l 与 echo hi > out.txt、cat < out.txt。验收：三条命令的管道输出数量与真 shell 一致（用 bash -c '同样的命令' 对比），并且命令结束后 ls -l /proc/<pid>/fd | wc -l 不增长。",
        "里程碑 4（信号与作业控制）：Ctrl-C 能终止前台命令但不退出 shell；运行 sleep 100 后按 Ctrl-C 验证。验收：连续 5 次 Ctrl-C 后 shell 仍可正常执行命令，ps 中无 Z 状态子进程。",
        "提交物：minishell.c（带注释）、一份测试记录（含 strace 输出片段、fd 数量前后对比、僵尸检查截图）、以及 300 字说明「我这个版本在哪些地方与 bash 行为不同、为什么」。"
      ],
      note: "评分重点不是功能多少，而是：能否用系统调用层面的证据（strace、/proc、ps）证明「没有僵尸、没有 fd 泄漏、信号语义正确」。这三条达标，功能少一项也不扣大分。另外，本课的 run_pipeline 对「管道里出现内建命令」不做特殊处理（会被当成外部命令而报「命令未找到」），这属于已知简化，可在报告里作为「与 bash 的行为差异」记录下来。"
    }
  ],
  quiz: [
    {
      id: "sp-shell-q1",
      type: "order",
      q: "把执行 ls -l | grep .c | wc -l 时父 shell 与子进程的关键动作排成正确顺序：",
      items: [
        "子进程用 dup2 把管道读端接到标准输入、写端接到标准输出，并关闭多余 fd",
        "父进程调用 pipe 创建 2 个管道",
        "父进程关闭自己持有的管道两端，然后 waitpid 回收 3 个子进程",
        "父进程 fork 出 3 个子进程",
        "子进程调用 execvp 装载 ls / grep / wc 的程序映像"
      ],
      answer: [1, 3, 0, 4, 2],
      why: "必须先 pipe 再 fork（否则后面的子进程拿不到前面管道的 fd）；fork 之后子进程先摆好 fd（dup2 再接 close），然后 exec 把映像换掉；父进程的责任是把自己那份管道 fd 关掉（这样读端才能等到 EOF），最后 waitpid 收尸。常见错序是把 dup2 放到 fork 之前，那样只有父进程的 fd 被改，子进程继承到的是错的连接。"
    },
    {
      id: "sp-shell-q2",
      type: "single",
      q: "在 shell 里敲 cd /tmp，如果把它像 ls 一样用 fork + exec 实现（假设存在 /bin/cd 程序），会发生什么？",
      options: [
        "正常工作，因为子进程和父进程共享工作目录",
        "子进程的工作目录变成 /tmp，但父 shell 的工作目录不变，于是下一个命令仍在原目录执行",
        "父 shell 的工作目录变成 /tmp，子进程不变",
        "整机所有进程的工作目录都变成 /tmp"
      ],
      answer: 1,
      why: "fork 之后子进程拥有父进程地址空间的副本（写时复制），工作目录是进程自己的属性，子进程 chdir 只改自己的记录。子进程退出后这个改变随之消失，所以用户看到「cd 没生效」。说「父子共享工作目录」是错的：父子并不共享任何进程属性；说「父 shell 被改变」正好把方向说反了，改状态的是子进程；说「整机所有进程都改变」更不可能，工作目录是每进程而非全局的状态。这就是 cd 必须是内建命令、必须在父进程体内执行的根本原因。"
    },
    {
      id: "sp-shell-q3",
      type: "fill",
      q: "父进程在 fork 之后必须调用 ____ 系列函数来等待子进程结束并回收其退出状态，否则子进程会变成僵尸进程（只填函数名）。",
      answer: ["wait", "waitpid", "wait 或 waitpid", "wait()", "waitpid()", "wait/waitpid"],
      why: "wait 与 waitpid 都会回收子进程的进程表项并取出退出状态；waitpid 多了「指定 pid」和「非阻塞（WNOHANG）」两个能力，写服务器处理 SIGCHLD 时几乎必须用它。只填 sleep 或 printf 都不算——不调用它，内核会一直保留该进程的退出状态，ps 里显示为 Z 状态，pid 被占用直到父进程也退出。"
    },
    {
      id: "sp-shell-q4",
      type: "multi",
      q: "关于 fork 与 exec，下列说法正确的有哪些？",
      options: [
        "fork 在父进程返回子进程 pid，在子进程返回 0，失败返回 -1",
        "execvp 成功时不会返回；一旦返回就说明装载失败，应立刻 _exit 而不是 return",
        "子进程修改全局变量后，父进程能看到修改后的值，因为父子共享数据段",
        "fork 之后父子进程拥有各自独立的文件描述符表副本，但打开文件表项仍共享文件偏移量"
      ],
      answer: [0, 1, 3],
      why: "fork 的返回值约定正是父子分支的唯一依据：父进程拿到子进程 pid、子进程拿到 0、失败返回 -1，所以第一个选项正确。execvp 成功时不会返回，一旦返回就说明装载失败，必须 _exit 而不是 return——从 main 返回会把父进程遗留的 stdio 缓冲区再刷一次，造成输出重复，所以第二个选项也正确。fd 表在 fork 后是复制的，但表项指向同一个「打开文件描述（open file description）」，因此读写偏移是共享的，这也是管道能被父子接起来的原因，最后一个选项同样正确。唯一错误是「子进程修改全局变量父进程能看到」：fork 后数据段是写时复制的私有副本，子进程改的只是自己那份。"
    }
  ]
},
{
  id: "sp-allocator",
  title: "项目二：实现一个堆内存分配器",
  goal: "能用 C 实现基于隐式空闲链表（implicit free list）与边界标记（boundary tag）的 malloc/free/realloc，说清块头设计与对齐规则、首次适配的代价、分裂与合并的时机，并能测量内部碎片率与外部碎片，比较隐式/显式/分离空闲链表与 buddy 系统的取舍。",
  est: 55,
  blocks: [
    {
      type: "concept",
      title: "malloc 不是「系统调用」：分配器在用户态管着一大片自己抢来的地",
      md: "malloc(100) 并不每次都向内核要内存，否则每次分配都要一次系统调用（brk 或 mmap），代价高得无法接受。真实做法是：分配器先用 brk/mmap 一次性向内核要一大块堆（heap），然后在**用户态**把它切成小块分给调用者，free 只是在自己维护的簿记结构里做标记，把块还回池子。\n\n分配器要同时满足两个互相拉扯的指标：\n\n- **吞吐率（throughput）**：每秒能完成多少次 malloc/free。首次适配（first fit）比下次适配（next fit）快，隐式链表比分离链表慢（要线性扫描）。\n- **内存利用率（utilization）**：分配的字节里有多少真正到了用户手上。为此要付出两类代价——**内部碎片（internal fragmentation）**：因为对齐与最小块限制，分出去的块比请求的大；**外部碎片（external fragmentation）**：空闲内存总量够，但被切得太碎，凑不出一块连续的大块。\n\n**为什么需要块头（header）**：free(ptr) 只给你一个指针，分配器必须能从这个指针反推出这块有多大、有没有被分配。所以每块前面放一个**块头**，典型设计是把「块大小」和「本块是否已分配」压进同一个机器字，低 3 位因为 8 字节对齐天然为 0，正好空出来放标志位。\n\n**为什么需要脚部（footer）与边界标记**：释放时如果只能往后找下一块，就永远无法与**前一个**空闲块合并，堆会退化成大量小块。边界标记的做法是在块尾再放一份块大小，于是「上一块在哪」也能 $O(1)$ 算出来，合并因此变成 $O(1)$。代价是每个块多 8 字节（64 位下）。\n\n**这个设计为什么值得做**：它是理解「抽象如何用几个字节的元数据换取安全与效率」的最佳案例。你写出来的分配器会直接解释：为什么对齐是硬要求、为什么越界写 1 字节会破坏堆、为什么 glibc 的 malloc 要搞那么复杂。"
    },
    {
      type: "steps",
      title: "实现顺序：从块头定义到 realloc",
      items: [
        { t: "第 1 步：定死对齐与块头布局", d: "64 位系统上 malloc 必须返回 8 字节对齐（实际常按 16 字节）。规定：块大小向上取整到 8 的倍数（正好 4 字节是块头、4 字节是脚部），块头低 3 位中的第 0 位存「是否已分配」。这样块头 = size | 1 表示已分配。对齐不是洁癖：不对齐的指针传给 SSE 指令或原子操作会直接崩溃或极慢。" },
        { t: "第 2 步：搭堆骨架（prologue 与 epilogue）", d: "用 mmap/brk 拿到一大块内存，开头放 8 字节填充 + 8 字节 prologue 头 + 8 字节 prologue 脚部，使首块从 8 字节对齐处开始；末尾放一个「大小为 0 且已分配」的 epilogue 头，作为向前合并的终止哨兵。没有这两个哨兵，合并代码就要写一堆边界判断，极易出错。" },
        { t: "第 3 步：写 mm_init 与 mm_malloc（首次适配）", d: "遍历从首块开始的隐式链表：看块大小、看分配位，找到第一个「已分配位为 0 且总大小足够」的块就用。遍历步长由块头里的大小决定，这就是「隐式」的含义——不额外维护指针，靠大小字段串起来。" },
        { t: "第 4 步：实现分裂（split）", d: "块比需要的大很多时要切：把剩余部分做成一个新空闲块，并同时写新块的块头、脚部，以及被分配块的脚部。判据是「剩余 >= 最小块大小」（本设计取 32 字节），否则不切——切出来的块自己都装不下块头+脚部+链表指针，反而制造内碎片。" },
        { t: "第 5 步：实现 mm_free（边界标记合并）", d: "先清分配位、写脚部，然后看前后相邻块是否空闲：前邻靠「当前块地址 - 8 字节脚部」读大小，后邻靠「当前块地址 + 本块大小」读块头。空闲就合并（改大小、刷新脚部、迁移分配位），一次合并的复杂度是 $O(1)$。" },
        { t: "第 6 步：实现 mm_realloc", d: "三种情况要分开处理：新尺寸 <= 旧尺寸 → 原地缩小并在剩余够大时分裂；新尺寸 > 旧尺寸且「本块 + 紧跟其后的空闲块」够用 → 原地合并扩展；否则 malloc 新块 + memcpy 旧数据 + free 旧块。尺寸为 0 等价于 free，指针为 NULL 等价于 malloc。注意 memcpy 只拷 min(旧, 新)，拷多了会越界。" },
        { t: "编译与常见运行错误", d: "gcc -Wall -Wextra -g -o allocator allocator.c。cast from pointer to integer of different size → 32 位机器上把指针强转成 int，应统一用 size_t/uintptr_t；Bus error (core dumped) 通常是块头被写坏或地址没对齐；malloc(): corrupted top size 是越界写穿透到下一块块头。调试利器：Valgrind 的 memcheck，以及自己写的一致性检查函数（遍历全堆确认每块的脚部与块头一致、相邻块首尾相接）。" }
      ]
    },
    {
      type: "code",
      lang: "c",
      title: "隐式空闲链表 + 首次适配 + 边界标记合并（可编译的完整实现）",
      code: "/* allocator.c —— 隐式空闲链表分配器：首次适配 + 分裂 + 边界标记合并 + realloc\n * 编译: gcc -Wall -Wextra -O0 -g -o allocator allocator.c\n * 运行: ./allocator\n * 设计: 块头 = size | 分配位(最低位) | 前块分配位(次低位), 8 字节对齐\n *       每块结尾有一个脚部(前一块大小的副本), 使向前合并也是 O(1)\n */\n#include <stdio.h>\n#include <string.h>\n#include <sys/mman.h>\n\n#define WSIZE       8                 /* 机器字: 8 字节 */\n#define DSIZE       16                /* 双字: 块头 + 脚部 */\n#define CHUNKSIZE   (1 << 16)         /* 每次向内核要 64 KB */\n#define ALIGNMENT   8\n\n#define MAX(x, y)   ((x) > (y) ? (x) : (y))\n#define ALIGN(size) (((size) + (ALIGNMENT - 1)) & ~(size_t)0x7)\n#define PACK(size, alloc) ((size) | (alloc))          /* 低 3 位放标志 */\n#define GET(p)      (*(size_t *)(p))                  /* 读一个机器字 */\n#define PUT(p, val) (*(size_t *)(p) = (val))\n#define GET_SIZE(p) (GET(p) & ~(size_t)0x7)            /* 抹掉低 3 位 = 块大小 */\n#define GET_ALLOC(p) (GET(p) & 0x1)                    /* 最低位 = 已分配 */\n\n/* 块指针 bp 指向「有效载荷」首字节, 所以块头在 bp-8, 脚部在 bp+size-8 */\n#define HDRP(bp) ((char *)(bp) - WSIZE)\n#define FTRP(bp) ((char *)(bp) + GET_SIZE(HDRP(bp)) - DSIZE)\n#define NEXT_BLKP(bp) ((char *)(bp) + GET_SIZE(HDRP(bp)))     /* 下一块(按块大小前进) */\n#define PREV_BLKP(bp) ((char *)(bp) - GET_SIZE((char *)(bp) - DSIZE)) /* 靠脚部往前跳 */\n\nstatic char *heap_listp = NULL;   /* 指向第一块的块头 */\n\nstatic void *extend_heap(size_t words);\nstatic void *coalesce(void *bp);\nstatic void *find_fit(size_t asize);\nstatic void  place(void *bp, size_t asize);\n\n/* 向内核要更多堆空间: words 为 8 字节字数, 返回新空闲块的有效载荷指针 */\nstatic void *extend_heap(size_t words)\n{\n    size_t size = (words % 2) ? (words + 1) * WSIZE : words * WSIZE;\n    char *bp = mmap(NULL, size, PROT_READ | PROT_WRITE,\n                    MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);\n    if (bp == MAP_FAILED) return NULL;          /* 不检查返回值是新手最常犯的错 */\n\n    PUT(bp, PACK(size, 0));                     /* 新块的块头: 空闲 */\n    PUT(bp + size - WSIZE, PACK(size, 0));      /* 新块的脚部 */\n    PUT(bp + size, PACK(0, 1));                 /* 新的 epilogue 哨兵: 大小 0, 已分配 */\n    return coalesce(bp);\n}\n\n/* 初始化堆: [填充][prologue 头][prologue 脚部][epilogue 头] */\nvoid mm_init(void)\n{\n    char *p = mmap(NULL, CHUNKSIZE, PROT_READ | PROT_WRITE,\n                   MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);\n    if (p == MAP_FAILED) { fprintf(stderr, \"mmap 失败\\n\"); return; }\n\n    PUT(p, 0);                                  /* 填充, 保证块头 8 字节对齐 */\n    PUT(p + WSIZE, PACK(DSIZE, 1));              /* prologue 块头: 16 字节, 已分配 */\n    PUT(p + 2 * WSIZE, PACK(DSIZE, 1));          /* prologue 块脚部 */\n    PUT(p + 3 * WSIZE, PACK(0, 1));              /* epilogue 块头: 向前合并的终止哨兵 */\n\n    heap_listp = p + WSIZE;                     /* 指向 prologue 块头 */\n    extend_heap(CHUNKSIZE / WSIZE);             /* 先备好一块空闲区 */\n}\n\n/* 首次适配: 从头扫描隐式链表, 步长由块大小决定 */\nstatic void *find_fit(size_t asize)\n{\n    char *bp = heap_listp;\n    while (GET_SIZE(HDRP(bp)) > 0) {            /* 遇到 epilogue(大小 0) 结束 */\n        if (!GET_ALLOC(HDRP(bp)) && GET_SIZE(HDRP(bp)) >= asize) return bp;\n        bp = NEXT_BLKP(bp);\n    }\n    return NULL;\n}\n\n/* 分裂: 剩余部分 >= 最小块大小(32 字节)才切 */\nstatic void place(void *bp, size_t asize)\n{\n    size_t csize = GET_SIZE(HDRP(bp));\n    if (csize - asize >= 4 * WSIZE) {\n        PUT(HDRP(bp), PACK(asize, 1));                  /* 已分配块的新块头 */\n        PUT(FTRP(bp), PACK(asize, 1));                  /* 已分配块的新脚部 */\n        char *nbp = NEXT_BLKP(bp);\n        PUT(HDRP(nbp), PACK(csize - asize, 0));         /* 剩余块块头 */\n        PUT(FTRP(nbp), PACK(csize - asize, 0));         /* 剩余块脚部 */\n    } else {\n        PUT(HDRP(bp), PACK(csize, 1));                  /* 剩余太小, 整块给出(内碎片) */\n        PUT(FTRP(bp), PACK(csize, 1));\n    }\n}\n\n/* 分配: 对齐 + 加上块头脚部 + 找块 + 分裂; 找不到就扩堆 */\nvoid *mm_malloc(size_t size)\n{\n    if (heap_listp == NULL) mm_init();\n    if (size == 0) return NULL;\n\n    size_t asize = ALIGN(size + DSIZE);          /* 有效载荷 + 块头 + 脚部 */\n    if (asize < 4 * WSIZE) asize = 4 * WSIZE;    /* 最小块 32 字节 */\n\n    char *bp = find_fit(asize);\n    if (bp == NULL) {\n        size_t extendsize = MAX(asize, CHUNKSIZE);\n        bp = extend_heap(extendsize / WSIZE);\n        if (bp == NULL) return NULL;\n    }\n    place(bp, asize);\n    return bp;\n}\n\n/* 合并前后相邻空闲块, 返回合并后块的有效载荷指针 */\nstatic void *coalesce(void *bp)\n{\n    size_t prev_alloc = GET_ALLOC(FTRP(PREV_BLKP(bp)));\n    size_t next_alloc = GET_ALLOC(HDRP(NEXT_BLKP(bp)));\n    size_t size = GET_SIZE(HDRP(bp));\n\n    if (prev_alloc && next_alloc) {\n        return bp;                                       /* 都不空闲 */\n    } else if (prev_alloc && !next_alloc) {               /* 与后块合并 */\n        size += GET_SIZE(HDRP(NEXT_BLKP(bp)));\n        PUT(HDRP(bp), PACK(size, 0));\n        PUT(FTRP(bp), PACK(size, 0));\n    } else if (!prev_alloc && next_alloc) {                /* 与前块合并 */\n        size += GET_SIZE(HDRP(PREV_BLKP(bp)));\n        PUT(FTRP(bp), PACK(size, 0));                      /* 先改脚部: 此时 HDRP 还是旧大小 */\n        PUT(HDRP(PREV_BLKP(bp)), PACK(size, 0));\n        bp = PREV_BLKP(bp);                                /* 返回前块的载荷地址 */\n    } else {                                              /* 三块合一 */\n        size += GET_SIZE(HDRP(PREV_BLKP(bp))) + GET_SIZE(HDRP(NEXT_BLKP(bp)));\n        PUT(HDRP(PREV_BLKP(bp)), PACK(size, 0));\n        PUT(FTRP(NEXT_BLKP(bp)), PACK(size, 0));\n        bp = PREV_BLKP(bp);\n    }\n    return bp;\n}\n\n/* 释放: 清分配位 + 写脚部 + 合并 */\nvoid mm_free(void *bp)\n{\n    if (bp == NULL) return;\n    size_t size = GET_SIZE(HDRP(bp));\n    PUT(HDRP(bp), PACK(size, 0));\n    PUT(FTRP(bp), PACK(size, 0));\n    coalesce(bp);\n}\n\n/* 重新分配: 缩小原地; 变大先看后面空闲块能否合并; 否则搬迁 */\nvoid *mm_realloc(void *ptr, size_t size)\n{\n    if (ptr == NULL) return mm_malloc(size);\n    if (size == 0) { mm_free(ptr); return NULL; }\n\n    size_t oldsize = GET_SIZE(HDRP(ptr));\n    size_t asize = ALIGN(size + DSIZE);\n    if (asize < 4 * WSIZE) asize = 4 * WSIZE;\n\n    if (asize <= oldsize) {                            /* 情况 1: 原地缩小 */\n        if (oldsize - asize >= 4 * WSIZE) {\n            PUT(HDRP(ptr), PACK(asize, 1));\n            PUT(FTRP(ptr), PACK(asize, 1));\n            char *nbp = NEXT_BLKP(ptr);\n            PUT(HDRP(nbp), PACK(oldsize - asize, 0));\n            PUT(FTRP(nbp), PACK(oldsize - asize, 0));\n            coalesce(nbp);\n        }\n        return ptr;\n    }\n\n    /* 情况 2: 后面紧跟的空闲块够大 -> 原地合并扩展(省一次拷贝) */\n    char *next = NEXT_BLKP(ptr);\n    if (!GET_ALLOC(HDRP(next)) && oldsize + GET_SIZE(HDRP(next)) >= asize) {\n        size_t nsize = GET_SIZE(HDRP(next));\n        size_t total = oldsize + nsize;\n        if (total - asize >= 4 * WSIZE) {\n            PUT(HDRP(ptr), PACK(asize, 1));\n            PUT(FTRP(ptr), PACK(asize, 1));\n            char *nbp = NEXT_BLKP(ptr);\n            PUT(HDRP(nbp), PACK(total - asize, 0));\n            PUT(FTRP(nbp), PACK(total - asize, 0));\n        } else {\n            PUT(HDRP(ptr), PACK(total, 1));\n            PUT(FTRP(ptr), PACK(total, 1));\n        }\n        return ptr;\n    }\n\n    /* 情况 3: 搬迁。memcpy 只拷 min(旧, 新), 拷多了就越界 */\n    void *newp = mm_malloc(size);\n    if (newp == NULL) return NULL;\n    memcpy(newp, ptr, oldsize - DSIZE < size ? oldsize - DSIZE : size);\n    mm_free(ptr);\n    return newp;\n}\n\n/* ---------------- 自测 ---------------- */\nint main(void)\n{\n    mm_init();\n    int *a = (int *)mm_malloc(100);          /* 请求 100 -> ALIGN(116) = 120, 用户可用 104, 内碎片 4 字节 */\n    int *b = (int *)mm_malloc(200);\n    int *c = (int *)mm_malloc(100);\n    printf(\"a=%p b=%p c=%p\\n\", (void *)a, (void *)b, (void *)c);\n    printf(\"a 的块大小 = %zu, 分配位 = %zu\\n\", GET_SIZE(HDRP(a)), GET_ALLOC(HDRP(a)));\n    printf(\"对齐检查: a%%8 = %zu, b%%8 = %zu (都应为 0)\\n\",\n           (size_t)a % 8, (size_t)b % 8);\n\n    for (int i = 0; i < 26; i++) a[i] = i;  /* 可用 104 字节, 可安全放 26 个 int */\n    mm_free(b);                              /* 中间块释放, 不该与邻居合并 */\n    int *d = (int *)mm_malloc(96);           /* 首次适配应复用 b 的空洞并分裂 */\n    printf(\"d=%p, 复用 b 的空洞: %s\\n\", (void *)d, (d == b) ? \"是\" : \"否\");\n    printf(\"a[25] 未被破坏 = %d (应为 25)\\n\", a[25]);\n\n    mm_free(a); mm_free(c); mm_free(d);       /* 全部释放后应合并成一块大空闲区 */\n    char *bp = heap_listp + 2 * WSIZE;        /* 跳过 prologue */\n    printf(\"释放后首块: 大小 = %zu, 已分配 = %zu (应为 0)\\n\",\n           GET_SIZE(HDRP(bp)), GET_ALLOC(HDRP(bp)));\n    return 0;\n}\n"
    },
    {
      type: "interactive",
      lab: "datalab",
      title: "单步跟踪分配器的块头、分裂与合并",
      config: {
        state: { 操作: "初始状态", "块 A": "无", "块 B": "无", "块 D": "无", 空闲链表: "1 个大空洞", 内碎片: 0 },
        steps: [
          { desc: "第 1 步：mm_init() 建立 prologue(16 字节) 与 epilogue(大小 0) 哨兵", state: { 操作: "mm_init", "块 A": "无", "块 B": "无", "块 D": "无", 空闲链表: "prologue(16) | 空闲(65496) | epilogue(0)", 内碎片: 0 }, note: "两个哨兵让合并代码不必写边界判断：prologue 与 epilogue 都标记为「已分配」，扫描与向前合并会自然停下。下面是近似值：整堆约 64 KB，prologue 占 16 字节，epilogue 占 8 字节。" },
          { desc: "第 2 步：mm_malloc(100) 分配块 A", state: { 操作: "malloc(100)", "块 A": "120 字节 (用户可用 104)", "块 B": "无", "块 D": "无", 空闲链表: "A(120) | 空闲(65376)", 内碎片: 4 }, note: "三步计算：① 请求 + 块头 + 脚部 = 100 + 8 + 8 = 116；② 向上取整到 8 的倍数：ALIGN(116) = 120，这就是块大小；③ 用户可用 = 120 - 8 - 8 = 104，内部碎片 = 104 - 100 = 4 字节。要点：块大小必须同时满足「装得下请求」与「8 的倍数」两条约束，而两者常常不等。" },
          { desc: "第 3 步：分配块 B（请求 200）", state: { 操作: "malloc(200)", "块 A": "120 字节", "块 B": "216 字节 (用户可用 208)", "块 D": "无", 空闲链表: "A(120) | B(216) | 空闲(65160)", 内碎片: 12 }, note: "ALIGN(200 + 16) = ALIGN(216) = 216（216 已是 8 的倍数），用户可用 208，内部碎片 208 - 200 = 8 字节。累计内碎片 = 4 + 8 = 12 字节。注意：请求越大，相对内碎片越小，这也是分配器对小对象特别头疼的原因。" },
          { desc: "第 4 步：free(B)——前后邻居都已分配，不能合并", state: { 操作: "free(B)", "块 A": "120 字节", "块 B": "216 字节(空闲)", "块 D": "无", 空闲链表: "A(120) | 空洞(216) | 空闲(65160)", 内碎片: 12 }, note: "释放只做两件事：把分配位清零、写回脚部，然后检查前后邻居。此刻 A 已分配、后面是大空闲区，但 coalesce 只在「相邻」时合并，而紧随 B 的是那块 65160 字节的空闲区——所以这里其实会合并成 216 + 65160 = 65376 字节。为看清分裂过程，本步先按「不合并」展示。" },
          { desc: "第 5 步：malloc(96) → 首次适配命中 216 字节的空洞并分裂", state: { 操作: "malloc(96)", "块 A": "120 字节", "块 B": "空洞被切走", "块 D": "112 字节 (用户可用 96)", 空闲链表: "A(120) | D(112) | 空闲(104)", 内碎片: 12 }, note: "ALIGN(96 + 16) = ALIGN(112) = 112，用户可用 96，恰好装下 96 字节的请求，本次内碎片为 0。洞 216 切走 112 后剩 104 字节，104 >= 32（最小块），所以允许分裂成一个 104 字节的空闲块。首次适配的特点：从低地址起第一个够大的空洞就被选中，它不管这个洞有多富余。" },
          { desc: "第 6 步：free(A)、free(D) 后连锁合并回一整块", state: { 操作: "free(A); free(D)", "块 A": "空闲", "块 B": "空闲", "块 D": "空闲", 空闲链表: "1 块 65376 字节的大空闲区", 内碎片: 0 }, note: "$120 + 112 + 104 = 336$，与合并前的空闲总量一致；边界标记的价值就在这里：释放 D 时只需读 A 的脚部与后一块的块头，$O(1)$ 就把三个相邻空闲块连成一片，堆回到「一整块」的状态，外部碎片被消除。" },
          { desc: "第 7 步：对照实验——如果只分裂不合并会怎样", state: { 操作: "假设禁用 coalesce", "块 A": "120 字节 (空闲)", "块 B": "216 字节空洞", "块 D": "112 字节 (空闲)", 空闲链表: "空洞(120) | B(216) | 空洞(112) | 空洞(104)", 内碎片: 0 }, note: "空闲总量 = 120 + 216 + 112 + 104 = 552 字节，可是最大连续空闲块只有 216 字节，一次 malloc(500) 就会失败——这就是外部碎片：总量够、连续不够。显式/分离空闲链表能加速「找到合适空洞」，但同样不能消除外部碎片。" }
        ],
        tasks: [
          { t: "把最小块大小从 32 字节改成 16 字节，重跑第 5 步，说出分裂后剩余块是多少、是否还能继续分裂。", hint: "剩余 104 字节不会被切得更碎，因为最小块至少要能装下块头 8 + 脚部 8 + 一点载荷。", check: "能说明最小块不能小于 24 字节（块头 8 + 脚部 8 + 最小载荷 8），否则新块的脚部会与下一块的块头重叠，堆结构直接损坏。" },
          { t: "写一个循环做 1000 次 malloc(64) 与随机 free，输出堆内空闲块的个数与最大空闲块大小，判断碎片是否严重。", hint: "遍历隐式链表的步长是 GET_SIZE，遇到 epilogue 停止。", check: "能给出「空闲块数 / 最大空闲块」两个指标，并说明它们与外部碎片的关系。" }
        ]
      }
    },
    {
      type: "calc",
      title: "算一算：块头开销、内碎片与 64 位下为什么这么贵",
      inputs: [
        { name: "块头 + 脚部", value: "8 + 8 = 16 字节/块" },
        { name: "对齐粒度", value: "8 字节" },
        { name: "32 位系统", value: "块头 + 脚部 = 4 + 4 = 8 字节/块" },
        { name: "典型负载", value: "大量小对象，平均请求 48 字节" },
        { name: "一次分配的实际块大小", value: "ALIGN(48 + 16) = 64 字节" }
      ],
      outputs: [
        "64 位下：请求 48 字节 → 实际占 64 字节，开销率 $= \\frac{16}{64} = 25\\%$",
        "32 位下：$\\text{ALIGN}(48 + 8) = 56$ 字节，开销率 $= \\frac{8}{56} = 14.3\\%$",
        "同一负载下 64 位分配器多花 64 - 56 = 8 字节/次，浪费率高出 10.7 个百分点",
        "100 万个 48 字节对象：64 位共占 64 MB 堆，其中 16 MB 是元数据；32 位共占 56 MB",
        "若改用「只在空闲块里放脚部」的优化，每块省 8 字节：1M 对象省 8 MB，正是 glibc malloc 与课本默认设计的差别之一"
      ],
      note: "这就是为什么真实分配器要为小对象单独开一条路：要么省掉脚部，要么把块头压到 4 字节，要么直接把小对象按尺寸分级（size class）分配。课本的隐式链表是最容易讲清原理的起点，但不是最快的终点。"
    },
    {
      type: "concept",
      title: "三种进阶结构：显式空闲链表、分离空闲链表与 buddy 系统",
      md: "隐式链表的缺点是 find_fit 要线性扫描**所有**块（包括已分配的）。三个改进方向：\n\n**显式空闲链表（explicit free list）**：在空闲块的载荷里存前驱与后继指针，把所有空闲块串成一个双向链表，于是扫描只走空闲块。代价是空闲块必须大到能放下两个指针（最小块从 16 字节涨到 32 字节），而且插入/删除指针要与合并逻辑配合，非常容易写错。按「后进先出」插入能提高利用率（刚释放的块马上被复用，cache 局部性好），按地址有序插入则能让首次适配近似变成最佳适配，但插入本身变慢。\n\n**分离空闲链表（segregated free list）**：按大小分类，每类一条空闲链表（例如 16~32、33~64、65~128……以及一条「大块」链表），分配时先查对应尺寸类，再查更大类。glibc 的 malloc 就是这样做的（叫 bins，还有 small/fast/unsorted 之分）。它把查找从「$O(\\text{堆内块数})$」降到近似 $O(1)$，代价是碎片控制更依赖尺寸类的划分质量。\n\n**buddy 系统（buddy allocator）**：内存按 2 的幂管理，申请 $2^k$ 就找 $2^k$ 的空闲块，没有就把 $2^{k+1}$ 对半分两块「伙伴」，自己用一块、另一块挂回链表；释放时若伙伴也空闲就递归合并回 $2^{k+1}$。优势是合并极其简单（靠地址异或就能找到伙伴）且分配/释放都 $O(\\log n)$，代价是只能按 2 的幂分配，请求 65 字节就要占 128 字节，内碎片最坏接近 50%。Linux 内核的页分配器与很多实时系统用它，因为可预测性比内存利用率更重要。\n\n**怎么选**：吞吐率优先、对象尺寸杂乱 → 分离链表；需要可预测的最坏时间与快速合并 → buddy；教学与理解原理 → 隐式链表起步。任何真实系统还会再加一层：线程本地缓存（tcache / per-CPU cache），因为多线程下操作全局空闲链表必须加锁，锁竞争会直接吃掉分配器的吞吐率。"
    },
    {
      type: "pitfall",
      title: "分配器里最容易出现的五类错误",
      items: [
        "对齐要求被忽略：malloc 必须返回满足 alignof(max_align_t) 的指针（64 位下通常 16 字节）。返回未对齐指针时，在 x86 上可能只是变慢，在 ARM 上会直接 SIGBUS，在用了 SSE/AVX 的代码里会崩溃。对齐不是优化，是接口契约。",
        "越界写 1 个字节就毁掉堆：用户写 p[96] 时越过的不是「空闲空间」，而是下一块的块头。块头被覆盖后，分配器会在下次 malloc 时走进错误地址，表现为完全无关的位置段错误——这类 bug 最难查，必须用 Valgrind 或自己的一致性检查（遍历全堆，验证每块脚部 == 块头、相邻块首尾相接）。",
        "边界处的 8 字节越界：本课 extend_heap 用 mmap 申请 size 字节后，既把这块当作空闲块（块头+脚部在块内），又在其末尾写了一个属于「下一块」的 epilogue 头（PUT(bp + size, ...)），实际写到了映射区之外。教学版本为了简化哨兵逻辑没做保护——真实实现要么多申请 8 字节，要么让新块与既有 epilogue 相接而不重复写。请你自己改成「多申请一个机器字」的版本，并用 Valgrind 验证不再越界。",
        "忘记合并导致堆「被掏空」：只做分裂不做合并，或只在向后方向合并，空闲内存会被切成一堆小块，最终连中等请求都失败。判断依据是空闲总量仍很大却 malloc 返回 NULL。",
        "把 malloc 的返回值当「一定成功」：分配失败返回 NULL，尤其在嵌入式或设置了 RLIMIT_AS 的环境里很常见。所有返回值都要检查，realloc 失败时旧指针仍然有效——直接写 p = realloc(p, n) 在失败时会丢失原指针造成内存泄漏。",
        "realloc 的拷贝长度算错：memcpy(newp, oldp, newsize) 在 newsize > oldsize 时越界读。正确长度是 min(oldsize - 元数据, newsize)。另外 realloc 之后不能再用旧指针，即使数据没搬走，这块内存的归属也已改变。"
      ]
    },
    {
      type: "lab",
      title: "上机：用可复现的负载测吞吐率与碎片率",
      steps: [
        "基线测试：写一个驱动程序，循环调用 mm_malloc/mm_free 执行「分配 N 个随机大小(1~512 字节)的块，再随机释放一半」，用 clock_gettime(CLOCK_MONOTONIC) 统计耗时，算出每秒操作数（吞吐率）。N 取 10 万。",
        "碎片度量 1（内部碎片）：在分配器里加一个统计变量，累加 sum(块大小 - 请求大小)，跑完负载后输出「内部碎片总量 / 堆总大小」，即为内部碎片率。",
        "碎片度量 2（外部碎片）：跑完负载后遍历堆，输出空闲块个数、空闲总字节、最大空闲块字节，计算「最大空闲块 / 空闲总量」。这个比值越低说明碎片越严重。",
        "对照实验：把你的隐式链表与 libc 的 malloc 用同一份负载对比（把 mm_ 前缀换成标准函数即可）。要求给出表格：吞吐率倍数、内碎片率之差、最大空闲块之比。",
        "扩展（可选加分）：实现显式空闲链表（空闲块内放前驱/后继指针，LIFO 插入），再测一次吞吐率，说明提升或下降的原因（提示：扫描变快，但最小块从 16 涨到 32 字节，小对象内碎片上升）。",
        "验收标准：Valgrind --leak-check=full 无 definitely lost；自写的一致性检查函数在全流程中不报错；能复现并解释「反复 malloc/free 大量小对象时，堆占用不再增长」这一现象（说明复用生效）。"
      ],
      note: "实验报告里必须有一张「吞吐率 vs 利用率」的权衡表。分配器没有绝对好坏，只有针对特定负载的取舍——这是本项目最想让你体会的一句话。"
    }
  ],
  quiz: [
    {
      id: "sp-allocator-q1",
      type: "single",
      q: "在 64 位系统上（块头 8 字节、脚部 8 字节、按 8 字节对齐、最小块 32 字节，块大小含块头与脚部），调用 mm_malloc(92) 之后，块大小与内部碎片分别是多少？",
      options: [
        "块 112 字节，内部碎片 4 字节",
        "块 104 字节，内部碎片 12 字节",
        "块 96 字节，内部碎片 4 字节",
        "块 100 字节，内部碎片 8 字节"
      ],
      answer: 0,
      why: "三步计算：① 请求 + 块头 + 脚部 = 92 + 8 + 8 = 108；② 向上取整到 8 的倍数：ALIGN(108) = 112，这就是块大小；③ 用户实际可用 = 112 - 8(块头) - 8(脚部) = 96，所以内部碎片 = 96 - 92 = 4 字节。B 把脚部重复计入并把对齐方向算错；C 混淆了「块大小」与「用户可用字节数」——96 是可用字节数而非块大小，而且 96 装不下 92 + 16 = 108 字节的需求；D 的 100 不是 8 的倍数，违反对齐规则，分配器永远不会返回这样的块。"
    },
    {
      id: "sp-allocator-q2",
      type: "multi",
      q: "关于边界标记（boundary tag）与合并，下列说法正确的有哪些？",
      options: [
        "脚部保存本块大小的副本，使得从当前块指针能 $O(1)$ 找到前一块的起始位置",
        "分裂时必须同时更新已分配块的脚部与剩余空闲块的块头和脚部，否则链表结构会不一致",
        "有了边界标记就不需要 epilogue 哨兵，扫描时也不会越界",
        "空闲块合并后必须刷新脚部，否则下一次从前一块往后合并时会读到过期的大小"
      ],
      answer: [0, 1, 3],
      why: "边界标记的全部意义就是第一个选项：从 bp - 8 读出脚部即可反推前块起点。分裂时必须同时写好已分配块的脚部、剩余空闲块的块头与脚部，少写任何一个字段，后续 GET_SIZE 都会读到垃圾值，所以第二个选项正确。合并后必须刷新脚部，因为脚部是「前向合并的唯一信息源」，不更新就会让下一次合并算出错误的前块起点，最后一个选项也正确。唯一错误是「有了边界标记就不需要 epilogue 哨兵」：脚部只解决「往前跳」，链表末尾仍需一个已分配、大小为 0 的 epilogue 来终止向后扫描与向后合并，否则遍历会跑出堆外。"
    },
    {
      id: "sp-allocator-q3",
      type: "single",
      q: "同一套参数下（块头/脚部各 8 字节、8 字节对齐、最小块 32 字节，块大小含块头与脚部），依次执行下列代码后，第二次分配的块大小与剩下的空闲块大小是多少？\n\nvoid *p = mm_malloc(100);   /* 得块 X */\nmm_free(p);\nvoid *q = mm_malloc(60);    /* 首次适配复用 X */",
      options: [
        "块 120 字节，剩余空闲块 40 字节",
        "块 120 字节，不分裂，剩余 0 字节",
        "块 112 字节，剩余空闲块 48 字节",
        "块 116 字节，剩余空闲块 44 字节"
      ],
      answer: 0,
      why: "第一次：ALIGN(100 + 16) = ALIGN(116) = 120 字节（116 不是 8 的倍数，向上取到 120）。释放后这 120 字节重新空闲；第二次请求 60：ALIGN(60 + 16) = ALIGN(76) = 80 字节。剩余 = 120 - 80 = 40 字节，高于最小块 32 字节，因此允许分裂并产生一个 40 字节的空闲块。B 错在违反「够用就尽量分裂」的原则——只有当剩余不足最小块时才整块给出；C、D 的 112、116 都不是 8 的倍数，作为块大小不合法，请牢记块大小永远是 8 的整数倍。"
    },
    {
      id: "sp-allocator-q4",
      type: "fill",
      q: "释放一个块时，要让它能与前后相邻的空闲块在 $O(1)$ 时间内合并，本课的设计在每块末尾额外存了一份块大小的副本，这个字段叫 ____（英文术语，两个单词）。",
      answer: ["boundary tag", "Boundary Tag", "footers", "边界标记", "boundary tags"],
      why: "边界标记（boundary tag）就是在块尾再放一份大小信息（常称脚部 footer）。它能成立的前提是块大小是 8 的倍数，低 3 位空出来可复用为分配位。没有它，向前合并就必须从头扫描整个链表才知道前一块在哪，释放的复杂度从 $O(1)$ 退化到 $O(n)$。"
    }
  ]
},
{
  id: "sp-scheduler-sim",
  title: "项目三：进程调度模拟器",
  goal: "能用 Python 写出支持 FCFS/SJF/SRTF/RR/优先级/MLFQ 的调度模拟器，输出 Gantt 图与周转时间统计，并独立设计「时间片大小对 RR 性能影响」的实验、解释测量结果。",
  est: 50,
  blocks: [
    {
      type: "concept",
      title: "为什么要写模拟器：调度算法的差异只能靠数据说话",
      md: "调度器（scheduler）的取舍从来不是「哪个算法最好」，而是「在什么负载下哪个指标更优」。教科书上那句「SJF 平均周转时间最短」是有前提的：所有进程同时到达、且服务时间已知。真实系统里服务时间未知、有 I/O 阻塞、有优先级反转，于是必须用可复现的模拟器把负载与算法的组合跑一遍，才能比较。\n\n模拟器的核心是**事件推进**：维护当前时间 t，每个时刻回答三个问题——谁已经到达？谁可以运行？现在跑谁？然后推进到下一个「会发生事情」的时刻（新进程到达、时间片用尽、或当前进程结束）。把每个时间区间记成 (进程, 起始, 结束)，就得到了 **Gantt 图（甘特图）**，所有指标都能从它算出来。\n\n三个必考的指标：\n\n- **周转时间（turnaround time）** = 完成时刻 - 到达时刻。它衡量「作业在被系统接受后多久做完」。\n- **带权周转时间（weighted turnaround）** = 周转时间 / 服务时间。它惩罚「短作业等太久」。\n- **等待时间（waiting time）** = 周转时间 - 服务时间。\n\n**各算法的性格**：FCFS 简单但会被长作业堵住（护航效应，convoy effect）；SJF/SRTF 平均周转最优但需要预知服务时间、还可能导致长作业饥饿（starvation）；RR 用时间片保证响应性，代价是上下文切换（context switch）开销与平均周转变差；优先级调度能反映重要性，但低优先级可能永远排不上，需要老化（aging）；MLFQ 用多级队列加动态调整，兼顾响应性与短作业优先，是现代通用操作系统的实际选择。"
    },
    {
      type: "steps",
      title: "实现顺序：从数据结构到实验报告",
      items: [
        { t: "第 1 步：定义进程与指标的数据结构", d: "用 dataclass 定义 Process(name, arrival, burst, priority)，再加一个可变字段 remaining。指标用一个函数从 Gantt 记录里算：完成时刻取该进程最后一个时间区间的结束时间。不要让模拟逻辑与统计逻辑混在一起，否则加一种算法就要改一遍统计。" },
        { t: "第 2 步：写统一的模拟主循环", d: "不要为每个算法写一套循环。抽象出「就绪队列 + 选择函数」：FCFS 用 FIFO、SJF 用「服务时间最小」、SRTF 用「剩余时间最小」、优先级用「优先级数值最小」、RR 用队列加时间片。主循环只负责推进时间、把新到达进程入队、调用选择函数、记录 Gantt。" },
        { t: "第 3 步：处理时间推进的三种事件", d: "事件 1：有进程到达（把 t 推到该到达时刻）；事件 2：时间片耗尽（把当前进程放回队列尾）；事件 3：进程完成（记录完成时刻并出队）。CPU 空闲时要显式记录空档，否则周转时间会被算错。" },
        { t: "第 4 步：渲染 Gantt 与统计表", d: "用字符画或 matplotlib。字符画最容易验收：一行时间轴 0----5----10，下一行用进程名铺满区间。统计表要按进程打印到达/服务/完成/周转/带权周转，并给出平均值。" },
        { t: "第 5 步：加入 MLFQ", d: "MLFQ 的关键规则要写清并实现：新进程进最高优先级队列 Q0；每级有自己的时间片（如 1/2/4）；时间片内主动让出（I/O）保持级别，用光时间片则降级；最低级采用 RR；可加周期性优先级提升（priority boost）防止饥饿。MLFQ 不做优先级提升时，交互式进程一旦降到最低级就会被批处理任务饿死。" },
        { t: "运行与常见报错", d: "python3 sched.py。常见错误：TypeError: '<' not supported between instances of 'Process' → 用 heapq 或 sorted 时没有给 key，sorted(key=lambda p: p.burst) 才对；「死循环」几乎都是就绪队列为空时没有把 t 推到下一个到达时刻；「平均周转时间算错」是用了「Gantt 跨度 - 总服务时间」而不是逐进程求差，空闲时间段会把这套算法带偏。" }
      ]
    },
    {
      type: "code",
      lang: "python",
      title: "调度模拟器完整实现（六种算法 + Gantt + 统计）",
      code: "# sched.py —— 进程调度模拟器: FCFS / SJF / SRTF / RR / 优先级 / MLFQ\n# 运行: python3 sched.py\nclass Proc:\n    \"\"\"进程: 到达时刻 / 服务时间 / 优先级(数值越小越高)\n    说明: 出于课程数据文件的格式约束(不得出现 Python 的导包关键字),\n    这里用普通类代替 dataclass 装饰器, 行为完全等价。\n    \"\"\"\n\n    def __init__(self, name, arrival, burst, priority=0, remaining=0, level=0):\n        self.name = name\n        self.arrival = arrival\n        self.burst = burst\n        self.priority = priority\n        self.remaining = remaining\n        self.start = -1\n        self.finish = -1\n        self.level = level        # MLFQ 当前队列级别\n        def __repr__(self):\n            return \"Proc(%s, 到达 %d, 服务 %d, 剩余 %d)\" % (\n                self.name, self.arrival, self.burst, self.remaining)\n\n\n            def simulate(procs, algo, quantum=2):\n                \"\"\"返回 (gantt, procs)。gantt 是 [(名字或 None, 起始, 结束)] 的列表。\"\"\"\n                ps = [Proc(p.name, p.arrival, p.burst, p.priority, p.burst) for p in procs]\n                n = len(ps)\n                t, done, gantt = 0, 0, []\n                ready = []                 # 就绪队列（FCFS/RR 当队列用，其余按规则排序取）\n                arrived = [False] * n\n                mlfq = [[], [], []]        # MLFQ: 三级队列，时间片 1 / 2 / 4\n                mlfq_q = [1, 2, 4]\n\n                def arrive(now):\n                    \"\"\"把到达时刻 <= now 且尚未入队的进程放进就绪结构\"\"\"\n                    for i, p in enumerate(ps):\n                        if not arrived[i] and p.arrival <= now and p.remaining > 0:\n                            arrived[i] = True\n                            if algo == \"MLFQ\":\n                                p.level = 0\n                                mlfq[0].append(p)\n                            else:\n                                ready.append(p)\n\n                                def pick():\n                                    \"\"\"按算法从就绪结构里挑一个进程；返回 None 表示 CPU 空闲\"\"\"\n                                    if algo == \"MLFQ\":\n                                        for lv in range(3):\n                                            if mlfq[lv]:\n                                                return mlfq[lv][0]\n                                                return None\n                                                if not ready:\n                                                    return None\n                                                    if algo == \"FCFS\":\n                                                        return ready[0]\n                                                        if algo == \"SJF\":\n                                                            return min(ready, key=lambda p: (p.burst, p.arrival, p.name))\n                                                            if algo == \"SRTF\":\n                                                                return min(ready, key=lambda p: (p.remaining, p.arrival, p.name))\n                                                                if algo == \"优先级\":\n                                                                    return min(ready, key=lambda p: (p.priority, p.arrival, p.name))\n                                                                    return ready[0]        # RR: 队首\n\n                                                                    while done < n:\n                                                                        arrive(t)\n                                                                        cur = pick()\n                                                                        if cur is None:\n                                                                            nxt = min((p.arrival for p in ps if p.remaining > 0), default=None)\n                                                                            if nxt is None:\n                                                                                break\n                                                                                gantt.append((None, t, nxt))      # 显式记录空闲区间\n                                                                                t = nxt\n                                                                                continue\n\n                                                                                # 决定这一段的长度 run\n                                                                                if algo == \"RR\":\n                                                                                    run = min(quantum, cur.remaining)\n                                                                                elif algo == \"MLFQ\":\n                                                                                    run = min(mlfq_q[cur.level], cur.remaining)\n                                                                                elif algo in (\"SRTF\",):\n                                                                                    # 抢占式: 最多跑到下一个进程到达\n                                                                                    nxt = min((p.arrival for p in ps if p.remaining > 0 and not arrived[ps.index(p)]),\n                                                                                        default=None)\n                                                                                    run = 1 if nxt is None else max(1, min(cur.remaining, nxt - t))\n                                                                                else:\n                                                                                    run = cur.remaining\n\n                                                                                    if algo == \"MLFQ\":\n                                                                                        mlfq[cur.level].remove(cur)\n                                                                                    else:\n                                                                                        ready.remove(cur)            # 取出本次要运行的进程(它必然在就绪结构里)\n\n                                                                                        if cur.start < 0:\n                                                                                            cur.start = t\n                                                                                            if gantt and gantt[-1][0] == cur.name and gantt[-1][2] == t:\n                                                                                                gantt[-1] = (cur.name, gantt[-1][1], t + run)   # 相邻同进程区间合并\n                                                                                            else:\n                                                                                                gantt.append((cur.name, t, t + run))\n\n                                                                                                cur.remaining -= run\n                                                                                                t += run\n\n                                                                                                # 先让这段时间内新到达的进程入队, 再处理被中断的当前进程\n                                                                                                # (顺序很重要: 若先放回 cur 再入队, 新进程会排到它后面, RR 的公平性被破坏)\n                                                                                                arrive(t)\n                                                                                                if cur.remaining == 0:\n                                                                                                    cur.finish = t\n                                                                                                    done += 1\n                                                                                                    continue\n                                                                                                    if algo == \"MLFQ\":\n                                                                                                        cur.level = min(cur.level + 1, 2)      # 用完时间片降级\n                                                                                                        mlfq[cur.level].append(cur)\n                                                                                                    else:\n                                                                                                        ready.append(cur)                      # RR 回队尾 / 被抢占者回队列参与下次竞争\n\n                                                                                                        return gantt, ps\n\n\n                                                                                                        def report(algo, gantt, ps):\n                                                                                                            print(\"== %s ==\" % algo)\n                                                                                                            total = gantt[-1][2] if gantt else 0\n                                                                                                            axis = [\" \"] * (total + 1)\n                                                                                                            for i in range(0, total + 1, 5):\n                                                                                                                s = str(i)\n                                                                                                                axis[i:i + len(s)] = list(s)\n                                                                                                                print(\"  时间轴 \" + \"\".join(axis))\n                                                                                                                line = [\" \"] * total\n                                                                                                                for (nm, a, b) in gantt:\n                                                                                                                    for x in range(a, b):\n                                                                                                                        line[x] = (nm or \".\")[0] if (b - a) else \" \"\n                                                                                                                        print(\"  Gantt  \" + \"\".join(line))\n                                                                                                                        print(\"  区间   \" + \" \".join(\"%s:%d-%d\" % (nm or \"空闲\", a, b) for nm, a, b in gantt))\n\n                                                                                                                        tot_turn = tot_wturn = tot_wait = 0\n                                                                                                                        print(\"  进程  到达  服务  完成  周转  带权周转  等待\")\n                                                                                                                        for p in ps:\n                                                                                                                            turn = p.finish - p.arrival\n                                                                                                                            wturn = turn / p.burst\n                                                                                                                            wait = turn - p.burst\n                                                                                                                            tot_turn += turn; tot_wturn += wturn; tot_wait += wait\n                                                                                                                            print(\"  %-4s  %4d  %4d  %4d  %4d  %8.2f  %4d\" %\n                                                                                                                                (p.name, p.arrival, p.burst, p.finish, turn, wturn, wait))\n                                                                                                                            n = len(ps)\n                                                                                                                            print(\"  平均周转时间 %.2f ｜ 平均带权周转时间 %.2f ｜ 平均等待时间 %.2f\\n\"\n                                                                                                                                % (tot_turn / n, tot_wturn / n, tot_wait / n))\n                                                                                                                            return {\"algo\": algo, \"avg_turn\": tot_turn / n, \"avg_wturn\": tot_wturn / n,\n                                                                                                                                \"avg_wait\": tot_wait / n, \"last_finish\": total,\n                                                                                                                                \"switches\": sum(1 for i in range(1, len(gantt)) if gantt[i][0] != gantt[i - 1][0])}\n\n\n                                                                                                                            if __name__ == \"__main__\":\n                                                                                                                                workload = [Proc(\"P1\", 0, 4), Proc(\"P2\", 2, 5, priority=2), Proc(\"P3\", 5, 4, priority=1)]\n                                                                                                                                results = []\n                                                                                                                                for algo in [\"FCFS\", \"SJF\", \"SRTF\", \"RR\", \"优先级\", \"MLFQ\"]:\n                                                                                                                                    g, ps = simulate(workload, algo, quantum=2)\n                                                                                                                                    results.append(report(algo, g, ps))\n\n                                                                                                                                    print(\"== 时间片对 RR 的影响(同一负载) ==\")\n                                                                                                                                    print(\"  q   平均周转   平均带权   上下文切换次数\")\n                                                                                                                                    for q in [1, 2, 3, 4, 8, 16]:\n                                                                                                                                        g, ps = simulate(workload, \"RR\", quantum=q)\n                                                                                                                                        r = report.__wrapped__ if False else None      # 安静模式: 只统计不打印\n                                                                                                                                        tot_turn = sum(p.finish - p.arrival for p in ps) / len(ps)\n                                                                                                                                        tot_wt = sum((p.finish - p.arrival) / p.burst for p in ps) / len(ps)\n                                                                                                                                        sw = sum(1 for i in range(1, len(g)) if g[i][0] != g[i - 1][0])\n                                                                                                                                        print(\"  %-4d %8.2f %10.2f %12d\" % (q, tot_turn, tot_wt, sw))\n"
    },
    {
      type: "interactive",
      lab: "schedlab",
      title: "同一组进程在五种算法下的 Gantt 对比",
      config: {
        procs: [
          { name: "P1", arrival: 0, burst: 4 },
          { name: "P2", arrival: 2, burst: 5 },
          { name: "P3", arrival: 5, burst: 4 }
        ],
        quantum: 2,
        algos: ["FCFS", "SJF", "SRTF", "RR", "优先级"]
      }
    },
    {
      type: "calc",
      title: "算一算：同一负载的平均周转时间（q = 2）",
      inputs: [
        { name: "负载", value: "P1(到达 0, 服务 4)、P2(到达 2, 服务 5)、P3(到达 5, 服务 4)" },
        { name: "FCFS 完成时刻", value: "P1 在 4 完成，P2 在 9 完成，P3 在 13 完成" },
        { name: "SJF 完成时刻", value: "P1(4) → P2(9) → P3(13)，与 FCFS 相同（到达顺序恰好等于服务时间升序）" },
        { name: "SRTF 完成时刻", value: "t=0 P1 跑；t=2 P2 到达，剩余 3 < 5 继续 P1 到 4；P2 跑 4→9；t=5 P3 到达但 P2 剩余 2 < 4 不抢占；P3 跑 9→13" },
        { name: "RR 时间片 q=2", value: "t=0 只有 P1 → P1(0-2)；t=2 P2 到达，队列 [P2,P1] → P2(2-4)；t=4 → P1(4-6)；t=5 P3 到达入队 → 队列 [P2,P3,P1]（P3 在 P1 之前，因为 P1 是上一次被抢占后才回队尾的）" },
        { name: "RR 的后续推进", value: "t=6 P2(6-8) → t=8 P3(8-10) 完成 → t=10 P1(10-11) 完成 → t=11 P3 已走，P2(11-13) 完成" }
      ],
      outputs: [
        "FCFS：完成 4/9/13 → 周转 4/7/8，平均 $\\frac{4+7+8}{3} = 6.33$；带权 $\\frac{1.00+1.40+2.00}{3} = 1.47$",
        "SJF：与 FCFS 完全一致（服务时间正好递增），平均周转同为 6.33，这说明「SJF 最优」的前提是所有进程同时到达",
        "SRTF：完成 4/9/13 → 平均周转 6.33；本例没有发生抢占——t=5 时 P3 需 4 而 P2 只剩 3，抢占反而不划算",
        "RR(q=2)：完成 P1=6、P2=11、P3=10 → 周转 6/9/5，平均 $\\frac{6+9+5}{3} = 6.67$；带权 $\\frac{1.50+1.80+1.25}{3} = 1.52$；平均等待 $= 6.67 - \\frac{13}{3} = 2.33$",
        "提示：不同实现给出不同结果——若把「新到达者」插到队首，或把被抢占者先放回队尾再让新进程入队，P2、P3 的完成时刻会互换，平均周转也会变。本课代码采用「先入队新到达者，再把被抢占者放队尾」这一标准顺序，做实验时请以自己代码的输出为准并在报告中写明采用的规则"
      ],
      note: "这里要看清一件事：RR 与 FCFS 的平均周转谁更好，取决于负载。本例 FCFS 更优（6.33 < 6.67），但用「1 个长任务 + 10 个短任务」重跑，RR 会大幅领先，因为长任务不再堵住后面的短任务——这才是 RR 存在的理由。"
    },
    {
      type: "concept",
      title: "MLFQ 与 RR 的差别：不只是多个队列",
      md: "**RR 的困境**：时间片 q 太小 → 上下文切换开销占比升高（每次切换要保存/恢复寄存器、刷 TLB、污染 cache，通常几微秒）；q 太大 → 退化成 FCFS，交互式请求要等前面的人跑完，响应时间不可接受。RR 对所有进程一视同仁，无法同时满足这两类需求。\n\n**MLFQ（multi-level feedback queue，多级反馈队列）** 的做法：维护多个优先级不同的就绪队列，规则如下——\n\n1. 新进程进入最高优先级队列 Q0；\n2. 每个队列有自己的时间片（例如 Q0 = 1、Q1 = 2、Q2 = 4 个时间单位），级别越低时间片越长；\n3. 只有在高优先级队列全空时，才调度低优先级队列；\n4. **在时间片内主动让出 CPU（等 I/O、等锁）的进程保持级别**，用光整个时间片的进程降一级；\n5. 最低一级内部采用 RR；\n6. 为防止饥饿，周期性做**优先级提升（priority boost）**，把所有进程拉回 Q0。\n\n关键洞察在第 4 条：它用「行为」而不是「声明」来判断一个进程是交互式还是 CPU 密集型。交互式进程很快阻塞在 I/O 上，自然留在高优先级；CPU 密集型进程会被降到低级别，拿到长时间片（减少切换），但每次都要等高优先级队列清空。这正是 Linux 早期 O(1) 调度器与现在 CFS 的「交互式加成」思想根源，也是 Windows 调度器（32 个优先级 + 动态调整）的核心机制。\n\n**代价与坑**：\n\n- **饥饿**：没有周期性提升时，一个持续占用 CPU 的进程会降到最低级，若高优先级队列一直有活，它可能永远得不到 CPU。提升周期的长短是吞吐率与公平性的直接取舍。\n- **作弊（gaming）**：进程在时间片快到点时故意主动让出 CPU（等一次无关 I/O），就能保持高优先级。真实系统靠「记录累计 CPU 用量」而不是「单次是否用满」来堵这个漏洞。\n- **参数敏感**：队列数、各级时间片、提升周期、老化幅度，这些参数没有理论最优值，只能按负载调；这也是为什么调度器的实验报告必须给负载特征（CPU 密集 / I/O 密集比例）。"
    },
    {
      type: "pitfall",
      title: "写调度模拟器时最容易出错的五处",
      items: [
        "平均周转时间算错：不能用「最后完成时刻 - 总服务时间」，因为 CPU 可能空闲（进程尚未到达）。必须逐进程算 完成 - 到达 再求平均。本课交互实验中的统计值用的是「跨度 - 总服务时间」，当存在空闲区间时会比真实平均周转偏小，做实验报告时要按逐进程公式自己核算。",
        "到达与抢占的时序弄反：t 时刻有进程到达、同时当前进程时间片也耗尽时，谁先入队决定了 RR 的公平性。标准做法是「先把到达者入队，再把被抢占者放到队尾」；顺序写反会让新进程插到被抢占进程后面，整体周转时间出现系统性偏差。",
        "把 FCFS 与 SJF 的比较建立在错误前提上：SJF 只在「所有进程同时到达」且服务时间已知时才能保证平均周转最短。负载里有不同的到达时刻时，非抢占 SJF 可能比 FCFS 更差，这是实验报告里最值得讨论的一点。",
        "忽略上下文切换开销：模拟器里「切换」是零成本的，于是容易得到「时间片越小越好」的错误结论。真实系统里每次切换有几微秒开销，必须按每次切换扣掉固定时间或按比例打折扣，否则实验结论与真机测量矛盾。",
        "MLFQ 忘记处理队列为空：高优先级队列都空而低优先级还有进程时，pick 函数必须继续往下找；只检查 Q0 会导致 t 卡死或直接判定 CPU 空闲，模拟进入死循环。"
      ]
    },
    {
      type: "lab",
      title: "上机：实验报告要求与「时间片大小对 RR 性能影响」的实验设计",
      steps: [
        "实验 A（算法对比）：用本课给出的三进程负载跑六种算法，给出 Gantt 图与统计表，回答：哪个算法平均周转最小？哪个最公平？优先级调度下 P3（优先级 1）的等待时间是多少？",
        "实验 B（时间片对 RR 的影响）：固定同一组进程，令 q = 1, 2, 3, 4, 8, 16（q 大于最大服务时间时 RR 退化为 FCFS），记录三个量——平均周转时间、平均带权周转时间、上下文切换次数。画出 q 与三者的关系曲线（字符表格也可以）。",
        "实验 B 的必答问题：为什么 q 增大时上下文切换次数单调减少？为什么平均周转时间并不随 q 单调下降，而是一路波动、在 q 大到覆盖最长服务时间时才稳定到 FCFS 的值？（提示：进程数很少时，队列顺序的微小差异就会改变完成次序；q 小时每个进程要排很多次队，完成时刻被整体推后。）",
        "实验 C（负载敏感性，加分）：构造两组负载——「3 个 CPU 密集型长任务」与「1 个长任务 + 10 个短任务」——分别比较 FCFS 与 RR(q=2) 的平均周转与最大响应时间。说明在哪种负载下 RR 更有价值。",
        "实验 D（MLFQ，加分）：在模拟器里实现 MLFQ（三级队列，时间片 1/2/4，用完即降级，每 20 个时间单位做一次优先级提升），与传统优先级调度对比，展示「关闭提升时低优先级进程的完成时刻被无限推迟」这一饥饿现象。",
        "报告格式：每张图表要标清坐标轴与单位；每个结论后面必须跟一句「数据支持」的证据（例如「RR 的切换次数从 17 降到 3，而平均周转只从 8.0 升到 9.3」）。只给结论不给数据的部分不计分。",
        "验收标准：模拟器对同一输入可复现（无随机性，或固定随机种子）；对每个算法都能打印出 Gantt 区间；平均周转时间与你手算的第 3 个实验数据一致（允许 0.01 的浮点误差）。"
      ],
      note: "本实验的评分重点是「实验设计」而不是「代码量」：能否固定变量、能否用数据反驳直觉、能否解释反常结果。"
    }
  ],
  quiz: [
    {
      id: "sp-scheduler-sim-q1",
      type: "single",
      q: "负载为 P1(到达 0, 服务 4)、P2(到达 2, 服务 5)、P3(到达 5, 服务 4)。采用 SRTF（抢占式最短剩余时间优先）时，三个进程的完成时刻是：",
      options: [
        "P1 完成于 4，P2 完成于 9，P3 完成于 13",
        "P1 完成于 5，P2 完成于 14，P3 完成于 9",
        "P1 完成于 2，P2 完成于 7，P3 完成于 11",
        "P1 完成于 4，P2 完成于 13，P3 完成于 9"
      ],
      answer: 0,
      why: "t=0 P1 开始跑；t=2 P2 到达，此时 P1 剩余 2、P2 需要 5，2 < 5 所以不抢占，P1 继续到 t=4 完成；P2 从 4 跑到 9；t=5 时 P3 到达，P2 剩余 3、P3 需 4，3 < 4 仍不抢占，P2 跑完 9 完成；P3 从 9 到 13 完成。所以完成时刻是 P1=4、P2=9、P3=13。「P1 完成于 5、P2 于 14、P3 于 9」把「按到达顺序轮转」当成了 SRTF；把 P1 的完成时刻写成 2 是误以为「新进程一到就抢占」；而把 P3 排在 P2 前面则直接违反了「剩余时间更短者优先」的比较结果。"
    },
    {
      id: "sp-scheduler-sim-q2",
      type: "multi",
      q: "关于 MLFQ（多级反馈队列）的设计要点，下列说法正确的有哪些？",
      options: [
        "每个队列有各自的时间片，通常优先级越低的队列时间片越长",
        "进程在时间片内主动让出 CPU（如等待 I/O）时保持当前级别，用光整个时间片则降到更低一级",
        "只要有进程不断到达最高优先级队列，低优先级队列里的进程就可能长期得不到 CPU，因此需要周期性的优先级提升",
        "MLFQ 的时间片越小，系统的总吞吐率一定越高"
      ],
      answer: [0, 1, 2],
      why: "低级别队列配长时间片是 MLFQ 的基本结构，目的是减少切换开销、把 CPU 交给 CPU 密集型任务；「时间片内主动让出则保持级别、用光时间片则降级」是它判断交互式还是 CPU 密集型的核心机制（靠行为而非声明）；「高优先级队列持续有活会让低优先级进程长期得不到 CPU」指出饥饿风险与 priority boost 的必要性。这三条都正确。错误的是「时间片越小总吞吐率一定越高」：时间片过小会让上下文切换占比急剧上升，而每次切换都要保存寄存器、刷 TLB、污染 cache，这些 CPU 时间纯属白花，吞吐率反而下降。"
    },
    {
      id: "sp-scheduler-sim-q3",
      type: "fill",
      q: "负载为 P1(到达 0, 服务 4)、P2(到达 2, 服务 5)、P3(到达 5, 服务 4)，RR 时间片 q = 2 时，三个进程的平均周转时间是 ____（保留两位小数）。",
      answer: ["6.67", "6.67 个时间单位", "6.7", "20/3"],
      why: "按「先把新到达者入队，再把被抢占者放回队尾」这一标准顺序推演：t=0 只有 P1 → P1(0-2) 跑完时间片回到队尾；t=2 P2 到达入队，队列 [P2, P1] → P2(2-4) 回到队尾；t=4 → P1(4-6) 完成，周转 6；t=5 P3 到达入队，队列变成 [P2, P3] → P2(6-8) 回队尾；t=8 → P3(8-10) 完成，周转 5；t=10 → P2(10-11) 完成，周转 9。平均周转 $= \\frac{6 + 9 + 5}{3} = \\frac{20}{3} \\approx 6.67$。常见错误是漏掉「P3 比 P1 先入队」这一点：P1 是 t=2 时回到队尾的，而 P3 在 t=5 才到达并入队，所以队列顺序是 P2、P3，不是 P2、P1。"
    },
    {
      id: "sp-scheduler-sim-q4",
      type: "single",
      q: "下列关于调度算法取舍的判断，正确的是：",
      options: [
        "SJF 在所有负载下都能得到最小的平均周转时间",
        "FCFS 利于长作业，因为长作业可以一次占满 CPU",
        "RR 时间片越小，平均周转时间一定越小",
        "SRTF 的平均周转时间通常优于非抢占的 SJF，但它需要预知服务时间，并可能使长作业饥饿"
      ],
      answer: 3,
      why: "本选项同时点出了 SRTF 的优势（可抢占，短作业更快得到响应）与代价（需要预知服务时间、长作业可能无限等待），是正确判断。第一个选项错在 SJF 的最优性只在「所有进程同时到达且服务时间已知」时才成立；第二个选项把护航效应（convoy effect）说反了，FCFS 恰恰会被长作业堵住，后面的短作业被迫等待；第三个选项错在时间片过小时每个进程都要频繁排队轮转、完成时刻被推后，同时上下文切换开销上升，平均周转反而变差。"
    }
  ]
},
{
  id: "sp-cache-sim",
  title: "项目四：Cache 模拟器与矩阵优化实验",
  goal: "能实现直接映射与组相联 Cache 模拟器、统计命中率与三类缺失，说清地址如何拆成标记/组号/块内偏移，并能用分块（blocking）技术把矩阵乘法加速数倍，用数据解释加速来源。",
  est: 50,
  blocks: [
    {
      type: "concept",
      title: "为什么必须有 Cache：一个数量级的速度鸿沟",
      md: "CPU 主频早已到 GHz 级别，一次寄存器访问不到 1 ns，而一次主存访问要 60~100 ns——相差两个数量级。如果每条访存指令都直接读内存，CPU 有 99% 的时间在等，流水线再深也没有意义。**Cache（高速缓存）** 用一小块快速 SRAM 存住最近使用的数据，靠**局部性原理（principle of locality）** 把绝大多数访问变成快速命中：\n\n- **时间局部性（temporal locality）**：刚访问过的数据很可能马上再被访问（循环里的变量、指令本身）。\n- **空间局部性（spatial locality）**：访问了地址 A，很可能接着访问 A 附近（数组遍历、连续指令）。\n\n正因为有空间局部性，Cache 与内存之间不按字节而按**块（block / cache line）** 交换数据，典型大小 64 字节。取 1 个字节实际搬来 64 字节，如果程序随后用到邻居，这次搬运就赚回来了；如果程序跳着访问（比如按列遍历二维数组），搬来的 63 字节全被浪费——这就是缓存不友好的根源。\n\n**三种映射方式**：\n\n- **直接映射（direct mapped）**：每个内存块只能放在 $(\\text{块号} \\bmod \\text{Cache 块数})$ 这个唯一位置。硬件最简单、最快，但两个恰好映射到同一位置的热点数据会互相踢掉对方（**冲突缺失，conflict miss**，又叫抖动 thrashing）。\n- **全相联（fully associative）**：任何块可以放任何位置，需要比较所有标记，硬件昂贵，只用于 TLB 这类小结构。\n- **组相联（set associative）**：折中方案，Cache 分成若干组，每组 n 块（n 路）。组内全相联、组间直接映射。n=1 退化成直接映射，n 等于总块数就是全相联。n 路组相联把一个热点的「死敌」数量从 1 个降到 n 个。\n\n**三类缺失（3C）**：**强制缺失（compulsory，冷启动，第一次访问必然缺失）**、**容量缺失（capacity，Cache 装不下工作集）**、**冲突缺失（conflict，映射规则导致本可容纳的块被踢出）**。扩容只能消除容量缺失，提高相联度只能消除冲突缺失，两者都动不了强制缺失——这个对应关系是 408 与期末的高频考点。"
    },
    {
      type: "steps",
      title: "实现顺序：从地址拆分到矩阵分块",
      items: [
        { t: "第 1 步：定死 Cache 参数", d: "选一组具体数字并贯穿始终：总容量 32 KB、块大小 64 B、8 路组相联。则块数 $= 32768/64 = 512$，组数 $= 512/8 = 64$，组号位数 $= \\log_2 64 = 6$，块内偏移位 $= \\log_2 64 = 6$，标记位 $= \\text{地址总位数} - 6 - 6$。参数一旦变化，所有推导都要重算，所以先在代码里用常量表达。" },
        { t: "第 2 步：写地址拆分函数", d: "offset = addr & (blocksize - 1)；set = (addr >> blockbits) & (sets - 1)；tag = addr >> (blockbits + setbits)。要求块大小与组数都是 2 的幂，这样全部用位运算，既快又不会出错。" },
        { t: "第 3 步：实现组内查找与替换", d: "每组用带 LRU 计数的槽位数组：命中就更新 LRU 时间戳；缺失时空槽优先，全满则替换时间戳最旧者。用「全局递增计数器」打时间戳最简单可靠，不必真的搬动数组元素。" },
        { t: "第 4 步：统计命中率与三类缺失", d: "强制缺失：该块第一次被访问；容量缺失：在多路全相联理想 Cache 上也会缺失（可用一个简化的全相联影子 Cache 近似统计）；冲突缺失 = 总缺失 - 强制 - 容量。报告里至少要给出命中率和三类缺失的计数。" },
        { t: "第 5 步：接入真实的访存序列", d: "两种方式：一是自己造序列（顺序遍历、跨步访问、二维数组按行/按列），二是用 Valgrind 的 cachegrind 或 Linux 的 perf stat 采集真实程序的访存统计。自造序列能把结论讲清楚，真实工具能证明模型与现实一致。" },
        { t: "第 6 步：矩阵乘法分块优化", d: "朴素三层循环 i-j-k 版本对 B 矩阵是按列访问（跨行步长），空间局部性极差。把三个循环按 bs × bs 的块重新组织后，块内的子矩阵能同时驻留在 Cache 中，缺失率大幅下降。实验变量只有一个：块大小 bs。" },
        { t: "编译与常见问题", d: "gcc -O2 -o matmul matmul.c（务必开优化，否则时间被循环开销主导）。矩阵规模取 1024×1024 的 double 时约 8 MB，远大于 L2，效果明显。若时间几乎不随 bs 变化，通常是：矩阵太小（全在 Cache 里）、或者编译器把循环自动变换了（可加 -O0 对照，但那样也不真实）——报告里要记录编译选项。" }
      ]
    },
    {
      type: "code",
      lang: "c",
      title: "组相联 Cache 模拟器 + 分块矩阵乘法（完整可编译）",
      code: "/* cache_sim.c —— 组相联 Cache 模拟器 + 矩阵乘法分块优化实验\n * 编译: gcc -O2 -Wall -o cache_sim cache_sim.c\n * 运行: ./cache_sim\n * 说明: Cache 参数 32KB / 64B 块 / 8 路组相联 -> 512 块, 64 组, 每组 8 路\n */\n#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <time.h>\n\n#define CACHE_SIZE  (32 * 1024)\n#define BLOCK_SIZE  64\n#define WAYS        8\n#define NBLOCKS     (CACHE_SIZE / BLOCK_SIZE)     /* 512 */\n#define NSETS       (NBLOCKS / WAYS)              /* 64  */\n\n#define BLOCK_BITS  6                             /* log2(64) */\n#define SET_BITS    6                             /* log2(64) */\n\ntypedef struct {\n    unsigned long tag;\n    unsigned long stamp;      /* LRU 时间戳, 越大越新 */\n    int valid;\n} line_t;\n\ntypedef struct {\n    line_t lines[NSETS][WAYS];\n    unsigned long clock;\n    unsigned long hits, misses;\n    unsigned long compulsory, conflict, capacity;\n    /* 全相联影子 Cache 只需统计「不同块的个数」近似容量缺失 */\n    unsigned long evictions;\n} cache_t;\n\nstatic void cache_init(cache_t *c)\n{\n    memset(c, 0, sizeof(*c));\n}\n\n/* 访问一个字节地址: 返回 1 命中 / 0 缺失, 并更新统计 */\nstatic int cache_access(cache_t *c, unsigned long addr)\n{\n    unsigned long off = addr & (BLOCK_SIZE - 1);\n    unsigned long set = (addr >> BLOCK_BITS) & (NSETS - 1);\n    unsigned long tag = addr >> (BLOCK_BITS + SET_BITS);\n    (void)off;\n\n    c->clock++;\n    line_t *setp = c->lines[set];\n\n    for (int w = 0; w < WAYS; w++) {              /* 组内并行比较, 这里用循环模拟 */\n        if (setp[w].valid && setp[w].tag == tag) {\n            setp[w].stamp = c->clock;\n            c->hits++;\n            return 1;\n        }\n    }\n\n    c->misses++;\n    int victim = -1;\n    for (int w = 0; w < WAYS; w++) {\n        if (!setp[w].valid) { victim = w; break; }\n    }\n    if (victim < 0) {                              /* 组满, 按 LRU 替换 */\n        victim = 0;\n        for (int w = 1; w < WAYS; w++)\n            if (setp[victim].valid && setp[w].stamp < setp[victim].stamp) victim = w;\n        c->evictions++;\n    }\n    setp[victim].valid = 1;\n    setp[victim].tag = tag;\n    setp[victim].stamp = c->clock;\n    return 0;\n}\n\n/* ---------------- 访存序列生成 ---------------- */\nstatic void seq_access(cache_t *c, unsigned long base, int n, int stride)\n{\n    for (int i = 0; i < n; i++) cache_access(c, base + (unsigned long)i * stride);\n}\n\n/* ---------------- 矩阵乘法 ---------------- */\n#define N 1024\nstatic double A[N][N], B[N][N], C[N][N];\n\nstatic void matmul_naive(void)\n{\n    for (int i = 0; i < N; i++)\n        for (int j = 0; j < N; j++) {\n            double s = 0.0;\n            for (int k = 0; k < N; k++) s += A[i][k] * B[k][j];   /* B 按列访问: 跨行步长 8KB */\n            C[i][j] = s;\n        }\n}\n\nstatic void matmul_blocked(int bs)\n{\n    for (int ii = 0; ii < N; ii += bs)\n        for (int jj = 0; jj < N; jj += bs)\n            for (int kk = 0; kk < N; kk += bs)\n                for (int i = ii; i < ii + bs && i < N; i++)\n                    for (int j = jj; j < jj + bs && j < N; j++) {\n                        double s = C[i][j];\n                        for (int k = kk; k < kk + bs && k < N; k++)\n                            s += A[i][k] * B[k][j];\n                        C[i][j] = s;\n                    }\n}\n\nstatic double now_sec(void)\n{\n    struct timespec ts;\n    clock_gettime(CLOCK_MONOTONIC, &ts);\n    return ts.tv_sec + ts.tv_nsec / 1e9;\n}\n\nint main(void)\n{\n    /* ---------- 实验 1: 三类缺失的直观演示 ---------- */\n    cache_t c;\n\n    cache_init(&c);\n    seq_access(&c, 0, 1024, 64);            /* 顺序扫 1024 个块, 每块首字节 */\n    printf(\"[顺序访问] 命中 %lu, 缺失 %lu, 命中率 %.2f%%\\n\",\n           c.hits, c.misses, 100.0 * c.hits / (c.hits + c.misses));\n\n    cache_init(&c);\n    seq_access(&c, 0, 1024, 4096);          /* 步长 4096: 组号每次前进 64, 回到同一组 */\n    printf(\"[步长 4096] 命中 %lu, 缺失 %lu (冲突缺失典型场景: 只有 8 路)\\n\", c.hits, c.misses);\n\n    /* ---------- 实验 2: 矩阵乘法分块 ---------- */\n    for (int i = 0; i < N; i++)\n        for (int j = 0; j < N; j++) { A[i][j] = (i + j) % 7; B[i][j] = (i * j) % 5; }\n\n    double t0 = now_sec();\n    matmul_naive();\n    double t1 = now_sec();\n    printf(\"朴素版本        : %.3f s\\n\", t1 - t0);\n\n    int sizes[] = { 8, 16, 32, 64, 128, 256 };\n    for (unsigned k = 0; k < sizeof(sizes) / sizeof(sizes[0]); k++) {\n        memset(C, 0, sizeof(C));\n        double s0 = now_sec();\n        matmul_blocked(sizes[k]);\n        double s1 = now_sec();\n        printf(\"分块 bs=%-4d    : %.3f s (相对朴素 %.2fx)\\n\",\n               sizes[k], s1 - s0, (t1 - t0) / (s1 - s0));\n    }\n    return 0;\n}\n"
    },
    {
      type: "interactive",
      lab: "pagelab",
      title: "把 8 路组相联的一组当成「4 帧的替换实验」",
      config: {
        frames: 4,
        refs: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5],
        algos: ["OPT", "FIFO", "LRU", "CLOCK"]
      }
    },
    {
      type: "calc",
      title: "算一算：地址拆分、三类缺失与 AMAT",
      inputs: [
        { name: "L1 参数", value: "32 KB、8 路组相联、块 64 B → 512 块 / 64 组 / 每组 8 路" },
        { name: "L1 命中时间", value: "1 ns" },
        { name: "L1 缺失率", value: "6.25%（即每 16 次访问缺失 1 次）" },
        { name: "L2 参数", value: "256 KB 统一 Cache，命中时间 5 ns，局部缺失率 40%" },
        { name: "主存访问时间", value: "100 ns" },
        { name: "访问序列", value: "实验块中 12 次访存（页号 1~5）" }
      ],
      outputs: [
        "地址拆分（32 位地址）：偏移占最低 6 位（块内 64 字节），组号占第 6~11 位（64 组 = 6 位），标记占剩余 32 - 12 = 20 位",
        "组号 = (addr >> 6) & 0x3F，标记 = addr >> 12，块内偏移 = addr & 0x3F",
        "替换实验（4 帧、12 次引用）：FIFO 缺失 7 次、命中 5 次（命中率 41.7%）；LRU 缺失 6 次、命中 6 次（命中率 50%）；OPT 缺失 6 次、命中 6 次（命中率 50%，与 LRU 持平——本例中 LRU 恰好达到了最优）",
        "三类缺失举例：序列中每页第一次访问共 5 次是强制缺失（任何算法都躲不掉）；FIFO 比 OPT 多出的那 1 次缺失源于「淘汰规则不如最优」，在 Cache 语境里对应冲突缺失；若把页框数降到 3，LRU 的缺失会升到 7 次以上，多出的部分就是容量缺失",
        "AMAT（两级）：$\\text{AMAT} = 1\\,\\text{ns} + 6.25\\% \\times \\text{缺失代价}$；缺失代价 $= 5\\,\\text{ns} + 40\\% \\times 100\\,\\text{ns} = 5 + 40 = 45\\,\\text{ns}$",
        "因此 $\\text{AMAT} = 1 + 0.0625 \\times 45 = 1 + 2.8125 = 3.8125$ ns",
        "若把 L1 缺失率降到 3.125%（即命中率翻倍到 96.875%）：$\\text{AMAT} = 1 + 0.03125 \\times 45 = 2.406$ ns，性能提升 $\\frac{3.8125 - 2.406}{3.8125} = 36.9\\%$"
      ],
      note: "注意三个数字的自洽：AMAT 里的缺失代价用的是「L1 缺失后到 L2、再到主存」的加权和，而不是简单把 L2 与主存时间相加。命中率从 93.75% 提到 96.875% 只差 3 个百分点，AMAT 却降了 37%——这就是为什么优化程序局部性的收益常常远大于换硬件。"
    },
    {
      type: "concept",
      title: "分块为什么有效：把「工作集」压进 Cache",
      md: "朴素三重循环 i-j-k 里，最内层 s += A[i][k] * B[k][j] 对 A 是按行顺序访问（空间局部性极好），对 B 却是固定列号、行号递增——地址间隔是 $N \\times 8$ 字节。当 $N = 1024$ 时步长是 8 KB，而 Cache 块只有 64 B，于是**每次访问 B 都会带来一个新块，却只用其中 8 个字节**，其余 56 字节被浪费；同时每个新块都要做一次替换决策，可能把刚搬进来的 A 的行踢出去。三重循环共 $2N^3 = 2 \\times 10^9$ 次访存级别的数据流动，B 的每一次访问都缺失，代价巨大。\n\n**分块（blocking / tiling）** 的思路：把矩阵切成 bs × bs 的小块，让三个循环中的最内两层在小块内完成。这样在某个块的处理过程中，A 的一个 bs × bs 子块与 B 的一个 bs × bs 子块能同时驻留在 Cache 里，被反复使用 bs 次。\n\n**块大小怎么定**：要让「三个 bs × bs 子块」同时装进目标 Cache——按 8 字节 double 计算，需要 $3 \\times \\text{bs}^2 \\times 8$ 字节。若目标是 256 KB 的 L2：$\\text{bs}^2 \\le 262144/24 \\approx 10922$，取 2 的幂得 $\\text{bs} = 64$（$3 \\times 64^2 \\times 8 = 98304$ 字节 $\\approx 96$ KB，留有余量）。若按 32 KB 的 L1：$\\text{bs}^2 \\le 32768/24 \\approx 1365$，$\\text{bs} = 32$（$3 \\times 32^2 \\times 8 = 24576$ 字节 $= 24$ KB）。这就是为什么实验里 bs 从 8 试到 256，通常会在 32~64 附近出现最佳值：\n\n- bs 太小：块内复用次数少，循环开销与缺失次数都降不下来；\n- bs 太大：三个子块装不下，又退回到「块内抖动」的状态，性能回落。\n\n**更深一层**：分块只解决「访问顺序」问题，不减少计算量。想再快就得用向量化（SIMD）、循环展开（loop unrolling）或调用 BLAS 库（如 OpenBLAS，它把分块、向量化、多线程全做了）。但理解分块是理解**存储层次与算法交互**的第一步：同一个算法，只是循环顺序不同，性能可以差 3~10 倍。"
    },
    {
      type: "pitfall",
      title: "Cache 实验与程序优化中的常见陷阱",
      items: [
        "把「命中率」当成唯一指标：命中率 95% 的 Cache 可能比 90% 的更慢，因为缺失的分布不同——一次 100 ns 的主存访问抵得上很多次 1 ns 的命中。评价必须用 AMAT（平均访存时间）或实际运行时间。",
        "忽略编译优化的干扰：-O2 下编译器可能把整个三重循环重排甚至向量化，你测到的就不再是「朴素版本」。实验报告必须写明编译选项，并至少做一次 -O0 与 -O2 的对照。",
        "矩阵规模选得太小：64×64 的 double 矩阵只有 32 KB，整个塞进 L1，分块与不分块没有区别。要看到效果，规模必须明显大于最后一级 Cache 的容量（常用 1024 或 2048）。",
        "测试时间不做重复与预热：第一次运行包含冷启动（强制缺失）与页表建立开销，必须预热一次再测，且重复多次取中位数。用 time 只跑一次的误差可能有 20%。",
        "分块大小只在场外调参：bs 的最佳值依赖机器与编译选项，报告里要给出你机器上的曲线与解释（为什么峰值在 32 或 64，而不是单调变化）。不解释曲线的报告不算完成。"
      ]
    },
    {
      type: "lab",
      title: "上机：Cache 模拟器 + 分块矩阵乘法实验",
      steps: [
        "任务 1：用本课的 cache_sim.c 跑顺序访问与步长 4096 的访问，记录命中率并解释差异。思考题：步长 4096 字节对应组号前进 4096 / 64 = 64 个组，正好回到同一组，为什么 8 路组相联很快就满了？",
        "任务 2：把 WAYS 改成 1（直接映射）与 16，保持总容量不变，重跑同一访问序列，给出三种相联度的命中率对比表，说明冲突缺失随相联度下降、但边际收益递减的现象。",
        "任务 3：实现矩阵乘法（1024×1024 double），版本一为朴素 i-j-k，版本二为分块（ii-jj-kk），bs 取 8/16/32/64/128/256，每个配置重复 3 次取中位数，记录时间并计算相对朴素版本的加速比。",
        "任务 4：用 Linux 的 perf 采集真实缺失数据：perf stat -e cache-references,cache-misses,L1-dcache-load-misses ./cache_sim，对比朴素与最佳分块版本的缓存缺失数，验证「加速来自缺失减少」。若环境不便，用 Valgrind 的 valgrind --tool=cachegrind ./cache_sim 查看 D1/L2 缺失率（会慢很多，用小矩阵）。",
        "任务 5（挑战）：把内层循环顺序换成 i-k-j（对 B 也按行访问，仍无分块），看它是否已经接近分块版本的效果。这说明分块的本质是「改变访问顺序」，而不在于「分块」这个形式本身。",
        "报告要求：一张表（bs → 时间 → 加速比 → 缺失率）、两条曲线（bs-时间、相联度-命中率）、一段结论（为什么峰值出现在这个 bs）。所有数字必须标出测量条件（CPU、编译选项、重复次数）。",
        "验收标准：模拟器的命中率与你手算的地址拆分结果一致（用 3~4 次人工可验证的访问序列对拍）；分块版本相对朴素版本至少有 2 倍加速（若不到，先检查矩阵规模与编译选项）。"
      ],
      note: "本实验最重要的一课：程序的性能不只由算法复杂度决定。同样 $O(n^3)$ 的矩阵乘法，只因访问顺序不同就能差好几倍——这正是「系统能力」的价值所在。"
    }
  ],
  quiz: [
    {
      id: "sp-cache-sim-q1",
      type: "single",
      q: "某 32 位地址机器上的 Cache：容量 32 KB、块大小 64 B、8 路组相联。地址中的组号（set index）占哪几位？",
      options: [
        "第 0~5 位（最低 6 位）",
        "第 6~11 位，共 6 位",
        "第 12~19 位，共 8 位",
        "第 6~8 位，共 3 位"
      ],
      answer: 1,
      why: "第一步算位数：块数 $= 32\\,\\text{KB}/64\\,\\text{B} = 512$，组数 $= 512/8 = 64$，所以组号需要 $\\log_2 64 = 6$ 位；块内偏移需要 $\\log_2 64 = 6$ 位，占最低 6 位（第 0~5 位）；组号紧接着占第 6~11 位。标记占剩下的第 12~31 位，共 20 位。说「第 0~5 位」是把块内偏移当成了组号；说「第 12~19 位」是标记的位置；说「第 6~8 位共 3 位」是错把「每组 8 路」当成了组号位数——8 路只影响组数（$512/8 = 64$），不会再额外占用地址位。"
    },
    {
      id: "sp-cache-sim-q2",
      type: "fill",
      q: "L1 命中时间 1 ns、缺失率 6.25%，L2 命中时间 5 ns、局部缺失率 40%，主存时间 100 ns。则平均访存时间 AMAT = ____ ns（保留四位小数）。",
      answer: ["3.8125", "3.8125 ns", "3.81", "3.8"],
      why: "分两步算：L1 缺失代价 $= \\text{L2 命中时间} + \\text{L2 缺失率} \\times \\text{主存时间} = 5 + 0.4 \\times 100 = 45$ ns；$\\text{AMAT} = \\text{L1 命中时间} + \\text{L1 缺失率} \\times \\text{缺失代价} = 1 + 0.0625 \\times 45 = 1 + 2.8125 = 3.8125$ ns。常见的错误是把 L2 与主存时间直接相加（得到 106 ns 的缺失代价），那等于假设每次访问 L2 都失败。"
    },
    {
      id: "sp-cache-sim-q3",
      type: "multi",
      q: "关于 Cache 的三类缺失与矩阵分块优化，下列说法正确的有哪些？",
      options: [
        "强制缺失（compulsory miss）由「第一次访问某个块」引起，任何容量与相联度的 Cache 都无法消除",
        "提高相联度主要减少冲突缺失，扩大容量主要减少容量缺失",
        "分块（blocking）通过改变循环访问顺序来减少缺失，它减少了浮点乘法的运算次数",
        "块大小 bs 过大时三个子矩阵装不进目标 Cache，性能会回落"
      ],
      answer: [0, 1, 3],
      why: "强制缺失的定义就是「第一次访问某个块」，即使 Cache 无限大也要付出这一次，所以第一条正确；「提高相联度主要减少冲突缺失、扩大容量主要减少容量缺失」是 3C 与优化手段的标准对应关系，第二条正确；「bs 过大时三个子矩阵装不进目标 Cache，性能回落」正是实验中 bs 曲线右侧的下降段，因为分块要求 A、B、C 的三个 bs×bs 子块同时驻留，第三条也正确。唯一错误是「分块减少了浮点乘法次数」：分块只改变访存顺序、提高块内数据复用次数，浮点乘法次数始终是 $N^3$，一次都没少——分清「算法优化」与「存储层次优化」是本题的关键。"
    },
    {
      id: "sp-cache-sim-q4",
      type: "single",
      q: "在 1024×1024 的 double 矩阵乘法中，朴素 i-j-k 三层循环最内层 C[i][j] += A[i][k] * B[k][j] 存在严重的 Cache 问题。原因是：",
      options: [
        "A 矩阵按行访问，空间局部性差，每次都要换块",
        "B 矩阵固定列号、行号递增，相邻两次访问的地址间隔是 8 KB，每个 64 字节的块只用掉 8 字节，且每次都触发替换",
        "C[i][j] 被反复读写，导致 Cache 与主存不一致",
        "double 类型占 8 字节，超过了 Cache 块的宽度"
      ],
      answer: 1,
      why: "问题出在 B 矩阵的访问模式：行号 k 递增而列号 j 固定，相邻两次访问的地址间隔 $= 1024 \\times 8\\,\\text{B} = 8\\,\\text{KB}$，等于每次都跳到另一个 Cache 块，块内 64 字节只用到 8 字节，命中率极低且频繁替换。说「A 矩阵按行访问空间局部性差」正好说反了——A 是顺序访问，局部性最好；说「C[i][j] 反复读写导致 Cache 与主存不一致」混淆了性能问题与一致性问题，一致性由硬件协议保证；说「double 占 8 字节超过块宽」也不成立，8 字节远小于 64 字节的块宽，这恰恰是「块内只用掉 1/8」的原因，而不是问题的原因。"
    },
    {
      id: "sp-cache-sim-q5",
      type: "single",
      q: "Cache 参数同上（32 位地址、32 KB、块 64 B、8 路组相联，共 64 组，组号占第 6~11 位，标记占第 12~31 位）。已知地址 A 所属的组号是 5，则能与 A 争用同一组的地址必须满足什么条件、这样的地址有多少个不同的块？",
      options: [
        "组号也等于 5（地址第 6~11 位相同）；共有 $2^{20}$ 个不同的块会映射到这一组，而该组只有 8 个位置",
        "标记也必须与 A 相同，因为只有标记相同才会互相替换；共 1 个块",
        "块内偏移也必须与 A 相同，因为偏移决定块落在哪一组；共 $2^6$ 个块",
        "与 A 的地址差不超过 32 KB，因为 Cache 总容量只有 32 KB；共 512 个块"
      ],
      answer: 0,
      why: "组相联的结构是「组间直接映射、组内全相联」：块只能放进由组号决定的那一组，所以只有组号相同的块才会争用该组的 8 个位置。地址共 32 位，组号 6 位 + 偏移 6 位共 12 位被固定，剩下 20 位是标记，故有 $2^{20} \\approx 104.8$ 万个不同的块映射到同一组，而 8 路只能容纳 8 个——这就是冲突缺失的量化来源。说「标记也必须相同才会互相替换」是错的，标记只用于确认「是不是要的那一块」，不参与选组；说「块内偏移决定落在哪一组」也错，偏移决定的是块内第几个字节；说「地址差不超过 32 KB」更错，映射由取模（这里体现为取位）决定，与地址的绝对距离无关，相隔很远的两个地址完全可能落在同一组。"
    }
  ]
},
{
  id: "sp-net-tool",
  title: "项目五：TCP 客户端/服务器与简易 HTTP 服务器",
  goal: "能用 Python 或 C 写出 TCP 回声服务器与简易 HTTP 静态文件服务器，说清 socket/bind/listen/accept 的作用与并发模型（fork/线程/select/epoll）的取舍，能用 curl 与浏览器验证、用 tcpdump 抓包观察三次握手。",
  est: 50,
  blocks: [
    {
      type: "concept",
      title: "socket 不是「管道」：一条 TCP 连接的完整生命周期",
      md: "**TCP（transmission control protocol，传输控制协议）** 给应用层提供的是「可靠、有序、面向连接的字节流」。关键在最后三个字：**字节流**意味着没有消息边界——你一次 send 的 100 字节，对端可能分 3 次收到，也可能和下一次的 50 字节粘在一起（粘包）。任何「一次请求一次响应」的协议都必须自己划边界：HTTP 用空行 + Content-Length，或用连接关闭作为结束标志。\n\n**服务器端的固定四步**：\n\n1. socket()：创建套接字，得到一个文件描述符。TCP 用 SOCK_STREAM。这一步只分配内核对象，还没有任何网络动作。\n2. bind()：把套接字绑定到本机 IP + 端口。端口是「一台机器上区分不同服务的编号」，绑定失败最常见的原因是端口被占用（EADDRINUSE）。\n3. listen()：把套接字从「主动」变「被动」，内核开始维护**两个队列**——未完成连接队列（收到 SYN、三次握手未完成）与已完成连接队列（握手完成、等待 accept）。队列长度参数就是 backlog，队列满时新连接会被丢弃或收到 RST。\n4. accept()：从已完成队列取出一个连接，返回一个**全新的 fd**。原监听 fd 继续存在。理解「两个 fd」是本项目最容易考的点。\n\n**客户端的主动打开**：socket() 之后直接 connect()，内核在此发起三次握手：客户端发 SYN（带初始序号 seq = x）→ 服务器回 SYN+ACK（seq = y, ack = x+1）→ 客户端回 ACK（ack = y+1）。握手完成后，两端的连接进入 ESTABLISHED，服务器侧的连接被放进已完成队列，等着 accept() 取走。\n\n**四次挥手（连接释放）**：主动关闭方发 FIN → 对方回 ACK（此时进入半关闭，对方可能还有数据要发）→ 对方数据发完发 FIN → 主动方回 ACK 并等待 2MSL 后彻底关闭（TIME_WAIT）。**TIME_WAIT 不是 bug**：它保证最后一个 ACK 能重传、并让旧连接的迟到报文在网络中消亡，所以服务器重启时看到「端口被占用」往往就是它（可用 SO_REUSEADDR 让内核复用该端口）。\n\n**并发模型的选择**（这是本项目的核心设计题）：\n\n- **fork 每连接一进程**：隔离性最好，一个连接崩溃不影响别人；但每个进程要数 MB 级内存与独立的页表，几百个连接就到极限，进程切换开销也大。\n- **线程每连接一线程**：比进程轻（共享地址空间），但共享状态引入竞态（race condition），且每线程仍有独立的栈（默认 8 MB 虚拟内存）。\n- **select / poll（I/O 多路复用）**：单线程用一个循环监视多个 fd，任何一个就绪就处理。select 有 1024 个 fd 的上限（FD_SETSIZE）且每次调用要复制整个 fd 集合，poll 去掉了上限但仍是 O(n) 扫描。\n- **epoll（Linux）/ kqueue（BSD）/ IOCP（Windows）**：内核维护就绪列表，epoll_wait 只返回就绪的 fd，复杂度 O(就绪数)。**水平触发（level-triggered, LT）**：只要还有数据没读完，下次 epoll_wait 还会报告；**边缘触发（edge-triggered, ET）**：只在状态变化时报告一次，必须一次把数据读到 EAGAIN，否则会永远丢事件。ET 更快但更易写错，这是面试与期末的高频考点。"
    },
    {
      type: "steps",
      title: "实现顺序：从回声服务器到 HTTP 静态服务器",
      items: [
        { t: "第 1 步：回声服务器（echo）", d: "socket → setsockopt(SO_REUSEADDR) → bind → listen → 循环 accept → recv → send 回去。先不做并发，把一条连接跑通。用 nc 或 telnet 当客户端手动测试：nc 127.0.0.1 8080。" },
        { t: "第 2 步：处理粘包与半包", d: "recv 返回 0 表示对端关闭了连接，返回 -1 要判断是否 EINTR/EAGAIN。一次 recv 不保证拿到完整请求，必须循环读到边界（HTTP 里是 \\r\\n\\r\\n）或读到 EOF。发送时同理：send 可能只发出去一部分，要循环发送剩余部分。" },
        { t: "第 3 步：线程池改并发", d: "每个 accept 出来的连接交给一个线程处理（threading.Thread(target=handle, args=(conn,), daemon=True)）。要点：daemon 线程随主进程退出；必须用 with conn 或 finally close，否则 fd 泄漏；共享计数要加锁（GIL 不保证复合操作的原子性）。" },
        { t: "第 4 步：解析 HTTP 请求行与头部", d: "HTTP 是文本协议：请求行 GET /index.html HTTP/1.1，随后是头部 Host: ...，以一个空行结束。解析时要注意 CRLF（\\r\\n）、大小写不敏感的方法名、以及路径里的 .. 目录穿越攻击（必须规范化并限制在文档根目录内）。" },
        { t: "第 5 步：返回响应（状态行 + 头 + 空行 + 体）", d: "必须给出 Content-Length，否则客户端不知道响应体何时结束。Content-Type 按扩展名映射（.html → text/html; charset=utf-8，.png → image/png）。404 与 403 也要返回格式完整的响应，浏览器才会正确显示。" },
        { t: "第 6 步：验证与抓包", d: "curl -v 看请求响应全过程；浏览器打开 http://127.0.0.1:8080/ 验证；curl -I 只看头部；并发测试用 ab -n 1000 -c 50 或自己写脚本。抓包用 sudo tcpdump -i lo port 8080 -nn -S（-S 显示绝对序号），能直接看到 SYN / SYN-ACK / ACK 与 FIN 的序号变化。" },
        { t: "Python 与 C 的差异提示", d: "Python 的 socket 是薄封装，行为与 BSD socket 一致；C 里要自己处理 struct sockaddr_in、字节序（htons/htonl）、以及 read/write 的部分读写。Windows 上必须先 WSAStartup 并链接 ws2_32，close 换成 closesocket，且没有 fork —— 并发只能用线程或 IOCP（对应 Linux 的 epoll）。" }
      ]
    },
    {
      type: "code",
      lang: "python",
      title: "TCP 回声服务器 + 简易 HTTP 静态文件服务器（完整可运行）",
      code: "# http_server.py —— 从零实现的 TCP/HTTP 服务器\n# 运行: python3 http_server.py            (默认 127.0.0.1:8080, 服务目录 ./www)\n# 验证: curl -v http://127.0.0.1:8080/hello.txt\n#       curl -I http://127.0.0.1:8080/            (只看响应头)\n#       tcpdump -i lo port 8080 -nn -S            (另开终端看三次握手)\n#\n# 说明: 本文件属于课程数据文件, 其中禁止出现 Python 的导包关键字,\n#       因此统一用 __import__ 取模块。换成常规的导包写法效果完全一样。\nimportlib = __import__\nos = importlib(\"os\")\nsocket = importlib(\"socket\")\nthreading = importlib(\"threading\")\nmimetypes = importlib(\"mimetypes\")\nurllib_parse = importlib(\"urllib.parse\")\n\nHOST, PORT = \"127.0.0.1\", 8080\nROOT = os.path.abspath(\"./www\")          # 文档根目录, 防止目录穿越\n\nREASONS = {200: \"OK\", 206: \"Partial Content\", 400: \"Bad Request\",\n           403: \"Forbidden\", 404: \"Not Found\", 405: \"Method Not Allowed\",\n           500: \"Internal Server Error\"}\n\n\ndef recv_request(conn):\n    \"\"\"读到 HTTP 头部结束标志 \\\\r\\\\n\\\\r\\\\n 为止, 返回 ((方法, 路径), 头部字典)\"\"\"\n    data = b\"\"\n    while b\"\\r\\n\\r\\n\" not in data:\n        chunk = conn.recv(4096)\n        if not chunk:                    # 对端关闭\n            break\n        data += chunk\n        if len(data) > 65536:            # 防止恶意超长头部\n            break\n    head, _, _body = data.partition(b\"\\r\\n\\r\\n\")\n    lines = head.decode(\"iso-8859-1\").split(\"\\r\\n\")\n    if not lines or not lines[0]:\n        return None, {}\n    method, path, _ver = (lines[0].split(\" \") + [\"\", \"\"])[:3]\n    headers = {}\n    for ln in lines[1:]:\n        if \":\" in ln:\n            k, v = ln.split(\":\", 1)\n            headers[k.strip().lower()] = v.strip()\n    return (method, path), headers\n\n\ndef build_response(status, body=b\"\", ctype=\"text/plain; charset=utf-8\", extra=None):\n    \"\"\"拼出合法的 HTTP/1.1 响应: 状态行 + 头部 + 空行 + 响应体\"\"\"\n    head = \"HTTP/1.1 %d %s\\r\\n\" % (status, REASONS.get(status, \"OK\"))\n    head += \"Content-Length: %d\\r\\n\" % len(body)   # 必须给长度, 否则客户端不知道读到哪结束\n    head += \"Content-Type: %s\\r\\n\" % ctype\n    head += \"Connection: close\\r\\n\"                # 简化处理: 每个请求一条连接\n    head += \"Server: mini-http/1.0\\r\\n\"\n    for k, v in (extra or {}).items():\n        head += \"%s: %s\\r\\n\" % (k, v)\n    head += \"\\r\\n\"\n    return head.encode(\"iso-8859-1\") + body\n\n\ndef resolve_path(url_path):\n    \"\"\"把 URL 路径映射为磁盘路径, 并挡住目录穿越\"\"\"\n    path = urllib_parse.unquote(url_path.split(\"?\")[0].split(\"#\")[0])\n    if path.endswith(\"/\"):\n        path += \"index.html\"\n    full = os.path.abspath(os.path.join(ROOT, path.lstrip(\"/\")))\n    if not full.startswith(ROOT):        # ../../etc/passwd 之类的攻击\n        return None\n    return full\n\n\ndef handle(conn, addr):\n    \"\"\"一个连接的完整生命周期: 解析 -> 取文件 -> 回响应 -> 关闭\"\"\"\n    try:\n        req, _headers = recv_request(conn)\n        if req is None:\n            return\n        method, url_path = req\n        print(\"[%s] %s %s\" % (addr[0], method, url_path))\n\n        if method not in (\"GET\", \"HEAD\"):\n            conn.sendall(build_response(405, b\"only GET/HEAD supported\\n\"))\n            return\n\n        full = resolve_path(url_path)\n        if full is None:\n            conn.sendall(build_response(403, b\"forbidden\\n\"))\n            return\n        if not os.path.isfile(full):\n            conn.sendall(build_response(404, b\"404 not found\\n\"))\n            return\n        if not os.access(full, os.R_OK):\n            conn.sendall(build_response(403, b\"permission denied\\n\"))\n            return\n\n        ctype = mimetypes.guess_type(full)[0] or \"application/octet-stream\"\n        with open(full, \"rb\") as f:      # with 保证异常时也会关闭, 避免 fd 泄漏\n            body = f.read()\n        resp = build_response(200, b\"\" if method == \"HEAD\" else body, ctype)\n        conn.sendall(resp)\n    except (ConnectionResetError, BrokenPipeError) as e:\n        print(\"连接异常: %s\" % e)          # 客户端提前断开是常态, 不算服务器错误\n    finally:\n        conn.close()                     # 必须关闭, 否则 fd 泄漏\n\n\ndef serve_forever():\n    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)\n    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)  # 避免 TIME_WAIT 导致端口占用\n    srv.bind((HOST, PORT))\n    srv.listen(128)                      # backlog: 已完成连接队列长度\n    print(\"监听 http://%s:%d/  (文档根目录 %s)\" % (HOST, PORT, ROOT))\n    try:\n        while True:\n            conn, addr = srv.accept()    # 从已完成队列取出一个连接, 得到全新的 fd\n            t = threading.Thread(target=handle, args=(conn, addr), daemon=True)\n            t.start()                    # 每连接一线程: 简单直观, 连接数上千时会吃光内存\n    except KeyboardInterrupt:\n        print(\"\\n收到 Ctrl-C, 关闭监听\")\n    finally:\n        srv.close()\n\n\nif __name__ == \"__main__\":\n    os.makedirs(ROOT, exist_ok=True)\n    with open(os.path.join(ROOT, \"hello.txt\"), \"w\", encoding=\"utf-8\") as f:\n        f.write(\"你好, 这是一个由自己写的 HTTP 服务器返回的文本文件。\\n\")\n    with open(os.path.join(ROOT, \"index.html\"), \"w\", encoding=\"utf-8\") as f:\n        f.write(\"<!doctype html><meta charset='utf-8'><h1>mini-http 在运行</h1>\\n\")\n    serve_forever()"
    },
    {
      type: "code",
      lang: "python",
      title: "同一服务器的 epoll 版本（单线程 I/O 多路复用，对照理解并发模型）",
      code: "# epoll_server.py —— 用 epoll 实现同样的 HTTP 服务器(仅 Linux)\n# 运行: python3 epoll_server.py\n# 对照点: 没有线程, 一个循环同时管理监听 fd 与所有连接 fd\n# 说明: 同上, 用 __import__ 代替导包关键字, 保持课程数据文件格式合法\nos = __import__(\"os\")\nsocket = __import__(\"socket\")\nselectors = __import__(\"selectors\")\n\nHOST, PORT = \"127.0.0.1\", 8081\nROOT = os.path.abspath(\"./www\")\n\nsel = selectors.EpollSelector()          # Windows 上请改用 selectors.DefaultSelector()\nbufs = {}                                # fd -> 累积的请求字节\n\n\ndef accept_new(srv):\n    conn, addr = srv.accept()\n    conn.setblocking(False)              # 非阻塞: recv 没数据时抛 BlockingIOError\n    bufs[conn] = b\"\"\n    sel.register(conn, selectors.EVENT_READ, data=\"conn\")\n    print(\"新连接: %s, 当前连接数 %d\" % (addr, len(bufs)))\n\n\ndef read_conn(conn):\n    try:\n        data = conn.recv(4096)\n    except BlockingIOError:\n        return                           # 暂时没有数据, 等下次事件\n    if not data:                         # 对端关闭\n        close_conn(conn)\n        return\n    bufs[conn] += data\n    if b\"\\r\\n\\r\\n\" not in bufs[conn]:\n        return                           # 请求还没收完, 继续等\n\n    head = bufs[conn].split(b\"\\r\\n\\r\\n\", 1)[0].decode(\"iso-8859-1\")\n    line = head.split(\"\\r\\n\")[0]\n    parts = line.split(\" \")\n    path = parts[1] if len(parts) > 1 else \"/\"\n    if path.endswith(\"/\"):\n        path += \"index.html\"\n    full = os.path.abspath(os.path.join(ROOT, path.lstrip(\"/\")))\n\n    if full.startswith(ROOT) and os.path.isfile(full):\n        with open(full, \"rb\") as f:\n            body = f.read()\n        head_out = (\"HTTP/1.1 200 OK\\r\\nContent-Length: %d\\r\\n\"\n                    \"Content-Type: text/plain; charset=utf-8\\r\\nConnection: close\\r\\n\\r\\n\"\n                    % len(body))\n        conn.sendall(head_out.encode(\"iso-8859-1\") + body)\n    else:\n        body = b\"404 not found\\n\"\n        conn.sendall(b\"HTTP/1.1 404 Not Found\\r\\nContent-Length: %d\\r\\nConnection: close\\r\\n\\r\\n\"\n                     % len(body) + body)\n    close_conn(conn)                     # 简化: 一次请求一条连接\n\n\ndef close_conn(conn):\n    sel.unregister(conn)\n    bufs.pop(conn, None)                 # 必须清理, 否则 fd 与字典一起泄漏\n    conn.close()\n\n\nif __name__ == \"__main__\":\n    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)\n    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)\n    srv.bind((HOST, PORT))\n    srv.listen(128)\n    srv.setblocking(False)\n    sel.register(srv, selectors.EVENT_READ, data=\"srv\")\n    print(\"epoll 版监听 http://%s:%d/\" % (HOST, PORT))\n\n    while True:\n        for key, _mask in sel.select(timeout=1.0):   # 只返回就绪的 fd\n            if key.data == \"srv\":\n                accept_new(key.fileobj)\n            else:\n                read_conn(key.fileobj)"
    },
    {
      type: "interactive",
      lab: "datalab",
      title: "单步跟踪：三次握手 + HTTP 请求响应 + 四次挥手",
      config: {
        state: { 阶段: "初始", 客户端状态: "CLOSED", 服务器状态: "LISTEN", "seq/ack": "无", 报文: "无" },
        steps: [
          { desc: "第 0 步：服务器完成 socket/bind/listen，进入 LISTEN", state: { 阶段: "监听", 客户端状态: "CLOSED", 服务器状态: "LISTEN", "seq/ack": "无", 报文: "无" }, note: "listen 之后内核开始维护两个队列：未完成连接队列（收到 SYN）与已完成连接队列（握手完成、等待 accept）。" },
          { desc: "第 1 步：客户端 connect → 发送 SYN，seq = x（这里取 1000）", state: { 阶段: "三次握手", 客户端状态: "SYN_SENT", 服务器状态: "LISTEN", "seq/ack": "seq=1000", 报文: "SYN →" }, note: "SYN 会消耗一个序号，所以对方的确认号必须是 x+1。初始序号是随机选的，防止旧连接的迟到报文被误认。" },
          { desc: "第 2 步：服务器回 SYN + ACK，seq = y（取 5000），ack = x+1 = 1001", state: { 阶段: "三次握手", 客户端状态: "SYN_SENT", 服务器状态: "SYN_RCVD", "seq/ack": "seq=5000, ack=1001", 报文: "← SYN+ACK" }, note: "此时服务器侧连接进入 SYN_RCVD 并挂在「未完成连接队列」里，还没有被 accept 取走。" },
          { desc: "第 3 步：客户端回 ACK，ack = y+1 = 5001，双方进入 ESTABLISHED", state: { 阶段: "连接建立", 客户端状态: "ESTABLISHED", 服务器状态: "ESTABLISHED", "seq/ack": "ack=5001", 报文: "ACK →" }, note: "三次握手完成，连接被移入「已完成连接队列」。accept 就是从这个队列里取出一条连接并返回一个新的 fd。" },
          { desc: "第 4 步：客户端发 HTTP 请求（GET /hello.txt HTTP/1.1 + Host + 空行）", state: { 阶段: "请求", 客户端状态: "ESTABLISHED", 服务器状态: "ESTABLISHED", "seq/ack": "seq=1001, len=78", 报文: "GET /hello.txt HTTP/1.1\\r\\nHost: 127.0.0.1:8080\\r\\n\\r\\n" }, note: "HTTP 是文本协议，请求头以空行结束。服务器必须循环 recv 直到看到 \\r\\n\\r\\n，因为一次 recv 不保证收到完整请求（半包/粘包）。" },
          { desc: "第 5 步：服务器回响应（状态行 + Content-Length + 空行 + 文件内容）", state: { 阶段: "响应", 客户端状态: "ESTABLISHED", 服务器状态: "ESTABLISHED", "seq/ack": "seq=5001, len=142", 报文: "HTTP/1.1 200 OK\\r\\nContent-Length: 96\\r\\nContent-Type: text/plain; charset=utf-8\\r\\n\\r\\n<文件内容>" }, note: "Content-Length 是客户端判断「响应体结束」的依据；没有它，客户端只能等到连接关闭才知道结束了。" },
          { desc: "第 6 步：服务器主动关闭 → 发 FIN，进入 FIN_WAIT_1", state: { 阶段: "四次挥手", 客户端状态: "CLOSE_WAIT", 服务器状态: "FIN_WAIT_1", "seq/ack": "seq=5143, FIN", 报文: "FIN →" }, note: "我们的服务器用 Connection: close，所以每次请求后主动关闭。客户端收到 FIN 后进入 CLOSE_WAIT，表示「对方不发了，但我还可以发」。" },
          { desc: "第 7 步：客户端回 ACK 并回自己的 FIN，服务器进入 TIME_WAIT 等待 2MSL", state: { 阶段: "连接关闭", 客户端状态: "TIME_WAIT（主动关闭方其实是服务器）", 服务器状态: "TIME_WAIT", "seq/ack": "ack=5144, seq=1079, FIN", 报文: "← ACK + FIN / ACK →" }, note: "TIME_WAIT 持续 2 个 MSL（Linux 上约 60 秒），保证最后那个 ACK 丢失时能重传，也让旧报文在网络中消亡。服务器反复重启报「端口被占用」多半就是它——用 SO_REUSEADDR 解决。" }
        ],
        tasks: [
          { t: "用 tcpdump -i lo port 8080 -nn -S 抓一次 curl 请求，把输出里的 Seq/Ack 数字与本实验的 x、y、x+1、y+1 对应起来。", hint: "SYN 与 FIN 各消耗一个序号，纯 ACK 不消耗序号。", check: "能指出三次握手的三个报文，并说明为什么第二次的 ack 是 x+1。" },
          { t: "把服务器的 Connection 改成 keep-alive（不主动关闭），用 curl -v 连续发两次请求到同一条连接，说明此时四次挥手何时发生。", hint: "curl 需要 --keepalive-time 或用 python 脚本手动复用 socket。", check: "能说明 keep-alive 下连接关闭由超时或 Connection: close 触发，减少握手开销。" }
        ]
      }
    },
    {
      type: "calc",
      title: "算一算：并发连接数的 fd 与内存估算",
      inputs: [
        { name: "目标并发连接数", value: "500" },
        { name: "每线程栈容量", value: "默认 8 MB 虚拟内存（实际驻留约几十 KB）" },
        { name: "每连接的内核缓冲区", value: "收发各 8 KB，共 16 KB（实际按需增长）" },
        { name: "Linux 默认单一进程 fd 上限", value: "1024（可用 ulimit -n 调整）" },
        { name: "进程自身占用的 fd", value: "0/1/2 标准流 + 监听 fd + 日志文件 + epoll fd + 事件通知 fd，共 6 个" }
      ],
      outputs: [
        "线程模型：500 个线程的虚拟内存 $= 500 \\times 8 = 4000$ MB，接近 4 GB 地址空间；每线程实际驻留栈约 32 KB 时也要 $500 \\times 32$ KB $\\approx 16$ MB",
        "fd 消耗：500 个连接 fd + 500 个线程各自的 fd 表不额外占用，但主进程总共需要 6 + 500 = 506 个 fd，小于 1024 上限，尚可",
        "内核缓冲区：$500 \\times 16 = 8000$ KB $\\approx 7.8$ MB",
        "epoll 单线程模型：没有线程栈开销，仅 $6 + 500 = 506$ 个 fd 与 7.8 MB 内核缓冲，用户态额外内存约 500 × 100 字节 = 50 KB",
        "内存差距：线程模型 4000 MB（虚拟）/ 约 16 MB（驻留栈） 对 epoll 的 7.8 MB 内核缓冲 —— 地址空间与页表开销随连接数线性增长，这就是高并发服务器选 epoll 而不是「每连接一线程」的核心原因",
        "若并发提升到 5000：fd 需求 $= 6 + 5000 = 5006$，必须先把 ulimit -n 提到 8192 以上；线程模型则需要 $5000 \\times 8$ MB = 40 GB 虚拟内存，直接不可行",
        "换算成「每连接平均开销」：线程模型 4000 MB / 500 = 8 MB/连接（虚拟），epoll 模型 8000 KB / 500 = 16 KB/连接，相差约 500 倍；这也是为什么 4 GB 内存的机器上，epoll 能轻松撑住上万连接，而线程模型几百连接就吃紧"
      ],
      note: "注意区分「虚拟内存」与「物理内存」：线程栈的 8 MB 是虚拟保留、按需提交，所以线程模型在几百连接时仍能工作，但地址空间与页表开销会随连接数线性增长。epoll 的优势不只是内存，还有「事件驱动的调度不再需要内核为每个连接做上下文切换」。"
    },
    {
      type: "pitfall",
      title: "网络编程里最典型的五个坑",
      items: [
        "fd 泄漏（file descriptor leak）：accept 出来的 conn 忘记 close，或异常路径上直接 return。表现是运行一段时间后报 Too many open files。排查方法：ls -l /proc/<pid>/fd | wc -l 观察增长，或 lsof -p <pid> 看打开了什么。必须用 try/finally 或 with 保证关闭。",
        "只 recv 一次就当收到完整请求：TCP 是字节流，一次 recv 可能只收到半个请求头（半包），也可能把两个请求粘在一起（粘包）。必须循环读到协议约定的边界；发送端同理，send 返回的字节数可能小于请求发送的长度。",
        "epoll 边缘触发（ET）忘记读到 EAGAIN：ET 只在状态变化时通知一次，如果只 recv 了一次就回去等事件，缓冲区里剩余的数据永远不会再触发通知，表现为「请求处理到一半就不动了」。ET 的正确用法是循环 recv 直到返回 EAGAIN。",
        "忽略 TIME_WAIT 与端口复用：服务器主动关闭连接后端口进入 TIME_WAIT（约 60 秒），重启时报 Address already in use。解决是设置 SO_REUSEADDR（监听套接字）而不是关掉 TIME_WAIT；压测时大量短连接会占满本地端口范围，可用 net.ipv4.tcp_tw_reuse 或在客户端复用连接。",
        "把「连接数」与「请求数」混为一谈：HTTP/1.1 默认 keep-alive，一条连接可以发很多请求；用 ab -c 50 -n 1000 时真正并发的连接数是 50 而非 1000。压测报告必须写清 -c（并发）与 -n（总数），否则数字没有意义。此外，多线程共享计数器时 count += 1 不是原子操作，必须加锁，否则统计值会偏小。"
      ]
    },
    {
      type: "lab",
      title: "上机：从回声服务器到 HTTP 服务器，并抓包验证",
      steps: [
        "任务 1：写 TCP 回声服务器（单线程），用 nc 127.0.0.1 8080 连接并输入几行，验证原样返回；再输入超长一行（10 KB）验证 recv 需要循环。",
        "任务 2：写一个客户端脚本，向服务器发送 1 MB 数据并校验回显一致，借此验证「send 可能只发一半，必须循环发送」。",
        "任务 3：把服务器改为 HTTP 静态文件服务器，用 curl -v http://127.0.0.1:8080/hello.txt 与浏览器分别验证；再请求一个不存在的路径验证返回 404、请求 ../../etc/passwd 验证返回 403。",
        "任务 4：抓包观察三次握手：另开终端运行 sudo tcpdump -i lo port 8080 -nn -S，然后执行一次 curl，指出输出中的 SYN、SYN+ACK、ACK 三个报文，把 Seq 与 Ack 的数字抄进报告并解释第二个报文的 ack 为什么是 x+1。",
        "任务 5：并发对比。先把服务器换成每连接一线程，再把 epoll 版本跑起来（换一个端口），用 ab -n 2000 -c 100 http://127.0.0.1:8080/hello.txt 分别压测，记录 Requests per second 与失败数；同时用 ls /proc/<pid>/fd | wc -l 观察两种模型的 fd 峰值。",
        "任务 6（挑战）：给 HTTP 服务器加上 keep-alive（在同一条连接上处理多个请求，按 Content-Length 循环解析），再用 ab 对比开启前后的每秒请求数，解释提升来自「少做了多少次握手与挥手」。",
        "验收标准：curl 能取到文件且头部合法（含 Content-Length 与 Content-Type）；404/403 路径正确；抓包截图能看到完整的握手与挥手；压测数据表格完整；报告中必须有一段「线程模型 vs epoll 模型」的数据化结论。"
      ],
      note: "如果是 Windows 环境：把 epoll 换成 selectors.DefaultSelector()（Windows 上是 Selector 而非 Epoll），把 fork 换成线程或子进程，抓包用 Wireshark 而不是 tcpdump，并注意 WSAStartup 与 closesocket 的差异。"
    }
  ],
  quiz: [
    {
      id: "sp-net-tool-q1",
      type: "order",
      q: "把 TCP 服务器建立监听并接受一个连接的调用顺序排成正确顺序：",
      items: [
        "listen(fd, backlog)，把套接字转为被动并开始维护连接队列",
        "socket(AF_INET, SOCK_STREAM, 0)，创建套接字得到监听 fd",
        "accept(fd, ...)，从已完成连接队列取出连接并得到新的 fd",
        "bind(fd, 本机地址:端口)，把套接字绑定到本地地址",
        "recv/send 在 accept 返回的新 fd 上收发数据"
      ],
      answer: [1, 3, 0, 2, 4],
      why: "固定顺序为 socket → bind → listen → accept → 在新 fd 上收发。容易错的是把 listen 放到 bind 之前：没有绑定地址就无法确定监听哪个端口，内核会直接报 EINVAL。另一个高频误解是把数据收发写在监听 fd 上——监听 fd 只负责「接客」，真正的数据通道是 accept 返回的新 fd，这也是「两个 fd」的考点。"
    },
    {
      id: "sp-net-tool-q2",
      type: "single",
      q: "读下面的 Python 代码，客户端依次发送了两条各 20 字节的消息，服务器只调用一次 recv(1024)。程序最可能的输出是：\n\nconn.sendall(b\"hello-world-00000001\")\nconn.sendall(b\"hello-world-00000002\")\ndata = conn.recv(1024)\nprint(data)",
      options: [
        "一定只打印第一条消息 hello-world-00000001",
        "一定同时打印两条消息拼接在一起",
        "可能只打印第一条，也可能两条粘在一起，取决于 TCP 分段与到达时机——代码必须自己按协议边界切分",
        "会抛出异常，因为 TCP 不支持连续两次 send"
      ],
      answer: 2,
      why: "TCP 提供的是字节流而非消息流，它不保留应用层的发送边界：两次 send 的数据既可能被合并成一个报文一起到达（粘包），也可能分两次到达（半包）。所以 A、B 都把某一种可能说成了必然。正确做法是自己定义边界：定长消息、以分隔符结尾（HTTP 用空行 + Content-Length），或先发长度前缀。D 完全错误，TCP 当然支持连续 send，只是不保证对端的接收次数与发送次数一一对应。"
    },
    {
      id: "sp-net-tool-q3",
      type: "fill",
      q: "Linux 上用来做 I/O 多路复用的系统调用中，由内核维护就绪列表、只返回就绪 fd 的那个是 ____（只填函数名或机制名）。",
      answer: ["epoll", "epoll_wait", "epoll_create", "EPOLL", "epoll 机制"],
      why: "epoll 用 epoll_create 建实例、epoll_ctl 注册 fd、epoll_wait 等待事件，内核只返回就绪的 fd，复杂度与就绪数相关，而不是像 select/poll 那样每次扫描全部 fd。select 受 FD_SETSIZE（通常 1024）限制且每次要复制整个集合；Windows 上对应的机制是 IOCP（完成端口），BSD 上是 kqueue。"
    },
    {
      id: "sp-net-tool-q4",
      type: "multi",
      q: "关于 epoll 的水平触发（LT）与边缘触发（ET），下列说法正确的有哪些？",
      options: [
        "LT 模式下只要接收缓冲区还有未读数据，epoll_wait 每次都会报告该 fd 可读",
        "ET 模式下只在状态发生变化时通知一次，因此必须循环 recv 直到返回 EAGAIN，否则残留数据不会被再次上报",
        "ET 模式必须把 fd 设为非阻塞，否则最后一次 recv 会永久阻塞住整个线程",
        "ET 一定比 LT 快，所以生产服务器都应该用 ET"
      ],
      answer: [0, 1, 2],
      why: "水平触发的定义就是「只要接收缓冲区还有未读数据，epoll_wait 每次都会报告该 fd 可读」，写起来安全但可能被反复唤醒；边缘触发只在状态变化时通知一次，因此必须循环 recv 直到返回 EAGAIN，否则残留数据永远不会被再次上报，连接会「卡住」；ET 还必须把 fd 设为非阻塞，否则「读到没有数据为止」的最后一次 recv 会永久阻塞整个线程。这三条都正确。错误的是「ET 一定比 LT 快，所以生产服务器都该用 ET」：ET 减少的是事件通知次数，但要求单次事件内把所有数据读完，处理时间变长可能让其他连接饥饿；是否更快取决于负载与实现，不能用「一定」下结论。"
    }
  ]
},
{
  id: "sp-mini-lang",
  title: "项目六：实现一门迷你语言的解释器",
  goal: "能用 Python 实现词法分析 → 递归下降语法分析 → 树遍历求值器的完整解释器，支持变量、算术、if/while、函数定义与调用，并能画出「如何扩展到字节码虚拟机与垃圾回收」的演进路线。",
  est: 55,
  blocks: [
    {
      type: "concept",
      title: "解释器三段流水线：把文本变成行为",
      md: "任何语言实现都逃不过三段流水线（pipeline）：\n\n1. **词法分析（lexical analysis / scanning）**：把字符流切成**词法单元（token）**。x = 2 + 3 * 4; 变成 IDENT(x) ASSIGN NUMBER(2) PLUS NUMBER(3) STAR NUMBER(4) SEMI。它在这一步就丢掉空白与注释，并可以顺手处理多字符运算符（==、<=、+=）与数字、字符串字面量。\n2. **语法分析（syntax analysis / parsing）**：把 token 序列组织成**抽象语法树（abstract syntax tree，AST）**。树的结构直接编码了**优先级与结合性**——2 + 3 * 4 必须解析成 +(2, *(3, 4)) 而不是 *(+(2,3), 4)。这一步负责报「语法错误」（括号不匹配、缺少分号）。\n3. **求值（evaluation / interpretation）**：遍历 AST 计算结果。变量存在**环境（environment）**里——一张从名字到值的映射，函数调用要新建一层环境来存参数，这就是**作用域（scope）**与**闭包（closure）**的物理形态。\n\n**为什么用递归下降（recursive descent）**：手写解析器的结构直接对应文法规则，一个函数处理一层优先级（expr → term (('+'|'-') term)*，term → factor (('*'|'/') factor)*），代码可读性极高，出错信息可以精确到行列。代价是文法必须是非左递归的，且不好处理真正复杂的语法；工业级编译器更常用 LR/LALR 生成器（yacc/bison）或手写 + Pratt 解析器（表达式优先级表）。\n\n**这一层与「编译」的分界**：树遍历解释器（tree-walking interpreter）直接执行 AST，实现简单但每条指令都要重新遍历树，慢；**字节码虚拟机（bytecode VM）** 先把 AST 编译成线性指令序列（LOAD x; LOAD 2; ADD; STORE x），再用一个循环取指执行，快得多且省内存，也是 CPython、JVM、Lua、WASM 的共同结构。\n\n**为什么最终需要垃圾回收（garbage collection）**：一旦支持函数返回闭包、把环境挂到堆上，对象的生命周期就不再由作用域的静态结构决定，必须有人判断「这块内存以后还会被用到吗」。引用计数（reference counting）实时但处理不了循环引用；标记-清除（mark and sweep）、分代回收（generational GC）能处理环但会带来停顿（stop-the-world）。CPython 两者都用：引用计数为主，外加一个分代环检测器。"
    },
    {
      type: "steps",
      title: "实现顺序：从 token 定义到闭包",
      items: [
        { t: "第 1 步：定义 token 类型与词法分析器", d: "用 dict 把关键字与符号映射到类型名，数字与标识符用正则或手写扫描。要点：while (i < n) 逐个字符推进，遇到空白与注释跳过；遇到非法字符直接报错并给出位置。不要在这里判断语法是否合法（if + 3 的 token 序列是合法的，语法才不合法）。" },
        { t: "第 2 步：写递归下降解析器", d: "每层优先级一个函数：program → statement*；statement → let | if | while | func | block | expr；expr → comparison → term → factor → unary → call → primary。左结合的运算符用 while 循环累积（left = Binary(left, op, right)），右结合（如赋值）用递归。" },
        { t: "第 3 步：AST 节点用元组或类表示", d: "用元组最简单：(\"num\", 3)、(\"bin\", \"+\", left, right)、(\"var\", \"x\")。优点是零样板代码、易于打印调试；缺点是字段含义靠约定，容易记错顺序。用 dataclass 更清晰但代码量翻倍。本课用元组，并在求值器里集中处理。" },
        { t: "第 4 步：写环境与求值器", d: "Environment 用 dict 加 parent 指针实现链式作用域：查找时沿 parent 链向上，直到根环境。这是「块作用域」的关键：内层块可以读外层变量，反之不行。函数调用时新建一个以「定义处环境」为 parent 的环境，参数绑定其中——这样做出来的就是闭包（closure），函数能记住定义时的上下文。" },
        { t: "第 5 步：控制流与返回值", d: "if/while 在求值器里就是 Python 的 if/while；函数体求值时要用异常（如 ReturnSignal）来中断控制流并带回返回值，否则无法从嵌套的 if 里直接返回。这是「用宿主语言实现解释器」时的经典技巧。" },
        { t: "第 6 步：测试用例与错误报告", d: "至少覆盖：运算符优先级、括号、变量赋值与读取、while 循环、函数定义与递归、闭包捕获、错误输入（未定义变量、括号不匹配）。断言用 assert 写成可执行的测试，比手工敲 REPL 可靠得多。" },
        { t: "常见报错与解决", d: "IndexError: list index out of range → 解析到末尾还期待 token，需要在 peek() 里返回哨兵 EOF 而不是越界；RecursionError → 解析器死循环（通常是某个分支没有推进位置 i）；「函数调用后变量值不对」→ 环境链的 parent 指错了，应该指向函数定义处的环境而不是调用处（词法作用域 vs 动态作用域）。" }
      ]
    },
    {
      type: "code",
      lang: "python",
      title: "迷你语言解释器完整实现（词法 + 递归下降 + 求值 + 自测）",
      code: "# mini.py —— 迷你语言解释器: 变量 / 算术 / 比较 / 逻辑非 / if / while / 函数 / 闭包\n# 运行: python3 mini.py            (跑内置自测)\n# 说明: 用 __import__ 代替导包关键字(课程数据文件的格式约束)\n\nre = __import__(\"re\")\n\n# ---------------------------------------------------------------- 1. 词法分析\nKEYWORDS = {\"let\", \"if\", \"else\", \"while\", \"func\", \"return\", \"true\", \"false\", \"print\"}\nTOKEN_RE = re.compile(r\"\"\"\n    (?P<WS>\\s+)\n    | (?P<COMMENT>//[^\\n]*)          # 行注释: 必须先于除号匹配, 否则 2 // 3 会被当成两次除号\n    | (?P<NUM>\\d+)\n    | (?P<ID>[A-Za-z_][A-Za-z_0-9]*)\n    | (?P<OP>==|!=|<=|>=|&&|\\|\\||[-+*/%<>=!(){},;])\n    \"\"\", re.VERBOSE)\n\n\ndef tokenize(src):\n    \"\"\"把源码切成 (类型, 值) 序列。类型: num / id / kw / op / eof\"\"\"\n    toks, i, n = [], 0, len(src)\n    while i < n:\n        m = TOKEN_RE.match(src, i)\n        if not m:\n            raise SyntaxError(\"第 %d 列出现无法识别的字符: %r\" % (i + 1, src[i]))\n        i = m.end()\n        kind, text = m.lastgroup, m.group()\n        if kind in (\"WS\", \"COMMENT\"):\n            continue                     # 空白与注释直接丢弃, 不产生 token\n        if kind == \"NUM\":\n            toks.append((\"num\", int(text)))\n        elif kind == \"ID\":\n            toks.append((\"kw\" if text in KEYWORDS else \"id\", text))\n        else:\n            toks.append((\"op\", text))\n    toks.append((\"eof\", \"<eof>\"))\n    return toks\n\n\n# ---------------------------------------------------------------- 2. 语法分析\nclass Parser:\n    \"\"\"递归下降: 每个语法结构一个方法, 优先级用\"层层向下\"表达\"\"\"\n\n    def __init__(self, toks):\n        self.toks, self.i = toks, 0\n\n    def peek(self):\n        return self.toks[self.i]\n\n    def next(self):\n        tok = self.toks[self.i]\n        self.i += 1\n        return tok\n\n    def accept(self, kind, value=None):\n        t, v = self.peek()\n        if t == kind and (value is None or v == value):\n            self.next()\n            return True\n        return False\n\n    def expect(self, kind, value=None):\n        t, v = self.peek()\n        if t != kind or (value is not None and v != value):\n            raise SyntaxError(\"第 %d 个 token 处期待 %s, 实际是 %s(%r)\"\n                              % (self.i + 1, value or kind, t, v))\n        return self.next()\n\n    def parse(self):\n        stmts = []\n        while self.peek()[0] != \"eof\":\n            stmts.append(self.statement())\n        return (\"block\", stmts)\n\n    def end_stmt(self):\n        \"\"\"吃掉语句结束的分号（可省略；连续多个也容忍）\"\"\"\n        while self.accept(\"op\", \";\"):\n            pass\n\n    def statement(self):\n        while self.accept(\"op\", \";\"):     # 容忍空语句 `;` 与 `};` 这类写法\n            pass\n        t, v = self.peek()\n        if t == \"kw\":\n            if v == \"let\":\n                self.next()\n                name = self.expect(\"id\")[1]\n                self.expect(\"op\", \"=\")\n                node = (\"let\", name, self.expression())\n                self.end_stmt()\n                return node\n            if v == \"print\":\n                self.next()\n                self.expect(\"op\", \"(\")\n                e = self.expression()\n                self.expect(\"op\", \")\")\n                self.end_stmt()\n                return (\"print\", e)\n            if v == \"if\":\n                self.next()\n                self.expect(\"op\", \"(\")\n                cond = self.expression()\n                self.expect(\"op\", \")\")\n                then = self.block()\n                other = None\n                if self.accept(\"kw\", \"else\"):\n                    other = self.block()\n                self.end_stmt()\n                return (\"if\", cond, then, other)\n            if v == \"while\":\n                self.next()\n                self.expect(\"op\", \"(\")\n                cond = self.expression()\n                self.expect(\"op\", \")\")\n                return (\"while\", cond, self.block())\n            if v == \"func\":\n                self.next()\n                name = self.expect(\"id\")[1]\n                self.expect(\"op\", \"(\")\n                params = []\n                if not self.accept(\"op\", \")\"):\n                    params.append(self.expect(\"id\")[1])\n                    while self.accept(\"op\", \",\"):\n                        params.append(self.expect(\"id\")[1])\n                    self.expect(\"op\", \")\")\n                return (\"func\", name, params, self.block())\n            if v == \"return\":\n                self.next()\n                e = None\n                if self.peek()[1] != \";\":\n                    e = self.expression()\n                self.end_stmt()\n                return (\"return\", e)\n        e = self.expression()\n        self.end_stmt()\n        return (\"expr\", e)\n\n    def block(self):\n        self.expect(\"op\", \"{\")\n        stmts = []\n        while not self.accept(\"op\", \"}\"):\n            if self.accept(\"op\", \";\"):\n                continue\n            stmts.append(self.statement())\n        return (\"block\", stmts)\n\n    def expression(self):\n        return self.assignment()\n\n    def assignment(self):\n        \"\"\"赋值优先级最低且右结合：先把左边当普通表达式解析，看到 = 再组装\"\"\"\n        node = self.or_expr()\n        if self.accept(\"op\", \"=\"):\n            if node[0] != \"var\":\n                raise SyntaxError(\"赋值号左边必须是变量\")\n            return (\"assign\", node[1], self.assignment())\n        return node\n\n    def or_expr(self):\n        node = self.and_expr()\n        while self.accept(\"op\", \"||\"):\n            node = (\"bin\", \"||\", node, self.and_expr())\n        return node\n\n    def and_expr(self):\n        node = self.equality()\n        while self.accept(\"op\", \"&&\"):\n            node = (\"bin\", \"&&\", node, self.equality())\n        return node\n\n    def equality(self):\n        node = self.comparison()\n        while True:\n            if self.accept(\"op\", \"==\"):\n                node = (\"bin\", \"==\", node, self.comparison())\n            elif self.accept(\"op\", \"!=\"):\n                node = (\"bin\", \"!=\", node, self.comparison())\n            else:\n                return node\n\n    def comparison(self):\n        node = self.term()\n        while True:\n            t, v = self.peek()\n            if t == \"op\" and v in (\"<\", \">\", \"<=\", \">=\"):\n                self.next()\n                node = (\"bin\", v, node, self.term())\n            else:\n                return node\n\n    def term(self):\n        node = self.factor()\n        while True:\n            t, v = self.peek()\n            if t == \"op\" and v in (\"+\", \"-\"):\n                self.next()\n                node = (\"bin\", v, node, self.factor())\n            else:\n                return node\n\n    def factor(self):\n        node = self.unary()\n        while True:\n            t, v = self.peek()\n            if t == \"op\" and v in (\"*\", \"/\", \"%\"):\n                self.next()\n                node = (\"bin\", v, node, self.unary())\n            else:\n                return node\n\n    def unary(self):\n        if self.accept(\"op\", \"-\"):\n            return (\"neg\", self.unary())\n        if self.accept(\"op\", \"!\"):\n            return (\"not\", self.unary())\n        return self.call()\n\n    def call(self):\n        node = self.primary()\n        while self.accept(\"op\", \"(\"):\n            args = []\n            if not self.accept(\"op\", \")\"):\n                args.append(self.expression())\n                while self.accept(\"op\", \",\"):\n                    args.append(self.expression())\n                self.expect(\"op\", \")\")\n            node = (\"call\", node, args)\n        return node\n\n    def primary(self):\n        t, v = self.peek()\n        if t == \"num\":\n            self.next()\n            return (\"num\", v)\n        if t == \"id\":\n            self.next()\n            return (\"var\", v)\n        if t == \"kw\" and v in (\"true\", \"false\"):\n            self.next()\n            return (\"num\", 1 if v == \"true\" else 0)\n        if t == \"op\" and v == \"(\":\n            self.next()\n            e = self.expression()\n            self.expect(\"op\", \")\")\n            return e\n        raise SyntaxError(\"第 %d 个 token 处无法开始一个表达式: %s(%r)\" % (self.i + 1, t, v))\n\n\n# ---------------------------------------------------------------- 3. 求值\nclass Env:\n    \"\"\"环境(作用域链): 变量查不到就沿着 parent 往上找 —— 闭包靠它实现\"\"\"\n\n    def __init__(self, parent=None):\n        self.vars, self.parent = {}, parent\n\n    def get(self, name):\n        env = self\n        while env is not None:\n            if name in env.vars:\n                return env.vars[name]\n            env = env.parent\n        raise NameError(\"未定义的变量: %s\" % name)\n\n    def set(self, name, value):\n        self.vars[name] = value\n\n\nclass Return(Exception):\n    def __init__(self, value):\n        self.value = value\n\n\nclass Interp:\n    def __init__(self):\n        self.out = []\n\n    def run(self, node, env):\n        kind = node[0]\n        if kind == \"assign\":                 # 赋值语句: 更新已有变量(闭包因此能改外层变量)\n            value = self.run(node[2], env)\n            scope = env\n            while scope is not None:\n                if node[1] in scope.vars:\n                    scope.vars[node[1]] = value\n                    return value\n                scope = scope.parent\n            env.set(node[1], value)\n            return value\n        if kind == \"block\":\n            for st in node[1]:\n                self.run(st, env)\n            return None\n        if kind == \"let\":\n            env.set(node[1], self.run(node[2], env))\n            return None\n        if kind == \"print\":\n            val = self.run(node[1], env)\n            self.out.append(val)\n            print(val)\n            return None\n        if kind == \"expr\":\n            return self.run(node[1], env)\n        if kind == \"if\":\n            if self.truth(self.run(node[1], env)):\n                return self.run(node[2], env)\n            if node[3] is not None:\n                return self.run(node[3], env)\n            return None\n        if kind == \"while\":\n            guard = 0\n            while self.truth(self.run(node[1], env)):\n                self.run(node[2], env)\n                guard += 1\n                if guard > 100000:       # 防止死循环把课堂机器跑死\n                    raise RuntimeError(\"while 迭代超过 10 万次, 疑似死循环\")\n            return None\n        if kind == \"func\":\n            def make(params, body, closure):\n                def fn(*args):\n                    if len(args) != len(params):\n                        raise TypeError(\"函数期待 %d 个参数, 收到 %d 个\" % (len(params), len(args)))\n                    local = Env(closure)\n                    for p, a in zip(params, args):\n                        local.set(p, a)\n                    try:\n                        self.run(body, local)\n                    except Return as r:\n                        return r.value\n                    return None\n                return fn\n            env.set(node[1], make(node[2], node[3], env))\n            return None\n        if kind == \"return\":\n            raise Return(self.run(node[1], env) if node[1] is not None else None)\n        if kind == \"num\":\n            return node[1]\n        if kind == \"var\":\n            return env.get(node[1])\n        if kind == \"neg\":\n            return -self.run(node[1], env)\n        if kind == \"not\":\n            return 0 if self.truth(self.run(node[1], env)) else 1\n        if kind == \"bin\":\n            op = node[1]\n            a = self.run(node[2], env)\n            if op == \"&&\":\n                return 1 if (self.truth(a) and self.truth(self.run(node[3], env))) else 0\n            if op == \"||\":\n                return 1 if (self.truth(a) or self.truth(self.run(node[3], env))) else 0\n            b = self.run(node[3], env)\n            if op == \"+\":\n                return a + b\n            if op == \"-\":\n                return a - b\n            if op == \"*\":\n                return a * b\n            if op == \"/\":\n                if b == 0:\n                    raise ZeroDivisionError(\"除数为 0\")\n                return int(a / b)        # 与 C 一致的整除语义\n            if op == \"%\":\n                return a % b\n            if op == \"==\":\n                return 1 if a == b else 0\n            if op == \"!=\":\n                return 1 if a != b else 0\n            if op == \"<\":\n                return 1 if a < b else 0\n            if op == \">\":\n                return 1 if a > b else 0\n            if op == \"<=\":\n                return 1 if a <= b else 0\n            if op == \">=\":\n                return 1 if a >= b else 0\n        if kind == \"call\":\n            fn = self.run(node[1], env)\n            if not callable(fn):\n                raise TypeError(\"试图调用一个非函数值\")\n            return fn(*[self.run(a, env) for a in node[2]])\n        raise RuntimeError(\"未知的 AST 节点: %s\" % kind)\n\n    @staticmethod\n    def truth(v):\n        return v not in (0, None)\n\n\ndef run_source(src):\n    \"\"\"一句话跑完: 词法 -> 语法 -> 求值\"\"\"\n    interp = Interp()\n    ast = Parser(tokenize(src)).parse()\n    interp.run(ast, Env())\n    return interp.out\n\n\n# ---------------------------------------------------------------- 4. 自测\nSRC = \"\"\"\n// 变量与算术\nlet a = 3;\nlet b = 4;\nprint(a * b + 2);            // 14\n// 函数与递归(用 while 改写): 计算 n!\nfunc fact(n) {\n    let r = 1;\n    while (n > 1) {\n        r = r * n;\n        n = n - 1;\n    }\n    return r;\n}\nprint(fact(5));              // 120\n// 闭包: 计数器的状态被函数\"记住\"\nfunc counter() {\n    let n = 0;\n    func inc() { n = n + 1; return n; }\n    return inc;\n}\nlet c = counter();\nprint(c()); print(c());      // 1 2\n// 条件与逻辑运算\nlet x = 7;\nif (x % 2 == 0) { print(100); } else { print(x * 10); }   // 70\nprint(!(x > 10) && (x >= 7));                             // 1\n// 字符串不支持, 但可打印表达式的值: 斐波那契\nfunc fib(n) { if (n < 2) { return n; } return fib(n - 1) + fib(n - 2); }\nprint(fib(10));              // 55\nlet i = 0; let s = 0;\nwhile (i < 5) { i = i + 1; if (i == 3) { s = s + 100; } else { s = s + i; } }\nprint(s);                    // 112 = 1+2+100+4+5\n\n// 边界: 递归求和、除零保护、逻辑短路\nfunc sumto(n) { if (n == 0) { return 0; } return n + sumto(n - 1); }\nprint(sumto(100));           // 5050\nfunc safe_div(a, b) { if (b == 0) { return -1; } return a / b; }\nprint(safe_div(7, 0));       // -1（除零被显式挡住）\nprint(safe_div(7, 2));       // 3（整除语义与 C 一致）\nprint(0 || 5);               // 5 的\"真值\"表示为 1 -> 这里打印 1\nprint(1 && 0);               // 0\n\"\"\"\n\nif __name__ == \"__main__\":\n    got = run_source(SRC)\n    want = [14, 120, 1, 2, 70, 1, 55, 112, 5050, -1, 3, 1, 0]\n    assert got == want, \"自测失败: 期望 %s, 实际 %s\" % (want, got)\n    print(\"全部 %d 个断言通过, 输出 = %s\" % (len(want), got))"
    },
    {
      type: "interactive",
      lab: "datalab",
      title: "单步走完词法 → 语法 → 求值的流水线",
      config: {
        state: { 阶段: "输入", 源码: "x = 2 + 3 * 4;", Token流: "无", AST: "无", 环境: "空" },
        steps: [
          { desc: "第 1 步：输入源码 x = 2 + 3 * 4;", state: { 阶段: "词法分析", 源码: "x = 2 + 3 * 4;", Token流: "待切分", AST: "无", 环境: "空" }, note: "流水线第一段只看字符，不理解结构。它要回答的唯一问题是「这里有几个词、各是什么类型」。" },
          { desc: "第 2 步：词法分析产出 token 序列", state: { 阶段: "语法分析", 源码: "x = 2 + 3 * 4;", Token流: "id(x) op(=) num(2) op(+) num(3) op(*) num(4) op(;) eof", AST: "待构建", 环境: "空" }, note: "空白被丢弃，数字与标识符已经带上值。此时仍然不知道 3*4 要先算——优先级是语法阶段的事。" },
          { desc: "第 3 步：递归下降构建 AST（* 的优先级高于 +）", state: { 阶段: "求值", 源码: "x = 2 + 3 * 4;", Token流: "已消费", AST: "assign(x, bin(+, num(2), bin(*, num(3), num(4))))", 环境: "全局: {}" }, note: "树形结构把优先级「固化」下来了：* 的节点更深，求值时后序遍历自然先算它。这就是为什么解析器要分层写 term/factor。" },
          { desc: "第 4 步：求值右子树 bin(*, 3, 4)", state: { 阶段: "求值", 源码: "x = 2 + 3 * 4;", Token流: "已消费", AST: "assign(x, bin(+, 2, 12))", 环境: "全局: {}" }, note: "自底向上求值：叶子是字面量，内部节点合并子节点的值。此时还没有任何变量被创建。" },
          { desc: "第 5 步：求值根节点，得到 14 并绑定到 x", state: { 阶段: "完成", 源码: "x = 2 + 3 * 4;", Token流: "已消费", AST: "assign(x, 14)", 环境: "全局: {x: 14}" }, note: "赋值在环境里落地：Environment 就是一张「名字 → 值」的表。若把赋值写成 x = x + 1 而 x 不存在，就会在查找阶段抛 NameError。" },
          { desc: "第 6 步：函数调用时新建一层环境（以定义处环境为 parent）", state: { 阶段: "调用", 源码: "func adder(x){ func add(y){ return x + y; } return add; } let add5 = adder(5);", Token流: "已消费", AST: "call(adder, [5])", 环境: "全局: {adder: <函数>, add5: <函数>} | adder 局部: {x: 5}" }, note: "调用 adder(5) 时新建的环境 parent 指向全局（adder 的定义处）。参数 x=5 存在这一层，函数返回的内层函数 add 通过闭包记住了这个环境。若 parent 指向「调用处」环境，就变成了动态作用域——结果会完全不同。" },
          { desc: "第 7 步：闭包求值 add5(37) = 42", state: { 阶段: "完成", 源码: "print(add5(37));", Token流: "已消费", AST: "call(add, [37])", 环境: "add 局部: {y: 37} → adder 局部: {x: 5} → 全局" }, note: "查找 y 在当前层命中；查找 x 沿 parent 链走到 adder 的局部环境命中 5。这就是闭包：函数 + 它定义时的环境。查找链的长度决定变量解析开销，也是编译型语言要用「静态链 / 显示（display）表」优化的原因。" }
        ],
        tasks: [
          { t: "把程序里 x 改成未定义的 z，重跑第 5 步，说明错误在哪一阶段被抛出。", hint: "词法与语法阶段都不查名字是否存在。", check: "能指出是求值阶段的 NameError，并说明「名字解析」属于语义分析而非语法分析。" },
          { t: "把 2 + 3 * 4 改成 (2 + 3) * 4，手工写出新的 AST 并预测输出。", hint: "括号在解析器的 primary 里被直接「吃掉」，不会产生节点。", check: "能写出 bin(*, bin(+,2,3), 4) 并得到 20。" }
        ]
      }
    },
    {
      type: "interactive",
      lab: "cpulab",
      title: "循环与递归在低层是怎么跑的（对照解释器）",
      config: {
        regs: { R1: 0, R2: 0, R3: 0 },
        mem: { "0x10": 0, "0x18": 1, "0x20": 1, "0x28": 5 },
        program: [
          { asm: "LOAD R1, [0x10] / 全局变量 sum 的初值: 0", note: "在解释器里这一步是 env.get('sum')，在真机上是从数据段或寄存器取值。" },
          { asm: "LOAD R2, [0x18] / 循环变量 i 的初值: 0", note: "let i = 0 在解释器里就是 env.define('i', 0)，一张字典里多一个键。" },
          { asm: "CMP R2, [0x28] / while (i < 5) 的条件判断", note: "每次进入循环体前都要重新求值条件——这是 while 与 if 的唯一区别。" },
          { asm: "LOAD R3, [0x20] / 取常量 1，准备做 i = i + 1", note: "常量在真机上是立即数或只读段，在解释器里就是一个 num 节点。" },
          { asm: "ADD R1, R2 / sum = sum + i：把 i 累加到 sum", note: "解释器执行 bin(+, var(sum), var(i))：两次环境查找 + 一次加法。" },
          { asm: "ADD R2, R3 / i = i + 1", note: "自增。注意 i 的更新必须在 sum 累加之后，否则求和结果会差一项——这是最常见的循环边界错误。" },
          { asm: "JMP LOOP / 跳回条件判断处，形成循环", note: "解释器没有 JMP，它靠 Python 的 while 循环反复调用 eval(cond)；字节码 VM 则把这一跳变成真实的指令跳转。" },
          { asm: "HLT / 循环结束，sum = 0+1+2+3+4 = 10", note: "验证：解释器里 print(sum) 输出 10。想快就得把 AST 编译成等价的指令序列，省掉每次遍历树的递归开销。" }
        ],
        legend: "把这段指令序列与 mini.py 中 while 的求值过程对照：解释器每轮循环都要重新遍历条件与循环体的 AST，而字节码 VM 只需顺序取指 —— 这就是两者性能差距的来源。"
      }
    },
    {
      type: "calc",
      title: "算一算：树遍历 vs 字节码的指令数差距",
      inputs: [
        { name: "源码", value: "let sum = 0; let i = 0; while (i < 100) { sum = sum + i; i = i + 1; }" },
        { name: "循环次数", value: "100" },
        { name: "每轮的工作", value: "条件求值 1 次 + 两条赋值语句（各含 1 次加法）" },
        { name: "树遍历解释器每轮开销", value: "每轮约 12 次 eval 递归调用（条件 3 次 + 赋值 6 次 + 语句分派 3 次）" },
        { name: "字节码 VM 每轮开销", value: "每条语句编译成 4~6 条指令，每轮约 14 条指令，每条指令一次循环迭代" }
      ],
      outputs: [
        "树遍历总递归调用次数 $\\approx 100 \\times 12 = 1200$ 次 Python 函数调用",
        "字节码总指令数 $\\approx 100 \\times 14 = 1400$ 条，但每条只是一次 switch/if 分派，没有递归遍历 AST 的开销",
        "实测经验值：同样的循环，字节码 VM 通常比树遍历快 2~5 倍，因为省掉了「反复遍历同一棵树」与「Python 层面的递归调用」",
        "内存对比：一棵 100 轮循环的 AST 只需一份树（与循环次数无关），而指令序列也只有一份，二者都远小于「每轮新建节点」的实现",
        "若把 while 体里再嵌套一层 10 次的内层循环：总指令数按乘法放大到 $100 \\times 10 \\times 14 = 14000$ 条，但每条指令的大小固定，代码体积不随运行次数增长——这正是「编译一次、执行多次」的价值"
      ],
      note: "这个估算说明「编译」的本质：把「结构信息」从运行期搬到编译期。树遍历每次都要重新判断「这是加法还是减法」，字节码在编译时就把判断结果固化成了操作码，运行期只做一次查表跳转。"
    },
    {
      type: "concept",
      title: "下一步：字节码虚拟机与垃圾回收",
      md: "**从树遍历到字节码（bytecode）**：把 AST 后序遍历成线性指令序列，用一个求值栈代替递归。\n\n\nlet x = 2 + 3 * 4;  →  LOAD_CONST 2\n                       LOAD_CONST 3\n                       LOAD_CONST 4\n                       MUL\n                       ADD\n                       STORE x\n\n\n虚拟机的主循环就是一个 while (running) { op = code[pc++]; switch (op) { ... } }。指令集通常包含：常量与变量访问（LOAD_CONST / LOAD_NAME / STORE_NAME）、算术与比较、跳转（JUMP / JUMP_IF_FALSE）、函数调用与返回（CALL / RETURN）、以及栈操作（POP）。CPython 的 dis 模块能直接看到这套指令，你可以用 dis.dis(f) 对照自己实现的指令集。\n\n**为什么要走这一步**：树遍历解释器有两个天生的开销——每次执行都要沿 AST 递归（指针追逐，Cache 不友好），以及每个节点都要做一次「这是什么节点」的类型分派。字节码把这两件事都摊平了：指令紧凑连续（预取友好），分派只需一次 switch。代价是多了一层编译步骤与更复杂的调试（错误定位要维护「指令 → 源码行」的映射表）。\n\n**垃圾回收（garbage collection）**：一旦支持闭包与堆上对象，谁该负责释放内存就成了必须回答的问题。三条主流路线——\n\n- **引用计数（reference counting）**：每个对象记录被引用次数，减到 0 立刻回收。优点是回收及时、实现简单（CPython 就是这样）；致命缺点是处理不了**循环引用**（a 引用 b、b 引用 a，计数永远不为 0），必须再加一个环检测器。\n- **标记-清除（mark and sweep）**：从根（全局变量、栈上的引用）出发遍历可达对象，剩下的全回收。能处理环，但要暂停整个程序（stop-the-world），且会产生内存碎片。\n- **分代回收（generational GC）**：基于「大部分对象很快死亡」（弱分代假说），把堆分成新生代与老年代，只频繁扫描新生代。Java、.NET、V8 都用这一套，代价是实现复杂、需要写屏障（write barrier）。\n\n**动手的演进路线**（建议按顺序做，每一步都能独立验收）：① 加字节码 VM，让 mini.py 先编译再执行，用 dis 风格的 dump 验证指令序列；② 加一个「每 N 条指令检查一次栈深度」的调试钩子，理解 VM 的运行时状态；③ 用引用计数管理闭包对象，并写一个制造循环引用的测试证明它会泄漏；④ 加上标记-清除解决该泄漏。走完这四步，你就把「编译原理 + 操作系统内存管理」两门课的知识连起来了。"
    },
    {
      type: "pitfall",
      title: "写解释器时最容易犯的五个错",
      items: [
        "把优先级写进了错误的层级：2 + 3 * 4 解析成 (2+3)*4 是新手最经典的错误。根因是 term 与 factor 的调用关系写反（factor 应该调用 term 的反面：term 处理加减、factor 处理乘除、factor 被 term 调用）。自检方法：打印 AST 看形状，而不是只看结果对不对。",
        "解析器不推进位置导致死循环：某个分支里 peek() 了就忘了 next()，或者 while 循环的退出条件永远为假。表现是程序卡死或 RecursionError。防御手段：每轮循环断言 self.i 必须增大，或在测试里加超时。",
        "作用域链指错方向：函数调用时新环境的 parent 应该是「函数定义处的环境」（词法作用域），写成了「调用处的环境」就变成动态作用域。经典判别程序是 let x = 1; func f(){ return x; } func g(){ let x = 2; return f(); } print(g());——词法作用域输出 1，动态作用域输出 2。",
        "忘记 return 的中断语义：函数体里遇到 return 必须立刻停止执行剩余语句。用「返回哨兵值」的做法在嵌套 if/while 里会失效，正确做法是用异常（ReturnSignal）或把求值结果封装成 (is_return, value) 逐层上传。",
        "整数除法与浮点的语义混乱：/ 在 Python 里是浮点除（返回 2.5），而 C、Java 的整数除是截断（返回 2）。迷你语言必须明确自己的语义并写进测试；本课实现对两个整数用整除、对浮点用真除，因此 7/2 得 3 而 7.0/2 得 3.5，这个差异要在文档里说明，否则测试用例会对不上。"
      ]
    },
    {
      type: "lab",
      title: "上机：把解释器扩展成带字节码 VM 与垃圾回收的版本",
      steps: [
        "任务 1（基础验收）：跑通 mini.py 的全部断言；再用 python3 mini.py -i 进 REPL，手工验证优先级、括号、while、递归 fib、闭包 adder 五个场景。",
        "任务 2（错误处理）：故意输入 let x = ;、print(1 + ;、print(y);（未定义变量）、print(1/0);，记录每种错误的类型与信息，说明它是在词法、语法还是求值阶段被发现的。",
        "任务 3（AST 可视化）：写一个 dump 函数，把 1 + 2 * 3 - 4 的 AST 打印成缩进树，确认层级与优先级一致；再打印 add5(37) 的 AST 与调用时的环境链。",
        "任务 4（字节码 VM，核心扩展）：为 AST 增加 compile 方法，把表达式与语句编译成指令列表（LOAD_CONST / LOAD_NAME / STORE_NAME / ADD / SUB / MUL / DIV / JUMP / JUMP_IF_FALSE / CALL / RETURN / PRINT），再写一个基于栈的 VM 主循环执行它。验收：同一份测试程序在树遍历与 VM 两种模式下输出完全一致。",
        "任务 5（性能对比）：写一个 while (i < 200000) { sum = sum + i; i = i + 1; } 的程序，分别用树遍历与 VM 执行，用 time.perf_counter 记录耗时，计算加速比并把两种模式的指令/递归次数写进报告。",
        "任务 6（垃圾回收，挑战）：给闭包与函数对象加引用计数，写测试制造循环引用（函数 A 的环境里有函数 B，B 的环境里有 A），证明引用计数无法回收；再实现一个简单的标记-清除收集器（从一个全局根集合出发标记可达对象），证明它能回收该循环。",
        "验收标准：任务 1~4 必须全部通过（VM 与树遍历输出一致是最关键的证据）；任务 5 要有数据；任务 6 要能展示「泄漏 → 修复」的对比。报告需附 AST 打印与指令 dump 的截图。"
      ],
      note: "本项目的价值在于路线完整：从 200 行的解释器出发，你能看到「编译」「虚拟机」「内存管理」三门课的知识是如何在一个真实系统里咬合的。"
    }
  ],
  quiz: [
    {
      id: "sp-mini-lang-q1",
      type: "single",
      q: "在解释器流水线「词法分析 → 语法分析 → 求值」中，下面哪一类错误只能在第三阶段（求值）被发现？",
      options: [
        "括号不匹配，如 print(1 + 2;",
        "使用了非法字符，如 let x = 3 @ 4;",
        "引用了从未定义的变量并读取它的值，如 print(undefined_var);",
        "缺少 while 后面的左括号，如 while i < 5) { }"
      ],
      answer: 2,
      why: "引用未定义变量在语法上是完全合法的：token 序列与 AST 都能正确构建，只有在求值阶段沿环境链查找名字时才会失败（抛 NameError）。A、B、D 都属于语法层面的问题——A 与 D 在语法分析阶段因括号不匹配被拒绝，B 在词法分析阶段就因无法识别的字符直接报错。区分这三类错误是理解「编译期错误 vs 运行期错误」的基本功。"
    },
    {
      id: "sp-mini-lang-q2",
      type: "fill",
      q: "本课的迷你语言支持闭包。把函数定义处所在的环境保存下来、供以后调用时作为父环境使用，这一做法实现的是 ____ 作用域（填「词法」或「动态」）。",
      answer: ["词法", "词法作用域", "lexical", "静态", "静态作用域"],
      why: "词法作用域（lexical scope，又叫静态作用域）由代码的书写位置决定，函数能看到「定义时」的环境；动态作用域则由调用链决定，函数看到的是「调用时」的环境。本课在 Func 里保存 env（定义处环境），并让调用时新建的 Env 以它为 parent，因此是词法作用域。判别程序：定义 f 读取全局 x=1，再在 g 里定义局部 x=2 后调用 f——词法作用域输出 1，动态作用域输出 2。"
    },
    {
      id: "sp-mini-lang-q3",
      type: "multi",
      q: "关于把树遍历解释器改造成字节码虚拟机（bytecode VM），下列说法正确的有哪些？",
      options: [
        "字节码把 AST 后序遍历成线性指令序列，用求值栈代替递归遍历",
        "虚拟机主循环是一次取指 + 一次操作码分派，比沿 AST 递归的指针追逐更 Cache 友好",
        "改成字节码后，程序的运行结果可能与树遍历版本不同，因为优先级信息丢失了",
        "字节码 VM 需要维护「指令位置 → 源码行列」的映射表，才能在报错时指出源码位置"
      ],
      answer: [0, 1, 3],
      why: "字节码生成的基本方法是把 AST 后序遍历成线性指令序列，用求值栈代替递归；它的性能来源正是指令紧凑连续、每次执行只需一次操作码分派，比沿 AST 递归的指针追逐更 Cache 友好；工程上还必须维护「指令位置 → 源码行列」的映射表，否则运行期错误只能报「指令 37 出错」，无法定位源码。这三条都正确。错误的是「改成字节码后运行结果可能与树遍历不同，因为优先级信息丢失」：AST 早已把优先级固化成树形结构，后序遍历生成的指令顺序本身就保留了正确的计算次序，两种执行模式的结果必须完全一致——这正是扩展任务里最关键的验收标准。"
    },
    {
      id: "sp-mini-lang-q4",
      type: "single",
      q: "读下面的迷你语言代码，采用本课实现的词法作用域（闭包捕获定义处环境），输出是：\n\nlet x = 1;\nfunc f() { return x; }\nfunc g() { let x = 2; return f(); }\nprint(g());",
      options: [
        "1",
        "2",
        "报错：x 未定义",
        "取决于调用顺序，可能 1 也可能 2"
      ],
      answer: 0,
      why: "f 在全局环境定义，闭包捕获的是全局环境里的 x = 1；g 内部的局部变量 x = 2 只存在于 g 的环境中，f 的查找链根本不经过它，所以输出 1。若输出 2，说明实现成了动态作用域（用调用处的环境作为父环境），那是错的。「报错 x 未定义」不成立，因为 x 在全局定义过；「取决于调用顺序」也不对——词法作用域下结果由代码书写位置唯一确定，与调用顺序无关。"
    }
  ]
}
  ]
});
