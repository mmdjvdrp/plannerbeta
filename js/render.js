// js/render.js
import { state, save, saveCloud } from "./storage.js";
import { fmtDateLabel, fmtTime, fmtDur, escHtml, pad, getNow, parseTime } from "./helpers.js";
import { renderTodayRoutines } from "./features.js"; // ایمپورت تابع جدید

let liveStopwatchInterval = null;
let reportChartInstance = null;

export function applyTheme(){
  let activeTheme = state.theme;
  if (activeTheme === 'auto') activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.body.dataset.theme = activeTheme;
  document.documentElement.style.setProperty('--accent', state.accentColor);
  document.documentElement.style.setProperty('--accent-glow', `color-mix(in srgb, ${state.accentColor} 25%, transparent)`);
  
  // اعمال ویژگی ناوبری انتخاب شده به بدنه HTML
  const navStyle = state.mobileNavStyle || 'grid';
  document.body.setAttribute('data-nav-style', navStyle);

  // بهینه‌سازی فاصله‌بندی نهایی بدنه بر اساس ارتفاع سبک منو روی موبایل
  const wrap = document.querySelector('.wrap');
  if (wrap && window.innerWidth <= 768) {
    if (navStyle === 'grid') {
      wrap.style.setProperty('padding-bottom', '190px', 'important');
    } else {
      wrap.style.setProperty('padding-bottom', '150px', 'important');
    }
  }

  if(document.getElementById('setting-theme-select')) document.getElementById('setting-theme-select').value = state.theme;
  if(document.getElementById('setting-accent-picker')) document.getElementById('setting-accent-picker').value = state.accentColor;
  if(document.getElementById('setting-mobile-nav')) document.getElementById('setting-mobile-nav').value = navStyle;
}

