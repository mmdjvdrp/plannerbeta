// js/render.js
import { state, save, saveCloud } from "./storage.js";
import { fmtDateLabel, fmtTime, fmtDur, escHtml, getWeekDates, pad, getNow, parseTime } from "./helpers.js";

export function applyTheme(){
  document.body.dataset.theme = state.theme;
  const sel = document.getElementById('theme-select');
  if(sel) sel.value = state.theme;
}

function getCat(id){ 
  return state.cats.find(c => c.id === id) || {name:'موضوع حذف‌شده', color:'#9ca3af'}; 
}

export function renderCats(){
  const sel=document.getElementById('cat-select');
  const mapSel=document.getElementById('map-cat-select');
  const manager=document.getElementById('cat-manager');
  if(!sel || !mapSel || !manager) return;

  const current=sel.value;
  const mapCurrent=mapSel.value;
  sel.innerHTML='';
  mapSel.innerHTML='';
  manager.innerHTML='';
  if(!state.cats.length){
    const o=document.createElement('option');
    o.value=''; o.textContent='اول موضوع بسازید';
    o.disabled=true; o.selected=true;
    sel.appendChild(o);
    const mo=o.cloneNode(true);
    mapSel.appendChild(mo);
    manager.innerHTML='<div class="cat-empty">هنوز موضوعی ندارید.</div>';
    return;
  }
  state.cats.forEach(c=>{
    const o=document.createElement('option');
    o.value=c.id; o.textContent=c.name;
    sel.appendChild(o);
    mapSel.appendChild(o.cloneNode(true));

    const item=document.createElement('div');
    item.className='cat-item';
    item.style.setProperty('--cat-color', c.color);
    item.innerHTML=`
      <span class="cat-swatch"></span>
      <span class="cat-name">${escHtml(c.name)}</span>
      <input class="cat-color-edit" type="color" value="${c.color}" aria-label="تغییر رنگ ${escHtml(c.name)}">
      <button class="cat-delete" type="button" title="حذف موضوع">×</button>
    `;
    const colorInput=item.querySelector('.cat-color-edit');
    colorInput.oninput=()=>{
      c.color=colorInput.value;
      item.style.setProperty('--cat-color', c.color);
      saveCloud();
      render();
    };
    item.querySelector('.cat-delete').onclick=()=> window.delCat(c.id);
    manager.appendChild(item);
  });
  if(current && state.cats.some(c=>c.id===current)) sel.value=current;
  if(mapCurrent && state.cats.some(c=>c.id===mapCurrent)) mapSel.value=mapCurrent;
  else mapSel.value=state.cats[0].id;
}

export function renderWeeklyTimetable() {
  const tl = document.getElementById('timeline');
  const weekDates = getWeekDates(state.curDate);
  if (!tl) return;
  
  let html = `<div class="timetable-grid" style="
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 8px;
    margin-top: 15px;
  ">`;
  
  weekDates.forEach(day => {
    const dayEvs = state.events.filter(e => e.date === day.date);
    const catGroups = {};
    dayEvs.forEach(ev => {
      catGroups[ev.catId] = (catGroups[ev.catId] || 0) + ev.durMins;
    });

    const isCurrent = day.date === state.curDate;
    const borderStyle = isCurrent ? '2px solid var(--accent)' : '1px solid var(--border)';
    
    const [y, m, dNum] = day.date.split('-').map(Number);
    const dt = new Date(y, m - 1, dNum);
    const jsDay = dt.getDay();
    const irDay = (jsDay + 1) % 7;
    
    const hasRoutine = state.routines.some(rt => rt.days.includes(irDay));
    
    let bgStyle = isCurrent ? 'var(--surface2)' : 'var(--surface)';
    if (hasRoutine) {
      bgStyle = isCurrent 
        ? 'repeating-linear-gradient(-45deg, var(--surface2), var(--surface2) 10px, var(--surface3) 10px, var(--surface3) 20px)'
        : 'repeating-linear-gradient(-45deg, var(--surface), var(--surface) 10px, var(--surface2) 10px, var(--surface2) 20px)';
    }
    
    html += `
      <div class="timetable-day-col" style="
        border: ${borderStyle};
        background: ${bgStyle};
        border-radius: 8px;
        padding: 8px;
        min-height: 140px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      ">
        <div style="
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          color: ${isCurrent ? 'var(--accent2)' : 'var(--muted)'};
          border-bottom: 1px solid var(--border2);
          padding-bottom: 4px;
          margin-bottom: 4px;
        ">
          ${day.name} (${day.dayNum})
        </div>
    `;
    
    const catKeys = Object.keys(catGroups);
    if (catKeys.length === 0) {
      html += `<div style="font-size:10px; color:var(--muted); text-align:center; margin-top:20px;">خالی</div>`;
    } else {
      catKeys.forEach(catId => {
        const cat = getCat(catId);
        const mins = catGroups[catId];
        html += `
          <div style="
            background: ${cat.color}18;
            border-right: 3px solid ${cat.color};
            border-radius: 4px;
            padding: 4px 6px;
            font-size: 11px;
            cursor: pointer;
          " onclick="navigateToDay('${day.date}')" title="${cat.name} (کل این روز: ${fmtDur(mins)})">
            <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${cat.name}</div>
            <div style="font-size:9px; color:var(--muted);">${fmtDur(mins)}</div>
          </div>
        `;
      });
    }
    html += `</div>`;
  });
  
  html += `</div>`;
  tl.innerHTML = html;
}

