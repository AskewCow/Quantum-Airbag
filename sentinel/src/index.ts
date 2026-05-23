import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import axios from "axios";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

// ---------------------------------------------------------------------------
// Config — set via .env or environment variables
// ---------------------------------------------------------------------------

const THREAT_API_URL = process.env.THREAT_API_URL ?? "http://localhost:3000";
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "5000");
const RPC_ENDPOINT = process.env.RPC_ENDPOINT ?? "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.PROGRAM_ID ?? "PROGRAM_ID_PLACEHOLDER";
// Sentinel hot key — scoped to migrate instruction only, no withdrawal power
const SENTINEL_KEYPAIR_PATH = process.env.SENTINEL_KEYPAIR_PATH ?? "./sentinel-keypair.json";
// Target vault to migrate (set per-user in production; demo uses a single vault)
const VAULT_PUBKEY = process.env.VAULT_PUBKEY ?? "VAULT_PUBKEY_PLACEHOLDER";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type ThreatLevel = "none" | "elevated" | "critical";

let lastKnownLevel: ThreatLevel = "none";
let lockdownFired = false;

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function main() {
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  const keypairRaw = JSON.parse(fs.readFileSync(SENTINEL_KEYPAIR_PATH, "utf-8"));
  const sentinelKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairRaw));
  const wallet = new anchor.Wallet(sentinelKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});

  console.log(`[sentinel] Started. Polling ${THREAT_API_URL}/status every ${POLL_INTERVAL_MS}ms`);
  console.log(`[sentinel] Sentinel pubkey: ${sentinelKeypair.publicKey.toBase58()}`);
  console.log(`[sentinel] Program: ${PROGRAM_ID}`);

  setInterval(async () => {
    try {
      await poll(provider, sentinelKeypair);
    } catch (err) {
      console.error("[sentinel] Poll error:", err);
    }
  }, POLL_INTERVAL_MS);
}

async function poll(provider: anchor.AnchorProvider, keypair: Keypair) {
  const res = await axios.get<{ level: ThreatLevel }>(`${THREAT_API_URL}/status`);
  const level = res.data.level;

  if (level !== lastKnownLevel) {
    console.log(`[sentinel] Threat level changed: ${lastKnownLevel} → ${level}`);
    lastKnownLevel = level;
  }

  if (level === "critical" && !lockdownFired) {
    console.log("[sentinel] CRITICAL threat detected — firing migrate instruction...");
    await triggerLockdown(provider, keypair);
    lockdownFired = true;
  }

  if (level !== "critical") {
    lockdownFired = false;
  }
}

async function triggerLockdown(provider: anchor.AnchorProvider, _keypair: Keypair) {
  // TODO (Step 4): load the IDL and call vault.methods.migrate() here.
  //
  // Example (fill in after program is deployed):
  //
  //   const idl = JSON.parse(fs.readFileSync("../program/target/idl/quantum_airbag.json", "utf-8"));
  //   const program = new anchor.Program(idl, new PublicKey(PROGRAM_ID), provider);
  //   const vaultPubkey = new PublicKey(VAULT_PUBKEY);
  //   const tx = await program.methods.migrate().accounts({ vault: vaultPubkey, authority: _keypair.publicKey }).rpc();
  //   console.log(`[sentinel] Lockdown tx: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

  console.log("[sentinel] migrate stub — wire to deployed program in Step 4");
}

main().catch((err) => {
  console.error("[sentinel] Fatal:", err);
  process.exit(1);
});
