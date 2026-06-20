// js/planner.js
import { supabase } from "./supabase.js";
import { state, save, saveCloud, loadCloud } from "./storage.js";
import { getNow, parseTime, fmtTime, pad } from "./helpers.js";
import { render, applyTheme, renderRoutines } from "./render.js";

// اتصال رویداد جابجایی پویای تقویم هفتگی به حوزه سراسری جهت رفع باگ پرش تاریخ
window.navigateToDay = function(dateStr) {
  state.curDate = dateStr;
  state.activeView = 'daily';
  
  const btnDaily = document.getElementById('view-daily-btn');
  const btnWeekly = document.getElementById('view-weekly-btn');
  if (btnDaily && btnWeekly) {
    btnDaily.style.background = 'var(--surface2)';
    btnDaily.style.color = 'var(--text)';
    btnWeekly.style.background = 'var(--surface3)';
    btnWeekly.style.color = 'var(--muted)';
  }
  render();
};

function shiftDay(n){
  const [y,mo,d]=state.curDate.split('-').map(Number);
  const dt=new Date(y,mo-1,d);
  dt.setDate(dt.getDate()+n);
  state.curDate=dt.getFullYear()+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate());
  render();
}

// تابع اعتبارسنجی فیلدهای زمان در کنترلر
function setupTimeInput(inp){
  if(!inp) return;
  inp.addEventListener('input', function(){
    let v=this.value.replace(/[^\d:]/g,'');
    const digits=v.replace(/:/g,'');
    if(digits.length>=3 && !v.includes(':'))
      v=digits.slice(0,2)+':'+digits.slice(2,4);
    this.value=v;
  });
  inp.addEventListener('blur', function(){
    const v=this.value.trim();
    if(v && parseTime(v)===null){
      this.style.borderColor='#ef4444';
      this.style.boxShadow='0 0 0 3px rgba(239,68,68,.2)';
    } else {
      this.style.borderColor='';
      this.style.boxShadow='';
    }
  });
  inp.addEventListener('focus', function(){
    this.style.borderColor='';
    this.style.boxShadow='';
  });
}

function createEvent({title, catId, stRaw, enRaw, pauseRaw = "0", date=state.curDate, targetId = null}){
  if(!catId || !state.cats.some(c=>c.id===catId)){
    alert('اول یک موضوع بسازید یا انتخاب کنید');
    return false;
  }

  let finalTitle = (title || '').trim();
  if(!finalTitle){
    finalTitle = state.cats.find(c => c.id === catId)?.name || 'فعالیت بی‌نام';
  }

  const sMins=parseTime(stRaw);
  const eMinsRaw=parseTime(enRaw);
  if(sMins===null||eMinsRaw===null){
    const err = document.getElementById('time-err');
    if(err) err.style.display='block';
    setTimeout(()=>{ if(err) err.style.display='none'; }, 3000);
    return false;
  }

  let totalMins = eMinsRaw - sMins;
  if(totalMins < 0) totalMins += 24*60;

  let pauseMins = parseInt(pauseRaw || "0", 10);
  if(isNaN(pauseMins) || pauseMins < 0) pauseMins = 0;

  let durMins = totalMins - pauseMins;
  if(durMins <= 0){
    alert('زمان پاز/وقفه نمی‌تواند بزرگتر یا مساوی با کل زمان سپری‌شده فعالیت باشد.');
    return false;
  }

  // بررسی عدم تداخل و همپوشانی زمانی
  const dayEvents = state.events.filter(e => e.date === date && e.id !== targetId);
  for (let ext of dayEvents) {
    let start1 = sMins;
    let end1 = sMins + totalMins;

    let start2 = ext.sMins;
    let extTotal = ext.durMins + (ext.pauseMins || 0);
    let end2 = ext.sMins + extTotal;

    if (Math.max(start1, start2) < Math.min(end1, end2)) {
      alert(`همپوشانی زمانی رخ داد! این زمان با فعالیت ثبت‌شده «${ext.title}» (${fmtTime(ext.sMins)} تا ${fmtTime(ext.eMins)}) تداخل دارد.`);
      return false;
    }
  }

  const eMins = sMins + totalMins > 1440 ? sMins + totalMins - 1440 : sMins + totalMins;

  if (targetId) {
    const idx = state.events.findIndex(e => e.id === targetId);
    if (idx !== -1) {
      state.events[idx] = {
        ...state.events[idx],
        title: finalTitle,
        catId,
        sMins,
        eMins,
        durMins,
        pauseMins
      };
    }
  } else {
    const ev={
      id: Date.now().toString(),
      date, 
      title: finalTitle,
      catId,
      sMins, eMins, durMins, pauseMins
    };
    state.events.push(ev);
  }

  save('planner_ev', state.events);
  saveCloud();
  return true;
}

