import { useMemo } from 'react';
import { Connection, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import BN from 'bn.js';

import { Header } from './components/Header';
import { BalanceCard } from './components/BalanceCard';
import { ActionPanel } from './components/ActionPanel';
import { ThreatControl } from './components/ThreatControl';
import { OperationsLog } from './components/OperationsLog';

import { useLocalWallet } from './hooks/useLocalWallet';
import { useVault } from './hooks/useVault';
import { useLog } from './hooks/useLog';
import { useThreat } from './hooks/useThreat';

import { getVaultPDA, getAlgoRegistryPDA } from './lib/program';
import { formatSOL, formatBytes } from './lib/utils';
import { PQC_PUBKEY_LEN, RPC_ENDPOINT, PROGRAM_ID } from './lib/constants';

import idl from './idl/quantum_airbag.json';

function AppContent() {
  const connection = useMemo(() => new Connection(RPC_ENDPOINT, 'confirmed'), []);
  const { publicKey, balance: walletBalance, provider, airdrop } = useLocalWallet(connection);
  const { logs, addLog } = useLog();
  const { threatLevel, simulateZeroDay } = useThreat();

  const program = useMemo(
    () => new Program(idl as any, provider),
    [provider]
  );

  const { vaultBalance, vaultMode, vaultExists } = useVault(connection, program, publicKey);

  const handleDeposit = async (amount: number) => {
    try {
      const [vaultPDA] = getVaultPDA(publicKey, program.programId);
      const amountLamports = amount * LAMPORTS_PER_SOL;

      if (!vaultExists) {
        addLog('deposit', 'Initialising vault...');
        await program.methods
          .initVault()
          .accounts({ vault: vaultPDA, owner: publicKey, systemProgram: SystemProgram.programId })
          .rpc();
      }

      addLog('deposit', `${formatSOL(amountLamports)} SOL`);
      const tx = await program.methods
        .deposit(new BN(amountLamports))
        .accounts({ vault: vaultPDA, owner: publicKey, systemProgram: SystemProgram.programId })
        .rpc();
      addLog('deposit', `${formatSOL(amountLamports)} SOL`, tx);
    } catch (error: any) {
      addLog('deposit', `ERROR: ${error.message}`);
    }
  };

  const handleWithdraw = async (amount: number) => {
    try {
      const [vaultPDA] = getVaultPDA(publicKey, program.programId);
      const [algoRegistryPDA] = getAlgoRegistryPDA(program.programId);
      const amountLamports = amount * LAMPORTS_PER_SOL;
      const pqcSigHash = Array(32).fill(1);

      addLog('withdraw', `${formatSOL(amountLamports)} SOL`);
      const tx = await program.methods
        .withdraw(new BN(amountLamports), pqcSigHash)
        .accounts({ vault: vaultPDA, owner: publicKey, algoRegistry: algoRegistryPDA })
        .rpc();
      addLog('withdraw', `${formatSOL(amountLamports)} SOL`, tx);
    } catch (error: any) {
      addLog('withdraw', `ERROR: ${error.message}`);
    }
  };

  const handleRegisterKey = async () => {
    try {
      const [vaultPDA] = getVaultPDA(publicKey, program.programId);
      const mockPqcPubkey = Buffer.alloc(PQC_PUBKEY_LEN, 42);

      addLog('register_key', formatBytes(PQC_PUBKEY_LEN));
      const tx = await program.methods
        .registerPqcKey(mockPqcPubkey)
        .accounts({ vault: vaultPDA, owner: publicKey })
        .rpc();
      addLog('register_key', formatBytes(PQC_PUBKEY_LEN), tx);
    } catch (error: any) {
      addLog('register_key', `ERROR: ${error.message}`);
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
      <Header publicKey={publicKey.toBase58()} />

      <main className="flex-1 grid grid-cols-[30%_70%] divide-x divide-border">
        <div className="p-6 space-y-6">
          <BalanceCard
            walletBalance={walletBalance}
            vaultBalance={vaultBalance}
            vaultMode={vaultMode}
            vaultExists={vaultExists}
            onAirdrop={airdrop}
          />

          <div className="border-t border-border pt-6">
            <ActionPanel
              onDeposit={handleDeposit}
              onWithdraw={handleWithdraw}
              onRegisterKey={handleRegisterKey}
              disabled={false}
            />
          </div>

          <ThreatControl
            threatLevel={threatLevel}
            onSimulateZeroDay={handleSimulateZeroDay}
            disabled={false}
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
  return <AppContent />;
}
