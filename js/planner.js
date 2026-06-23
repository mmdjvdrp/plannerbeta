// js/planner.js
import { supabase } from "./supabase.js";
import { state, save, saveCloud, loadCloud } from "./storage.js";
import { getNow, parseTime, pad, getLocalDateStr, fmtDateLabel, fmtTime } from "./helpers.js";
import { render, applyTheme, updateLiveButton } from "./render.js";

function safeBindEvent(id, event, callback) {
  const el = document.getElementById(id);
  if (el) {
    el[event] = callback;
  }
}

// انیمیشن کوچک حرکت منو در شروع برنامه برای آگاهی کاربر از قابلیت اسکرول افقی
function triggerNavPeekAnimation() {
  const nav = document.querySelector(".app-nav");
  if (nav) {
    setTimeout(() => {
      // شبیه‌سازی کشش انگشت به چپ و برگشت به راست
      nav.scrollTo({ left: 60, behavior: "smooth" });
      setTimeout(() => {
        nav.scrollTo({ left: 0, behavior: "smooth" });
      }, 450);
    }, 1200);
  }
}

// پیاده‌سازی متغیرهای صفحه گالری سوپابیس
state.galleryPage = 0;
state.galleryPageSize = 30;
state.currentSelectingPresetIdx = null;

// باز کردن گالری اموجی‌های متحرک
window.openEmojiGallery = function(idx) {
  state.currentSelectingPresetIdx = idx;
  state.galleryPage = 0;
  const modal = document.getElementById("emoji-gallery-modal");
  if (modal) {
    modal.style.display = "flex";
    renderGalleryGrid();
  }
};

// رندر کردن گالری ۲۰۰ تایی اموجی‌ها با قابلیت صفحه‌بندی هوشمند
window.renderGalleryGrid = function() {
  const grid = document.getElementById("gallery-grid");
  const label = document.getElementById("gallery-range-label");
  if (!grid || !label) return;

  grid.innerHTML = '';
  const start = state.galleryPage * state.galleryPageSize + 1;
  const end = Math.min(start + state.galleryPageSize - 1, 200);

  label.textContent = `نمایش شکلک‌های ${start} تا ${end} (از مجموع ۲۰۰)`;

  for (let i = start; i <= end; i++) {
    const numStr = String(i).padStart(3, '0');
    // آدرس عمومی باکت عمومی سوپابیس شما بر اساس ساختار نام‌گذاری سه رقمی
    const fileUrl = `https://ipureiqnhgatigewbggj.supabase.co/storage/v1/object/public/emojis/${numStr}.webm`;

    const item = document.createElement('div');
    item.style.cssText = `
      aspect-ratio: 1;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
      transition: all 0.2s;
    `;

    // افکت‌های هاور بصری روی هر شکلک
    item.onmouseenter = () => { item.style.borderColor = 'var(--accent)'; item.style.transform = 'scale(1.05)'; };
    item.onmouseleave = () => { item.style.borderColor = 'var(--border)'; item.style.transform = 'none'; };

    item.innerHTML = `
      <video src="${fileUrl}" autoplay loop muted playsinline style="width:85%; height:85%; object-fit:cover; pointer-events:none; border-radius:50%;"></video>
      <span style="position:absolute; bottom:2px; font-size:8px; color:var(--muted); font-family:monospace; background:rgba(0,0,0,0.35); padding:0 3px; border-radius:3px;">${numStr}</span>
    `;

    // کلیک روی هر المان و انتساب آن به عنوان پریست شکلک
    item.onclick = () => {
      const idx = state.currentSelectingPresetIdx;
      if (idx !== null && idx !== undefined) {
        state.moodPresets[idx].type = 'webm';
        state.moodPresets[idx].value = fileUrl;
        save("planner_mood_presets", state.moodPresets);
        saveCloud();
        render();
      }
      document.getElementById("emoji-gallery-modal").style.display = "none";
    };

    grid.appendChild(item);
  }
};

// رویدادهای مدال گالری سوپابیس
safeBindEvent("close-gallery-modal", "onclick", () => {
  document.getElementById("emoji-gallery-modal").style.display = "none";
});

