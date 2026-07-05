// js/features.js
import { state, save, saveCloud } from "./storage.js";
import { render } from "./render.js";
import { escHtml, pad, fmtDateLabel } from "./helpers.js";

export function getPersianWeekdayIndex(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const jsDay = dt.getDay();
  const map = { 6: 0, 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
  return map[jsDay];
}

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

export function toggleRoutine(rtId, dateStr) {
  if (!state.routineLogs[rtId]) state.routineLogs[rtId] = {};
  state.routineLogs[rtId][dateStr] = !state.routineLogs[rtId][dateStr];
  save('planner_routine_logs', state.routineLogs);
  saveCloud();
  render();
}

// ======================= سیستم آموزش تعاملی =======================
let currentStep = 0;
const tutorialSteps = [
  { title: "📅 خوش آمدید به تقویم روزانه!", desc: "اینجا هاب اصلی برنامه‌ریزی شماست.", target: ".logo" },
  { title: "📅 تایم‌لاین هوشمند", desc: "تمام کارهای ثبت شده با تفکیک موضوعی نمایش داده می‌شوند.", target: ".app-nav button[data-tab='tab-timeline']" },
  { title: "✔️ کارها، عادت‌ها و روتین‌های امروز", desc: "روتین‌های روزانه به صورت چک‌لیست نمایش داده می‌شوند.", target: ".app-nav button[data-tab='tab-habits']" },
  { title: "⚙️ مدیریت و پومودورو", desc: "فعالیت زنده و پومودورو را اینجا فعال کنید.", target: ".app-nav button[data-tab='tab-add']" },
  { title: "📊 گزارش‌ها و هیت‌مپ", desc: "وضعیت روتین‌ها را در نقشه ماهانه ببینید.", target: ".app-nav button[data-tab='tab-reports']" }
];

export function showTutorial(force = false) {
  if (state.tutorialCompleted && !force) return;

  const exist = document.getElementById('onboarding-tutorial-overlay');
  if (exist) exist.remove();

  currentStep = 0;

  const overlay = document.createElement('div');
  overlay.id = 'onboarding-tutorial-overlay';
  overlay.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(8px);`;

  const card = document.createElement('div');
  card.style.cssText = `width: 100%; max-width: 440px; background: var(--surface); border: 1px solid var(--border2); border-radius: 20px; padding: 24px; box-shadow: 0 15px 40px rgba(0,0,0,0.6); position: relative; direction: rtl;`;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function updateTutorialCard() {
    const step = tutorialSteps[currentStep];
    if (step.target.startsWith(".app-nav") && window.switchTab) {
      const tabName = step.target.match(/'([^']+)'/)?.[1];
      if (tabName) window.switchTab(tabName);
    }

    card.innerHTML = `
      <button id="close-tutorial-x" style="position:absolute; top:14px; left:14px; background:transparent; border:none; color:var(--muted); font-size:20px; cursor:pointer;">✕</button>
      <div style="font-size: 13px; color: var(--accent); font-weight: 700; margin-bottom: 6px;">گام ${currentStep + 1} از ${tutorialSteps.length}</div>
      <h3 style="margin: 0 0 12px 0; font-size: 17px;">${step.title}</h3>
      <p style="font-size: 13px; color: var(--muted); line-height: 1.7; margin-bottom: 24px;">${step.desc}</p>
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; border-top: 1px solid var(--border); padding-top:16px;">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:11px;">
          <input type="checkbox" id="dont-show-again-chk"> دیگر نشان نده
        </label>
        <div style="display:flex; gap:8px;">
          ${currentStep > 0 ? `<button id="tut-prev-btn">قبلی</button>` : ''}
          <button id="tut-next-btn">${currentStep === tutorialSteps.length - 1 ? 'پایان' : 'بعدی'}</button>
        </div>
      </div>
    `;

    document.getElementById('close-tutorial-x').onclick = () => overlay.remove();

    const chk = document.getElementById('dont-show-again-chk');
    chk.onchange = (e) => { state.tutorialCompleted = e.target.checked; save('planner_tutorial_completed', state.tutorialCompleted); saveCloud(); };

    if (currentStep > 0) document.getElementById('tut-prev-btn').onclick = () => { currentStep--; updateTutorialCard(); };
    document.getElementById('tut-next-btn').onclick = () => {
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
