import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ozruikfnrmmvhvozgnoo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_AI29BXJj4LnypToeSTKLJA_hVVoAdel';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testLimits() {
  console.log("Testing email rate limit (auth.updateUser)...");
  
  // Since we don't have a valid user session here, we will just try to invoke the edge function to see the error
  console.log("\nTesting Edge Function invocation...");
  const { data, error } = await supabase.functions.invoke('invite-operator', {
    body: { email: 'test@example.com', role: 'teacher' }
  });
  
  if (error) {
    console.error("Edge function error:", error.message);
  } else {
    console.log("Edge function success:", data);
  }
}

testLimits();
