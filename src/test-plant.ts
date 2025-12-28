import * as dotenv from 'dotenv';
import { LuxpowerClient } from './luxpower';

dotenv.config();

const LUXPOWER_USERNAME = process.env.LUXPOWER_USERNAME;
const LUXPOWER_PASSWORD = process.env.LUXPOWER_PASSWORD;
const LUXPOWER_API_ENDPOINT = process.env.LUXPOWER_API_ENDPOINT || 'https://eu.luxpowertek.com';
const LUXPOWER_PLANT_ID = process.env.LUXPOWER_PLANT_ID || process.env.LUXPOWER_SERIAL_NUM || '3263631998';

if (!LUXPOWER_USERNAME || !LUXPOWER_PASSWORD) {
  console.error('Error: LUXPOWER_USERNAME and LUXPOWER_PASSWORD must be set in .env file');
  process.exit(1);
}

async function testPlant(): Promise<void> {
  const luxpower = new LuxpowerClient(LUXPOWER_USERNAME!, LUXPOWER_PASSWORD!, LUXPOWER_API_ENDPOINT);

  try {
    console.log('Testing Plant ID:', LUXPOWER_PLANT_ID);
    console.log('Logging in...');
    
    const loggedIn = await luxpower.login();
    
    if (!loggedIn) {
      console.error('\n❌ Login failed. Please check the browser Network tab when logging in to see the actual API endpoint.');
      console.error('\nTo find the correct API:');
      console.error('1. Open https://eu.luxpowertek.com/WManage/web/monitor/inverter');
      console.error('2. Open Developer Tools (F12) → Network tab');
      console.error('3. Log in and look for the login API call');
      console.error('4. Share the endpoint URL and request format');
      process.exit(1);
    }

    console.log('✅ Login successful!');
    console.log('\nFetching inverter data...');
    
    const status = await luxpower.checkElectricityStatus(LUXPOWER_PLANT_ID);
    
    console.log('\n✅ Successfully retrieved data!');
    console.log('\nCurrent Status:');
    console.log(`  Electricity: ${status.hasElectricity ? 'ON ⚡' : 'OFF 🔌'}`);
    console.log(`  Grid Power: ${status.gridPower.toFixed(2)} W`);
    console.log(`  Timestamp: ${status.timestamp}`);
    
    console.log('\nRaw API Response (first 500 chars):');
    console.log(JSON.stringify(status.rawData, null, 2).substring(0, 500));
    
    console.log('\n✅ Test successful! You can now run the monitoring service with:');
    console.log('   npm run dev');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('\nThe API structure might be different. Please check the browser Network tab to see the actual API calls.');
    process.exit(1);
  }
}

testPlant();

