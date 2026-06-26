// supabase.js - Cấu hình kết nối Supabase
// Giữ file này cùng thư mục với index.html, app.js, style.css và mobile.js.

var SUPABASE_URL = "https://fgujuuybphirvaebfgel.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZndWp1dXlicGhpcnZhZWJmZ2VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwODEwNTAsImV4cCI6MjA4NjY1NzA1MH0.JJTnpEMvmOIUqCXFIJKx0yHCCNhmHc_wiMszw9UwkcI";
var VAPID_PUBLIC_KEY = "BEvFCZMFzzESBkCKG1mMhgMl4u1z98Wy206w3-cbCTPRZopA-izDDdXcxW5091fCZz2lkOON8200tWKKOogwlWw";

var supabaseClient;
try {
    if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) {
    console.error("Lỗi khởi tạo Supabase:", e);
}
