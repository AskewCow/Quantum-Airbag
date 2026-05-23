import { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { POLL_INTERVAL } from '../lib/constants';

export function useBalance(connection: Connection | null, publicKey: PublicKey | null) {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (!connection || !publicKey) return;

    const updateBalance = async () => {
      try {
        const bal = await connection.getBalance(publicKey);
        setBalance(bal);
      } catch (error) {
        console.error('Failed to fetch balance:', error);
      }
    };

    updateBalance();
    const interval = setInterval(updateBalance, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [connection, publicKey]);

  return balance;
}
