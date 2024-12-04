const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const port = 3000;

const europeanaApiKey = 'nutchtfulor';

const allowedOrigins = [
  'http://localhost:3000',
  'https://jethermasidong.github.io/web-app',
  'http://127.0.0.1:5500',
  'https://web-app-mgx2.onrender.com'
];

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'upload.html'));
});

app.get('/collections', (req, res) => {
  res.sendFile(path.join(__dirname, 'collections.html'));
});

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

const db = new sqlite3.Database('./art_gallery.db', (err) => {
  if (err) {
    console.error('Error connecting to SQLite:', err.message);
  } else {
    console.log('Connected to SQLite database.');

    db.run(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        file_path TEXT NOT NULL,
        pin TEXT,
        date_created DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      } else {
        console.log('Table "items" is ready.');
      }
    });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDirectory = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDirectory)) {
      fs.mkdirSync(uploadDirectory, { recursive: true });
    }
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname);
    const fileName = Date.now() + fileExtension;
    cb(null, fileName);
  }
});

const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'upload.html'));
});

app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const { title, description, pin } = req.body;
  const filePath = `/uploads/${req.file.filename}`;

  const insertQuery = `
    INSERT INTO items (title, description, file_path, pin)
    VALUES (?, ?, ?, ?)
  `;
  db.run(insertQuery, [title, description, filePath, pin || null], (err) => {
    if (err) {
      console.error('Error inserting data into database:', err.message);
      return res.status(500).json({ message: 'Database error' });
    }

    res.status(200).json({ message: 'Art item uploaded successfully' });
  });

  console.log('Title:', title);
  console.log('Description:', description);
  console.log('PIN:', pin);
  console.log('Uploaded file:', req.file);
});

app.get('/art-items', (req, res) => {
  const selectQuery = 'SELECT * FROM items';
  db.all(selectQuery, [], (err, rows) => {
    if (err) {
      console.error('Error fetching art items:', err.message);
      return res.status(500).json({ message: 'Error fetching art items' });
    }
    res.status(200).json(rows); 
  });
});

app.get('/art-item/:id', (req, res) => {
  const artId = req.params.id;
  const selectQuery = 'SELECT * FROM items WHERE id = ?';
  
  db.get(selectQuery, [artId], (err, row) => {
    if (err) {
      console.error('Error fetching art item:', err.message);
      return res.status(500).json({ message: 'Error fetching art item' });
    }
    if (!row) {
      return res.status(404).json({ message: 'Art item not found' });
    }
    res.status(200).json(row);
  });
});

app.patch('/update-art/:id', upload.single('image'), (req, res) => {
  const artId = req.params.id;
  const { title, description, pin } = req.body;
  const filePath = req.file ? `/uploads/${req.file.filename}` : null;

  if (!pin) {
    return res.status(400).json({ message: 'PIN is required for update' });
  }

  db.get('SELECT * FROM items WHERE id = ?', [artId], (err, row) => {
    if (err) {
      console.error('Error fetching art item:', err.message);
      return res.status(500).json({ message: 'Error fetching art item' });
    }

    if (!row) {
      return res.status(404).json({ message: 'Art item not found' });
    }

    if (row.pin !== pin) {
      return res.status(403).json({ message: 'Invalid PIN' });
    }

    const updateQuery = `
      UPDATE items 
      SET title = ?, description = ?, pin = ?, file_path = ? 
      WHERE id = ?
    `;

    db.run(updateQuery, [title, description, pin || null, filePath, artId], function(err) {
      if (err) {
        console.error('Error updating art item:', err.message);
        return res.status(500).json({ message: 'Database error' });
      }
      if (this.changes > 0) {
        res.status(200).json({ message: 'Art item updated successfully' });
      } else {
        res.status(404).json({ message: 'Art item not found' });
      }
    });
  });
});

app.delete('/delete-art/:id', (req, res) => {
  const artId = req.params.id;
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ message: 'PIN is required' });
  }

  db.get('SELECT * FROM items WHERE id = ?', [artId], (err, row) => {
    if (err) {
      console.error('Error fetching art item:', err.message);
      return res.status(500).json({ message: 'Error fetching art item' });
    }

    if (!row) {
      return res.status(404).json({ message: 'Art item not found' });
    }

    console.log('Fetched item:', row); 

    if (row.pin !== pin) {
      console.log(`PIN mismatch: Provided PIN = ${pin}, Stored PIN = ${row.pin}`);
      return res.status(403).json({ message: 'Invalid PIN' });
    }

    const filePath = path.join(__dirname, 'uploads', path.basename(row.file_path));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`File ${filePath} deleted.`);
    } else {
      console.log(`File ${filePath} does not exist.`);
    }

    const deleteQuery = 'DELETE FROM items WHERE id = ?';

    db.run(deleteQuery, [artId], function(err) {
      if (err) {
        console.error('Error deleting art item:', err.message);
        return res.status(500).json({ message: 'Database error' });
      }

      if (this.changes > 0) {
        console.log(`Art item with id ${artId} deleted successfully.`);
        res.status(200).json({ message: 'Art item deleted successfully' });
      } else {
        console.log(`No changes made. Art item with id ${artId} not found.`);
        res.status(404).json({ message: 'Art item not found' });
      }
    });
  });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const PORT = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
