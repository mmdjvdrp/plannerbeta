// js/storage.js
import { supabase } from "./supabase.js";

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

// مخزن سراسری و هماهنگ داده‌های برنامه (State) جهت جلوگیری از خطای ویرایش متغیرهای ایمپورت‌شده
export const state = {
  events: load('planner_ev', []),
  cats: load('planner_cats', []),
  routines: load('planner_routines', []), 
  liveSession: load('planner_live', null),
  theme: load('planner_theme', 'dark'),
  curDate: new Date().toISOString().split('T')[0],
  mapMonth: new Date().toISOString().split('T')[0].slice(0, 7),
  editingEventId: null,
  activeView: 'daily',
  selectedRtDays: []
};

export async function saveCloud(){
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;
    
    const { error } = await supabase
      .from("planner_data")
      .upsert(
        {
          user_id: user.id,
          data: { 
            events: state.events, 
            cats: state.cats, 
            liveSession: state.liveSession, 
            theme: state.theme, 
            routines: state.routines 
          }
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error("خطا در ذخیره‌سازی ابری سوپابیس:", error.message);
    }
  } catch (err) {
    console.error("خطای غیرمنتظره در ذخیره ابری:", err);
  }
}

export async function loadCloud(){
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
      
      state.events      = cloudData.events      || [];
      state.cats        = cloudData.cats        || [];
      state.theme       = cloudData.theme       || "dark";
      state.liveSession = cloudData.liveSession || null;
      state.routines    = cloudData.routines    || [];

      save('planner_ev',       state.events);
      save('planner_cats',     state.cats);
      save('planner_live',     state.liveSession);
      save('planner_theme',    state.theme);
      save('planner_routines', state.routines);
    }
  } catch (err) {
    console.error("خطا در بارگذاری ابری اطلاعات از سوپابیس:", err);
  }
}
