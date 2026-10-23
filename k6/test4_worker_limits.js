import http from 'k6/http';
import { check } from 'k6';

export const options = {
    vus: 20,
    duration: '15s',
    thresholds: {
        http_req_failed: ['rate<0.05'],
    },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';
const WORK_MS = __ENV.CPU_MS || '100';

export default function () {
    const res = http.post(`${BASE_URL}/reserve?cpu=worker&ms=${WORK_MS}&forceCpu=true`, '', {
        headers: { 'Content-Type': 'application/json' },
        timeout: '30s',
    });

    check(res, {
        'status is 200': (r) => r.status === 200,
    });
}

export function handleSummary(data) {
    const dur = data.metrics.http_req_duration.values;
    const reqs = data.metrics.http_reqs.values.count;
    const rate = data.metrics.http_reqs.values.rate;
    const failedRate = data.metrics.http_req_failed ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : '0';

    return {
        stdout: JSON.stringify({
            reqs,
            rate: rate.toFixed(2),
            failedRate,
            avg: dur.avg.toFixed(2),
            p95: dur['p(95)'].toFixed(2),
            max: dur.max.toFixed(2)
        }) + '\n'
    };
}
