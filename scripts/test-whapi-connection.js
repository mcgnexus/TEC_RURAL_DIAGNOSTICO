// const fetch = require('node-fetch'); // Use global fetch in Node 18+

const WHAPI_TOKEN = "5nYNGKJjpLz4g96MAFj2Jo7Rj3QvQVNS";
const WHAPI_API_URL = "https://gate.whapi.cloud";
const TEST_NUMBER = "34614242716"; // The business number itself

async function testConnection() {
  console.log('Testing Whapi connection...');
  console.log(`URL: ${WHAPI_API_URL}`);
  console.log(`Token: ${WHAPI_TOKEN.substring(0, 10)}...`);

  // 1. Test Health/Status (if available, or just try to send a message)
  // Trying a simple message send to self
  try {
    const url = `${WHAPI_API_URL}/messages/text`;
    const payload = {
      to: `${TEST_NUMBER}@s.whatsapp.net`,
      body: "Test message from TEC Rural diagnostic script"
    };

    console.log(`\nAttempting to send message to ${payload.to}...`);
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WHAPI_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    
    const data = await res.text();
    console.log('Response body:', data);

    if (res.ok) {
      console.log('✅ Connection successful! Message sent.');
    } else {
      console.log('❌ Connection failed.');
    }

  } catch (error) {
    console.error('❌ Error executing test:', error);
  }
}

testConnection();
