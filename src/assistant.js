/* ============ ASSISTANT ============
   A rule-based question answering helper ("Ask StudyNest").
   No AI model, no network, no API key: it classifies the question with keyword
   rules (English and Turkish) and answers by querying the planner data in `S`.
   Pipeline:  question -> understand() -> intent + entities -> answer builder -> HTML
   The two stages are separate on purpose, so a language model could later replace
   understand() without touching the answer builders. */

/* ---------- text helpers ---------- */
const fold = (s) => String(s || '').toLowerCase().replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '');
const tokens = (s) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);
const STOP = new Set(['and', 'the', 'for', 'ile', 'ders', 'dersi', 'course', 'class']);

/* keyword lists, folded to ASCII, matched as word prefixes so that Turkish suffixes work
   (odev -> odevim, odevler; sinav -> sinavda) */
const W = {
  help: ['help', 'yardim', 'what can you', 'ne sorabilirim', 'neler yapabilirsin'],
  exam: ['exam', 'sinav', 'vize', 'midterm', 'final', 'quiz'],
  topic: ['topic', 'konu', 'subtopic', 'covered', 'cover', 'icerik', 'chapter', 'cikacak', 'cikar', 'syllabus'],
  progress: ['progress', 'ilerleme', 'percent', 'yuzde', 'tamamlan', 'completed', 'finished', 'bitir', 'remaining', 'kalan', 'how far', 'ne kadar'],
  weak: ['lowest', 'weak', 'least', 'behind', 'geride', 'dusuk', 'should i study', 'should i start', 'study first', 'what to study', 'ne calis', 'neye calis', 'nereden basla', 'oncelik', 'priority', 'recommend', 'oner'],
  task: ['homework', 'assignment', 'task', 'odev', 'gorev', 'todo', 'to-do', 'to do', 'yapilacak'],
  due: ['deadline', 'due', 'teslim', 'son tarih'],
  overdue: ['overdue', 'late', 'gecik', 'kacir', 'missed'],
  project: ['project', 'proje', 'group', 'grup', 'team', 'ekip', 'takim'],
  classes: ['class', 'lecture', 'schedule', 'timetable', 'program', 'room', 'derslik', 'sinif', 'hangi gun', 'ders'],
  mine: ['assigned', 'atan', 'bana'],
  next: ['next', 'nearest', 'closest', 'upcoming', 'soon', 'yakin', 'siradaki'],
  today: ['today', 'bugun'],
  tomorrow: ['tomorrow', 'yarin'],
  week: ['week', 'hafta'],
  summary: ['summary', 'overview', 'ozet', 'status', 'durum', 'how am i doing', 'nasil gidiyor'],
};

function understand(raw) {
  const q = fold(raw);
  const any = (key) => W[key].some((w) => new RegExp('(^|[^a-z0-9])' + w.replace(/[-]/g, '\\-')).test(q));
  const words = tokens(raw);
  const f = {};
  for (const k in W) f[k] = any(k);
  f.greet = /^(hi|hello|hey|hola|merhaba|selam|gunaydin)\b/.test(q) && words.length <= 3;
  const courses = S.courses.filter((c) => {
    const t = tokens(c.name).filter((x) => x.length >= 3 && !STOP.has(x));
    return t.some((x) => words.some((w) => w.startsWith(x) || (w.length >= 4 && x.startsWith(w))));
  });
  const type = /midterm|vize/.test(q) ? 'Midterm' : /final/.test(q) ? 'Final' : /quiz/.test(q) ? 'Quiz' : null;
  const names = [...new Set(S.projects.flatMap((p) => p.members.map((m) => fold(m.name))))];
  const member = names.find((n) => n && words.includes(n)) || null;
  return { q, raw, words, f, courses, type, member };
}

