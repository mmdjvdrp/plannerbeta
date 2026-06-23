// js/storage.js
import { supabase } from "./supabase.js";
import { getLocalDateStr } from "./helpers.js";

export function load(k, def){
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : def;
  } catch(e) {
    return def;
  }
}

export function save(k, v){
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch(e) {}
}

export const state = {
  events: load('planner_ev', []),
  cats: load('planner_cats', []),
  routines: load('planner_routines', []), 
  goals: load('planner_goals', []),
  todos: load('planner_todos', []), 
  habits: load('planner_habits', []), 
  habitLogs: load('planner_habitLogs', {}), 
  moods: load('planner_moods', {}), 
  liveSession: load('planner_live', null),
  theme: load('planner_theme', 'auto'),
  accentColor: load('planner_accent', '#7c5cfc'), 
  
  calendarPref: load('planner_calendar_pref', 'jalali'), 
  timeFormatPref: load('planner_time_format_pref', 'hour-min'), 
  weekStartPref: load('planner_week_start_pref', 'sat'), 
  chartTypePref: load('planner_chart_type_pref', 'doughnut'), 
  
  // تنظیم ترجیح گروه‌بندی خودکار تایم‌لاین (ذخیره در دیتابیس محلی و ابری)
  groupTimelinePref: load('planner_group_timeline_pref', true), 
  
  moodPresets: load('planner_mood_presets', [
    { level: '1', type: 'text', value: '🤩', label: 'بسیار عالی' },
    { level: '2', type: 'text', value: '😊', label: 'خوب و آرام' },
    { level: '3', type: 'text', value: '😐', label: 'معمولی و تخت' },
    { level: '4', type: 'text', value: '😔', label: 'دلگیر و غمگین' },
    { level: '5', type: 'text', value: '😡', label: 'عصبانی یا کلافه' }
  ]),
  
  curDate: getLocalDateStr(),
  mapMonth: getLocalDateStr().slice(0, 7),
  editingEventId: null,
  activeView: 'daily',
  selectedRtDays: []
};

export async function saveCloud(){
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;
    
    await supabase.from("planner_data").upsert({
      user_id: user.id,
      data: { 
        events: state.events, cats: state.cats, liveSession: state.liveSession, 
        theme: state.theme, routines: state.routines, goals: state.goals,
        todos: state.todos, habits: state.habits, habitLogs: state.habitLogs,
        moods: state.moods, accentColor: state.accentColor,
        calendarPref: state.calendarPref, timeFormatPref: state.timeFormatPref, 
        weekStartPref: state.weekStartPref, chartTypePref: state.chartTypePref,
        groupTimelinePref: state.groupTimelinePref, moodPresets: state.moodPresets
      }
    }, { onConflict: 'user_id' });
  } catch (err) { console.error("Error saving to cloud", err); }
}

export async function loadCloud(){
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;
    const { data } = await supabase.from("planner_data").select("data").eq("user_id", user.id).maybeSingle();
    
    if(data && data.data){
      const cd = data.data;
      state.events      = cd.events || [];
      state.cats        = cd.cats || [];
      state.theme       = cd.theme || "auto";
      state.accentColor = cd.accentColor || "#7c5cfc";
      state.liveSession = cd.liveSession || null;
      state.routines    = cd.routines || [];
      state.goals       = cd.goals || [];
      state.todos       = cd.todos || [];
      state.habits      = cd.habits || [];
      state.habitLogs   = cd.habitLogs || {};
      state.moods       = cd.moods || {};
      
      state.calendarPref   = cd.calendarPref || "jalali";
      state.timeFormatPref = cd.timeFormatPref || "hour-min";
      state.weekStartPref  = cd.weekStartPref || "sat";
      state.chartTypePref  = cd.chartTypePref || "doughnut";
      state.moodPresets    = cd.moodPresets || state.moodPresets;
      state.groupTimelinePref = cd.groupTimelinePref !== undefined ? cd.groupTimelinePref : true;

      save('planner_ev', state.events);
      save('planner_cats', state.cats);
      save('planner_theme', state.theme);
      save('planner_accent', state.accentColor);
      save('planner_live', state.liveSession);
      save('planner_routines', state.routines);
      save('planner_goals', state.goals);
      save('planner_todos', state.todos);
      save('planner_habits', state.habits);
      save('planner_habitLogs', state.habitLogs);
      save('planner_moods', state.moods);
      save('planner_calendar_pref', state.calendarPref);
      save('planner_time_format_pref', state.timeFormatPref);
      save('planner_week_start_pref', state.weekStartPref);
      save('planner_chart_type_pref', state.chartTypePref);
      save('planner_group_timeline_pref', state.groupTimelinePref);
    }
  } catch (err) { console.error("Error loading cloud data", err); }
}
