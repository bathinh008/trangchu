import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json().catch(() => ({}));

    const title = payload.title || "Có hàng lỗi mới";
    const body = payload.body || payload.message || "Bấm để mở quản lý hàng lỗi";
    const url = payload.url || "hang-loi/";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, active")
      .eq("active", true);

    if (error) throw error;

    const pushPayload = JSON.stringify({
      title,
      body,
      url,
      type: payload.type || "defect_created",
      notification_id: payload.notification_id || null,
      product_name: payload.product_name || "",
      sku: payload.sku || "",
      barcode: payload.barcode || "",
      defect_id: payload.defect_id || null,
      status: payload.status || null,
      badge_count: payload.badge_count ?? payload.unread_count ?? null,
      unread_count: payload.unread_count ?? payload.badge_count ?? null,
    });

    const results = await Promise.allSettled((subscriptions || []).map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, pushPayload);
        return { id: sub.id, ok: true };
      } catch (err) {
        const statusCode = err?.statusCode || err?.status;

        // 404/410 thường là token hết hạn/gỡ app, tắt active để lần sau không gửi nữa.
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq("id", sub.id);
        }

        return { id: sub.id, ok: false, statusCode, message: err?.message || String(err) };
      }
    }));

    const sent = results.filter(r => r.status === "fulfilled" && r.value?.ok).length;
    const failed = results.length - sent;

    return new Response(JSON.stringify({ ok: true, total: results.length, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
