import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const testUrl = 'http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=75d33570c726b43ec0b3a06e1057a9c66329d88e3748c2107e38f878e9a76a29&text=לילה&sender=0548505808';

console.log('🧪 Testing Chat API\n');
console.log('URL:', testUrl);
console.log('');

fetch(testUrl)
  .then(res => res.json())
  .then(data => {
    console.log('✅ Response received:\n');
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
