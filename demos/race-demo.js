let balance = 100;
let approved = 0;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function withdraw(client, delayMs) {
  console.log(`${client} consulta saldo: $${balance}`);

  if (balance >= 100) {
    // Simula procesamiento entre la consulta y el débito
    await wait(delayMs);
    balance -= 100;
    approved++;
    console.log(`${client} APRUEBA. Saldo = $${balance}`);
    return true;
  }

  console.log(`${client} RECHAZA. Saldo insuficiente.`);
  return false;
}

async function main() {
  await Promise.all([
    withdraw('A - Cajero', 300),
    withdraw('B - App móvil', 100),
  ]);

  console.log('\n--- RESULTADO (CONDICIÓN DE CARRERA) ---');
  console.log(`Retiros aprobados: ${approved}`);
  console.log(`Saldo final: $${balance}`);
}

main();
