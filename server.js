const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4599;
const DATA_FILE = path.join(__dirname, 'data', 'notes.json');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Data helpers ---

function readNotes() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeNotes(notes) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(notes, null, 2), 'utf-8');
}

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

// --- API Routes ---

// GET /api/notes — list all notes (newest first)
app.get('/api/notes', (_req, res) => {
  const notes = readNotes();
  notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ notes });
});

// POST /api/notes — create a new note
app.post('/api/notes', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Il testo dell\'appunto è obbligatorio.' });
  }
  if (text.trim().length > 500) {
    return res.status(400).json({ error: 'L\'appunto non può superare i 500 caratteri.' });
  }

  const note = {
    id: generateId(),
    text: text.trim(),
    votes: 0,
    comments: [],
    createdAt: new Date().toISOString(),
  };

  const notes = readNotes();
  notes.push(note);
  writeNotes(notes);

  res.status(201).json({ note });
});

// POST /api/notes/:id/vote — vote on a note
app.post('/api/notes/:id/vote', (req, res) => {
  const { id } = req.params;
  const { direction } = req.body;

  if (direction !== 'up' && direction !== 'down') {
    return res.status(400).json({ error: 'La direzione del voto deve essere "up" o "down".' });
  }

  const notes = readNotes();
  const note = notes.find((n) => n.id === id);
  if (!note) {
    return res.status(404).json({ error: 'Appunto non trovato.' });
  }

  note.votes += direction === 'up' ? 1 : -1;
  writeNotes(notes);

  res.json({ note });
});

// POST /api/notes/:id/comments — add a comment to a note
app.post('/api/notes/:id/comments', (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Il testo del commento è obbligatorio.' });
  }
  if (text.trim().length > 300) {
    return res.status(400).json({ error: 'Il commento non può superare i 300 caratteri.' });
  }

  const notes = readNotes();
  const note = notes.find((n) => n.id === id);
  if (!note) {
    return res.status(404).json({ error: 'Appunto non trovato.' });
  }

  const comment = {
    id: generateId(),
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };

  note.comments.push(comment);
  writeNotes(notes);

  res.status(201).json({ note });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bacheca server listening on http://0.0.0.0:${PORT}`);
});

module.exports = app;
