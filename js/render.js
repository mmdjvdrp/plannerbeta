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
  const goalSel=document.getElementById('goal-cat-select');
  if(!sel || !mapSel || !manager) return;

  const currentVal = sel.value;
  const currentMapVal = mapSel.value;
  
  sel.innerHTML=''; mapSel.innerHTML=''; manager.innerHTML='';
  if (goalSel) goalSel.innerHTML = '';
  
  if(!state.cats.length){
    sel.innerHTML='<option disabled selected>اول موضوع بسازید</option>';
    manager.innerHTML='<div style="color:var(--muted); font-size:12px;">هنوز موضوعی ندارید.</div>';
    return;
  }
  
  state.cats.forEach(c=>{
    const o=document.createElement('option'); o.value=c.id; o.textContent=c.name;
    sel.appendChild(o); 
    mapSel.appendChild(o.cloneNode(true));
    if (goalSel) goalSel.appendChild(o.cloneNode(true));

    const item=document.createElement('div');
    item.className='cat-item'; item.style.setProperty('--cat-color', c.color);
    
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
        sel.value=c.id; mapSel.value=c.id; 
        document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        saveCloud();
      }
    };
    manager.appendChild(item);
  });
  
  // افزودن موضوع پیش‌فرض "وضعیت خلق و خو" به نقشه ماهانه
  const moodOption = document.createElement('option');
  moodOption.value = 'mood_tracker';
  moodOption.textContent = '📊 وضعیت خلق و خو (حالت روزانه)';
  mapSel.appendChild(moodOption);
  
  if (currentVal && state.cats.some(c => c.id === currentVal)) {
    sel.value = currentVal;
  }
  if (currentMapVal) {
    mapSel.value = currentMapVal;
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

  // حالت اول: گروه‌بندی خودکار کارهای هم‌موضوع (On)
  if (state.groupTimelinePref) {
    const groups = {};
    dayEvents.forEach(ev => {
      if(!groups[ev.catId]) groups[ev.catId] = [];
      groups[ev.catId].push(ev);
    });

    const sortedCatIds = Object.keys(groups).sort((a, b) => {
      const minA = Math.min(...groups[a].map(e => e.sMins));
      const minB = Math.min(...groups[b].map(e => e.sMins));
      return minA - minB;
    });

    sortedCatIds.forEach(catId => {
      const cat = state.cats.find(c => c.id === catId) || {name: 'حذف شده', color: '#999'};
      const grp = groups[catId].sort((a,b) => a.sMins - b.sMins);
      const totalDur = grp.reduce((sum, e) => sum + e.durMins, 0);

      const details = document.createElement('details');
      details.style.cssText = `
        border: 1px solid var(--border);
        border-radius: 12px;
        margin-bottom: 10px;
        background: var(--surface);
        overflow: hidden;
      `;

      details.innerHTML = `
        <summary style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 14px;
          cursor: pointer;
          list-style: none;
          outline: none;
          border-right: 4px solid ${cat.color};
        ">
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="width:10px; height:10px; border-radius:50%; background:${cat.color}; display:inline-block;"></span>
            <div>
              <div style="font-size: 13px; font-weight: 700; color: var(--text);">${escHtml(cat.name)}</div>
              <div style="font-size: 11px; color: var(--muted); margin-top:2px;">
                ${grp.length} بار تکرار فعالیت &mdash; مجموعاً: <b>${fmtDur(totalDur)}</b>
              </div>
            </div>
          </div>
          <span style="font-size: 11px; color: var(--muted);">▼</span>
        </summary>
        
        <div style="
          padding: 10px 14px;
          background: var(--surface2);
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-top: 1px solid var(--border);
        ">
          ${grp.map(ev => {
            const tagsHtml = (ev.tags||[]).map(t => `<span class="tag-badge">${escHtml(t)}</span>`).join('');
            const pauseText = ev.pauseMins ? `<span style="color:#f87171; margin-inline-start: 6px;">(پاز: ${ev.pauseMins}m)</span>` : '';
            return `
              <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 10px;
                background: var(--surface3);
                border-radius: 8px;
              ">
                <div>
                  <div style="font-size:12px; font-weight:700;">${escHtml(ev.title || cat.name)}</div>
                  <div style="font-size:10px; color:var(--muted); margin-top:2px; font-family: monospace;">
                    ${fmtTime(ev.sMins)} تا ${fmtTime(ev.eMins)} (${fmtDur(ev.durMins)}) ${pauseText}
                  </div>
                  ${tagsHtml ? `<div style="margin-top:4px;">${tagsHtml}</div>` : ''}
                </div>
                <div style="display:flex; gap:6px">
                  <button class="btn-edit" onclick="editEv('${ev.id}')" style="background:var(--surface2); border:1px solid var(--border); border-radius:7px; cursor:pointer; width:28px; height:28px; display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:12px;">✏️</button>
                  <button class="btn-del" onclick="delEv('${ev.id}')">✕</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      tl.appendChild(details);
    });
  } 
  // حالت دوم: نمایش ترتیبی خام (Off)
  else {
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
            <button class="btn-edit" onclick="editEv('${ev.id}')" style="background:var(--surface2); border:1px solid var(--border); border-radius:7px; cursor:pointer; width:28px; height:28px; display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:12px;">✏️</button>
            <button class="btn-del" onclick="delEv('${ev.id}')">✕</button>
          </div>
        </div>`;
    });
  }
}

export function renderReport(){
  const grid = document.getElementById('report-grid');
  const ctx = document.getElementById('report-chart');
  const selectAllChk = document.getElementById('report-select-all');
  if(!grid || !ctx) return;

  const allCatIds = state.cats.map(c => c.id);
  
  // تنظیم مقداردهی پیش‌فرض در اولین بارگذاری برای انتخاب تمام موضوعات
  if (!localStorage.getItem('planner_selected_report_cats') && state.selectedReportCats.length === 0) {
    state.selectedReportCats = [...allCatIds];
  }

  // بروزرسانی وضعیت تیک سلکت آل بر اساس فیلترها
  if (selectAllChk) {
    selectAllChk.checked = (state.selectedReportCats.length === state.cats.length && state.cats.length > 0);
  }

  const daysRange = parseInt(document.getElementById('report-days').value) || 7;
  const [y,mo,d]=state.curDate.split('-').map(Number);
  const ref=new Date(y,mo-1,d);
  const from=new Date(ref); from.setDate(from.getDate() - (daysRange - 1));

  // فیلتر کردن رویدادها فقط بر اساس موضوعاتی که انتخاب شده‌اند
  const week = state.events.filter(e => {
    const [ey,em,ed] = e.date.split('-').map(Number);
    const dt = new Date(ey,em-1,ed); 
    return dt >= from && dt <= ref && state.selectedReportCats.includes(e.catId);
  });

  const sums={}; let total=0;
  week.forEach(e=>{ sums[e.catId]=(sums[e.catId]||0)+e.durMins; total+=e.durMins; });

  if (reportChartInstance) reportChartInstance.destroy();

  const labels = []; const data = []; const bgColors = [];
  grid.innerHTML='';

  // ساخت لیست تمام موضوعات (رندر همه برای تغییر وضعیت تیک زدن در گزارش، با هاله نوری و مات کردن موارد غیرفعال)
  state.cats.forEach(cat => {
    const isSelected = state.selectedReportCats.includes(cat.id);
    const mins = sums[cat.id] || 0;
    const pct = total > 0 ? Math.round((mins / total) * 100) : 0;

    if (isSelected && mins > 0) {
      labels.push(cat.name); 
      data.push(mins); 
      bgColors.push(cat.color);
    }

    const haloStyle = isSelected 
      ? `border-color: ${cat.color}; background: var(--surface2); box-shadow: 0 0 12px color-mix(in srgb, ${cat.color} 30%, transparent); opacity: 1;` 
      : `border-color: var(--border); opacity: 0.45; background: var(--surface);`;

    const item = document.createElement('div');
    item.style.cssText = `
      margin-bottom: 10px;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.2s;
      ${haloStyle}
    `;

    item.innerHTML = `
      <div class="report-header" style="margin-bottom: 5px;">
        <span style="color:${cat.color}; font-weight:700;">${escHtml(cat.name)} ${isSelected ? '✓' : ''}</span>
        <span>${fmtDur(mins)} (${pct}٪)</span>
      </div>
      <div class="prog-bg">
        <div class="prog-fill" style="background:${cat.color}; width:${pct}%"></div>
      </div>
    `;

    // رویداد تپ تعاملی برای حذف/اضافه موضوعات روی نمودار گزارش‌ها
    item.onclick = () => {
      if (state.selectedReportCats.includes(cat.id)) {
        state.selectedReportCats = state.selectedReportCats.filter(id => id !== cat.id);
      } else {
        state.selectedReportCats.push(cat.id);
      }
      save('planner_selected_report_cats', state.selectedReportCats);
      saveCloud();
      render();
    };

    grid.appendChild(item);
  });

  const chartType = state.chartTypePref || 'doughnut';

  if (chartType === 'line') {
    const dates = [];
    for (let i = daysRange - 1; i >= 0; i--) {
      const dt = new Date(y, mo - 1, d - i);
      dates.push(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
    }

    const isJalali = (state.calendarPref === 'jalali');
    const xLabels = dates.map(dStr => {
      const [ey, em, ed] = dStr.split('-').map(Number);
      const dt = new Date(ey, em - 1, ed);
      return new Intl.DateTimeFormat(isJalali ? 'fa-IR' : 'en-US', { month: 'numeric', day: 'numeric' }).format(dt);
    });

    const lineDatasets = state.cats
      .filter(cat => state.selectedReportCats.includes(cat.id))
      .map(cat => {
        const dataPoints = dates.map(dateStr => {
          const dayEvs = state.events.filter(e => e.date === dateStr && e.catId === cat.id);
          return dayEvs.reduce((sum, e) => sum + e.durMins, 0);
        });
        return {
          label: cat.name,
          data: dataPoints,
          borderColor: cat.color,
          backgroundColor: cat.color + '18',
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          pointRadius: 3
        };
      });

    reportChartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels: xLabels, datasets: lineDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: '#999', font: { family: 'Vazirmatn', size: 10 } } }
        },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#999', font: { family: 'Vazirmatn' } } },
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#999', font: { family: 'Vazirmatn' } } }
        }
      }
    });
  } 
  else if (data.length > 0) {
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

  const daysInMonth=new Date(y, mo, 0).getDate();
  const firstDay=new Date(y, mo-1, 1).getDay();
  const startOffset=(firstDay+1)%7; 

  for(let i=0; i<startOffset; i++) map.innerHTML += `<div class="map-day" style="background:transparent; border:none;"></div>`;

  // بررسی انتخاب حالت خلق‌و‌خو پیش‌فرض در نقشه ماهانه
  if (sel.value === 'mood_tracker') {
    for(let day=1; day<=daysInMonth; day++){
      const dateStr = `${y}-${pad(mo)}-${pad(day)}`;
      const dayMood = state.moods[dateStr];
      
      let moodVisual = `<span class="map-dot" style="width:4px; height:4px; background:var(--surface3)"></span>`;
      let noteTooltip = `روز ${day}: یادداشتی ثبت نشده`;
      
      if (dayMood && dayMood.mood) {
        const preset = state.moodPresets.find(p => p.level === String(dayMood.mood));
        if (preset) {
          const noteText = dayMood.note ? `\nیادداشت: "${dayMood.note}"` : '\nبدون یادداشت متنی';
          noteTooltip = `روز ${day} - وضعیت: ${preset.label}${noteText}`;
          
          if (preset.type === 'webm' || preset.type === 'video') {
            moodVisual = `<video src="${preset.value}" autoplay loop muted playsinline style="width:22px; height:22px; border-radius:50%; object-fit:cover; pointer-events:none;"></video>`;
          } else {
            moodVisual = `<span style="font-size:15px; line-height:1;">${preset.value}</span>`;
          }
        }
      }
      
      map.innerHTML += `
        <div class="map-day" data-tooltip="${escHtml(noteTooltip)}" title="${escHtml(noteTooltip)}" style="cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; height:100%;">
          <span class="map-day-num">${day}</span>
          <div style="display:flex; align-items:center; justify-content:center; width:22px; height:22px; margin-top:6px;">
            ${moodVisual}
          </div>
        </div>`;
    }
  } 
  // حالت عادی: واکشی فعالیت‌های دسته‌بندی با تولتیپ و فرمت دلخواه
  else {
    const cat=state.cats.find(c=>c.id===sel.value);
    const sums={};

    state.events.forEach(e=>{
      if(!e.date || e.catId!==sel.value || !e.date.startsWith(state.mapMonth)) return;
      const day=Number(e.date.slice(8,10));
      sums[day]=(sums[day]||0)+e.durMins;
    });

    const max=Math.max(0, ...Object.values(sums));

    for(let day=1; day<=daysInMonth; day++){
      const mins=sums[day]||0;
      const ratio=max ? mins/max : 0;
      const size=mins ? Math.round(6 + ratio*14) : 4;
      
      const durText = mins ? fmtDur(mins) : 'بدون فعالیت ثبت شده';
      const tooltipText = `روز ${day} ${monthNames[mo-1]} \nمجموع زمان: ${durText}`;

      map.innerHTML += `
        <div class="map-day" data-tooltip="${tooltipText}" title="${tooltipText}">
          <span class="map-day-num">${day}</span>
          <span class="map-dot" style="width:${size}px; height:${size}px; background:${mins?cat.color:'var(--surface3)'}"></span>
        </div>`;
    }
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

export function renderMood() {
  const noteInp = document.getElementById('journal-textarea');
  const emojiContainer = document.getElementById('mood-emojis');
  if(!noteInp || !emojiContainer) return;

  const todayMood = state.moods[state.curDate] || { mood: null, note: '' };
  noteInp.value = todayMood.note;

  emojiContainer.innerHTML = state.moodPresets.map(preset => {
    const isActive = (todayMood.mood === String(preset.level));
    const activeStyle = isActive 
      ? 'opacity: 1; transform: scale(1.15); filter: drop-shadow(0 0 10px var(--accent)); border: 2px solid var(--accent);' 
      : 'opacity: 0.45; border: 2px solid transparent;';
      
    if (preset.type === 'webm' || preset.type === 'video') {
      return `
        <div class="mood-emoji" data-mood="${preset.level}" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; width:44px; height:44px; border-radius:50%; overflow:hidden; transition: all 0.2s; ${activeStyle}">
          <video src="${preset.value}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:cover; pointer-events:none;"></video>
        </div>`;
    } else {
      return `
        <span class="mood-emoji" data-mood="${preset.level}" style="cursor:pointer; font-size:32px; display:inline-block; transition: all 0.2s; ${activeStyle}">${preset.value}</span>`;
    }
  }).join('');

  document.querySelectorAll('.mood-emoji').forEach(sp => {
    sp.onclick = () => {
      const val = sp.getAttribute('data-mood');
      if(!state.moods[state.curDate]) state.moods[state.curDate] = { note: noteInp.value };
      state.moods[state.curDate].mood = String(val);
      save('planner_moods', state.moods); saveCloud(); renderMood();
    };
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

      const pomoLimit = state.pomodoroWorkPref || 25;

      if(isPom && netMins>=pomoLimit && !notified) { 
        notified=true; 
        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(()=>{});
        alert(`🍅 زمان کار پومودورو با موفقیت به پایان رسید! (${pomoLimit} دقیقه)`); 
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

export function renderRoutines() {
  const list = document.getElementById('rt-list');
  if(!list) return;
  list.innerHTML = '';
  
  if (state.routines.length === 0) {
    list.innerHTML = `<div style="font-size:11px; color:var(--muted); text-align:center;">هیچ روتینی تعریف نشده است</div>`;
    return;
  }
  
  const daysName = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  state.routines.forEach(rt => {
    const cat = state.cats.find(c => c.id === rt.catId) || {name: 'حذف شده', color: '#999'};
    const daysStr = rt.days.map(d => daysName[d]).join('، ');
    
    list.innerHTML += `
      <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surface2); border:1px solid var(--border); border-right:3px solid ${cat.color}; border-radius:8px; padding:6px 10px;">
        <div>
          <div style="font-size:12px; font-weight:700;">${escHtml(rt.title)} (${cat.name})</div>
          <div style="font-size:10px; color:var(--muted)">ساعت ${rt.startTime} تا ${rt.endTime} | روزهای: ${daysStr}</div>
        </div>
        <button class="btn-del" style="width:24px; height:24px; font-size:11px;" onclick="delRoutine('${rt.id}')">✕</button>
      </div>`;
  });
}

// رندر ویرایشگر اموجی و خلق و خوی پویای جدید (شخصی‌سازی نام و تعداد به صورت شناور)
export function renderCustomEmojisEditor() {
  const container = document.getElementById('custom-emojis-container');
  if (!container) return;
  
  let html = '';
  state.moodPresets.forEach((preset, idx) => {
    html += `
      <div style="display:flex; align-items:center; gap:8px; background:var(--surface2); padding:10px; border-radius:8px; border:1px solid var(--border); flex-wrap:wrap; margin-bottom:8px;">
        <span style="font-size:11px; min-width:80px; color:var(--text); font-weight:700;">سطح ${preset.level} :</span>
        <input type="text" class="emoji-label-input" data-idx="${idx}" value="${escHtml(preset.label)}" style="width:110px; padding:6px; font-size:12px; height:32px; border-radius:6px; background:var(--surface3); border:1px solid var(--border2); color:var(--text);" placeholder="نام حالت">
        <select class="emoji-type-select" data-idx="${idx}" style="width:100px; padding:6px; font-size:12px; height:32px; border-radius:6px; background:var(--surface3); border:1px solid var(--border2); color:var(--text);">
          <option value="text" ${preset.type === 'text' ? 'selected' : ''}>متنی</option>
          <option value="webm" ${preset.type === 'webm' ? 'selected' : ''}>انیمیشن WebM</option>
        </select>
        <input type="text" class="emoji-value-input" data-idx="${idx}" value="${escHtml(preset.value)}" style="flex:1; min-width:140px; padding:6px; font-size:12px; height:32px; border-radius:6px; background:var(--surface3); border:1px solid var(--border2); color:var(--text);" placeholder="${preset.type === 'text' ? '😊' : 'آدرس فایل'}">
        <button type="button" class="btn-del" onclick="deleteMoodPreset(${idx})" style="width:32px; height:32px;">✕</button>
      </div>`;
  });
  
  html += `
    <button type="button" class="btn-live" onclick="addMoodPreset()" style="margin-top:10px; border-color:var(--accent); color:var(--accent); padding:6px;">➕ افزودن سطح احساسات جدید</button>
  `;
  container.innerHTML = html;
}

export function syncSettingsForm() {
  if (document.getElementById('setting-calendar')) document.getElementById('setting-calendar').value = state.calendarPref;
  if (document.getElementById('setting-duration-format')) document.getElementById('setting-duration-format').value = state.timeFormatPref;
  if (document.getElementById('setting-week-start')) document.getElementById('setting-week-start').value = state.weekStartPref;
  if (document.getElementById('setting-pomodoro-work')) document.getElementById('setting-pomodoro-work').value = state.pomodoroWorkPref;
  if (document.getElementById('setting-pomodoro-break')) document.getElementById('setting-pomodoro-break').value = state.pomodoroBreakPref;
}

export function render(){
  applyTheme();
  
  const dateLabel = document.getElementById('date-label');
  if (dateLabel) dateLabel.textContent = fmtDateLabel(state.curDate);
  
  const groupToggle = document.getElementById('timeline-group-toggle');
  if (groupToggle) groupToggle.checked = state.groupTimelinePref;
  
  renderCats();
  renderTimeline();
  renderReport();
  renderActivityMap();
  renderHabitsAndTodos();
  renderMood();
  renderRoutines();
  updateLiveButton();
  syncSettingsForm();
  renderCustomEmojisEditor(); 
}
