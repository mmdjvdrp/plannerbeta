// js/supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabaseUrl = "YOUR_SUPABASE_URL"; // آدرس پروژه شما
const supabaseKey = "YOUR_SUPABASE_ANON_KEY"; // کلید عمومی شما

export const supabase = createClient(supabaseUrl, supabaseKey);
