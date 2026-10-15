'use strict';
/* ============ helpers ============ */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const COLORS = ['#7c6cf0', '#ff8a65', '#2fb7a3', '#f2a93b', '#e86a9a', '#4aa3e8', '#8bc34a', '#9575cd'];
const QUOTES = [
  'Small steps every day add up to big results.',
  'You do not have to be perfect, just keep going.',
  'Future you will thank you for studying today.',
  'Progress, not perfection.',
  'One topic at a time. You have got this!',
  'Start with the easiest topic to build momentum.',
  'A 25-minute focus session beats a 3-hour worry.',
  'Done is better than perfect. Tick one thing off!',
  'Rest is part of studying too. Take breaks.',
  'You are closer than you think.',
];
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayISO = () => iso(new Date());
const dayIdx = (d) => (d.getDay() + 6) % 7;            // Monday = 0
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => addDays(d, -dayIdx(d));
const daysUntil = (s) => Math.round((parseISO(s) - parseISO(todayISO())) / 864e5);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (s) => parseISO(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtLong = (d) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

function rel(dateStr) {
  const n = daysUntil(dateStr);
  if (n < -1) return { text: `${-n} days overdue`, cls: 'bad' };
  if (n === -1) return { text: '1 day overdue', cls: 'bad' };
  if (n === 0) return { text: 'Today', cls: 'bad' };
  if (n === 1) return { text: 'Tomorrow', cls: 'warn' };
  if (n <= 3) return { text: `In ${n} days`, cls: 'warn' };
  if (n <= 14) return { text: `In ${n} days`, cls: '' };
  return { text: fmtDate(dateStr), cls: 'ok' };
}
function periodKey(kind) {
  const now = new Date();
  if (kind === 'daily') return iso(now);
  if (kind === 'weekly') return 'W' + iso(mondayOf(now));
  return 'M' + now.getFullYear() + '-' + pad(now.getMonth() + 1);
}

/* ============ state + storage ============ */
const KEY = 'studynest.v1';
function defaults() {
  return { name: '', theme: 'light', courses: [], exams: [], tasks: [], projects: [], files: [], lists: { daily: [], weekly: [], monthly: [] } };
}
let S = (function load() {
  try { const j = JSON.parse(localStorage.getItem(KEY)); if (j) return Object.assign(defaults(), j); } catch (e) {}
  return defaults();
})();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function commit() { save(); render(); }

/* lookups */
const courseOf = (id) => S.courses.find((c) => c.id === id);
const colorOf = (id) => (courseOf(id) || {}).color || '#9a95b5';
const nameOf = (id) => (courseOf(id) || {}).name || '';

/* progress */
function leaves(e) {
  let t = 0, d = 0;
  for (const tp of e.topics) {
    if (tp.subs && tp.subs.length) for (const s of tp.subs) { t++; if (s.done) d++; }
    else { t++; if (tp.done) d++; }
  }
  return { t, d, p: t ? Math.round((d / t) * 100) : 0 };
}
function projProgress(p) {
  const t = p.tasks.length, d = p.tasks.filter((x) => x.done).length;
  return { t, d, p: t ? Math.round((d / t) * 100) : 0 };
}
const bar = (p) => `<div class="bar ${p >= 100 ? 'full' : ''}"><i style="width:${p}%"></i></div>`;
const barRow = (p, label) => `<div class="barrow">${bar(p)}<b>${label ?? p + '%'}</b></div>`;

/* deadlines (everything with a date that is not finished) */
function deadlines() {
  const out = [];
  for (const t of S.tasks) if (!t.done && t.due) out.push({ kind: 'task', title: t.title, date: t.due, course: t.courseId, go: 'tasks' });
  for (const p of S.projects) {
    if (!p.done && p.due) out.push({ kind: 'project', title: p.title, date: p.due, course: p.courseId, go: 'project:' + p.id });
    for (const x of p.tasks) if (!x.done && x.due) out.push({ kind: 'ptask', title: `${x.title} (${p.title})`, date: x.due, course: p.courseId, go: 'project:' + p.id });
  }
  for (const e of S.exams) out.push({ kind: 'exam', title: examTitle(e), date: e.date, course: e.courseId, go: 'exam:' + e.id, time: e.time });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
const examTitle = (e) => (e.title || `${nameOf(e.courseId) || 'Course'} ${e.type}`).trim();
const KIND_ICON = { task: '✅', project: '👥', ptask: '🧩', exam: '📝' };
function reminders() {
  return deadlines().filter((d) => {
    const n = daysUntil(d.date);
    return d.kind === 'exam' ? n >= 0 && n <= 14 : n <= 7;
  });
}
function urgentCount() { return reminders().filter((d) => daysUntil(d.date) <= 2).length; }

/* ============ small UI helpers ============ */
function confetti() {
  const em = ['🎉', '✨', '⭐', '🌟', '💜', '🎊'];
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('span');
    s.className = 'confetti'; s.textContent = em[i % em.length];
    s.style.left = 30 + Math.random() * 40 + 'vw'; s.style.top = '60vh';
    s.style.setProperty('--dx', (Math.random() * 300 - 150) + 'px');
    document.body.appendChild(s); setTimeout(() => s.remove(), 1500);
  }
}
function openModal(html) {
  const d = document.createElement('dialog'); d.className = 'modal';
  d.innerHTML = `<div class="inner">${html}</div>`;
  d.addEventListener('close', () => d.remove());
  document.body.appendChild(d); d.showModal(); return d;
}
function fieldHTML(f, v) {
  const val = v ?? f.value ?? '';
  let input;
  if (f.type === 'select') input = `<select name="${f.name}" ${f.required ? 'required' : ''}>${f.options.map((o) => `<option value="${esc(o.v)}" ${o.v === val ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
  else if (f.type === 'textarea') input = `<textarea name="${f.name}" placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
  else input = `<input type="${f.type || 'text'}" name="${f.name}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''} ${f.type === 'color' ? '' : 'autocomplete="off"'}>`;
  return `<label>${esc(f.label)}${input}</label>`;
}
function formDialog(title, fields, values, onOk) {
  const d = openModal(`<h3>${esc(title)}</h3><form>${fields.map((f) => fieldHTML(f, values[f.name])).join('<div style="height:12px"></div>')}<div class="row end" style="margin-top:16px"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Save</button></div></form>`);
  $('[data-close]', d).onclick = () => d.close();
  $('form', d).onsubmit = (e) => {
    e.preventDefault();
    const vals = Object.fromEntries(new FormData(e.target).entries());
    for (const k in vals) if (typeof vals[k] === 'string') vals[k] = vals[k].trim();
    d.close(); onOk(vals);
  };
  const first = $('input,textarea', d); if (first && first.type !== 'color') first.focus();
}
const courseOptions = (withNone = true) => (withNone ? [{ v: '', l: '— No course —' }] : []).concat(S.courses.map((c) => ({ v: c.id, l: c.name })));

/* ============ files (blobs live in IndexedDB, names in state) ============ */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('studynest-files', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('f');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbDo(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction('f', mode); const q = fn(t.objectStore('f')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); });
}
async function addFiles(owner, fileList) {
  for (const f of fileList) {
    if (f.size > 15 * 1048576) { alert(`"${f.name}" is bigger than 15 MB.`); continue; }
    const id = uid();
    try { await idbDo('readwrite', (s) => s.put(f, id)); } catch (e) { alert('Could not store the file in this browser.'); return; }
    S.files.push({ id, owner, name: f.name, size: f.size });
  }
  commit();
}
async function downloadFile(id) {
  const meta = S.files.find((f) => f.id === id); if (!meta) return;
  try {
    const blob = await idbDo('readonly', (s) => s.get(id));
    if (!blob) return alert('File not found in this browser.');
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = meta.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (e) { alert('Could not open the file.'); }
}
async function removeFile(id) {
  try { await idbDo('readwrite', (s) => s.delete(id)); } catch (e) {}
  S.files = S.files.filter((f) => f.id !== id); commit();
}
function filesBox(owner) {
  const list = S.files.filter((f) => f.owner === owner);
  return `<div>${list.map((f) => `<div class="file"><span>📎</span><div class="body" style="flex:1;min-width:0"><div class="t" style="overflow-wrap:anywhere">${esc(f.name)}</div><div class="small muted">${fmtSize(f.size)}</div></div><button class="btn ghost sm" data-act="file-dl" data-id="${f.id}">Open</button><button class="x" data-act="file-del" data-id="${f.id}" aria-label="Delete file">🗑</button></div>`).join('') || '<div class="muted small" style="padding:4px 0 8px">No files yet. Upload lecture notes, slides or PDFs.</div>'}
  <label class="btn ghost sm" style="margin-top:8px;cursor:pointer">⬆ Upload files<input type="file" multiple hidden data-upload="${esc(owner)}"></label></div>`;
}
