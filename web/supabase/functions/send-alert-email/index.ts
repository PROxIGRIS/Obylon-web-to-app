import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get('re_eDGGgNkv_ABLbb5TF9pbQMuBe6WM4EsML');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, alert_type, message, token } = await req.json();

    // Check user preferences
    const { data: prefs } = await supabaseClient
      .from('user_preferences')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();

    const optedOutCritical = prefs ? !prefs.email_critical_alerts : false;
    const optedOutHardware = prefs ? !prefs.email_hardware_panic : true;
    const optedOutNewLogin = prefs ? !prefs.email_new_logins : false;

    if (alert_type === 'warden_strike' && optedOutCritical) {
      return new Response('User opted out of critical alerts', { status: 200 });
    }
    if (alert_type === 'hardware_panic' && optedOutHardware) {
      return new Response('User opted out of hardware panic alerts', { status: 200 });
    }
    if (alert_type === 'new_login' && optedOutNewLogin) {
      return new Response('User opted out of new login alerts', { status: 200 });
    }

    // Get user email
    const { data: userAdmin } = await supabaseClient.auth.admin.getUserById(user_id);
    const userEmail = userAdmin.user?.email;

    if (!userEmail) throw new Error("User email not found");

    // Construct the UI HTML from the provided template
    let tokenBlock = '';
    if (token) {
      tokenBlock = `
<div style="background-color: #1C1A16; background-image: linear-gradient(to bottom, #1C1A16 0%, #1C1A16 100%); border: 1px solid #1C1A16; padding: 20px; text-align: center; margin-bottom: 10px;">  
  <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: bold; color: #F0EDE3; letter-spacing: 12px; margin-left: 12px;">${token}</span>  
</div>`;
    }

    const htmlBody = `
<div style="background-color: #F0EDE3; background-image: linear-gradient(to bottom, #F0EDE3 0%, #F0EDE3 100%); padding: 40px 20px; min-height: 100%; font-family: 'Inter', Helvetica, Arial, sans-serif; color: #1C1A16;">  
  <div style="max-width: 500px; margin: 0 auto; background-color: #FDFAF2; background-image: linear-gradient(to bottom, #FDFAF2 0%, #FDFAF2 100%); border: 1px solid #D8D2C4; border-top: 4px solid #A83228; padding: 35px 30px; box-shadow: 6px 6px 0px 0px rgba(28,26,22,0.04);">  
    <div style="font-family: 'Courier New', Courier, monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #9C8C7C; border-bottom: 1px solid #E0DAD0; padding-bottom: 12px; margin-bottom: 25px;">  
      Obylon Administration // Security Verification  
    </div>  

    <h1 style="font-family: 'EB Garamond', Georgia, serif; font-size: 32px; font-weight: normal; margin: 0 0 15px 0; color: #1C1A16; letter-spacing: -0.5px;">  
      Security Alert.
    </h1>  

    <p style="font-size: 14px; line-height: 1.6; color: #6B5E52; margin-bottom: 25px; font-weight: 300;">  
      A sensitive administrative action was recorded for the account <span style="color: #1C1A16; font-family: 'Courier New', Courier, monospace; font-weight: bold; padding: 2px 4px; background-color: #F0EDE3; background-image: linear-gradient(to bottom, #F0EDE3 0%, #F0EDE3 100%); border: 1px solid #E0DAD0;">${userEmail}</span>.  
      <br><br>  
      ${message}
    </p>  

    ${tokenBlock}

    <hr style="border: 0; border-top: 1px dashed #D8D2C4; margin: 35px 0 25px 0;" />  

    <div style="font-family: 'Courier New', Courier, monospace; font-size: 10px; color: #9C8C7C; text-transform: uppercase; letter-spacing: 1px; line-height: 1.6;">  
      &gt;_ Do not share this information. If you did not initiate this action, secure your account immediately.<br>  
      &gt;_ Automated administrative system. Do not reply.  
    </div>
  </div>  
</div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Obylon Security <security@obylon.app>",
        to: userEmail,
        subject: `Security Alert: ${alert_type}`,
        html: htmlBody,
      }),
    });
    
    if (!res.ok) {
      throw new Error(await res.text());
    }

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
