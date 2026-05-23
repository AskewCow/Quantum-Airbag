import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 8);
}

export function formatSOL(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

export function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatBytes(bytes: number): string {
  return `${bytes} bytes`;
}
