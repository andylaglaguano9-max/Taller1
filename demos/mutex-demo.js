const { Mutex } = require('async-mutex');

let balance = 100;
let approved = 0;
const mutex = new Mutex();

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function withdraw(client, delayMs) {
  return mutex.runExclusive(async () => {
    const observedBalance = balance;
    console.log(`${client} entra con saldo = $${observedBalance}`);

    await wait(delayMs);

    if (balance >= 100) {
      approved++;
      balance -= 100;
      console.log(`${client} APRUEBA. Saldo = $${balance}`);
      return true;
    }

    console.log(`${client} RECHAZA. Saldo insuficiente.`);
    return false;
  });
}

async function main() {
  await Promise.all([
    withdraw('A - Cajero', 300),
    withdraw('B - App móvil', 100),
  ]);

  console.log('\n--- RESULTADO ---');
  console.log(`Retiros aprobados: ${approved}`);
  console.log(`Saldo final: $${balance}`);
}

main();
