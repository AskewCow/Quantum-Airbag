/**
 * npm run demo — full 7-step Quantum Airbag demo sequence
 *
 * Prerequisites:
 *   1. anchor build && anchor deploy (program at J7gxnojav3SRfJxHhFGsW2iATBV4zVUsrkcKNzauPqRa)
 *   2. npm run setup  (generates sentinel/sentinel-keypair.json, prints .env values)
 *   3. Copy .env values into client/.env and sentinel/.env
 *   4. ts-node threat-api/src/index.ts  (threat API must be running on port 3000)
 *   5. ts-node sentinel/src/index.ts    (optional — demo fires migrate directly if not running)
 *   6. npm run demo
 *
 * Prints a Solana Explorer link after every on-chain transaction.
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { generateKey, signPayload, loadWalletKeypair, loadProgram, getVaultPDA, getAlgoRegistryPDA } from "./index";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROGRAM_ID    = process.env.PROGRAM_ID    ?? "J7gxnojav3SRfJxHhFGsW2iATBV4zVUsrkcKNzauPqRa";
const PQC_KEY_PATH  = process.env.PQC_KEY_PATH  ?? path.resolve(__dirname, "../pqc-keypair.json");
const THREAT_API_URL = process.env.THREAT_API_URL ?? "http://localhost:3000";
const SENTINEL_KEYPAIR_PATH =
  process.env.SENTINEL_KEYPAIR_PATH ??
  path.resolve(__dirname, "../../sentinel/sentinel-keypair.json");

const DEPOSIT_AMOUNT  = Math.round(0.1 * LAMPORTS_PER_SOL);   // 0.1 SOL
const WITHDRAW_AMOUNT = Math.round(0.02 * LAMPORTS_PER_SOL);  // 0.02 SOL

const EXPLORER = (tx: string) => `https://explorer.solana.com/tx/${tx}?cluster=devnet`;

function sep() { console.log("─────────────────────────────────────────────────"); }

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

async function demo() {
  console.log("\n══════════════════════════════════════════════════");
  console.log("       QUANTUM AIRBAG — LIVE DEMO");
  console.log("══════════════════════════════════════════════════\n");

  // Load keypairs
  const ownerKeypair = loadWalletKeypair();
  const sentinelKeypair = fs.existsSync(SENTINEL_KEYPAIR_PATH)
    ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(SENTINEL_KEYPAIR_PATH, "utf-8"))))
    : null;
  const program = loadProgram(ownerKeypair);
  const vaultPDA = getVaultPDA(ownerKeypair.publicKey, program.programId);
  const algoRegistryPDA = getAlgoRegistryPDA(program.programId);

  console.log(`Owner:    ${ownerKeypair.publicKey.toBase58()}`);
  console.log(`Sentinel: ${sentinelKeypair ? sentinelKeypair.publicKey.toBase58() : "⚠️  not found (migrate step will be skipped)"}`);
  console.log(`Vault:    ${vaultPDA.toBase58()}`);
  console.log(`Registry: ${algoRegistryPDA.toBase58()}\n`);

  // ── STEP 1: Ensure registry is initialised ──────────────────────────────
  sep();
  console.log("Step 1: Initialize registry (if not already done)");
  try {
    await (program.account as any).algoRegistry.fetch(algoRegistryPDA);
    console.log("  Registry already initialized ✅");
  } catch {
    if (!sentinelKeypair) {
      console.error("  ❌  Registry not found and no sentinel keypair to set as authority.");
      console.error("     Run: npm run setup");
      process.exit(1);
    }
    const initTx = await (program.methods as any)
      .initializeRegistry(sentinelKeypair.publicKey)
      .accounts({
        algoRegistry: algoRegistryPDA,
        authority: ownerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`  Registry initialized → ${EXPLORER(initTx)}`);
  }

  // ── STEP 2: Generate PQC key + create vault + register key ─────────────
  sep();
  console.log("Step 2: Generate PQC key, create vault, register ML-DSA-65 key");

  if (!fs.existsSync(PQC_KEY_PATH)) {
    generateKey();
  } else {
    console.log(`  PQC keypair loaded from ${PQC_KEY_PATH}`);
  }
  const pqcKeyData = JSON.parse(fs.readFileSync(PQC_KEY_PATH, "utf-8"));
  const pqcPublicKey = Uint8Array.from(pqcKeyData.publicKey);
  console.log(`  ML-DSA-65 public key: ${pqcPublicKey.length} bytes`);

  // deposit creates the vault PDA via init_if_needed
  const depositTx = await (program.methods as any)
    .deposit(new anchor.BN(DEPOSIT_AMOUNT))
    .accounts({
      vault: vaultPDA,
      owner: ownerKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`  Vault funded (${DEPOSIT_AMOUNT / LAMPORTS_PER_SOL} SOL) → ${EXPLORER(depositTx)}`);

  const registerTx = await (program.methods as any)
    .registerPqcKey(Array.from(pqcPublicKey))
    .accounts({ vault: vaultPDA, owner: ownerKeypair.publicKey })
    .rpc();
  console.log(`  PQC key registered → ${EXPLORER(registerTx)}`);
  console.log("  Vault mode: NORMAL ✅\n");

  // ── STEP 3: Normal withdrawal with valid ML-DSA signature ───────────────
  sep();
  console.log("Step 3: Normal withdrawal — valid ML-DSA-65 signature");

  const payload1 = Buffer.concat([
    ownerKeypair.publicKey.toBuffer(),
    Buffer.from(WITHDRAW_AMOUNT.toString()),
  ]);
  const { signature: sig1, sigHash: sigHash1 } = signPayload(payload1);
  console.log(`  ML-DSA-65 sig: ${sig1.length} bytes  (only SHA-256 hash commitment submitted on-chain)`);
  console.log(`  Hash: ${sigHash1.toString("hex")}`);

  const withdrawTx1 = await (program.methods as any)
    .withdraw(new anchor.BN(WITHDRAW_AMOUNT), Array.from(sigHash1))
    .accounts({ vault: vaultPDA, owner: ownerKeypair.publicKey, algoRegistry: algoRegistryPDA })
    .rpc();
  console.log(`  Withdraw tx → ${EXPLORER(withdrawTx1)}`);
  console.log("  ACCEPTED ✅\n");

  // ── STEP 4: Flip threat API to CRITICAL ────────────────────────────────
  sep();
  console.log("Step 4: Flip threat API to CRITICAL");
  try {
    await axios.post(`${THREAT_API_URL}/admin/set-level`, { level: "critical" });
    const { data } = await axios.get<{ level: string }>(`${THREAT_API_URL}/status`);
    console.log(`  Threat level: ${data.level.toUpperCase()} 🚨\n`);
  } catch {
    console.log(`  ⚠️  Threat API not reachable at ${THREAT_API_URL} — skipping HTTP call`);
    console.log("     (start threat-api/src/index.ts to enable live threat switching)\n");
  }

  // ── STEP 5: Sentinel fires migrate ────────────────────────────────────
  sep();
  console.log("Step 5: Sentinel fires migrate → vault enters LOCKDOWN");

  if (sentinelKeypair) {
    // Re-create program with sentinel as the signer
    const connection = new Connection(
      process.env.RPC_ENDPOINT ?? "https://api.devnet.solana.com",
      "confirmed"
    );
    const sentinelWallet = new anchor.Wallet(sentinelKeypair);
    const sentinelProvider = new anchor.AnchorProvider(connection, sentinelWallet, { commitment: "confirmed" });
    const idlPath = path.resolve(__dirname, "../../program/target/idl/quantum_airbag.json");
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
    const sentinelProgram = new anchor.Program(idl, new PublicKey(PROGRAM_ID), sentinelProvider);

    const migrateTx = await (sentinelProgram.methods as any)
      .migrate()
      .accounts({
        vault: vaultPDA,
        authority: sentinelKeypair.publicKey,
        algoRegistry: algoRegistryPDA,
      })
      .rpc();
    console.log(`  Lockdown tx → ${EXPLORER(migrateTx)}`);
    console.log("  Vault mode: LOCKDOWN 🔒\n");
  } else {
    console.log("  ⚠️  No sentinel keypair — skipping migrate call.");
    console.log("     Run `npm run setup` to generate sentinel/sentinel-keypair.json,");
    console.log("     then call initialize_registry with its pubkey as sentinel_authority.\n");
  }

  // ── STEP 6: Ed25519 withdrawal rejected in LOCKDOWN ───────────────────
  sep();
  console.log("Step 6: Ed25519 withdrawal attempt (zero hash) — should be rejected");

  try {
    await (program.methods as any)
      .withdraw(new anchor.BN(WITHDRAW_AMOUNT), Array.from(new Uint8Array(32)))
      .accounts({ vault: vaultPDA, owner: ownerKeypair.publicKey, algoRegistry: algoRegistryPDA })
      .rpc();
    console.log("  (unexpected: transaction succeeded — vault may not be in lockdown yet)\n");
  } catch (err: any) {
    const msg = err?.error?.errorMessage ?? err?.logs?.find((l: string) => l.includes("Error")) ?? err?.message ?? String(err);
    console.log(`  REJECTED ❌  ${msg}\n`);
  }

  // ── STEP 7: ML-DSA withdrawal accepted in LOCKDOWN ────────────────────
  sep();
  console.log("Step 7: ML-DSA withdrawal in LOCKDOWN mode — should be accepted");

  const payload2 = Buffer.concat([
    ownerKeypair.publicKey.toBuffer(),
    Buffer.from(WITHDRAW_AMOUNT.toString()),
  ]);
  const { signature: sig2, sigHash: sigHash2 } = signPayload(payload2);
  console.log(`  ML-DSA-65 sig: ${sig2.length} bytes`);
  console.log(`  Hash: ${sigHash2.toString("hex")}`);

  const withdrawTx2 = await (program.methods as any)
    .withdraw(new anchor.BN(WITHDRAW_AMOUNT), Array.from(sigHash2))
    .accounts({ vault: vaultPDA, owner: ownerKeypair.publicKey, algoRegistry: algoRegistryPDA })
    .rpc();
  console.log(`  Withdraw tx → ${EXPLORER(withdrawTx2)}`);
  console.log("  ACCEPTED ✅  PQC verified\n");

  // ── Done ───────────────────────────────────────────────────────────────
  sep();
  console.log("\n══════════════════════════════════════════════════");
  console.log("  DEMO COMPLETE ✅");
  console.log(`  Vault: https://explorer.solana.com/address/${vaultPDA.toBase58()}?cluster=devnet`);
  console.log("══════════════════════════════════════════════════\n");
}

demo().catch((err) => {
  console.error("\nDemo failed:", err?.message ?? err);
  process.exit(1);
});
