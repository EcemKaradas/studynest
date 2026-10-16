/* ============ forms ============ */
function askText(title, label, value, cb) {
  formDialog(title, [{ name: 'v', label, required: true, value }], {}, (v) => cb(v.v));
}
function courseForm(id) {
  const c = id ? courseOf(id) : null;
  formDialog(c ? 'Edit course' : 'New course', [
    { name: 'name', label: 'Course name', required: true, placeholder: 'e.g. Data Structures' },
    { name: 'teacher', label: 'Instructor (optional)' },
    { name: 'color', label: 'Colour', type: 'color' },
  ], c || { color: COLORS[S.courses.length % COLORS.length] }, (v) => {
    if (c) Object.assign(c, v); else S.courses.push({ id: uid(), name: v.name, teacher: v.teacher, color: v.color, slots: [], notes: '' });
    commit();
  });
}
function slotForm(id) {
  formDialog('Add class time', [
    { name: 'day', label: 'Day', type: 'select', options: DAYS_LONG.map((d, i) => ({ v: String(i), l: d })) },
    { name: 'start', label: 'Starts', type: 'time', required: true, value: '09:00' },
    { name: 'end', label: 'Ends', type: 'time', required: true, value: '10:30' },
    { name: 'room', label: 'Room (optional)' },
  ], {}, (v) => {
    if (toMin(v.end) <= toMin(v.start)) return alert('The end time must be after the start time.');
    courseOf(id).slots.push({ day: Number(v.day), start: v.start, end: v.end, room: v.room }); commit();
  });
}
function examForm(id, courseId) {
  const e = id ? S.exams.find((x) => x.id === id) : null;
  formDialog(e ? 'Edit exam' : 'New exam', [
    { name: 'courseId', label: 'Course', type: 'select', options: courseOptions() },
    { name: 'type', label: 'Type', type: 'select', options: ['Midterm', 'Final', 'Quiz', 'Other'].map((x) => ({ v: x, l: x })) },
    { name: 'title', label: 'Title (optional)', placeholder: 'e.g. Midterm 1' },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'time', label: 'Time (optional)', type: 'time' },
    { name: 'place', label: 'Place (optional)' },
  ], e || { courseId: courseId || (S.courses[0] ? S.courses[0].id : '') }, (v) => {
    if (e) Object.assign(e, v); else { const n = { id: uid(), topics: [], notes: '', ...v }; S.exams.push(n); view = 'exam:' + n.id; }
    commit();
  });
}
function taskForm(id, courseId, due) {
  const t = id ? S.tasks.find((x) => x.id === id) : null;
  formDialog(t ? 'Edit task' : 'New task', [
    { name: 'title', label: 'What do you need to do?', required: true, placeholder: 'e.g. Homework 3' },
    { name: 'courseId', label: 'Course', type: 'select', options: courseOptions() },
    { name: 'due', label: 'Due date', type: 'date' },
    { name: 'notes', label: 'Notes (optional)', type: 'textarea' },
  ], t || { courseId: courseId || '', due: due || '' }, (v) => {
    if (t) Object.assign(t, v); else S.tasks.push({ id: uid(), done: false, ...v });
    commit();
  });
}
function projForm(id, courseId) {
  const p = id ? S.projects.find((x) => x.id === id) : null;
  formDialog(p ? 'Edit project' : 'New group project', [
    { name: 'title', label: 'Project name', required: true },
    { name: 'courseId', label: 'Course', type: 'select', options: courseOptions() },
    { name: 'due', label: 'Deadline', type: 'date' },
    { name: 'desc', label: 'Short description (optional)', type: 'textarea' },
  ], p || { courseId: courseId || '' }, (v) => {
    if (p) Object.assign(p, v); else { const n = { id: uid(), done: false, members: [], tasks: [], notes: '', ...v }; S.projects.push(n); view = 'project:' + n.id; }
    commit();
  });
}
function ptaskForm(pid, tid) {
  const p = S.projects.find((x) => x.id === pid), t = tid ? p.tasks.find((x) => x.id === tid) : null;
  formDialog(t ? 'Edit task' : 'New project task', [
    { name: 'title', label: 'Task', required: true },
    { name: 'assignee', label: 'Assigned to', type: 'select', options: [{ v: '', l: '— Unassigned —' }].concat(p.members.map((m) => ({ v: m.id, l: m.name }))) },
    { name: 'due', label: 'Due date (optional)', type: 'date' },
  ], t || {}, (v) => { if (t) Object.assign(t, v); else p.tasks.push({ id: uid(), done: false, ...v }); commit(); });
}

