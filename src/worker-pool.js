const { Worker } = require('worker_threads');
const path = require('path');

class WorkerPool {
    constructor(maxWorkers = 4) {
        this.maxWorkers = maxWorkers;
        this.activeWorkers = 0;
        this.queue = [];
        this.workerScript = path.join(__dirname, 'worker.js');
        this.taskIdCounter = 0;
    }

    setMaxWorkers(limit) {
        this.maxWorkers = Math.max(1, limit);
        this._dispatchNext();
    }

    getStats() {
        return {
            maxWorkers: this.maxWorkers,
            activeWorkers: this.activeWorkers,
            queuedTasks: this.queue.length
        };
    }

    execute(durationMs = 80) {
        return new Promise((resolve, reject) => {
            const taskId = ++this.taskIdCounter;
            const task = {
                taskId,
                durationMs,
                resolve,
                reject,
                enqueuedAt: Date.now()
            };

            this.queue.push(task);
            this._dispatchNext();
        });
    }

    _dispatchNext() {
        if (this.activeWorkers >= this.maxWorkers || this.queue.length === 0) {
            return;
        }

        const task = this.queue.shift();
        this.activeWorkers++;

        const worker = new Worker(this.workerScript);

        worker.once('message', (response) => {
            worker.terminate();
            this.activeWorkers--;
            this._dispatchNext();

            if (response.success) {
                task.resolve(response);
            } else {
                task.reject(new Error(response.error));
            }
        });

        worker.once('error', (err) => {
            worker.terminate();
            this.activeWorkers--;
            this._dispatchNext();
            task.reject(err);
        });

        worker.once('exit', (code) => {
            if (code !== 0) {
                // If exited without message/error handled
            }
        });

        worker.postMessage({
            taskId: task.taskId,
            durationMs: task.durationMs
        });
    }
}

module.exports = { WorkerPool };
