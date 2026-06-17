import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("Connecting to Supabase using Service Role Key...");
  
  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .limit(5);

  if (error) {
    console.error("Error fetching user_roles:", error);
  } else {
    console.log("Connection successful! Here are some records from user_roles:");
    console.log(data);
  }
}

main();
