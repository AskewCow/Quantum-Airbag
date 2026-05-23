import { useState, useCallback } from 'react';
import { LogEntry } from '../types';

export function useLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((instruction: string, detail: string, txSignature?: string) => {
    const entry: LogEntry = {
      timestamp: new Date(),
      instruction,
      detail,
      txSignature,
    };
    setLogs((prev) => [entry, ...prev].slice(0, 100));
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, addLog, clearLogs };
}
