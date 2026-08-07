# Programador de publicaciones para Telegram

Web app para crear publicaciones (imagen/video + subtítulo opcional + viñetas
📌 opcionales + link 🔗 o método de instalación ⚙️) y programarlas para que se
envíen automáticamente a tu canal de Telegram en la fecha y hora que elijas.

Todo el stack es **gratuito**: Render (servidor) + Supabase (base de datos y
almacenamiento de imágenes/videos) + cron-job.org (el "reloj" que dispara los
envíos).

---

## 1. Crear tu bot de Telegram

1. Abre Telegram y busca **@BotFather**.
2. Envíale `/newbot` y sigue los pasos (nombre y usuario del bot).
3. Te dará un **token**, algo como `123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxx`.
   Guárdalo, es tu `TELEGRAM_BOT_TOKEN`.
4. Ve a tu canal de Telegram → **Administradores** → **Añadir administrador**
   → busca tu bot y agrégalo, dale permiso para publicar mensajes.
5. Obtener el **ID del canal**:
   - Si tu canal es público, puedes usar directamente `@tu_canal` como ID.
   - Si es privado, envía cualquier mensaje al canal y luego visita en el
     navegador:
     `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
     Busca `"chat":{"id": -100xxxxxxxxxx ...}` — ese número (con el signo
     `-100` incluido) es tu `TELEGRAM_CHANNEL_ID`.

---

## 2. Crear la base de datos (Supabase, gratis)

1. Ve a [supabase.com](https://supabase.com) → crea una cuenta → **New
   project** (elige una contraseña para la base de datos y guárdala).
2. Cuando el proyecto esté listo, ve a **SQL Editor** → **New query** y pega
   esto, luego dale **Run**:

```sql
create table posts (
  id uuid primary key default gen_random_uuid(),
  media_url text not null,
  media_type text not null,
  subtitle text,
  bullets text[],
  link_type text not null,
  link_value text not null,
  scheduled_at timestamptz not null,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now()
);
```

3. Ve a **Storage** → **New bucket** → nómbralo exactamente `posts-media` →
   márcalo como **Public bucket** → créalo.
4. Ve a **Storage → posts-media → Policies** y crea una policy que permita
   `INSERT` y `SELECT` a usuarios `anon` (puedes usar la plantilla "Allow
   access to everyone" que ofrece Supabase, es suficiente para este caso).
5. Ve a **Project Settings → API**. Ahí verás:
   - **Project URL** → es tu `SUPABASE_URL`.
   - **anon public key** → es tu `SUPABASE_ANON_KEY` (va en el frontend).
   - **service_role key** → es tu `SUPABASE_SERVICE_KEY` (va en el backend,
     **nunca la pongas en el frontend**, es secreta).

---

## 3. Configurar el proyecto

1. Sube esta carpeta a un repositorio de GitHub (o descárgala tal cual).
2. Copia `.env.example` a `.env` y rellena tus datos (esto es solo para
   probar en tu computadora; en Render se configuran como variables de
   entorno del panel, ver paso 4).
3. Abre `public/app.js` y reemplaza:
   ```js
   const SUPABASE_URL = 'TU_SUPABASE_URL';
   const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY';
   ```
   con los valores reales de tu proyecto Supabase (la **anon key**, no la
   service key).

### Probar en tu computadora (opcional)
```bash
npm install
npm start
```
Abre `http://localhost:3000`.

---

## 4. Desplegar gratis en Render

1. Ve a [render.com](https://render.com) → crea cuenta → **New → Web
   Service** → conecta tu repositorio de GitHub.
2. Configura:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free
3. En **Environment**, agrega estas variables (con tus valores reales):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHANNEL_ID`
   - `CRON_SECRET` (invéntate una clave larga, ej. `mi-clave-super-secreta-2026`)
4. Dale **Create Web Service**. En unos minutos tendrás tu URL, algo como
   `https://telegram-scheduler-xxxx.onrender.com`.

⚠️ El plan gratis de Render "duerme" el servicio tras ~15 min sin tráfico.
El siguiente paso soluciona justo eso.

---

## 5. Activar el envío automático (cron-job.org, gratis)

1. Ve a [cron-job.org](https://cron-job.org) → crea una cuenta gratis.
2. **Create cronjob**:
   - **URL:**
     `https://TU-APP.onrender.com/api/cron/check?secret=TU_CRON_SECRET`
     (usa la misma clave que pusiste en `CRON_SECRET`)
   - **Schedule:** cada 1 minuto.
3. Guarda. A partir de ahora, cada minuto este servicio visita tu app: la
   mantiene despierta y hace que revise si hay publicaciones pendientes para
   enviar a esa hora.

---

## 6. Usar la web

1. Abre tu URL de Render.
2. Sube la imagen o video, escribe el sub principal (opcional), agrega
   viñetas con ➕ (cada una se enviará con 📌 delante), elige si es un
   **link** 🔗 o un **método de instalación** ⚙️ y escribe su valor.
3. Elige la fecha y hora exacta de envío.
4. Dale **Programar publicación**. Aparecerá en la lista con estado
   `pending`. Cuando llegue la hora, cambiará a `sent` (o `error` si algo
   falló, revisa el token/ID del canal en ese caso).

---

## Cómo se ve el mensaje final en Telegram

```
*Sub principal aquí*

📌 Primera viñeta
📌 Segunda viñeta

🔗 https://tu-link.com
```
(o `⚙️ tu método de instalación` si elegiste esa opción en vez de link)
