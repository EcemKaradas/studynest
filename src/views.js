/* ============ navigation state ============ */
let view = 'today', calMode = 'week', calAnchor = new Date(), taskFilter = 'open', bellOpen = false, refocus = null;
const NAV = [['today', '🏠', 'Today'], ['calendar', '📅', 'Calendar'], ['courses', '📚', 'Courses'], ['exams', '📝', 'Exams'], ['tasks', '✅', 'Tasks'], ['projects', '👥', 'Projects'], ['lists', '🔁', 'Lists']];

function go(v) { view = v; bellOpen = false; render(); window.scrollTo(0, 0); }
const goBtn = (v, label) => `<button class="back" data-act="go" data-view="${v}">← ${label}</button>`;
const dueTag = (d) => { const r = rel(d); return `<span class="tag ${r.cls}">${r.text}</span>`; };
const courseTag = (id) => id ? `<span class="small muted"><span class="dotc" style="background:${colorOf(id)}"></span> ${esc(nameOf(id))}</span>` : '';

/* ============ shell ============ */
function render() {
  const keepY = window.scrollY;
  document.documentElement.dataset.theme = S.theme;
  const page = view.split(':')[0];
  const nav = page === 'course' ? 'courses' : page === 'exam' ? 'exams' : page === 'project' ? 'projects' : page;
  const urgent = urgentCount();
  const titles = { today: 'Today', calendar: 'Calendar', courses: 'Courses', course: 'Course', exams: 'Exams', exam: 'Exam prep', tasks: 'Tasks & assignments', projects: 'Group projects', project: 'Project', lists: 'My lists' };
  const fn = { today: viewToday, calendar: viewCalendar, courses: viewCourses, course: viewCourse, exams: viewExams, exam: viewExam, tasks: viewTasks, projects: viewProjects, project: viewProject, lists: viewLists }[page] || viewToday;
  $('#app').innerHTML = `<div class="shell">
    <nav class="side"><div class="logo"><b>🌱</b>StudyNest</div>
      ${NAV.map(([id, ic, label]) => `<button class="nav ${nav === id ? 'on' : ''}" data-act="go" data-view="${id}"><span>${ic}</span>${label}${id === 'today' && urgent ? `<i class="dot">${urgent}</i>` : ''}</button>`).join('')}
    </nav>
    <main><div class="top"><h1>${titles[page] || ''}</h1>
      <button class="icon" data-act="bell" aria-label="Reminders">🔔${urgent ? `<span class="badge">${urgent}</span>` : ''}</button>
      <button class="icon" data-act="settings" aria-label="Settings">⚙️</button></div>
      <div id="view">${fn(view.split(':')[1])}</div></main>
    ${bellOpen ? bellPanel() : ''}</div>`;
  $$('[data-indet]').forEach((el) => (el.indeterminate = true));
  if (refocus) { const el = $(refocus); if (el) el.focus(); refocus = null; }
  window.scrollTo(0, keepY);
}
function bellPanel() {
  const r = reminders();
  return `<div class="panel"><h3 style="margin-bottom:10px">🔔 Coming up</h3>${r.length ? r.map(reminderRow).join('') : '<div class="empty">Nothing due soon. Enjoy the calm! 🌿</div>'}</div>`;
}
function reminderRow(d) {
  return `<div class="item" style="cursor:pointer" data-act="go" data-view="${d.go}"><span style="font-size:20px">${KIND_ICON[d.kind]}</span><div class="body"><div class="t">${esc(d.title)}</div>${courseTag(d.course)}</div>${dueTag(d.date)}</div>`;
}

