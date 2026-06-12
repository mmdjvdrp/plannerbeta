import { events, cats, theme } from "./storage.js";
import { delEv } from "./event.js";

export function render(){
  renderCats();
  renderTimeline();
  renderReport();
  renderActivityMap();
}

export function renderCats(){
  const sel = document.getElementById("ev-cat");
  if(!sel) return;
  sel.innerHTML = cats.map(c =>
    `<option value="${c.name}">${c.name}</option>`
  ).join("");
}

export function renderTimeline(){
  const wrap = document.getElementById("timeline");
  if(!wrap) return;
  if(!events.length){
    wrap.innerHTML =
      `<div class="empty-msg">
        <div class="empty-icon">📭</div>
        رویداری ثبت نشده
      </div>`;
    return;
  }
  wrap.innerHTML = events
    .slice().sort((a,b) => a.start.localeCompare(b.start))
    .map(ev => {
      const cat = cats.find(c => c.name === ev.cat);
      const color = cat?.color || "var(--accent)";
      return `
        <div class="tl-item" style="--ic:${color}">
          <div class="tl-dot"></div>
          <div class="tl-info">
            <div class="tl-title">${ev.title}</div>
            <div class="tl-meta">
              <span class="tl-badge"
                style="background:${color}">${ev.cat||"—"}</span>
              <span class="tl-time">${ev.start} — ${ev.end}</span>
            </div>
          </div>
          <button class="btn-del"
            onclick="delEvGlobal('${ev.id}')">✕</button>
        </div>`;
    }).join("");
}

export function renderReport(){
  const wrap = document.getElementById("report");
  if(!wrap) return;
  const totals = {};
  events.forEach(ev => {
    const [sh,sm] = ev.start.split(":").map(Number);
    const [eh,em] = ev.end.split(":").map(Number);
    const dur = (eh*60+em) - (sh*60+sm);
    if(dur > 0) totals[ev.cat] = (totals[ev.cat]||0) + dur;
  });
  const total = Object.values(totals).reduce((a,b)=>a+b,0);
  if(!total){
    wrap.innerHTML = `<div class="map-empty">داده‌ای موجود نیست</div>`;
    return;
  }
  wrap.innerHTML = Object.entries(totals).map(([name, min])=>{
    const cat = cats.find(c=>c.name===name);
    const color = cat?.color || "var(--accent)";
    const pct = Math.round(min/total*100);
    const h = Math.floor(min/60), m = min%60;
    return `
      <div class="report-item">
        <div class="report-header">
          <span>${name}</span>
          <span>${h}h ${m}m (${pct}%)</span>
        </div>
        <div class="prog-bg">
          <div class="prog-fill"
            style="width:${pct}%;background:${color}"></div>
        </div>
      </div>`;
  }).join("") +
  `<div class="total-line">
    مجموع: <span>${Math.floor(total/60)}h ${total%60}m</span>
  </div>`;
}

export function renderActivityMap(){
  const wrap = document.getElementById("activity-map");
  if(!wrap) return;
  const dayCounts = {};
  events.forEach(ev => {
    const d = ev.date || "نامشخص";
    dayCounts[d] = (dayCounts[d]||0) + 1;
  });
  if(!Object.keys(dayCounts).length){
    wrap.innerHTML =
      `<div class="map-empty">فعالیتی ثبت نشده</div>`;
    return;
  }
  wrap.innerHTML = Object.entries(dayCounts).map(([d,n])=>
    `<div class="map-day">
      <div class="map-day-num">${d}</div>
      <div class="map-dot" style="--dot-size:${6+n*2}px"></div>
    </div>`
  ).join("");
}

export function updateLiveButton(isRunning){
  const btn = document.getElementById("btn-live");
  if(!btn) return;
  btn.textContent = isRunning ? "⏹ توقف" : "▶ شروع زنده";
  btn.classList.toggle("is-running", isRunning);
}

window.delEvGlobal = delEv;