/* ============ settings / backup / sample data ============ */
function openSettings() {
  const d = openModal(`<h3>⚙️ Settings</h3>
    <form data-form="name"><label>Your name<input type="text" name="name" value="${esc(S.name)}" placeholder="What should I call you?"></label><div class="row end" style="margin-top:10px"><button class="btn sm">Save name</button></div></form>
    <div class="group" style="margin:6px 0 0">Look</div><div class="chips"><button class="chip ${S.theme === 'light' ? 'on' : ''}" data-act="theme" data-k="light">☀️ Light</button><button class="chip ${S.theme === 'dark' ? 'on' : ''}" data-act="theme" data-k="dark">🌙 Cosy dark</button></div>
    <div class="group" style="margin:6px 0 0">Your data</div><p class="small muted" style="margin:0">Everything is saved in this browser on this device. Export a backup now and then. (Uploaded files are not part of the backup.)</p>
    <div class="row"><button class="btn ghost sm" data-act="export">⬇ Export backup</button><label class="btn ghost sm" style="cursor:pointer">⬆ Import backup<input type="file" accept="application/json" hidden data-import></label></div>
    <div class="row"><button class="btn ghost sm" data-act="sample">✨ Load sample data</button><button class="btn warn sm" data-act="erase">🗑 Erase everything</button></div>
    <div class="row end"><button class="btn" data-close>Done</button></div>`);
  $('[data-close]', d).onclick = () => d.close();
}
function sampleData() {
  const t = new Date(), D = (n) => iso(addDays(t, n)), id = uid;
  const c1 = { id: id(), name: 'Data Structures', teacher: 'Dr. Yılmaz', color: COLORS[0], notes: '', slots: [{ day: 0, start: '09:00', end: '10:30', room: 'A101' }, { day: 2, start: '11:00', end: '12:30', room: 'A101' }] };
  const c2 = { id: id(), name: 'Operating Systems', teacher: 'Prof. Demir', color: COLORS[1], notes: '', slots: [{ day: 1, start: '10:00', end: '12:00', room: 'B204' }, { day: 3, start: '13:30', end: '15:00', room: 'Lab 2' }] };
  const c3 = { id: id(), name: 'Linear Algebra', teacher: 'Dr. Kaya', color: COLORS[2], notes: '', slots: [{ day: 2, start: '09:00', end: '10:30', room: 'C305' }, { day: 4, start: '10:00', end: '11:30', room: 'C305' }] };
  const c4 = { id: id(), name: 'Academic English', teacher: 'Ms. Brown', color: COLORS[4], notes: '', slots: [{ day: 4, start: '13:00', end: '14:30', room: 'D12' }] };
  const topic = (title, subs = [], done = false) => ({ id: id(), title, done, subs: subs.map(([s, d]) => ({ id: id(), title: s, done: !!d })) });
  const m = [{ id: id(), name: 'Ecem' }, { id: id(), name: 'Mert' }, { id: id(), name: 'Zeynep' }];
  S = Object.assign(defaults(), {
    name: S.name || '', theme: S.theme, courses: [c1, c2, c3, c4],
    exams: [
      { id: id(), courseId: c1.id, type: 'Midterm', title: '', date: D(9), time: '10:00', place: 'Hall 3', notes: 'Bring a calculator. Past papers are on the course page.', topics: [topic('Arrays & linked lists', [['Singly linked list', 1], ['Doubly linked list', 1], ['Array vs list', 0]]), topic('Stacks & queues', [['Stack applications', 1], ['Circular queue', 0]]), topic('Trees', [['Binary trees'], ['BST operations'], ['Tree traversals']]), topic('Recursion', [], true)] },
      { id: id(), courseId: c3.id, type: 'Quiz', title: 'Quiz 2', date: D(3), time: '10:00', place: 'C305', notes: '', topics: [topic('Matrix multiplication', [], true), topic('Determinants', [['2x2', 1], ['3x3', 0]]), topic('Inverse matrices')] },
      { id: id(), courseId: c2.id, type: 'Final', title: '', date: D(34), time: '14:00', place: 'Hall 1', notes: '', topics: [] },
    ],
    tasks: [
      { id: id(), courseId: c3.id, title: 'Homework 4', due: D(-1), done: false, notes: 'Chapters 3 and 4' },
      { id: id(), courseId: c1.id, title: 'Lab report: linked lists', due: D(1), done: false, notes: '' },
      { id: id(), courseId: c4.id, title: 'Essay draft', due: D(5), done: false, notes: '500 words' },
      { id: id(), courseId: c2.id, title: 'Read chapter 6', due: D(12), done: false, notes: '' },
      { id: id(), courseId: c1.id, title: 'Homework 2', due: D(-6), done: true, notes: '' },
    ],
    projects: [{ id: id(), courseId: c2.id, title: 'Mini shell project', due: D(14), done: false, desc: 'Build a tiny Unix-like shell in C.', notes: 'Meeting on Thursday after class.', members: m,
      tasks: [{ id: id(), title: 'Parse commands', assignee: m[0].id, due: D(4), done: true }, { id: id(), title: 'Pipes and redirection', assignee: m[1].id, due: D(8), done: false }, { id: id(), title: 'Write the report', assignee: m[2].id, due: D(12), done: false }, { id: id(), title: 'Prepare the demo', assignee: '', due: D(13), done: false }] }],
    files: [], lists: {
      daily: [{ id: id(), title: 'Review today\'s lecture notes', doneOn: null }, { id: id(), title: '25 minutes of focused study', doneOn: null }, { id: id(), title: 'Drink water 💧', doneOn: periodKey('daily') }],
      weekly: [{ id: id(), title: 'Tidy up my notes', doneOn: null }, { id: id(), title: 'Plan next week', doneOn: null }],
      monthly: [{ id: id(), title: 'Backup my files', doneOn: null }],
    },
  });
  $$('dialog').forEach((x) => x.close()); view = 'today'; commit();
}

