interface HeaderProps {
  publicKey: string;
}

export function Header({ publicKey }: HeaderProps) {
  return (
    <header className="border-b border-border px-6 py-4 flex items-center justify-between">
      <h1 className="text-lg font-medium">Quantum Airbag</h1>
      <span className="font-mono text-xs text-gray-400">
        {publicKey.slice(0, 4)}…{publicKey.slice(-4)}
      </span>
    </header>
  );
}