/* ---------- small renderers ---------- */
const P = (s) => `<p>${s}</p>`;
const goLink = (view, label) => `<button class="btn ghost sm" data-act="go" data-view="${view}">${label}</button>`;
const upcomingExams = () => S.exams.filter((e) => daysUntil(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
const examLine = (e) => `<div class="item" style="cursor:pointer" data-act="go" data-view="exam:${e.id}"><span style="font-size:20px">📝</span><div class="body"><div class="t">${esc(examTitle(e))}</div><div class="small muted">${fmtDate(e.date)}${e.time ? ' · ' + esc(e.time) : ''}${e.place ? ' · ' + esc(e.place) : ''}</div></div>${dueTag(e.date)}</div>`;
const topicMark = (tp) => {
  if (tp.subs && tp.subs.length) { const d = tp.subs.filter((s) => s.done).length; return d === tp.subs.length ? '✅' : d ? '🟡' : '⬜'; }
  return tp.done ? '✅' : '⬜';
};
function examTopicsBlock(e) {
  const l = leaves(e);
  const body = e.topics.length
    ? e.topics.map((tp) => `<div class="small" style="padding:3px 0">${topicMark(tp)} <b>${esc(tp.title)}</b>${tp.subs && tp.subs.length ? `<div class="muted" style="margin-left:24px">${tp.subs.map((s) => (s.done ? '✅ ' : '⬜ ') + esc(s.title)).join('<br>')}</div>` : ''}</div>`).join('')
    : '<div class="small muted">No topics added yet. Open the exam and add what will be asked.</div>';
  return `<div class="acard"><div class="row"><b>${esc(examTitle(e))}</b><span class="sp"></span>${dueTag(e.date)}</div>${l.t ? barRow(l.p, `${l.d}/${l.t} · ${l.p}%`) : ''}${body}<div style="margin-top:8px">${goLink('exam:' + e.id, 'Open exam')}</div></div>`;
}

/* ---------- answer builders ---------- */
function pickExams(u) {
  let ex = S.exams.slice();
  if (u.courses.length) ex = ex.filter((e) => u.courses.some((c) => c.id === e.courseId));
  if (u.type) ex = ex.filter((e) => e.type === u.type);
  const named = ex.filter((e) => e.title && u.q.includes(fold(e.title)));
  if (named.length) ex = named;
  const up = ex.filter((e) => daysUntil(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  return up.length ? up : ex.sort((a, b) => b.date.localeCompare(a.date));
}
function aExamTopics(u) {
  const ex = pickExams(u);
  if (!ex.length) return P('I could not find a matching exam. Add one in the <b>Exams</b> tab.');
  const shown = u.f.next ? ex.slice(0, 1) : ex.slice(0, 3);
  return P(shown.length === 1 ? 'Here is what is on this exam:' : 'Here are the topics:') + shown.map(examTopicsBlock).join('') + (ex.length > shown.length ? P(`<span class="muted">+ ${ex.length - shown.length} more exam(s) match.</span>`) : '');
}
function aExamList(u) {
  const ex = pickExams(u);
  if (!ex.length) return P('You have no exams yet. Add one in the <b>Exams</b> tab.');
  const shown = u.f.next ? ex.slice(0, 1) : ex.slice(0, 5);
  const first = shown[0], l = leaves(first), n = daysUntil(first.date);
  const lead = n >= 0 ? `Your ${u.f.next ? 'next' : 'closest'} exam is <b>${esc(examTitle(first))}</b>, ${n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'}.` : `The latest exam I found is <b>${esc(examTitle(first))}</b> (already passed).`;
  return P(lead + (l.t ? ` You have finished ${l.p}% of its topics.` : '')) + shown.map(examLine).join('');
}
function aProgress(u) {
  const ex = (u.courses.length ? upcomingExams().filter((e) => u.courses.some((c) => c.id === e.courseId)) : upcomingExams());
  if (!ex.length) return P('There are no upcoming exams to measure. Add an exam and its topics first.');
  let T = 0, D = 0; ex.forEach((e) => { const l = leaves(e); T += l.t; D += l.d; });
  const rows = ex.map((e) => { const l = leaves(e); return `<div style="padding:6px 0"><div class="row small"><b>${esc(examTitle(e))}</b><span class="sp"></span>${dueTag(e.date)}</div>${l.t ? barRow(l.p, `${l.d}/${l.t} · ${l.p}%`) : '<div class="small muted">No topics yet</div>'}</div>`; }).join('');
  return P(T ? `Overall you have finished <b>${Math.round(D / T * 100)}%</b> of your exam topics (${D} of ${T}).` : 'No topics have been added yet.') + rows;
}
function aStudy(u) {
  const ex = (u.courses.length ? upcomingExams().filter((e) => u.courses.some((c) => c.id === e.courseId)) : upcomingExams());
  const todo = [];
  ex.forEach((e) => e.topics.forEach((tp) => {
    if (tp.subs && tp.subs.length) tp.subs.filter((s) => !s.done).forEach((s) => todo.push({ e, text: `${tp.title}: ${s.title}` }));
    else if (!tp.done) todo.push({ e, text: tp.title });
  }));
  const over = deadlines().filter((d) => d.kind !== 'exam' && daysUntil(d.date) < 0);
  let out = '';
  if (over.length) out += P(`First, ${over.length} task${over.length > 1 ? 's are' : ' is'} overdue: <b>${over.slice(0, 3).map((d) => esc(d.title)).join(', ')}</b>.`);
  if (todo.length) {
    const first = todo[0].e;
    out += P(`Your next exam is <b>${esc(examTitle(first))}</b>, ${dueTag(first.date)}. Start with these topics:`) + todo.filter((t) => t.e === first).slice(0, 5).map((t) => `<div class="small" style="padding:3px 0">⬜ ${esc(t.text)}</div>`).join('');
    const withTopics = ex.filter((e) => leaves(e).t); withTopics.sort((a, b) => leaves(a).p - leaves(b).p);
    if (withTopics.length > 1) out += P(`Lowest progress: <b>${esc(examTitle(withTopics[0]))}</b> at ${leaves(withTopics[0]).p}%.`);
  } else if (!over.length) out += P('You are all caught up: no open exam topics and no overdue tasks. 🌿');
  return out;
}
function dueRows(list, cap) {
  return list.slice(0, cap).map(reminderRow).join('') + (list.length > cap ? `<div class="small muted" style="padding-top:6px">+ ${list.length - cap} more</div>` : '');
}
function aDue(u) {
  const t = todayISO(), f = u.f;
  let list = deadlines().filter((d) => !(d.kind === 'exam' && d.date < t));
  if (f.task && !f.due) list = list.filter((d) => d.kind !== 'exam');
  if (u.courses.length) list = list.filter((d) => u.courses.some((c) => c.id === d.course));
  let lead;
  if (f.today) { list = list.filter((d) => d.date === t); lead = 'Due today:'; }
  else if (f.tomorrow) { list = list.filter((d) => d.date === iso(addDays(new Date(), 1))); lead = 'Due tomorrow:'; }
  else if (f.week) { const end = iso(addDays(new Date(), 6)); list = list.filter((d) => d.date <= end); lead = 'Due in the next 7 days (overdue items first):'; }
  else if (f.next) {
    const over = list.filter((d) => d.date < t).length;
    list = list.filter((d) => d.date >= t).slice(0, 1);
    lead = (list.length ? 'Your nearest deadline:' : 'Nothing is coming up.') + (over ? ` (You also have ${over} overdue.)` : '');
  } else lead = 'Here is what is coming up:';
  if (!list.length && !f.next) return P(lead.replace(':', '') + ': nothing. Enjoy the calm! 🌿');
  return P(lead) + dueRows(list, 6);
}
function aOverdue() {
  const over = deadlines().filter((d) => d.kind !== 'exam' && daysUntil(d.date) < 0);
  return over.length ? P(`You have <b>${over.length}</b> overdue item${over.length > 1 ? 's' : ''}:`) + dueRows(over, 8) : P('Nothing is overdue. Nice work! 🎉');
}
function aProject(u) {
  const list = S.projects.filter((p) => !p.done && (!u.courses.length || u.courses.some((c) => c.id === p.courseId))).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  if (!list.length) return P('You have no open group projects. Add one in the <b>Projects</b> tab.');
  const shown = u.f.next ? list.slice(0, 1) : list.slice(0, 4);
  return P(u.f.next ? 'Your nearest project:' : 'Your open projects:') + shown.map((p) => {
    const pr = projProgress(p);
    return `<div class="acard" style="cursor:pointer" data-act="go" data-view="project:${p.id}"><div class="row"><b>${esc(p.title)}</b><span class="sp"></span>${p.due ? dueTag(p.due) : ''}</div>${courseTag(p.courseId)}${pr.t ? barRow(pr.p, `${pr.d}/${pr.t} · ${pr.p}%`) : '<div class="small muted">No tasks yet</div>'}<div class="small muted">Team: ${p.members.map((m) => esc(m.name)).join(', ') || 'no members yet'}</div></div>`;
  }).join('');
}
function aMember(u) {
  const key = u.member || fold(S.name);
  if (!key) return P('Tell me whose tasks you mean (for example <i>"Mert\'s tasks"</i>), or save your name in <b>Settings</b> so I know who "me" is.');
  const rows = []; let shownName = '';
  S.projects.forEach((p) => p.members.forEach((m) => { if (fold(m.name) === key) { shownName = m.name; p.tasks.filter((t) => t.assignee === m.id).forEach((t) => rows.push({ p, t })); } }));
  if (!rows.length) return P(shownName ? `${esc(shownName)} has no tasks assigned yet.` : `I could not find a team member called "${esc(key)}".`);
  rows.sort((a, b) => Number(a.t.done) - Number(b.t.done) || (a.t.due || '9999').localeCompare(b.t.due || '9999'));
  return P(`Tasks assigned to <b>${esc(shownName)}</b>:`) + rows.map(({ p, t }) => `<div class="item ${t.done ? 'done' : ''}" style="cursor:pointer" data-act="go" data-view="project:${p.id}"><span>${t.done ? '✅' : '⬜'}</span><div class="body"><div class="t">${esc(t.title)}</div><div class="small muted">${esc(p.title)}</div></div>${t.due && !t.done ? dueTag(t.due) : ''}</div>`).join('');
}
const slotText = (s) => `${DAYS[s.day]} ${s.start} – ${s.end}${s.room ? ' · ' + esc(s.room) : ''}`;
function aClasses(u) {
  if (u.courses.length) return u.courses.map((c) => `<div class="acard"><b>${esc(c.name)}</b>${c.teacher ? ` <span class="muted small">· ${esc(c.teacher)}</span>` : ''}${c.slots.length ? c.slots.slice().sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)).map((s) => `<div class="small" style="padding:2px 0">🕘 ${slotText(s)}</div>`).join('') : '<div class="small muted">No class times yet.</div>'}</div>`).join('');
  const dayOf = u.f.tomorrow ? addDays(new Date(), 1) : new Date();
  const label = u.f.tomorrow ? 'tomorrow' : 'today';
  if (u.f.today || u.f.tomorrow) {
    const list = []; S.courses.forEach((c) => c.slots.forEach((s) => { if (s.day === dayIdx(dayOf)) list.push({ c, s }); }));
    list.sort((a, b) => a.s.start.localeCompare(b.s.start));
    return list.length ? P(`Your classes ${label}:`) + list.map(({ c, s }) => `<div class="item"><span class="dotc" style="background:${c.color}"></span><div class="body"><div class="t">${esc(c.name)}</div><div class="small muted">${s.start} – ${s.end}${s.room ? ' · ' + esc(s.room) : ''}</div></div></div>`).join('') : P(`No classes ${label}. 🎉`);
  }
  const rows = []; S.courses.forEach((c) => c.slots.forEach((s) => rows.push({ c, s })));
  if (!rows.length) return P('No class times yet. Open a course and add its weekly schedule.');
  rows.sort((a, b) => a.s.day - b.s.day || a.s.start.localeCompare(b.s.start));
  return P('Your weekly timetable:') + rows.map(({ c, s }) => `<div class="small" style="padding:3px 0"><b>${DAYS[s.day]}</b> ${s.start}–${s.end} · ${esc(c.name)}${s.room ? ' · ' + esc(s.room) : ''}</div>`).join('');
}
function aCourse(c) {
  const ex = upcomingExams().filter((e) => e.courseId === c.id), open = S.tasks.filter((t) => t.courseId === c.id && !t.done);
  const files = S.files.filter((f) => f.owner === 'course:' + c.id || f.owner === c.id).length;
  return `<div class="acard"><div class="row"><b>${esc(c.name)}</b><span class="sp"></span>${goLink('course:' + c.id, 'Open course')}</div>${c.teacher ? `<div class="small muted">Instructor: ${esc(c.teacher)}</div>` : ''}
    ${c.slots.length ? `<div class="small" style="padding-top:6px">🕘 ${c.slots.map(slotText).join(' · ')}</div>` : ''}
    ${ex.length ? `<div class="small" style="padding-top:6px">📝 ${ex.map((e) => `${esc(examTitle(e))} (${fmtDate(e.date)}, ${leaves(e).p}% ready)`).join('; ')}</div>` : ''}
    <div class="small" style="padding-top:6px">✅ ${open.length ? open.map((t) => `${esc(t.title)} (${t.due ? fmtDate(t.due) : 'no date'})`).join('; ') : 'No open tasks'}</div>
    ${c.notes ? `<div class="small muted" style="padding-top:6px">🗒 ${esc(c.notes.slice(0, 140))}${c.notes.length > 140 ? '…' : ''}</div>` : ''}</div>`;
}
function aSummary() {
  const t = todayISO(), open = S.tasks.filter((x) => !x.done), over = open.filter((x) => x.due && x.due < t);
  const ex = upcomingExams(), wk = deadlines().filter((d) => d.date >= t && d.date <= iso(addDays(new Date(), 6))).length;
  let T = 0, D = 0; ex.forEach((e) => { const l = leaves(e); T += l.t; D += l.d; });
  const lines = [
    `✅ ${open.length} open task${open.length === 1 ? '' : 's'}${over.length ? `, <b>${over.length} overdue</b>` : ''}`,
    `📌 ${wk} deadline${wk === 1 ? '' : 's'} in the next 7 days`,
    ex.length ? `📝 Next exam: <b>${esc(examTitle(ex[0]))}</b> (${rel(ex[0].date).text.toLowerCase()})` : '📝 No upcoming exams',
    T ? `📖 ${Math.round(D / T * 100)}% of exam topics finished` : '',
    `👥 ${S.projects.filter((p) => !p.done).length} open group project${S.projects.filter((p) => !p.done).length === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return P('Here is where you stand:') + lines.map((l) => `<div class="small" style="padding:3px 0">${l}</div>`).join('');
}

/* ---------- the router ---------- */
const HELP_EXAMPLES = ['What is due this week?', 'When is my next exam?', 'What topics are in the Data Structures midterm?', 'What should I study first?', 'Show my overdue tasks', 'What are my classes today?', 'What is my nearest project?', 'Which tasks are assigned to Mert?'];
function aHelp() {
  return P('I answer questions from <b>your own planner data</b>. I am rule-based, so I do not need internet or an account. Try things like:') + `<div class="sugs">${HELP_EXAMPLES.map(sug).join('')}</div>` + P('<span class="muted small">English and Turkish both work (e.g. "en yakın sınav ne zaman?").</span>');
}
const sug = (q) => `<button class="chip sm" data-act="ask" data-q="${esc(q)}">${esc(q)}</button>`;

function assistantAnswer(raw) {
  const u = understand(raw), f = u.f;
  if (!u.q.trim()) return aHelp();
  if (f.help) return aHelp();
  const empty = !S.courses.length && !S.exams.length && !S.tasks.length && !S.projects.length;
  if (f.greet) return P(`Hi${S.name ? ' ' + esc(S.name) : ''}! 👋 Ask me about your deadlines, exam topics or progress.`) + `<div class="sugs">${['What is due this week?', 'When is my next exam?', 'What should I study first?'].map(sug).join('')}</div>`;
  if (empty) return P('Your planner is empty, so I have nothing to look at yet. Add a course, or try the sample data:') + '<button class="btn sm" data-act="sample">✨ Load sample data</button>';
  if (f.overdue && !f.exam) return aOverdue();
  if (f.weak) return aStudy(u);
  if ((u.member || f.mine) && (f.task || f.project)) return aMember(u);
  if (f.project && !f.exam) return aProject(u);
  if (f.exam && (f.topic || f.progress)) return aExamTopics(u);
  if (f.exam) return aExamList(u);
  if (f.topic) return aExamTopics(u);
  if (f.progress) return aProgress(u);
  if (f.task || f.due || (f.next && !f.classes)) return aDue(u);
  if (f.classes) return aClasses(u);
  if (f.today || f.tomorrow) return aClasses(u) + aDue(u);
  if (u.courses.length) return u.courses.slice(0, 3).map(aCourse).join('');
  if (f.summary) return aSummary();
  if (f.week) return aDue(u);
  return P('Hmm, I did not understand that one. I can answer questions about deadlines, exams and their topics, progress, classes, projects and courses. For example:') + `<div class="sugs">${HELP_EXAMPLES.slice(0, 5).map(sug).join('')}</div>`;
}

/* ---------- chat panel (lives outside #app so re-renders never erase what you type) ---------- */
const chat = { open: false, msgs: [] };
function assistStarters() {
  const list = ['What is due this week?', 'When is my next exam?', 'What should I study first?'];
  const ex = upcomingExams()[0]; if (ex && ex.topics.length) list.push(`What topics are in ${examTitle(ex)}?`);
  return list;
}
function assistDraw() {
  const box = document.getElementById('assistant'); if (!box) return;
  const msgs = chat.msgs.map((m) => `<div class="m ${m.who}">${m.who === 'me' ? esc(m.text) : m.html}</div>`).join('');
  box.innerHTML = `${chat.open ? `<section class="ask-panel" role="dialog" aria-label="Ask StudyNest">
      <header><div><b>💬 Ask StudyNest</b><small>Answers from your own data · works offline</small></div><button class="x" data-act="assist-close" aria-label="Close assistant">✕</button></header>
      <div class="ask-msgs" id="askMsgs">${msgs}</div>
      <form class="ask-form" autocomplete="off"><input name="q" placeholder="Ask about exams, deadlines, topics…" aria-label="Your question"><button class="btn sm">Send</button></form>
    </section>` : ''}
    <button class="ask-fab" data-act="assist" aria-label="${chat.open ? 'Close' : 'Open'} assistant">${chat.open ? '✕' : '💬'}</button>`;
  const list = document.getElementById('askMsgs'); if (list) list.scrollTop = list.scrollHeight;
}
function assistToggle() {
  chat.open = !chat.open;
  if (chat.open && !chat.msgs.length) chat.msgs.push({ who: 'bot', html: P(`Hi${S.name ? ' ' + esc(S.name) : ''}! 👋 Ask me about your deadlines, exam topics and progress. I only use the data in your planner.`) + `<div class="sugs">${assistStarters().map(sug).join('')}</div>` });
  assistDraw();
  if (chat.open) { const i = document.querySelector('.ask-form input'); if (i && window.innerWidth > 900) i.focus(); }
}
function assistClose() { chat.open = false; assistDraw(); }
function assistAsk(text) {
  text = String(text || '').trim(); if (!text) return;
  chat.open = true;
  chat.msgs.push({ who: 'me', text });
  let html; try { html = assistantAnswer(text); } catch (e) { html = P('Sorry, something went wrong while looking that up.'); }
  chat.msgs.push({ who: 'bot', html });
  assistDraw();
  const i = document.querySelector('.ask-form input'); if (i && window.innerWidth > 900) i.focus();
}
document.addEventListener('submit', (e) => {
  if (!e.target.matches('.ask-form')) return;
  e.preventDefault(); assistAsk(new FormData(e.target).get('q'));
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && chat.open && !document.querySelector('dialog[open]')) assistClose(); });
(function mountAssistant() { const b = document.createElement('div'); b.id = 'assistant'; document.body.appendChild(b); assistDraw(); })();
