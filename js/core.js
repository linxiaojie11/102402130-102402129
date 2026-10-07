/* Pure domain logic, shared by the browser and Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LF = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CATS = ['卡证证件', '数码设备', '生活用品', '书籍资料', '衣物配饰', '其他'];
  const KEY = 'campus-lf-v1';
  const LIMITS = { title: 30, location: 30, contact: 40, time: 30, desc: 120 };
  const LABELS = { title: '物品名称', location: '地点', contact: '联系方式', time: '大致时间', desc: '详细描述' };
  function validate(input) {
    const value = {}, errors = {};
    for (const [key, max] of Object.entries(LIMITS)) {
      value[key] = typeof input[key] === 'string' ? input[key].trim() : '';
      if (['title', 'location', 'contact'].includes(key) && !value[key]) errors[key] = '请填写' + LABELS[key];
      else if (value[key].length > max) errors[key] = LABELS[key] + '最多 ' + max + ' 个字符';
    }
    value.type = input.type;
    value.category = input.category;
    if (!['lost', 'found'].includes(value.type)) errors.type = '请选择寻物或招领';
    if (!CATS.includes(value.category)) errors.category = '请选择有效类别';
    return { value, errors, valid: Object.keys(errors).length === 0 };
  }
  function statusText(item) { return item.status === 'done' ? (item.type === 'lost' ? '已找到' : '已归还') : '进行中'; }
  function filter(items, opts = {}) {
    const keyword = String(opts.keyword || '').trim().toLocaleLowerCase();
    return items.filter(item =>
      (!opts.type || opts.type === 'all' || item.type === opts.type) &&
      (!opts.category || item.category === opts.category) &&
      (!opts.location || item.location === opts.location) &&
      (!opts.status || opts.status === 'all' || item.status === opts.status) &&
      (!keyword || [item.title, item.location, item.category, item.desc || ''].some(s => s.toLocaleLowerCase().includes(keyword)))
    ).sort((a, b) => b.createdAt - a.createdAt);
  }
  function create(input, ownerId, id, now = Date.now()) {
    const result = validate(input);
    if (!result.valid) throw new Error(Object.values(result.errors)[0]);
    if (!ownerId || !id) throw new Error('缺少发布者或信息标识');
    return { ...result.value, id, ownerId, owner: '本机发布者', status: 'open', createdAt: now, updatedAt: now };
  }
  function owned(item, ownerId) { return Boolean(item && ownerId && item.ownerId === ownerId); }
  function update(items, id, ownerId, patch, now = Date.now()) {
    const item = items.find(x => x.id === id);
    if (!owned(item, ownerId)) throw new Error('仅发布者可以修改这条信息');
    const next = { ...item };
    if (Object.hasOwn(patch, 'status')) {
      if (!['open', 'done'].includes(patch.status)) throw new Error('无效状态');
      next.status = patch.status;
    } else {
      const result = validate({ ...item, ...patch });
      if (!result.valid) throw new Error(Object.values(result.errors)[0]);
      Object.assign(next, result.value);
    }
    next.updatedAt = now;
    return items.map(x => x.id === id ? next : x);
  }
  function isRecord(item) {
    return Boolean(item && typeof item.id === 'string' && item.id.length <= 100 && item.id &&
      typeof item.ownerId === 'string' && item.ownerId.length <= 100 && item.ownerId &&
      typeof item.owner === 'string' && item.owner.length <= 100 &&
      ['open', 'done'].includes(item.status) && Number.isFinite(item.createdAt) &&
      Number.isFinite(item.updatedAt) && validate(item).valid);
  }
  function validateRecords(items) {
    if (!Array.isArray(items) || items.length > 2000 || !items.every(isRecord) || new Set(items.map(x => x.id)).size !== items.length) throw new Error('数据格式不正确或包含重复标识');
    return items;
  }
  function load(storage, seed, newOwnerId) {
    const raw = storage.getItem(KEY);
    if (raw !== null) {
      const data = JSON.parse(raw);
      if (data.version !== 1 || typeof data.ownerId !== 'string' || !data.ownerId || data.ownerId.length > 100) throw new Error('本地数据版本或身份无效');
      validateRecords(data.items);
      return data;
    }
    const data = { version: 1, ownerId: newOwnerId, items: seed.map(x => ({ ...x, ownerId: 'demo', updatedAt: x.createdAt })) };
    validateRecords(data.items);
    save(storage, data);
    return data;
  }
  function save(storage, data) {
    validateRecords(data.items);
    storage.setItem(KEY, JSON.stringify(data)); // Caller handles quota/access errors before committing UI state.
  }
  function mergeBackup(data, text) {
    if (text.length > 2 * 1024 * 1024) throw new Error('备份不能超过 2 MB');
    const backup = JSON.parse(text);
    if (backup.version !== 1) throw new Error('不支持的备份版本');
    validateRecords(backup.items);
    const ids = new Set(data.items.map(x => x.id));
    // Preserve original ownership; importing is not an account transfer.
    const incoming = backup.items.filter(x => !ids.has(x.id));
    const items = [...data.items, ...incoming];
    validateRecords(items);
    return { ...data, items };
  }
  function escape(text) {
    return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  return { CATS, KEY, validate, statusText, filter, create, owned, update, load, save, mergeBackup, escape };
});
