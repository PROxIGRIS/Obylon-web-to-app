import { createClient } from "npm:@supabase/supabase-js@2";
import dotenv from "npm:dotenv";
dotenv.config();

const supabaseClient = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
);

async function run() {
  const { data: userAdmin, error } = await supabaseClient.auth.admin.listUsers();
  if (error) console.error("Error listing users:", error);
  else {
      const user = userAdmin.users[0];
      if (user) {
          console.log("Found user:", user.email, "id:", user.id);
          const { data: prefs, error: prefError } = await supabaseClient
            .from('user_preferences')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          console.log("Prefs:", prefs, prefError);
      }
  }
}
run();