function clearEventForm(){
  document.getElementById('act-title').value='';
  document.getElementById('start-time').value='';
  document.getElementById('end-time').value='';
  document.getElementById('pause-time').value='';
}

document.getElementById('add-btn').onclick = ()=>{
  const ok=createEvent({
    title: document.getElementById('act-title').value.trim(),
    catId: document.getElementById('cat-select').value,
    stRaw: document.getElementById('start-time').value,
    enRaw: document.getElementById('end-time').value,
    pauseRaw: document.getElementById('pause-time').value,
    targetId: state.editingEventId
  });
  if(!ok) return;

  if (state.editingEventId) {
    state.editingEventId = null;
    document.getElementById('add-btn').textContent = '+ افزودن به تایم‌لاین';
    document.getElementById('edit-cancel-btn').style.display = 'none';
  }

  clearEventForm();
  render();
};

document.getElementById('edit-cancel-btn').onclick = () => {
  state.editingEventId = null;
  document.getElementById('add-btn').textContent = '+ افزودن به تایم‌لاین';
  document.getElementById('edit-cancel-btn').style.display = 'none';
  clearEventForm();
};

// متد سراسری حذف فعالیت‌ها
window.delEv = function(id) {
  if(!confirm('این فعالیت حذف شود؟')) return;
  state.events = state.events.filter(e => e.id !== id);
  save('planner_ev', state.events);
  saveCloud();
  render();
};

window.editEv = function(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;

  state.editingEventId = id;
  document.getElementById('act-title').value = ev.title === (state.cats.find(c=>c.id===ev.catId)?.name || '') ? '' : ev.title;
  document.getElementById('cat-select').value = ev.catId;
  document.getElementById('start-time').value = fmtTime(ev.sMins);
  document.getElementById('end-time').value = fmtTime(ev.eMins);
  document.getElementById('pause-time').value = ev.pauseMins || '';

  document.getElementById('add-btn').textContent = '✓ ثبت تغییرات فعالیت';
  document.getElementById('edit-cancel-btn').style.display = 'block';

  document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
};

window.delCat = function(id) {
  const cat = state.cats.find(c => c.id === id) || {name: 'موضوع'};
  if(!confirm(`موضوع «${cat.name}» حذف شود؟ فعالیت‌های قبلی پاک نمی‌شوند.`)) return;
  state.cats = state.cats.filter(c=>c.id!==id);
  save('planner_cats', state.cats);
  saveCloud();
  if(state.liveSession && state.liveSession.catId===id){
    state.liveSession=null;
    save('planner_live', null);
    saveCloud();
  }
  render();
};

// کنترل و ثبت روتین‌های هفتگی
const dayBtns = document.querySelectorAll('.rt-day-btn');
dayBtns.forEach(btn => {
  btn.onclick = function() {
    const day = parseInt(this.getAttribute('data-day'), 10);
    if (state.selectedRtDays.includes(day)) {
      state.selectedRtDays = state.selectedRtDays.filter(d => d !== day);
      this.style.background = 'var(--surface2)';
      this.style.borderColor = 'var(--border2)';
      this.style.color = 'var(--text)';
      this.style.boxShadow = 'none';
    } else {
      state.selectedRtDays.push(day);
      this.style.background = 'var(--accent)';
      this.style.borderColor = 'var(--accent)';
      this.style.color = '#fff';
      this.style.boxShadow = '0 0 8px var(--accent-glow)';
    }
  };
});

const addRtBtn = document.getElementById('add-rt-btn');
if (addRtBtn) {
  addRtBtn.onclick = function() {
    const title = document.getElementById('rt-title').value.trim();
    const start = document.getElementById('rt-start').value.trim();
    const end = document.getElementById('rt-end').value.trim();
    const catId = document.getElementById('cat-select').value;

    if (!title || !start || !end || !catId) {
      alert('لطفاً تمامی فیلدهای روتین را تکمیل کنید');
      return;
    }
    if (state.selectedRtDays.length === 0) {
      alert('لطفاً حداقل یک روز را برای تکرار روتین انتخاب کنید');
      return;
    }
    
    const sMins = parseTime(start);
    const eMins = parseTime(end);
    if (sMins === null || eMins === null) {
      alert('فرمت زمان روتین نامعتبر است (مانند 17:00)');
      return;
    }
    
    const newRt = {
      id: Date.now().toString(),
      title,
      catId,
      days: [...state.selectedRtDays],
      startTime: start,
      endTime: end
    };
    
    state.routines.push(newRt);
    save('planner_routines', state.routines);
    saveCloud();
    
    // ریست فرم روتین بعد از ثبت
    document.getElementById('rt-title').value = '';
    document.getElementById('rt-start').value = '';
    document.getElementById('rt-end').value = '';
    state.selectedRtDays = [];
    dayBtns.forEach(b => {
      b.style.background = 'var(--surface2)';
      b.style.borderColor = 'var(--border2)';
      b.style.color = 'var(--text)';
      b.style.boxShadow = 'none';
    });

    renderRoutines();
    render();
  };
}

