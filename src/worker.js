const { parentPort, threadId } = require('worker_threads');
const { runCpuBoundTask } = require('./cpu-task');

parentPort.on('message', (task) => {
    const started = Date.now();
    try {
        const result = runCpuBoundTask(task.durationMs || 80);
        parentPort.postMessage({
            taskId: task.taskId,
            success: true,
            threadId,
            result,
            elapsedMs: Date.now() - started
        });
    } catch (err) {
        parentPort.postMessage({
            taskId: task.taskId,
            success: false,
            threadId,
            error: err.message,
            elapsedMs: Date.now() - started
        });
    }
});
