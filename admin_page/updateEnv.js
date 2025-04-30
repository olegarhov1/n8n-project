const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '.env');

https.get('https://127.0.0.1:4040/api/tunnels', (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    try {
      const tunnels = JSON.parse(raw).tunnels;
      const httpsTunnel = tunnels.find(t => t.proto === 'https');
      if (!httpsTunnel) throw new Error('HTTPS туннель не найден');

      const newUrl = httpsTunnel.public_url;
      let envContent = fs.readFileSync(envPath, 'utf8');

      if (envContent.includes('NGROK_URL=')) {
        envContent = envContent.replace(/NGROK_URL=.*/g, `NGROK_URL=${newUrl}`);
      } else {
        envContent += `\nNGROK_URL=${newUrl}`;
      }

      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log(`✅ NGROK_URL обновлён: ${newUrl}`);
    } catch (err) {
      console.error('❌ Не удалось обновить .env:', err.message);
    }
  });
}).on('error', err => {
  console.error('❌ Ошибка подключения к ngrok API:', err.message);
});
