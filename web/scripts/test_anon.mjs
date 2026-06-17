import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function main() {
  console.log("Simulating client-side query to user_roles...");
  
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', '63c39d4f-bd22-41ef-a75e-2cede29dfb9f')
      .maybeSingle();

    console.log("Result:", { data, error });
  } catch (e) {
    console.error("Exception thrown:", e);
  }
}

main();
