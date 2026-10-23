const crypto = require('crypto');

/**
 * Simula una tarea CPU-bound intensiva representativa de la emisión de un boleto:
 * Generación de comprobante criptográfico mediante rondas de hashing y operaciones matemáticas.
 * @param {number} ms - Duración aproximada en milisegundos de trabajo continuo de CPU.
 */
function runCpuBoundTask(ms = 80) {
    const end = Date.now() + ms;
    let counter = 0;
    let hash = crypto.randomBytes(16).toString('hex');

    while (Date.now() < end) {
        // Operación matemática y hash SHA-256 intensivo en CPU
        hash = crypto.createHash('sha256').update(hash + counter).digest('hex');
        counter++;
    }

    return {
        signature: hash.substring(0, 16),
        iterations: counter
    };
}

module.exports = { runCpuBoundTask };
