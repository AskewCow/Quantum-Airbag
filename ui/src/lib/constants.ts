import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('J7gxnojav3SRfJxHhFGsW2iATBV4zVUsrkcKNzauPqRa');
export const RPC_ENDPOINT = import.meta.env.VITE_RPC_ENDPOINT ?? 'http://localhost:8899';
export const THREAT_API_URL = 'http://localhost:3000';
export const POLL_INTERVAL = 2000;
export const PQC_PUBKEY_LEN = 1952;
