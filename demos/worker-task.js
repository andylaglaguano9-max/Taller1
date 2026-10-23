const { parentPort, workerData, threadId } = require('worker_threads');

const { name, time } = workerData;

const sab = new SharedArrayBuffer(4);
const view = new Int32Array(sab);

// Simula trabajo bloqueante dentro del Worker.
Atomics.wait(view, 0, 0, time);

parentPort.postMessage({
    name,
    time,
    threadId,
});