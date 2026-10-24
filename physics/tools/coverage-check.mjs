#!/usr/bin/env node
/**
 * coverage-check.mjs —— 培养方案覆盖度自查
 *
 * 拿《物理学类专业教学基本要求》里物理专业本科通行的课程与知识条目（约 70 项），
 * 逐项在本站全部课程正文里检索，输出「充分 / 仅提及 / 缺失」。
 *
 * 为什么要有这个工具：说"覆盖了本科主干"是一句空话，除非能逐项指出来。
 * 它也是各波交付的进度尺：W1 结束时覆盖率必然很低，逐波上升，收尾时应达到 100%。
 *
 * 用法：
 *   node tools/coverage-check.mjs            # 全部条目
 *   node tools/coverage-check.mjs --missing  # 只列缺失/仅提及
 *   node tools/coverage-check.mjs 量子       # 只查名字含该串的条目
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const argv = process.argv.slice(2);
const ONLY_MISSING = argv.includes("--missing");
const filter = argv.filter((a) => !a.startsWith("--"))[0] || null;

/* ------------------------------------------------------------- 条目清单 */
/** keys 是检索用的同义词；命中任一即算该条目被提到 */
const CHECKLIST = [
  // ---------- 普物：力学 ----------
  { cat: "普通物理·力学", name: "质点运动学与相对运动", keys: ["运动学", "位移", "瞬时速度", "参考系"] },
  { cat: "普通物理·力学", name: "牛顿运动定律与受力分析", keys: ["牛顿", "受力分析", "惯性系"] },
  { cat: "普通物理·力学", name: "动量与角动量守恒", keys: ["动量守恒", "冲量", "角动量"] },
  { cat: "普通物理·力学", name: "功、能与机械能守恒", keys: ["机械能守恒", "保守力", "动能定理"] },
  { cat: "普通物理·力学", name: "刚体定轴转动", keys: ["刚体", "转动惯量", "纯滚动"] },
  { cat: "普通物理·力学", name: "振动与波动", keys: ["简谐振动", "驻波", "共振"] },
  { cat: "普通物理·力学", name: "万有引力与天体运动", keys: ["万有引力", "开普勒", "逃逸速度"] },
  // ---------- 普物：热学 ----------
  { cat: "普通物理·热学", name: "温度与状态方程", keys: ["理想气体", "状态方程", "绝对温度"] },
  { cat: "普通物理·热学", name: "气体动理论", keys: ["气体动理论", "麦克斯韦速率分布", "平均自由程"] },
  { cat: "普通物理·热学", name: "热力学第一定律", keys: ["热力学第一定律", "内能", "热容"] },
  { cat: "普通物理·热学", name: "热力学第二定律与熵", keys: ["热力学第二定律", "熵", "卡诺"] },
  { cat: "普通物理·热学", name: "输运过程", keys: ["输运", "热传导", "扩散", "黏性"] },
  // ---------- 普物：电磁学 ----------
  { cat: "普通物理·电磁学", name: "静电场与高斯定理", keys: ["高斯定理", "电场强度", "电通量"] },
  { cat: "普通物理·电磁学", name: "电势与导体", keys: ["电势", "导体", "静电屏蔽"] },
  { cat: "普通物理·电磁学", name: "电介质与电容", keys: ["电介质", "极化", "电容"] },
  { cat: "普通物理·电磁学", name: "恒定磁场与安培环路定理", keys: ["安培环路", "磁感应强度", "毕奥"] },
  { cat: "普通物理·电磁学", name: "电磁感应", keys: ["电磁感应", "楞次", "自感"] },
  { cat: "普通物理·电磁学", name: "磁介质", keys: ["磁介质", "磁化", "铁磁"] },
  { cat: "普通物理·电磁学", name: "麦克斯韦方程组与电磁波", keys: ["麦克斯韦方程组", "位移电流", "电磁波"] },
  // ---------- 普物：光学 ----------
  { cat: "普通物理·光学", name: "几何光学", keys: ["几何光学", "折射", "透镜成像"] },
  { cat: "普通物理·光学", name: "干涉", keys: ["干涉", "光程", "相干"] },
  { cat: "普通物理·光学", name: "衍射", keys: ["衍射", "单缝", "光栅"] },
  { cat: "普通物理·光学", name: "偏振", keys: ["偏振", "布儒斯特", "马吕斯"] },
  { cat: "普通物理·光学", name: "分辨本领与色散", keys: ["瑞利判据", "分辨", "色散"] },
  // ---------- 普物：原子物理 ----------
  { cat: "普通物理·原子物理", name: "黑体辐射与量子假说", keys: ["黑体辐射", "普朗克", "维恩"] },
  { cat: "普通物理·原子物理", name: "光电效应与光子", keys: ["光电效应", "光子", "康普顿"] },
  { cat: "普通物理·原子物理", name: "玻尔模型与氢光谱", keys: ["玻尔", "氢光谱", "里德伯"] },
  { cat: "普通物理·原子物理", name: "波粒二象性与物质波", keys: ["波粒二象性", "德布罗意"] },
  { cat: "普通物理·原子物理", name: "多电子原子与泡利原理", keys: ["泡利", "电子壳层", "多电子原子"] },
  { cat: "普通物理·原子物理", name: "核物理初步", keys: ["核", "衰变", "结合能"] },
  // ---------- 数学物理方法 ----------
  { cat: "数学物理方法", name: "矢量分析与场论", keys: ["梯度", "散度", "旋度"] },
  { cat: "数学物理方法", name: "复变函数与留数", keys: ["复变", "留数", "解析函数"] },
  { cat: "数学物理方法", name: "常微分方程与级数解法", keys: ["常微分方程", "级数解", "幂级数"] },
  { cat: "数学物理方法", name: "傅里叶级数与傅里叶变换", keys: ["傅里叶"] },
  { cat: "数学物理方法", name: "三类数理方程与分离变量", keys: ["分离变量", "波动方程", "热传导方程"] },
  { cat: "数学物理方法", name: "格林函数", keys: ["格林函数"] },
  { cat: "数学物理方法", name: "特殊函数（勒让德、贝塞尔）", keys: ["勒让德", "贝塞尔"] },
  { cat: "数学物理方法", name: "数值方法初步", keys: ["数值", "差分", "龙格"] },
  // ---------- 四大力学 ----------
  { cat: "四大力学", name: "拉格朗日力学与变分原理", keys: ["拉格朗日", "变分", "作用量"] },
  { cat: "四大力学", name: "哈密顿力学与守恒律", keys: ["哈密顿", "诺特", "对称性"] },
  { cat: "四大力学", name: "刚体动力学", keys: ["欧拉角", "惯量张量", "陀螺"] },
  { cat: "四大力学", name: "小振动与简正模", keys: ["简正模", "小振动"] },
  { cat: "四大力学", name: "静电场边值问题", keys: ["边值问题", "镜像法", "分离变量法"] },
  { cat: "四大力学", name: "电磁波传播与辐射", keys: ["坡印廷", "推迟势", "辐射"] },
  { cat: "四大力学", name: "狭义相对论与相对论电动力学", keys: ["狭义相对论", "洛伦兹变换", "质能"] },
  { cat: "四大力学", name: "波函数与薛定谔方程", keys: ["波函数", "薛定谔"] },
  { cat: "四大力学", name: "一维定态问题", keys: ["无限深势阱", "势垒", "隧道效应"] },
  { cat: "四大力学", name: "量子谐振子", keys: ["谐振子", "零点能"] },
  { cat: "四大力学", name: "角动量与自旋", keys: ["角动量", "自旋"] },
  { cat: "四大力学", name: "氢原子与中心力场", keys: ["氢原子", "中心力"] },
  { cat: "四大力学", name: "微扰论与变分法", keys: ["微扰", "变分法"] },
  { cat: "四大力学", name: "散射理论", keys: ["散射", "截面", "分波"] },
  { cat: "四大力学", name: "热力学基本方程与麦克斯韦关系", keys: ["麦克斯韦关系", "焓", "自由能"] },
  { cat: "四大力学", name: "三种统计分布", keys: ["玻色", "费米", "配分函数"] },
  { cat: "四大力学", name: "系综理论", keys: ["系综", "微正则", "正则分布"] },
  { cat: "四大力学", name: "相变与临界现象", keys: ["相变", "临界", "伊辛"] },
  // ---------- 专业与选修 ----------
  { cat: "专业与选修", name: "晶格与倒格空间", keys: ["晶格", "倒格", "布拉格"] },
  { cat: "专业与选修", name: "晶格振动与声子", keys: ["声子", "色散关系", "德拜"] },
  { cat: "专业与选修", name: "能带论与半导体", keys: ["能带", "带隙", "费米面", "半导体"] },
  { cat: "专业与选修", name: "磁性", keys: ["磁滞", "居里", "反铁磁"] },
  { cat: "专业与选修", name: "超导", keys: ["超导", "迈斯纳", "库珀对"] },
  { cat: "专业与选修", name: "原子核与放射性", keys: ["半衰期", "放射性", "核反应"] },
  { cat: "专业与选修", name: "粒子物理与标准模型", keys: ["夸克", "标准模型", "玻色子"] },
  { cat: "专业与选修", name: "恒星结构与演化", keys: ["赫罗图", "主序", "白矮星", "中子星"] },
  { cat: "专业与选修", name: "宇宙学", keys: ["哈勃", "宇宙微波背景", "暗物质", "暗能量"] },
  { cat: "专业与选修", name: "广义相对论与黑洞", keys: ["广义相对论", "史瓦西", "事件视界", "引力波"] },
  { cat: "专业与选修", name: "量子信息与量子计算", keys: ["量子比特", "纠缠", "退相干", "量子门"] },
  { cat: "专业与选修", name: "计算物理", keys: ["蒙特卡洛", "快速傅里叶变换", "分子动力学"] },
  { cat: "专业与选修", name: "非线性动力学与混沌", keys: ["混沌", "分岔", "李雅普诺夫", "分形"] },
  { cat: "专业与选修", name: "连续介质与流体", keys: ["伯努利", "连续性方程", "边界层", "黏性流体"] },
  // ---------- 实验与人文 ----------
  { cat: "实验与人文", name: "误差分析与不确定度", keys: ["不确定度", "标准偏差", "系统误差"] },
  { cat: "实验与人文", name: "基础物理实验", keys: ["实验", "最小二乘", "数据处理"] },
  { cat: "实验与人文", name: "近代物理实验", keys: ["弗兰克", "迈克耳孙", "光电效应实验"] },
  { cat: "实验与人文", name: "物理学史与思想方法", keys: ["物理学史", "范式", "思想方法"] },
  { cat: "实验与人文", name: "数量级估算能力", keys: ["数量级", "估算", "费米"] }
];

