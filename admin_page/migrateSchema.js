const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'products.db');
const scriptPath = __filename;

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error('❌ Ошибка подключения к базе:', err.message);
  console.log('📦 Подключено к базе данных:', dbPath);
});

const columns = ['description', 'sizes', 'fabric', 'delivery'];

function checkAndAddColumn(column) {
  return new Promise((resolve) => {
    db.get(`PRAGMA table_info(products)`, (err) => {
      if (err) return resolve(false);
    });

    db.all(`PRAGMA table_info(products)`, (err, columnsInfo) => {
      if (err) return resolve(false);
      const exists = columnsInfo.some(col => col.name === column);
      if (exists) {
        console.log(`✅ Поле '${column}' уже существует`);
        return resolve(true);
      }

      db.run(`ALTER TABLE products ADD COLUMN ${column} TEXT`, (alterErr) => {
        if (alterErr) {
          console.error(`❌ Ошибка добавления поля '${column}':`, alterErr.message);
          return resolve(false);
        }
        console.log(`✅ Поле '${column}' успешно добавлено`);
        resolve(true);
      });
    });
  });
}

(async () => {
  for (const col of columns) {
    await checkAndAddColumn(col);
  }

  db.close(() => {
    console.log('📁 Закрытие соединения с БД');
    // Удаляем скрипт после выполнения
    fs.unlink(scriptPath, (err) => {
      if (err) {
        console.error('⚠️ Не удалось удалить файл миграции:', err.message);
      } else {
        console.log('🧹 Скрипт миграции успешно удалён:', scriptPath);
      }
    });
  });
})();
