const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'products.db'); // Путь к базе данных
const db = new sqlite3.Database(dbPath);

const fieldsToAdd = [
  { name: 'description', type: 'TEXT' },
  { name: 'sizes', type: 'TEXT' },
  { name: 'fabric', type: 'TEXT' },
  { name: 'delivery', type: 'TEXT' }
];

fieldsToAdd.forEach(field => {
  db.run(`ALTER TABLE products ADD COLUMN ${field.name} ${field.type}`, err => {
    if (err && !err.message.includes('duplicate')) {
      console.error(`❌ Ошибка при добавлении поля ${field.name}:`, err.message);
    } else if (!err) {
      console.log(`✅ Добавлено поле: ${field.name}`);
    }
  });
});

db.close(() => {
  console.log('🔄 Миграция завершена.');
});
