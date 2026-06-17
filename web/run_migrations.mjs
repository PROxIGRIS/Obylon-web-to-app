import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`Running ${filePath}...`);
  const { data, error } = await supabase.rpc('exec_sql', { sql: sql });
  
  if (error) {
    console.error(`Error running ${filePath}:`, error);
  } else {
    console.log(`Success: ${filePath}`);
  }
}

async function main() {
  await runMigration('supabase/migrations/20260609120004_update_user_sessions_rls.sql');
  await runMigration('supabase/migrations/20260609120005_realtime_user_sessions.sql');
}

main();
