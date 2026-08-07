// ====== CONFIGURA ESTO CON TUS DATOS DE SUPABASE ======
const SUPABASE_URL = 'https://ifzjvhcbppgttsvumvmz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlmemp2aGNicHBndHRzdnVtdm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwOTgxNDUsImV4cCI6MjEwMTY3NDE0NX0.EV87yC-eB5D7CEeI5oR_qofMvp2qtLiVwqrvb_JBpKY'; // la "anon public key", NO la service_role
// Si el backend vive en otro dominio distinto al de esta página, pon la URL completa aquí,
// por ejemplo: 'https://mi-backend.onrender.com'
const API_BASE = 'https://telegrambot-bhlr.onrender.com';
// ========================================================

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const form = document.getElementById('post-form');
const bulletsContainer = document.getElementById('bullets-container');
const addBulletBtn = document.getElementById('add-bullet');
const postsList = document.getElementById('posts-list');

addBulletBtn.addEventListener('click', () => {
  const row = document.createElement('div');
  row.className = 'bullet-row';
  row.innerHTML = `
    <span>📌</span>
    <input type="text" class="bullet-input" placeholder="Texto de la viñeta">
    <button type="button">✕</button>
  `;
  row.querySelector('button').addEventListener('click', () => row.remove());
  bulletsContainer.appendChild(row);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Subiendo...';

  try {
    const fileInput = document.getElementById('media');
    const file = fileInput.files[0];
    if (!file) throw new Error('Selecciona una imagen o video');
    const media_type = file.type.startsWith('video') ? 'video' : 'photo';

    // Subir el archivo directamente a Supabase Storage
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabaseClient
      .storage.from('posts-media')
      .upload(fileName, file);
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseClient
      .storage.from('posts-media')
      .getPublicUrl(fileName);
    const media_url = publicUrlData.publicUrl;

    const subtitle = document.getElementById('subtitle').value.trim();
    const bullets = Array.from(document.querySelectorAll('.bullet-input'))
      .map((i) => i.value.trim())
      .filter((v) => v);
    const link_type = document.querySelector('input[name="link_type"]:checked').value;
    const link_value = document.getElementById('link_value').value.trim();

    const scheduledLocal = document.getElementById('scheduled_at').value;
    if (!scheduledLocal) throw new Error('Selecciona fecha y hora');
    const scheduled_at = new Date(scheduledLocal).toISOString();

    const res = await fetch(`${API_BASE}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_url,
        media_type,
        subtitle,
        bullets,
        link_type,
        link_value,
        scheduled_at
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al guardar la publicación');
    }

    form.reset();
    bulletsContainer.innerHTML = '';
    loadPosts();
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Programar publicación';
  }
});

async function loadPosts() {
  const res = await fetch(`${API_BASE}/api/posts`);
  const posts = await res.json();

  if (!posts.length) {
    postsList.innerHTML = '<p style="color:#9fb0c3; font-size:14px;">Aún no hay publicaciones programadas.</p>';
    return;
  }

  postsList.innerHTML = posts.map((p) => `
    <div class="post-card status-${p.status}">
      ${p.media_type === 'photo' ? `<img src="${p.media_url}" onerror="this.style.display='none'">` : '<div style="width:60px;height:60px;background:#0f1620;border-radius:8px;display:flex;align-items:center;justify-content:center;">🎬</div>'}
      <div class="post-info">
        <strong>${p.subtitle || '(sin subtítulo)'}</strong>
        <p>📆 ${new Date(p.scheduled_at).toLocaleString()}</p>
        <span class="badge">${p.status}</span>
        ${p.status === 'pending' ? `<button onclick="deletePost('${p.id}')">Eliminar</button>` : ''}
      </div>
    </div>
  `).join('');
}

async function deletePost(id) {
  if (!confirm('¿Eliminar esta publicación programada?')) return;
  await fetch(`${API_BASE}/api/posts/${id}`, { method: 'DELETE' });
  loadPosts();
}

loadPosts();
