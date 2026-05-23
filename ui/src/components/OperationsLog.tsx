import { LogEntry } from '../types';
import { formatTime } from '../lib/utils';

interface OperationsLogProps {
  logs: LogEntry[];
}

export function OperationsLog({ logs }: OperationsLogProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-4">
        Operations
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-sm space-y-0.5">
        {logs.length === 0 ? (
          <div className="text-gray-600 text-xs">No operations yet</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-4 hover:text-gray-100 transition-smooth">
              <span className="text-gray-600 flex-shrink-0">
                {formatTime(log.timestamp)}
              </span>
              <span className="text-gray-400 flex-shrink-0 w-24">
                {log.instruction}
              </span>
              <span className="text-gray-300 flex-1 text-right truncate">
                {log.detail}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
