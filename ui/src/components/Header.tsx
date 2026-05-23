import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function Header() {
  return (
    <header className="border-b border-border px-6 py-4 flex items-center justify-between">
      <h1 className="text-lg font-medium">Quantum Airbag</h1>
      <WalletMultiButton className="!bg-bg-secondary !text-gray-200 hover:!bg-gray-700 !border !border-border transition-smooth" />
    </header>
  );
}
