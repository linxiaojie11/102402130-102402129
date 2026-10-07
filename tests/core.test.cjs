/*
 * core.test.cjs —— 对从页面抽取的纯函数做单元测试
 * 运行：node --test tests/
 * 说明：relTime 依赖 Date.now()，测试中固定“当前时间”保证结果可复现。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { esc, typeText, statusText, relTime, buildShareText, homeFilter, searchMatch } = require("./core.js");

/* ===== 构造测试数据的思路 =====
 * 1. 正常数据：模拟 assets/data.js 中 10 条示例的结构（lost/found、open/done、各分类）；
 * 2. 边界数据：空串、null/undefined、刚好 1 分钟/1 小时/1 天、超过 7 天；
 * 3. 刁难数据：HTML 特殊字符（XSS 转义）、英文大小写、空关键词、组合筛选叠加。 */

/* ---- 固定“当前时间”，保证 relTime 可复现 ---- */
const NOW = 1758540000000; // 约 2026-09-22 12:30（示例数据最新一条的时间）
test.before(() => { global.Date.now = () => NOW; });
test.after(() => { delete global.Date.now; });

/* ===== esc：HTML 转义 ===== */
test("esc：HTML 特殊字符全部转义", () => {
  assert.equal(esc('<script>&"\'</script>'), "&lt;script&gt;&amp;&quot;&#39;&lt;/script&gt;");
});
test("esc：null / undefined 返回空串，不抛异常", () => {
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
});
test("esc：普通文本原样返回", () => {
  assert.equal(esc("黑色无线耳机"), "黑色无线耳机");
});

/* ===== typeText / statusText：文案映射 ===== */
test("typeText：lost 显示「寻物」，found 显示「招领」", () => {
  assert.equal(typeText("lost"), "寻物");
  assert.equal(typeText("found"), "招领");
});
test("statusText：done 显示「已解决」，其他显示「进行中」", () => {
  assert.equal(statusText({ status: "done" }), "已解决");
  assert.equal(statusText({ status: "open" }), "进行中");
});

/* ===== relTime：相对时间 ===== */
test("relTime：1 分钟内显示「刚刚」", () => {
  assert.equal(relTime(NOW - 30000), "刚刚");
});
test("relTime：刚好 1 分钟显示「1 分钟前」", () => {
  assert.equal(relTime(NOW - 60000), "1 分钟前");
});
test("relTime：5 分钟 / 3 小时 / 2 天", () => {
  assert.equal(relTime(NOW - 5 * 60000), "5 分钟前");
  assert.equal(relTime(NOW - 3 * 3600000), "3 小时前");
  assert.equal(relTime(NOW - 2 * 86400000), "2 天前");
});
test("relTime：超过 7 天回退为「MM-DD」日期", () => {
  const d = new Date(NOW - 10 * 86400000);
  const pad = (n) => (n < 10 ? "0" + n : n);
  assert.equal(relTime(NOW - 10 * 86400000), pad(d.getMonth() + 1) + "-" + pad(d.getDate()));
});
test("relTime：无时间戳返回空串", () => {
  assert.equal(relTime(0), "");
  assert.equal(relTime(null), "");
});

/* ===== homeFilter：首页组合筛选 ===== */
const s1 = { id: "s1", type: "lost", category: "卡证证件", location: "图书馆二楼", status: "open" };
const s2 = { id: "s2", type: "found", category: "生活用品", location: "第一食堂", status: "open" };
const s7 = { id: "s7", type: "lost", category: "数码设备", location: "体育馆", status: "done" };

