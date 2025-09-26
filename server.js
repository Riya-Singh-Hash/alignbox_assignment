// server.js - Clean, tested server for chat UI
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const path = require('path');
const cors = require('cors');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'chat_ui';

async function initDb() {
  const safeDb = String(DB_NAME).replace(/[^a-zA-Z0-9_]/g, '') || 'chat_ui';
  console.log('Initializing DB:', safeDb);
  const tmp = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD });
  await tmp.query('CREATE DATABASE IF NOT EXISTS `' + safeDb + '`');
  await tmp.end();

  const pool = mysql.createPool({
    host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: safeDb,
    waitForConnections: true, connectionLimit: 10
  });

  await pool.query(
    `CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      color VARCHAR(20) DEFAULT '#e74c3c',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  return pool;
}

(async () => {
  try {
    const pool = await initDb();
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server);

    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));

    app.get('/messages', async (req, res) => {
      try {
        const [rows] = await pool.query('SELECT * FROM messages ORDER BY id ASC');
        res.json(rows);
      } catch (err) {
        console.error('/messages error', err);
        res.status(500).json({ error: 'db' });
      }
    });

    app.post('/messages', async (req, res) => {
      const { username, content, color } = req.body;
      if (!content) return res.status(400).json({ error: 'content required' });
      try {
        const [result] = await pool.query('INSERT INTO messages (username, content, color) VALUES (?, ?, ?)', [username || 'Anonymous', content, color || '#e74c3c']);
        const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
        const message = rows[0];
        io.emit('message', message);
        res.json(message);
      } catch (err) {
        console.error('POST /messages error', err);
        res.status(500).json({ error: 'db' });
      }
    });

    io.on('connection', (socket) => {
      console.log('Client connected', socket.id);
      socket.on('sendMessage', async (msg) => {
        try {
          console.log('recv sendMessage', msg);
          const [result] = await pool.query('INSERT INTO messages (username, content, color) VALUES (?, ?, ?)', [msg.username || 'Anonymous', msg.content, msg.color || '#e74c3c']);
          const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
          const message = rows[0];
          io.emit('message', message);
        } catch (err) {
          console.error('socket sendMessage error', err);
        }
      });
      socket.on('disconnect', () => { console.log('Client disconnected', socket.id); });
    });

    server.listen(PORT, () => console.log('Server running on port', PORT));
  } catch (err) {
    console.error('Startup error', err);
    process.exit(1);
  }
})();
