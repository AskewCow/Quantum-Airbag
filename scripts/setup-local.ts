/**
 * Local demo setup helper.
 *
 * Run once after `anchor build && anchor deploy` to:
 *   1. Generate a sentinel keypair (if one doesn't exist)
 *   2. Compute the vault PDA for your wallet
 *   3. Print ready-to-paste .env values for client and sentinel
 *
 * Usage:
 *   ts-node scripts/setup-local.ts [wallet-keypair-path]
 *
 * Default wallet path: ~/.config/solana/id.json
 */

import { Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PROGRAM_ID = new PublicKey("J7gxnojav3SRfJxHhFGsW2iATBV4zVUsrkcKNzauPqRa");

const walletPath =
  process.argv[2] ??
  path.join(os.homedir(), ".config", "solana", "id.json");

const sentinelPath = path.resolve(__dirname, "../sentinel/sentinel-keypair.json");

// Load or generate sentinel keypair
let sentinelKeypair: Keypair;
if (fs.existsSync(sentinelPath)) {
  sentinelKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(sentinelPath, "utf-8")))
  );
  console.log(`[setup] Sentinel keypair loaded from ${sentinelPath}`);
} else {
  sentinelKeypair = Keypair.generate();
  fs.writeFileSync(sentinelPath, JSON.stringify(Array.from(sentinelKeypair.secretKey)));
  console.log(`[setup] Sentinel keypair generated → ${sentinelPath}`);
}

// Load wallet to derive vault PDA
if (!fs.existsSync(walletPath)) {
  console.error(`[setup] Wallet not found at ${walletPath}`);
  console.error(`[setup] Run: solana-keygen new  (or pass a path as the first argument)`);
  process.exit(1);
}
const walletKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
);

const [vaultPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), walletKeypair.publicKey.toBuffer()],
  PROGRAM_ID
);

const [algoRegistryPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("algo_registry")],
  PROGRAM_ID
);

console.log("");
console.log("════════════════════════════════════════════════════════");
console.log("  Quantum Airbag — Local Demo Setup");
console.log("════════════════════════════════════════════════════════");
console.log(`  Wallet:           ${walletKeypair.publicKey.toBase58()}`);
console.log(`  Sentinel pubkey:  ${sentinelKeypair.publicKey.toBase58()}`);
console.log(`  Vault PDA:        ${vaultPDA.toBase58()}`);
console.log(`  AlgoRegistry PDA: ${algoRegistryPDA.toBase58()}`);
console.log("");
console.log("── client/.env ─────────────────────────────────────────");
console.log(`RPC_ENDPOINT=http://localhost:8899`);
console.log(`PROGRAM_ID=${PROGRAM_ID.toBase58()}`);
console.log(`PQC_KEY_PATH=./pqc-keypair.json`);
console.log(`WALLET_KEYPAIR_PATH=${walletPath}`);
console.log("");
console.log("── sentinel/.env ───────────────────────────────────────");
console.log(`THREAT_API_URL=http://localhost:3000`);
console.log(`POLL_INTERVAL_MS=5000`);
console.log(`RPC_ENDPOINT=http://localhost:8899`);
console.log(`PROGRAM_ID=${PROGRAM_ID.toBase58()}`);
console.log(`SENTINEL_KEYPAIR_PATH=${sentinelPath}`);
console.log(`VAULT_PUBKEY=${vaultPDA.toBase58()}`);
console.log("");
console.log("── initialize_registry call arg ────────────────────────");
console.log(`sentinel_authority: ${sentinelKeypair.publicKey.toBase58()}`);
console.log("════════════════════════════════════════════════════════");
console.log("");
console.log("Next steps:");
console.log("  1. solana-test-validator");
console.log("  2. anchor build && anchor deploy");
console.log("  3. Copy the .env values above into client/.env and sentinel/.env");
console.log("  4. Call initialize_registry with the sentinel_authority above");
console.log("  5. cd client && ts-node src/index.ts generate-key");
console.log("  6. cd client && ts-node src/index.ts register");
console.log("  7. Start threat-api, sentinel, and UI");
