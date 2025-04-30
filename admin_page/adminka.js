const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const stream = require('stream');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = 5000;

const db = new sqlite3.Database(path.join(__dirname, '..', 'products.db'));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

const SCOPES = ['https://www.googleapis.com/auth/drive'];
// const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'festive-nova-429210-b3-acf37ef44cdf.json');
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_JSON);

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: SCOPES
});


const driveService = google.drive({ version: 'v3', auth });
const ROOT_FOLDER_ID = '1v8KuHvik1BqXEJScTHygb2_w-y32tThW';

async function ensureFolder(name, parentId) {
  const q = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await driveService.files.list({ q, fields: 'files(id, name)' });
  if (res.data.files.length) return res.data.files[0].id;

  const folder = await driveService.files.create({
    resource: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    },
    fields: 'id'
  });
  return folder.data.id;
}

async function uploadToDrive({ brand, category, subcategory, article, file }) {
  const brandId = await ensureFolder(brand, ROOT_FOLDER_ID);
  const categoryId = await ensureFolder(category, brandId);
  const subcatId = await ensureFolder(subcategory, categoryId);
  const articleId = await ensureFolder(article, subcatId);

  const bufferStream = new stream.PassThrough();
  bufferStream.end(file.buffer);

  const driveRes = await driveService.files.create({
    requestBody: {
      name: `${Date.now()}-${file.originalname}`,
      parents: [articleId]
    },
    media: {
      mimeType: file.mimetype,
      body: bufferStream
    },
    fields: 'id, webContentLink'
  });

  return driveRes.data;
}

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/api/products', upload.array('images', 20), async (req, res) => {
  try {
    const { brand, category, subcategory, article, description = '', sizes = '', fabric = '', delivery = '' } = req.body;
    const files = req.files;
    const uploadedImages = [];

    for (const file of files) {
      const uploaded = await uploadToDrive({ brand, category, subcategory, article, file });
      const driveUrl = `https://drive.google.com/uc?id=${uploaded.id}`;
      uploadedImages.push(driveUrl);

      db.run(`INSERT INTO products (brand, category, article, description, sizes, fabric, delivery, image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [brand, category, article, description, sizes, fabric, delivery, driveUrl]);
    }

    res.json({ success: true, images: uploadedImages });
  } catch (err) {
    console.error('❌ Ошибка загрузки:', err.message);
    res.status(500).json({ success: false, message: 'Ошибка загрузки' });
  }
});

app.get('/api/products', (req, res) => {
  db.all(`
    SELECT brand, category, article, description, sizes, fabric, delivery,
           GROUP_CONCAT(image_path) as images, MIN(id) as id
    FROM products
    GROUP BY brand, category, article
    ORDER BY id DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Ошибка при получении данных' });
    const formatted = rows.map(row => ({ ...row, image_path_list: row.images ? row.images.split(',') : [] }));
    res.json(formatted);
  });
});

const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});


app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Сервер запущен на http://0.0.0.0:${PORT}`);
});

