/**
 * After `anchor build`, the real program ID lives in:
 *   target/deploy/quantum_airbag-keypair.json
 *
 * This script reads that keypair, derives the public key, and patches:
 *   - program/src/lib.rs      (declare_id!)
 *   - Anchor.toml             ([programs.localnet])
 *   - ui/src/idl/quantum_airbag.json  (metadata.address)
 *   - client/.env.example
 *   - sentinel/.env.example
 *
 * Usage:  ts-node scripts/sync-program-id.ts
 */

import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "..");
const keypairPath = path.join(root, "target", "deploy", "quantum_airbag-keypair.json");

if (!fs.existsSync(keypairPath)) {
  console.error(`[sync] Keypair not found at ${keypairPath}`);
  console.error(`[sync] Run 'anchor build' first.`);
  process.exit(1);
}

const keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
);
const programId = keypair.publicKey.toBase58();
console.log(`[sync] Program ID: ${programId}`);

// patch lib.rs
const libRsPath = path.join(root, "program", "src", "lib.rs");
const libRs = fs.readFileSync(libRsPath, "utf-8");
const patchedLibRs = libRs.replace(
  /declare_id!\("[^"]+"\)/,
  `declare_id!("${programId}")`
);
fs.writeFileSync(libRsPath, patchedLibRs);
console.log(`[sync] Patched program/src/lib.rs`);

// patch Anchor.toml — replace or add [programs.localnet]
const anchorTomlPath = path.join(root, "Anchor.toml");
let anchorToml = fs.readFileSync(anchorTomlPath, "utf-8");
if (anchorToml.includes("[programs.localnet]")) {
  anchorToml = anchorToml.replace(
    /\[programs\.localnet\][^\[]*/,
    `[programs.localnet]\nquantum_airbag = "${programId}"\n\n`
  );
} else {
  anchorToml = anchorToml.replace(
    "[programs.devnet]",
    `[programs.localnet]\nquantum_airbag = "${programId}"\n\n[programs.devnet]`
  );
}
anchorToml = anchorToml.replace(
  /(\[programs\.devnet\][^\[]*quantum_airbag = ")[^"]+(")/,
  `$1${programId}$2`
);
fs.writeFileSync(anchorTomlPath, anchorToml);
console.log(`[sync] Patched Anchor.toml`);

// patch UI IDL
const idlPath = path.join(root, "ui", "src", "idl", "quantum_airbag.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
idl.metadata.address = programId;
fs.writeFileSync(idlPath, JSON.stringify(idl, null, 2));
console.log(`[sync] Patched ui/src/idl/quantum_airbag.json`);

// patch .env.examples
for (const envPath of [
  path.join(root, "client", ".env.example"),
  path.join(root, "sentinel", ".env.example"),
]) {
  const env = fs.readFileSync(envPath, "utf-8");
  fs.writeFileSync(envPath, env.replace(/PROGRAM_ID=.*/, `PROGRAM_ID=${programId}`));
  console.log(`[sync] Patched ${path.relative(root, envPath)}`);
}

console.log(`\n[sync] Done. Now run 'anchor build' once more to embed the corrected ID, then 'anchor deploy'.`);
