require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const CRON_SECRET = process.env.CRON_SECRET;

// ---------- Utilidades ----------

function buildCaption(post) {
  let caption = '';

  if (post.subtitle) {
    caption += `*${post.subtitle}*\n\n`;
  }

  if (post.bullets && post.bullets.length) {
    caption += post.bullets.map((b) => `📌 ${b}`).join('\n') + '\n\n';
  }

  const icon = post.link_type === 'install' ? '⚙️' : '🔗';
  caption += `${icon} ${post.link_value}`;

  return caption;
}

async function sendToTelegram(post) {
  const caption = buildCaption(post);
  const method = post.media_type === 'video' ? 'sendVideo' : 'sendPhoto';
  const field = post.media_type === 'video' ? 'video' : 'photo';
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;

  const body = {
    chat_id: CHANNEL_ID,
    [field]: post.media_url,
    caption,
    parse_mode: 'Markdown'
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || 'Error desconocido de Telegram');
  }
  return data;
}

// ---------- Rutas API ----------

// Crear publicación programada
app.post('/api/posts', async (req, res) => {
  try {
    const {
      media_url,
      media_type,
      subtitle,
      bullets,
      link_type,
      link_value,
      scheduled_at
    } = req.body;

    if (!media_url || !media_type || !link_type || !link_value || !scheduled_at) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const { data, error } = await supabase
      .from('posts')
      .insert([
        {
          media_url,
          media_type,
          subtitle: subtitle || null,
          bullets: bullets && bullets.length ? bullets : null,
          link_type,
          link_value,
          scheduled_at,
          status: 'pending'
        }
      ])
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar publicaciones
app.get('/api/posts', async (req, res) => {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('scheduled_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Borrar publicación (solo si aún no se envió)
app.delete('/api/posts/:id', async (req, res) => {
  const { error } = await supabase.from('posts').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Revisión periódica: la llama un servicio externo (cron-job.org) cada minuto
app.get('/api/cron/check', async (req, res) => {
  if (req.query.secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { data: due, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString());

  if (error) return res.status(500).json({ error: error.message });

  const results = [];
  for (const post of due) {
    try {
      await sendToTelegram(post);
      await supabase.from('posts').update({ status: 'sent' }).eq('id', post.id);
      results.push({ id: post.id, ok: true });
    } catch (err) {
      await supabase
        .from('posts')
        .update({ status: 'error', error_message: err.message })
        .eq('id', post.id);
      results.push({ id: post.id, ok: false, error: err.message });
    }
  }

  res.json({ checked: due.length, results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
