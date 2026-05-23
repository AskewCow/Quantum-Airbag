/**
 * Generate a Solana wallet keypair and save it to ~/.config/solana/id.json
 * (the default path that Anchor and the Solana CLI expect).
 *
 * Usage:  ts-node scripts/generate-wallet.ts [output-path]
 */

import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const outPath =
  process.argv[2] ??
  path.join(os.homedir(), ".config", "solana", "id.json");

if (fs.existsSync(outPath)) {
  const existing = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(outPath, "utf-8")))
  );
  console.log(`[wallet] Keypair already exists at ${outPath}`);
  console.log(`[wallet] Public key: ${existing.publicKey.toBase58()}`);
  console.log(`[wallet] Delete the file and re-run to generate a new one.`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });

const keypair = Keypair.generate();
fs.writeFileSync(outPath, JSON.stringify(Array.from(keypair.secretKey)));

console.log(`[wallet] Keypair generated → ${outPath}`);
console.log(`[wallet] Public key: ${keypair.publicKey.toBase58()}`);
console.log(`[wallet] Keep this file secret — it controls your wallet.`);
