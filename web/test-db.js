import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://ozruikfnrmmvhvozgnoo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96cnVpa2Zucm1tdmh2b3pnbm9vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ5NDc0MiwiZXhwIjoyMDk0MDcwNzQyfQ.KD_jmvsK9rWu7brpMIkpf6vfLpgkCBxsGFErdxjCh_I"
);

async function test() {
  const { data, error } = await supabase.from('security_audit_logs').select('*').limit(1);
  console.log("Audit logs:", data, error);
}

test();
