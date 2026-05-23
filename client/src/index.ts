/**
 * Quantum Airbag — PQC Key Manager CLI
 *
 * Commands:
 *   generate-key   Generate a ML-DSA-65 keypair and save to disk
 *   register        Register the ML-DSA public key on-chain
 *   withdraw        Sign and submit a withdrawal (off-chain hash commitment)
 *   rotate          Generate a new keypair and rotate on-chain
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RPC_ENDPOINT = process.env.RPC_ENDPOINT ?? "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.PROGRAM_ID ?? "PROGRAM_ID_PLACEHOLDER";
const PQC_KEY_PATH = process.env.PQC_KEY_PATH ?? "./pqc-keypair.json";
const WALLET_KEYPAIR_PATH = process.env.WALLET_KEYPAIR_PATH ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? "~", ".config/solana/id.json");

// ---------------------------------------------------------------------------
// PQC helpers
//
// The PQC private key never leaves this machine.
// Public key is registered on-chain. Signatures are computed locally.
// Only a SHA-256 hash commitment of the signature is submitted on-chain because
// ML-DSA-65 signatures (~3.3KB) exceed Solana's 1232-byte transaction limit.
// ---------------------------------------------------------------------------

export function generateKey() {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const keypair = ml_dsa65.keygen(seed);

  const keyData = {
    publicKey: Array.from(keypair.publicKey),
    secretKey: Array.from(keypair.secretKey),
  };
  fs.writeFileSync(PQC_KEY_PATH, JSON.stringify(keyData, null, 2));
  console.log(`[client] ML-DSA-65 keypair generated → ${PQC_KEY_PATH}`);
  console.log(`[client] Public key:  ${keypair.publicKey.length} bytes`);
  console.log(`[client] Secret key:  ${keypair.secretKey.length} bytes`);
  console.log(`[client] Private key stays on disk — never transmitted`);
}

export function signPayload(payload: Uint8Array): { signature: Uint8Array; sigHash: Buffer } {
  const raw = JSON.parse(fs.readFileSync(PQC_KEY_PATH, "utf-8"));
  const secretKey = Uint8Array.from(raw.secretKey);
  const signature = ml_dsa65.sign(secretKey, payload);
  const sigHash = crypto.createHash("sha256").update(signature).digest();
  return { signature, sigHash };
}

export function loadWalletKeypair(): Keypair {
  const raw = JSON.parse(fs.readFileSync(WALLET_KEYPAIR_PATH, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function loadProgram(ownerKeypair: Keypair): anchor.Program {
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  const wallet = new anchor.Wallet(ownerKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const idlPath = path.resolve(__dirname, "../../program/target/idl/quantum_airbag.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  return new anchor.Program(idl, new PublicKey(PROGRAM_ID), provider);
}

export function getVaultPDA(owner: PublicKey, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer()],
    programId
  );
  return pda;
}

export function getAlgoRegistryPDA(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("algo_registry")],
    programId
  );
  return pda;
}

export async function register() {
  const raw = JSON.parse(fs.readFileSync(PQC_KEY_PATH, "utf-8"));
  const publicKey = Uint8Array.from(raw.publicKey);
  const ownerKeypair = loadWalletKeypair();
  const program = loadProgram(ownerKeypair);

  console.log(`[client] Owner wallet: ${ownerKeypair.publicKey.toBase58()}`);
  console.log(`[client] ML-DSA-65 public key: ${publicKey.length} bytes`);

  const vaultPDA = getVaultPDA(ownerKeypair.publicKey, program.programId);
  const tx = await (program.methods as any)
    .registerPqcKey(Array.from(publicKey))
    .accounts({ vault: vaultPDA, owner: ownerKeypair.publicKey })
    .rpc();
  console.log(`[client] Register tx: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
}

export async function withdraw(amountLamports: number) {
  const ownerKeypair = loadWalletKeypair();
  const program = loadProgram(ownerKeypair);

  const payload = Buffer.concat([
    ownerKeypair.publicKey.toBuffer(),
    Buffer.from(amountLamports.toString()),
  ]);

  const { signature, sigHash } = signPayload(payload);

  console.log(`[client] Owner wallet:       ${ownerKeypair.publicKey.toBase58()}`);
  console.log(`[client] Amount:             ${amountLamports} lamports`);
  console.log(`[client] ML-DSA-65 sig size: ${signature.length} bytes`);
  console.log(`[client] Hash commitment:    ${sigHash.toString("hex")}`);

  const vaultPDA = getVaultPDA(ownerKeypair.publicKey, program.programId);
  const algoRegistryPDA = getAlgoRegistryPDA(program.programId);
  const tx = await (program.methods as any)
    .withdraw(new anchor.BN(amountLamports), Array.from(sigHash))
    .accounts({ vault: vaultPDA, owner: ownerKeypair.publicKey, algoRegistry: algoRegistryPDA })
    .rpc();
  console.log(`[client] Withdraw tx: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
}

export async function rotate() {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const keypair = ml_dsa65.keygen(seed);

  const rotatedPath = PQC_KEY_PATH.replace(".json", "-rotated.json");
  fs.writeFileSync(rotatedPath, JSON.stringify({
    publicKey: Array.from(keypair.publicKey),
    secretKey: Array.from(keypair.secretKey),
  }, null, 2));

  console.log(`[client] New ML-DSA-65 keypair generated → ${rotatedPath}`);
  console.log(`[client] New public key: ${keypair.publicKey.length} bytes`);

  const ownerKeypair = loadWalletKeypair();
  const program = loadProgram(ownerKeypair);
  const vaultPDA = getVaultPDA(ownerKeypair.publicKey, program.programId);
  const algoRegistryPDA = getAlgoRegistryPDA(program.programId);

  const newKeyTx = await (program.methods as any)
    .registerPqcKey(Array.from(keypair.publicKey))
    .accounts({ vault: vaultPDA, owner: ownerKeypair.publicKey })
    .rpc();
  console.log(`[client] Register new key tx: https://explorer.solana.com/tx/${newKeyTx}?cluster=devnet`);

  const rotateTx = await (program.methods as any)
    .rotateAlgorithm({ mlDsa65: {} })
    .accounts({ vault: vaultPDA, owner: ownerKeypair.publicKey, algoRegistry: algoRegistryPDA })
    .rpc();
  console.log(`[client] Rotate algorithm tx: https://explorer.solana.com/tx/${rotateTx}?cluster=devnet`);

  fs.copyFileSync(rotatedPath, PQC_KEY_PATH);
  console.log(`[client] Active keypair updated to ${PQC_KEY_PATH}`);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const [, , command, ...args] = process.argv;
  (async () => {
    switch (command) {
      case "generate-key":
        generateKey();
        break;
      case "register":
        await register();
        break;
      case "withdraw": {
        const lamports = parseInt(args[0] ?? "0");
        if (!lamports) {
          console.error("[client] Usage: withdraw <lamports>");
          process.exit(1);
        }
        await withdraw(lamports);
        break;
      }
      case "rotate":
        await rotate();
        break;
      default:
        console.log("Usage: ts-node src/index.ts <generate-key|register|withdraw <lamports>|rotate>");
    }
  })();
}
