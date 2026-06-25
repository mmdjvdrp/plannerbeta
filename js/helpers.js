// js/helpers.js
import { state } from "./storage.js";

export function pad(n){ return String(n).padStart(2,'0'); }

export function getLocalDateStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export function getNow(){
  const n = new Date();
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

// قالب‌بندی مدت زمان بر اساس انتخاب کاربر (ساعت و دقیقه / ساعت اعشاری / فقط دقیقه)
export function fmtDur(mins){
  const pref = state.timeFormatPref || 'hour-min';
  
  if (pref === 'minutes') {
    return mins + 'm';
  }
  if (pref === 'decimal-hour') {
    return (mins / 60).toFixed(1) + 'h';
  }
  
  // پیش‌فرض: ساعت و دقیقه
  const h=Math.floor(mins/60), m=mins%60;
  if(h===0) return m+'m';
  if(m===0) return h+'h';
  return h+'h '+m+'m';
}

// نمایش بومی تاریخ بر اساس سیستم تقویم انتخاب شده (شمسی یا انگلیسی)
export function fmtDateLabel(d){
  if (!d) return 'نامشخص';
  try {
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    const [y,mo,day] = parts.map(Number);
    const dt=new Date(y, mo-1, day);
    if (isNaN(dt.getTime())) return d;
    const isJalali = (state.calendarPref === 'jalali');
    
    if (isJalali) {
      return new Intl.DateTimeFormat('fa-IR', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      }).format(dt);
    } else {
      return new Intl.DateTimeFormat('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      }).format(dt);
    }
  } catch (e) {
    return d;
  }
}

export function escHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// تطبیق تاریخ هفته با روز شروع هفته انتخاب شده
export function getWeekDates(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const jsDay = dt.getDay(); 
  
  let offset = 0;
  const pref = state.weekStartPref || 'sat';
  if (pref === 'sat') {
    offset = (jsDay + 1) % 7;
  } else if (pref === 'mon') {
    offset = (jsDay + 6) % 7;
  } else {
    offset = jsDay;
  }
  
  const sat = new Date(dt);
  sat.setDate(dt.getDate() - offset);
  
  const weekDates = [];
  const daysMap = {
    'sat': ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'],
    'sun': ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'],
    'mon': ['دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه', 'یکشنبه']
  };
  
  const currentDaysNames = daysMap[pref] || daysMap['sat'];
  
  for (let i = 0; i < 7; i++) {
    const dTmp = new Date(sat);
    dTmp.setDate(sat.getDate() + i);
    const yStr = dTmp.getFullYear();
    const mStr = String(dTmp.getMonth() + 1).padStart(2, '0');
    const dStr = String(dTmp.getDate()).padStart(2, '0');
    
    const isJalali = (state.calendarPref === 'jalali');
    const dayNumDisplay = isJalali 
      ? new Intl.DateTimeFormat('fa-IR', { day: 'numeric' }).format(dTmp)
      : dTmp.getDate();
      
    weekDates.push({
      name: currentDaysNames[i],
      date: `${yStr}-${mStr}-${dStr}`,
      dayNum: dayNumDisplay
    });
  }
  return weekDates;
}

// اعتبارسنجی محدوده زمانی وارد شده جهت جلوگیری از محاسبات اشتباه یا منفی
export function isValidTimeRange(startStr, endStr) {
  const sMins = parseTime(startStr);
  const eMins = parseTime(endStr);
  if (sMins === null || eMins === null) return false;
  return eMins > sMins;
}

// اعتبارسنجی ساختار آدرس ایمیل
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}
