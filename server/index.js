import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as db from './db.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Large limit for base64 images

// Projects API
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await db.getProjects();
    res.json(projects);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    await db.saveProject(req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await db.deleteProject(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Characters API
app.get('/api/characters', async (req, res) => {
  try {
    const chars = await db.getCharacters();
    res.json(chars);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/characters', async (req, res) => {
  try {
    await db.saveCharacters(req.body); // Expects array of characters
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Settings API
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json(settings || {});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    await db.saveSettings(req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`BaoJian Backend Server running on http://localhost:${PORT}`);
});