safeBindEvent("gallery-prev", "onclick", () => {
  if (state.galleryPage > 0) {
    state.galleryPage--;
    renderGalleryGrid();
  }
});

safeBindEvent("gallery-next", "onclick", () => {
  const maxPages = Math.ceil(200 / state.galleryPageSize);
  if (state.galleryPage + 1 < maxPages) {
    state.galleryPage++;
    renderGalleryGrid();
  }
});

// مدیریت تغییر تب‌ها
window.switchTab = function(tabId) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-section").forEach(s => s.classList.remove("active"));
  document.querySelector(`.nav-btn[data-tab="${tabId}"]`)?.classList.add("active");
  const targetSec = document.getElementById(tabId);
  if (targetSec) {
    targetSec.classList.add("active");
  }
};

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    switchTab(btn.getAttribute("data-tab"));
  });
});

// مدیریت تاریخ روزانه
safeBindEvent("prev-day", "onclick", () => { shiftDay(-1); });
safeBindEvent("next-day", "onclick", () => { shiftDay(1); });
safeBindEvent("btn-today", "onclick", () => { state.curDate = getLocalDateStr(); render(); });

function shiftDay(n){
  const [y,mo,d] = state.curDate.split("-").map(Number);
  const dt = new Date(y, mo - 1, d + n);
  state.curDate = dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
  render();
}

safeBindEvent("map-prev", "onclick", () => {
  const [y,mo] = state.mapMonth.split("-").map(Number);
  const dt = new Date(y, mo - 2, 1); 
  state.mapMonth = dt.getFullYear() + "-" + pad(dt.getMonth() + 1); 
  render();
});

safeBindEvent("map-next", "onclick", () => {
  const [y,mo] = state.mapMonth.split("-").map(Number);
  const dt = new Date(y, mo, 1); 
  state.mapMonth = dt.getFullYear() + "-" + pad(dt.getMonth() + 1); 
  render();
});

safeBindEvent("map-cat-select", "onchange", () => { render(); });

// رویداد سوییچ روشن/خاموش یکپارچه‌سازی و گروه‌بندی کارهای هم‌موضوع در تایم‌لاین
safeBindEvent("timeline-group-toggle", "onchange", (e) => {
  state.groupTimelinePref = e.target.checked;
  save("planner_group_timeline_pref", state.groupTimelinePref);
  saveCloud();
  render();
});

// چک‌باکس انتخاب همه موضوعات در بخش گزارش‌ها
safeBindEvent("report-select-all", "onchange", (e) => {
  if (e.target.checked) {
    state.selectedReportCats = state.cats.map(c => c.id);
  } else {
    state.selectedReportCats = [];
  }
  save("planner_selected_report_cats", state.selectedReportCats);
  saveCloud();
  render();
});

// رویدادهای تغییر تم و تغییر رنگ دلخواه از تب تنظیمات
safeBindEvent("setting-theme-select", "onchange", (e) => {
  state.theme = e.target.value; 
  save("planner_theme", state.theme); 
  saveCloud(); 
  applyTheme();
});

safeBindEvent("setting-accent-picker", "onchange", (e) => {
  state.accentColor = e.target.value; 
  save("planner_accent", state.accentColor); 
  saveCloud(); 
  applyTheme();
});

// رویدادهای جدید تنظیمات تقویم و قالب‌ها
safeBindEvent("setting-calendar", "onchange", (e) => {
  state.calendarPref = e.target.value; 
  save("planner_calendar_pref", state.calendarPref); 
  saveCloud(); 
  render();
});

safeBindEvent("setting-duration-format", "onchange", (e) => {
  state.timeFormatPref = e.target.value; 
  save("planner_time_format_pref", state.timeFormatPref); 
  saveCloud(); 
  render();
});

safeBindEvent("setting-week-start", "onchange", (e) => {
  state.weekStartPref = e.target.value; 
  save("planner_week_start_pref", state.weekStartPref); 
  saveCloud(); 
  render();
});

