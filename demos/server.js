const http = require('http');
const path = require('path');
const { Worker } = require('worker_threads');

const PORT = 3000;

function sendJson(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(data));
}

function cpuWork(ms) {
    const end = Date.now() + ms;
    let value = 0;

    while (Date.now() < end) {
        value = Math.sqrt(value + Math.random() + 1);
    }

    return value;
}

function runWorker(ms) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(
            path.join(__dirname, 'cpu-worker.js'),
            { workerData: { ms } }
        );

        worker.once('message', resolve);
        worker.once('error', reject);
    });
}

const page = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Thread Lab</title>
  <style>
    body { font-family: Arial, sans-serif; background:#f4f7f5; color:#1f2937; }
    .wrap { max-width:900px; margin:35px auto; padding:20px; }
    .card { background:white; padding:22px; border-radius:18px; box-shadow:0 5px 20px #0001; margin-bottom:16px; }
    h1 { color:#0b6b3a; }
    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    .metric { padding:16px; border:1px solid #ddd; border-radius:14px; text-align:center; }
    .value { font-size:28px; font-weight:bold; }
    button { padding:12px 16px; border:0; border-radius:10px; cursor:pointer; margin:5px; font-weight:bold; }
    .main { background:#fee4e2; color:#b42318; }
    .worker { background:#eaf5ee; color:#0b6b3a; }
    #dot { display:inline-block; width:14px; height:14px; border-radius:50%; background:#12b76a; }
    #log { white-space:pre-wrap; background:#101828; color:#f2f4f7; padding:14px; border-radius:12px; min-height:90px; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>Node.js Thread Lab</h1>
    <p>Observe si el servidor puede seguir respondiendo mientras ejecuta una tarea CPU-bound.</p>
    <div class="grid">
      <div class="metric"><div>Servidor</div><div class="value"><span id="dot"></span> <span id="state">ACTIVO</span></div></div>
      <div class="metric"><div>Latencia /ping</div><div class="value"><span id="latency">-</span> ms</div></div>
      <div class="metric"><div>Respuestas</div><div class="value" id="ticks">0</div></div>
    </div>
  </div>

  <div class="card">
    <button class="main" onclick="run('/heavy-main')">Bloquear MAIN THREAD (4 s)</button>
    <button class="worker" onclick="run('/heavy-worker')">Ejecutar en WORKER (4 s)</button>
    <p>Mientras la tarea corre, mire el indicador del servidor y la latencia de /ping.</p>
    <div id="log">Listo.</div>
  </div>
</div>
<script>
let lastOk = Date.now();
let ticks = 0;

async function ping() {
  const start = performance.now();
  try {
    const r = await fetch('/ping?t=' + Date.now());
    await r.json();
    const ms = Math.round(performance.now() - start);
    lastOk = Date.now();
    ticks++;
    document.getElementById('latency').textContent = ms;
    document.getElementById('ticks').textContent = ticks;
  } catch (_) {}
}

setInterval(ping, 250);
setInterval(() => {
  const ok = Date.now() - lastOk < 900;
  document.getElementById('state').textContent = ok ? 'ACTIVO' : 'BLOQUEADO';
  document.getElementById('dot').style.background = ok ? '#12b76a' : '#f04438';
}, 150);

async function run(url) {
  const box = document.getElementById('log');
  box.textContent = 'Ejecutando ' + url + ' ...';
  const start = performance.now();
  try {
    const r = await fetch(url);
    const data = await r.json();
    box.textContent = JSON.stringify({
      endpoint: url,
      browserElapsedMs: Math.round(performance.now() - start),
      ...data
    }, null, 2);
  } catch (e) {
    box.textContent = e.message;
  }
}
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(page);
    }

    if (url.pathname === '/ping') {
        return sendJson(res, 200, { ok: true, time: new Date().toISOString() });
    }

    if (url.pathname === '/heavy-main') {
        const started = Date.now();
        cpuWork(4000); // BLOQUEA el Main Thread
        return sendJson(res, 200, {
            mode: 'main-thread',
            elapsedMs: Date.now() - started,
        });
    }

    if (url.pathname === '/heavy-worker') {
        const started = Date.now();
        const result = await runWorker(4000);
        return sendJson(res, 200, {
            mode: 'worker-thread',
            elapsedMs: Date.now() - started,
            workerThreadId: result.threadId,
        });
    }

    sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Thread Lab: http://localhost:${PORT}`);
});