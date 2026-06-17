import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;

async function test() {
  console.log('Authenticating as dev@obylon.com...');
  try {
    const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'dev@obylon.com',
        password: 'UmbraDev'
      })
    });
    
    const authData = await authRes.json();
    if (!authRes.ok) {
      console.error('Auth error:', authData);
      return;
    }

    const token = authData.access_token;
    const userId = authData.user.id;
    console.log('Authenticated user:', userId);

    console.log('Testing ban mutation on target:', userId);
    
    const updateRes = await fetch(`${url}/rest/v1/profiles?user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ is_banned: true })
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      console.log('Update result error:', errorText);
    } else {
      const data = await updateRes.json();
      console.log('Update result success:', data);
    }
  } catch(e) {
    console.error('Fetch error:', e);
  }
}

test();