// ذخیره زمان شخصی‌سازی شده پومودورو از بخش تنظیمات
safeBindEvent("setting-pomodoro-work", "onchange", (e) => {
  state.pomodoroWorkPref = parseInt(e.target.value) || 25;
  save("planner_pomo_work_pref", state.pomodoroWorkPref); saveCloud(); render();
});

safeBindEvent("setting-pomodoro-break", "onchange", (e) => {
  state.pomodoroBreakPref = parseInt(e.target.value) || 5;
  save("planner_pomo_break_pref", state.pomodoroBreakPref); saveCloud(); render();
});

// تغییر نوع چارت از منوی گزارش‌ها
safeBindEvent("report-chart-type", "onchange", (e) => {
  state.chartTypePref = e.target.value; 
  save("planner_chart_type_pref", state.chartTypePref); 
  saveCloud(); 
  render();
});

// باز و بسته کردن باکس افزودن دسته‌بندی
safeBindEvent("toggle-cat", "onclick", () => {
  const box = document.getElementById("new-cat-box");
  if (box) {
    box.style.display = box.style.display === "block" ? "none" : "block";
  }
});

// ذخیره دسته‌بندی جدید مجهز به فیلد اموجی
safeBindEvent("save-cat", "onclick", () => {
  const name = document.getElementById("new-cat-name").value.trim();
  const color = document.getElementById("new-cat-color").value;
  const emoji = document.getElementById("new-cat-emoji").value.trim() || "📅";
  if(!name){ 
    alert("نام دسته‌بندی را وارد کنید"); 
    return; 
  }
  
  const nc = { id: "c" + Date.now(), name, color, emoji };
  state.cats.push(nc);
  save("planner_cats", state.cats); 
  saveCloud();
  
  document.getElementById("new-cat-name").value = "";
  document.getElementById("new-cat-emoji").value = "";
  document.getElementById("new-cat-box").style.display = "none";
  render();
  document.getElementById("cat-select").value = nc.id;
  document.getElementById("map-cat-select").value = nc.id;
});

// حذف کاملاً سراسری دسته‌بندی به همراه تمام داده‌های مربوط به آن جهت جلوگیری از اثرگذاری در گزارش‌ها
window.delCat = function(id) {
  if(!confirm("آیا مطمئن هستید؟ با تایید شما، تمام فعالیت‌ها، روتین‌ها و اهدافی که تاکنون تحت این موضوع ثبت شده‌اند به طور کامل و بدون بازگشت پاک خواهند شد.")) return;
  
  // ۱. حذف از لیست دسته‌بندی‌ها
  state.cats = state.cats.filter(c => c.id !== id);
  // ۲. فیلتر و حذف کامل رویدادها، روتین‌ها و اهداف مرتبط با این موضوع
  state.events = state.events.filter(e => e.catId !== id);
  state.routines = state.routines.filter(r => r.catId !== id);
  state.goals = state.goals.filter(g => g.catId !== id);
  
  // ۳. فیلتر کردن از لیست فیلترهای فعال گزارش
  if (state.selectedReportCats) {
    state.selectedReportCats = state.selectedReportCats.filter(cId => cId !== id);
    save("planner_selected_report_cats", state.selectedReportCats);
  }

  // ۴. ذخیره همگانی اطلاعات
  save("planner_cats", state.cats); 
  save("planner_ev", state.events);
  save("planner_routines", state.routines);
  save("planner_goals", state.goals);
  
  saveCloud(); 
  render();
};

// تابع ادیت و پرش به مدیریت به همراه زمان فعالیت
window.editEv = function(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;
  
  state.editingEventId = id;
  
  // پر کردن فرم ثبت و مدیریت با متغیرهای فعالیت انتخاب شده
  document.getElementById("act-title").value = ev.title || "";
  document.getElementById("cat-select").value = ev.catId || "";
  document.getElementById("act-tags").value = (ev.tags || []).join(" ");
  document.getElementById("start-time").value = fmtTime(ev.sMins);
  document.getElementById("end-time").value = fmtTime(ev.eMins);
  
  switchTab("tab-add");
  render();
};

