const { parentPort, workerData, threadId } = require('worker_threads');

function cpuWork(ms) {
    const end = Date.now() + ms;
    let value = 0;

    while (Date.now() < end) {
        value = Math.sqrt(value + Math.random() + 1);
    }

    return value;
}

const started = Date.now();
const result = cpuWork(workerData.ms);

parentPort.postMessage({
    result,
    threadId,
    elapsedMs: Date.now() - started,
});