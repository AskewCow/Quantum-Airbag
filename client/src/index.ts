/**
 * Quantum Airbag — PQC Key Manager CLI
 *
 * Commands:
 *   generate-key   Generate a Dilithium3 keypair and save to disk
 *   register        Register the ML-DSA public key on-chain
 *   withdraw        Sign and submit a withdrawal (off-chain hash commitment)
 *   rotate          Generate a new keypair under a different variant and rotate on-chain
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as crypto from "crypto";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RPC_ENDPOINT = process.env.RPC_ENDPOINT ?? "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.PROGRAM_ID ?? "PROGRAM_ID_PLACEHOLDER";
const PQC_KEY_PATH = process.env.PQC_KEY_PATH ?? "./pqc-keypair.json";
const WALLET_KEYPAIR_PATH = process.env.WALLET_KEYPAIR_PATH ?? "~/.config/solana/id.json";

// ---------------------------------------------------------------------------
// PQC helpers
//
// IMPORTANT: The PQC private key never leaves this machine.
// Public key is registered on-chain. Signatures are computed locally.
// Only a hash commitment of the signature is submitted on-chain because
// Dilithium3 signatures (2.4KB) exceed Solana's 1232-byte transaction limit.
// ---------------------------------------------------------------------------

async function loadDilithium() {
  // crystals-dilithium is a WASM module — dynamic import required
  const { Dilithium3 } = await import("crystals-dilithium" as any);
  return Dilithium3;
}

export async function generateKey() {
  const Dilithium3 = await loadDilithium();
  const { publicKey, secretKey } = Dilithium3.keyGen();

  const keypair = {
    publicKey: Array.from(publicKey),
    secretKey: Array.from(secretKey),
  };
  fs.writeFileSync(PQC_KEY_PATH, JSON.stringify(keypair, null, 2));
  console.log(`[client] ML-DSA-65 keypair generated → ${PQC_KEY_PATH}`);
  console.log(`[client] Public key length: ${publicKey.length} bytes`);
  console.log(`[client] Private key stays on disk — never transmitted`);
}

export async function register(ownerKeypair: Keypair) {
  const raw = JSON.parse(fs.readFileSync(PQC_KEY_PATH, "utf-8"));
  const publicKey = Uint8Array.from(raw.publicKey);

  // TODO (Step 3): call vault.methods.registerPqcKey(Array.from(publicKey)).accounts(...).rpc()
  console.log(`[client] register stub — wire to deployed program in Step 3`);
  console.log(`[client] PQC pubkey bytes: ${publicKey.length}`);
}

export async function withdraw(ownerKeypair: Keypair, amountLamports: number) {
  const raw = JSON.parse(fs.readFileSync(PQC_KEY_PATH, "utf-8"));
  const secretKey = Uint8Array.from(raw.secretKey);

  const Dilithium3 = await loadDilithium();

  // Construct withdrawal payload (matches what the program expects)
  const payload = Buffer.concat([
    ownerKeypair.publicKey.toBuffer(),
    Buffer.from(amountLamports.toString()),
  ]);

  // Sign off-chain — full signature is 2.4KB, cannot go on-chain directly
  const signature = Dilithium3.sign(payload, secretKey);

  // Submit a SHA-256 hash commitment of the signature
  const sigHash = crypto.createHash("sha256").update(signature).digest();

  console.log(`[client] Dilithium3 signature computed (${signature.length} bytes)`);
  console.log(`[client] Hash commitment: ${sigHash.toString("hex")}`);

  // TODO (Step 3): call vault.methods.withdraw(new anchor.BN(amountLamports), Array.from(sigHash)).accounts(...).rpc()
  console.log(`[client] withdraw stub — wire to deployed program in Step 3`);
}

export async function rotate() {
  const Dilithium3 = await loadDilithium();
  const { publicKey, secretKey } = Dilithium3.keyGen();

  const rotatedPath = PQC_KEY_PATH.replace(".json", "-rotated.json");
  fs.writeFileSync(rotatedPath, JSON.stringify({
    publicKey: Array.from(publicKey),
    secretKey: Array.from(secretKey),
  }, null, 2));

  console.log(`[client] New ML-DSA-65 keypair generated → ${rotatedPath}`);
  // TODO (Step 6): call vault.methods.rotateAlgorithm(AlgoVersion.MlDsa65).accounts(...).rpc()
  console.log(`[client] rotate stub — wire to deployed program in Step 6`);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const [, , command, ...args] = process.argv;

(async () => {
  switch (command) {
    case "generate-key":
      await generateKey();
      break;
    case "register":
    case "withdraw":
    case "rotate":
      console.log(`[client] ${command} — load wallet keypair and wire to program first`);
      break;
    default:
      console.log("Usage: ts-node src/index.ts <generate-key|register|withdraw|rotate>");
  }
})();