// لغو حالت ویرایش فعالیت
safeBindEvent("cancel-edit-btn", "onclick", () => {
  state.editingEventId = null;
  document.getElementById("act-title").value = "";
  document.getElementById("act-tags").value = "";
  document.getElementById("start-time").value = "";
  document.getElementById("end-time").value = "";
  render();
});

// ثبت یا ذخیره تغییرات ویرایش شده فعالیت دستی
safeBindEvent("add-btn", "onclick", () => {
  const title = document.getElementById("act-title").value.trim();
  const catId = document.getElementById("cat-select").value;
  const tagsRaw = document.getElementById("act-tags").value.trim();
  const stRaw = document.getElementById("start-time").value;
  const enRaw = document.getElementById("end-time").value;
  
  if(!catId){ 
    alert("موضوع انتخاب نشده است"); 
    return; 
  }
  const sMins = parseTime(stRaw); 
  const eMins = parseTime(enRaw);
  if(sMins === null || eMins === null) return alert("فرمت زمان وارد شده صحیح نیست");

  let durMins = eMins - sMins; if(durMins < 0) durMins += 24 * 60;
  const tags = tagsRaw ? tagsRaw.split(" ").filter(t => t.startsWith("#")) : [];

  if (state.editingEventId) {
    // بروزرسانی روی آبجکت قبلی
    const idx = state.events.findIndex(e => e.id === state.editingEventId);
    if (idx !== -1) {
      state.events[idx].title = title;
      state.events[idx].catId = catId;
      state.events[idx].sMins = sMins;
      state.events[idx].eMins = eMins;
      state.events[idx].durMins = durMins;
      state.events[idx].tags = tags;
    }
    state.editingEventId = null;
    alert("تغییرات فعالیت با موفقیت بروزرسانی شد.");
  } else {
    // افزودن فعالیت کاملاً جدید
    state.events.push({ id: Date.now().toString(), date: state.curDate, title, catId, sMins, eMins, durMins, tags });
  }

  save("planner_ev", state.events); 
  saveCloud(); 
  render(); 
  switchTab("tab-timeline");
});

// زنده
safeBindEvent("live-btn", "onclick", () => {
  if(!state.liveSession){
    state.liveSession = {
      title: document.getElementById("act-title").value.trim(),
      catId: document.getElementById("cat-select").value,
      date: state.curDate, sMins: parseTime(getNow()), 
      pauseMins: 0,
      pauseStartMins: null,
      isPomodoro: document.getElementById("pomodoro-toggle").checked
    };
    save("planner_live", state.liveSession); saveCloud(); updateLiveButton();
  } else {
    const endNow = parseTime(getNow());
    
    let finalPauseMins = state.liveSession.pauseMins || 0;
    if (state.liveSession.pauseStartMins !== null && state.liveSession.pauseStartMins !== undefined) {
      let diff = endNow - state.liveSession.pauseStartMins;
      if (diff < 0) diff += 24 * 60;
      finalPauseMins += diff;
    }

    let totalElapsed = endNow - state.liveSession.sMins; if(totalElapsed < 0) totalElapsed += 24 * 60;
    let durMins = totalElapsed - finalPauseMins;
    if(durMins <= 0) durMins = 1;

    state.events.push({
      id: Date.now().toString(), date: state.liveSession.date, title: state.liveSession.title,
      catId: state.liveSession.catId, sMins: state.liveSession.sMins, eMins: endNow, durMins, pauseMins: finalPauseMins, tags: []
    });
    state.liveSession = null; save("planner_live", null); save("planner_ev", state.events); saveCloud(); render(); updateLiveButton();
  }
});

window.cancelLiveSession = function() {
  if(!confirm("آیا از لغو و حذف زمان این فعالیت زنده اطمینان دارید؟ (هیچ فعالیتی ثبت نخواهد شد)")) return;
  state.liveSession = null;
  save("planner_live", null);
  saveCloud();
  updateLiveButton();
};

window.delEv = function(id) {
  if(!confirm("حذف شود؟")) return;
  state.events = state.events.filter(e => e.id !== id);
  save("planner_ev", state.events); saveCloud(); render();
};

