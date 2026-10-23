function sleepSync(ms) {
    const sab = new SharedArrayBuffer(4);
    const view = new Int32Array(sab);
    Atomics.wait(view, 0, 0, ms);
}

const tasks = [
    { name: 'Tarea 1', time: 1000 },
    { name: 'Tarea 2', time: 3000 },
    { name: 'Tarea 3', time: 4000 },
    { name: 'Tarea 4', time: 2000 },
];

console.time('TOTAL');

for (const task of tasks) {
    console.log(`INICIO ${task.name}`);
    sleepSync(task.time);
    console.log(`FIN    ${task.name} (${task.time / 1000}s)`);
}

console.timeEnd('TOTAL');