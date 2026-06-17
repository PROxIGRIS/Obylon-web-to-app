import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is authenticated and has permission
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Check caller role
    const { data: callerRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!callerRole || !["dev", "principal", "admin"].includes(callerRole.role)) {
      throw new Error("Insufficient permissions");
    }

    const { email, role, redirectTo } = await req.json();

    if (!email || !role) {
      throw new Error("Email and role are required");
    }
    
    const getAssignableRoles = (r: string) => {
      switch (r) {
        case "dev": return ["dev", "admin", "principal", "teacher", "helper"];
        case "admin": return ["principal", "teacher", "helper"];
        case "principal": return ["teacher", "helper"];
        default: return [];
      }
    };

    if (!getAssignableRoles(callerRole.role).includes(role)) {
      throw new Error("Invalid role to invite or insufficient permissions");
    }

    // Invite the user and force the redirect route
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { needs_setup: true },
      redirectTo: redirectTo || "https://umbraxis.umbraxis.workers.dev/welcome"
    });

    if (inviteError) {
      throw inviteError;
    }

    // The user_id is in inviteData.user.id
    if (inviteData?.user?.id) {
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: inviteData.user.id,
          role: role
        });

      if (roleError) {
        console.error("Failed to assign role", roleError);
        // We continue even if role assignment fails, but we log it
      }
    }

    return new Response(JSON.stringify({ success: true, user: inviteData.user }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    // Return 200 so the Supabase client doesn't swallow the error message
    // The frontend explicitly checks if (data?.error) throw new Error(data.error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, 
    });
  }
});
