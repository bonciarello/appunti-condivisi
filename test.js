/**
 * Test suite for Bacheca API
 * Run with: node test.js
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const PORT = process.env.TEST_PORT || 45999;
const BASE = `http://localhost:${PORT}`;

let server;

// --- Helper: make HTTP requests ---
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// --- Setup & Teardown ---
before(async () => {
  // Start the server on a test port
  const app = require('./server');
  return new Promise((resolve) => {
    server = app.listen(PORT, '0.0.0.0', () => {
      resolve();
    });
  });
});

after(() => {
  if (server) server.close();
});

// --- Tests ---

describe('Bacheca API', () => {
  let createdNoteId;

  test('GET /api/notes — returns empty list initially', async () => {
    const { status, body } = await request('GET', '/api/notes');
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.notes));
  });

  test('POST /api/notes — creates a new note', async () => {
    const { status, body } = await request('POST', '/api/notes', {
      text: 'Questo è un appunto di test',
    });
    assert.equal(status, 201);
    assert.ok(body.note);
    assert.equal(body.note.text, 'Questo è un appunto di test');
    assert.equal(body.note.votes, 0);
    assert.ok(Array.isArray(body.note.comments));
    assert.ok(body.note.id);
    assert.ok(body.note.createdAt);
    createdNoteId = body.note.id;
  });

  test('POST /api/notes — rejects empty text', async () => {
    const { status, body } = await request('POST', '/api/notes', { text: '' });
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  test('POST /api/notes — rejects whitespace-only text', async () => {
    const { status, body } = await request('POST', '/api/notes', { text: '   ' });
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  test('POST /api/notes — rejects overly long text', async () => {
    const { status, body } = await request('POST', '/api/notes', {
      text: 'x'.repeat(501),
    });
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  test('GET /api/notes — contains the created note', async () => {
    const { status, body } = await request('GET', '/api/notes');
    assert.equal(status, 200);
    assert.ok(body.notes.length >= 1);
    const found = body.notes.find((n) => n.id === createdNoteId);
    assert.ok(found);
    assert.equal(found.text, 'Questo è un appunto di test');
  });

  test('POST /api/notes/:id/vote — upvotes a note', async () => {
    const { status, body } = await request('POST', `/api/notes/${createdNoteId}/vote`, {
      direction: 'up',
    });
    assert.equal(status, 200);
    assert.equal(body.note.votes, 1);
  });

  test('POST /api/notes/:id/vote — upvotes again', async () => {
    const { status, body } = await request('POST', `/api/notes/${createdNoteId}/vote`, {
      direction: 'up',
    });
    assert.equal(status, 200);
    assert.equal(body.note.votes, 2);
  });

  test('POST /api/notes/:id/vote — downvotes a note', async () => {
    const { status, body } = await request('POST', `/api/notes/${createdNoteId}/vote`, {
      direction: 'down',
    });
    assert.equal(status, 200);
    assert.equal(body.note.votes, 1);
  });

  test('POST /api/notes/:id/vote — rejects invalid direction', async () => {
    const { status, body } = await request('POST', `/api/notes/${createdNoteId}/vote`, {
      direction: 'sideways',
    });
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  test('POST /api/notes/:id/vote — 404 on non-existent note', async () => {
    const { status, body } = await request('POST', '/api/notes/nonexistent/vote', {
      direction: 'up',
    });
    assert.equal(status, 404);
    assert.ok(body.error);
  });

  test('POST /api/notes/:id/comments — adds a comment', async () => {
    const { status, body } = await request('POST', `/api/notes/${createdNoteId}/comments`, {
      text: 'Questo è un commento',
    });
    assert.equal(status, 201);
    assert.equal(body.note.comments.length, 1);
    assert.equal(body.note.comments[0].text, 'Questo è un commento');
    assert.ok(body.note.comments[0].id);
    assert.ok(body.note.comments[0].createdAt);
  });

  test('POST /api/notes/:id/comments — adds a second comment', async () => {
    const { status, body } = await request('POST', `/api/notes/${createdNoteId}/comments`, {
      text: 'Secondo commento',
    });
    assert.equal(status, 201);
    assert.equal(body.note.comments.length, 2);
    assert.equal(body.note.comments[1].text, 'Secondo commento');
  });

  test('POST /api/notes/:id/comments — rejects empty comment', async () => {
    const { status, body } = await request('POST', `/api/notes/${createdNoteId}/comments`, {
      text: '',
    });
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  test('POST /api/notes/:id/comments — rejects overly long comment', async () => {
    const { status, body } = await request('POST', `/api/notes/${createdNoteId}/comments`, {
      text: 'x'.repeat(301),
    });
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  test('POST /api/notes/:id/comments — 404 on non-existent note', async () => {
    const { status, body } = await request('POST', '/api/notes/nonexistent/comments', {
      text: 'Commento',
    });
    assert.equal(status, 404);
    assert.ok(body.error);
  });

  test('Full note lifecycle: create, vote, comment, verify', async () => {
    // Create
    const create = await request('POST', '/api/notes', { text: 'Nota del ciclo vita' });
    assert.equal(create.status, 201);
    const nid = create.body.note.id;

    // Vote up twice
    await request('POST', `/api/notes/${nid}/vote`, { direction: 'up' });
    await request('POST', `/api/notes/${nid}/vote`, { direction: 'up' });

    // Vote down once
    await request('POST', `/api/notes/${nid}/vote`, { direction: 'down' });

    // Comment
    await request('POST', `/api/notes/${nid}/comments`, { text: 'Ciclo vita ok' });

    // Verify
    const list = await request('GET', '/api/notes');
    const found = list.body.notes.find((n) => n.id === nid);
    assert.ok(found);
    assert.equal(found.votes, 1);
    assert.equal(found.comments.length, 1);
    assert.equal(found.comments[0].text, 'Ciclo vita ok');
  });

  test('GET /api/notes — notes are sorted newest first', async () => {
    // Create two notes with a small delay
    await request('POST', '/api/notes', { text: 'Nota più vecchia' });
    await new Promise((r) => setTimeout(r, 100));
    await request('POST', '/api/notes', { text: 'Nota più nuova' });

    const { body } = await request('GET', '/api/notes');
    assert.ok(body.notes.length >= 2);
    const newest = body.notes[0];
    assert.equal(newest.text, 'Nota più nuova');
  });

  test('Server serves static files', async () => {
    const { status } = await request('GET', '/');
    assert.equal(status, 200);
  });

  test('Server serves robots.txt', async () => {
    const { status } = await request('GET', '/robots.txt');
    assert.equal(status, 200);
  });

  test('Server serves sitemap.xml', async () => {
    const { status } = await request('GET', '/sitemap.xml');
    assert.equal(status, 200);
  });
});
