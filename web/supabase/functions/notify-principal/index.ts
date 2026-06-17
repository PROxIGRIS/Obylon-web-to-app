// notify-principal — Phase 5.1 (Telegram Gavel + FCM HTTP v1 Push Bridge)
// Triggered by Postgres trigger / DB webhook on `alerts` (severity = 'critical' ONLY).
// Fans out to:
//   1. Telegram (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
//   2. Firebase Cloud Messaging via the modern HTTP v1 API
//      (FCM_SERVICE_ACCOUNT — full Google service-account JSON)
//
// FCM v1 requires an OAuth2 bearer token signed from the service-account
// private key (RS256 JWT → token exchange). We mint and cache that token
// per cold start.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
const SHARED_SECRET = Deno.env.get("GAVEL_SHARED_SECRET") ?? "";
const FCM_SERVICE_ACCOUNT = Deno.env.get("FCM_SERVICE_ACCOUNT") ?? "";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://mbelumnusmqpodjokqox.lovable.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-gavel-secret",
};

// ---------- FCM HTTP v1 OAuth2 token (RS256 JWT) ---------------------------

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function parseServiceAccount(): ServiceAccount | null {
  if (!FCM_SERVICE_ACCOUNT) return null;
  try {
    return JSON.parse(FCM_SERVICE_ACCOUNT) as ServiceAccount;
  } catch (e) {
    console.error("[fcm] FCM_SERVICE_ACCOUNT is not valid JSON", e);
    return null;
  }
}

