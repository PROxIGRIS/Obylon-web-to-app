import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/components/ui/toast";

/**
 * Phase 5.1 — Mobile Push Bridge (FCM HTTP v1)
 *
 * Registers the device with FCM (via Capacitor) and stores the token in
 * `device_tokens`. The `notify-principal` edge function fans Critical alerts
 * (severity = 'critical' ONLY) to every row in that table over FCM HTTP v1.
 *
 * On notification tap, navigates straight to the Incident Dossier
 * (/case/$alertId) so the operator lands on the evidence in one motion.
 *
 * Capacitor packages are dynamically imported so the web build doesn't depend
 * on them. On `web`, this hook is a silent no-op.
 *
 * To activate: `npm i @capacitor/core @capacitor/push-notifications` then
 * `npx cap sync android` and rebuild the APK (see CAPACITOR.md).
 */
export function useMobilePush() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    const subs: Array<{ remove: () => Promise<void> }> = [];

    const openDossier = (data: Record<string, unknown> | undefined | null) => {
      const alertId = data?.alert_id ? String(data.alert_id) : null;
      if (alertId) navigate({ to: "/case/$id", params: { id: alertId }, search: { incidentId: undefined } });
    };

    (async () => {
      try {
        // Indirect specifiers so TS doesn't try to resolve types at build time.
        const capModule = "@capacitor/core";
        const pushModule = "@capacitor/push-notifications";
        const cap: any = await import(/* @vite-ignore */ capModule).catch(() => null);
        if (!cap?.Capacitor?.isNativePlatform?.()) return;

        const push: any = await import(/* @vite-ignore */ pushModule).catch(() => null);
        if (!push?.PushNotifications) return;

        const PushNotifications = push.PushNotifications;
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") {
          console.warn("[push] permission denied");
          return;
        }

        await PushNotifications.register();

        subs.push(
          await PushNotifications.addListener(
            "registration",
            async (token: { value: string }) => {
              if (cancelled || !token?.value) return;
              const platform =
                (cap.Capacitor.getPlatform?.() as string) === "ios" ? "ios" : "android";
              await (supabase as any)
                .from("device_tokens")
                .upsert(
                  {
                    user_id: user.id,
                    token: token.value,
                    platform,
                    last_seen: new Date().toISOString(),
                  },
                  { onConflict: "token" },
                );
            },
          ),
        );

        subs.push(
          await PushNotifications.addListener(
            "registrationError",
            (err: unknown) => console.error("[push] registration error", err),
          ),
        );

        // Foreground delivery — show a toast that opens the dossier on tap.
        subs.push(
          await PushNotifications.addListener(
            "pushNotificationReceived",
            (n: { title?: string; body?: string; data?: Record<string, unknown> }) => {
              toast(n.title ?? "Critical alert", {
                description: n.body,
                action: n.data?.alert_id
                  ? { label: "Open", onClick: () => openDossier(n.data) }
                  : undefined,
              });
            },
          ),
        );

        // User tapped the notification (background or quit). Open the dossier.
        subs.push(
          await PushNotifications.addListener(
            "pushNotificationActionPerformed",
            (action: { notification: { data?: Record<string, unknown> } }) => {
              openDossier(action?.notification?.data);
            },
          ),
        );
      } catch (e) {
        console.warn("[push] capacitor not available", e);
      }
    })();

    return () => {
      cancelled = true;
      for (const s of subs) s.remove?.().catch(() => undefined);
    };
  }, [user, navigate]);
}
