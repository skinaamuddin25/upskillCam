const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const db = require('./db');

const app = express();
const PORT = 3000;

// View engine and layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Static files (CSS)
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: '.' }),
  secret: 'verysecretkey',
  resave: false,
  saveUninitialized: false
}));

// Middleware: ensure logged in
function ensureLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// Ensure cart exists
app.use((req, res, next) => {
  if (!req.session.cart) {
    req.session.cart = [];
  }
  next();
});

// Home
app.get('/', (req, res) => {
  res.render('index', { user: req.session.user });
});

// Register
app.get('/register', (req, res) => {
  res.render('register', { user: req.session.user, error: null });
});

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.render('register', { user: req.session.user, error: 'All fields required' });
  }
  const hash = await bcrypt.hash(password, 10);
  db.run(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    [name, email, hash],
    function (err) {
      if (err) {
        return res.render('register', { user: req.session.user, error: 'Email already used' });
      }
      res.redirect('/login');
    }
  );
});

// Login
app.get('/login', (req, res) => {
  res.render('login', { user: req.session.user, error: null });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (!user) {
      return res.render('login', { user: req.session.user, error: 'Invalid credentials' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.render('login', { user: req.session.user, error: 'Invalid credentials' });
    }
    req.session.user = { id: user.id, name: user.name, email: user.email };
    res.redirect('/restaurants');
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Restaurants list
app.get('/restaurants', ensureLoggedIn, (req, res) => {
  db.all('SELECT * FROM restaurants', (err, rows) => {
    res.render('restaurants', { user: req.session.user, restaurants: rows });
  });
});

// Menu for a restaurant
app.get('/restaurants/:id/menu', ensureLoggedIn, (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM restaurants WHERE id = ?', [id], (err, restaurant) => {
    if (!restaurant) {
      return res.redirect('/restaurants');
    }
    db.all('SELECT * FROM menu_items WHERE restaurant_id = ?', [id], (err2, items) => {
      res.render('menu', {
        user: req.session.user,
        restaurant,
        items
      });
    });
  });
});

// Add to cart
app.post('/cart/add', ensureLoggedIn, (req, res) => {
  const { item_id, name, price } = req.body;
  const priceNum = parseFloat(price);
  const existing = req.session.cart.find(c => c.item_id === item_id);
  if (existing) {
    existing.quantity += 1;
  } else {
    req.session.cart.push({
      item_id,
      name,
      price: priceNum,
      quantity: 1
    });
  }
  res.redirect('back');
});

// View cart
app.get('/cart', ensureLoggedIn, (req, res) => {
  const cart = req.session.cart;
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  res.render('cart', { user: req.session.user, cart, total });
});

// Place order
app.post('/order', ensureLoggedIn, (req, res) => {
  const cart = req.session.cart;
  if (!cart || cart.length === 0) {
    return res.redirect('/cart');
  }
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const now = new Date().toISOString();
  db.run(
    'INSERT INTO orders (user_id, total_amount, created_at) VALUES (?, ?, ?)',
    [req.session.user.id, total, now],
    function (err) {
      if (err) return res.send('Error placing order');
      const orderId = this.lastID;
      const stmt = db.prepare(
        'INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)'
      );
      cart.forEach(item => {
        stmt.run(orderId, item.item_id, item.quantity, item.price);
      });
      stmt.finalize();
      req.session.cart = [];
      res.redirect('/orders');
    }
  );
});

// Orders list
app.get('/orders', ensureLoggedIn, (req, res) => {
  db.all(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
    [req.session.user.id],
    (err, rows) => {
      res.render('orders', { user: req.session.user, orders: rows });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});