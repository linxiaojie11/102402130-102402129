/*
 * core.js —— 从「校园失物招领小程序.html」中抽取的纯函数
 * 说明：单文件原型出于“双击即用”的约束，把逻辑内嵌在 HTML 的 <script> 中；
 * 为保证可测试性，这里将纯函数抽取为独立模块，逻辑与页面内嵌版本保持一致。
 */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function typeText(t) { return t === "lost" ? "寻物" : "招领"; }

function statusText(it) { return it.status === "done" ? "已解决" : "进行中"; }

function relTime(ts) {
  if (!ts) return "";
  var diff = Date.now() - ts;
  var min = 60000, hour = 3600000, day = 86400000;
  if (diff < min) return "刚刚";
  if (diff < hour) return Math.floor(diff / min) + " 分钟前";
  if (diff < day) return Math.floor(diff / hour) + " 小时前";
  if (diff < 7 * day) return Math.floor(diff / day) + " 天前";
  var d = new Date(ts);
  var pad = function (n) { return n < 10 ? "0" + n : n; };
  return pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function buildShareText(it) {
  var lines = ["【" + typeText(it.type) + "启事】" + it.title,
    "物品分类：" + it.category,
    (it.type === "lost" ? "遗失地点：" : "拾获地点：") + it.location,
    "大致时间：" + (it.time || "未填写")];
  if (it.desc) lines.push("详细描述：" + it.desc);
  lines.push("联系方式：" + it.contact);
  lines.push("—— 来自「校园失物招领」小程序");
  return lines.join("\n");
}

/* 首页组合筛选：类型(全部/lost/found) × 类别 × 地点，已解决信息一律不展示 */
function homeFilter(it, curType, curCat, curLoc) {
  if (it.status === "done") return false;
  if (curType !== "all" && it.type !== curType) return false;
  if (curCat && it.category !== curCat) return false;
  if (curLoc && it.location !== curLoc) return false;
  return true;
}

/* 关键词搜索：匹配标题/地点/分类/描述/类型，忽略大小写；空关键词不命中 */
function searchMatch(it, kw) {
  var k = String(kw || "").trim().toLowerCase();
  if (!k) return false;
  return (it.title + it.location + it.category + it.desc + it.type).toLowerCase().indexOf(k) >= 0;
}

module.exports = { esc, typeText, statusText, relTime, buildShareText, homeFilter, searchMatch };
