import { useState, useEffect, useCallback } from 'react';
import { Keypair, Connection, LAMPORTS_PER_SOL, Transaction, VersionedTransaction } from '@solana/web3.js';
import { AnchorProvider } from '@coral-xyz/anchor';

const STORAGE_KEY = 'quantum-airbag-keypair';

function loadOrCreateKeypair(): Keypair {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(stored)));
    } catch {
      // fall through to generate new one
    }
  }
  const kp = Keypair.generate();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

export function useLocalWallet(connection: Connection) {
  const [keypair] = useState<Keypair>(() => loadOrCreateKeypair());
  const [balance, setBalance] = useState(0);

  const refreshBalance = useCallback(async () => {
    const lamports = await connection.getBalance(keypair.publicKey);
    setBalance(lamports);
  }, [connection, keypair]);

  useEffect(() => {
    refreshBalance();
    const id = connection.onAccountChange(keypair.publicKey, (info) =>
      setBalance(info.lamports)
    );
    return () => { connection.removeAccountChangeListener(id); };
  }, [connection, keypair, refreshBalance]);

  const wallet = {
    publicKey: keypair.publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      if (tx instanceof Transaction) tx.sign(keypair);
      else (tx as VersionedTransaction).sign([keypair]);
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> =>
      Promise.all(txs.map((tx) => wallet.signTransaction(tx))),
  };

  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

  const airdrop = useCallback(async () => {
    const sig = await connection.requestAirdrop(keypair.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig);
    await refreshBalance();
  }, [connection, keypair, refreshBalance]);

  return { keypair, publicKey: keypair.publicKey, balance, provider, refreshBalance, airdrop };
}
