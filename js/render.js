// js/planner.js
import { supabase } from "./supabase.js";
import { state, save, saveCloud, loadCloud } from "./storage.js";
import { getNow, parseTime, pad, getLocalDateStr } from "./helpers.js";
import { render, applyTheme, updateLiveButton } from "./render.js";

// مدیریت تغییر تب‌ها
window.switchTab = function(tabId) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelector(`.nav-btn[data-tab="${tabId}"]`)?.classList.add('active');
  document.getElementById(tabId)?.classList.add('active');
};
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
});

// مدیریت تاریخ روزانه
document.getElementById('prev-day').onclick = () => shiftDay(-1);
document.getElementById('next-day').onclick = () => shiftDay(1);
document.getElementById('btn-today').onclick = () => { state.curDate = getLocalDateStr(); render(); };

function shiftDay(n){
  const [y,mo,d]=state.curDate.split('-').map(Number);
  const dt=new Date(y,mo-1,d + n);
  state.curDate=dt.getFullYear()+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate());
  render();
}

document.getElementById('map-prev').onclick = () => {
  const [y,mo]=state.mapMonth.split('-').map(Number);
  const dt=new Date(y, mo-2, 1); state.mapMonth=dt.getFullYear()+'-'+pad(dt.getMonth()+1); render();
};
document.getElementById('map-next').onclick = () => {
  const [y,mo]=state.mapMonth.split('-').map(Number);
  const dt=new Date(y, mo, 1); state.mapMonth=dt.getFullYear()+'-'+pad(dt.getMonth()+1); render();
};
document.getElementById('map-cat-select').onchange = () => render();

// رویدادهای تغییر تم و تغییر رنگ دلخواه از تب تنظیمات
document.getElementById('setting-theme-select').onchange = (e) => {
  state.theme = e.target.value; save('planner_theme', state.theme); saveCloud(); applyTheme();
};
document.getElementById('setting-accent-picker').onchange = (e) => {
  state.accentColor = e.target.value; save('planner_accent', state.accentColor); saveCloud(); applyTheme();
};

// رویدادهای جدید تنظیمات تقویم و قالب‌ها
document.getElementById('setting-calendar').onchange = (e) => {
  state.calendarPref = e.target.value; save('planner_calendar_pref', state.calendarPref); saveCloud(); render();
};
document.getElementById('setting-duration-format').onchange = (e) => {
  state.timeFormatPref = e.target.value; save('planner_time_format_pref', state.timeFormatPref); saveCloud(); render();
};
document.getElementById('setting-week-start').onchange = (e) => {
  state.weekStartPref = e.target.value; save('planner_week_start_pref', state.weekStartPref); saveCloud(); render();
};

// باز و بسته کردن باکس افزودن دسته‌بندی
document.getElementById('toggle-cat').onclick = () => {
  const box = document.getElementById('new-cat-box');
  box.style.display = box.style.display === 'block' ? 'none' : 'block';
};

// ذخیره دسته‌بندی جدید
document.getElementById('save-cat').onclick = () => {
  const name = document.getElementById('new-cat-name').value.trim();
  const color = document.getElementById('new-cat-color').value;
  if(!name){ alert('نام دسته‌بندی را وارد کنید'); return; }
  
  const nc = { id: 'c'+Date.now(), name, color };
  state.cats.push(nc);
  save('planner_cats', state.cats); saveCloud();
  
  document.getElementById('new-cat-name').value = '';
  document.getElementById('new-cat-box').style.display = 'none';
  render();
  document.getElementById('cat-select').value = nc.id;
  document.getElementById('map-cat-select').value = nc.id;
};

window.delCat = function(id) {
  if(!confirm(`آیا مطمئن هستید؟ فعالیت‌های قبلی پاک نمی‌شوند.`)) return;
  state.cats = state.cats.filter(c => c.id !== id);
  save('planner_cats', state.cats); saveCloud(); render();
};

// ثبت فعالیت جدید دستی
document.getElementById('add-btn').onclick = ()=>{
  const title = document.getElementById('act-title').value.trim();
  const catId = document.getElementById('cat-select').value;
  const tagsRaw = document.getElementById('act-tags').value.trim();
  const stRaw = document.getElementById('start-time').value;
  const enRaw = document.getElementById('end-time').value;
  
  if(!catId){ alert('موضوع انتخاب نشده است'); return; }
  const sMins=parseTime(stRaw); const eMins=parseTime(enRaw);
  if(sMins===null || eMins===null) return alert('فرمت زمان وارد شده صحیح نیست');

  let durMins = eMins - sMins; if(durMins < 0) durMins += 24*60;
  const tags = tagsRaw ? tagsRaw.split(' ').filter(t=>t.startsWith('#')) : [];

  state.events.push({ id: Date.now().toString(), date: state.curDate, title, catId, sMins, eMins, durMins, tags });
  save('planner_ev', state.events); saveCloud(); render(); switchTab('tab-timeline');
};

