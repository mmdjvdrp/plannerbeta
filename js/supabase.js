// js/supabase.js
import { createClient } from "https://ipureiqnhgatigewbggj.supabase.co/rest/v1/";

const supabaseUrl = "https://ipureiqnhgatigewbggj.supabase.co"; // آدرس پروژه شما
const supabaseKey = "sb_publishable_ieckfcaUPxIeHPloSuR-rA_r7BC3aso"; // کلید عمومی شما

export const supabase = createClient(supabaseUrl, supabaseKey);