test("homeFilter：已解决信息一律不展示", () => {
  assert.equal(homeFilter(s7, "all", "", ""), false);
});
test("homeFilter：类型筛选（寻物/招领）", () => {
  assert.equal(homeFilter(s1, "lost", "", ""), true);
  assert.equal(homeFilter(s1, "found", "", ""), false);
});
test("homeFilter：类别筛选", () => {
  assert.equal(homeFilter(s1, "all", "卡证证件", ""), true);
  assert.equal(homeFilter(s1, "all", "生活用品", ""), false);
});
test("homeFilter：地点筛选", () => {
  assert.equal(homeFilter(s1, "all", "", "图书馆二楼"), true);
  assert.equal(homeFilter(s1, "all", "", "第一食堂"), false);
});
test("homeFilter：类型+类别+地点组合筛选", () => {
  assert.equal(homeFilter(s1, "lost", "卡证证件", "图书馆二楼"), true);
  assert.equal(homeFilter(s1, "lost", "卡证证件", "第一食堂"), false);
  assert.equal(homeFilter(s2, "found", "生活用品", "第一食堂"), true);
});
test("homeFilter：全部条件时进行中信息都展示", () => {
  assert.equal(homeFilter(s1, "all", "", ""), true);
  assert.equal(homeFilter(s2, "all", "", ""), true);
});

/* ===== searchMatch：关键词搜索 ===== */
const s3 = { id: "s3", type: "lost", title: "黑色无线耳机（含充电仓）", category: "数码设备", location: "东操场看台第三排", desc: "跑步时遗落，充电仓侧面有一道划痕", type: "lost" };
test("searchMatch：命中标题 / 地点 / 分类 / 描述 / 类型字段", () => {
  assert.equal(searchMatch(s3, "耳机"), true);   // 标题
  assert.equal(searchMatch(s3, "操场"), true);   // 地点
  assert.equal(searchMatch(s3, "数码"), true);   // 分类
  assert.equal(searchMatch(s3, "划痕"), true);   // 描述
  assert.equal(searchMatch(s3, "lost"), true);   // 类型字段（页面按原始类型码匹配）
});
test("searchMatch：英文大小写不敏感", () => {
  assert.equal(searchMatch({ title: "Apple 无线耳机", location: "", category: "", desc: "", type: "lost" }, "apple"), true);
  assert.equal(searchMatch({ title: "Apple 无线耳机", location: "", category: "", desc: "", type: "lost" }, "APPLE"), true);
});
test("searchMatch：首尾空白被忽略", () => {
  assert.equal(searchMatch(s3, "  耳机  "), true);
});
test("searchMatch：空关键词 / 无匹配返回 false", () => {
  assert.equal(searchMatch(s3, ""), false);
  assert.equal(searchMatch(s3, "   "), false);
  assert.equal(searchMatch(s3, "自行车"), false);
});

/* ===== buildShareText：复制失物信息分享 ===== */
const shareItem = {
  id: "s1", type: "lost", title: "校园卡", category: "卡证证件",
  location: "图书馆二楼", time: "09-21 19:40", desc: "蓝色卡套",
  contact: "QQ：123456789", owner: "李同学", mine: false, status: "open"
};
test("buildShareText：寻物启事包含标题/分类/遗失地点/时间/描述/联系方式/落款", () => {
  const t = buildShareText(shareItem);
  assert.match(t, /【寻物启事】校园卡/);
  assert.match(t, /物品分类：卡证证件/);
  assert.match(t, /遗失地点：图书馆二楼/);
  assert.match(t, /大致时间：09-21 19:40/);
  assert.match(t, /详细描述：蓝色卡套/);
  assert.match(t, /联系方式：QQ：123456789/);
  assert.match(t, /—— 来自「校园失物招领」小程序/);
});
test("buildShareText：招领启事显示拾获地点，无描述时省略该行，时间为空显示未填写", () => {
  const t = buildShareText({ type: "found", title: "雨伞", category: "生活用品", location: "第一食堂", time: "", contact: "服务台", desc: "" });
  assert.match(t, /【招领启事】雨伞/);
  assert.match(t, /拾获地点：第一食堂/);
  assert.match(t, /大致时间：未填写/);
  assert.doesNotMatch(t, /详细描述/);
});