// گوش دادن و اتصال دکمه‌های ناوبری تاریخ
document.getElementById('prev-day').onclick = () => shiftDay(-1);
document.getElementById('next-day').onclick = () => shiftDay(1);
document.getElementById('btn-today').onclick = () => {
  state.curDate = new Date().toISOString().split('T')[0];
  render();
};
document.getElementById('map-prev').onclick = () => {
  const [y,mo]=state.mapMonth.split('-').map(Number);
  const dt=new Date(y, mo-2, 1);
  state.mapMonth=dt.getFullYear()+'-'+pad(dt.getMonth()+1);
  render();
};
document.getElementById('map-next').onclick = () => {
  const [y,mo]=state.mapMonth.split('-').map(Number);
  const dt=new Date(y, mo, 1);
  state.mapMonth=dt.getFullYear()+'-'+pad(dt.getMonth()+1);
  render();
};
document.getElementById('map-cat-select').onchange = () => render();

// بررسی خودکار روتین‌ها و افزودن به تایم‌لاین
function checkAndAddRoutines() {
  const now = new Date();
  const jsDay = now.getDay(); 
  const irDay = (jsDay + 1) % 7;
  
  const currentTimeMins = now.getHours() * 60 + now.getMinutes();
  const todayStr = now.toISOString().split('T')[0];
  
  let changed = false;
  state.routines.forEach(rt => {
    if (rt.days.includes(irDay)) {
      const sMins = parseTime(rt.startTime);
      if (currentTimeMins >= sMins) {
        const alreadyExists = state.events.some(e => e.date === todayStr && e.catId === rt.catId && e.sMins === sMins);
        if (!alreadyExists) {
          const totalMins = parseTime(rt.endTime) - sMins;
          const durMins = totalMins > 0 ? totalMins : totalMins + 24*60;
          
          const ev = {
            id: 'rt_' + rt.id + '_' + Date.now(),
            date: todayStr,
            title: rt.title,
            catId: rt.catId,
            sMins: sMins,
            eMins: parseTime(rt.endTime),
            durMins: durMins,
            pauseMins: 0
          };
          state.events.push(ev);
          changed = true;
        }
      }
    }
  });
  
  if (changed) {
    save('planner_ev', state.events);
    saveCloud();
    render();
  }
}

// چک کردن روتین‌ها به صورت دوره‌ای هر ۳۰ ثانیه
setInterval(checkAndAddRoutines, 30000);

setupTimeInput(document.getElementById('start-time'));
setupTimeInput(document.getElementById('end-time'));
setupTimeInput(document.getElementById('rt-start'));
setupTimeInput(document.getElementById('rt-end'));

const pauseInp = document.getElementById('pause-time');
if (pauseInp) {
  pauseInp.addEventListener('input', function(){
    this.value = this.value.replace(/[^\d]/g, '');
  });
}

// رفع تداخل دکمه‌های «الان» همراه با ارسال متد تریگر جهت پاک کردن کادر قرمز خطا
document.getElementById('btn-now-s').onclick = ()=>{
  const inp = document.getElementById('start-time');
  if (inp) {
    inp.value = getNow();
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('blur', { bubbles: true }));
  }
};

document.getElementById('btn-now-e').onclick = ()=>{
  const inp = document.getElementById('end-time');
  if (inp) {
    inp.value = getNow();
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('blur', { bubbles: true }));
  }
};

// اعتبارسنجی گزارش دوره‌ای
const reportConfirmBtn = document.getElementById('report-confirm-btn');
if (reportConfirmBtn) {
  reportConfirmBtn.onclick = function() {
    const valInp = document.getElementById('report-days');
    const val = valInp ? valInp.value.trim() : "7";
    const err = document.getElementById('report-err');
    
    if (/[۰-۹]/.test(val) || /[^\d]/.test(val) || val === "" || parseInt(val, 10) <= 0) {
      if (err) err.style.display = 'block';
    } else {
      if (err) err.style.display = 'none';
      render();
    }
  };
}

// متصل کردن توابع سراسری ویرایش و حذف روتین
window.delRoutine = function(id) {
  if (!confirm('این روتین حذف شود؟')) return;
  state.routines = state.routines.filter(r => r.id !== id);
  save('planner_routines', state.routines);
  saveCloud();
  render();
};

