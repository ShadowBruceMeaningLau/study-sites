#!/usr/bin/env node
/**
 * Ollama 集成检查（LLM 站）
 * 作用：当本机 Ollama 守护进程在线时，验证课程代码块所依赖的 API 形状
 *   （/api/tags、/api/chat、SSE 流式），保证站内代码示例与真实接口一致。
 * 原则：验证脚本不得依赖模型在跑 —— 守护进程离线时自动 SKIP，退出码 0，
 *   绝不进硬门禁。因此它可以随时跑，模型在线只是"多一层真实验证"。
 * 用法：node tools/ollama-probe.mjs [--verbose]
 */
const BASE = "http://127.0.0.1:11434";

async function probe() {
  const verbose = process.argv.includes("--verbose");
  console.log("=== Ollama 集成检查（离线自动跳过，不进硬门禁）===");

  // 1) 守护进程是否在线（2 秒超时）
  let tags;
  try {
    const res = await fetch(BASE + "/api/tags", { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    tags = await res.json();
  } catch (e) {
    console.log("[SKIP] Ollama 守护进程未运行（" + (e && e.message) + "）");
    console.log("       课程代码不受影响：所有交互实验纯浏览器计算，");
    console.log("       涉及 Ollama 的代码块在课程里都标注了「需 Ollama 在线」。");
    console.log("结果：SKIP（0 个检查）");
    process.exit(0);
  }

  console.log("✓ /api/tags 可达：HTTP 200");
  const models = (tags.models || []).map((m) => m.name);
  console.log("  已安装模型：" + (models.length ? models.join(", ") : "（无，只有守护进程）"));
  if (verbose) console.log(JSON.stringify(tags.models, null, 2));

  // 2) /api/chat 非流式（若有模型，用最小输入真打一次）
  if (models.length) {
    const chatRes = await fetch(BASE + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: models[0],
        messages: [{ role: "user", content: "只回复两个字：你好" }],
        stream: false,
        options: { num_predict: 8 }
      }),
      signal: AbortSignal.timeout(60000)
    });
    const chat = await chatRes.json();
    const ok = chatRes.ok && typeof chat.message === "object" && typeof chat.message.content === "string";
    console.log((ok ? "✓" : "✗") + " /api/chat 非流式：message.content 为字符串" +
      (ok ? "（" + JSON.stringify(chat.message.content.slice(0, 30)) + "…）" : ""));
    if (!ok) process.exitCode = 1;

    // 3) /api/chat 流式（SSE：每行 "data:" 开头，最后一行 data: [DONE]）
    const sseRes = await fetch(BASE + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: models[0],
        messages: [{ role: "user", content: "数到三" }],
        stream: true,
        options: { num_predict: 8 }
      }),
      signal: AbortSignal.timeout(60000)
    });
    const text = await sseRes.text();
    const lines = text.split("\n").filter((l) => l.startsWith("data:"));
    const hasDone = lines.some((l) => /\[DONE\]/.test(l));
    const chunks = lines.filter((l) => !/\[DONE\]/.test(l)).length;
    console.log((hasDone && chunks >= 1 ? "✓" : "✗") + " /api/chat 流式（SSE）：" + chunks + " 个 data 块，结尾 [DONE]=" + hasDone);
    if (!(hasDone && chunks >= 1)) process.exitCode = 1;
    console.log("结果：" + (process.exitCode === 1 ? "有失败项" : "全部通过") + "（" + models.length + " 个模型）");
  } else {
    console.log("[提示] 守护进程在线但没装模型：跳过 /api/chat 实测。");
    console.log("       想完整跑一遍：ollama pull qwen2.5:7b 后再跑本脚本。");
    console.log("结果：部分通过（0 个模型，仅验证了守护进程与 /api/tags）");
  }
}

probe();
