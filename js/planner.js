// js/planner.js
import { supabase } from "./supabase.js";
import { state, save, saveCloud, loadCloud } from "./storage.js";
import { getNow, parseTime, fmtTime, pad, getLocalDateStr } from "./helpers.js";
import { render, applyTheme, updateLiveButton } from "./render.js";

// مدیریت تب‌ها
window.switchTab = function(tabId) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelector(`.nav-btn[data-tab="${tabId}"]`)?.classList.add('active');
  document.getElementById(tabId)?.classList.add('active');
};

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
});

// مدیریت تاریخ
document.getElementById('prev-day').onclick = () => { shiftDay(-1); };
document.getElementById('next-day').onclick = () => { shiftDay(1); };
document.getElementById('btn-today').onclick = () => { state.curDate = getLocalDateStr(); render(); };
function shiftDay(n){
  const [y,mo,d]=state.curDate.split('-').map(Number);
  const dt=new Date(y,mo-1,d + n);
  state.curDate=dt.getFullYear()+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate());
  render();
}

// تنظیمات تم و رنگ سفارشی
document.getElementById('theme-select').onchange = (e) => {
  state.theme = e.target.value; save('planner_theme', state.theme); saveCloud(); applyTheme();
};
document.getElementById('accent-color-picker').onchange = (e) => {
  state.accentColor = e.target.value; save('planner_accent', state.accentColor); saveCloud(); applyTheme();
};

// ثبت فعالیت جدید با پشتیبانی از تگ‌ها
document.getElementById('add-btn').onclick = ()=>{
  const title = document.getElementById('act-title').value.trim();
  const catId = document.getElementById('cat-select').value;
  const tagsRaw = document.getElementById('act-tags').value.trim();
  const stRaw = document.getElementById('start-time').value;
  const enRaw = document.getElementById('end-time').value;
  
  if(!catId){ alert('موضوع انتخاب نشده'); return; }
  const sMins=parseTime(stRaw); const eMins=parseTime(enRaw);
  if(sMins===null || eMins===null) return alert('زمان نامعتبر');

  let totalMins = eMins - sMins; if(totalMins < 0) totalMins += 24*60;
  const tags = tagsRaw ? tagsRaw.split(' ').filter(t=>t.startsWith('#')) : [];

  const ev = { id: Date.now().toString(), date: state.curDate, title, catId, sMins, eMins, durMins: totalMins, pauseMins: 0, tags };
  state.events.push(ev);
  
  save('planner_ev', state.events); saveCloud(); render(); switchTab('tab-timeline');
};

// سیستم زنده و پومودورو
document.getElementById('live-btn').onclick=()=>{
  if(!state.liveSession){
    const isPomodoro = document.getElementById('pomodoro-toggle').checked;
    state.liveSession = {
      title: document.getElementById('act-title').value.trim(),
      catId: document.getElementById('cat-select').value,
      date: state.curDate, sMins: parseTime(getNow()), pauseMins: 0, isPomodoro
    };
    save('planner_live', state.liveSession); saveCloud(); updateLiveButton();
  } else {
    const endNow = parseTime(getNow());
    let totalMins = endNow - state.liveSession.sMins; if(totalMins<0) totalMins += 24*60;
    state.events.push({
      id: Date.now().toString(), date: state.liveSession.date, title: state.liveSession.title,
      catId: state.liveSession.catId, sMins: state.liveSession.sMins, eMins: endNow, durMins: totalMins, pauseMins: state.liveSession.pauseMins, tags: []
    });
    state.liveSession=null; save('planner_live', null); save('planner_ev', state.events); saveCloud(); updateLiveButton(); render();
  }
};

// کپی کردن فعالیت (Duplicate)
window.duplicateEv = function(id) {
  const ev = state.events.find(e => e.id === id);
  if(!ev) return;
  const newEv = { ...ev, id: Date.now().toString(), date: state.curDate }; // کپی برای امروز
  state.events.push(newEv);
  save('planner_ev', state.events); saveCloud(); render();
  alert('فعالیت با موفقیت برای امروز کپی شد!');
};

// توابع Todo List
document.getElementById('add-todo-btn').onclick = () => {
  const title = document.getElementById('todo-input').value.trim();
  if(!title) return;
  state.todos.push({ id: 't'+Date.now(), title, date: state.curDate, done: false });
  save('planner_todos', state.todos); saveCloud(); render();
  document.getElementById('todo-input').value = '';
};
window.toggleTodo = (id) => {
  const t = state.todos.find(x => x.id === id);
  if(t) { t.done = !t.done; save('planner_todos', state.todos); saveCloud(); render(); }
};
window.deleteTodo = (id) => {
  state.todos = state.todos.filter(x => x.id !== id);
  save('planner_todos', state.todos); saveCloud(); render();
};

// توابع Habits
document.getElementById('add-habit-btn').onclick = () => {
  const title = document.getElementById('habit-input').value.trim();
  if(!title) return;
  state.habits.push({ id: 'h'+Date.now(), title });
  save('planner_habits', state.habits); saveCloud(); render();
  document.getElementById('habit-input').value = '';
};
window.toggleHabit = (hId, dateStr) => {
  if(!state.habitLogs[hId]) state.habitLogs[hId] = {};
  state.habitLogs[hId][dateStr] = !state.habitLogs[hId][dateStr];
  
  if(state.habitLogs[hId][dateStr]) {
    new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(()=>{});
  }
  
  save('planner_habitLogs', state.habitLogs); saveCloud(); render();
};
window.deleteHabit = (id) => {
  state.habits = state.habits.filter(x => x.id !== id);
  delete state.habitLogs[id];
  save('planner_habits', state.habits); save('planner_habitLogs', state.habitLogs); saveCloud(); render();
};

// تابع Mood Tracker
document.getElementById('save-mood-btn').onclick = () => {
  const note = document.getElementById('mood-note').value.trim();
  let selectedMood = state.moods[state.curDate]?.mood;
  state.moods[state.curDate] = { mood: selectedMood, note };
  save('planner_moods', state.moods); saveCloud();
  alert('حال و هوای امروزت ثبت شد!');
};
document.querySelectorAll('#mood-emojis span').forEach(sp => {
  sp.onclick = () => {
    const mood = sp.getAttribute('data-mood');
    if(!state.moods[state.curDate]) state.moods[state.curDate] = { note: '' };
    state.moods[state.curDate].mood = mood;
    save('planner_moods', state.moods); saveCloud(); render();
  };
});

// تابع خروجی فایل JSON (Export Backup)
document.getElementById('export-btn').onclick = () => {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `My_Planner_Backup_${state.curDate}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// شروع اولیه برنامه
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await loadCloud();
    render();
  } else {
    window.location.href = "./login.html";
  }
}
initAuth();
