// set-ngrok-url.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

(async () => {
  try {
    const res = await axios.get('http://127.0.0.1:4040/api/tunnels');
    const tunnel = res.data.tunnels.find(t => t.proto === 'https');
    if (!tunnel) throw new Error('Не найден HTTPS туннель');

    const url = tunnel.public_url;
    const envPath = path.join(__dirname, '.env');

    const lines = fs.existsSync(envPath)
      ? fs.readFileSync(envPath, 'utf-8').split('\n')
      : [];

    const updated = lines.map(line =>
      line.startsWith('NGROK_URL=') ? `NGROK_URL=${url}` : line
    );

    if (!updated.find(line => line.startsWith('NGROK_URL='))) {
      updated.push(`NGROK_URL=${url}`);
    }

    fs.writeFileSync(envPath, updated.join('\n'), 'utf-8');
    console.log(`✅ Обновлён NGROK_URL: ${url}`);
  } catch (err) {
    console.error('❌ Ошибка при получении URL от ngrok:', err.message);
  }
})();
