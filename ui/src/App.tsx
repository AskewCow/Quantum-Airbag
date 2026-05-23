import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';

import { Header } from './components/Header';
import { BalanceCard } from './components/BalanceCard';
import { ActionPanel } from './components/ActionPanel';
import { ThreatControl } from './components/ThreatControl';
import { OperationsLog } from './components/OperationsLog';

import { useBalance } from './hooks/useBalance';
import { useVault } from './hooks/useVault';
import { useLog } from './hooks/useLog';
import { useThreat } from './hooks/useThreat';

import { getVaultPDA, getAlgoRegistryPDA } from './lib/program';
import { formatSOL, formatBytes } from './lib/utils';
import { PQC_PUBKEY_LEN, RPC_ENDPOINT, PROGRAM_ID } from './lib/constants';

import '@solana/wallet-adapter-react-ui/styles.css';

// Import IDL (you'll need to copy this from target/idl after building)
import idl from './idl/quantum_airbag.json';

function AppContent() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { logs, addLog } = useLog();
  const { threatLevel, simulateZeroDay } = useThreat();

  const walletBalance = useBalance(connection, wallet.publicKey);

  const program = useMemo(() => {
    if (!wallet.publicKey) return null;

    try {
      return new Program(idl as any, PROGRAM_ID, {
        connection,
      } as any);
    } catch (error) {
      console.error('Failed to create program:', error);
      return null;
    }
  }, [connection, wallet.publicKey]);

  const { vaultBalance, vaultMode, vaultExists } = useVault(
    connection,
    program,
    wallet.publicKey
  );

  const handleDeposit = async (amount: number) => {
    if (!wallet.publicKey || !program || !wallet.signTransaction) {
      addLog('deposit', 'ERROR: Wallet not connected');
      return;
    }

    try {
      const [vaultPDA] = getVaultPDA(wallet.publicKey, program.programId);
      const amountLamports = amount * LAMPORTS_PER_SOL;

      addLog('deposit', `${formatSOL(amountLamports)} SOL`);

      const tx = await program.methods
        .deposit(new (require('bn.js'))(amountLamports))
        .accounts({
          vault: vaultPDA,
          owner: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      addLog('deposit', `${formatSOL(amountLamports)} SOL`, tx);
    } catch (error: any) {
      addLog('deposit', `ERROR: ${error.message}`);
      console.error('Deposit failed:', error);
    }
  };

  const handleWithdraw = async (amount: number) => {
    if (!wallet.publicKey || !program) {
      addLog('withdraw', 'ERROR: Wallet not connected');
      return;
    }

    try {
      const [vaultPDA] = getVaultPDA(wallet.publicKey, program.programId);
      const [algoRegistryPDA] = getAlgoRegistryPDA(program.programId);
      const amountLamports = amount * LAMPORTS_PER_SOL;

      // Mock PQC signature hash (non-zero for valid)
      const pqcSigHash = Array(32).fill(1);

      addLog('withdraw', `${formatSOL(amountLamports)} SOL`);

      const tx = await program.methods
        .withdraw(new (require('bn.js'))(amountLamports), pqcSigHash)
        .accounts({
          vault: vaultPDA,
          owner: wallet.publicKey,
          algoRegistry: algoRegistryPDA,
        })
        .rpc();

      addLog('withdraw', `${formatSOL(amountLamports)} SOL`, tx);
    } catch (error: any) {
      addLog('withdraw', `ERROR: ${error.message}`);
      console.error('Withdraw failed:', error);
    }
  };

  const handleRegisterKey = async () => {
    if (!wallet.publicKey || !program) {
      addLog('register_key', 'ERROR: Wallet not connected');
      return;
    }

    try {
      const [vaultPDA] = getVaultPDA(wallet.publicKey, program.programId);

      // Generate mock PQC public key (1952 bytes)
      const mockPqcPubkey = Array(PQC_PUBKEY_LEN).fill(42);

      addLog('register_key', formatBytes(PQC_PUBKEY_LEN));

      const tx = await program.methods
        .registerPqcKey(mockPqcPubkey)
        .accounts({
          vault: vaultPDA,
          owner: wallet.publicKey,
        })
        .rpc();

      addLog('register_key', formatBytes(PQC_PUBKEY_LEN), tx);
    } catch (error: any) {
      addLog('register_key', `ERROR: ${error.message}`);
      console.error('Register key failed:', error);
    }
  };

  const handleSimulateZeroDay = async () => {
    try {
      await simulateZeroDay();
      addLog('threat', 'CRITICAL');
    } catch (error: any) {
      addLog('threat', `ERROR: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 grid grid-cols-[30%_70%] divide-x divide-border">
        <div className="p-6 space-y-6">
          <BalanceCard
            walletBalance={walletBalance}
            vaultBalance={vaultBalance}
            vaultMode={vaultMode}
            vaultExists={vaultExists}
          />

          <div className="border-t border-border pt-6">
            <ActionPanel
              onDeposit={handleDeposit}
              onWithdraw={handleWithdraw}
              onRegisterKey={handleRegisterKey}
              disabled={!wallet.connected}
            />
          </div>

          <ThreatControl
            threatLevel={threatLevel}
            onSimulateZeroDay={handleSimulateZeroDay}
            disabled={!wallet.connected}
          />
        </div>

        <div className="p-6">
          <OperationsLog logs={logs} />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => RPC_ENDPOINT || clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AppContent />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