export function renderTimeline(){
  const tl=document.getElementById('timeline');
  const em=document.getElementById('empty-msg');
  if(!tl || !em) return;

  document.getElementById('tl-date').textContent = fmtDateLabel(state.curDate);

  if (state.activeView === 'weekly') {
    em.style.display = 'none';
    tl.style.display = 'block';
    renderWeeklyTimetable();
    return;
  }

  const dayEvents = state.events.filter(e => e.date === state.curDate);

  if(!dayEvents.length){ em.style.display='block'; tl.style.display='none'; return; }
  em.style.display='none'; tl.style.display='block';
  tl.innerHTML='';

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
    const cat = getCat(catId);
    const grp = groups[catId].sort((a,b) => a.sMins - b.sMins);
    const totalDur = grp.reduce((sum, e) => sum + e.durMins, 0);

    const details = document.createElement('details');
    details.style.cssText = `
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-bottom: 10px;
      background: var(--surface);
      overflow: hidden;
      box-shadow: 0 2px 6px rgba(0,0,0,0.02);
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
          <span style="width:10px; height:10px; border-radius:50%; background:${cat.color}; box-shadow:0 0 8px ${cat.color}; display:inline-block;"></span>
          <div>
            <div style="font-size: 14px; font-weight: 700; color: var(--text);">${escHtml(cat.name)}</div>
            <div style="font-size: 11px; color: var(--muted); margin-top:2px;">
              ${grp.length} نوبت فعالیت &mdash; مجموعاً: <b>${fmtDur(totalDur)}</b>
            </div>
          </div>
        </div>
        <span style="font-size: 11px; color: var(--muted); transition: transform 0.2s;">▼</span>
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
                <div style="font-size:12px; font-weight:700;">${escHtml(ev.title)}</div>
                <div style="font-size:10px; color:var(--muted); margin-top:2px; font-family: monospace;">
                  ${fmtTime(ev.sMins)} تا ${fmtTime(ev.eMins)} (${fmtDur(ev.durMins)}) ${pauseText}
                </div>
              </div>
              <div style="display:flex; gap:4px">
                <button class="btn-del" style="width:24px; height:24px; font-size:11px; background:var(--surface2);" onclick="editEv('${ev.id}')">✎</button>
                <button class="btn-del" style="width:24px; height:24px; font-size:11px;" onclick="delEv('${ev.id}')">✕</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    tl.appendChild(details);
  });
}

export function renderReport(){
  const grid = document.getElementById('report-grid');
  if (!grid) return;

  const val = document.getElementById('report-days').value.trim();
  const err = document.getElementById('report-err');

  if (/[۰-۹]/.test(val) || /[^\d]/.test(val) || val === "" || parseInt(val, 10) <= 0) {
    if (err) err.style.display = 'block';
    return;
  }

  if (err) err.style.display = 'none';

  const daysRange = parseInt(val, 10);
  const [y,mo,d]=state.curDate.split('-').map(Number);
  const ref=new Date(y,mo-1,d);
  const from=new Date(ref);
  from.setDate(from.getDate() - (daysRange - 1));

  const week = state.events.filter(e => {
    const [ey,em,ed] = e.date.split('-').map(Number);
    const dt = new Date(ey,em-1,ed);
    return dt >= from && dt <= ref;
  });

  const sums={}; let total=0;
  week.forEach(e=>{ sums[e.catId]=(sums[e.catId]||0)+e.durMins; total+=e.durMins; });

  grid.innerHTML='';

  const reportCats=[...state.cats];
  Object.keys(sums).forEach(catId=>{
    if(!reportCats.some(c=>c.id===catId)){
      reportCats.push({id:catId, ...getCat(catId)});
    }
  });

  reportCats.forEach(cat=>{
    const mins=sums[cat.id]||0;
    if(!mins) return;
    const pct=total>0?Math.round((mins/total)*100):0;
    const h=Math.floor(mins/60), m=mins%60;
    const durStr = h ? (h + 'h' + (m ? ' ' + m + 'm' : '')) : (m + 'm');
    const el=document.createElement('div');
    el.className='report-item';
    el.innerHTML=`
      <div class="report-header">
        <span style="color:${cat.color}">${escHtml(cat.name)}</span>
        <span>${durStr} (${pct}٪)</span>
      </div>
      <div class="prog-bg">
        <div class="prog-fill" style="background:${cat.color};width:${pct}%"></div>
      </div>
    `;
    grid.appendChild(el);
  });

  const th=Math.floor(total/60), tm=total%60;
  const tStr=th?th+'h'+(tm?' '+tm+'m':''):tm+'m';
  document.getElementById('total-line').innerHTML=`مجموع گزارش: <span>${tStr}</span>`;
}

// فیکس شده: چک کردن نهایی عدم وجود داده خراب یا خالی
export function renderActivityMap(){
  const map=document.getElementById('activity-map');
  const summary=document.getElementById('map-summary');
  const sel=document.getElementById('map-cat-select');
  const label=document.getElementById('map-month-label');
  if(!map || !summary || !sel || !label) return;

  const [y,mo]=state.mapMonth.split('-').map(Number);
  const monthNames=['ژانویه','فوریه','مارس','آوریل','مه','ژوئن','ژوئیه','اوت','سپتامبر','اکتبر','نوامبر','دسامبر'];
  label.textContent=monthNames[mo-1]+' '+y;
  map.innerHTML='';

  ['ش','ی','د','س','چ','پ','ج'].forEach(day=>{
    const el=document.createElement('div');
    el.className='map-weekday';
    el.textContent=day;
    map.appendChild(el);
  });

  if(!state.cats.length || !sel.value){
    map.innerHTML='<div class="map-empty" style="grid-column:1/-1">برای دیدن نقشه، اول یک موضوع بسازید.</div>';
    summary.textContent='';
    return;
  }

  const cat=getCat(sel.value);
  const daysInMonth=new Date(y, mo, 0).getDate();
  const firstDay=new Date(y, mo-1, 1).getDay();
  const startOffset=(firstDay+1)%7; 
  const sums={};
  let total=0;

  state.events.forEach(e=>{
    // فیکس شده: بررسی عدم وجود فیلد خالی یا خراب تاریخ به عنوان سوپاپ اطمینان
    if(!e.date || e.catId!==sel.value || !e.date.startsWith(state.mapMonth)) return;
    const day=Number(e.date.slice(8,10));
    sums[day]=(sums[day]||0)+e.durMins;
    total+=e.durMins;
  });

  const max=Math.max(0, ...Object.values(sums));
  for(let i=0; i<startOffset; i++){
    const blank=document.createElement('div');
    blank.className='map-day is-empty';
    map.appendChild(blank);
  }

  for(let day=1; day<=daysInMonth; day++){
    const mins=sums[day]||0;
    const ratio=max ? mins/max : 0;
    const fill=Math.round(ratio*100);
    const size=mins ? Math.round(9 + ratio*23) : 5;
    const strength=mins ? Math.round(35 + ratio*65) : 18;
    const glow=Math.round(ratio*55);
    const dateStr=state.mapMonth+'-'+pad(day);
    const el=document.createElement('div');
    el.className='map-day';
    el.style.setProperty('--dot-color', cat.color);
    el.style.setProperty('--dot-size', size+'px');
    el.style.setProperty('--dot-strength', strength+'%');
    el.style.setProperty('--dot-glow', glow+'%');
    el.title=mins ? `${dateStr} - ${cat.name}: ${fmtDur(mins)} (${fill}٪ از بیشترین روز ماه)` : `${dateStr} - ${cat.name}: بدون ثبت`;
    el.innerHTML=`
      <span class="map-day-num">${day}</span>
      <span class="map-dot"></span>
    `;
    map.appendChild(el);
  }

  summary.innerHTML=total
    ? `مجموع این ماه برای <span>${escHtml(cat.name)}</span>: <span>${fmtDur(total)}</span>`
    : `برای <span>${escHtml(cat.name)}</span> در این ماه چیزی ثبت نشده.`;
}

export function renderRoutines() {
  const list = document.getElementById('rt-list');
  if (!list) return;
  list.innerHTML = '';
  
  if (state.routines.length === 0) {
    list.innerHTML = `<div style="font-size:11px; color:var(--muted); text-align:center;">هیچ روتینی تعریف نشده است</div>`;
    return;
  }
  
  const daysName = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  
  state.routines.forEach(rt => {
    const cat = getCat(rt.catId);
    const daysStr = rt.days.map(d => daysName[d]).join('، ');
    
    const el = document.createElement('div');
    el.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-right: 3px solid ${cat.color};
      border-radius: 8px;
      padding: 6px 10px;
    `;
    
    el.innerHTML = `
      <div>
        <div style="font-size:12px; font-weight:700;">${escHtml(rt.title)} (${cat.name})</div>
        <div style="font-size:10px; color:var(--muted)">
          ساعت ${rt.startTime} تا ${rt.endTime} | روزهای: ${daysStr}
        </div>
      </div>
      <button class="btn-del" style="width:24px; height:24px; font-size:11px;" onclick="delRoutine('${rt.id}')" title="حذف روتین">✕</button>
    `;
    list.appendChild(el);
  });
}

