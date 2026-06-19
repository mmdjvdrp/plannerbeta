// js/planner.js
import { supabase } from "./supabase.js";

// متغیرهای وضعیت برنامه
let events = load('planner_ev', []);
let cats   = load('planner_cats', []);
let routines = load('planner_routines', []); // روتین‌های ثابت
let curDate = new Date().toISOString().split('T')[0];
let mapMonth = curDate.slice(0,7);
let liveSession = load('planner_live', null);
let theme = load('planner_theme', 'dark');
let editingEventId = null;
let activeView = 'daily'; // سوییچ پیش‌فرض روزانه یا هفتگی
let selectedRtDays = []; // روزهای انتخاب شده روتین جدید

async function saveCloud(){
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;
    
    const { error } = await supabase
      .from("planner_data")
      .upsert(
        {
          user_id: user.id,
          data: { events, cats, liveSession, theme, routines }
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error("خطا در ذخیره‌سازی ابری:", error.message);
    }
  } catch (err) {
    console.error("خطای غیرمنتظره در ذخیره ابری:", err);
  }
}

async function loadCloud(){
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    const { data, error } = await supabase
      .from("planner_data")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();

    if(data && data.data){
      const cloudData = data.data;
      events      = cloudData.events      || [];
      cats        = cloudData.cats        || [];
      theme       = cloudData.theme       || "dark";
      liveSession = cloudData.liveSession || null;
      routines    = cloudData.routines    || [];

      save('planner_ev',    events);
      save('planner_cats',  cats);
      save('planner_live',  liveSession);
      save('planner_theme', theme);
      save('planner_routines', routines);
    }
  } catch (err) {
    console.error("خطا در بارگذاری ابری اطلاعات:", err);
  }
}

function load(k, def){
  try{
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : def;
  }catch{
    return def;
  }
}

function save(k, v){
  try{
    localStorage.setItem(k, JSON.stringify(v));
  }catch{}
}

function applyTheme(){
  document.body.dataset.theme=theme;
  const sel=document.getElementById('theme-select');
  if(sel) sel.value=theme;
}

function getCat(id){ return cats.find(c=>c.id===id) || {name:'موضوع حذف‌شده', color:'#9ca3af'}; }

function getNow(){
  const n=new Date();
  return pad(n.getHours())+':'+pad(n.getMinutes());
}
function pad(n){ return String(n).padStart(2,'0'); }

function parseTime(s){
  s=(s||'').trim();
  if(/^\d{4}$/.test(s)) s=s.slice(0,2)+':'+s.slice(2);
  const m=s.match(/^(\d{1,2}):(\d{2})$/);
  if(!m) return null;
  const h=+m[1], mn=+m[2];
  if(h>23||mn>59) return null;
  return h*60+mn;
}

function fmtTime(mins){
  return pad(Math.floor(mins/60))+':'+pad(mins%60);
}

function fmtDur(mins){
  const h=Math.floor(mins/60), m=mins%60;
  if(h===0) return m+'m';
  if(m===0) return h+'h';
  return h+'h '+m+'m';
}

function fmtDateLabel(d){
  const [y,mo,day]=d.split('-').map(Number);
  const dt=new Date(y, mo-1, day);
  const days=['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنج‌شنبه','جمعه','شنبه'];
  const months=['ژانویه','فوریه','مارس','آوریل','مه','ژوئن','ژوئیه','اوت','سپتامبر','اکتبر','نوامبر','دسامبر'];
  return days[dt.getDay()]+' '+day+' '+months[mo-1]+' '+y;
}

function shiftDay(n){
  const [y,mo,d]=curDate.split('-').map(Number);
  const dt=new Date(y,mo-1,d);
  dt.setDate(dt.getDate()+n);
  curDate=dt.getFullYear()+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate());
  render();
}

function renderCats(){
  const sel=document.getElementById('cat-select');
  const mapSel=document.getElementById('map-cat-select');
  const manager=document.getElementById('cat-manager');
  if(!sel || !mapSel || !manager) return;

  const current=sel.value;
  const mapCurrent=mapSel.value;
  sel.innerHTML='';
  mapSel.innerHTML='';
  manager.innerHTML='';
  if(!cats.length){
    const o=document.createElement('option');
    o.value='';
    o.textContent='اول موضوع بسازید';
    o.disabled=true;
    o.selected=true;
    sel.appendChild(o);
    const mo=o.cloneNode(true);
    mapSel.appendChild(mo);
    manager.innerHTML='<div class="cat-empty">هنوز موضوعی ندارید.</div>';
    return;
  }
  cats.forEach(c=>{
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
    item.querySelector('.cat-delete').onclick=()=>delCat(c.id);
    manager.appendChild(item);
  });
  if(current && cats.some(c=>c.id===current)) sel.value=current;
  if(mapCurrent && cats.some(c=>c.id===mapCurrent)) mapSel.value=mapCurrent;
  else mapSel.value=cats[0].id;
}

