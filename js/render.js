// js/render.js
import { state, save, saveCloud } from "./storage.js";
import { fmtDateLabel, fmtTime, fmtDur, escHtml, pad, getNow, parseTime } from "./helpers.js";

let liveStopwatchInterval = null;
let reportChartInstance = null;

export function applyTheme(){
  let activeTheme = state.theme;
  if (activeTheme === 'auto') activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.body.dataset.theme = activeTheme;
  document.documentElement.style.setProperty('--accent', state.accentColor);
  document.documentElement.style.setProperty('--accent-glow', `color-mix(in srgb, ${state.accentColor} 25%, transparent)`);
  
  if(document.getElementById('setting-theme-select')) document.getElementById('setting-theme-select').value = state.theme;
  if(document.getElementById('setting-accent-picker')) document.getElementById('setting-accent-picker').value = state.accentColor;
}

export function renderCats(){
  const sel=document.getElementById('cat-select');
  const mapSel=document.getElementById('map-cat-select');
  const manager=document.getElementById('cat-manager');
  if(!sel || !mapSel || !manager) return;

  const currentVal = sel.value;
  sel.innerHTML=''; mapSel.innerHTML=''; manager.innerHTML='';
  if(!state.cats.length){
    sel.innerHTML='<option disabled selected>اول موضوع بسازید</option>';
    manager.innerHTML='<div style="color:var(--muted); font-size:12px;">هنوز موضوعی ندارید.</div>';
    return;
  }
  
  state.cats.forEach(c=>{
    const o=document.createElement('option'); o.value=c.id; o.textContent=c.name;
    sel.appendChild(o); mapSel.appendChild(o.cloneNode(true));

    const item=document.createElement('div');
    item.className='cat-item'; 
    item.style.setProperty('--cat-color', c.color);
    
    if (c.id === currentVal) {
      item.classList.add('selected');
    }

    item.innerHTML=`
      <span class="cat-swatch"></span><span class="cat-name">${escHtml(c.name)}</span>
      <input class="cat-color-edit" type="color" value="${c.color}">
      <button class="cat-delete" type="button">✕</button>
    `;
    
    item.querySelector('.cat-color-edit').onchange=(e)=>{
      c.color=e.target.value; save('planner_cats', state.cats); saveCloud(); render();
    };
    item.querySelector('.cat-delete').onclick=(e)=>{ e.stopPropagation(); window.delCat(c.id); };
    
    item.onclick=(e)=>{ 
      if(e.target.tagName!=='INPUT' && e.target.tagName!=='BUTTON'){ 
        sel.value=c.id; 
        mapSel.value=c.id; 
        document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        saveCloud();
      }
    };
    manager.appendChild(item);
  });
  
  if (currentVal && state.cats.some(c => c.id === currentVal)) {
    sel.value = currentVal;
  }
}

