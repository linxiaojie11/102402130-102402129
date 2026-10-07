'use strict';
const $ = id => document.getElementById(id);
const esc = LF.escape;
const colors = ['var(--cat-card)', 'var(--cat-digital)', 'var(--cat-life)', 'var(--cat-book)', 'var(--cat-cloth)', 'var(--cat-other)'];
const color = cat => colors[LF.CATS.indexOf(cat)] || colors[5];
const typeText = type => type === 'lost' ? '寻物' : '招领';
const uuid = () => globalThis.crypto?.randomUUID?.() || 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
let data, storageReady = true, currentView = 'home', previousView = 'home', detailId, editId = null, pubType = 'lost';
let curType = 'all', curCat = '', curLoc = '', curStatus = 'open', toastTimer;
function reportStorage(error) {
  $('storage-error').hidden = false;
  $('storage-error').textContent = '本地保存不可用：' + error.message + '。请检查浏览器存储设置，先导出备份。当前操作没有保存。';
}
try { data = LF.load(localStorage, window.LF_SEED || [], uuid()); }
catch (error) {
  storageReady = false;
  data = { version: 1, ownerId: uuid(), items: [] };
  reportStorage(error);
}
function commit(items) {
  if (!storageReady) { toast('本地数据不可用，请修复存储设置后刷新；原始数据不会被覆盖'); return false; }
  const next = { ...data, items };
  try { LF.save(localStorage, next); data = next; $('storage-error').hidden = true; return true; }
  catch (error) { reportStorage(error); toast('保存失败，请保留填写内容后重试'); return false; }
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2600);
}
function show(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + view));
  document.querySelectorAll('#tabbar button').forEach(el => {
    el.classList.toggle('on', el.dataset.v === view);
    if (el.dataset.v === view) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  if (view === 'home') renderHome();
  if (view === 'mine') renderMine();
  if (view === 'search') doSearch();
  window.scrollTo(0, 0);
}
function card(item, mine = false) {
  return `<article class="card ${mine ? 'mine-card' : ''}"><button class="card-link" data-id="${esc(item.id)}"><div class="card-top"><span class="badge ${item.type}">${typeText(item.type)}启事</span><span class="card-title">${esc(item.title)}</span><span class="${item.status === 'done' ? 'status-done' : 'status-open'}">${LF.statusText(item)}</span></div><div class="card-meta"><div class="row"><span>⌖ ${esc(item.location)}</span><span class="meta-right"><span class="cat-dot" style="background:${color(item.category)}"></span>${esc(item.category)}</span></div><div class="row"><span>${esc(item.time || '事件时间未填写')}</span><span class="meta-right">发布 ${new Date(item.createdAt).toLocaleDateString('zh-CN')}</span></div></div></button>${mine ? `<div class="mine-actions"><button data-edit="${esc(item.id)}">编辑修改</button><button class="done-act" data-status="${esc(item.id)}">${item.status === 'done' ? '重新开启' : '标记' + (item.type === 'lost' ? '已找到' : '已归还')}</button></div>` : ''}</article>`;
}
const empty = text => `<div class="empty">${esc(text)}</div>`;
function renderHome() {
  const locs = [...new Set(data.items.map(x => x.location))].sort();
  if (!locs.includes(curLoc)) curLoc = '';
  $('loc-filter').innerHTML = '<option value="">全部地点</option>' + locs.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
  $('loc-filter').value = curLoc;
  const list = LF.filter(data.items, { type: curType, category: curCat, location: curLoc, status: curStatus });
  $('home-count').textContent = `共 ${list.length} 条信息 · ${curStatus === 'open' ? '进行中' : curStatus === 'done' ? '已找到 / 已归还' : '全部状态'}`;
  $('home-list').innerHTML = list.length ? list.map(x => card(x)).join('') : empty('没有符合条件的信息。可更换筛选条件，或发布一条新信息。');
}
function renderMine() {
  const mine = LF.filter(data.items).filter(x => LF.owned(x, data.ownerId));
  $('mine-list').innerHTML = mine.length ? mine.map(x => card(x, true)).join('') : empty('你还没有发布信息。点击“发布”开始吧。');
}
function doSearch() {
  const keyword = $('s-input').value.trim();
  if (!keyword) { $('search-count').textContent = '输入关键词或点击热门词'; $('search-list').innerHTML = empty('支持搜索物品名称、类别、地点和描述。'); return; }
  const list = LF.filter(data.items, { keyword });
  $('search-count').textContent = `“${keyword}”的搜索结果：共 ${list.length} 条（含已完成）`;
  $('search-list').innerHTML = list.length ? list.map(x => card(x)).join('') : empty('没有相关信息。试试更短的关键词，或发布寻物启事。');
}
function openDetail(id, preserveReturn = false) {
  const item = data.items.find(x => x.id === id);
  if (!item) return toast('这条信息不存在');
  if (!preserveReturn) previousView = currentView;
  detailId = id;
  const row = (label, value) => `<div class="detail-row"><span class="k">${label}</span><span class="v">${esc(value)}</span></div>`;
  $('detail-card').innerHTML = `<div class="head"><span class="badge ${item.type}">${typeText(item.type)}启事</span><span class="badge ${item.status === 'done' ? 'done' : item.type}">${LF.statusText(item)}</span></div><h2>${esc(item.title)}</h2>${row('物品分类', item.category)}${row(item.type === 'lost' ? '遗失地点' : '拾获地点', item.location)}${row('大致时间', item.time || '未填写')}${row('发布人', item.owner)}${row('当前状态', LF.statusText(item))}${row('更新时间', new Date(item.updatedAt).toLocaleString('zh-CN'))}<div class="detail-desc">${esc(item.desc || '暂无补充描述')}</div><div class="contact-box"><div class="c-head">联系方式</div><div class="c-text">${esc(item.contact)}</div><button class="btn-back" id="copy-contact">一键复制联系方式</button></div><p class="page-hint">${item.status === 'done' ? '信息已结束，无需重复联系。' : '请通过以上方式联系发布者，认领时核对物品特征。'}</p>${LF.owned(item, data.ownerId) ? `<div class="mine-actions"><button data-edit="${esc(id)}">编辑信息</button><button data-status="${esc(id)}">${item.status === 'done' ? '重新开启' : '标记' + (item.type === 'lost' ? '已找到' : '已归还')}</button></div>` : ''}`;
  $('btn-back').lastChild.textContent = previousView === 'search' ? '返回搜索结果' : previousView === 'mine' ? '返回我的发布' : '返回首页';
  show('detail');
  $('copy-contact').onclick = () => copyContact(item.contact);
}
async function copyContact(text) {
  try { await navigator.clipboard.writeText(text); toast('联系方式已复制'); }
  catch {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(input);
    input.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* Offer manual copy. */ }
    input.remove();
    toast(copied ? '联系方式已复制' : '复制不可用，请手动选择详情中的联系方式');
  }
}
function typeSwitch() {
  document.querySelectorAll('#type-switch button').forEach(el => {
    el.className = el.dataset.t === pubType ? 'on-' + pubType : '';
    el.setAttribute('aria-pressed', String(el.dataset.t === pubType));
  });
}
function clearErrors() {
  ['title', 'location', 'contact'].forEach(key => { $('e-' + key).style.display = 'none'; $('f-' + key).removeAttribute('aria-invalid'); });
  $('form-error').hidden = true;
}
function resetForm() {
  editId = null; pubType = 'lost';
  ['title', 'location', 'time', 'desc', 'contact'].forEach(key => $('f-' + key).value = '');
  $('f-category').selectedIndex = 0;
  $('publish-title').textContent = '发布信息'; $('btn-submit-text').textContent = '确认发布';
  clearErrors(); typeSwitch();
}
function edit(id) {
  const item = data.items.find(x => x.id === id);
  if (!LF.owned(item, data.ownerId)) return toast('仅发布者可以编辑');
  resetForm(); editId = id; pubType = item.type;
  ['title', 'location', 'time', 'desc', 'contact', 'category'].forEach(key => $('f-' + key).value = item[key] || '');
  $('publish-title').textContent = '编辑信息'; $('btn-submit-text').textContent = '保存修改';
  typeSwitch(); show('publish');
}
function changeStatus(id) {
  const item = data.items.find(x => x.id === id);
  if (!LF.owned(item, data.ownerId)) return toast('仅发布者可以更新状态');
  const target = item.status === 'open' ? 'done' : 'open';
  const text = LF.statusText({ ...item, status: target });
  if (!confirm(`确认将“${item.title}”标记为“${text}”？`)) return;
  try {
    if (!commit(LF.update(data.items, id, data.ownerId, { status: target }))) return;
    toast('状态已更新为“' + text + '”');
    if (currentView === 'detail') openDetail(id, true); else show(currentView);
  } catch (error) { toast(error.message); }
}
$('btn-submit').onclick = () => {
  clearErrors();
  const input = { type: pubType };
  ['title', 'category', 'location', 'time', 'desc', 'contact'].forEach(key => input[key] = $('f-' + key).value);
  const result = LF.validate(input);
  if (!result.valid) {
    for (const [key, message] of Object.entries(result.errors)) if ($('e-' + key)) {
      $('e-' + key).textContent = message; $('e-' + key).style.display = 'block'; $('f-' + key).setAttribute('aria-invalid', 'true');
    }
    $('form-error').textContent = Object.values(result.errors).join('；'); $('form-error').hidden = false;
    $('f-' + Object.keys(result.errors)[0])?.focus(); return;
  }
  try {
    const edited = Boolean(editId);
    const items = edited ? LF.update(data.items, editId, data.ownerId, input) : [LF.create(input, data.ownerId, uuid()), ...data.items];
    if (!commit(items)) return;
    resetForm();
    if (!edited) { curType = 'all'; curCat = ''; curLoc = ''; curStatus = 'open'; $('status-filter').value = 'open'; syncFilters(); }
    show(edited ? 'mine' : 'home'); toast(edited ? '修改已保存' : '发布成功！可在“我的发布”维护状态');
  } catch (error) { $('form-error').textContent = error.message; $('form-error').hidden = false; }
};
function syncFilters() {
  document.querySelectorAll('#type-bar button').forEach(el => { el.classList.toggle('on', el.dataset.f === curType); el.setAttribute('aria-pressed', String(el.dataset.f === curType)); });
  document.querySelectorAll('#cat-row button').forEach(el => { el.classList.toggle('on', el.dataset.c === curCat); el.setAttribute('aria-pressed', String(el.dataset.c === curCat)); });
}
$('cat-row').innerHTML = ['', ...LF.CATS].map(cat => `<button class="chip" data-c="${esc(cat)}"><span class="dot" style="background:${color(cat)}"></span>${cat || '全部类别'}</button>`).join('');
$('type-bar').onclick = e => { const b = e.target.closest('button'); if (b) { curType = b.dataset.f; syncFilters(); renderHome(); } };
$('cat-row').onclick = e => { const b = e.target.closest('button'); if (b) { curCat = b.dataset.c; syncFilters(); renderHome(); } };
$('loc-filter').onchange = e => { curLoc = e.target.value; renderHome(); };
$('status-filter').onchange = e => { curStatus = e.target.value; renderHome(); };
$('type-switch').onclick = e => { const b = e.target.closest('button'); if (b) { pubType = b.dataset.t; typeSwitch(); } };
$('tabbar').onclick = e => { const b = e.target.closest('button'); if (b) { if (b.dataset.v === 'publish' && currentView !== 'publish') resetForm(); show(b.dataset.v); } };
$('home-search-entry').onclick = () => { show('search'); $('s-input').focus(); };
$('s-btn').onclick = doSearch;
$('s-input').oninput = doSearch;
$('s-input').onkeydown = e => { if (e.key === 'Enter') doSearch(); };
$('hot-tags').onclick = e => { const b = e.target.closest('button'); if (b) { $('s-input').value = b.textContent; doSearch(); } };
$('btn-back').onclick = () => show(previousView);
['home-list', 'search-list', 'mine-list', 'detail-card'].forEach(id => $(id).addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b?.dataset.edit) edit(b.dataset.edit);
  else if (b?.dataset.status) changeStatus(b.dataset.status);
  else if (b?.dataset.id) openDetail(b.dataset.id);
}));
$('export-data').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = '校园失物招领备份.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); toast('备份已导出');
};
$('import-data').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('备份不能超过 2 MB');
    const next = LF.mergeBackup(data, await file.text());
    if (!confirm(`将新增 ${next.items.length - data.items.length} 条信息，已有信息不会覆盖。确认导入？`)) return;
    if (commit(next.items)) { renderMine(); toast('备份导入成功'); }
  } catch (error) { toast('导入失败：' + error.message); }
  finally { e.target.value = ''; }
};
syncFilters(); resetForm(); show('home');
