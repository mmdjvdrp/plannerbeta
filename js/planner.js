// js/planner.js
import { supabase } from "./supabase.js";

// متغیرهای وضعیت برنامه
let events = load('planner_ev', []);
let cats   = load('planner_cats', []);
let curDate= new Date().toISOString().split('T')[0];
let mapMonth = curDate.slice(0,7);
let liveSession = load('planner_live', null);
let theme = load('planner_theme', 'dark');
let editingEventId = null;
let activeView = 'daily'; // مقدار پیش‌فرض: 'daily' یا 'weekly'

async function saveCloud(){
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;
    
    const { error } = await supabase
      .from("planner_data")
      .upsert(
        {
          user_id: user.id,
          data: { events, cats, liveSession, theme }
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

      save('planner_ev',    events);
      save('planner_cats',  cats);
      save('planner_live',  liveSession);
      save('planner_theme', theme);
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

// رندر تایم‌لاین به صورت برنامه هفتگی مدرسه‌ای (جدول شنبه تا جمعه)
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
    const dayEvs = events.filter(e => e.date === day.date).sort((a,b) => a.sMins - b.sMins);
    const isCurrent = day.date === curDate;
    const borderStyle = isCurrent ? '2px solid var(--accent)' : '1px solid var(--border)';
    const bgStyle = isCurrent ? 'var(--surface2)' : 'var(--surface)';
    
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
    
    if (dayEvs.length === 0) {
      html += `<div style="font-size:10px; color:var(--muted); text-align:center; margin-top:20px;">خالی</div>`;
    } else {
      dayEvs.forEach(ev => {
        const cat = getCat(ev.catId);
        html += `
          <div onclick="editEv('${ev.id}')" style="
            background: ${cat.color}18;
            border-right: 3px solid ${cat.color};
            border-radius: 4px;
            padding: 4px 6px;
            font-size: 11px;
            cursor: pointer;
            transition: opacity 0.15s;
          " onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1" title="${ev.title} (${fmtTime(ev.sMins)} تا ${fmtTime(ev.eMins)})">
            <div style="font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ev.title}</div>
            <div style="font-size:9px; color:var(--muted); font-family: monospace;">${fmtTime(ev.sMins)}</div>
          </div>
        `;
      });
    }
    html += `</div>`;
  });
  
  html += `</div>`;
  tl.innerHTML = html;
}

function renderTimeline(){
  const tl=document.getElementById('timeline');
  const em=document.getElementById('empty-msg');
  document.getElementById('tl-date').textContent=fmtDateLabel(curDate);

  if (activeView === 'weekly') {
    em.style.display = 'none';
    tl.style.display = 'block';
    renderWeeklyTimetable();
    return;
  }

  const day=events.filter(e=>e.date===curDate)
    .sort((a,b)=>a.sMins-b.sMins);

  if(!day.length){ em.style.display='block'; tl.style.display='none'; return; }
  em.style.display='none'; tl.style.display='block';
  tl.innerHTML='';

  day.forEach(ev=>{
    const cat=getCat(ev.catId);
    const el=document.createElement('div');
    el.className='tl-item';
    el.style.setProperty('--ic', cat.color);
    const pauseBadge = ev.pauseMins ? `<span class="tl-dur" style="color:#f87171; margin-inline-start: 6px">(پاز: ${ev.pauseMins}m)</span>` : '';

    el.innerHTML=`
      <div class="tl-dot"></div>
      <div class="tl-info">
        <div class="tl-title">${escHtml(ev.title)}</div>
        <div class="tl-meta">
          <span class="tl-badge" style="background:${cat.color}">${escHtml(cat.name)}</span>
          <span class="tl-time">${fmtTime(ev.sMins)}</span>
          <span style="color:var(--muted);font-size:11px">→</span>
          <span class="tl-time">${fmtTime(ev.eMins)}</span>
          <span class="tl-dur">(${fmtDur(ev.durMins)})</span>
          ${pauseBadge}
        </div>
      </div>
      <div style="display:flex; gap:6px">
        <button class="btn-del" style="background:var(--surface2); color:var(--text); border-color:var(--border2);" onmouseover="this.style.color='var(--accent2)'; this.style.borderColor='var(--accent2)';" onmouseout="this.style.color='var(--text)'; this.style.borderColor='var(--border2)';" onclick="editEv('${ev.id}')" title="ویرایش">✎</button>
        <button class="btn-del" onclick="delEv('${ev.id}')" title="حذف">✕</button>
      </div>
    `;
    tl.appendChild(el);
  });
}

function renderReport(){
  const [y,mo,d]=curDate.split('-').map(Number);
  const ref=new Date(y,mo-1,d);
  const from=new Date(ref); from.setDate(from.getDate()-6);

  const week=events.filter(e=>{
    const [ey,em,ed]=e.date.split('-').map(Number);
    const dt=new Date(ey,em-1,ed);
    return dt>=from && dt<=ref;
  });

  const sums={}; let total=0;
  week.forEach(e=>{ sums[e.catId]=(sums[e.catId]||0)+e.durMins; total+=e.durMins; });

  const grid=document.getElementById('report-grid');
  grid.innerHTML='';

  const reportCats=[...cats];
  Object.keys(sums).forEach(catId=>{
    if(!reportCats.some(c=>c.id===catId)){
      reportCats.push({id:catId, ...getCat(catId)});
    }
  });

  reportCats.forEach(cat=>{
    const mins=sums[cat.id]||0