export function updateLiveButton(){
  const btn=document.getElementById('live-btn');
  const status=document.getElementById('live-status');
  if(!btn || !status) return;
  if(state.liveSession){
    btn.classList.add('is-running');
    btn.textContent='پایان و ثبت فعالیت';
    const cat=getCat(state.liveSession.catId);
    
    const isPaused = state.liveSession.pauseStartMins !== null && state.liveSession.pauseStartMins !== undefined;
    const pauseMinsTotal = state.liveSession.pauseMins || 0;
    
    status.innerHTML = `
      <div style="margin-bottom: 4px;">در حال ثبت: ${state.liveSession.title}، از ${fmtTime(state.liveSession.sMins)} (${cat.name})</div>
      ${pauseMinsTotal ? `<div style="color:var(--accent2); font-size:11px;">کل زمان پاز شده: ${pauseMinsTotal} دقیقه</div>` : ''}
      ${isPaused ? `<div style="color:#f87171; font-size:11px; margin-bottom:4px;">⏳ اکنون در حالت پاز موقت</div>` : ''}
      <button id="live-pause-btn" style="
        padding: 4px 10px;
        background: var(--surface3);
        border: 1px solid var(--border2);
        color: var(--text);
        border-radius: 6px;
        font-size: 11px;
        cursor: pointer;
        font-family: inherit;
      ">${isPaused ? '▶ ادامه فعالیت' : '⏸ پاز موقت'}</button>
    `;
    
    document.getElementById('live-pause-btn').onclick = (e) => {
      e.stopPropagation();
      toggleLivePause();
    };
    return;
  }
  btn.classList.remove('is-running');
  btn.textContent='شروع / پایان با ساعت سیستم';
  status.textContent='';
}

// فیکس شده: اضافه شدن متد ذخیره آنی پس از تغییر وضعیت پاز لایو در حافظه محلی
export function toggleLivePause() {
  if (!state.liveSession) return;
  const nowStr = getNow();
  const nowMins = parseTime(nowStr);

  if (state.liveSession.pauseStartMins === null || state.liveSession.pauseStartMins === undefined) {
    state.liveSession.pauseStartMins = nowMins;
  } else {
    let diff = nowMins - state.liveSession.pauseStartMins;
    if (diff < 0) diff += 24 * 60;
    state.liveSession.pauseMins = (state.liveSession.pauseMins || 0) + diff;
    state.liveSession.pauseStartMins = null;
  }
  save('planner_live', state.liveSession); // ذخیره همزمان پاز در لوکال‌استوریج محلی
  saveCloud();
  updateLiveButton();
}

export function render(){
  document.getElementById('date-label').textContent = fmtDateLabel(state.curDate);
  renderCats();
  renderTimeline();
  renderReport();
  renderActivityMap();
  renderRoutines();
  updateLiveButton();
}