// شروع و پایان فعالیت زنده (پایان با ذخیره کسری زمان وقفه و پاز زنده)
document.getElementById('live-btn').onclick=()=>{
  if(!state.liveSession){
    state.liveSession = {
      title: document.getElementById('act-title').value.trim(),
      catId: document.getElementById('cat-select').value,
      date: state.curDate, sMins: parseTime(getNow()), 
      pauseMins: 0,
      pauseStartMins: null,
      isPomodoro: document.getElementById('pomodoro-toggle').checked
    };
    save('planner_live', state.liveSession); saveCloud(); updateLiveButton();
  } else {
    const endNow = parseTime(getNow());
    
    // محاسبه مجموع وقفه‌های سپری شده قبل از ثبت نهایی
    let finalPauseMins = state.liveSession.pauseMins || 0;
    if (state.liveSession.pauseStartMins !== null && state.liveSession.pauseStartMins !== undefined) {
      let diff = endNow - state.liveSession.pauseStartMins;
      if (diff < 0) diff += 24 * 60;
      finalPauseMins += diff;
    }

    let totalElapsed = endNow - state.liveSession.sMins; if(totalElapsed<0) totalElapsed += 24*60;
    let durMins = totalElapsed - finalPauseMins;
    if(durMins <= 0) durMins = 1; // جلوگیری از ذخیره زمان منفی

    state.events.push({
      id: Date.now().toString(), date: state.liveSession.date, title: state.liveSession.title,
      catId: state.liveSession.catId, sMins: state.liveSession.sMins, eMins: endNow, durMins, pauseMins: finalPauseMins, tags: []
    });
    state.liveSession=null; save('planner_live', null); save('planner_ev', state.events); saveCloud(); render(); updateLiveButton();
  }
};

// متد لغو و انصراف از ثبت زنده فعلی (جلوگیری از ذخیره شدن)
window.cancelLiveSession = function() {
  if(!confirm('آیا از لغو و حذف زمان این فعالیت زنده اطمینان دارید؟ (هیچ فعالیتی ثبت نخواهد شد)')) return;
  state.liveSession = null;
  save('planner_live', null);
  saveCloud();
  updateLiveButton();
};

// کپی و حذف فعالیت
window.duplicateEv = function(id) {
  const ev = state.events.find(e => e.id === id); if(!ev) return;
  state.events.push({ ...ev, id: Date.now().toString(), date: state.curDate });
  save('planner_ev', state.events); saveCloud(); render(); alert('فعالیت کپی شد!');
};
window.delEv = function(id) {
  if(!confirm('حذف شود؟')) return;
  state.events = state.events.filter(e => e.id !== id);
  save('planner_ev', state.events); saveCloud(); render();
};

// تودو و عادت
document.getElementById('add-todo-btn').onclick = () => {
  const title = document.getElementById('todo-input').value.trim(); if(!title) return;
  state.todos.push({ id: 't'+Date.now(), title, date: state.curDate, done: false });
  save('planner_todos', state.todos); saveCloud(); render(); document.getElementById('todo-input').value = '';
};
window.toggleTodo = (id) => {
  const t = state.todos.find(x => x.id === id); if(t) { t.done = !t.done; save('planner_todos', state.todos); saveCloud(); render(); }
};
window.deleteTodo = (id) => { state.todos = state.todos.filter(x => x.id !== id); save('planner_todos', state.todos); saveCloud(); render(); };

document.getElementById('add-habit-btn').onclick = () => {
  const title = document.getElementById('habit-input').value.trim(); if(!title) return;
  state.habits.push({ id: 'h'+Date.now(), title }); save('planner_habits', state.habits); saveCloud(); render(); document.getElementById('habit-input').value = '';
};
window.toggleHabit = (hId, dateStr) => {
  if(!state.habitLogs[hId]) state.habitLogs[hId] = {};
  state.habitLogs[hId][dateStr] = !state.habitLogs[hId][dateStr];
  save('planner_habitLogs', state.habitLogs); saveCloud(); render();
};
window.deleteHabit = (id) => { state.habits = state.habits.filter(x => x.id !== id); delete state.habitLogs[id]; save('planner_habits', state.habits); save('planner_habitLogs', state.habitLogs); saveCloud(); render(); };

// مود
document.getElementById('save-mood-btn').onclick = () => {
  const note = document.getElementById('mood-note').value.trim();
  let selectedMood = state.moods[state.curDate]?.mood;
  state.moods[state.curDate] = { mood: selectedMood, note }; save('planner_moods', state.moods); saveCloud(); alert('ثبت شد!');
};
document.querySelectorAll('.mood-emoji').forEach(sp => {
  sp.onclick = () => {
    if(!state.moods[state.curDate]) state.moods[state.curDate] = { note: document.getElementById('mood-note').value };
    state.moods[state.curDate].mood = sp.getAttribute('data-mood'); save('planner_moods', state.moods); saveCloud(); render();
  };
});

// خروجی بک‌آپ
document.getElementById('export-btn').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
  a.download = `Planner_Backup_${state.curDate}.json`; a.click();
};

document.getElementById('report-confirm-btn').onclick = () => render();

// احراز هویت
async function handleUserSession(session) {
  const user = session?.user;
  if (!user) { window.location.href = "./login.html"; return; }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      try { await supabase.auth.signOut(); } catch (err) { console.error(err); }
      window.location.href = "./login.html";
    };
  }

  let displayName = user.user_metadata?.display_name || "";
  if (!displayName && user.email) displayName = user.email.split('@')[0];
  const msg = document.getElementById("welcome-msg");
  if (msg) msg.textContent = displayName ? "خوش آمدی، " + displayName + " 👋" : "خوش آمدی 👋";

  try {
    await loadCloud();
    applyTheme();
    render();
  } catch (err) { console.error(err); }
}

async function initAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await handleUserSession(session);
    else window.location.href = "./login.html";
  } catch (err) { window.location.href = "./login.html"; }
}

initAuth();

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") window.location.href = "./login.html";
  else if (event === "SIGNED_IN" && session) handleUserSession(session);
});
