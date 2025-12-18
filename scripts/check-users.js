const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://yvepuccjiaktluxcpadk.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2ZXB1Y2NqaWFrdGx1eGNwYWRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc4MTEwOCwiZXhwIjoyMDgxMzU3MTA4fQ.pwz3eCrWLVJbQ5lE_VB7dly7lyE_z3vy1D9zkrcVT4E";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkUsers() {
  console.log('Checking profiles in Supabase...');
  
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, phone, first_name, last_name');

  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }

  console.log('Found profiles:', profiles.length);
  profiles.forEach(p => {
    console.log(`- ${p.email}: ${p.phone || 'NO PHONE'} (${p.first_name || ''} ${p.last_name || ''})`);
  });
}

checkUsers();
