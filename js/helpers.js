// js/helpers.js

export function pad(n){ return String(n).padStart(2,'0'); }

export function getNow(){
  const n=new Date();
  return pad(n.getHours())+':'+pad(n.getMinutes());
}

export function parseTime(s){
  s=(s||'').trim();
  if(/^\d{4}$/.test(s)) s=s.slice(0,2)+':'+s.slice(2);
  const m=s.match(/^(\d{1,2}):(\d{2})$/);
  if(!m) return null;
  const h=+m[1], mn=+m[2];
  if(h>23||mn>59) return null;
  return h*60+mn;
}

export function fmtTime(mins){
  return pad(Math.floor(mins/60))+':'+pad(mins%60);
}

export function fmtDur(mins){
  const h=Math.floor(mins/60), m=mins%60;
  if(h===0) return m+'m';
  if(m===0) return h+'h';
  return h+'h '+m+'m';
}

export function fmtDateLabel(d){
  const [y,mo,day]=d.split('-').map(Number);
  const dt=new Date(y, mo-1, day);
  const days=['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنج‌شنبه','جمعه','شنبه'];
  const months=['ژانویه','فوریه','مارس','آوریل','مه','ژوئن','ژوئیه','اوت','سپتامبر','اکتبر','نوامبر','دسامبر'];
  return days[dt.getDay()]+' '+day+' '+months[mo-1]+' '+y;
}

export function escHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

export function getWeekDates(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const jsDay = dt.getDay(); 
  const irDay = (jsDay + 1) % 7; 
  
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
