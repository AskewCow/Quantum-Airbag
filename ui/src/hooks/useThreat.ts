import { useState, useEffect } from 'react';
import { ThreatLevel } from '../types';
import { getThreatLevel, setThreatLevel } from '../lib/threatApi';
import { POLL_INTERVAL } from '../lib/constants';

export function useThreat() {
  const [threatLevel, setThreatLevelState] = useState<ThreatLevel>('none');

  useEffect(() => {
    const updateThreatLevel = async () => {
      const level = await getThreatLevel();
      setThreatLevelState(level);
    };

    updateThreatLevel();
    const interval = setInterval(updateThreatLevel, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const simulateZeroDay = async () => {
    await setThreatLevel('critical');
    setThreatLevelState('critical');
  };

  return { threatLevel, simulateZeroDay };
}
