require('dotenv').config();
const crypto = require('node:crypto');
const express = require('express');

const app = express();
const PORT = Number(process.env.OLLAMA_PROXY_PORT || 11435);
const API_KEY = process.env.OLLAMA_API_KEY || '';
const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';

if (API_KEY.length < 32) {
  throw new Error('Configura OLLAMA_API_KEY con un token aleatorio de al menos 32 caracteres.');
}

app.use(express.json({ limit: '1mb' }));

app.post('/api/chat', async (req, res) => {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const providedKey = Buffer.from(token);
  const configuredKey = Buffer.from(API_KEY);

  if (providedKey.length !== configuredKey.length ||
      !crypto.timingSafeEqual(providedKey, configuredKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const upstream = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(120000)
    });
    res.status(upstream.status);
    res.set('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error(`Local Ollama request failed: ${error.message}`);
    res.status(502).json({ error: 'No se pudo conectar con Ollama en este equipo.' });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Proxy local de Ollama escuchando en 127.0.0.1:${PORT}`);
});
