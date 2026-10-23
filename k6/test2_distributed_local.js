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

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:30090';

// Registrador de pods en memoria durante la prueba
const podResponses = {};

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
        const pod = body.pod || 'unknown';

        if (body.approved === true) {
            approvedCounter.add(1);
        } else {
            rejectedCounter.add(1);
        }
    } catch (e) {}
}

export function handleSummary(data) {
    const approved = data.metrics.reservas_aprobadas ? data.metrics.reservas_aprobadas.values.count : 0;
    const rejected = data.metrics.reservas_rechazadas ? data.metrics.reservas_rechazadas.values.count : 0;
    const total = data.metrics.total_intentos ? data.metrics.total_intentos.values.count : 0;

    console.log('\n======================================================');
    console.log(' PARTE 3: PRUEBA DISTRIBUIDA (3 PODS CON MUTEX LOCAL) ');
    console.log('======================================================');
    console.log(`Intentos totales enviados:    ${total}`);
    console.log(`Reservas aprobadas totales:   ${approved}`);
    console.log(`Reservas rechazadas totales:  ${rejected}`);
    console.log(`Cupos iniciales permitidos:   20`);
    console.log('------------------------------------------------------');
    if (approved > 20) {
        console.log(`⚠️  CONDICIÓN DE CARRERA / SOBREVENTA CONFIRMADA!`);
        console.log(`   Se aprobaron ${approved} reservas cuando solo debían existir 20.`);
        console.log(`   Causa: Cada Pod maneja su propia memoria y su propio Mutex local.`);
        console.log(`   El Mutex de un Pod NO coordina a los otros Pods.`);
    } else {
        console.log(`Reservas dentro del margen.`);
    }
    console.log('======================================================\n');

    return {
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