export function renderTimeline(){
  const tl=document.getElementById('timeline');
  const em=document.getElementById('empty-msg');
  if(!tl || !em) return;

  document.getElementById('tl-date').textContent = fmtDateLabel(state.curDate);
  const dayEvents = state.events.filter(e => e.date === state.curDate);

  if(!dayEvents.length){ em.style.display='block'; tl.style.display='none'; return; }
  em.style.display='none'; tl.style.display='block'; tl.innerHTML='';

  dayEvents.sort((a,b) => a.sMins - b.sMins).forEach(ev => {
    const cat = state.cats.find(c => c.id === ev.catId) || {name: 'حذف شده', color: '#999'};
    const tagsHtml = (ev.tags||[]).map(t => `<span class="tag-badge">${escHtml(t)}</span>`).join('');
    
    tl.innerHTML += `
      <div class="tl-item" style="--ic:${cat.color}">
        <div class="tl-dot"></div>
        <div class="tl-info">
          <div class="tl-title">${escHtml(ev.title || cat.name)}</div>
          <div class="tl-meta">
            <span class="tl-badge" style="background:${cat.color}">${escHtml(cat.name)}</span>
            <span class="tl-time">${fmtTime(ev.sMins)} تا ${fmtTime(ev.eMins)}</span>
            <span class="tl-dur">(${fmtDur(ev.durMins)})</span>
            ${ev.pauseMins ? `<span style="color:#f87171; font-size:10px; margin-right:6px;">(وقفه: ${ev.pauseMins}m)</span>` : ''}
          </div>
          ${tagsHtml ? `<div style="margin-top:6px;">${tagsHtml}</div>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <button class="btn-del" onclick="duplicateEv('${ev.id}')" title="کپی به امروز" style="background:var(--surface3); font-size:12px;">📋</button>
          <button class="btn-del" onclick="delEv('${ev.id}')">✕</button>
        </div>
      </div>`;
  });
}

export function renderReport(){
  const grid = document.getElementById('report-grid');
  const ctx = document.getElementById('report-chart');
  if(!grid) return;

  const daysRange = parseInt(document.getElementById('report-days').value) || 7;
  const [y,mo,d]=state.curDate.split('-').map(Number);
  const ref=new Date(y,mo-1,d);
  const from=new Date(ref); from.setDate(from.getDate() - (daysRange - 1));

  const week = state.events.filter(e => {
    const [ey,em,ed] = e.date.split('-').map(Number);
    const dt = new Date(ey,em-1,ed); return dt >= from && dt <= ref;
  });

  const sums={}; let total=0;
  week.forEach(e=>{ sums[e.catId]=(sums[e.catId]||0)+e.durMins; total+=e.durMins; });

  if (reportChartInstance) reportChartInstance.destroy();

  const labels = []; const data = []; const bgColors = [];
  grid.innerHTML='';

  Object.keys(sums).forEach(catId=>{
    const cat = state.cats.find(c=>c.id===catId) || {name:'حذف شده', color:'#999'};
    const mins = sums[catId];
    labels.push(cat.name); data.push(mins); bgColors.push(cat.color);
    const pct=total>0?Math.round((mins/total)*100):0;
    
    grid.innerHTML += `
      <div style="margin-bottom:10px;">
        <div class="report-header">
          <span style="color:${cat.color}">${escHtml(cat.name)}</span>
          <span>${fmtDur(mins)} (${pct}٪)</span>
        </div>
        <div class="prog-bg">
          <div class="prog-fill" style="background:${cat.color};width:${pct}%"></div>
        </div>
      </div>`;
  });

  if(ctx && data.length > 0) {
    const chartType = state.chartTypePref || 'doughnut';
    
    // تعریف استایل متناسب برای نمودار ستونی
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: chartType === 'doughnut' ? 'right' : 'top',
          labels: { color: '#999', font: { family: 'Vazirmatn' } }
        }
      }
    };

    if (chartType === 'bar') {
      chartOptions.scales = {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#999', font: { family: 'Vazirmatn' } } },
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#999', font: { family: 'Vazirmatn' } } }
      };
    }

    reportChartInstance = new Chart(ctx, {
      type: chartType,
      data: {
        labels,
        datasets: [{
          label: 'مدت زمان به دقیقه',
          data,
          backgroundColor: bgColors,
          borderWidth: 0,
          borderRadius: chartType === 'bar' ? 6 : 0
        }]
      },
      options: chartOptions
    });
  }
  document.getElementById('total-line').innerHTML=`مجموع گزارش: <span>${fmtDur(total)}</span>`;
}

export function renderActivityMap(){
  const map=document.getElementById('activity-map');
  const sel=document.getElementById('map-cat-select');
  const label=document.getElementById('map-month-label');
  if(!map || !sel || !label) return;

  const [y,mo]=state.mapMonth.split('-').map(Number);
  const monthNames=['ژانویه','فوریه','مارس','آوریل','مه','ژوئن','ژوئیه','اوت','سپتامبر','اکتبر','نوامبر','دسامبر'];
  label.textContent=monthNames[mo-1]+' '+y;
  map.innerHTML='';

  ['ش','ی','د','س','چ','پ','ج'].forEach(day=>{
    map.innerHTML += `<div class="map-weekday">${day}</div>`;
  });

  if(!state.cats.length || !sel.value){
    map.innerHTML='<div style="grid-column:1/-1; color:var(--muted); font-size:12px; text-align:center;">داده‌ای نیست</div>'; return;
  }

  const cat=state.cats.find(c=>c.id===sel.value);
  const daysInMonth=new Date(y, mo, 0).getDate();
  const firstDay=new Date(y, mo-1, 1).getDay();
  const startOffset=(firstDay+1)%7; 
  const sums={};

  state.events.forEach(e=>{
    if(!e.date || e.catId!==sel.value || !e.date.startsWith(state.mapMonth)) return;
    const day=Number(e.date.slice(8,10));
    sums[day]=(sums[day]||0)+e.durMins;
  });

  const max=Math.max(0, ...Object.values(sums));
  for(let i=0; i<startOffset; i++) map.innerHTML += `<div class="map-day" style="background:transparent; border:none;"></div>`;

  for(let day=1; day<=daysInMonth; day++){
    const mins=sums[day]||0;
    const ratio=max ? mins/max : 0;
    const size=mins ? Math.round(6 + ratio*14) : 4;
    map.innerHTML += `
      <div class="map-day">
        <span class="map-day-num">${day}</span>
        <span class="map-dot" style="width:${size}px; height:${size}px; background:${mins?cat.color:'var(--surface3)'}"></span>
      </div>`;
  }
}

export function renderHabitsAndTodos() {
  const todoList = document.getElementById('todo-list');
  const habitList = document.getElementById('habit-list');
  if(!todoList || !habitList) return;

  const todaysTodos = state.todos.filter(t => t.date === state.curDate);
  todoList.innerHTML = todaysTodos.length ? '' : '<div style="color:var(--muted); font-size:12px;">کاری ثبت نشده</div>';
  todaysTodos.forEach(t => {
    todoList.innerHTML += `
      <div class="todo-item">
        <div style="display:flex; align-items:center; flex:1;">
          <input type="checkbox" class="todo-checkbox" ${t.done?'checked':''} onchange="toggleTodo('${t.id}')">
          <span class="todo-title ${t.done?'done':''}">${escHtml(t.title)}</span>
        </div>
        <button class="btn-del" onclick="deleteTodo('${t.id}')">✕</button>
      </div>`;
  });

  habitList.innerHTML = state.habits.length ? '' : '<div style="color:var(--muted); font-size:12px;">عادتی ثبت نشده</div>';
  const last7Days = [];
  const [y,m,d] = state.curDate.split('-').map(Number);
  for(let i=6; i>=0; i--) {
    let dt = new Date(y, m-1, d - i);
    last7Days.push(dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()));
  }

  state.habits.forEach(h => {
    let daysHtml = last7Days.map(dateStr => {
      const isDone = state.habitLogs[h.id] && state.habitLogs[h.id][dateStr];
      const dNum = dateStr.slice(-2);
      return `<button class="habit-day-btn ${isDone?'done':''}" onclick="toggleHabit('${h.id}', '${dateStr}')">${dNum}</button>`;
    }).join('');

    habitList.innerHTML += `
      <div class="habit-item" style="flex-direction:column; align-items:flex-start; gap:10px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <strong style="font-size:13px; color:var(--text);">${escHtml(h.title)}</strong>
          <button class="btn-del" style="width:24px; height:24px; font-size:12px;" onclick="deleteHabit('${h.id}')">✕</button>
        </div>
        <div class="habit-days">${daysHtml}</div>
      </div>`;
  });
}

// نمایش خلق‌وخو و دفترچه خاطرات روزانه
export function renderMood() {
  const noteInp = document.getElementById('journal-textarea');
  const emojiSpans = document.querySelectorAll('.mood-emoji');
  if(!noteInp || !emojiSpans.length) return;

  const todayMood = state.moods[state.curDate] || { mood: null, note: '' };
  noteInp.value = todayMood.note;
  
  emojiSpans.forEach(sp => {
    if(todayMood.mood === sp.getAttribute('data-mood')) sp.classList.add('active');
    else sp.classList.remove('active');
  });
}

function startLiveStopwatch() {
  if(liveStopwatchInterval) clearInterval(liveStopwatchInterval);
  const isPom = state.liveSession.isPomodoro;
  let notified = false;

  const updateElapsed = () => {
    const el = document.getElementById('live-elapsed-time');
    if(el && state.liveSession) {
      const nowMins = parseTime(getNow());
      let diff = nowMins - state.liveSession.sMins; 
      if(diff<0) diff+=24*60;
      
      let netMins = diff - (state.liveSession.pauseMins || 0);
      if (state.liveSession.pauseStartMins !== null && state.liveSession.pauseStartMins !== undefined) {
        let pauseDiff = nowMins - state.liveSession.pauseStartMins;
        if (pauseDiff < 0) pauseDiff += 24 * 60;
        netMins -= pauseDiff;
      }

      if (netMins < 0) netMins = 0;

      if(isPom && netMins>=25 && !notified) { 
        notified=true; 
        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(()=>{});
        alert("🍅 ۲۵ دقیقه گذشت! استراحت کنید."); 
      }
      el.innerHTML = `زمان خالص: <b>${fmtDur(netMins)}</b> ${isPom?'(پومودورو) 🍅':''}`;
    }
  };

  updateElapsed();
  liveStopwatchInterval = setInterval(updateElapsed, 1000);
}

export function toggleLivePause() {
  if (!state.liveSession) return;
  const nowMins = parseTime(getNow());

  if (state.liveSession.pauseStartMins === null || state.liveSession.pauseStartMins === undefined) {
    state.liveSession.pauseStartMins = nowMins;
  } else {
    let diff = nowMins - state.liveSession.pauseStartMins;
    if (diff < 0) diff += 24 * 60;
    state.liveSession.pauseMins = (state.liveSession.pauseMins || 0) + diff;
    state.liveSession.pauseStartMins = null;
  }
  save('planner_live', state.liveSession);
  saveCloud();
  updateLiveButton();
}

export function updateLiveButton(){
  const btn = document.getElementById('live-btn');
  const status = document.getElementById('live-status');
  if(!btn || !status) return;

  if(state.liveSession){
    btn.classList.add('is-running');
    btn.textContent = 'پایان و ثبت فعالیت';
    
    const cat = state.cats.find(c => c.id === state.liveSession.catId) || {name: 'موضوع', color: '#999'};
    const isPaused = state.liveSession.pauseStartMins !== null && state.liveSession.pauseStartMins !== undefined;
    const pauseMinsTotal = state.liveSession.pauseMins || 0;

    status.innerHTML = `
      <div style="margin-bottom: 4px;">ثبت زنده: ${escHtml(state.liveSession.title || cat.name)} (${escHtml(cat.name)})</div>
      <div id="live-elapsed-time" style="color:var(--accent2); font-weight:700; margin-bottom:4px;">در حال محاسبه...</div>
      ${pauseMinsTotal ? `<div style="color:var(--accent2); font-size:11px;">کل زمان وقفه: ${pauseMinsTotal} دقیقه</div>` : ''}
      ${isPaused ? `<div style="color:#f87171; font-size:11px; margin-bottom:4px;">⏳ اکنون در حالت پاز موقت</div>` : ''}
      <div style="display:flex; gap:6px; justify-content:center; margin-top:6px;">
        <button id="live-pause-btn" class="action-btn" style="background:var(--surface3); color:var(--text); border:1px solid var(--border2);">${isPaused ? '▶ ادامه فعالیت' : '⏸ پاز موقت'}</button>
        <button id="live-cancel-btn" class="action-btn" style="background:#f8717122; border:1px solid rgba(248,113,113,0.3); color:#fecaca;">🚫 لغو و انصراف</button>
      </div>
    `;

    document.getElementById('live-pause-btn').onclick = (e) => {
      e.stopPropagation();
      toggleLivePause();
    };

    document.getElementById('live-cancel-btn').onclick = (e) => {
      e.stopPropagation();
      window.cancelLiveSession();
    };

    startLiveStopwatch();
  } else {
    btn.classList.remove('is-running');
    btn.textContent = 'شروع فعالیت زنده';
    status.textContent = '';
    if(liveStopwatchInterval) {
      clearInterval(liveStopwatchInterval);
      liveStopwatchInterval = null;
    }
  }
}

export function syncSettingsForm() {
  if (document.getElementById('setting-calendar')) document.getElementById('setting-calendar').value = state.calendarPref;
  if (document.getElementById('setting-duration-format')) document.getElementById('setting-duration-format').value = state.timeFormatPref;
  if (document.getElementById('setting-week-start')) document.getElementById('setting-week-start').value = state.weekStartPref;
  if (document.getElementById('report-chart-type')) document.getElementById('report-chart-type').value = state.chartTypePref;
}

export function render(){
  applyTheme();
  
  // فیکس اول: رندر کردن تاریخ در بالاترین نقطه جهت لود بلادرنگ پس از ورود
  const dateLabel = document.getElementById('date-label');
  if (dateLabel) dateLabel.textContent = fmtDateLabel(state.curDate);

  renderCats();
  renderTimeline();
  renderReport();
  renderActivityMap();
  renderHabitsAndTodos();
  renderMood();
  updateLiveButton();
  syncSettingsForm();
}