// تودو و عادت
safeBindEvent("add-todo-btn", "onclick", () => {
  const title = document.getElementById("todo-input").value.trim(); if(!title) return;
  state.todos.push({ id: "t" + Date.now(), title, date: state.curDate, done: false });
  save("planner_todos", state.todos); saveCloud(); render(); document.getElementById("todo-input").value = "";
});

window.toggleTodo = (id) => {
  const t = state.todos.find(x => x.id === id); if(t) { t.done = !t.done; save("planner_todos", state.todos); saveCloud(); render(); }
};

window.deleteTodo = (id) => { 
  state.todos = state.todos.filter(x => x.id !== id); 
  save("planner_todos", state.todos); 
  saveCloud(); 
  render(); 
};

safeBindEvent("add-habit-btn", "onclick", () => {
  const title = document.getElementById("habit-input").value.trim(); if(!title) return;
  state.habits.push({ id: "h" + Date.now(), title }); 
  save("planner_habits", state.habits); saveCloud(); render(); 
  document.getElementById("habit-input").value = "";
});

window.toggleHabit = (hId, dateStr) => {
  if(!state.habitLogs[hId]) state.habitLogs[hId] = {};
  state.habitLogs[hId][dateStr] = !state.habitLogs[hId][dateStr];
  save("planner_habitLogs", state.habitLogs); saveCloud(); render();
};

window.deleteHabit = (id) => { 
  state.habits = state.habits.filter(x => x.id !== id); 
  delete state.habitLogs[id]; 
  save("planner_habits", state.habits); 
  save("planner_habitLogs", state.habitLogs); 
  saveCloud(); 
  render(); 
};

// ژورنال و خاطره‌نویسی روزانه
safeBindEvent("save-journal-btn", "onclick", () => {
  const note = document.getElementById("journal-textarea").value.trim();
  let selectedMood = state.moods[state.curDate]?.mood || null;
  state.moods[state.curDate] = { mood: selectedMood, note: note }; 
  save("planner_moods", state.moods); 
  saveCloud(); 
  alert("خاطره‌نویسی و یادداشت امروز با موفقیت ثبت شد!");
});

// تغییر نام نمایشی کاربری در تب تنظیمات
safeBindEvent("save-display-name-btn", "onclick", async () => {
  const newName = document.getElementById("setting-display-name").value.trim();
  if(!newName) return alert("لطفاً نام نمایشی معتبری وارد کنید.");
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    const { error: authErr } = await supabase.auth.updateUser({
      data: { display_name: newName }
    });
    if (authErr) throw authErr;

    await supabase.from("profiles").upsert({ id: user.id, name: newName });
    
    const msg = document.getElementById("welcome-msg");
    if (msg) msg.textContent = "خوش آمدی، " + newName + " 👋";
    
    document.getElementById("setting-display-name").value = "";
    alert("نام نمایشی شما با موفقیت تغییر یافت!");
  } catch (err) {
    console.error(err);
    alert("خطایی در حین ثبت تغییر نام رخ داد.");
  }
});

// افزودن حالت خلق و خوی جدید
safeBindEvent("add-mood-preset-btn", "onclick", () => {
  state.moodPresets.push({
    level: Date.now().toString(),
    type: 'text',
    value: '😊',
    label: 'حالت جدید'
  });
  save("planner_mood_presets", state.moodPresets);
  saveCloud();
  render();
});

// حذف حالت خلق و خو
window.deleteMoodPreset = function(idx) {
  if (state.moodPresets.length <= 1) {
    alert("باید حداقل یک حالت روحی در لیست وجود داشته باشد!");
    return;
  }
  if (!confirm("آیا از حذف این حالت روحی اطمینان دارید؟")) return;
  state.moodPresets.splice(idx, 1);
  save("planner_mood_presets", state.moodPresets);
  saveCloud();
  render();
};

