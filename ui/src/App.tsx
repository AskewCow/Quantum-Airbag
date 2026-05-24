import { useState, useEffect, useCallback, useRef } from 'react';

const API = 'http://localhost:3000';

interface ChainState {
  walletBalance: number;
  vaultBalance: number;
  vaultMode: 'Normal' | 'Lockdown';
  vaultExists: boolean;
}

interface LogEntry {
  time: string;
  lines: string[];
  ok: boolean;
}

function timestamp() {
  return new Date().toTimeString().slice(0, 8);
}

function short(addr: string) {
  return addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '';
}

async function post(path: string, body?: object) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

export default function App() {
  const [chain, setChain] = useState<ChainState>({
    walletBalance: 0, vaultBalance: 0, vaultMode: 'Normal', vaultExists: false,
  });
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const depositRef = useRef<HTMLInputElement>(null);

  const addLog = useCallback((lines: string[], ok = true) => {
    setLogs(prev => [{ time: timestamp(), lines, ok }, ...prev].slice(0, 20));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API}/state`);
      if (res.ok) setChain(await res.json());
    } catch { /* validator not up yet */ }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) return;
    run(async () => {
      try {
        const d = await post('/admin/deposit', { amount });
        addLog([
          `airdrop  ${amount} SOL`,
          `to       ${short(d.wallet)}`,
          `sig      ${short(d.sig)}`,
          `status   confirmed`,
        ]);
        setDepositAmount('');
      } catch (e: any) {
        addLog([`airdrop  failed`, `error    ${e.message}`], false);
      }
    });
  };

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) return;
    run(async () => {
      try {
        const d = await post('/admin/withdraw', { amount });
        addLog([
          `transfer  ${amount} SOL`,
          `from      ${short(d.wallet)}`,
          `sig       ${short(d.tx)}`,
          `status    confirmed`,
        ]);
        setWithdrawAmount('');
      } catch (e: any) {
        addLog([`transfer  failed`, `error     ${e.message}`], false);
      }
    });
  };

  const handleZeroDay = () => run(async () => {
    try {
      const d = await post('/admin/zero-day');
      addLog([
        `deposit   ${d.deposited.toFixed(6)} SOL`,
        `from      ${short(d.wallet)}`,
        `to vault  ${short(d.vault)}`,
        `sig       ${short(d.depositTx)}`,
        `status    confirmed`,
      ]);
      addLog([
        `migrate   vault → lockdown`,
        `vault     ${short(d.vault)}`,
        `authority ${short(d.sentinel)}`,
        `sig       ${short(d.lockTx)}`,
        `status    confirmed`,
      ]);
    } catch (e: any) {
      addLog([`zero-day  failed`, `error     ${e.message}`], false);
    }
  });

  const locked = chain.vaultMode === 'Lockdown';

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5',
      fontFamily: "'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace",
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: 540, padding: '0 1rem' }}>

        {/* Title */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Quantum Airbag
          </div>
          <div style={{ fontSize: '0.75rem', color: '#333', marginTop: 4 }}>
            Post-quantum vault protection · localnet
          </div>
        </div>

        {/* Balances */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <div style={{ background: '#111', border: '1px solid #222', padding: '1.25rem' }}>
            <div style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Wallet
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 500 }}>
              {chain.walletBalance.toFixed(4)}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#444', marginTop: 2 }}>SOL</div>
          </div>

          <div style={{
            background: '#111',
            border: `1px solid ${locked ? '#7f1d1d' : '#222'}`,
            padding: '1.25rem',
            transition: 'border-color 0.3s',
          }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: '#555' }}>Vault</span>
              {chain.vaultExists && (
                <span style={{ color: locked ? '#f87171' : '#4ade80', fontSize: '0.6rem' }}>
                  {chain.vaultMode.toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 500, color: locked ? '#fca5a5' : '#e5e5e5' }}>
              {chain.vaultExists ? chain.vaultBalance.toFixed(4) : '—'}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#444', marginTop: 2 }}>SOL</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={depositRef}
              type="number"
              placeholder="SOL amount"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDeposit()}
              disabled={busy}
              style={inputStyle(busy)}
            />
            <Btn onClick={handleDeposit} disabled={busy || !depositAmount} style={{ width: 140, flexShrink: 0 }}>
              airdrop
            </Btn>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              placeholder="SOL amount"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleWithdraw()}
              disabled={busy}
              style={inputStyle(busy)}
            />
            <Btn onClick={handleWithdraw} disabled={busy || !withdrawAmount} style={{ width: 140, flexShrink: 0 }}>
              transfer
            </Btn>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #1a1a1a', marginBottom: 16 }} />

        {/* Zero-day */}
        <button
          onClick={handleZeroDay}
          disabled={busy || locked}
          style={{
            width: '100%', padding: '0.875rem',
            background: locked ? '#0f0505' : '#140505',
            border: `1px solid ${locked ? '#450a0a' : '#7f1d1d'}`,
            color: locked ? '#555' : '#f87171',
            fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: busy || locked ? 'not-allowed' : 'pointer',
            marginBottom: 24,
            transition: 'all 0.2s',
          }}
        >
          {locked ? 'vault locked — migrate complete' : 'trigger zero-day'}
        </button>

        {/* Log */}
        <div>
          <div style={{ fontSize: '0.6rem', color: '#333', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            Transaction log
          </div>
          <div style={{ height: 260, overflowY: 'auto' }}>
            {logs.length === 0 ? (
              <div style={{ fontSize: '0.7rem', color: '#2a2a2a' }}>No transactions yet</div>
            ) : (
              logs.map((entry, i) => (
                <div key={i} style={{
                  marginBottom: 12, paddingBottom: 12,
                  borderBottom: '1px solid #161616',
                }}>
                  <div style={{ fontSize: '0.65rem', color: '#444', marginBottom: 4 }}>{entry.time}</div>
                  {entry.lines.map((line, j) => (
                    <div key={j} style={{ fontSize: '0.72rem', color: entry.ok ? (j === 0 ? '#a3a3a3' : '#555') : '#f87171', lineHeight: 1.6 }}>
                      {line}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function inputStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: 1, background: disabled ? '#0d0d0d' : '#111',
    border: '1px solid #222', color: disabled ? '#444' : '#e5e5e5',
    padding: '0.5rem 0.75rem', fontSize: '0.8rem', outline: 'none',
  };
}

function Btn({ children, onClick, disabled, style }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: '#111', border: '1px solid #222',
        color: disabled ? '#444' : '#a3a3a3',
        padding: '0.5rem 0.75rem', fontSize: '0.8rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: '100%',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