/* --------------------------------------------------------------- 装载内容 */
function loadText() {
  const chunks = [];
  let files = [];
  try { files = readdirSync(DATA).filter((f) => f.endsWith(".js")).sort(); } catch { files = []; }
  for (const f of files) {
    const code = readFileSync(join(DATA, f), "utf8");
    chunks.push(code);
  }
  return { text: chunks.join("\n"), files };
}
const { text, files } = loadText();
if (!files.length) {
  console.error("✗ data/ 下没有课程文件，无法做覆盖度检查");
  process.exit(1);
}

/* --------------------------------------------------------------- 逐项检索 */
const rows = [];
for (const item of CHECKLIST) {
  if (filter && !item.name.includes(filter)) continue;
  let hits = 0;
  const found = [];
  for (const k of item.keys) {
    const n = text.split(k).length - 1;
    if (n > 0) { hits += n; found.push(k + "×" + n); }
  }
  const level = hits >= 6 ? "充分" : hits >= 2 ? "部分" : hits === 1 ? "仅提及" : "缺失";
  rows.push({ ...item, hits, found, level });
}

const ORDER = { 充分: 0, 部分: 1, 仅提及: 2, 缺失: 3 };
rows.sort((a, b) => ORDER[a.level] - ORDER[b.level] || a.cat.localeCompare(b.cat));