// ذخیره چیدمان اختصاصی اموجی‌ها یا فایل‌های WebM انیمیشنی
safeBindEvent("save-custom-emojis-btn", "onclick", () => {
  const labels = document.querySelectorAll(".emoji-label-input");
  const types = document.querySelectorAll(".emoji-type-select");
  const values = document.querySelectorAll(".emoji-value-input");
  
  if (labels.length === state.moodPresets.length) {
    labels.forEach((inp, idx) => {
      state.moodPresets[idx].label = inp.value.trim();
      const type = types[idx].value;
      state.moodPresets[idx].type = type;
      
      let val = values[idx].value.trim();
      // تبدیل فرمت آیدی عددی ساده (مثلا 137) به لینک کامل
      if (type === 'webm') {
        if (/^\d+$/.test(val)) {
          const numStr = String(val).padStart(3, '0');
          val = `https://ipureiqnhgatigewbggj.supabase.co/storage/v1/object/public/emojis/${numStr}.webm`;
        }
      }
      state.moodPresets[idx].value = val;
    });
    
    save("planner_mood_presets", state.moodPresets);
    saveCloud();
    render();
    alert("شخصی‌سازی شکلک‌های زنده با موفقیت ذخیره شد!");
  }
});

// خروجی بک‌آپ
safeBindEvent("export-btn", "onclick", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
  a.download = `Planner_Backup_${state.curDate}.json`; 
  a.click();
});

safeBindEvent("report-confirm-btn", "onclick", () => render());

// ================= مدیریت و اهداف =================

// دکمه‌های بازکننده پنل روتین و اهداف
safeBindEvent("toggle-rt-form-btn", "onclick", () => {
  const p = document.getElementById("rt-card-panel");
  if(p) { p.style.display = p.style.display === 'block' ? 'none' : 'block'; p.scrollIntoView({ behavior: 'smooth' }); }
});
safeBindEvent("close-rt-panel", "onclick", () => {
  const p = document.getElementById("rt-card-panel"); if(p) p.style.display = 'none';
});

safeBindEvent("toggle-goal-form-btn", "onclick", () => {
  const p = document.getElementById("goal-card-panel");
  if(p) { p.style.display = p.style.display === 'block' ? 'none' : 'block'; p.scrollIntoView({ behavior: 'smooth' }); }
});
safeBindEvent("close-goal-panel", "onclick", () => {
  const p = document.getElementById("goal-card-panel"); if(p) p.style.display = 'none';
});

// انتخاب روزها در روتین
const dayBtns = document.querySelectorAll('.rt-day-btn');
dayBtns.forEach(btn => {
  btn.onclick = function() {
    const day = parseInt(this.getAttribute('data-day'), 10);
    if (state.selectedRtDays.includes(day)) {
      state.selectedRtDays = state.selectedRtDays.filter(d => d !== day);
      this.style.background = 'var(--surface2)'; this.style.color = 'var(--text)';
    } else {
      state.selectedRtDays.push(day);
      this.style.background = 'var(--accent)'; this.style.color = '#fff';
    }
  };
});

// افزودن روتین ثابت جدید
safeBindEvent("add-rt-btn", "onclick", () => {
  const title = document.getElementById('rt-title').value.trim();
  const start = document.getElementById('rt-start').value.trim();
  const end = document.getElementById('rt-end').value.trim();
  const catId = document.getElementById('cat-select').value;

  if (!title || !start || !end || !catId) return alert('لطفاً تمامی فیلدهای روتین را تکمیل کنید');
  if (state.selectedRtDays.length === 0) return alert('حداقل یک روز را انتخاب کنید');
  if (parseTime(start) === null || parseTime(end) === null) return alert('فرمت زمان روتین نامعتبر است');

  state.routines.push({
    id: Date.now().toString(), title, catId, days: [...state.selectedRtDays], startTime: start, endTime: end
  });
  save('planner_routines', state.routines); saveCloud();

  // ریست فرم
  document.getElementById('rt-title').value = '';
  document.getElementById('rt-start').value = '';
  document.getElementById('rt-end').value = '';
  state.selectedRtDays = [];
  dayBtns.forEach(b => { b.style.background = 'var(--surface2)'; b.style.color = 'var(--text)'; });
  const p = document.getElementById("rt-card-panel"); if(p) p.style.display = 'none';
  render();
});

