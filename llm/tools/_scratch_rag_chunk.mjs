// 复刻 app/labs.js 里 ragsteps 的切分与余弦逻辑，算出将要写进课程的真实数字
function splitSentences(t) {
  var out = [], buf = "";
  for (var i = 0; i < t.length; i++) {
    var ch = t.charAt(i);
    buf += ch;
    if ("。！？；!?;\n".indexOf(ch) >= 0) { if (buf.replace(/\s+/g, "")) { out.push(buf.trim()); } buf = ""; }
  }
  if (buf.replace(/\s+/g, "")) { out.push(buf.trim()); }
  return out;
}
function chunkText(t, sz) {
  var chunks = [], cur = "";
  splitSentences(String(t || "")).forEach(function (s) {
    if (cur && (cur + s).length > sz) { chunks.push(cur); cur = s; } else { cur += s; }
  });
  if (cur) { chunks.push(cur); }
  return chunks;
}
function cos(a, b) {
  var d = 0, na = 0, nb = 0;
  for (var i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return (na && nb) ? d / Math.sqrt(na * nb) : 0;
}

const docs = [
  { id: "退货政策", text: "退货政策：自签收次日起 7 天内可无理由退货。包装需完好。定制商品不支持退货。" },
  { id: "发货说明", text: "发货说明：付款后 48 小时内安排发货。偏远地区可能延迟 1 到 2 天。节假日订单顺延。" },
  { id: "发票说明", text: "发票说明：下单时可申请电子发票。发货后 3 个工作日内开具。纸质发票需另行申请并支付邮费。" }
];
const size = 30;
let total = 0;
docs.forEach(d => {
  const cs = chunkText(d.text, size);
  total += cs.length;
  console.log(d.id + " 共 " + d.text.length + " 字 -> " + cs.length + " 块：" + cs.map(c => c.length).join(" / "));
  cs.forEach((c, i) => console.log("    [" + (i + 1) + "] (" + c.length + ") " + c));
});
console.log("总块数", total);

const qemb = [0.82, 0.12, 0.18, 0.06, 0.02];
const emb = {
  "退货政策": [0.85, 0.10, 0.15, 0.08, 0.03],
  "发货说明": [0.12, 0.84, 0.20, 0.10, 0.05],
  "发票说明": [0.18, 0.22, 0.80, 0.12, 0.06]
};
const rank = docs.map(d => ({ id: d.id, s: cos(qemb, emb[d.id]) })).sort((a, b) => b.s - a.s);
rank.forEach((r, i) => console.log("第 " + (i + 1) + " " + r.id + " " + (Math.round(r.s * 1000) / 1000)));
