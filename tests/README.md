# Quantum Airbag Tests

Comprehensive test suite for the Quantum Airbag program, covering all instructions and edge cases.

## Test Coverage

### Core Functionality
- **Deposit Tests** - Vault creation, deposits, balance tracking
- **Register PQC Key** - ML-DSA-65 public key registration
- **Withdraw (Normal Mode)** - PQC signature verification, balance checks
- **Migrate to Lockdown** - Sentinel authority enforcement
- **Withdraw (Lockdown Mode)** - Ed25519 blocking, PQC allowance

### Crypto-Agility
- **Algorithm Rotation** - User-initiated algorithm switching
- **Algorithm Registry** - Authority bans, global effect

### Security & Edge Cases
- **Authorization Tests** - Prevent unauthorized access
- **Validation Tests** - Invalid inputs, insufficient balance
- **Attack Scenarios** - Cross-user vault access attempts

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Ensure Anchor CLI is installed
anchor --version  # Should be 0.31.1 or higher
```

### Local Validator Tests
```bash
# Start local validator in one terminal
solana-test-validator

# Run tests in another terminal
anchor test --skip-deploy
```

### Full Test Suite (with deploy)
```bash
anchor test
```

### Test Against Devnet
```bash
# Set cluster to devnet
solana config set --url devnet

# Deploy program
anchor deploy

# Run tests
anchor test --skip-deploy --provider.cluster devnet
```

## Test Structure

```
tests/
└── quantum-airbag.ts    - Main test suite (500+ lines)
```

### Test Flow
1. **Setup** - Generate test keypairs, airdrop SOL
2. **Initialize Registry** - Create global algorithm registry PDA
3. **Deposit Tests** - Verify vault creation and deposits
4. **PQC Registration** - Register ML-DSA public keys
5. **Normal Mode Withdrawals** - Test PQC verification
6. **Lockdown Tests** - Sentinel authority, mode enforcement
7. **Crypto-Agility** - Algorithm rotation and banning
8. **Security Tests** - Edge cases and attack scenarios

## Key Test Scenarios

### Normal Mode
- ✅ Deposit creates vault with correct owner
- ✅ Additional deposits increase balance
- ✅ Zero deposits are rejected
- ✅ PQC key registration stores 1952-byte key
- ✅ Invalid key length rejected
- ✅ Withdrawals with valid hash succeed
- ✅ Withdrawals with zero hash fail
- ✅ Cannot withdraw more than balance

### Lockdown Mode
- ✅ Sentinel can trigger lockdown
- ✅ Non-sentinel cannot trigger lockdown
- ✅ Ed25519 withdrawals (zero hash) rejected in lockdown
- ✅ PQC withdrawals (non-zero hash) allowed in lockdown

### Crypto-Agility
- ✅ Users can rotate algorithm version
- ✅ Registry authority can ban algorithms
- ✅ Withdrawals fail after algorithm banned

### Security
- ✅ Cannot withdraw from another user's vault
- ✅ Cannot register key for another user's vault
- ✅ Authorization constraints enforced

## Important Notes

### Mock PQC Verification
The current implementation uses **mock PQC verification**:
- Non-zero hash = valid signature
- Zero hash = invalid signature

This is a **prototype** approach. Production requires:
- Real Dilithium3 signature verification, OR
- ZK proof of signature validity

### Sentinel Authority
Tests assume `SENTINEL_AUTHORITY` in the program matches the test sentinel keypair. Update `/program/src/lib.rs:10` before running:

```rust
const SENTINEL_AUTHORITY: &str = "YOUR_SENTINEL_PUBKEY_HERE";
```

### Registry Authority
The algorithm registry is initialized with `registryAuthority` in tests. This authority can ban algorithms globally.

## Test Output Example

```
quantum-airbag
  Test accounts initialized:
    Owner: 5ZWj7...
    Vault PDA: 8Xmk9...
    Sentinel: 3Qwe8...
    Registry: 7Hnm2...
    Algorithm registry initialized

  Deposit
    ✓ Creates vault and deposits SOL (234ms)
    ✓ Deposits additional SOL to existing vault (189ms)
    ✓ Fails to deposit 0 SOL (123ms)

  Register PQC Key
    ✓ Registers a valid ML-DSA-65 public key (201ms)
    ✓ Fails to register invalid length key (167ms)

  Withdraw (Normal Mode)
    ✓ Withdraws SOL with valid PQC signature hash (298ms)
    ✓ Fails to withdraw with zero signature hash (145ms)
    ✓ Fails to withdraw more than balance (134ms)

  Migrate to Lockdown Mode
    ✓ Sentinel triggers lockdown successfully (178ms)
    ✓ Non-sentinel cannot trigger lockdown (156ms)

  Withdraw in Lockdown Mode
    ✓ Rejects Ed25519 withdrawal (zero hash) in lockdown (143ms)
    ✓ Allows PQC withdrawal (non-zero hash) in lockdown (289ms)

  Algorithm Rotation
    ✓ User rotates algorithm version (194ms)

  Algorithm Registry
    ✓ Registry authority bans an algorithm (201ms)
    ✓ Withdrawals fail after algorithm is banned (134ms)

  Edge Cases
    ✓ Cannot withdraw from another user's vault (167ms)
    ✓ Cannot register PQC key for another user's vault (145ms)

  18 passing (4.2s)
```

## Troubleshooting

### "AlgoRegistry not found"
Ensure the registry is initialized before running withdraw tests. The `before()` hook should handle this automatically.

### "Sentinel authority mismatch"
Update `SENTINEL_AUTHORITY` in `/program/src/lib.rs:10` to match your test sentinel keypair.

### "Insufficient SOL"
Local validator should auto-airdrop. For devnet, manually request SOL from https://faucet.solana.com/

### "Program not deployed"
Run `anchor build && anchor deploy` before testing.

## Next Steps

1. **Deploy to devnet** - Get real program ID
2. **Real PQC verification** - Integrate Dilithium3 verification or ZK proofs
3. **Integration tests** - Test with client CLI and sentinel service
4. **Performance tests** - Measure transaction costs
5. **Fuzzing** - Test with random inputs for edge cases