window.delRoutine = function(id) {
  if(!confirm('روتین حذف شود؟')) return;
  state.routines = state.routines.filter(r => r.id !== id);
  save('planner_routines', state.routines); saveCloud(); render();
};

// ثبت هدف جدید ماهانه
safeBindEvent("add-goal-btn", "onclick", () => {
  const title = document.getElementById('goal-title').value.trim();
  const catId = document.getElementById('goal-cat-select').value;
  const targetRaw = document.getElementById('goal-target').value.trim();

  if (!catId) return alert('موضوع را انتخاب کنید');
  const targetMins = parseInt(targetRaw, 10);
  if (isNaN(targetMins) || targetMins <= 0) return alert('مدت زمان هدف نامعتبر است');

  state.goals.push({
    id: Date.now().toString(), title, catId, targetMins, month: state.mapMonth
  });
  save('planner_goals', state.goals); saveCloud();
  document.getElementById('goal-title').value = '';
  document.getElementById('goal-target').value = '';
  const p = document.getElementById("goal-card-panel"); if(p) p.style.display = 'none';
  render();
  alert('هدف با موفقیت ثبت شد!');
});

window.deleteGoal = function(id) {
  if(!confirm('آیا مایل به حذف این هدف هستید؟')) return;
  state.goals = state.goals.filter(g => g.id !== id);
  save('planner_goals', state.goals);
  saveCloud();
  render();
};

// مدیریت، درخواست مجوز و فعال‌سازی سیستم اعلان‌های سیستمی
const notifyBtn = document.getElementById("notify-enable-btn");
if (notifyBtn) {
  // اگر دسترسی از قبل داده شده است، حالت دکمه به صورت بصری فعال نشان داده شود
  if ('Notification' in window && Notification.permission === 'granted') {
    notifyBtn.textContent = "🔔 فعال شد";
    notifyBtn.style.background = "var(--accent-glow)";
    notifyBtn.style.color = "var(--accent)";
  }

  notifyBtn.onclick = async () => {
    if (!('Notification' in window)) {
      alert("مرورگر شما از سیستم ارسال اعلان‌های سیستمی پشتیبانی نمی‌کند.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      notifyBtn.textContent = "🔔 فعال شد";
      notifyBtn.style.background = "var(--accent-glow)";
      notifyBtn.style.color = "var(--accent)";

      new Notification("تقویم روزانه 📅", {
        body: "اعلان‌های سیستمی با موفقیت فعال شدند! از این پس اتمام پومودورو به شما اعلام می‌شود.",
        icon: "./icons/icon-192.png"
      });
    } else if (permission === 'denied') {
      alert("درخواست دسترسی به اعلان‌ها توسط شما مسدود شده است. برای فعال‌سازی مجدد، باید از تنظیمات آدرس‌بار مرورگر خود دسترسی اعلان (Notification) را فعال کنید.");
    }
  };
}

// احراز هویت و بارگذاری اطلاعات کاربری
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
  
  try {
    // دریافت نام کاربر از جدول دیتابیس به عنوان اولویت اول جهت جلوگیری از نمایش آیدی خام یا سیستم در زمان شروع برنامه
    const { data: profData } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();
    if (profData && profData.name) {
      displayName = profData.name;
    }
  } catch (e) {
    console.error("Error fetching profile name:", e);
  }

  if (!displayName && user.email) displayName = user.email.split("@")[0];
  const msg = document.getElementById("welcome-msg");
  if (msg) msg.textContent = displayName ? "خوش آمدی، " + displayName + " 👋" : "خوش آمدی 👋";

  // پیش‌فرش کردن مقدار اینپوت تغییر نام نمایشی در تب تنظیمات
  const settingDisplayName = document.getElementById("setting-display-name");
  if (settingDisplayName) {
    settingDisplayName.value = displayName;
  }

  const dateLabel = document.getElementById("date-label");
  if (dateLabel) dateLabel.textContent = fmtDateLabel(state.curDate);

  try {
    await loadCloud();
    applyTheme();
    render();
    triggerNavPeekAnimation(); // اجرای انیمیشن حرکت افقی منو در اولین لود صفحه
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
