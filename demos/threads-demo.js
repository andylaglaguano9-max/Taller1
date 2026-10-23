const { Worker } = require('worker_threads');
const path = require('path');

const tasks = [
    { name: 'Tarea 1', time: 1000 },
    { name: 'Tarea 2', time: 3000 },
    { name: 'Tarea 3', time: 4000 },
    { name: 'Tarea 4', time: 2000 },
];

console.time('TOTAL');
let finished = 0;

for (const task of tasks) {
    const worker = new Worker(
        path.join(__dirname, 'worker-task.js'),
        { workerData: task }
    );

    worker.on('message', (data) => {
        console.log(
            `FIN ${data.name} | ${data.time / 1000}s | threadId=${data.threadId}`
        );

        finished++;
        if (finished === tasks.length) {
            console.timeEnd('TOTAL');
        }
    });
}

console.log('Los 4 Workers fueron iniciados.');