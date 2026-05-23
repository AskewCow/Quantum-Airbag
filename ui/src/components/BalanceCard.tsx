import { formatSOL, cn } from '../lib/utils';
import { VaultMode } from '../types';

interface BalanceCardProps {
  walletBalance: number;
  vaultBalance: number;
  vaultMode: VaultMode;
  vaultExists: boolean;
}

export function BalanceCard({
  walletBalance,
  vaultBalance,
  vaultMode,
  vaultExists,
}: BalanceCardProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
          Wallet
        </div>
        <div className="font-mono text-2xl">{formatSOL(walletBalance)} SOL</div>
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
