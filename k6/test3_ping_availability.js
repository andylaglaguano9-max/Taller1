import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const pingDuration = new Trend('ping_duration', true);
const pingErrors = new Rate('ping_errors');
const pingReqs = new Counter('ping_reqs');

export const options = {
    scenarios: {
        // Tráfico constante sobre GET /ping: 20 VUs, 30s, sleep 0.25s
        ping_scenario: {
            executor: 'constant-vus',
            vus: 20,
            duration: '30s',
            exec: 'pingTask',
        },
        // Generador de tareas CPU-bound en paralelo
        heavy_cpu_scenario: {
            executor: 'constant-vus',
            vus: 4,
            duration: '30s',
            exec: 'cpuTask',
        },
    },
    thresholds: {
        ping_errors: ['rate<0.05'],
    },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';
const CPU_MODE = __ENV.CPU_MODE || 'main'; // 'main' o 'worker'
const CPU_MS = __ENV.CPU_MS || '200';

export function pingTask() {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/ping`, {
        tags: { type: 'ping' },
        timeout: '10s',
    });

    const elapsed = Date.now() - start;
    pingDuration.add(elapsed);
    pingReqs.add(1);

    const isOk = check(res, {
        'ping status 200': (r) => r.status === 200,
    });

    pingErrors.add(!isOk);
    sleep(0.25);
}

export function cpuTask() {
    // Provocar tarea CPU-bound (simula generación continua de comprobante)
    http.post(`${BASE_URL}/reserve?cpu=${CPU_MODE}&ms=${CPU_MS}&forceCpu=true`, '', {
        headers: { 'Content-Type': 'application/json' },
        tags: { type: 'cpu_bound' },
        timeout: '15s',
    });

    sleep(0.05);
}

export function handleSummary(data) {
    const pDur = data.metrics.ping_duration ? data.metrics.ping_duration.values : {};
    const reqs = data.metrics.ping_reqs ? data.metrics.ping_reqs.values.count : 0;
    const reqRate = data.metrics.ping_reqs ? data.metrics.ping_reqs.values.rate : 0;
    const errRate = data.metrics.ping_errors ? (data.metrics.ping_errors.values.rate * 100).toFixed(2) : '0';

    console.log('\n======================================================');
    console.log(` RESULTADOS /ping [MODO: ${CPU_MODE.toUpperCase()}]`);
    console.log('======================================================');
    console.log(`Peticiones /ping (http_reqs):   ${reqs}`);
    console.log(`Rendimiento (requests/s):       ${reqRate.toFixed(2)} req/s`);
    console.log(`Fallos (http_req_failed):       ${errRate}%`);
    console.log(`Latencia promedio (avg):        ${pDur.avg ? pDur.avg.toFixed(2) : 0} ms`);
    console.log(`Latencia percentil 95 (p95):    ${pDur['p(95)'] ? pDur['p(95)'].toFixed(2) : 0} ms`);
    console.log(`Latencia máxima (max):          ${pDur.max ? pDur.max.toFixed(2) : 0} ms`);
    console.log('======================================================\n');

    return {
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
