# Trade-offs & Known Limitations

This document is required by the Definition of Done. Every limitation is listed honestly, with the production path.

---

## 1. Pre-Migration Exposure (Harvest-Now-Decrypt-Later)

**Limitation**: Funds held in an Ed25519 wallet *before* the sentinel fires are already exposed on-chain. An adversary can record the public key today and derive the private key later once a quantum computer is available.

**Scope**: Quantum Airbag protects funds *once they are in the vault*. It does not retroactively protect funds that were never deposited.

**Production path**: Encourage early deposit into the vault (before any quantum threat materialises). Combine with HNDL awareness: treat all on-chain Ed25519 public keys as long-term liabilities.

---

## 2. Transaction Size — Dilithium3 vs Solana Limit

**Limitation**: Dilithium3 (ML-DSA-65) signatures are ~2.4KB. Solana's maximum transaction size is 1,232 bytes. A full on-chain Dilithium verification is not possible within current protocol limits.

**Prototype approach**: Off-chain verification with a hash commitment. The client signs the withdrawal payload with Dilithium off-chain, hashes the signature, and submits the hash on-chain. A trusted oracle attests to the signature validity. ML-DSA signing is real; on-chain storage is a commitment.

**Production path**: A ZK proof of the Dilithium signature (e.g. using a STARK or Groth16 circuit over the Dilithium verification relation). The ZK proof fits within transaction limits and preserves the cryptographic guarantee without a trusted oracle. This is a significant engineering effort; the oracle is a reasonable prototype trade-off.

---

## 3. Sentinel Centralisation

**Limitation**: The sentinel holds a single hot key scoped to the `migrate` instruction. A compromised sentinel can trigger a false lockdown (funds locked, no theft possible) but a single key is still a centralisation risk.

**Scope**: The key has no withdrawal power. It cannot change vault policy. The worst-case outcome of a full sentinel compromise is a false lockdown — users unlock with their PQC key. No funds can be stolen.

**Production path**: Replace the single sentinel authority with a multisig (e.g. 3-of-5 threshold). Require multiple independent threat intelligence sources to agree before `migrate` is callable. Adds latency to lockdown but eliminates single point of failure.

---

## 4. Protocol Dependency

**Limitation**: Solana's base layer — validators, consensus, and fee payer transactions — still uses Ed25519. Quantum Airbag does not change the underlying protocol.

**Scope**: This system protects *assets inside the vault* against quantum attack. It does not protect the transport layer or validator consensus. A quantum adversary could theoretically attack the Solana network itself (validators, leader schedule) — this is outside any application-layer solution's scope.

**Production path**: Solana core is already working on post-quantum readiness (SIMD-0416 Falcon syscall, Anza and Firedancer implementations). Quantum Airbag is designed to be complementary: when Solana adds native PQC to the protocol layer, the vault's `algo_version` dispatch table can be updated to route through the native syscall with no user migration.

---

## 5. Oracle Trust (Prototype Only)

**Limitation**: The off-chain hash commitment approach (see #2) requires a trusted oracle to attest to Dilithium signature validity. This reintroduces a trust assumption.

**Production path**: ZK proof (see #2). The oracle is explicitly a prototype shortcut documented here.