// واگذاری رویداد خروج و احراز هویت بدون مسدودی قفل
async function handleUserSession(session) {
  const user = session?.user;
  if (!user) {
    window.location.href = "./login.html";
    return;
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error("خطا در خروج:", err);
      }
      window.location.href = "./login.html";
    };
  }

  let displayName = user.user_metadata?.display_name || "";
  if (!displayName && user.email) {
    displayName = user.email.split('@')[0];
  }

  const msg = document.getElementById("welcome-msg");
  if (msg) {
    msg.textContent = displayName ? "خوش آمدی، " + displayName + " 👋" : "خوش آمدی 👋";
  }

  setTimeout(async () => {
    try {
      localStorage.removeItem('planner_ev');
      localStorage.removeItem('planner_cats');
      localStorage.removeItem('planner_live');
      localStorage.removeItem('planner_routines');
      state.events = [];
      state.cats = [];
      state.liveSession = null;
      state.routines = [];

      await loadCloud();

      if (!user.user_metadata?.display_name) {
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .maybeSingle();
        if (profile && !profileErr && profile.name) {
          displayName = profile.name;
          if (msg) msg.textContent = "خوش آمدی، " + displayName + " 👋";
        }
      }

      applyTheme();
      render();
      checkAndAddRoutines();
    } catch (err) {
      console.error("خطا در پردازش داده‌های ابری پس‌زمینه:", err);
    }
  }, 10);
}

async function initAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await handleUserSession(session);
    } else {
      window.location.href = "./login.html";
    }
  } catch (err) {
    console.error("خطا در واکشی وضعیت لود کاربر:", err);
    window.location.href = "./login.html";
  }
}

initAuth();

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    window.location.href = "./login.html";
  } else if (event === "SIGNED_IN" && session) {
    handleUserSession(session);
  }
});

// کنترل کلیک دکمه لایو تایمر سیستم
document.getElementById('live-btn').onclick=()=>{
  if(!state.liveSession){
    const title=document.getElementById('act-title').value.trim();
    const catId=document.getElementById('cat-select').value;
    
    if(!catId || !state.cats.some(c=>c.id===catId)){
      alert('اول یک موضوع بسازید یا انتخاب کنید');
      return;
    }

    const finalTitle = title || state.cats.find(c => c.id === catId)?.name || 'فعالیت بی‌نام';

    const now=getNow();
    const sMins=parseTime(now);
    
    state.liveSession={title: finalTitle, catId, date:state.curDate, sMins, pauseMins: 0, pauseStartMins: null};
    save('planner_live', state.liveSession); // ذخیره فوری نشست زنده در لوکال‌استوریج محلی
    saveCloud();
    document.getElementById('start-time').value=now;
    document.getElementById('end-time').value='';
    updateLiveButton();
    return;
  }

  const endNow=getNow();
  const endMins=parseTime(endNow);

  let finalPauseMins = state.liveSession.pauseMins || 0;
  if (state.liveSession.pauseStartMins !== null && state.liveSession.pauseStartMins !== undefined) {
    let diff = endMins - state.liveSession.pauseStartMins;
    if (diff < 0) diff += 24 * 60;
    finalPauseMins += diff;
  }

  const ok=createEvent({
    title: state.liveSession.title,
    catId: state.liveSession.catId,
    stRaw: fmtTime(state.liveSession.sMins),
    enRaw: endNow,
    pauseRaw: String(finalPauseMins),
    date: state.liveSession.date
  });
  if(!ok) return;
  state.liveSession=null;
  save('planner_live', null); // حذف همزمان لایو از لوکال‌استوریج محلی
  saveCloud();
  clearEventForm();
  render();
  updateLiveButton();
};

window.setupViewTabs = function() {
  const btnDaily = document.getElementById('view-daily-btn');
  const btnWeekly = document.getElementById('view-weekly-btn');
  if (!btnDaily || !btnWeekly) return;

  btnDaily.onclick = () => {
    state.activeView = 'daily';
    btnDaily.style.background = 'var(--surface2)';
    btnDaily.style.color = 'var(--text)';
    btnWeekly.style.background = 'var(--surface3)';
    btnWeekly.style.color = 'var(--muted)';
    render();
  };

  btnWeekly.onclick = () => {
    state.activeView = 'weekly';
    btnWeekly.style.background = 'var(--surface2)';
    btnWeekly.style.color = 'var(--text)';
    btnDaily.style.background = 'var(--surface3)';
    btnDaily.style.color = 'var(--muted)';
    render();
  };
};
window.setupViewTabs();
