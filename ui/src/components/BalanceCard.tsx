import { useState } from 'react';
import { formatSOL, cn } from '../lib/utils';
import { VaultMode } from '../types';

interface BalanceCardProps {
  walletBalance: number;
  vaultBalance: number;
  vaultMode: VaultMode;
  vaultExists: boolean;
  onAirdrop: () => Promise<void>;
}

export function BalanceCard({
  walletBalance,
  vaultBalance,
  vaultMode,
  vaultExists,
  onAirdrop,
}: BalanceCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAirdrop = async () => {
    setLoading(true);
    setError('');
    try {
      await onAirdrop();
    } catch (e: any) {
      setError(e.message ?? 'Airdrop failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
          Wallet
        </div>
        <div className="font-mono text-2xl">{formatSOL(walletBalance)} SOL</div>
        <button
          onClick={handleAirdrop}
          disabled={loading}
          className={cn(
            'mt-2 px-3 py-1 text-xs border transition-smooth',
            loading
              ? 'border-gray-800 text-gray-600 cursor-not-allowed'
              : 'border-border hover:bg-gray-700 text-gray-400'
          )}
        >
          {loading ? 'Requesting…' : 'Airdrop 1 SOL'}
        </button>
        {error && <div className="text-xs text-red-400 mt-1">{error}</div>}
      </div>

      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
          Vault
        </div>
        <div className="font-mono text-2xl">
          {vaultExists ? `${formatSOL(vaultBalance)} SOL` : '—'}
        </div>
        {vaultExists && (
          <div
            className={cn(
              'text-xs font-medium mt-1 transition-smooth',
              vaultMode === 'Normal' ? 'text-green-400' : 'text-red-400'
            )}
          >
            {vaultMode.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}
