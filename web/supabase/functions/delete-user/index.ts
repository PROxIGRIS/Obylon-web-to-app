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

  console.log(`[delete-user] Received request method: ${req.method}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[delete-user] Missing environment variables");
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is authenticated and has permission
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[delete-user] Missing Authorization header");
      throw new Error("Unauthorized");
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("[delete-user] Verifying caller token...");
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !caller) {
      console.error("[delete-user] Auth verification failed:", authError);
      throw new Error("Unauthorized");
    }

    console.log(`[delete-user] Caller verified: ${caller.id}`);

    // Check caller role
    const { data: callerRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (!callerRole || !["dev", "principal", "admin", "teacher"].includes(callerRole.role)) {
      console.error(`[delete-user] Caller ${caller.id} has insufficient role:`, callerRole);
      throw new Error("Insufficient permissions");
    }

    const body = await req.json();
    const { user_id } = body;
    console.log(`[delete-user] Request to delete target user_id: ${user_id}`);

    if (!user_id) {
      console.error("[delete-user] user_id missing in request body");
      throw new Error("User ID is required");
    }

    if (user_id === caller.id) {
      console.error("[delete-user] Caller attempted self-deletion");
      throw new Error("Cannot delete yourself");
    }

    // Check target role
    console.log(`[delete-user] Fetching target role for ${user_id}...`);
    const { data: targetRole, error: targetRoleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .maybeSingle();
      
    if (targetRoleError) {
      console.error(`[delete-user] Error fetching target role:`, targetRoleError);
    }

    const getManageableRoles = (r: string) => {
      switch (r) {
        case "dev": return ["admin", "principal", "teacher", "helper", null];
        case "admin": return ["teacher", "helper", null];
        case "principal": return ["admin", "teacher", "helper", null];
        case "teacher": return ["helper", null];
        default: return [];
      }
    };

    const targetRoleValue = targetRole ? targetRole.role : null;
    const manageable = getManageableRoles(callerRole.role);
    console.log(`[delete-user] Caller role: ${callerRole.role}, Target role: ${targetRoleValue}, Allowed targets:`, manageable);
    
    if (!manageable.includes(targetRoleValue)) {
      console.error("[delete-user] Role hierarchy violation detected");
      throw new Error("Invalid role to delete or insufficient permissions");
    }

    // Delete the user using auth admin API
    console.log(`[delete-user] Executing supabase.auth.admin.deleteUser(${user_id})...`);
    const { data: deleteData, error: deleteError } = await supabase.auth.admin.deleteUser(user_id);

    if (deleteError) {
      console.error("[delete-user] supabase.auth.admin.deleteUser failed:", deleteError);
      throw deleteError;
    }

    console.log(`[delete-user] Successfully deleted user: ${user_id}`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error(`[delete-user] Unhandled exception:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, 
    });
  }
});
