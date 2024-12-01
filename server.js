const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors'); // Import CORS
const app = express();
const port = 3000;

app.use(cors({
  origin: 'https://your-frontend-domain.com'  // Specify your frontend URL here
}));

// Set up SQLite database
const db = new sqlite3.Database('./art_gallery.db', (err) => {
  if (err) {
    console.error('Error connecting to SQLite:', err.message);
  } else {
    console.log('Connected to SQLite database.');

    // Create 'items' table if it doesn't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        file_path TEXT NOT NULL,
        pin TEXT
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

// Set up multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Set the upload directory to 'public/uploads'
    const uploadDirectory = path.join(__dirname, 'public', 'uploads');

    // Ensure the uploads directory exists; create if it doesn't
    if (!fs.existsSync(uploadDirectory)) {
      fs.mkdirSync(uploadDirectory, { recursive: true });
    }

    cb(null, uploadDirectory); // Set the directory where files will be uploaded
  },
  filename: (req, file, cb) => {
    // Use a timestamp to avoid filename conflicts
    const fileExtension = path.extname(file.originalname);
    const fileName = Date.now() + fileExtension;
    cb(null, fileName); // Set the uploaded file's name
  }
});

const upload = multer({ storage: storage });

// Middleware to parse incoming form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Route to serve the upload form (optional, can be customized for your needs)
app.get('/upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});

// Route to handle file upload
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const { title, description, pin } = req.body;
  const filePath = `/uploads/${req.file.filename}`;

  // Insert data into SQLite database
  const insertQuery = `
    INSERT INTO items (title, description, file_path, pin)
    VALUES (?, ?, ?, ?)
  `;
  db.run(insertQuery, [title, description, filePath, pin || null], (err) => {
    if (err) {
      console.error('Error inserting data into database:', err.message);
      return res.status(500).json({ message: 'Database error' });
    }

    console.log('Data saved to database:', { title, description, filePath, pin });
    res.status(200).json({ message: 'Art item uploaded successfully' });
  });

  // Log the form data (title, description, pin) and file details for debugging
  console.log('Title:', title);
  console.log('Description:', description);
  console.log('PIN:', pin);
  console.log('Uploaded file:', req.file);
});

// Route to fetch all art items (Read)
app.get('/art-items', (req, res) => {
  const selectQuery = 'SELECT * FROM items';
  db.all(selectQuery, [], (err, rows) => {
    if (err) {
      console.error('Error fetching art items:', err.message);
      return res.status(500).json({ message: 'Error fetching art items' });
    }
    res.status(200).json({ artItems: rows });
  });
});

// Route to update an art item (Update)
app.put('/update-art/:id', upload.single('image'), (req, res) => {
  const artId = req.params.id;
  const { title, description, pin } = req.body;
  const filePath = req.file ? `/uploads/${req.file.filename}` : null;

  // Update query with optional file path
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

// Route to delete an art item (Delete)
app.delete('/delete-art/:id', (req, res) => {
  const artId = req.params.id;
  const deleteQuery = 'DELETE FROM items WHERE id = ?';

  db.run(deleteQuery, [artId], function(err) {
    if (err) {
      console.error('Error deleting art item:', err.message);
      return res.status(500).json({ message: 'Database error' });
    }
    if (this.changes > 0) {
      res.status(200).json({ message: 'Art item deleted successfully' });
    } else {
      res.status(404).json({ message: 'Art item not found' });
    }
  });
});

// Serve static files from the 'public/uploads' folder
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Start the server and listen on port 3000
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
