import { ThreatLevel } from '../types';
import { cn } from '../lib/utils';

interface ThreatControlProps {
  threatLevel: ThreatLevel;
  onSimulateZeroDay: () => Promise<void>;
  disabled: boolean;
}

export function ThreatControl({
  threatLevel,
  onSimulateZeroDay,
  disabled,
}: ThreatControlProps) {
  const getThreatColor = (level: ThreatLevel) => {
    switch (level) {
      case 'critical':
        return 'text-red-400';
      case 'elevated':
        return 'text-orange-400';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-4 pt-6 border-t border-border">
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
          Threat Level
        </div>
        <div
          className={cn(
            'text-sm font-medium transition-smooth',
            getThreatColor(threatLevel)
          )}
        >
          {threatLevel.toUpperCase()}
        </div>
      </div>

      <button
        onClick={onSimulateZeroDay}
        disabled={disabled}
        className={cn(
          'w-full px-4 py-2 text-sm border transition-smooth',
          disabled
            ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'
            : 'bg-bg-secondary border-border hover:bg-gray-700'
        )}
      >
        Simulate Zero-Day
      </button>
    </div>
  );
}
