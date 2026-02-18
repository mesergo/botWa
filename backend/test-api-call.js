import fetch from 'node-fetch';

const url = 'http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=75d33570c726b43ec0b3a06e1057a9c66329d88e3748c2107e38f878e9a76a29&text=יום&sender=0548505808';

console.log('Testing chat API...');
console.log('URL:', url);

try {
  const response = await fetch(url);
  const data = await response.json();
  console.log('\n📬 Response:');
  console.log(JSON.stringify(data, null, 2));
} catch (error) {
  console.error('❌ Error:', error.message);
}
