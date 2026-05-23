export interface LogEntry {
  timestamp: Date;
  instruction: string;
  detail: string;
  txSignature?: string;
}

export type VaultMode = 'Normal' | 'Lockdown';

export type ThreatLevel = 'none' | 'elevated' | 'critical';

export interface VaultState {
  balance: number;
  mode: VaultMode;
  owner: string;
  pqcPubkey: Uint8Array;
}