function b64urlEncode(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.value;

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64urlEncode(JSON.stringify(header))}.${b64urlEncode(JSON.stringify(claims))}`;

  try {
    const key = await crypto.subtle.importKey(
      "pkcs8",
      pemToPkcs8(sa.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsigned),
    );
    const jwt = `${unsigned}.${b64urlEncode(sig)}`;

    const res = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      console.error("[fcm] token exchange failed", res.status, data);
      return null;
    }
    cachedToken = { value: data.access_token, expiresAt: now + (data.expires_in ?? 3600) };
    return cachedToken.value;
  } catch (e) {
    console.error("[fcm] JWT signing failed", e);
    return null;
  }
}

async function sendFcmV1(
  sa: ServiceAccount,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ ok: boolean; status?: number; details?: unknown }> {
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const message = {
    message: {
      token,
      notification: { title, body },
      data, // FCM v1 requires all data values to be strings
      android: {
        priority: "HIGH" as const,
        notification: { channel_id: "obylon_critical", sound: "default" },
      },
      apns: {
        headers: { "apns-priority": "10" },
        payload: { aps: { sound: "default", "content-available": 1 } },
      },
    },
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, details: json };
  } catch (e) {
    return { ok: false, details: String(e) };
  }
}

// ---------- Handler --------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (SHARED_SECRET) {
      const provided = req.headers.get("x-gavel-secret") ?? "";
      if (provided !== SHARED_SECRET) {
        return new Response("forbidden", { status: 403, headers: corsHeaders });
      }
    }

    const payload = await req.json().catch(() => ({}));
    // Accept both shapes:
    //   { alert_id, workstation_id }            (Postgres trigger)
    //   { record: { id, severity, ... } }       (Supabase DB webhook)
    const record = payload.record ?? null;
    const alert_id: string | undefined = payload.alert_id ?? record?.id;
    const workstation_id: string | undefined =
      payload.workstation_id ?? record?.workstation_id;

    if (!alert_id) return jsonResp({ error: "alert_id required" }, 400);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: alert, error: aErr } = await sb
      .from("alerts")
      .select("id, severity, process_name, window_title, timestamp, workstation_id, alert_type")
      .eq("id", alert_id)
      .maybeSingle();

    if (aErr || !alert) {
      console.error("[gavel] alert lookup failed", aErr);
      return jsonResp({ error: "alert not found" }, 404);
    }

    // STRICT FILTER — only severity === 'critical' fans out.
    if (alert.severity !== "critical") {
      return jsonResp({ skipped: "non-critical", severity: alert.severity }, 200);
    }

    let nodeName = "unknown";
    const wsId = workstation_id ?? alert.workstation_id;
    if (wsId) {
      const { data: ws } = await sb
        .from("workstations")
        .select("name")
        .eq("id", wsId)
        .maybeSingle();
      if (ws?.name) nodeName = ws.name;
    }

    // Pull the most recent screenshot for this alert (best-effort).
    let screenshotUrl: string | null = null;
    try {
      const { data: ev } = await sb
        .from("evidence_logs")
        .select("screenshot_url")
        .eq("alert_id", alert.id)
        .order("created_at", { ascending: false })
        .limit(1);
      screenshotUrl = ev?.[0]?.screenshot_url ?? null;
    } catch (_) { /* evidence may not exist yet */ }

    const proc = alert.process_name ?? "unknown";
    const win = alert.window_title ?? "—";
    const violationType = alert.alert_type ?? "policy_violation";
    const caseUrl = `${SITE_URL}/case/${alert.id}`;

    const results: Record<string, unknown> = {};

    // --- Channel 1: Telegram ----------------------------------------------
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const text =
        `🚨 <b>CRITICAL BREACH</b> — <code>${escapeHtml(nodeName)}</code>\n` +
        `<b>Type:</b> ${escapeHtml(violationType)}\n` +
        `<b>Process:</b> ${escapeHtml(proc)}\n` +
        `<b>Window:</b> ${escapeHtml(win)}\n` +
        `<b>Time:</b> ${new Date(alert.timestamp).toUTCString()}\n\n` +
        `🗂️ Forensic Case: ${caseUrl}`;

      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text,
              parse_mode: "HTML",
              disable_web_page_preview: false,
            }),
          },
        );
        const tgData = await tgRes.json();
        results.telegram = tgRes.ok
          ? { ok: true, message_id: tgData.result?.message_id }
          : { ok: false, status: tgRes.status, details: tgData };
      } catch (e) {
        results.telegram = { ok: false, error: String(e) };
      }
    } else {
      results.telegram = { skipped: "not configured" };
    }

    // --- Channel 2: FCM HTTP v1 -------------------------------------------
    const sa = parseServiceAccount();
    if (!sa) {
      results.fcm = { skipped: "FCM_SERVICE_ACCOUNT not configured" };
    } else {
      const accessToken = await getAccessToken(sa);
      if (!accessToken) {
        results.fcm = { ok: false, error: "failed to mint OAuth2 token" };
      } else {
        const { data: tokens } = await sb
          .from("device_tokens")
          .select("id, token");

        const list = tokens ?? [];
        if (list.length === 0) {
          results.fcm = { skipped: "no device tokens registered" };
        } else {
          const title = `🚨 CRITICAL BREACH: ${nodeName}`;
          const body = `${proc} — ${win}`;
          const data = {
            alert_id: String(alert.id),
            workstation_id: String(wsId ?? ""),
            violation_type: violationType,
            evidence_url: caseUrl,
            image_url: screenshotUrl ?? "",
          };

          const sends = await Promise.all(
            list.map((t: { id: string; token: string }) =>
              sendFcmV1(sa, accessToken, t.token, title, body, data).then((r) => ({ ...r, id: t.id, token: t.token })),
            ),
          );

          // Prune dead tokens (UNREGISTERED / INVALID_ARGUMENT).
          const dead = sends
            .filter((r) => {
              const status = (r.details as any)?.error?.status;
              return status === "UNREGISTERED" || status === "NOT_FOUND" || status === "INVALID_ARGUMENT";
            })
            .map((r) => r.id);
          if (dead.length) {
            await sb.from("device_tokens").delete().in("id", dead);
          }

          results.fcm = {
            recipients: list.length,
            success: sends.filter((r) => r.ok).length,
            failure: sends.filter((r) => !r.ok).length,
            pruned: dead.length,
          };
        }
      }
    }

    return jsonResp({ ok: true, alert_id, results }, 200);
  } catch (e) {
    console.error("[gavel] unhandled", e);
    return jsonResp({ error: String(e) }, 500);
  }
});

function jsonResp(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
