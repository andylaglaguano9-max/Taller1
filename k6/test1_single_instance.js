import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

export const options = {
    scenarios: {
        reserve_scenario: {
            executor: 'per-vu-iterations',
            vus: 100,
            iterations: 1,
            maxDuration: '30s',
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.01'],
    },
};

const approvedCounter = new Counter('reservas_aprobadas');
const rejectedCounter = new Counter('reservas_rechazadas');
const totalCounter = new Counter('total_intentos');

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';

export default function () {
    totalCounter.add(1);

    const res = http.post(`${BASE_URL}/reserve`, '', {
        headers: { 'Content-Type': 'application/json' },
    });

    check(res, {
        'status is 200': (r) => r.status === 200,
    });

    try {
        const body = JSON.parse(res.body);
        if (body.approved === true) {
            approvedCounter.add(1);
        } else {
            rejectedCounter.add(1);
        }
    } catch (e) {
        // En caso de respuesta no JSON
    }
}

export function handleSummary(data) {
    const approved = data.metrics.reservas_aprobadas ? data.metrics.reservas_aprobadas.values.count : 0;
    const rejected = data.metrics.reservas_rechazadas ? data.metrics.reservas_rechazadas.values.count : 0;
    const total = data.metrics.total_intentos ? data.metrics.total_intentos.values.count : 0;

    console.log('\n=========================================');
    console.log('       RESUMEN DE PRUEBA DE CONCURRENCIA ');
    console.log('=========================================');
    console.log(`Intentos totales:     ${total}`);
    console.log(`Reservas aprobadas:   ${approved}`);
    console.log(`Reservas rechazadas:  ${rejected}`);
    console.log(`Consistencia (Total cupos = 20): ${approved === 20 ? 'CUMPLE (EXACTAMENTE 20)' : 'FALLA (SOBREVENTA O SUBVENTA)'}`);
    console.log('=========================================\n');

    return {
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
