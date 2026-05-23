# Hackathon: Crypto-Agility on Solana

## Problem Statement

A business providing digital asset services must protect customer assets against zero-day threats to foundational cryptographic algorithms (e.g. ECDSA, Ed25519) — including the threat of harvest-now-decrypt-later (HNDL) attacks from quantum adversaries.

**Challenge:** Design a solution architecture and prototype that demonstrates **crypto-agility** to protect assets held in a wallet.

### Permitted Approaches
- Changes at the blockchain or protocol level
- Crypto-agile sidechains or auxiliary systems
- Wallet-level abstractions or control layers
- Third-party middleware or orchestration solutions

> Emphasis: architectural soundness, feasibility, and clarity of trade-offs — not production-ready code.

---

## Evaluation Criteria

| Criterion | Weight |
|---|---|
| **Success** — crypto-agility implemented without introducing new security/operational vulnerabilities | 25% |
| **Impact & Potential Reach** — breadth of use cases; deployability across a blockchain ecosystem or product suite | 25% |
| **Technical Feasibility** — deployment complexity, performance, dependencies, time-to-implementation vs. quantum risk timeline | 25% |
| **Innovation** — originality; advances thinking beyond existing/incremental solutions | 15% |
| **Presentation & Demo** — clarity of problem, solution, and trade-offs; demo quality | 10% |

Fidelity may also weight **commercialisability** — especially for wallet, digital asset platform, or related infrastructure plays.

---

## Strategic Notes

- **We are targeting Solana** — there is a prize category for it.
- Solana currently uses **Ed25519** for signatures, which is vulnerable to Shor's algorithm on a sufficiently powerful quantum computer.
- The NIST PQC standards (ML-DSA / Dilithium, SLH-DSA / SPHINCS+, ML-KEM / Kyber) are now finalised — safe to build on.
- Solana has active PQ work in progress (SIMD-0416 Falcon syscall, Anza and Firedancer implementations) — we can build *on top of* or *alongside* these rather than duplicating them.
- **Winternitz Vault** is an existing Solana proof-of-concept worth studying to differentiate from.

---

## Key Concepts

### Crypto-Agility
The ability to switch cryptographic algorithms without requiring fundamental redesign — i.e. the system is not hard-coupled to a single algorithm. A crypto-agile wallet can migrate keys/signatures from Ed25519 → ML-DSA → whatever comes next, with minimal friction.

### Harvest Now, Decrypt Later (HNDL)
Adversaries record encrypted traffic/signed transactions today and decrypt/forge them once a quantum computer is available. For blockchains, this means *current* public keys are already at risk if the quantum timeline is shorter than expected (Mosca's theorem).

### Mosca's Theorem
`X + Y > Z` → risk is present now, where:
- `X` = time to migrate to PQC
- `Y` = shelf life of data/assets
- `Z` = time until a CRQC (cryptographically relevant quantum computer) exists

---

## Resources

### Solana
| Resource | URL |
|---|---|
| AI-assisted build starter | https://www.solana.new/ |
| Solana docs | https://solana.com/docs |
| Developer templates | https://solana.com/developers/templates |
| Solana Cookbook | https://solana.com/developers/cookbook |
| Program examples | https://solana.com/docs/programs/examples |
| Anchor docs | https://www.anchor-lang.com/docs |
| Helius docs / RPC / APIs | https://www.helius.dev/docs |

### PQC Standards (NIST)
| Standard | Algorithm | URL |
|---|---|---|
| FIPS 203 | ML-KEM / Kyber (key encapsulation) | https://csrc.nist.gov/pubs/fips/203/final |
| FIPS 204 | ML-DSA / Dilithium (signatures) | https://csrc.nist.gov/pubs/fips/204/final |
| FIPS 205 | SLH-DSA / SPHINCS+ (hash-based signatures) | https://csrc.nist.gov/pubs/fips/205/final |
| NIST PQC overview | — | https://csrc.nist.gov/projects/post-quantum-cryptography |

### PQC Libraries
| Library | URL |
|---|---|
| Open Quantum Safe | https://openquantumsafe.org/ |
| liboqs | https://github.com/open-quantum-safe/liboqs |
| PQClean | https://github.com/PQClean/PQClean |

### Crypto-Agility Frameworks & Reading
| Resource | Where |
|---|---|
| Solana Quantum Readiness (official) | https://solana.com/news/quantum-readiness |
| Quantum Migration Paths for Solana (Jump Crypto) | https://jumpcrypto.com/resources/quantum-migration-paths-for-solana |
| Helius: Solana Post-Quantum Cryptography | https://www.helius.dev/blog/solana-post-quantum-cryptography |
| NIST IR 8547 — Transition to PQC Standards | Search: "NIST IR 8547" |
| NCCoE Migration to PQC project | Search: "NIST NCCoE PQC migration" |

### Solana × Post-Quantum (Prior Art to Know)
| Resource | Where |
|---|---|
| Solana Winternitz Vault | Search: "Solana Winternitz Vault" |
| SIMD-0416 Falcon syscall proposal | Search: "Solana SIMD-0416 Falcon" |
| Anza PQ implementation | Search: "Anza Falcon post-quantum Solana" |
| Firedancer PQ implementation | Search: "Firedancer Falcon post-quantum Solana" |
| crypto-rs (Rust PQC primitives) | https://github.com/dark-bio/crypto-rs |

---

## Architecture Decision Space

### Where to Insert Crypto-Agility

```
[User/Wallet UI]
      |
[Key Management Layer]  ← crypto-agile: can hold Ed25519 + ML-DSA keys
      |
[Transaction Construction]  ← hybrid signing: classical + PQ sig
      |
[Solana Program (on-chain)]  ← verifies hybrid sig; enforces policy
      |
[Solana L1 / Validator]  ← Ed25519 native; Falcon via SIMD-0416 (future)
```

### Options to Explore
1. **Wallet-level hybrid signing** — sign with Ed25519 AND ML-DSA; on-chain program verifies both. No L1 change needed.
2. **PQ-guarded vault program** — assets locked in a program account; withdrawal requires a PQ signature proof alongside classical sig.
3. **Key rotation framework** — on-chain registry mapping classical pubkeys to PQ successor keys; migration path defined before quantum threat materialises.
4. **Crypto-agile middleware** — off-chain orchestration layer that abstracts algorithm selection; wallets/dApps call middleware rather than hardcoding a scheme.

---

## Tech Stack (Likely)

- **Anchor** — Solana program framework (Rust)
- **liboqs** or **PQClean** — PQ algorithm implementations (for off-chain / client side)
- **TypeScript/JS** — wallet client, Helius RPC calls
- **Solana devnet** — testing target
