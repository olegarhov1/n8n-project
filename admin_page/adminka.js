const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const axios = require('axios');
const { exec } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = 5000;

const BASE_URL = process.env.NGROK_URL || 'http://localhost:5000';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const imageDir = path.join(__dirname, '..', 'images');
const dbPath = path.join(__dirname, '..', 'products.db');
const db = new sqlite3.Database(dbPath);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(imageDir));

// ✅ Получение текущей ссылки сервера
app.get('/api/base-url', (req, res) => {
  res.json({ baseUrl: BASE_URL });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { brand, category, article } = req.body;
    const dir = path.join(imageDir, brand, category, article);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({ storage });

app.post('/api/products', upload.array('images', 20), (req, res) => {
  const { brand, category, article, description } = req.body;
  let { sizes = '', fabric = '', delivery = '' } = req.body;

  const images = req.files.map(file => {
    const relPath = path.join('images', brand, category, article, file.filename).replace(/\\/g, '/');
    return { fullUrl: `${BASE_URL}/${relPath}`, relPath };
  });

  const stmt = db.prepare(`
    INSERT INTO products (brand, category, article, description, sizes, fabric, delivery, image_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  images.forEach(({ relPath }) => {
    stmt.run(brand, category, article, description, sizes, fabric, delivery, relPath);
  });

  stmt.finalize();
  res.json({ success: true, message: `✅ Добавлено ${images.length} фото.` });
});

app.get('/api/products', (req, res) => {
  const query = `
    SELECT brand, category, article, description, sizes, fabric, delivery,
           GROUP_CONCAT(image_path) as images, MIN(id) as id
    FROM products
    GROUP BY brand, category, article
    ORDER BY id DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Ошибка при получении данных' });

    const formatted = rows.map(row => ({
      ...row,
      image_path_list: row.images ? row.images.split(',') : []
    }));

    res.json(formatted);
  });
});

// ✅ Обновление описания, размеров, состава, доставки
app.post('/api/products/update', (req, res) => {
  const { id, description, sizes, fabric, delivery } = req.body;

  const query = `
    UPDATE products 
    SET description = ?, sizes = ?, fabric = ?, delivery = ?
    WHERE id = ?
  `;

  db.run(query, [description, sizes, fabric, delivery, id], function (err) {
    if (err) {
      console.error('❌ Ошибка обновления товара:', err.message);
      return res.status(500).json({ success: false });
    }

    res.json({ success: true });
  });
});

// ✅ Отправка товара в Telegram
app.get('/run-telegram-script', (req, res) => {
  const folder = req.query.folder || '';
  const parts = folder.split('/');

  if (parts.length !== 4 || parts[0] !== 'images') {
    return res.json({ success: false, message: '❌ Неверный путь: ' + folder });
  }

  const [, brand, category, article] = parts;

  db.all(
    'SELECT * FROM products WHERE brand = ? AND category = ? AND article = ?',
    [brand, category, article],
    async (err, rows) => {
      if (err || rows.length === 0) {
        return res.json({ success: false, message: '❌ Товар не найден в базе данных' });
      }

      const row = rows[0];
      const caption = `🆕 ${row.brand} / ${row.category} / ${row.article}\n\n${row.description}\n📏 ${row.sizes}\n🧵 ${row.fabric}\n🚚 ${row.delivery}`;
      const images = rows.map(r => `${BASE_URL}/${r.image_path}`);

      const chunks = [];
      for (let i = 0; i < images.length; i += 10) {
        chunks.push(images.slice(i, i + 10));
      }

      try {
        for (let i = 0; i < chunks.length; i++) {
          const media = chunks[i].map((url, index) => ({
            type: 'photo',
            media: url,
            caption: i === chunks.length - 1 && index === chunks[i].length - 1 ? caption : undefined
          }));

          await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMediaGroup`, {
            chat_id: CHAT_ID,
            media
          }, {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        res.json({ success: true });
      } catch (err) {
        console.error('❌ Ошибка Telegram:', err.response?.data || err.message);
        res.json({ success: false, message: '❌ Ошибка при отправке в Telegram' });
      }
    }
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Админка запущена на http://0.0.0.0:${PORT}`);
});