export function renderCats(){
  const sel=document.getElementById('cat-select');
  const mapSel=document.getElementById('map-cat-select');
  const manager=document.getElementById('cat-manager');
  const goalSel=document.getElementById('goal-cat-select');
  if(!sel || !mapSel || !manager) return;

  const currentVal = sel.value;
  const currentMapVal = mapSel.value; // نگهداری مقدار فعلی mapSel
  sel.innerHTML=''; mapSel.innerHTML=''; manager.innerHTML='';
  if (goalSel) goalSel.innerHTML = '';
  
  // گزینه پیش‌فرض برای حالت روحی روزانه
  const moodOpt = document.createElement('option');
  moodOpt.value = 'mood_tracker';
  moodOpt.textContent = 'حالت روحی روزانه (خلق‌و‌خو) 🤩';
  mapSel.appendChild(moodOpt);

  if(!state.cats.length){
    sel.innerHTML='<option disabled selected>اول موضوع بسازید</option>';
    manager.innerHTML='<div style="color:var(--muted); font-size:12px;">هنوز موضوعی ندارید.</div>';
    // اگر دسته‌بندی نباشد، تنها گزینه mood_tracker، روتین‌ها و عادت‌ها نمایش داده می‌شوند
  }
  
  state.cats.forEach(c=>{
    const emoji = c.emoji || '📅';
    const isUrl = emoji.startsWith('http');
    const displayEmoji = isUrl ? '🎥' : emoji;

    const o=document.createElement('option'); o.value=c.id; o.textContent=`${displayEmoji} ${c.name}`;
    sel.appendChild(o); 
    mapSel.appendChild(o.cloneNode(true)); // افزودن به mapSel
    if (goalSel) goalSel.appendChild(o.cloneNode(true));

    const item=document.createElement('div');
    item.className='cat-item'; item.style.setProperty('--cat-color', c.color);
    item.style.gridTemplateColumns = "20px 28px 1fr 34px 34px 34px"; 
    
    if (c.id === currentVal) {
      item.classList.add('selected');
    }

    const emojiHtml = isUrl 
      ? `<video src="${emoji}" autoplay loop muted playsinline style="width:24px; height:24px; object-fit:cover; border-radius:50%; pointer-events:none;"></video>`
      : `<span style="font-size:15px; text-align:center;">${emoji}</span>`;

    item.innerHTML=`
      <span class="cat-swatch"></span>
      <div style="display:flex; align-items:center; justify-content:center; width:24px; height:24px; overflow:hidden; border-radius:50%;">${emojiHtml}</div>
      <span class="cat-name">${escHtml(c.name)}</span>
      <button class="cat-emoji-edit" type="button" onclick="event.stopPropagation(); window.openCatEmojiPicker('${c.id}')" style="width:32px; height:32px; border:1px solid var(--border2); border-radius:8px; background:var(--surface3); color:var(--muted); cursor:pointer;" title="انتخاب شکلک متحرک">🖼️</button>
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

  // اضافه کردن روتین‌ها به mapSel برای نمایش در نقشه ماهانه
  if (state.routines && state.routines.length > 0) {
    const divider = document.createElement('option');
    divider.disabled = true;
    divider.textContent = '─── روتین‌ها ───';
    mapSel.appendChild(divider);

    state.routines.forEach(rt => {
      const o = document.createElement('option');
      o.value = `rt_${rt.id}`; // پیشوند 'rt_' برای تشخیص روتین
      o.textContent = `⏰ روتین: ${rt.title}`;
      mapSel.appendChild(o);
    });
  }

  // اضافه کردن عادت‌ها به mapSel برای نمایش در نقشه ماهانه
  if (state.habits && state.habits.length > 0) {
    const divider = document.createElement('option');
    divider.disabled = true;
    divider.textContent = '─── عادت‌ها ───';
    mapSel.appendChild(divider);

    state.habits.forEach(hb => {
      const o = document.createElement('option');
      o.value = `hb_${hb.id}`; // پیشوند 'hb_' برای تشخیص عادت
      o.textContent = `✔️ عادت: ${hb.title}`;
      mapSel.appendChild(o);
    });
  }
  
  // تنظیم مجدد مقدار انتخاب شده در سلکتورها
  if (currentVal && state.cats.some(c => c.id === currentVal)) {
    sel.value = currentVal;
  }

  // اطمینان از اینکه مقدار mapSel پس از رندر مجدد حفظ شود (شامل روتین‌ها و عادت‌ها)
  if (currentMapVal && (currentMapVal === 'mood_tracker' || currentMapVal.startsWith('rt_') || currentMapVal.startsWith('hb_') || state.cats.some(c => c.id === currentMapVal))) {
    mapSel.value = currentMapVal;
  } else {
    mapSel.value = 'mood_tracker'; // مقدار پیش‌فرض
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
      const cat = state.cats.find(c => c.id === catId) || {name: 'حذف شده', color: '#999', emoji: '📅'};
      const catEmoji = cat.emoji || '📅';
      const isUrl = catEmoji.startsWith('http');
      
      const catEmojiHtml = isUrl
        ? `<video src="${catEmoji}" autoplay loop muted playsinline style="width:18px; height:18px; object-fit:cover; border-radius:50%; vertical-align:middle; display:inline-block; margin-inline-end:6px;"></video>`
        : `<span style="margin-inline-end:6px;">${catEmoji}</span>`;

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
              <div style="font-size: 13px; font-weight: 700; color: var(--text); display:flex; align-items:center;">
                ${catEmojiHtml} ${escHtml(cat.name)}
              </div>
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
            const pauseText = ev.pauseMins ? `<span style="color:#f87171; margin-inline-start: 6px;">(وقفه: ${ev.pauseMins}m)</span>` : '';
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
                  <button class="btn-del" onclick="editEv('${ev.id}')" style="background:var(--surface2); border:1px solid var(--border); font-size:11px; padding:0 6px;">✏️</button>
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
  else {
    dayEvents.sort((a,b) => a.sMins - b.sMins).forEach(ev => {
      const cat = state.cats.find(c => c.id === ev.catId) || {name: 'حذف شده', color: '#999', emoji: '📅'};
      const catEmoji = cat.emoji || '📅';
      const isUrl = catEmoji.startsWith('http');
      
      const catEmojiHtml = isUrl
        ? `<video src="${catEmoji}" autoplay loop muted playsinline style="width:16px; height:16px; object-fit:cover; border-radius:50%; vertical-align:middle; display:inline-block; margin-inline-end:4px;"></video>`
        : `<span style="margin-inline-end:4px;">${catEmoji}</span>`;

      const tagsHtml = (ev.tags||[]).map(t => `<span class="tag-badge">${escHtml(t)}</span>`).join('');
      
      tl.innerHTML += `
        <div class="tl-item" style="--ic:${cat.color}">
          <div class="tl-dot"></div>
          <div class="tl-info">
            <div class="tl-title">${escHtml(ev.title || cat.name)}</div>
            <div class="tl-meta">
              <span class="tl-badge" style="background:${cat.color}; display:inline-flex; align-items:center; gap:4px;">
                ${catEmojiHtml} ${escHtml(cat.name)}
              </span>
              <span class="tl-time">${fmtTime(ev.sMins)} تا ${fmtTime(ev.eMins)}</span>
              <span class="tl-dur">(${fmtDur(ev.durMins)})</span>
              ${ev.pauseMins ? `<span style="color:#f87171; font-size:10px; margin-right:6px;">(وقفه: ${ev.pauseMins}m)</span>` : ''}
            </div>
            ${tagsHtml ? `<div style="margin-top:6px;">${tagsHtml}</div>` : ''}
          </div>
          <div style="display:flex; flex-direction:row; gap:6px;">
            <button class="btn-del" onclick="editEv('${ev.id}')" style="font-size:11px; padding:0 6px;">✏️</button>
            <button class="btn-del" onclick="delEv('${ev.id}')">✕</button>
          </div>
        </div>`;
    });
  }
}

export function renderReport(){
  const grid = document.getElementById('report-grid');
  const ctx = document.getElementById('report-chart');
  if(!grid || !ctx) return;

  const daysRange = parseInt(document.getElementById('report-days').value) || 7;
  const [y,mo,d]=state.curDate.split('-').map(Number);
  const ref=new Date(y,mo-1,d);
  const from=new Date(ref); from.setDate(from.getDate() - (daysRange - 1));

  const week = state.events.filter(e => {
    const [ey,em,ed] = e.date.split('-').map(Number);
    const dt = new Date(ey,em-1,ed); return dt >= from && dt <= ref;
  });

  const sums={}; 
  let total=0;
  week.forEach(e=>{ 
    sums[e.catId]=(sums[e.catId]||0)+e.durMins; 
    total+=e.durMins; 
  });

  if (!state.selectedReportCats || state.selectedReportCats.length === 0) {
    state.selectedReportCats = state.cats.map(c => c.id);
  }

  const selectAllCheckbox = document.getElementById('report-select-all');
  if (selectAllCheckbox) {
    const uniqueWeekCatIds = Object.keys(sums);
    const isAllSelected = uniqueWeekCatIds.length > 0 && uniqueWeekCatIds.every(id => state.selectedReportCats.includes(id));
    selectAllCheckbox.checked = isAllSelected;
  }

  if (reportChartInstance) reportChartInstance.destroy();

  const labels = []; 
  const data = []; 
  const bgColors = [];
  grid.innerHTML='';

  const activeSums = {};
  let activeTotal = 0;
  Object.keys(sums).forEach(catId => {
    if (state.selectedReportCats.includes(catId)) {
      activeSums[catId] = sums[catId];
      activeTotal += sums[catId];
    }
  });

  const detailCard = document.getElementById('report-detail-card');
  if (detailCard) {
    if (state.selectedReportCats.length === state.cats.length || state.selectedReportCats.length === 0 && state.cats.length > 0) {
      detailCard.innerHTML = `📊 در حال نمایش آمار کلی <b>همه موضوعات فعال</b> برای این دوره ${daysRange} روزه (مجموع زمان فعالیت: <b>${fmtDur(total)}</b>)`;
    } else if (state.selectedReportCats.length === 0) {
      detailCard.innerHTML = `⚠️ هیچ موضوعی برای نمایش انتخاب نشده است. برای فعال‌سازی مجدد روی چک‌باکس موضوعات پایین ضربه بزنید.`;
    } else {
      const names = state.cats
        .filter(c => state.selectedReportCats.includes(c.id))
        .map(c => c.name)
        .join('، ');
      detailCard.innerHTML = `🎯 آمار فیلتر شده نمودار: <b style="color:var(--accent);">${escHtml(names)}</b> (مجموع زمان این موضوعات: <b>${fmtDur(activeTotal)}</b>)`;
    }
  }

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
  else {
    Object.keys(activeSums).forEach(catId => {
      const cat = state.cats.find(c => c.id === catId) || {name: 'حذف شده', color: '#999'};
      labels.push(cat.name);
      data.push(activeSums[catId]);
      bgColors.push(cat.color);
    });

    if (data.length > 0) {
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
  }

  const recordedCatIds = Object.keys(sums);
  if (recordedCatIds.length === 0) {
    grid.innerHTML = '<div style="color:var(--muted); font-size:12px; text-align:center; padding:10px;">داده‌ای برای دوره‌ی انتخاب شده وجود ندارد.</div>';
  } else {
    recordedCatIds.forEach(catId => {
      const cat = state.cats.find(c => c.id === catId) || {name: 'حذف شده', color: '#999', emoji: '📅'};
      const catEmoji = cat.emoji || '📅';
      const isUrl = catEmoji.startsWith('http');
      
      const catEmojiHtml = isUrl
        ? `<video src="${catEmoji}" autoplay loop muted playsinline style="width:20px; height:20px; object-fit:cover; border-radius:50%; vertical-align:middle; display:inline-block; margin-inline-end:6px;"></video>`
        : `<span style="margin-inline-end:6px;">${catEmoji}</span>`;

      const mins = sums[catId];
      const isSelected = state.selectedReportCats.includes(catId);
      const pct = total > 0 ? Math.round((mins / total) * 100) : 0;
      
      const itemDiv = document.createElement('div');
      itemDiv.className = `report-item-interactive ${isSelected ? 'selected' : ''}`;
      itemDiv.style.setProperty('--cat-color', cat.color);
      
      itemDiv.innerHTML = `
        <div class="report-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="display:inline-block; width:16px; height:16px; border-radius:5px; border:2px solid ${cat.color}; background:${isSelected ? cat.color : 'transparent'}; transition: background 0.2s, transform 0.15s; position:relative; flex-shrink:0;">
              ${isSelected ? '<span style="position:absolute; left:3px; top:-1px; color:#fff; font-size:9px; font-weight:bold; line-height:1;">✓</span>' : ''}
            </span>
            <span style="color:${cat.color}; font-weight:700; font-size:13px; display:flex; align-items:center; gap:4px;">
              ${catEmojiHtml} ${escHtml(cat.name)}
            </span>
          </div>
          <span style="font-size:12px; color:var(--text); font-weight:500;">${fmtDur(mins)} (${pct}٪)</span>
        </div>
        <div class="prog-bg" style="margin-top:8px;">
          <div class="prog-fill" style="background:${cat.color}; width:${pct}%"></div>
        </div>
      `;
      
      itemDiv.onclick = () => {
        if (state.selectedReportCats.includes(catId)) {
          state.selectedReportCats = state.selectedReportCats.filter(id => id !== catId);
        } else {
          state.selectedReportCats.push(catId);
        }
        save("planner_selected_report_cats", state.selectedReportCats);
        saveCloud();
        render();
      };
      grid.appendChild(itemDiv);
    });
  }
  
  document.getElementById('total-line').innerHTML=`مجموع گزارش فعال: <span>${fmtDur(activeTotal)}</span>`;
}

export function renderActivityMap(){
  const map=document.getElementById('activity-map');
  const sel=document.getElementById('map-cat-select');
  const label=document.getElementById('map-month-label');
  const tooltipDetail = document.getElementById('map-tooltip-detail');
  if(!map || !sel || !label) return;

  const [y,mo]=state.mapMonth.split('-').map(Number);
  const monthNames=['ژانویه','فوریه','مارس','آوریل','مه','ژوئن','ژوئیه','اوت','سپتامبر','اکتبر','نوامبر','دسامبر'];
  
  const isJalali = (state.calendarPref === 'jalali');
  if (isJalali) {
    const dtSample = new Date(y, mo - 1, 1);
    const labelParts = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long' }).format(dtSample);
    label.textContent = labelParts;
  } else {
    label.textContent=monthNames[mo-1]+' '+y;
  }
  
  map.innerHTML='';

  // رندر روزهای هفته
  ['sh','y','d','s','ch','p','j'].forEach(day=>{
    let dLabel = 'ش';
    if(day==='y') dLabel='ی';
    if(day==='d') dLabel='د';
    if(day==='s') dLabel='س';
    if(day==='ch') dLabel='چ';
    if(day==='p') dLabel='پ';
    if(day==='j') dLabel='ج';
    map.innerHTML += `<div class="map-weekday">${dLabel}</div>`;
  });

  const selectedValue = sel.value;
  if(!selectedValue){
    map.innerHTML='<div style="grid-column:1/-1; color:var(--muted); font-size:12px; text-align:center;">موضوعی انتخاب نشده است</div>'; 
    return;
  }

  const daysInMonth=new Date(y, mo, 0).getDate();
  const firstDay=new Date(y, mo-1, 1).getDay(); // 0 for Sunday, 6 for Saturday
  // برای شروع از شنبه در تقویم شمسی
  const startOffset=(firstDay + (state.weekStartPref === 'sat' ? 1 : 0)) % 7; 
  
  for(let i=0; i<startOffset; i++) {
    map.innerHTML += `<div class="map-day" style="background:transparent; border:none;"></div>`;
  }

  // ۱. ردیابی هیت‌مپ روزهای ثبت حالت روحی روزانه (Mood Tracker)
  if (selectedValue === 'mood_tracker') {
    for(let day=1; day<=daysInMonth; day++){
      const dateStr = `${y}-${pad(mo)}-${pad(day)}`;
      const dayMood = state.moods[dateStr];
      let displayContent = '';
      let tooltipText = '';
      
      const formattedDate = fmtDateLabel(dateStr);

      if (dayMood && dayMood.mood) {
        const preset = state.moodPresets.find(p => String(p.level) === String(dayMood.mood));
        if (preset) {
          if (preset.type === 'webm' || preset.type === 'video') {
            displayContent = `<video src="${preset.value}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:cover; border-radius:8px; pointer-events:none; position:absolute; inset:0;"></video>`;
          } else {
            displayContent = `<span style="font-size:26px; line-height:1; display:flex; align-items:center; justify-content:center; width:100%; height:100%; position:absolute; inset:0;">${preset.value}</span>`;
          }
          tooltipText = `${formattedDate} | حال‌و‌هوا: ${preset.label} ${dayMood.note ? `\nیادداشت: ${dayMood.note}` : ''}`;
        }
      } else {
        displayContent = `<span class="map-dot" style="width:4px; height:4px; background:var(--border2)"></span>`;
        tooltipText = `${formattedDate} | وضعیتی ثبت نشده است`;
      }

      const dayCell = document.createElement('div');
      dayCell.className = 'map-day';
      dayCell.setAttribute('title', tooltipText.replace(/\n/g, ' - '));
      dayCell.style.cursor = 'pointer';
      
      dayCell.innerHTML = `
        <span class="map-day-num" style="z-index: 10; opacity: 0.85; font-weight: 700; text-shadow: 0px 0px 4px var(--bg), 0px 0px 4px #000; color: #fff;">${day}</span>
        <div style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; position:relative;">${displayContent}</div>
      `;

      dayCell.onclick = () => {
        if (tooltipDetail) {
          let noteHtml = dayMood && dayMood.note ? `<div style="margin-top:6px; padding:6px; background:var(--surface3); border-radius:6px; border:1px solid var(--border); color:var(--text); font-style:italic;">"${escHtml(dayMood.note)}"</div>` : '<span style="color:var(--muted)"> (خاطره‌ای نوشته نشده است)</span>';
          const presetName = dayMood && dayMood.mood ? (state.moodPresets.find(p => String(p.level) === String(dayMood.mood))?.label || '') : '';
          const emojiSym = dayMood && dayMood.mood ? (state.moodPresets.find(p => String(p.level) === String(dayMood.mood))?.value || '') : '';
          
          tooltipDetail.innerHTML = `
            <div style="width:100%; text-align:right;">
              <strong>📅 ${formattedDate}</strong>
              <div style="margin-top:4px;">وضعیت خلق‌وخو: <span style="color:var(--accent); font-weight:bold;">${presetName} ${emojiSym}</span></div>
              ${noteHtml}
            </div>
          `;
        }
      };

      map.appendChild(dayCell);
    }
  } 
  // ۲. ردیابی هیت‌مپ تیک‌های روتین انتخاب شده بر حسب تیک چک‌لیست
  else if (selectedValue.startsWith('rt_')) {
    const rtId = selectedValue.replace('rt_', '');
    const rt = state.routines.find(r => r.id === rtId);
    if (!rt) return;
    const cat = state.cats.find(c => c.id === rt.catId) || { name: 'روتین', color: 'var(--accent)' };

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${pad(mo)}-${pad(day)}`;
      const isCompleted = state.routineLogs[rt.id] && state.routineLogs[rt.id][dateStr];
      const formattedDate = fmtDateLabel(dateStr);
      const tooltipText = `${formattedDate} | روتین ${rt.title}: ${isCompleted ? 'انجام شد ✓' : 'انجام نشده'}`;

      const dayCell = document.createElement('div');
      dayCell.className = 'map-day';
      dayCell.setAttribute('title', tooltipText);
      dayCell.style.cursor = 'pointer';

      dayCell.innerHTML = `
        <span class="map-day-num">${day}</span>
        <span class="map-dot" style="width:${isCompleted ? 14 : 4}px; height:${isCompleted ? 14 : 4}px; background:${isCompleted ? cat.color : 'var(--surface3)'}; border-radius:50%; transition:all 0.2s;"></span>
      `;

      dayCell.onclick = () => {
        if (tooltipDetail) {
          tooltipDetail.innerHTML = `
            <div style="width:100%; text-align:right;">
              <strong>📅 ${formattedDate}</strong>
              <div style="margin-top:4px;">وضعیت روتین <span style="color:${cat.color}; font-weight:bold;">"${escHtml(rt.title)}"</span>: <b>${isCompleted ? 'کاملاً انجام شده و تیک خورده است ✓' : 'تیک زده نشده یا در این روز برنامه‌ریزی نبوده است'}</b></div>
            </div>
          `;
        }
      };
      map.appendChild(dayCell);
    }
  }
  // ۳. ردیابی هیت‌مپ تیک‌های عادت انتخاب شده بر حسب تیک هبیت ترکر
  else if (selectedValue.startsWith('hb_')) {
    const hbId = selectedValue.replace('hb_', '');
    const hb = state.habits.find(h => h.id === hbId);
    if (!hb) return;
    const accentColor = state.accentColor || '#7c5cfc';

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${pad(mo)}-${pad(day)}`;
      const isCompleted = state.habitLogs[hb.id] && state.habitLogs[hb.id][dateStr];
      const formattedDate = fmtDateLabel(dateStr);
      const tooltipText = `${formattedDate} | عادت ${hb.title}: ${isCompleted ? 'انجام شد ✓' : 'انجام نشده'}`;

      const dayCell = document.createElement('div');
      dayCell.className = 'map-day';
      dayCell.setAttribute('title', tooltipText);
      dayCell.style.cursor = 'pointer';

      dayCell.innerHTML = `
        <span class="map-day-num">${day}</span>
        <span class="map-dot" style="width:${isCompleted ? 14 : 4}px; height:${isCompleted ? 14 : 4}px; background:${isCompleted ? accentColor : 'var(--surface3)'}; border-radius: 50%; transition:all 0.2s;"></span>
      `;

      dayCell.onclick = () => {
        if (tooltipDetail) {
          tooltipDetail.innerHTML = `
            <div style="width:100%; text-align:right;">
              <strong>📅 ${formattedDate}</strong>
              <div style="margin-top:4px;">وضعیت عادت <span style="color:${accentColor}; font-weight:bold;">"${escHtml(hb.title)}"</span>: <b>${isCompleted ? 'کاملاً انجام شده و تیک خورده است ✓' : 'انجام نشده است'}</b></div>
            </div>
          `;
        }
      };
      map.appendChild(dayCell);
    }
  }
  // ۴. ردیابی هیت‌مپ مدت زمان مجموع فعالیت‌های موضوعات
  else {
    const cat=state.cats.find(c=>c.id===selectedValue);
    if (!cat) return;
    
    const sums={};
    state.events.forEach(e=>{
      if(!e.date || e.catId!==selectedValue || !e.date.startsWith(state.mapMonth)) return;
      const day=Number(e.date.slice(8,10));
      sums[day]=(sums[day]||0)+e.durMins;
    });

    const max=Math.max(0, ...Object.values(sums));

    for(let day=1; day<=daysInMonth; day++){
      const mins=sums[day]||0;
      const ratio=max ? mins/max : 0;
      const size=mins ? Math.round(6 + ratio*14) : 4;
      const dateStr = `${y}-${pad(mo)}-${pad(day)}`;
      
      const formattedDate = fmtDateLabel(dateStr);
      const formattedDur = fmtDur(mins);
      const tooltipText = `${formattedDate} | زمان: ${mins > 0 ? formattedDur : 'بدون فعالیت'}`;

      const dayCell = document.createElement('div');
      dayCell.className = 'map-day';
      dayCell.setAttribute('title', tooltipText);
      dayCell.style.cursor = 'pointer';
      dayCell.innerHTML = `
        <span class="map-day-num">${day}</span>
        <span class="map-dot" style="width:${size}px; height:${size}px; background:${mins?cat.color:'var(--surface3)'}"></span>
      `;

      dayCell.onclick = () => {
        if (tooltipDetail) {
          tooltipDetail.innerHTML = `
            <div style="width:100%; text-align:right;">
              <strong>📅 ${formattedDate}</strong>
              <div style="margin-top:4px;">مدت زمان فعالیت موضوع <span style="color:${cat.color}; font-weight:bold;">"${escHtml(cat.name)}"</span>: <b>${formattedDur}</b></div>
            </div>
          `;
        }
      };

      map.appendChild(dayCell);
    }
  }
}

export function renderHabitsAndTodos() {
  const todoList = document.getElementById('todo-list');
  const habitList = document.getElementById('habit-list');
  if(!todoList || !habitList) return;

  const todaysTodos = state.todos.filter(t => t.date === state.curDate || t.isDaily);
  todoList.innerHTML = todaysTodos.length ? '' : '<div style="color:var(--muted); font-size:12px;">کاری ثبت نشده</div>';
  todaysTodos.forEach(t => {
    const isChecked = t.isDaily ? (t.doneDates && t.doneDates[state.curDate]) : t.done;
    const activeClass = isChecked ? 'done' : '';
    const dailyActiveColor = t.isDaily ? 'color: var(--accent);' : '';
    const dailyButtonLabel = t.isDaily ? '🔁 روزانه (فعال)' : '🔁 تکرار روزانه';
    const dailyButtonClass = t.isDaily ? 'action-btn' : 'btn-del';

    todoList.innerHTML += `
      <div class="todo-item" style="gap: 8px; flex-wrap: wrap;">
        <div style="display:flex; align-items:center; flex:1;">
          <input type="checkbox" class="todo-checkbox" ${isChecked ? 'checked' : ''} onchange="toggleTodo('${t.id}')">
          <span class="todo-title ${activeClass}">${escHtml(t.title)}</span>
        </div>
        <div style="display:flex; gap:6px; align-items: center;">
          <button class="${dailyButtonClass}" style="font-size:10px; padding: 4px 8px; height: 28px; ${dailyActiveColor}" onclick="toggleRecurringTodo('${t.id}')" title="تکرار هر روزه این کار">${dailyButtonLabel}</button>
          <button class="btn-del" style="width:24px; height:24px;" onclick="deleteTodo('${t.id}')">✕</button>
        </div>
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
    const isActive = (String(todayMood.mood) === String(preset.level));
    const activeStyle = isActive 
      ? 'opacity: 1; transform: scale(1.15); filter: drop-shadow(0 0 10px var(--accent)); border: 2px solid var(--accent);' 
      : 'opacity: 0.45; border: 2px solid transparent;';
      
    if (preset.type === 'webm' || preset.type === 'video') {
      return `
        <div class="mood-emoji" data-mood="${preset.level}" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; width:44px; height:44px; border-radius:50%; overflow:hidden; transition: all 0.2s; ${activeStyle}">
          <video src="${preset.value}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:cover; pointer-events:none; border-radius:50%;"></video>
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
      save('planner_moods', state.moods); 
      saveCloud(); 
      renderMood();
      renderActivityMap();
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
        
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification("پومودورو 🍅", {
            body: `زمان کار پومودورو با موفقیت به پایان رسید! (${pomoLimit} دقیقه)`,
            icon: "./icons/icon-192.png"
          });
        }
        
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
      <div style="display:flex; gap:6px; justify-content:center; margin-top:6px; flex-wrap: wrap;">
        <button id="live-pause-btn" class="action-btn" style="background:var(--surface3); color:var(--text); border:1px solid var(--border2);">${isPaused ? '▶ ادامه فعالیت' : '⏸ پاز موقت'}</button>
        <button id="live-manual-pause-btn" class="action-btn" style="background:var(--surface3); color:var(--text); border:1px solid var(--border2);">⏳ ثبت وقفه دستی</button>
        <button id="live-cancel-btn" class="action-btn" style="background:#f8717122; border:1px solid rgba(248,113,113,0.3); color:#fecaca;">🚫 لغو و انصراف</button>
      </div>
    `;

    document.getElementById('live-pause-btn').onclick = (e) => {
      e.stopPropagation();
      toggleLivePause();
    };

    document.getElementById('live-manual-pause-btn').onclick = (e) => {
      e.stopPropagation();
      window.addManualPause();
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
    const cat = state.cats.find(c => c.id === rt.catId) || {name: 'حذف شده', color: '#999', emoji: '📅'};
    const catEmoji = cat.emoji || '📅';
    const isUrl = catEmoji.startsWith('http');
    
    const catEmojiHtml = isUrl
      ? `<video src="${catEmoji}" autoplay loop muted playsinline style="width:16px; height:16px; object-fit:cover; border-radius:50%; vertical-align:middle; display:inline-block; margin-inline-end:4px;"></video>`
      : `<span style="margin-inline-end:4px;">${catEmoji}</span>`;

    const daysStr = rt.days.map(d => daysName[d]).join('، ');
    
    list.innerHTML += `
      <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surface2); border:1px solid var(--border); border-right:3px solid ${cat.color}; border-radius:8px; padding:6px 10px;">
        <div>
          <div style="font-size:12px; font-weight:700; display:flex; align-items:center; gap:4px;">${escHtml(rt.title)} (${catEmojiHtml} ${cat.name})</div>
          <div style="font-size:10px; color:var(--muted)">ساعت ${rt.startTime} تا ${rt.endTime} | روزهای: ${daysStr}</div>
        </div>
        <button class="btn-del" style="width:24px; height:24px; font-size:11px;" onclick="delRoutine('${rt.id}')">✕</button>
      </div>`;
  });
}

// ساخت ویرایشگر پیشرفته و کاملاً شخصی‌سازی شده اموجی‌ها با مخفی‌سازی کامل لینک متنی و دکمه اضافه و حذف
export function renderCustomEmojisEditor() {
  const container = document.getElementById('custom-emojis-container');
  if (!container) return;
  
  container.innerHTML = state.moodPresets.map((preset, idx) => {
    let previewHtml = '';
    if (preset.type === 'webm') {
      previewHtml = `<video src="${preset.value}" autoplay loop muted playsinline style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid var(--border);"></video>`;
    } else {
      previewHtml = `<span style="font-size:24px; display:inline-block; width:32px; text-align:center;">${preset.value}</span>`;
    }

    const textInputStyle = preset.type === 'webm' ? 'display: none;' : '';

    return `
      <div style="display:flex; align-items:center; gap:8px; background:var(--surface2); padding:10px; border-radius:8px; border:1px solid var(--border); flex-wrap:wrap;">
        <input type="text" class="emoji-label-input" data-idx="${idx}" value="${escHtml(preset.label)}" style="width:110px; padding:6px; font-size:12px; height:32px; border-radius:6px;" placeholder="عنوان مثلاً: عالی">
        <select class="emoji-type-select" data-idx="${idx}" style="width:100px; padding:6px; font-size:12px; height:32px; border-radius:6px; background:var(--surface); color:var(--text); border:1px solid var(--border2);" onchange="onEmojiTypeChange(this, ${idx})">
          <option value="text" ${preset.type === 'text' ? 'selected' : ''}>شکلک متنی</option>
          <option value="webm" ${preset.type === 'webm' ? 'selected' : ''}>انیمیشن (WebM)</option>
        </select>
        
        <!-- پیش‌نمایش زنده شکلک -->
        <div style="display:flex; align-items:center; justify-content:center; width:38px; height:32px;">
          ${previewHtml}
        </div>

        <!-- کادر متنی که فقط در حالت شکلک متنی نمایش داده می‌شود -->
        <input type="text" class="emoji-value-input" data-idx="${idx}" id="preset-val-input-${idx}" value="${escHtml(preset.value)}" style="width:60px; padding:6px; font-size:12px; height:32px; border-radius:6px; ${textInputStyle}" placeholder="😊">
        
        <button class="action-btn" type="button" onclick="openEmojiGallery(${idx})" style="padding: 0 10px; height:32px; font-size:11px; background:var(--surface3); border:1px solid var(--border2); color:var(--text); ${preset.type === 'text' ? 'display:none;' : ''}">🖼️ گالری</button>
        <button class="btn-del" type="button" onclick="deleteMoodPreset(${idx})" style="width:32px; height:32px; font-size:12px; flex-shrink:0;">✕</button>
      </div>`;
  }).join('');
}

window.onEmojiTypeChange = function(selectEl, idx) {
  state.moodPresets[idx].type = selectEl.value;
  if (selectEl.value === 'webm' && !state.moodPresets[idx].value.startsWith('http')) {
    state.moodPresets[idx].value = 'https://ipureiqnhgatigewbggj.supabase.co/storage/v1/object/public/emojis/001.webm'; 
  } else if (selectEl.value === 'text' && state.moodPresets[idx].value.startsWith('http')) {
    state.moodPresets[idx].value = '😊'; 
  }
  renderCustomEmojisEditor();
};

export function renderGoals() {
  const list = document.getElementById('goals-list');
  if (!list) return;
  list.innerHTML = '';

  const currentMonthGoals = state.goals.filter(g => g.month === state.mapMonth);

  if (currentMonthGoals.length === 0) {
    list.innerHTML = `<div style="color:var(--muted); font-size:12px; text-align:center; padding: 10px 0;">هدفی برای ماه جاری (${state.mapMonth}) تعریف نشده است.</div>`;
    return;
  }

  currentMonthGoals.forEach(g => {
    const cat = state.cats.find(c => c.id === g.catId) || {name: 'حذف شده', color: '#999', emoji: '📅'};
    const catEmoji = cat.emoji || '📅';
    const isUrl = catEmoji.startsWith('http');
    
    const catEmojiHtml = isUrl
      ? `<video src="${catEmoji}" autoplay loop muted playsinline style="width:16px; height:16px; object-fit:cover; border-radius:50%; vertical-align:middle; display:inline-block; margin-inline-end:4px;"></video>`
      : `<span style="margin-inline-end:4px;">${catEmoji}</span>`;

    const completedMins = state.events
      .filter(e => e.catId === g.catId && e.date.startsWith(g.month))
      .reduce((sum, e) => sum + e.durMins, 0);

    const pct = g.targetMins > 0 ? Math.min(100, Math.round((completedMins / g.targetMins) * 100)) : 0;

    const itemDiv = document.createElement('div');
    itemDiv.style.cssText = `
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 8px;
      border-right: 4px solid ${cat.color};
    `;

    itemDiv.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
          <span style="font-size:13px; font-weight:700; color:var(--text);">${escHtml(g.title || cat.name)}</span>
          <span style="font-size:10px; background:${cat.color}15; color:${cat.color}; padding:2px 6px; border-radius:4px; font-weight:bold; display:inline-flex; align-items:center; gap:4px;">
            ${catEmojiHtml} ${escHtml(cat.name)}
          </span>
        </div>
        <button class="btn-del" style="width:24px; height:24px; font-size:11px;" onclick="deleteGoal('${g.id}')">✕</button>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--muted); margin-bottom:4px;">
        <span>پیشرفت: <b>${fmtDur(completedMins)}</b> از <b>${fmtDur(g.targetMins)}</b></span>
        <span>${pct}%</span>
      </div>
      <div class="prog-bg" style="height:6px; background:var(--surface3);">
        <div class="prog-fill" style="background:${cat.color}; width:${pct}%;"></div>
      </div>
    `;
    list.appendChild(itemDiv);
  });
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
  renderTodayRoutines(); 
  renderGoals(); 
  updateLiveButton();
  syncSettingsForm();
  renderCustomEmojisEditor(); 
}
