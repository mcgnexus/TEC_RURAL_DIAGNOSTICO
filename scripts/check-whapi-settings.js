// const fetch = require('node-fetch');

const WHAPI_TOKEN = "5nYNGKJjpLz4g96MAFj2Jo7Rj3QvQVNS";
const WHAPI_API_URL = "https://gate.whapi.cloud";

async function checkSettings() {
  console.log('Checking Whapi settings...');
  
  try {
    const url = `${WHAPI_API_URL}/settings`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WHAPI_TOKEN}`
      }
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log('Current Settings:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Error checking settings:', error);
  }
}

checkSettings();