// محاسبه تاریخ روزهای هفته جاری شمسی (شنبه تا جمعه)
function getWeekDates(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const jsDay = dt.getDay(); // 0: Sun, 6: Sat
  const irDay = (jsDay + 1) % 7; // نگاشت شنبه به 0 تا جمعه به 6
  
  const sat = new Date(dt);
  sat.setDate(dt.getDate() - irDay);
  
  const weekDates = [];
  const daysName = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
  for (let i = 0; i < 7; i++) {
    const dTmp = new Date(sat);
    dTmp.setDate(sat.getDate() + i);
    const yStr = dTmp.getFullYear();
    const mStr = String(dTmp.getMonth() + 1).padStart(2, '0');
    const dStr = String(dTmp.getDate()).padStart(2, '0');
    weekDates.push({
      name: daysName[i],
      date: `${yStr}-${mStr}-${dStr}`,
      dayNum: dTmp.getDate()
    });
  }
  return weekDates;
}

/// رندر تایم‌لاین به صورت برنامه هفتگی مدارس (جدول شنبه تا جمعه) همراه با هاشور برای روزهای دارای روتین
function renderWeeklyTimetable() {
  const tl = document.getElementById('timeline');
  const weekDates = getWeekDates(curDate);
  
  let html = `<div class="timetable-grid" style="
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 8px;
    margin-top: 15px;
  ">`;
  
  weekDates.forEach(day => {
    // گروه‌بندی هفتگی بر اساس دسته‌بندی موضوعی
    const dayEvs = events.filter(e => e.date === day.date);
    const catGroups = {};
    dayEvs.forEach(ev => {
      catGroups[ev.catId] = (catGroups[ev.catId] || 0) + ev.durMins;
    });

    const isCurrent = day.date === curDate;
    const borderStyle = isCurrent ? '2px solid var(--accent)' : '1px solid var(--border)';
    
    // محاسبه شاخص روز برای بررسی داشتن روتین
    const [y, m, dNum] = day.date.split('-').map(Number);
    const dt = new Date(y, m - 1, dNum);
    const jsDay = dt.getDay(); // 0: Sun, 6: Sat
    const irDay = (jsDay + 1) % 7; // نگاشت شنبه به 0
    
    const hasRoutine = routines.some(rt => rt.days.includes(irDay));
    
    // اعمال هاله هاشوری (repeating-linear-gradient) روی روزهای دارای روتین فعال
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
          " onclick="curDate='${day.date}'; activeView='daily'; document.getElementById('view-daily-btn').click();" title="${cat.name} (کل این روز: ${fmtDur(mins)})">
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
          " onclick="curDate='${day.date}'; activeView='daily'; document.getElementById('view-daily-btn').click();" title="${cat.name} (کل این روز: ${fmtDur(mins)})">
            <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${cat.name}</div>
            <div style="font-size:9px; color:var(--muted);">${fmtDur(mins)}</div>
          </div>
        `;
      });
    }
    html += `</div>`;
  ;
  
  html += `</div>`;
  tl.innerHTML = html;
}

// رندر آکاردئونی و پویای تایم‌لاین روزانه با ادغام رکوردهای تکراری یک موضوع
function renderTimeline(){
  const tl=document.getElementById('timeline');
  const em=document.getElementById('empty-msg');
  if(!tl || !em) return;

  document.getElementById('tl-date').textContent=fmtDateLabel(curDate);

  if (activeView === 'weekly') {
    em.style.display = 'none';
    tl.style.display = 'block';
    renderWeeklyTimetable();
    return;
  }

  const dayEvents = events.filter(e => e.date === curDate);

  if(!dayEvents.length){ em.style.display='block'; tl.style.display='none'; return; }
  em.style.display='none'; tl.style.display='block';
  tl.innerHTML='';

  // ۱. گروه‌بندی رویدادها بر اساس شناسه دسته‌بندی (catId)
  const groups = {};
  dayEvents.forEach(ev => {
    if(!groups[ev.catId]) groups[ev.catId] = [];
    groups[ev.catId].push(ev);
  });

  // مرتب‌سازی دسته‌ها بر اساس زودترین زمان شروع فعالیت درون آن گروه
  const sortedCatIds = Object.keys(groups).sort((a, b) => {
    const minA = Math.min(...groups[a].map(e => e.sMins));
    const minB = Math.min(...groups[b].map(e => e.sMins));
    return minA - minB;
  });

  // ۲. رندر هر گروه به صورت یک کامپوننت آکاردئونی ( details / summary ) بومی مرورگر
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

function renderReport(){
  const grid = document.getElementById('report-grid');
  if (!grid) return;

  const val = document.getElementById('report-days').value.trim();
  const err = document.getElementById('report-err');

  // اعتبارسنجی ورودی بازه روزانه (فقط اعداد انگلیسی مجاز است)
  if (/[۰-۹]/.test(val) || /[^\d]/.test(val) || val === "" || parseInt(val, 10) <= 0) {
    if (err) err.style.display = 'block';
    return; // متوقف کردن رندر گزارش در صورت خطای اعتبارسنجی
  }

  if (err) err.style.display = 'none';

  const daysRange = parseInt(val, 10);
  const [y,mo,d]=curDate.split('-').map(Number);
  const ref=new Date(y,mo-1,d);
  const from=new Date(ref);
  from.setDate(from.getDate() - (daysRange - 1));

  const week = events.filter(e => {
    const [ey,em,ed] = e.date.split('-').map(Number);
    const dt = new Date(ey,em-1,ed);
    return dt >= from && dt <= ref;
  });

  const sums={}; let total=0;
  week.forEach(e=>{ sums[e.catId]=(sums[e.catId]||0)+e.durMins; total+=e.durMins; });

  grid.innerHTML='';

  const reportCats=[...cats];
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

function shiftMapMonth(n){
  const [y,mo]=mapMonth.split('-').map(Number);
  const dt=new Date(y, mo-1+n, 1);
  mapMonth=dt.getFullYear()+'-'+pad(dt.getMonth()+1);
  renderActivityMap();
}

function renderActivityMap(){
  const map=document.getElementById('activity-map');
  const summary=document.getElementById('map-summary');
  const sel=document.getElementById('map-cat-select');
  const label=document.getElementById('map-month-label');
  if(!map || !summary || !sel || !label) return;

  const [y,mo]=mapMonth.split('-').map(Number);
  const monthNames=['ژانویه','فوریه','مارس','آوریل','مه','ژوئن','ژوئیه','اوت','سپتامبر','اکتبر','نوامبر','دسامبر'];
  label.textContent=monthNames[mo-1]+' '+y;
  map.innerHTML='';

  ['ش','ی','د','س','چ','پ','ج'].forEach(day=>{
    const el=document.createElement('div');
    el.className='map-weekday';
    el.textContent=day;
    map.appendChild(el);
  });

  if(!cats.length || !sel.value){
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

  events.forEach(e=>{
    if(e.catId!==sel.value || !e.date.startsWith(mapMonth)) return;
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
    const dateStr=mapMonth+'-'+pad(day);
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

function render(){
  document.getElementById('date-label').textContent=fmtDateLabel(curDate);
  renderTimeline();
  renderReport();
  renderActivityMap();
  renderRoutines();
}

function escHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

window.delEv=function(id){
  if(!confirm('این فعالیت حذف شود؟')) return;
  events=events.filter(e=>e.id!==id);
  saveCloud();
  render();
};

window.delCat=function(id){
  const cat=getCat(id);
  if(!confirm(`موضوع «${cat.name}» حذف شود؟ فعالیت‌های قبلی پاک نمی‌شوند.`)) return;
  cats=cats.filter(c=>c.id!==id);
  saveCloud();
  if(liveSession && liveSession.catId===id){
    liveSession=null;
    saveCloud();
  }
  renderCats();
  render();
  updateLiveButton();
};

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

document.getElementById('prev-day').onclick = ()=>shiftDay(-1);
document.getElementById('next-day').onclick = ()=>shiftDay(1);
document.getElementById('btn-today').onclick = ()=>{
  curDate=new Date().toISOString().split('T')[0];
  render();
};
document.getElementById('map-prev').onclick = ()=>shiftMapMonth(-1);
document.getElementById('map-next').onclick = ()=>shiftMapMonth(1);
document.getElementById('map-cat-select').onchange = renderActivityMap;

document.getElementById('theme-select').onchange = async e=>{
  theme=e.target.value;
  save('planner_theme', theme);
  applyTheme();
  await saveCloud();
};

document.getElementById('btn-now-s').onclick = ()=>{ document.getElementById('start-time').value=getNow(); };
document.getElementById('btn-now-e').onclick = ()=>{ document.getElementById('end-time').value=getNow(); };

document.getElementById('toggle-cat').onclick = ()=>{
  const b=document.getElementById('new-cat-box');
  if(b) b.style.display = b.style.display==='block'?'none':'block';
};

document.getElementById('save-cat').onclick = ()=>{
  const name=document.getElementById('new-cat-name').value.trim();
  const color=document.getElementById('new-cat-color').value;
  if(!name){ alert('نام دسته‌بندی را وارد کنید'); return; }
  const nc={id:'c'+Date.now(), name, color};
  cats.push(nc);
  save('planner_cats', cats);
  saveCloud();
  renderCats();
  document.getElementById('cat-select').value=nc.id;
  document.getElementById('map-cat-select').value=nc.id;
  document.getElementById('new-cat-name').value='';
  document.getElementById('new-cat-box').style.display='none';
  render();
};

function createEvent({title, catId, stRaw, enRaw, pauseRaw = "0", date=curDate, targetId = null}){
  const err=document.getElementById('time-err');
  
  if(!catId || !cats.some(c=>c.id===catId)){
    alert('اول یک موضوع بسازید یا انتخاب کنید');
    return false;
  }

  let finalTitle = (title || '').trim();
  if(!finalTitle){
    finalTitle = getCat(catId).name;
  }

  const sMins=parseTime(stRaw);
  const eMinsRaw=parseTime(enRaw);
  if(sMins===null||eMinsRaw===null){
    if(err) err.style.display='block';
    setTimeout(()=>{ if(err) err.style.display='none'; }, 3000);
    return false;
  }

  // محاسبه کل بازه زمانی ثبت‌شده
  let totalMins = eMinsRaw - sMins;
  if(totalMins < 0) totalMins += 24*60;

  // محاسبه پاز و وقفه اعمال شده
  let pauseMins = parseInt(pauseRaw || "0", 10);
  if(isNaN(pauseMins) || pauseMins < 0) pauseMins = 0;

  let durMins = totalMins - pauseMins;
  if(durMins <= 0){
    alert('زمان پاز/وقفه نمی‌تواند بزرگتر یا مساوی با کل زمان سپری‌شده فعالیت باشد.');
    return false;
  }

  // ** قابلیت جدید: بررسی دقیق تداخل و همپوشانی زمانی در روز مشابه **
  const dayEvents = events.filter(e => e.date === date && e.id !== targetId);
  for (let ext of dayEvents) {
    let start1 = sMins;
    let end1 = sMins + totalMins;

    let start2 = ext.sMins;
    let extTotal = ext.durMins + (ext.pauseMins || 0);
    let end2 = ext.sMins + extTotal;

    // بررسی تقاطع دو بازه زمانی
    if (Math.max(start1, start2) < Math.min(end1, end2)) {
      alert(`همپوشانی زمانی رخ داد! این زمان با فعالیت ثبت‌شده «${ext.title}» (${fmtTime(ext.sMins)} تا ${fmtTime(ext.eMins)}) تداخل دارد.`);
      return false;
    }
  }

  const eMins = sMins + totalMins > 1440 ? sMins + totalMins - 1440 : sMins + totalMins;

  if (targetId) {
    const idx = events.findIndex(e => e.id === targetId);
    if (idx !== -1) {
      events[idx] = {
        ...events[idx],
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
    events.push(ev);
  }

  save('planner_ev', events);
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
    targetId: editingEventId
  });
  if(!ok) return;

  if (editingEventId) {
    editingEventId = null;
    document.getElementById('add-btn').textContent = '+ افزودن به تایم‌لاین';
    document.getElementById('edit-cancel-btn').style.display = 'none';
  }

  clearEventForm();
  render();
};

document.getElementById('edit-cancel-btn').onclick = () => {
  editingEventId = null;
  document.getElementById('add-btn').textContent = '+ افزودن به تایم‌لاین';
  document.getElementById('edit-cancel-btn').style.display = 'none';
  clearEventForm();
};

window.editEv = function(id) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;

  editingEventId = id;
  document.getElementById('act-title').value = ev.title === getCat(ev.catId).name ? '' : ev.title;
  document.getElementById('cat-select').value = ev.catId;
  document.getElementById('start-time').value = fmtTime(ev.sMins);
  document.getElementById('end-time').value = fmtTime(ev.eMins);
  document.getElementById('pause-time').value = ev.pauseMins || '';

  document.getElementById('add-btn').textContent = '✓ ثبت تغییرات فعالیت';
  document.getElementById('edit-cancel-btn').style.display = 'block';

  document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
};

function updateLiveButton(){
  const btn=document.getElementById('live-btn');
  const status=document.getElementById('live-status');
  if(!btn || !status) return;
  if(liveSession){
    btn.classList.add('is-running');
    btn.textContent='پایان و ثبت فعالیت';
    const cat=getCat(liveSession.catId);
    
    const isPaused = liveSession.pauseStartMins !== null && liveSession.pauseStartMins !== undefined;
    const pauseMinsTotal = liveSession.pauseMins || 0;
    
    status.innerHTML = `
      <div style="margin-bottom: 4px;">در حال ثبت: ${liveSession.title}، از ${fmtTime(liveSession.sMins)} (${cat.name})</div>
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

function toggleLivePause() {
  if (!liveSession) return;
  const nowStr = getNow();
  const nowMins = parseTime(nowStr);

  if (liveSession.pauseStartMins === null || liveSession.pauseStartMins === undefined) {
    liveSession.pauseStartMins = nowMins;
  } else {
    let diff = nowMins - liveSession.pauseStartMins;
    if (diff < 0) diff += 24 * 60;
    liveSession.pauseMins = (liveSession.pauseMins || 0) + diff;
    liveSession.pauseStartMins = null;
  }
  saveCloud();
  updateLiveButton();
}

document.getElementById('live-btn').onclick=()=>{
  if(!liveSession){
    const title=document.getElementById('act-title').value.trim();
    const catId=document.getElementById('cat-select').value;
    
    if(!catId || !cats.some(c=>c.id===catId)){
      alert('اول یک موضوع بسازید یا انتخاب کنید');
      return;
    }

    const finalTitle = title || getCat(catId).name;

    const now=getNow();
    const sMins=parseTime(now);
    
    liveSession={title: finalTitle, catId, date:curDate, sMins, pauseMins: 0, pauseStartMins: null};
    saveCloud();
    document.getElementById('start-time').value=now;
    document.getElementById('end-time').value='';
    updateLiveButton();
    return;
  }

  const endNow=getNow();
  const endMins=parseTime(endNow);

  let finalPauseMins = liveSession.pauseMins || 0;
  if (liveSession.pauseStartMins !== null && liveSession.pauseStartMins !== undefined) {
    let diff = endMins - liveSession.pauseStartMins;
    if (diff < 0) diff += 24 * 60;
    finalPauseMins += diff;
  }

  const ok=createEvent({
    title: liveSession.title,
    catId: liveSession.catId,
    stRaw: fmtTime(liveSession.sMins),
    enRaw: endNow,
    pauseRaw: String(finalPauseMins),
    date: liveSession.date
  });
  if(!ok) return;
  liveSession=null;
  saveCloud();
  clearEventForm();
  render();
  updateLiveButton();
};

if(document.getElementById('end-time')){
  document.getElementById('end-time').addEventListener('keydown', e=>{
    if(e.key==='Enter') document.getElementById('add-btn').click();
  });
}

// واکشی و نمایش روتین‌های ثبت‌شده
function renderRoutines() {
  const list = document.getElementById('rt-list');
  if (!list) return;
  list.innerHTML = '';
  
  if (routines.length === 0) {
    list.innerHTML = `<div style="font-size:11px; color:var(--muted); text-align:center;">هیچ روتینی تعریف نشده است</div>`;
    return;
  }
  
  const daysName = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  
  routines.forEach(rt => {
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

window.delRoutine = function(id) {
  if (!confirm('این روتین حذف شود؟')) return;
  routines = routines.filter(r => r.id !== id);
  save('planner_routines', routines);
  saveCloud();
  renderRoutines();
};

// پردازش و افزودن خودکار روتین‌ها به تایم‌لاین هنگام رسیدن ساعت شروع
function checkAndAddRoutines() {
  const now = new Date();
  const jsDay = now.getDay(); 
  const irDay = (jsDay + 1) % 7; // نگاشت شنبه به 0 تا جمعه به 6
  
  const currentTimeMins = now.getHours() * 60 + now.getMinutes();
  const todayStr = now.toISOString().split('T')[0];
  
  let changed = false;
  
  routines.forEach(rt => {
    if (rt.days.includes(irDay)) {
      const sMins = parseTime(rt.startTime);
      // اگر زمان فعلی سیستم مساوی یا بعد از شروع روتین باشد
      if (currentTimeMins >= sMins) {
        // چک کردن برای عدم وجود هم‌پوشانی و ثبت نشدن روتین در امروز
        const alreadyExists = events.some(e => e.date === todayStr && e.catId === rt.catId && e.sMins === sMins);
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
          events.push(ev);
          changed = true;
        }
      }
    }
  });
  
  if (changed) {
    save('planner_ev', events);
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

// اعتبارسنجی پویای بازه روزهای فیلتر گزارش دوره‌ای (عدم ورود اعداد فارسی یا حروف)
// فعال‌سازی تایید فیلتر گزارش دوره ای فقط با زدن دکمه تایید
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
      renderReport(); // به‌روزرسانی نهایی نمودار گزارش
    }
  };
}

// تغییر رنگ پویا و سایه دار روزهای روتین برای وضوح بیشتر انتخاب
const dayBtns = document.querySelectorAll('.rt-day-btn');
dayBtns.forEach(btn => {
  btn.onclick = function() {
    const day = parseInt(this.getAttribute('data-day'), 10);
    if (selectedRtDays.includes(day)) {
      selectedRtDays = selectedRtDays.filter(d => d !== day);
      this.style.background = 'var(--surface2)';
      this.style.borderColor = 'var(--border2)';
      this.style.color = 'var(--text)';
      this.style.boxShadow = 'none';
    } else {
      selectedRtDays.push(day);
      this.style.background = 'var(--accent)';
      this.style.borderColor = 'var(--accent)';
      this.style.color = '#fff';
      this.style.boxShadow = '0 0 8px var(--accent-glow)'; // اعمال سایه درخشان در وضعیت فعال
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
    if (selectedRtDays.length === 0) {
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
      days: [...selectedRtDays],
      startTime: start,
      endTime: end
    };
    
    routines.push(newRt);
    save('planner_routines', routines);
    saveCloud();
    
   // ریست فرم روتین بعد از ثبت
    document.getElementById('rt-title').value = '';
    document.getElementById('rt-start').value = '';
    document.getElementById('rt-end').value = '';
    selectedRtDays = [];
    dayBtns.forEach(b => {
      b.style.background = 'var(--surface2)';
      b.style.borderColor = 'var(--border2)';
      b.style.color = 'var(--text)';
      b.style.boxShadow = 'none'; // حذف درخشش دکمه‌ها
    });
// مدیریت و لود دقیق احراز هویت با ساختار ایمن و بدون بن‌بست
async function handleUserSession(session) {
  const user = session?.user;
  if(!user){
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
  if(msg) {
    msg.textContent = displayName ? "خوش آمدی، " + displayName + " 👋" : "خوش آمدی 👋";
  }

  setTimeout(async () => {
    try {
      localStorage.removeItem('planner_ev');
      localStorage.removeItem('planner_cats');
      localStorage.removeItem('planner_live');
      localStorage.removeItem('planner_routines');
      events = [];
      cats = [];
      liveSession = null;
      routines = [];

      // دریافت داده‌ها از دیتابیس ابری
      await loadCloud();

      // تلاش برای خواندن جدول پروفایل در صورتی که همچنان نام نمایشی یافت نشد
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
      renderCats();
      render();
      updateLiveButton();
      checkAndAddRoutines(); // بررسی روتین‌ها پس از لود اولیه داده‌ها
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

// کنترل و سوییچ کردن بین نمای روزانه و هفتگی برنامه کلاسی
window.setupViewTabs = function() {
  const btnDaily = document.getElementById('view-daily-btn');
  const btnWeekly = document.getElementById('view-weekly-btn');
  if (!btnDaily || !btnWeekly) return;

  btnDaily.onclick = () => {
    activeView = 'daily';
    btnDaily.style.background = 'var(--surface2)';
    btnDaily.style.color = 'var(--text)';
    btnWeekly.style.background = 'var(--surface3)';
    btnWeekly.style.color = 'var(--muted)';
    render();
  };

  btnWeekly.onclick = () => {
    activeView = 'weekly';
    btnWeekly.style.background = 'var(--surface2)';
    btnWeekly.style.color = 'var(--text)';
    btnDaily.style.background = 'var(--surface3)';
    btnDaily.style.color = 'var(--muted)';
    render();
  };
};
window.setupViewTabs();
