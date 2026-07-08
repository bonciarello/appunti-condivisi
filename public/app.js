/**
 * Bacheca — Frontend logic
 * Handles notes, voting, comments, and UI interactions
 */

(function () {
  'use strict';

  // --- DOM references ---
  const form = document.getElementById('new-note-form');
  const noteText = document.getElementById('note-text');
  const charCount = document.getElementById('char-count');
  const noteError = document.getElementById('note-error');
  const notesContainer = document.getElementById('notes-container');
  const emptyState = document.getElementById('empty-state');
  const noteTemplate = document.getElementById('note-template');

  // --- State ---
  let notes = [];

  // --- API helpers ---
  async function apiCall(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Errore di rete');
    }
    return data;
  }

  // --- Toast ---
  function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 3000);
  }

  // --- Format date ---
  function formatDate(isoString) {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Adesso';
    if (diffMin < 60) return `${diffMin} min fa`;

    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} ${diffH === 1 ? 'ora' : 'ore'} fa`;

    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD} ${diffD === 1 ? 'giorno' : 'giorni'} fa`;

    return d.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDateLong(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // --- Random tilt for note cards ---
  function randomTilt() {
    return (Math.random() - 0.5) * 2; // -1 to +1 degrees
  }

  // --- Character count ---
  noteText.addEventListener('input', function () {
    const len = this.value.length;
    charCount.textContent = `${len} / 500`;
    charCount.classList.toggle('warn', len > 400);
    charCount.classList.toggle('over', len > 500);
  });

  // --- New note form ---
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    noteError.textContent = '';

    const text = noteText.value.trim();
    if (!text) {
      noteError.textContent = 'Scrivi qualcosa prima di aggiungere l\'appunto.';
      noteText.focus();
      return;
    }
    if (text.length > 500) {
      noteError.textContent = 'L\'appunto è troppo lungo (massimo 500 caratteri).';
      noteText.focus();
      return;
    }

    try {
      const data = await apiCall('POST', 'api/notes', { text });
      notes.unshift(data.note);
      noteText.value = '';
      charCount.textContent = '0 / 500';
      charCount.classList.remove('warn', 'over');
      renderNotes();
      showToast('Appunto aggiunto alla bacheca!');
    } catch (err) {
      noteError.textContent = err.message;
    }
  });

  // --- Vote ---
  async function handleVote(noteId, direction) {
    try {
      const data = await apiCall('POST', `api/notes/${noteId}/vote`, { direction });
      const idx = notes.findIndex((n) => n.id === noteId);
      if (idx !== -1) {
        notes[idx] = data.note;
        updateNoteCard(noteId);
      }
    } catch (err) {
      showToast(err.message);
    }
  }

  // --- Comment ---
  async function handleComment(noteId, commentText, formEl, errorEl, inputEl) {
    errorEl.textContent = '';
    const text = commentText.trim();
    if (!text) {
      errorEl.textContent = 'Scrivi un commento.';
      return;
    }
    if (text.length > 300) {
      errorEl.textContent = 'Commento troppo lungo (massimo 300 caratteri).';
      return;
    }

    try {
      const data = await apiCall('POST', `api/notes/${noteId}/comments`, { text });
      const idx = notes.findIndex((n) => n.id === noteId);
      if (idx !== -1) {
        notes[idx] = data.note;
        updateNoteCard(noteId);
      }
      inputEl.value = '';
    } catch (err) {
      errorEl.textContent = err.message;
    }
  }

  // --- Update a single card without full re-render ---
  function updateNoteCard(noteId) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    const card = document.querySelector(`[data-note-id="${noteId}"]`);
    if (!card) return;

    // Update vote count
    const countEl = card.querySelector('.vote-count');
    countEl.textContent = note.votes;
    countEl.classList.toggle('positive', note.votes > 0);
    countEl.classList.toggle('negative', note.votes < 0);

    // Update comments
    const commentsList = card.querySelector('.comments-list');
    commentsList.innerHTML = '';
    note.comments.forEach((comment, idx) => {
      const commentEl = createCommentElement(comment, idx);
      commentsList.appendChild(commentEl);
    });

    // If no comments, show a subtle message
    if (note.comments.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'comment-text';
      emptyMsg.style.color = 'var(--color-text-muted)';
      emptyMsg.style.fontStyle = 'italic';
      emptyMsg.textContent = 'Nessun commento. Scrivi il primo!';
      commentsList.appendChild(emptyMsg);
    }
  }

  function createCommentElement(comment, index) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.style.animationDelay = `${index * 40}ms`;
    div.innerHTML = `
      <p class="comment-text">${escapeHtml(comment.text)}</p>
      <time class="comment-date" datetime="${comment.createdAt}">${formatDate(comment.createdAt)}</time>
    `;
    return div;
  }

  // --- Escape HTML ---
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Render all notes ---
  function renderNotes() {
    notesContainer.innerHTML = '';

    if (notes.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    notes.forEach((note, idx) => {
      const clone = noteTemplate.content.cloneNode(true);
      const card = clone.querySelector('.note-card');

      card.setAttribute('data-note-id', note.id);
      card.style.setProperty('--tilt', `${randomTilt()}deg`);
      card.style.animationDelay = `${idx * 50}ms`;

      // Text
      card.querySelector('.note-text').textContent = note.text;

      // Date
      const timeEl = card.querySelector('.note-date');
      timeEl.setAttribute('datetime', note.createdAt);
      timeEl.textContent = formatDateLong(note.createdAt);

      // Vote count
      const countEl = card.querySelector('.vote-count');
      countEl.textContent = note.votes;
      countEl.classList.toggle('positive', note.votes > 0);
      countEl.classList.toggle('negative', note.votes < 0);

      // Vote buttons
      const upBtn = card.querySelector('.btn-vote-up');
      const downBtn = card.querySelector('.btn-vote-down');
      upBtn.addEventListener('click', () => handleVote(note.id, 'up'));
      downBtn.addEventListener('click', () => handleVote(note.id, 'down'));

      // Comment toggle
      const toggleBtn = card.querySelector('.btn-comment-toggle');
      const commentsSection = card.querySelector('.comments-section');
      toggleBtn.addEventListener('click', () => {
        const isOpen = toggleBtn.getAttribute('aria-expanded') === 'true';
        toggleBtn.setAttribute('aria-expanded', String(!isOpen));
        commentsSection.hidden = isOpen;
      });

      // Comments list
      const commentsList = card.querySelector('.comments-list');
      if (note.comments.length > 0) {
        note.comments.forEach((comment, cIdx) => {
          commentsList.appendChild(createCommentElement(comment, cIdx));
        });
      } else {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'comment-text';
        emptyMsg.style.color = 'var(--color-text-muted)';
        emptyMsg.style.fontStyle = 'italic';
        emptyMsg.textContent = 'Nessun commento. Scrivi il primo!';
        commentsList.appendChild(emptyMsg);
      }

      // Comment form
      const commentForm = card.querySelector('.comment-form');
      const commentInput = card.querySelector('.comment-input');
      const commentError = card.querySelector('.comment-error');
      commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleComment(note.id, commentInput.value, commentForm, commentError, commentInput);
      });

      notesContainer.appendChild(card);
    });
  }

  // --- Load notes ---
  async function loadNotes() {
    try {
      const data = await apiCall('GET', 'api/notes');
      notes = data.notes;
      renderNotes();
    } catch (err) {
      showToast('Impossibile caricare gli appunti: ' + err.message);
    }
  }

  // --- Polling for shared updates ---
  let pollTimer = null;
  function startPolling() {
    const INTERVAL = 8000; // poll every 8 seconds
    pollTimer = setInterval(async () => {
      try {
        const data = await apiCall('GET', 'api/notes');
        const oldIds = new Set(notes.map((n) => n.id));
        const newIds = new Set(data.notes.map((n) => n.id));
        const hasNew = data.notes.some((n) => !oldIds.has(n.id));

        // Check if any existing note changed votes or comments
        let hasChanges = hasNew || data.notes.length !== notes.length;
        if (!hasChanges) {
          for (const newNote of data.notes) {
            const oldNote = notes.find((n) => n.id === newNote.id);
            if (oldNote && (oldNote.votes !== newNote.votes || oldNote.comments.length !== newNote.comments.length)) {
              hasChanges = true;
              break;
            }
          }
        }

        if (hasChanges) {
          notes = data.notes;
          renderNotes();
        }
      } catch {
        // Silently ignore polling errors
      }
    }, INTERVAL);
  }

  // --- Init ---
  loadNotes().then(() => {
    startPolling();
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer);
  });
})();
