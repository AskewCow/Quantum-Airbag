import express, { Request, Response } from "express";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as dotenv from "dotenv";

dotenv.config();

const RPC = process.env.RPC_ENDPOINT ?? "http://localhost:8899";
const WALLET_KEYPAIR_PATH = process.env.WALLET_KEYPAIR_PATH ?? path.join(os.homedir(), ".config", "solana", "id.json");
const SENTINEL_KEYPAIR_PATH = process.env.SENTINEL_KEYPAIR_PATH ?? path.resolve(__dirname, "../../sentinel-keypair.json");
const IDL_PATH = process.env.IDL_PATH ?? path.resolve(__dirname, "../../target/idl/quantum_airbag.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadKeypair(p: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf-8"))));
}

function loadWalletProgram() {
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf-8"));
  const keypair = loadKeypair(WALLET_KEYPAIR_PATH);
  const connection = new Connection(RPC, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(keypair), { commitment: "confirmed" });
  const program = new anchor.Program(idl, provider);
  const [vaultPDA] = PublicKey.findProgramAddressSync([Buffer.from("vault"), keypair.publicKey.toBuffer()], program.programId);
  const [algoRegistryPDA] = PublicKey.findProgramAddressSync([Buffer.from("algo_registry")], program.programId);
  return { keypair, connection, program, vaultPDA, algoRegistryPDA };
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// GET /status — sentinel polls this
app.get("/status", (_req: Request, res: Response) => {
  res.json({ level: "none", timestamp: new Date().toISOString() });
});

// GET /state — wallet balance, vault balance, vault mode
app.get("/state", async (_req: Request, res: Response) => {
  try {
    const { keypair, connection, program, vaultPDA } = loadWalletProgram();
    const walletLamports = await connection.getBalance(keypair.publicKey);
    const vaultAccount = await (program.account as any).vaultAccount.fetch(vaultPDA).catch(() => null);
    res.json({
      walletBalance: walletLamports / LAMPORTS_PER_SOL,
      vaultBalance: vaultAccount ? vaultAccount.balance.toNumber() / LAMPORTS_PER_SOL : 0,
      vaultMode: vaultAccount ? (vaultAccount.mode.lockdown !== undefined ? "Lockdown" : "Normal") : "Normal",
      vaultExists: vaultAccount !== null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/deposit — airdrop SOL into the wallet
app.post("/admin/deposit", async (req: Request, res: Response) => {
  const { amount } = req.body as { amount?: number };
  const lamports = Math.round((amount ?? 1) * LAMPORTS_PER_SOL);
  try {
    const { keypair, connection } = loadWalletProgram();
    const sig = await connection.requestAirdrop(keypair.publicKey, lamports);
    await connection.confirmTransaction(sig);
    res.json({ sig, wallet: keypair.publicKey.toBase58(), lamports });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/withdraw — send SOL out of the wallet (simulates spending); blocked when vault is locked
app.post("/admin/withdraw", async (req: Request, res: Response) => {
  const { amount } = req.body as { amount?: number };
  if (!amount || amount <= 0) { res.status(400).json({ error: "amount required" }); return; }
  try {
    const { keypair, connection, program, vaultPDA } = loadWalletProgram();

    // Check if vault is locked — funds are secured, withdrawal not possible
    const vaultAccount = await (program.account as any).vaultAccount.fetch(vaultPDA).catch(() => null);
    if (vaultAccount && vaultAccount.mode.lockdown !== undefined) {
      res.status(400).json({ error: "Insufficient funds" });
      return;
    }

    const lamports = Math.round(amount * LAMPORTS_PER_SOL);
    const walletBalance = await connection.getBalance(keypair.publicKey);
    if (lamports >= walletBalance) {
      res.status(400).json({ error: "Insufficient wallet balance" });
      return;
    }

    // Transfer to a burn address to simulate spending
    const burnAddress = new PublicKey("1nc1nerator11111111111111111111111111111111");
    const tx = await anchor.web3.sendAndConfirmTransaction(
      connection,
      new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: burnAddress,
          lamports,
        })
      ),
      [keypair]
    );
    res.json({ tx, wallet: keypair.publicKey.toBase58(), lamports });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/zero-day — deposit all wallet funds into vault, then lock it
app.post("/admin/zero-day", async (_req: Request, res: Response) => {
  try {
    const { keypair, connection, program, vaultPDA, algoRegistryPDA } = loadWalletProgram();

    // Init vault first so its rent is already paid before we calculate how much to deposit
    const vaultAccount = await (program.account as any).vaultAccount.fetch(vaultPDA).catch(() => null);
    if (!vaultAccount) {
      await (program.methods as any).initVault()
        .accounts({ vault: vaultPDA, owner: keypair.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .rpc();
    }

    // Re-read balance after init, reserve only 5000 lamports for the deposit tx fee
    const walletLamports = await connection.getBalance(keypair.publicKey);
    const toDeposit = walletLamports - 5000;
    if (toDeposit <= 0) throw new Error("Wallet balance too low to trigger airbag");

    // Deposit all funds
    const depositTx = await (program.methods as any).deposit(new anchor.BN(toDeposit))
      .accounts({ vault: vaultPDA, owner: keypair.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .rpc();

    // Lock vault using sentinel keypair
    const sentinelKeypair = loadKeypair(SENTINEL_KEYPAIR_PATH);
    const sentinelProvider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(sentinelKeypair),
      { commitment: "confirmed" }
    );
    const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf-8"));
    const sentinelProgram = new anchor.Program(idl, sentinelProvider);
    const lockTx = await (sentinelProgram.methods as any).migrate()
      .accounts({ vault: vaultPDA, authority: sentinelKeypair.publicKey, algoRegistry: algoRegistryPDA })
      .rpc();

    res.json({
      depositTx,
      lockTx,
      deposited: toDeposit / LAMPORTS_PER_SOL,
      wallet: keypair.publicKey.toBase58(),
      vault: vaultPDA.toBase58(),
      sentinel: loadKeypair(SENTINEL_KEYPAIR_PATH).publicKey.toBase58(),
    });
  } catch (err: any) {
    console.error("[threat-api] zero-day error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`[threat-api] http://localhost:${PORT}`);
});
