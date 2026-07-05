// js/features.js
import { state, save, saveCloud } from "./storage.js";
import { render } from "./render.js";
import { escHtml, pad, fmtDateLabel } from "./helpers.js";

// محاسبه ایندکس روز هفته شمسی (شنبه: ۰ تا جمعه: ۶)
export function getPersianWeekdayIndex(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const jsDay = dt.getDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday
  const map = { 6: 0, 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
  return map[jsDay];
}

// رندر کردن چک‌لیست روتین‌های فعال امروز در تب کار و عادت
export function renderTodayRoutines() {
  const list = document.getElementById('today-routines-list');
  if (!list) return;

  const todayIdx = getPersianWeekdayIndex(state.curDate);
  const todayRoutines = state.routines.filter(r => r.days.includes(todayIdx));

  if (todayRoutines.length === 0) {
    list.innerHTML = `<div style="color:var(--muted); font-size:12px; text-align:center; padding:10px 0;">امروز روتین ثابتی برنامه‌ریزی نشده است.</div>`;
    return;
  }

  list.innerHTML = '';
  todayRoutines.forEach(rt => {
    const cat = state.cats.find(c => c.id === rt.catId) || { name: 'بدون دسته‌بندی', color: '#999' };
    const isCompleted = state.routineLogs[rt.id] && state.routineLogs[rt.id][state.curDate];

    const itemDiv = document.createElement('div');
    itemDiv.className = 'todo-item';
    itemDiv.style.borderRight = `3px solid ${cat.color}`;
    itemDiv.style.paddingRight = `8px`;

    itemDiv.innerHTML = `
      <div style="display:flex; align-items:center; flex:1; gap:8px;">
        <input type="checkbox" class="todo-checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleRoutine('${rt.id}', '${state.curDate}')">
        <span class="todo-title ${isCompleted ? 'done' : ''}" style="font-weight: 500;">
          ${escHtml(rt.title)} 
          <span style="font-size:10px; color:var(--muted); margin-right:6px;">(${rt.startTime} تا ${rt.endTime})</span>
        </span>
      </div>
      <span style="font-size:10px; background:${cat.color}15; color:${cat.color}; padding:2px 6px; border-radius:4px; font-weight:bold;">
        ${escHtml(cat.name)}
      </span>
    `;
    list.appendChild(itemDiv);
  });
}

// تغییر وضعیت ثبت تیک روتین و ثبت در لاگ پیشرفت هیت‌مپ
window.toggleRoutine = function(rtId, dateStr) {
  if (!state.routineLogs[rtId]) state.routineLogs[rtId] = {};
  state.routineLogs[rtId][dateStr] = !state.routineLogs[rtId][dateStr];
  save('planner_routine_logs', state.routineLogs);
  saveCloud();
  render();
};

// سیستم آموزش تعاملی گام به گام (Interactive Onboarding Tutorial)
let currentStep = 0;
const tutorialSteps = [
  {
    title: "📅 خوش آمدید به تقویم روزانه!",
    desc: "اینجا هاب اصلی برنامه‌ریزی شماست. بیایید در ۵ گام ساده، کارکرد هوشمندانه این برنامه را یاد بگیریم تا به کارهایتان نظم حداکثری بدهید.",
    target: ".logo"
  },
  {
    title: "📅 تایم‌لاین هوشمند و منعطف",
    desc: "تمام کارهای ثبت شده شما به صورت مرتب و با تفکیک موضوعی در اینجا نمایش داده می‌شوند. شما می‌توانید با استفاده از گزینه یکپارچه‌سازی بالای آن، کارهای هم‌عنوان را به صورت هوشمند ادغام و گروه‌بندی کنید.",
    target: "#tab-timeline"
  },
  {
    title: "✔️ کارها، عادت‌ها و روتین‌های امروز",
    desc: "در این تب علاوه بر کارهای روزانه (To-Do) و عادت‌ها (Habit Tracker)، روتین‌های روزانه ثابت شما نیز به صورت خودکار به شکل چک‌لیست لیست می‌شوند. با زدن تیک هر روتین، پیشرفت آن در نقشه حرارتی ماهانه موضوعات ثبت می‌شود.",
    target: ".app-nav button[data-tab='tab-habits']"
  },
  {
    title: "⚙️ مدیریت، شروع زنده و پومودورو",
    desc: "در این بخش می‌توانید فعالیت‌های جدید با وقفه دستی ثبت کنید، دکمه «شروع زنده» را بزنید تا زمان خالص به صورت لحظه‌ای و به ثانیه محاسبه شود و حتی پومودورو کارآمد خود را برای تمرکز عمیق به همراه هشدار صوتی و نوتیفیکیشن فعال کنید.",
    target: ".app-nav button[data-tab='tab-add']"
  },
  {
    title: "📊 گزارش‌ها و نقشه‌های حرارتی (هیت‌مپ)",
    desc: "نمودار فعالیت‌های موضوعی را با فیلتر روز دلخواه ببینید. در بخش پایانی، نقشه حرارتی ماهانه قرار دارد که با انتخاب هر روتین یا موضوع، وضعیت و ثبات ثبت تیک‌های روزانه شما را در جدول به زیباترین شکل شبیه‌سازی می‌کند.",
    target: ".app-nav button[data-tab='tab-reports']"
  }
];

export function showTutorial(force = false) {
  if (state.tutorialCompleted && !force) return;

  // حذف نسخه قبلی مدال در صورت وجود
  const exist = document.getElementById('onboarding-tutorial-overlay');
  if (exist) exist.remove();

  currentStep = 0;

  const overlay = document.createElement('div');
  overlay.id = 'onboarding-tutorial-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999;
    display: flex; align-items: center; justify-content: center; padding: 16px;
    backdrop-filter: blur(8px); animation: fadeIn 0.25s ease;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    width: 100%; max-width: 440px; background: var(--surface);
    border: 1px solid var(--border2); border-radius: 20px;
    padding: 24px; box-shadow: 0 15px 40px rgba(0,0,0,0.6);
    position: relative; direction: rtl; font-family: 'Vazirmatn', sans-serif;
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function updateTutorialCard() {
    const step = tutorialSteps[currentStep];
    
    // شبیه‌سازی حرکت تب منو برای راهنمایی بصری کاربر
    if (step.target.startsWith(".app-nav")) {
      const tabName = step.target.match(/'([^']+)'/)?.[1];
      if (tabName && window.switchTab) window.switchTab(tabName);
    }

    card.innerHTML = `
      <button id="close-tutorial-x" style="position:absolute; top:14px; left:14px; background:transparent; border:none; color:var(--muted); font-size:20px; cursor:pointer;" title="بستن موقت">✕</button>
      <div style="font-size: 13px; color: var(--accent); font-weight: 700; margin-bottom: 6px;">راهنمای استفاده تعاملی &mdash; گام ${currentStep + 1} از ${tutorialSteps.length}</div>
      <h3 style="margin: 0 0 12px 0; font-size: 17px; color: var(--text);">${step.title}</h3>
      <p style="font-size: 13px; color: var(--muted); line-height: 1.7; margin-bottom: 24px; text-align: justify;">${step.desc}</p>
      
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-top: 1px solid var(--border); padding-top:16px;">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:11px; color:var(--muted); margin:0; user-select:none;">
          <input type="checkbox" id="dont-show-again-chk" style="accent-color:var(--accent); width:14px; height:14px;"> دیگر این راهنما را نشان نده
        </label>
        <div style="display:flex; gap:8px;">
          ${currentStep > 0 ? '<button id="tut-prev-btn" style="padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border2); background: var(--surface2); color: var(--text); font-size: 12px; cursor: pointer;">قبلی</button>' : ''}
          <button id="tut-next-btn" style="padding: 6px 16px; border-radius: 8px; border: none; background: var(--accent); color: white; font-size: 12px; font-weight:700; cursor: pointer;">
            ${currentStep === tutorialSteps.length - 1 ? 'پایان آموزش' : 'بعدی'}
          </button>
        </div>
      </div>
    `;

    document.getElementById('close-tutorial-x').onclick = () => overlay.remove();

    const chk = document.getElementById('dont-show-again-chk');
    chk.checked = state.tutorialCompleted;
    chk.onchange = (e) => {
      state.tutorialCompleted = e.target.checked;
      save('planner_tutorial_completed', state.tutorialCompleted);
      saveCloud();
    };

    if (currentStep > 0) {
      document.getElementById('tut-prev-btn').onclick = () => {
        currentStep--;
        updateTutorialCard();
      };
    }

    document.getElementById('tut-next-btn').onclick = () => {
      if (chk.checked) {
        state.tutorialCompleted = true;
        save('planner_tutorial_completed', true);
        saveCloud();
      }
      if (currentStep < tutorialSteps.length - 1) {
        currentStep++;
        updateTutorialCard();
      } else {
        overlay.remove();
      }
    };
  }

  updateTutorialCard();
}
