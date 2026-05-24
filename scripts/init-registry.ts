import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PROGRAM_ID = new PublicKey("J7gxnojav3SRfJxHhFGsW2iATBV4zVUsrkcKNzauPqRa");
const RPC = "http://localhost:8899";

const walletKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(
    path.join(os.homedir(), ".config", "solana", "id.json"), "utf-8"
  )))
);

const sentinelKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "../sentinel-keypair.json"), "utf-8"
  )))
);

const idl = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, "../target/idl/quantum_airbag.json"), "utf-8"
));

(async () => {
  const connection = new Connection(RPC, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(walletKeypair),
    { commitment: "confirmed" }
  );
  const program = new anchor.Program(idl, provider);

  const [algoRegistryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("algo_registry")],
    PROGRAM_ID
  );

  console.log("Initialising algo registry...");
  console.log("  Registry PDA:     ", algoRegistryPDA.toBase58());
  console.log("  Sentinel pubkey:  ", sentinelKeypair.publicKey.toBase58());

  const tx = await program.methods
    .initializeRegistry(sentinelKeypair.publicKey)
    .accounts({
      algoRegistry: algoRegistryPDA,
      authority: walletKeypair.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("  Done:", tx);
})().catch((e) => { console.error(e); process.exit(1); });