const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - [...String(s)].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)));
console.log(`\n=== 物理学专业培养方案覆盖度自查（${files.length} 个课程文件）===\n`);
for (const r of rows) {
  if (ONLY_MISSING && r.level === "充分") continue;
  console.log(`  [${r.level}] ${pad(r.name, 34)} ${pad(r.cat, 20)} ${r.hits} 处　${r.found.slice(0, 4).join(" ")}`);
}

const stat = { 充分: 0, 部分: 0, 仅提及: 0, 缺失: 0 };
rows.forEach((r) => stat[r.level]++);
const covered = stat.充分 + stat.部分 + stat.仅提及;
const pct = rows.length ? Math.round((stat.充分 / rows.length) * 100) : 0;
console.log(`\n合计 ${rows.length} 项：充分 ${stat.充分} / 部分 ${stat.部分} / 仅提及 ${stat.仅提及} / 缺失 ${stat.缺失}`);
console.log(`有覆盖（充分+部分+仅提及）${covered}/${rows.length} = ${Math.round((covered / rows.length) * 100)}%；达"充分"标准 ${pct}%。`);

const missing = rows.filter((r) => r.level === "缺失").map((r) => r.name);
if (missing.length) {
  console.log(`\n仍缺失（${missing.length} 项）：${missing.join("、")}`);
}
console.log("\n[说明] 「充分」= 该条目在正文里出现 ≥6 次且有关键词覆盖；逐波交付时本表会持续上升，");
console.log("       收尾（W7）的目标是「缺失 0」。出现「仅提及」的条目说明只是被顺带提到，");
console.log("       按 ZERO-BASIS-STANDARD 的要求，应当补成独立讲次或明确写清边界。");

process.exit(stat.缺失 > 0 ? 0 : 0);   // 覆盖度是进度尺，不作为硬门禁（硬门禁见 README 第 6 节）
