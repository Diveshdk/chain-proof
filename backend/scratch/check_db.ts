import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log(`Checking connection to: ${supabaseUrl}`);

  // 1. Try to fetch table names from information_schema (if possible with service role)
  // Or just try to select from 'content' and check the error
  const { data, error } = await supabase.from('content').select('*').limit(1);

  if (error) {
    if (error.code === '42P01') {
      console.log('❌ Connection SUCCESS, but tables do NOT exist. (Error 42P01: relation "content" does not exist)');
    } else {
      console.log('❌ Connection FAILED:', error.message);
    }
  } else {
    console.log('✅ Connection SUCCESS and "content" table exists!');
  }
}

testConnection();
