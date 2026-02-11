# Deploy the PDF combiner server (free)

The Chrome extension can use a **hosted** Python server so encrypted bank-statement PDFs combine correctly (PyPDF2 decrypt). Deploy once, then point the extension at your URL.

---

## Option 1: Render.com (recommended, free, no card)

1. **Sign up**: [render.com](https://render.com) — use GitHub or email (no credit card for free tier).

2. **New Web Service**:
   - Connect your GitHub repo (or push this project to a repo first).
   - **Root Directory**: leave blank (use repo root).
   - **Runtime**: Python 3.
   - **Build Command**:
   ```bash
   pip install -r server/requirements.txt
   ```
   - **Start Command**:
   ```bash
   gunicorn server.app:app --bind 0.0.0.0:$PORT
   ```
   - **Instance Type**: Free.

3. **Deploy**. Render gives you a URL like `https://feb-combiner.onrender.com`.

4. **Use in the extension**: In `chrome-extension/background.js`, set:
   ```js
   const COMBINER_SERVER_URL = 'https://YOUR-APP-NAME.onrender.com';
   ```
   (Replace with your actual Render URL.)

**Note**: Free tier sleeps after ~15 min idle. First request after sleep may take 30–60 seconds (cold start); later requests are fast.

---

## Option 2: PythonAnywhere (free)

1. Sign up at [pythonanywhere.com](https://www.pythonanywhere.com).
2. Create a new **Web app** (Flask), then open the project folder.
3. Upload or clone your repo. In the web app config, set:
   - **WSGI file**: e.g. `/home/yourusername/FEB_Auto_Reimbursor/server/app.wsgi` (create this — see below).
   - **Source code**: your project path.
4. Create `server/app.wsgi`:
   ```python
   import sys
   sys.path.insert(0, '/home/yourusername/FEB_Auto_Reimbursor')
   from server.app import app as application
   ```
5. In the **Virtualenv** section, create a venv and install:
   ```bash
   pip install -r server/requirements.txt
   ```
6. Reload the web app. Your URL will be like `https://yourusername.pythonanywhere.com`.
7. **Outbound**: Free tier allows HTTPS to most sites; if Drive downloads fail, check PythonAnywhere’s “Whitelist” for `drive.google.com`.

---

## Option 3: Replit (free)

1. Go to [replit.com](https://replit.com), create a new Repl, choose **Python**.
2. Upload your project (or clone from GitHub).
3. Create `.replit` or use **Run** configuration so the shell runs:
   ```bash
   cd /path/to/repo && pip install -r server/requirements.txt && gunicorn server.app:app --bind 0.0.0.0:5000
   ```
   Or add a **Run** script that does the same.
4. Use the Repl’s generated URL (e.g. `https://your-repl.your-username.repl.co`) and in the extension set `COMBINER_SERVER_URL` to that URL + no path (e.g. `https://xxx.repl.co`). Your app serves `/combine` at that host.

---

## After deployment

1. Test the server:
   ```bash
   curl -X POST https://YOUR-URL/combine \
     -H "Content-Type: application/json" \
     -d '{"link1":"https://drive.google.com/...", "link2":"https://drive.google.com/...", "filename":"test.pdf"}' \
     --output test.pdf
   ```
2. In the extension’s `background.js`, set `COMBINER_SERVER_URL` (or the config you added) to `https://YOUR-URL` (no trailing slash, no `/combine`).
3. Reload the extension and use the form; combining will go through your server and encrypted PDFs will work.