/* ============ TODAY ============ */
function viewToday() {
  const now = new Date(), h = now.getHours();
  const greet = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const quote = QUOTES[(now.getDate() + now.getMonth()) % QUOTES.length];
  const weekEnd = iso(addDays(now, 6));
  const dueWeek = deadlines().filter((d) => d.date >= todayISO() && d.date <= weekEnd).length;
  const upcoming = S.exams.filter((e) => daysUntil(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  let T = 0, D = 0; upcoming.forEach((e) => { const l = leaves(e); T += l.t; D += l.d; });
  const prep = T ? Math.round((D / T) * 100) : null;
  const classes = [];
  S.courses.forEach((c) => c.slots.forEach((s) => { if (s.day === dayIdx(now)) classes.push({ c, s }); }));
  classes.sort((a, b) => a.s.start.localeCompare(b.s.start));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dk = periodKey('daily'), daily = S.lists.daily, dDone = daily.filter((i) => i.doneOn === dk).length;

  const hero = `<div class="card hero"><h2>${greet}${S.name ? ', ' + esc(S.name) : ''} 👋</h2><p>${fmtLong(now)}</p><p style="margin-top:12px;font-weight:700">“${quote}”</p>
    <div class="pills"><span class="pill">📌 ${dueWeek} due this week</span>${prep !== null ? `<span class="pill">📖 ${prep}% exam topics done</span>` : ''}<span class="pill">☀️ ${dDone}/${daily.length} daily tasks</span></div></div>`;
  const welcome = !S.courses.length ? `<div class="card" style="margin-bottom:18px"><h3>🌱 Welcome to StudyNest</h3>
    <p class="muted" style="margin-top:0">Plan your classes, exams, assignments and group projects in one calm place. Start by adding your courses.</p>
    ${S.name ? '' : `<form data-form="name" class="inline" style="margin-bottom:12px"><input type="text" name="name" placeholder="What should I call you?"><button class="btn ghost">Save name</button></form>`}
    <div class="row"><button class="btn" data-act="course-add">➕ Add my first course</button><button class="btn ghost" data-act="sample">✨ Try with sample data</button></div></div>` : '';

  const classesCard = `<div class="card"><h3>🎒 Today's classes</h3>${classes.length ? classes.map(({ c, s }) => {
    const on = nowMin >= toMin(s.start) && nowMin < toMin(s.end);
    return `<div class="item"><span class="dotc" style="background:${c.color}"></span><div class="body"><div class="t">${esc(c.name)}</div><div class="small muted">${s.start} – ${s.end}${s.room ? ' · ' + esc(s.room) : ''}</div></div>${on ? '<span class="tag ok">Now</span>' : ''}</div>`;
  }).join('') : '<div class="empty">No classes today. Use the time well! 🎉</div>'}</div>`;
  const rem = reminders();
  const remCard = `<div class="card"><h3>🔔 Coming up <span class="sp"></span><button class="btn ghost sm" data-act="go" data-view="calendar">Calendar</button></h3>${rem.length ? rem.slice(0, 6).map(reminderRow).join('') + (rem.length > 6 ? `<div class="small muted" style="padding-top:8px">+ ${rem.length - 6} more</div>` : '') : '<div class="empty">Nothing due soon. 🌿</div>'}</div>`;
  const dailyCard = `<div class="card"><h3>☀️ Today's checklist <span class="sp"></span><span class="small muted">${dDone}/${daily.length}</span></h3>${daily.length ? barRow(Math.round(dDone / daily.length * 100)) : ''}${listItems('daily')}
    <form data-form="li-add" data-kind="daily" class="inline"><input type="text" name="title" placeholder="Add something for today" autocomplete="off"><button class="btn ghost">Add</button></form></div>`;
  const prepCard = `<div class="card"><h3>📖 Exam prep <span class="sp"></span><button class="btn ghost sm" data-act="go" data-view="exams">All exams</button></h3>${upcoming.length ? upcoming.slice(0, 4).map((e) => { const l = leaves(e); return `<div style="padding:8px 0;cursor:pointer" data-act="go" data-view="exam:${e.id}"><div class="row"><b>${esc(examTitle(e))}</b><span class="sp"></span>${dueTag(e.date)}</div>${l.t ? barRow(l.p) : '<div class="small muted">Add topics to track your progress</div>'}</div>`; }).join('') : '<div class="empty">No upcoming exams. Add one in the Exams tab.</div>'}</div>`;
  return hero + welcome + `<div class="grid g2">${classesCard}${remCard}${dailyCard}${prepCard}</div>`;
}

/* ============ LISTS (daily / weekly / monthly, they reset by themselves) ============ */
function listItems(kind) {
  const key = periodKey(kind);
  return S.lists[kind].map((i) => `<div class="item ${i.doneOn === key ? 'done' : ''}"><input type="checkbox" ${i.doneOn === key ? 'checked' : ''} data-chg="li-toggle" data-kind="${kind}" data-id="${i.id}"><div class="body"><div class="t">${esc(i.title)}</div></div><button class="x" data-act="li-del" data-kind="${kind}" data-id="${i.id}" aria-label="Delete">✕</button></div>`).join('');
}
function viewLists() {
  const meta = { daily: ['☀️', 'Daily', 'Resets every day'], weekly: ['📆', 'Weekly', 'Resets every Monday'], monthly: ['🗓️', 'Monthly', 'Resets on the 1st'] };
  return `<p class="muted" style="margin-top:0">Repeating to-do lists. Tick things off and they come back fresh when the day, week or month changes.</p><div class="grid g3">` +
    ['daily', 'weekly', 'monthly'].map((k) => {
      const key = periodKey(k), arr = S.lists[k], d = arr.filter((i) => i.doneOn === key).length;
      return `<div class="card"><h3>${meta[k][0]} ${meta[k][1]} <span class="sp"></span><span class="small muted">${d}/${arr.length}</span></h3><div class="small muted" style="margin:-6px 0 10px">${meta[k][2]}</div>${arr.length ? barRow(Math.round(d / arr.length * 100)) : ''}${listItems(k) || '<div class="empty">Nothing here yet.</div>'}
      <form data-form="li-add" data-kind="${k}" class="inline"><input type="text" name="title" placeholder="Add an item" autocomplete="off"><button class="btn ghost">Add</button></form></div>`;
    }).join('') + '</div>';
}

/* ============ COURSES ============ */
function viewCourses() {
  const cards = S.courses.map((c) => {
    const ex = S.exams.filter((e) => e.courseId === c.id && daysUntil(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
    const open = S.tasks.filter((t) => t.courseId === c.id && !t.done).length + S.projects.filter((p) => p.courseId === c.id && !p.done).length;
    return `<div class="card course-card" style="--c:${c.color}" data-act="go" data-view="course:${c.id}"><h3 style="font-size:19px">${esc(c.name)}</h3>
      <div class="muted small">${c.teacher ? esc(c.teacher) : 'No instructor added'}</div>
      <div class="small" style="margin:10px 0">${c.slots.map((s) => `${DAYS[s.day]} ${s.start}`).join(' · ') || '<span class="muted">No class times yet</span>'}</div>
      <div class="row"><span class="tag">${open} open</span>${ex ? `<span class="tag ${rel(ex.date).cls}">${esc(ex.type)}: ${rel(ex.date).text}</span>` : ''}</div></div>`;
  }).join('');
  return `<div class="row" style="margin-bottom:16px"><button class="btn" data-act="course-add">➕ Add course</button></div>` +
    (S.courses.length ? `<div class="grid g3">${cards}</div>` : '<div class="card empty">No courses yet. Add your first one to get started.</div>');
}
function viewCourse(id) {
  const c = courseOf(id); if (!c) return goBtn('courses', 'Courses') + '<div class="empty">Course not found.</div>';
  const exams = S.exams.filter((e) => e.courseId === id).sort((a, b) => a.date.localeCompare(b.date));
  const tasks = S.tasks.filter((t) => t.courseId === id), projs = S.projects.filter((p) => p.courseId === id);
  return goBtn('courses', 'All courses') + `<div class="card" style="border-top:6px solid ${c.color};margin-bottom:18px">
    <div class="row"><h2 style="flex:1">${esc(c.name)}</h2><button class="btn ghost sm" data-act="course-edit" data-id="${id}">✏️ Edit</button><button class="btn warn sm" data-act="course-del" data-id="${id}">🗑 Delete</button></div>
    <div class="muted">${c.teacher ? esc(c.teacher) : ''}</div></div>
    <div class="grid g2">
    <div class="card"><h3>🕘 Weekly schedule <span class="sp"></span><button class="btn ghost sm" data-act="slot-add" data-id="${id}">➕ Add</button></h3>${c.slots.map((s, i) => `<div class="item"><div class="body"><div class="t">${DAYS_LONG[s.day]}</div><div class="small muted">${s.start} – ${s.end}${s.room ? ' · ' + esc(s.room) : ''}</div></div><button class="x" data-act="slot-del" data-id="${id}" data-i="${i}">✕</button></div>`).join('') || '<div class="empty">No class times yet.</div>'}</div>
    <div class="card"><h3>📝 Exams <span class="sp"></span><button class="btn ghost sm" data-act="exam-add" data-course="${id}">➕ Add</button></h3>${exams.map((e) => { const l = leaves(e); return `<div style="padding:8px 0;cursor:pointer" data-act="go" data-view="exam:${e.id}"><div class="row"><b>${esc(examTitle(e))}</b><span class="sp"></span>${dueTag(e.date)}</div>${l.t ? barRow(l.p) : ''}</div>`; }).join('') || '<div class="empty">No exams yet.</div>'}</div>
    <div class="card"><h3>✅ Tasks <span class="sp"></span><button class="btn ghost sm" data-act="task-add" data-course="${id}">➕ Add</button></h3>${tasks.map(taskRow).join('') || '<div class="empty">No tasks yet.</div>'}</div>
    <div class="card"><h3>👥 Group projects <span class="sp"></span><button class="btn ghost sm" data-act="proj-add" data-course="${id}">➕ Add</button></h3>${projs.map((p) => `<div style="padding:8px 0;cursor:pointer" data-act="go" data-view="project:${p.id}"><div class="row"><b>${esc(p.title)}</b><span class="sp"></span>${p.due ? dueTag(p.due) : ''}</div>${barRow(projProgress(p).p)}</div>`).join('') || '<div class="empty">No projects yet.</div>'}</div>
    <div class="card"><h3>🗒️ Course notes</h3><textarea data-note="course" data-id="${id}" placeholder="Syllabus, grading rules, tips...">${esc(c.notes || '')}</textarea></div>
    <div class="card"><h3>📎 Lecture notes & files</h3>${filesBox('course:' + id)}</div></div>`;
}

/* ============ EXAMS ============ */
function viewExams() {
  const sorted = S.exams.slice().sort((a, b) => a.date.localeCompare(b.date));
  const up = sorted.filter((e) => daysUntil(e.date) >= 0), past = sorted.filter((e) => daysUntil(e.date) < 0);
  const card = (e) => { const l = leaves(e); return `<div class="card" style="cursor:pointer;border-left:6px solid ${colorOf(e.courseId)}" data-act="go" data-view="exam:${e.id}"><div class="row"><h3 style="margin:0">${esc(examTitle(e))}</h3><span class="sp"></span>${dueTag(e.date)}</div>
    <div class="small muted" style="margin:4px 0 10px">${fmtDate(e.date)}${e.time ? ' · ' + e.time : ''}${e.place ? ' · ' + esc(e.place) : ''}</div>${l.t ? barRow(l.p, `${l.d}/${l.t}`) : '<div class="small muted">No study topics yet</div>'}</div>`; };
  return `<div class="row" style="margin-bottom:16px"><button class="btn" data-act="exam-add">➕ Add exam</button></div>` +
    (up.length ? `<div class="grid g2">${up.map(card).join('')}</div>` : '<div class="card empty">No upcoming exams. Add your midterms and finals here.</div>') +
    (past.length ? `<div class="group">Past exams</div><div class="grid g2" style="opacity:.75">${past.map(card).join('')}</div>` : '');
}
function topicHTML(e, tp) {
  const subs = tp.subs || [], d = subs.filter((s) => s.done).length;
  const checked = subs.length ? d === subs.length : tp.done;
  return `<div class="topic"><div class="row" style="flex-wrap:nowrap"><input type="checkbox" ${checked ? 'checked' : ''} ${subs.length && d > 0 && d < subs.length ? 'data-indet' : ''} data-chg="topic-toggle" data-id="${e.id}" data-tid="${tp.id}"><b style="flex:1;min-width:0;overflow-wrap:anywhere;${checked ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(tp.title)}</b>${subs.length ? `<span class="small muted">${d}/${subs.length}</span>` : ''}
    <button class="x" title="Add subtopic" data-act="sub-add" data-id="${e.id}" data-tid="${tp.id}">➕</button><button class="x" title="Rename" data-act="topic-rename" data-id="${e.id}" data-tid="${tp.id}">✏️</button><button class="x" title="Delete" data-act="topic-del" data-id="${e.id}" data-tid="${tp.id}">🗑</button></div>
    ${subs.length ? `<div class="subs">${subs.map((s) => `<div class="sub"><input type="checkbox" ${s.done ? 'checked' : ''} data-chg="sub-toggle" data-id="${e.id}" data-tid="${tp.id}" data-sid="${s.id}"><span style="flex:1;overflow-wrap:anywhere;${s.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(s.title)}</span><button class="x" data-act="sub-del" data-id="${e.id}" data-tid="${tp.id}" data-sid="${s.id}">✕</button></div>`).join('')}</div>` : ''}</div>`;
}
function viewExam(id) {
  const e = S.exams.find((x) => x.id === id); if (!e) return goBtn('exams', 'Exams') + '<div class="empty">Exam not found.</div>';
  const l = leaves(e);
  return goBtn('exams', 'All exams') + `<div class="card" style="border-left:6px solid ${colorOf(e.courseId)};margin-bottom:18px">
    <div class="row"><h2 style="flex:1">${esc(examTitle(e))}</h2>${dueTag(e.date)}<button class="btn ghost sm" data-act="exam-edit" data-id="${id}">✏️ Edit</button><button class="btn warn sm" data-act="exam-del" data-id="${id}">🗑</button></div>
    <div class="muted" style="margin:4px 0 14px">${courseTag(e.courseId)} · ${fmtDate(e.date)}${e.time ? ' at ' + e.time : ''}${e.place ? ' · ' + esc(e.place) : ''}</div>
    ${barRow(l.p, l.t ? `${l.p}%` : '—')}<div class="small muted" style="margin-top:6px">${l.t ? (l.p >= 100 ? '🎉 Everything covered. You are ready!' : `${l.d} of ${l.t} topics done. Keep going!`) : 'Add the topics that will be on the exam to track your progress.'}</div></div>
    <div class="grid g2"><div class="card"><h3>📖 Study topics</h3>${e.topics.map((tp) => topicHTML(e, tp)).join('') || '<div class="empty">No topics yet.</div>'}
      <form data-form="topic-add" data-id="${id}" class="inline"><input type="text" name="title" placeholder="Add a topic (e.g. Binary trees)" autocomplete="off"><button class="btn ghost">Add</button></form></div>
    <div><div class="card" style="margin-bottom:18px"><h3>🗒️ Notes</h3><textarea data-note="exam" data-id="${id}" placeholder="What will be asked? Formulas, tips, past questions...">${esc(e.notes || '')}</textarea></div>
    <div class="card"><h3>📎 Study files</h3>${filesBox('exam:' + id)}</div></div></div>`;
}

/* ============ TASKS ============ */
function taskRow(t) {
  return `<div class="item ${t.done ? 'done' : ''}"><input type="checkbox" ${t.done ? 'checked' : ''} data-chg="task-toggle" data-id="${t.id}"><div class="body"><div class="t">${esc(t.title)}</div><div class="row" style="gap:8px">${courseTag(t.courseId)}${t.notes ? `<span class="small muted">· ${esc(t.notes).slice(0, 60)}</span>` : ''}</div></div>${t.due ? dueTag(t.due) : ''}<button class="x" data-act="task-edit" data-id="${t.id}">✏️</button><button class="x" data-act="task-del" data-id="${t.id}">🗑</button></div>`;
}
function viewTasks() {
  const all = S.tasks, open = all.filter((t) => !t.done), done = all.filter((t) => t.done);
  let body;
  if (taskFilter === 'done') body = done.map(taskRow).join('') || '<div class="empty">Nothing completed yet.</div>';
  else {
    const src = taskFilter === 'all' ? all : open;
    const g = { over: [], today: [], week: [], later: [], none: [] };
    src.forEach((t) => { if (!t.due) g.none.push(t); else { const n = daysUntil(t.due); (t.done ? g.later : n < 0 ? g.over : n === 0 ? g.today : n <= 7 ? g.week : g.later).push(t); } });
    Object.values(g).forEach((a) => a.sort((x, y) => (x.due || '9').localeCompare(y.due || '9')));
    const sec = (title, arr, cls = '') => arr.length ? `<div class="group ${cls}">${title}</div>${arr.map(taskRow).join('')}` : '';
    body = sec('Overdue', g.over, 'bad') + sec('Today', g.today) + sec('This week', g.week) + sec('Later', g.later) + sec('No date', g.none) || '<div class="empty">All clear! Add a new assignment when you get one. 🌿</div>';
  }
  return `<div class="row" style="margin-bottom:16px"><button class="btn" data-act="task-add">➕ Add task</button><span class="sp"></span></div>
    <div class="chips">${[['open', `Open (${open.length})`], ['done', `Done (${done.length})`], ['all', 'All']].map(([k, l]) => `<button class="chip ${taskFilter === k ? 'on' : ''}" data-act="filter" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="card">${body}</div>`;
}

/* ============ PROJECTS ============ */
const initials = (n) => (n || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const memberColor = (p, mid) => COLORS[Math.max(0, p.members.findIndex((m) => m.id === mid)) % COLORS.length];
const avatar = (p, m) => `<span class="avatar" style="background:${memberColor(p, m.id)}" title="${esc(m.name)}">${esc(initials(m.name))}</span>`;
function viewProjects() {
  const cards = S.projects.slice().sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).map((p) => { const pr = projProgress(p); return `<div class="card course-card" style="--c:${colorOf(p.courseId)}" data-act="go" data-view="project:${p.id}">
    <div class="row"><h3 style="margin:0;flex:1">${esc(p.title)}</h3>${p.done ? '<span class="tag ok">Done</span>' : p.due ? dueTag(p.due) : ''}</div><div style="margin:4px 0 12px">${courseTag(p.courseId)}</div>
    ${pr.t ? barRow(pr.p, `${pr.d}/${pr.t}`) : '<div class="small muted">No tasks yet</div>'}<div class="avatars" style="margin-top:14px">${p.members.map((m) => avatar(p, m)).join('')}</div></div>`; }).join('');
  return `<div class="row" style="margin-bottom:16px"><button class="btn" data-act="proj-add">➕ New project</button></div>` + (cards ? `<div class="grid g3">${cards}</div>` : '<div class="card empty">No projects yet. Add a group project and split the tasks between your teammates.</div>');
}
function viewProject(id) {
  const p = S.projects.find((x) => x.id === id); if (!p) return goBtn('projects', 'Projects') + '<div class="empty">Project not found.</div>';
  const pr = projProgress(p);
  const work = p.members.map((m) => { const mine = p.tasks.filter((t) => t.assignee === m.id); return { m, d: mine.filter((t) => t.done).length, t: mine.length }; });
  const unassigned = p.tasks.filter((t) => !t.assignee || !p.members.some((m) => m.id === t.assignee)).length;
  return goBtn('projects', 'All projects') + `<div class="card" style="border-top:6px solid ${colorOf(p.courseId)};margin-bottom:18px">
    <div class="row"><h2 style="flex:1">${esc(p.title)}</h2>${p.due ? dueTag(p.due) : ''}<button class="btn ghost sm" data-act="proj-edit" data-id="${id}">✏️ Edit</button><button class="btn warn sm" data-act="proj-del" data-id="${id}">🗑</button></div>
    <div style="margin:4px 0 10px">${courseTag(p.courseId)}${p.due ? ` <span class="small muted">· due ${fmtDate(p.due)}</span>` : ''}</div>${p.desc ? `<p style="margin:0 0 12px">${esc(p.desc)}</p>` : ''}
    ${barRow(pr.p, pr.t ? `${pr.p}%` : '—')}<div class="small muted" style="margin-top:6px">${pr.t ? (pr.p >= 100 ? '🎉 All tasks done!' : `${pr.d} of ${pr.t} tasks done`) : 'Add tasks and assign them to your teammates.'}</div></div>
    <div class="grid g2"><div class="card"><h3>👥 Team <span class="sp"></span><button class="btn ghost sm" data-act="member-add" data-id="${id}">➕ Add</button></h3>
      ${work.map(({ m, d, t }) => `<div class="item">${avatar(p, m)}<div class="body"><div class="t">${esc(m.name)}</div><div class="small muted">${t ? `${d}/${t} tasks done` : 'No tasks assigned'}</div></div><button class="x" data-act="member-del" data-id="${id}" data-mid="${m.id}">✕</button></div>`).join('') || '<div class="empty">Add your teammates (you can add yourself too).</div>'}${unassigned ? `<div class="small muted" style="padding-top:8px">${unassigned} task(s) not assigned yet</div>` : ''}</div>
    <div class="card"><h3>🧩 Tasks <span class="sp"></span><button class="btn ghost sm" data-act="ptask-add" data-id="${id}">➕ Add</button></h3>
      ${p.tasks.map((t) => { const m = p.members.find((x) => x.id === t.assignee); return `<div class="item ${t.done ? 'done' : ''}"><input type="checkbox" ${t.done ? 'checked' : ''} data-chg="ptask-toggle" data-id="${id}" data-tid="${t.id}"><div class="body"><div class="t">${esc(t.title)}</div><div class="row" style="gap:6px">${m ? avatar(p, m) + `<span class="small muted">${esc(m.name)}</span>` : '<span class="small muted">Unassigned</span>'}</div></div>${t.due ? dueTag(t.due) : ''}<button class="x" data-act="ptask-edit" data-id="${id}" data-tid="${t.id}">✏️</button><button class="x" data-act="ptask-del" data-id="${id}" data-tid="${t.id}">🗑</button></div>`; }).join('') || '<div class="empty">No tasks yet.</div>'}</div>
    <div class="card"><h3>🗒️ Project notes</h3><textarea data-note="project" data-id="${id}" placeholder="Ideas, meeting notes, links...">${esc(p.notes || '')}</textarea></div>
    <div class="card"><h3>📎 Project files</h3>${filesBox('project:' + id)}</div></div>`;
}

/* ============ CALENDAR ============ */
function viewCalendar() {
  const wk = mondayOf(calAnchor);
  const mo = new Date(calAnchor.getFullYear(), calAnchor.getMonth(), 1);
  const label = calMode === 'week' ? `${fmtDate(iso(wk))} – ${fmtDate(iso(addDays(wk, 6)))}` : mo.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const head = `<div class="row" style="margin-bottom:16px"><div class="chips" style="margin:0">${['week', 'month'].map((m) => `<button class="chip ${calMode === m ? 'on' : ''}" data-act="cal-mode" data-k="${m}">${m === 'week' ? 'Week' : 'Month'}</button>`).join('')}</div><span class="sp"></span>
    <button class="btn ghost sm" data-act="cal-nav" data-n="-1">◀</button><b style="min-width:140px;text-align:center">${label}</b><button class="btn ghost sm" data-act="cal-nav" data-n="1">▶</button><button class="btn sm" data-act="cal-today">Today</button></div>`;
  return head + (calMode === 'week' ? weekGrid(wk) : monthGrid(mo));
}
function weekGrid(wk) {
  let minH = 8, maxH = 17;
  S.courses.forEach((c) => c.slots.forEach((s) => { minH = Math.min(minH, Math.floor(toMin(s.start) / 60)); maxH = Math.max(maxH, Math.ceil(toMin(s.end) / 60)); }));
  const ph = 52, hours = maxH - minH, dl = deadlines(), t0 = todayISO();
  let cols = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(wk, i), ds = iso(d);
    const chips = dl.filter((x) => x.date === ds).map((x) => `<div class="chipx" style="--c:${colorOf(x.course)}" data-act="go" data-view="${x.go}" title="${esc(x.title)}">${KIND_ICON[x.kind]} ${esc(x.title)}</div>`).join('');
    const blocks = S.courses.flatMap((c) => c.slots.filter((s) => s.day === i).map((s) => `<div class="blk" style="--c:${c.color};top:${(toMin(s.start) - minH * 60) / 60 * ph}px;height:${Math.max(24, (toMin(s.end) - toMin(s.start)) / 60 * ph - 2)}px">${esc(c.name)}<small>${s.start}–${s.end}${s.room ? ' · ' + esc(s.room) : ''}</small></div>`)).join('');
    cols += `<div style="min-width:0"><div class="wk-head ${ds === t0 ? 'today' : ''}" data-act="day" data-d="${ds}" style="cursor:pointer">${DAYS[i]}<small>${d.getDate()}</small></div><div class="wk-all">${chips}</div><div class="wk-col" style="height:${hours * ph}px;background:repeating-linear-gradient(var(--line) 0 1px,transparent 1px ${ph}px)">${blocks}</div></div>`;
  }
  const hourCol = `<div><div class="wk-head">&nbsp;<small>&nbsp;</small></div><div class="wk-all"></div><div class="wk-hours" style="--ph:${ph}px">${Array.from({ length: hours }, (_, k) => `<div>${pad(minH + k)}:00</div>`).join('')}</div></div>`;
  return `<div class="card wk-scroll" style="padding:12px"><div class="week">${hourCol}${cols}</div></div>`;
}
function monthGrid(mo) {
  const start = mondayOf(mo), dl = deadlines(), t0 = todayISO();
  const rows = Math.ceil((dayIdx(mo) + new Date(mo.getFullYear(), mo.getMonth() + 1, 0).getDate()) / 7);
  let cells = '';
  for (let i = 0; i < rows * 7; i++) {
    const d = addDays(start, i), ds = iso(d), items = dl.filter((x) => x.date === ds);
    cells += `<div class="cell ${d.getMonth() !== mo.getMonth() ? 'other' : ''} ${ds === t0 ? 'today' : ''}" data-act="day" data-d="${ds}"><b>${d.getDate()}</b>${items.slice(0, 2).map((x) => `<div class="chipx" style="--c:${colorOf(x.course)}">${KIND_ICON[x.kind]} ${esc(x.title)}</div>`).join('')}${items.length > 2 ? `<div class="more">+${items.length - 2} more</div>` : ''}</div>`;
  }
  return `<div class="month" style="margin-bottom:6px">${DAYS.map((d) => `<div class="mh">${d}</div>`).join('')}</div><div class="month">${cells}</div>`;
}
function dayDialog(ds) {
  const d = parseISO(ds), cls = [];
  S.courses.forEach((c) => c.slots.forEach((s) => { if (s.day === dayIdx(d)) cls.push({ c, s }); }));
  cls.sort((a, b) => a.s.start.localeCompare(b.s.start));
  const items = deadlines().filter((x) => x.date === ds);
  const dlg = openModal(`<h3>${fmtLong(d)}</h3>${cls.length ? `<div class="group" style="margin-top:0">Classes</div>${cls.map(({ c, s }) => `<div class="item"><span class="dotc" style="background:${c.color}"></span><div class="body"><div class="t">${esc(c.name)}</div><div class="small muted">${s.start} – ${s.end}${s.room ? ' · ' + esc(s.room) : ''}</div></div></div>`).join('')}` : ''}
    ${items.length ? `<div class="group">Due</div>${items.map((x) => `<div class="item" style="cursor:pointer" data-act="go-close" data-view="${x.go}"><span style="font-size:20px">${KIND_ICON[x.kind]}</span><div class="body"><div class="t">${esc(x.title)}</div>${courseTag(x.course)}</div></div>`).join('')}` : ''}
    ${!cls.length && !items.length ? '<div class="empty">Nothing planned. 🌿</div>' : ''}
    <div class="row end"><button class="btn ghost" data-close>Close</button><button class="btn" data-act="task-add" data-due="${ds}" data-closeall>➕ Add task</button></div>`);
  $$('[data-close]', dlg).forEach((b) => (b.onclick = () => dlg.close()));
}