/* ============ event handling ============ */
const A = {
  go: (el) => { if (el.closest('.ask-panel') && window.innerWidth <= 900) assistClose(); go(el.dataset.view); },
  ask: (el) => assistAsk(el.dataset.q), assist: () => assistToggle(), 'assist-close': () => assistClose(),
  'go-close': (el) => { $$('dialog').forEach((d) => d.close()); go(el.dataset.view); },
  bell: () => { bellOpen = !bellOpen; render(); },
  settings: () => openSettings(),
  theme: (el) => { S.theme = el.dataset.k; $$('dialog').forEach((d) => d.close()); commit(); openSettings(); },
  export: () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = `studynest-backup-${todayISO()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },
  sample: () => { if (!S.courses.length || confirm('Replace your current data with the sample data?')) sampleData(); },
  erase: () => { if (confirm('Erase ALL your data on this device? This cannot be undone.') && confirm('Really erase everything?')) { S = defaults(); $$('dialog').forEach((d) => d.close()); view = 'today'; commit(); } },
  filter: (el) => { taskFilter = el.dataset.k; render(); },
  'cal-mode': (el) => { calMode = el.dataset.k; render(); },
  'cal-nav': (el) => { const n = Number(el.dataset.n); if (calMode === 'week') calAnchor = addDays(calAnchor, 7 * n); else calAnchor = new Date(calAnchor.getFullYear(), calAnchor.getMonth() + n, 1); render(); },
  'cal-today': () => { calAnchor = new Date(); render(); },
  day: (el) => dayDialog(el.dataset.d),
  'course-add': () => courseForm(), 'course-edit': (el) => courseForm(el.dataset.id),
  'course-del': (el) => { if (!confirm('Delete this course? Its exams, tasks and projects stay but lose their course label.')) return; S.courses = S.courses.filter((c) => c.id !== el.dataset.id); view = 'courses'; commit(); },
  'slot-add': (el) => slotForm(el.dataset.id), 'slot-del': (el) => { courseOf(el.dataset.id).slots.splice(Number(el.dataset.i), 1); commit(); },
  'exam-add': (el) => examForm(null, el.dataset.course), 'exam-edit': (el) => examForm(el.dataset.id),
  'exam-del': (el) => { if (!confirm('Delete this exam and its topics?')) return; S.exams = S.exams.filter((e) => e.id !== el.dataset.id); view = 'exams'; commit(); },
  'sub-add': (el) => askText('Add subtopic', 'Subtopic', '', (v) => { const tp = S.exams.find((e) => e.id === el.dataset.id).topics.find((x) => x.id === el.dataset.tid); tp.subs = tp.subs || []; tp.subs.push({ id: uid(), title: v, done: false }); commit(); }),
  'topic-rename': (el) => { const tp = S.exams.find((e) => e.id === el.dataset.id).topics.find((x) => x.id === el.dataset.tid); askText('Rename topic', 'Topic', tp.title, (v) => { tp.title = v; commit(); }); },
  'topic-del': (el) => { const e = S.exams.find((x) => x.id === el.dataset.id); e.topics = e.topics.filter((x) => x.id !== el.dataset.tid); commit(); },
  'sub-del': (el) => { const tp = S.exams.find((e) => e.id === el.dataset.id).topics.find((x) => x.id === el.dataset.tid); tp.subs = tp.subs.filter((s) => s.id !== el.dataset.sid); commit(); },
  'task-add': (el) => { $$('dialog').forEach((d) => d.close()); taskForm(null, el.dataset.course, el.dataset.due); }, 'task-edit': (el) => taskForm(el.dataset.id),
  'task-del': (el) => { S.tasks = S.tasks.filter((t) => t.id !== el.dataset.id); commit(); },
  'proj-add': (el) => projForm(null, el.dataset.course), 'proj-edit': (el) => projForm(el.dataset.id),
  'proj-del': (el) => { if (!confirm('Delete this project?')) return; S.projects = S.projects.filter((p) => p.id !== el.dataset.id); view = 'projects'; commit(); },
  'member-add': (el) => askText('Add team member', 'Name', '', (v) => { S.projects.find((p) => p.id === el.dataset.id).members.push({ id: uid(), name: v }); commit(); }),
  'member-del': (el) => { const p = S.projects.find((x) => x.id === el.dataset.id); p.members = p.members.filter((m) => m.id !== el.dataset.mid); commit(); },
  'ptask-add': (el) => ptaskForm(el.dataset.id), 'ptask-edit': (el) => ptaskForm(el.dataset.id, el.dataset.tid),
  'ptask-del': (el) => { const p = S.projects.find((x) => x.id === el.dataset.id); p.tasks = p.tasks.filter((t) => t.id !== el.dataset.tid); commit(); },
  'li-del': (el) => { S.lists[el.dataset.kind] = S.lists[el.dataset.kind].filter((i) => i.id !== el.dataset.id); commit(); },
  'file-dl': (el) => downloadFile(el.dataset.id), 'file-del': (el) => { if (confirm('Delete this file?')) removeFile(el.dataset.id); },
  course: () => {},
};
const C = {
  'task-toggle': (el) => { const t = S.tasks.find((x) => x.id === el.dataset.id); t.done = el.checked; if (el.checked) confetti(); commit(); },
  'ptask-toggle': (el) => { const p = S.projects.find((x) => x.id === el.dataset.id); p.tasks.find((t) => t.id === el.dataset.tid).done = el.checked; if (el.checked && projProgress(p).p === 100) confetti(); commit(); },
  'li-toggle': (el) => { const i = S.lists[el.dataset.kind].find((x) => x.id === el.dataset.id); i.doneOn = el.checked ? periodKey(el.dataset.kind) : null; if (el.checked && S.lists[el.dataset.kind].every((x) => x.doneOn === periodKey(el.dataset.kind))) confetti(); commit(); },
  'topic-toggle': (el) => {
    const e = S.exams.find((x) => x.id === el.dataset.id), tp = e.topics.find((x) => x.id === el.dataset.tid);
    if (tp.subs && tp.subs.length) tp.subs.forEach((s) => (s.done = el.checked)); else tp.done = el.checked;
    if (el.checked && leaves(e).p === 100) confetti(); commit();
  },
  'sub-toggle': (el) => {
    const e = S.exams.find((x) => x.id === el.dataset.id), tp = e.topics.find((x) => x.id === el.dataset.tid);
    tp.subs.find((s) => s.id === el.dataset.sid).done = el.checked; tp.done = tp.subs.every((s) => s.done);
    if (el.checked && leaves(e).p === 100) confetti(); commit();
  },
};
document.addEventListener('click', (e) => {
  if (bellOpen && !e.target.closest('.panel') && !e.target.closest('[data-act=bell]') && !e.target.closest('[data-act=go]')) { bellOpen = false; render(); }
  const el = e.target.closest('[data-act]');
  if (el && A[el.dataset.act]) { e.stopPropagation(); A[el.dataset.act](el, e); }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.chg && C[t.dataset.chg]) C[t.dataset.chg](t);
  else if (t.dataset.upload) { addFiles(t.dataset.upload, [...t.files]); t.value = ''; }
  else if (t.hasAttribute('data-import')) {
    const f = t.files[0]; if (!f) return;
    f.text().then((txt) => {
      const j = JSON.parse(txt); if (!j || !Array.isArray(j.courses)) throw 0;
      if (!confirm('Replace your current data with this backup?')) return;
      S = Object.assign(defaults(), j); $$('dialog').forEach((d) => d.close()); commit();
    }).catch(() => alert('That file is not a valid StudyNest backup.'));
    t.value = '';
  }
});
document.addEventListener('input', (e) => {
  const n = e.target.dataset && e.target.dataset.note; if (!n) return;
  const arr = { course: S.courses, exam: S.exams, project: S.projects }[n]; const o = arr.find((x) => x.id === e.target.dataset.id);
  if (o) { o.notes = e.target.value; save(); }
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(f).entries()), kind = f.dataset.form, title = (v.title || '').trim();
  if (kind === 'name') { S.name = (v.name || '').trim(); $$('dialog').forEach((d) => d.close()); commit(); }
  else if (kind === 'li-add' && title) { S.lists[f.dataset.kind].push({ id: uid(), title, doneOn: null }); refocus = `form[data-kind="${f.dataset.kind}"] input`; commit(); }
  else if (kind === 'topic-add' && title) { S.exams.find((x) => x.id === f.dataset.id).topics.push({ id: uid(), title, done: false, subs: [] }); refocus = 'form[data-form="topic-add"] input'; commit(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && bellOpen) { bellOpen = false; render(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('dialog[open]')) render(); });
render();
