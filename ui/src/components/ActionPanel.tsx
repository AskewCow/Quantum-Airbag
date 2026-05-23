import { useState } from 'react';
import { cn } from '../lib/utils';

interface ActionPanelProps {
  onDeposit: (amount: number) => Promise<void>;
  onWithdraw: (amount: number) => Promise<void>;
  onRegisterKey: () => Promise<void>;
  disabled: boolean;
}

export function ActionPanel({
  onDeposit,
  onWithdraw,
  onRegisterKey,
  disabled,
}: ActionPanelProps) {
  const [showDepositInput, setShowDepositInput] = useState(false);
  const [showWithdrawInput, setShowWithdrawInput] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) return;

    setLoading(true);
    try {
      await onDeposit(amount);
      setDepositAmount('');
      setShowDepositInput(false);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) return;

    setLoading(true);
    try {
      await onWithdraw(amount);
      setWithdrawAmount('');
      setShowWithdrawInput(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterKey = async () => {
    setLoading(true);
    try {
      await onRegisterKey();
    } finally {
      setLoading(false);
    }
  };

  const buttonClass = cn(
    'w-full px-4 py-2 text-sm border transition-smooth text-left',
    disabled || loading
      ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'
      : 'bg-bg-secondary border-border hover:bg-gray-700'
  );

  return (
    <div className="space-y-2">
      {showDepositInput && (
        <input
          type="number"
          placeholder="Amount (SOL)"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleDeposit();
            if (e.key === 'Escape') setShowDepositInput(false);
          }}
          className="w-full px-3 py-2 bg-gray-900 border border-border text-sm focus:outline-none focus:border-gray-600"
          autoFocus
          disabled={loading}
        />
      )}
      <button
        onClick={() => (showDepositInput ? handleDeposit() : setShowDepositInput(true))}
        disabled={disabled || loading}
        className={buttonClass}
      >
        Deposit
      </button>

      {showWithdrawInput && (
        <input
          type="number"
          placeholder="Amount (SOL)"
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleWithdraw();
            if (e.key === 'Escape') setShowWithdrawInput(false);
          }}
          className="w-full px-3 py-2 bg-gray-900 border border-border text-sm focus:outline-none focus:border-gray-600"
          autoFocus
          disabled={loading}
        />
      )}
      <button
        onClick={() =>
          showWithdrawInput ? handleWithdraw() : setShowWithdrawInput(true)
        }
        disabled={disabled || loading}
        className={buttonClass}
      >
        Withdraw
      </button>

      <button
        onClick={handleRegisterKey}
        disabled={disabled || loading}
        className={buttonClass}
      >
        Register Key
      </button>
    </div>
  );
}
