// js/supabase.js
// ایمپورت صحیح کتابخانه سوپابیس از CDN اصلی
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabaseUrl = "https://ipureiqnhgatigewbggj.supabase.co"; // آدرس پروژه شما (درست است)
const supabaseKey = "sb_publishable_ieckfcaUPxIeHPloSuR-rA_r7BC3aso"; // کلید عمومی شما (درست است)

export const supabase = createClient(supabaseUrl, supabaseKey);
