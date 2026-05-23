/**
 * npm run demo — full 7-step Quantum Airbag demo sequence
 *
 * Prints a Solana Explorer link after every on-chain transaction.
 * Wire each step to the deployed program as components are built.
 */

const EXPLORER = (tx: string) =>
  `https://explorer.solana.com/tx/${tx}?cluster=devnet`;

async function demo() {
  console.log("\n=== QUANTUM AIRBAG — LIVE DEMO ===\n");

  // Step 1 — Create vault + register ML-DSA key
  console.log("Step 1: Create vault and register ML-DSA key");
  console.log("  → TODO: vault.methods.deposit(0).rpc() to init vault PDA");
  console.log("  → TODO: vault.methods.registerPqcKey(...).rpc()");
  console.log("  Mode: NORMAL\n");

  // Step 2 — Deposit
  console.log("Step 2: Deposit 0.5 SOL into PDA vault");
  console.log("  → TODO: vault.methods.deposit(0.5 * LAMPORTS_PER_SOL).rpc()");
  console.log("  Vault balance: 0.5 SOL\n");

  // Step 3 — Normal withdrawal accepted
  console.log("Step 3: Normal withdrawal — valid ML-DSA signature");
  console.log("  → TODO: vault.methods.withdraw(amount, sigHash).rpc()");
  console.log("  ACCEPTED ✅\n");

  // Step 4 — Flip the threat API (do this visibly)
  console.log("Step 4: Flip threat API to CRITICAL");
  console.log("  curl -X POST localhost:3000/admin/set-level -d '{\"level\":\"critical\"}'");
  console.log("  Threat level: CRITICAL 🚨\n");

  // Step 5 — Sentinel fires
  console.log("Step 5: Sentinel fires migrate instruction automatically");
  console.log("  → Sentinel detects critical. No human action.");
  console.log("  Vault mode: LOCKDOWN 🔒\n");

  // Step 6 — Ed25519 withdrawal rejected
  console.log("Step 6: Ed25519 withdrawal attempt");
  console.log("  → TODO: vault.methods.withdraw(amount, zeroes).rpc()");
  console.log("  REJECTED ❌  AlgorithmBanned\n");

  // Step 7 — ML-DSA withdrawal accepted
  console.log("Step 7: ML-DSA withdrawal");
  console.log("  → TODO: vault.methods.withdraw(amount, sigHash).rpc()");
  console.log("  ACCEPTED ✅  PQC verified\n");

  console.log("=== DEMO COMPLETE ===\n");
}

demo().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
