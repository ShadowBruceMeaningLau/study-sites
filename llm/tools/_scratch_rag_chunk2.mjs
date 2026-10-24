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
  { id: "退货政策", text: "退货政策：自签收次日起 7 天内可无理由退货。退回商品需保留原包装与吊牌。定制类商品一经制作不支持退货。生鲜类商品的退货需在签收后 24 小时内提出。" },
  { id: "发货说明", text: "发货说明：付款成功后 48 小时内安排发货。偏远地区可能延迟 1 到 2 天。法定节假日期间订单顺延至节后处理。" },
  { id: "发票说明", text: "发票说明：下单时可申请电子发票。电子发票在发货后 3 个工作日内开具并发送至预留邮箱。纸质发票需另行申请，并支付 8 元邮寄费用。" }
];
const size = 40;
let total = 0;
docs.forEach(d => {
  const cs = chunkText(d.text, size);
  total += cs.length;
  console.log(d.id + " 共 " + d.text.length + " 字 -> " + cs.length + " 块：" + cs.map(c => c.length).join(" / "));
  cs.forEach((c, i) => console.log("    [" + (i + 1) + "] (" + c.length + ") " + c));
});
console.log("总块数", total);

const qemb = [0.90, 0.30, 0.20, 0.10];
const emb = {
  "退货政策": [0.85, 0.25, 0.15, 0.05],
  "发货说明": [0.20, 0.85, 0.30, 0.15],
  "发票说明": [0.25, 0.30, 0.90, 0.20]
};
const rank = docs.map(d => ({ id: d.id, s: cos(qemb, emb[d.id]) })).sort((a, b) => b.s - a.s);
rank.forEach((r, i) => console.log("第 " + (i + 1) + " " + r.id + " " + (Math.round(r.s * 1000) / 1000)));
