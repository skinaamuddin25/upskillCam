const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./food_delivery.db');

db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);

  // Restaurants table
  db.run(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL
    )
  `);

  // Menu items
  db.run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    )
  `);

  // Orders
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Order items
  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    )
  `);

  // Seed restaurants and menu items
  db.get('SELECT COUNT(*) AS count FROM restaurants', (err, row) => {
    if (row && row.count === 0) {
      db.run(`INSERT INTO restaurants (name, address) VALUES 
        ('Spicy House', 'Main Street 1'),
        ('Pizza Point', 'Market Road 5')
      `);

      db.run(`INSERT INTO menu_items (restaurant_id, name, price) VALUES
        (1, 'Chicken Biryani', 150),
        (1, 'Paneer Butter Masala', 180),
        (2, 'Margherita Pizza', 200),
        (2, 'Veggie Pizza', 220)
      `);
    }
  });
});

module.exports = db;