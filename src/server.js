const http = require('http');
const os = require('os');
const { TicketManager } = require('./ticket-manager');
const { WorkerPool } = require('./worker-pool');
const { runCpuBoundTask } = require('./cpu-task');

const PORT = process.env.PORT || 3000;
const INITIAL_SPOTS = parseInt(process.env.INITIAL_SPOTS || '20', 10);
const STORAGE_MODE = process.env.STORAGE_MODE || 'local'; // 'local' | 'redis'
const CPU_MODE = process.env.CPU_MODE || 'none'; // 'none' | 'main' | 'worker'
const MAX_WORKERS = parseInt(process.env.MAX_WORKERS || '4', 10);
const CPU_WORK_MS = parseInt(process.env.CPU_WORK_MS || '80', 10);

const ticketManager = new TicketManager({
    initialSpots: INITIAL_SPOTS,
    mode: STORAGE_MODE,
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379', 10)
});

const workerPool = new WorkerPool(MAX_WORKERS);

function sendJson(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
}

function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch {
                resolve({});
            }
        });
    });
}

const htmlDashboard = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TicketRush - Concurrencia Distribuida</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --accent: #38bdf8;
      --success: #22c55e;
      --danger: #ef4444;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); padding: 24px; }
    .container { max-width: 1000px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    h1 { font-size: 26px; color: var(--accent); }
    .badge { padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; background: #334155; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: var(--card); border-radius: 12px; padding: 18px; border: 1px solid #334155; }
    .card-title { font-size: 13px; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; }
    .card-value { font-size: 32px; font-weight: bold; }
    .card-value.green { color: var(--success); }
    .card-value.red { color: var(--danger); }
    .card-value.blue { color: var(--accent); }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
    button {
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      border: 0;
      border-radius: 8px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover { opacity: 0.9; }
    .btn-reserve { background: var(--success); color: #000; }
    .btn-reserve-cpu { background: #eab308; color: #000; }
    .btn-reset { background: var(--danger); color: #fff; }
    .btn-mode { background: #3b82f6; color: #fff; }
    pre {
      background: #090d16;
      border: 1px solid #1e293b;
      padding: 16px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
      color: #38bdf8;
      max-height: 250px;
      overflow-y: auto;
    }
    .status-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
    .dot-ok { background: var(--success); box-shadow: 0 0 8px var(--success); }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      <h1>🎟️ TicketRush Lab</h1>
      <p style="color:var(--muted); font-size:14px; margin-top:4px;">Consistencia y Concurrencia Distribuida</p>
    </div>
    <div>
      <span class="badge" id="podBadge">Pod: cargando...</span>
      <span class="badge" id="storageBadge">Storage: cargando...</span>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-title">Cupos Disponibles</div>
      <div class="card-value blue" id="avail">--</div>
    </div>
    <div class="card">
      <div class="card-title">Reservas Aprobadas</div>
      <div class="card-value green" id="approved">--</div>
    </div>
    <div class="card">
      <div class="card-title">Reservas Rechazadas</div>
      <div class="card-value red" id="rejected">--</div>
    </div>
    <div class="card">
      <div class="card-title">Latencia /ping</div>
      <div class="card-value" id="latency"><span class="status-dot dot-ok"></span>-- ms</div>
    </div>
  </div>

  <div class="actions">
    <button class="btn-reserve" onclick="callReserve('none')">POST /reserve (Normal)</button>
    <button class="btn-reserve-cpu" onclick="callReserve('main')">POST /reserve (CPU Main Thread)</button>
    <button class="btn-reserve" style="background:#06b6d4; color:#fff" onclick="callReserve('worker')">POST /reserve (CPU Worker Thread)</button>
    <button class="btn-reset" onclick="callReset()">POST /reset (Reiniciar a 20)</button>
  </div>

  <div class="card">
    <div class="card-title">Registro de Respuestas API</div>
    <pre id="output">// Respuestas de las peticiones aparecerán aquí...</pre>
  </div>
</div>

<script>
async function refreshStatus() {
  try {
    const t0 = performance.now();
    const [resStatus, resPing] = await Promise.all([
      fetch('/status'),
      fetch('/ping')
    ]);
    const lat = Math.round(performance.now() - t0);
    const data = await resStatus.json();
    const pingData = await resPing.json();

    document.getElementById('avail').textContent = data.available;
    document.getElementById('approved').textContent = data.approved;
    document.getElementById('rejected').textContent = data.rejected;
    document.getElementById('podBadge').textContent = 'Pod: ' + data.pod;
    document.getElementById('storageBadge').textContent = 'Storage: ' + data.storage.toUpperCase();
    document.getElementById('latency').innerHTML = '<span class="status-dot dot-ok"></span> ' + lat + ' ms';
  } catch (err) {
    document.getElementById('latency').innerHTML = '<span class="status-dot" style="background:var(--danger)"></span> Timeout';
  }
}

async function callReserve(cpuMode) {
  const pre = document.getElementById('output');
  pre.textContent = 'Enviando POST /reserve (cpu=' + cpuMode + ')...';
  const t0 = performance.now();
  try {
    const res = await fetch('/reserve?cpu=' + cpuMode, { method: 'POST' });
    const data = await res.json();
    data.clientLatencyMs = Math.round(performance.now() - t0);
    pre.textContent = JSON.stringify(data, null, 2);
    refreshStatus();
  } catch (err) {
    pre.textContent = 'Error: ' + err.message;
  }
}

async function callReset() {
  const pre = document.getElementById('output');
  pre.textContent = 'Enviando POST /reset...';
  try {
    const res = await fetch('/reset', { method: 'POST' });
    const data = await res.json();
    pre.textContent = JSON.stringify(data, null, 2);
    refreshStatus();
  } catch (err) {
    pre.textContent = 'Error: ' + err.message;
  }
}

setInterval(refreshStatus, 800);
refreshStatus();
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const method = req.method.toUpperCase();
    const hostname = os.hostname();

    // CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    // 1. Dashboard UI
    if (url.pathname === '/' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(htmlDashboard);
    }

    // 2. GET /ping (Health check y medición de latencia)
    if (url.pathname === '/ping' && method === 'GET') {
        return sendJson(res, 200, {
            ok: true,
            timestamp: Date.now(),
            pod: hostname
        });
    }

    // 3. GET /status (Consulta de estado)
    if (url.pathname === '/status' && method === 'GET') {
        const status = await ticketManager.getStatus();
        const poolStats = workerPool.getStats();

        return sendJson(res, 200, {
            ...status,
            pod: hostname,
            cpuMode: CPU_MODE,
            ...poolStats
        });
    }

    // 4. POST /reset (Reinicia cupos a 20)
    if (url.pathname === '/reset' && method === 'POST') {
        const result = await ticketManager.reset();
        return sendJson(res, 200, {
            ...result,
            pod: hostname
        });
    }

    // 5. POST /reserve (Intento de reserva con soporte CPU-bound opcional)
    if (url.pathname === '/reserve' && method === 'POST') {
        const body = await parseBody(req);
        // Permitir seleccionar cpu mode por query o body o env por defecto
        const effectiveCpuMode = url.searchParams.get('cpu') || body.cpu || CPU_MODE;
        const workMs = parseInt(url.searchParams.get('ms') || body.ms || CPU_WORK_MS, 10);

        try {
            const reservation = await ticketManager.reserve();

            let cpuResult = null;
            let cpuElapsedMs = 0;
            let workerThreadId = null;

            const forceCpu = url.searchParams.get('forceCpu') === 'true';
            if ((reservation.approved || forceCpu) && effectiveCpuMode !== 'none') {
                const startCpu = Date.now();
                if (effectiveCpuMode === 'main') {
                    // CPU-bound ejecutado directamente en el Main Thread (bloqueante)
                    cpuResult = runCpuBoundTask(workMs);
                    cpuElapsedMs = Date.now() - startCpu;
                } else if (effectiveCpuMode === 'worker') {
                    // CPU-bound ejecutado en el Worker Thread (asíncrono sin bloquear Main)
                    const workerRes = await workerPool.execute(workMs);
                    cpuElapsedMs = Date.now() - startCpu;
                    cpuResult = workerRes.result;
                    workerThreadId = workerRes.threadId;
                }
            }

            return sendJson(res, 200, {
                status: reservation.approved ? 'APPROVED' : 'REJECTED',
                approved: reservation.approved,
                remaining: reservation.remaining,
                pod: hostname,
                mode: effectiveCpuMode,
                cpuElapsedMs,
                workerThreadId,
                cpuResult
            });
        } catch (err) {
            return sendJson(res, 500, {
                error: err.message,
                pod: hostname
            });
        }
    }

    // 6. POST /config (Permite configurar límites en caliente para las pruebas)
    if (url.pathname === '/config' && method === 'POST') {
        const body = await parseBody(req);
        if (body.maxWorkers) {
            workerPool.setMaxWorkers(parseInt(body.maxWorkers, 10));
        }
        if (body.storageMode) {
            ticketManager.setMode(body.storageMode);
        }
        return sendJson(res, 200, {
            ok: true,
            storageMode: ticketManager.mode,
            workerStats: workerPool.getStats()
        });
    }

    return sendJson(res, 404, { error: 'Not found', pod: hostname });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[TicketRush] Servidor escuchando en http://0.0.0.0:${PORT} (Pod: ${os.hostname()}, Storage: ${STORAGE_MODE}, MaxWorkers: ${MAX_WORKERS})`);
});
