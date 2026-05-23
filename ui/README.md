# Quantum Airbag UI

Minimal demo interface for the Quantum Airbag post-quantum vault.

## Features

- **Real-time balance display** - Wallet and vault balances
- **Vault operations** - Deposit, withdraw, register PQC keys
- **Zero-day simulation** - Trigger threat detection and lockdown
- **Operations log** - All program activities with timestamps

## Setup

### Prerequisites

1. **Built program** - Run `anchor build` in project root
2. **Copy IDL** - Copy `target/idl/quantum_airbag.json` to `ui/src/idl/`
3. **Local validator** - Run `solana-test-validator` in another terminal
4. **Threat API** - Run threat-api service on port 3000

### Install Dependencies

```bash
cd ui
npm install
```

### Update Configuration

Edit `src/lib/constants.ts` if needed:

```typescript
export const PROGRAM_ID = new PublicKey('YOUR_PROGRAM_ID');
export const RPC_ENDPOINT = 'http://localhost:8899';
export const THREAT_API_URL = 'http://localhost:3000';
```

### Run Development Server

```bash
npm run dev
```

Open http://localhost:5173

## Usage

### Initial Setup

1. Click "Connect Wallet" (top right)
2. Select wallet (Phantom recommended)
3. Approve connection

### Deposit Flow

1. Click "Deposit"
2. Enter amount in SOL
3. Press Enter or click again
4. Approve transaction in wallet
5. See balance update and log entry

### Withdraw Flow

1. Click "Withdraw"
2. Enter amount in SOL
3. Press Enter or click again
4. Approve transaction
5. See balance update and log entry

### Register PQC Key

1. Click "Register Key"
2. Approve transaction
3. Mock ML-DSA-65 key (1952 bytes) is registered

### Zero-Day Simulation

1. Click "Simulate Zero-Day"
2. Threat level changes to CRITICAL
3. After ~5 seconds, sentinel locks vault
4. Vault status changes to LOCKDOWN
5. Ed25519 withdrawals blocked
6. PQC withdrawals still work

## Architecture

### Components

- `Header.tsx` - Top bar with wallet connection
- `BalanceCard.tsx` - Wallet/vault balances and status
- `ActionPanel.tsx` - Deposit, withdraw, register buttons
- `ThreatControl.tsx` - Zero-day simulation control
- `OperationsLog.tsx` - Event log display

### Hooks

- `useBalance.ts` - Poll wallet balance
- `useVault.ts` - Subscribe to vault account changes
- `useLog.ts` - Operations log state management
- `useThreat.ts` - Threat API interaction

### Data Flow

```
User Action
    ↓
Program Instruction
    ↓
Transaction Sent
    ↓
Log Entry Added
    ↓
Account Update (subscription)
    ↓
UI Updates (balance, status)
```

## Styling

### Design Principles

- Minimal, information-dense layout
- Monospace for numbers and logs
- Dark theme with subtle accents
- No modals or popups
- Inline interactions

### Color Scheme

- Background: `#0a0a0a` (near black)
- Secondary: `#1a1a1a` (dark gray)
- Border: `#2a2a2a` (subtle)
- Normal: `#4ade80` (green)
- Lockdown: `#ef4444` (red)
- Critical: `#ef4444` (red)

## Troubleshooting

### "Wallet not connected"

Click "Connect Wallet" in top right corner.

### "Program not found"

1. Ensure local validator is running
2. Deploy program: `anchor deploy`
3. Update PROGRAM_ID in constants.ts

### "IDL not found"

Copy the IDL file:
```bash
cp ../target/idl/quantum_airbag.json src/idl/
```

### "Threat API not responding"

Start the threat API:
```bash
cd ../threat-api
npm install
npm start
```

### Balance not updating

Check:
1. Wallet is connected
2. Local validator is running
3. Browser console for errors

## Development

### Build for Production

```bash
npm run build
```

Output in `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Technical Details

### Polling Intervals

- Wallet balance: 2 seconds
- Threat level: 2 seconds
- Vault: Real-time subscription

### Log Format

```
HH:MM:SS  instruction    detail
16:24:15  deposit        1.0000 SOL
16:24:32  register_key   1952 bytes
16:25:00  threat         CRITICAL
16:25:01  migrate        LOCKDOWN
```

### Transaction Signatures

Log entries include transaction signatures (clickable to view on explorer, future enhancement).

## Future Enhancements

- Transaction signature links to Solana Explorer
- Export log to CSV
- Real Dilithium key generation
- WebSocket connection to sentinel
- Mobile responsive layout
