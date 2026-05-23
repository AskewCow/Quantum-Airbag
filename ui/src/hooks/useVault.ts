import { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { VaultMode } from '../types';
import { getVaultPDA } from '../lib/program';

export function useVault(
  connection: Connection | null,
  program: Program | null,
  publicKey: PublicKey | null
) {
  const [vaultBalance, setVaultBalance] = useState(0);
  const [vaultMode, setVaultMode] = useState<VaultMode>('Normal');
  const [vaultExists, setVaultExists] = useState(false);

  useEffect(() => {
    if (!connection || !program || !publicKey) return;

    const [vaultPDA] = getVaultPDA(publicKey, program.programId);

    const updateVault = async () => {
      try {
        const vaultAccount = await (program.account as any).vaultAccount.fetch(vaultPDA);
        setVaultBalance(vaultAccount.balance.toNumber());
        setVaultMode(
          vaultAccount.mode.normal !== undefined ? 'Normal' : 'Lockdown'
        );
        setVaultExists(true);
      } catch (error) {
        setVaultExists(false);
        setVaultBalance(0);
      }
    };

    updateVault();

    const subscriptionId = connection.onAccountChange(vaultPDA, updateVault);

    return () => {
      connection.removeAccountChangeListener(subscriptionId);
    };
  }, [connection, program, publicKey]);

  return { vaultBalance, vaultMode, vaultExists };
}
