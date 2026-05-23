# Quantum Airbag

**Crypto-agile asset protection on Solana** — TCD Claude Builder Club · Solana Hackathon 2026

Quantum Airbag protects user funds against zero-day quantum threats to Ed25519 by moving assets into a program-controlled PDA vault that enforces its own cryptographic policy. A PDA has no private key — there is nothing for a quantum computer to derive. Withdrawal requires a valid ML-DSA (Dilithium) signature. A background sentinel service watches threat feeds and automatically locks the vault when a credible threat is detected.

---

## Components

| Directory | What it is |
|-----------|-----------|
| `/program` | On-chain Rust/Anchor vault program (Person A) |
| `/sentinel` | Off-chain Node.js threat-monitoring service (Person B) |
| `/client` | CLI tool for PQC key management and withdrawals (Person B) |
| `/threat-api` | Mock Express threat intelligence API for demo (Person B) |

---

## Architecture

```
[User CLI / client]
      |  ML-DSA signed withdrawal
      v
[Vault Program — PDA]   <--  [Sentinel]  <--  [Threat API]
   algo_version                  |
   dispatch table          migrate ix
   (crypto-agile)          (lockdown only)
```

- **Normal mode**: sentinel runs silently; Ed25519 transactions relay gas only; PDA holds funds
- **Lockdown mode**: triggered by sentinel; Ed25519 withdrawals blocked at program level; only ML-DSA unlocks

---

## Build Order

Follow this sequence — each step produces something demonstrable before the next begins.

1. **Vault program** — `deposit` + `withdraw` with mock PQC boolean; prove funds move
2. **Real PQC verification** — swap mock for actual Dilithium verification in `withdraw`
3. **Lockdown mode** — add `mode` flag and `migrate` instruction; prove Ed25519 rejection
4. **Sentinel** — build poller, wire to `migrate`; prove auto-transition on API flip
5. **Key manager CLI** — keypair generation, `register`, `withdraw`, `rotate`
6. **Crypto-agility** — add `algo_version` dispatch and `rotate_algorithm` instruction
7. **Demo polish** — logging, clean CLI output, Explorer links at every step

---

## Live Demo Sequence (7 steps, ~2 minutes)

1. Create vault + register ML-DSA key → Mode: NORMAL
2. Deposit 0.5 SOL into PDA vault
3. Normal withdrawal with valid ML-DSA signature → ACCEPTED ✅
4. Flip threat API live: `curl -X POST localhost:3000/admin/set-level -d '{"level":"critical"}'`
5. Sentinel fires automatically → Vault: LOCKDOWN 🔒
6. Ed25519 withdrawal attempted → REJECTED ❌ AlgorithmBanned
7. ML-DSA withdrawal → ACCEPTED ✅ PQC verified

---

## ⚠ Transaction Size Warning

Dilithium3 signatures are 2.4KB. Solana's transaction limit is 1232 bytes. **Do not attempt to submit a full Dilithium signature on-chain** — use off-chain verification with a hash commitment. This is the most likely demo-breaker. Handle it from day one.

---

## Definition of Done

- [ ] Registry PDA initialised with Ed25519 and ML-DSA-65 both Active
- [ ] `register_pqc_key` stores ML-DSA-65 public key in vault account
- [ ] `withdraw` validates ML-DSA pubkey against registered owner
- [ ] `withdraw` rejects transactions with a Banned algorithm
- [ ] `ban_algorithm` sets status to Banned and emits log with timestamp
- [ ] `ban_algorithm` rejects calls from non-authority keypairs
- [ ] `npm run demo` runs full 7-step sequence with no errors
- [ ] Solana Explorer links printed for every on-chain transaction
- [ ] ML-DSA signing uses `liboqs` or `crystals-dilithium` — not a flag, not a simulation
- [ ] `TRADEOFFS.md` documents all known limitations and production paths
- [ ] All 7 Anchor integration tests pass

---

## First Hour (Both Together)

Before splitting:
1. `anchor init quantum-airbag` and deploy hello-world to devnet
2. Confirm `solana balance` and Explorer links work
3. Agree on shared data structures: `VaultAccount`, `AlgoVersion`, `VaultMode`
4. Paste program ID into `lib.rs` and `Anchor.toml`

**Do not split until this is done** — Person B cannot build a client without a deployed program ID.
