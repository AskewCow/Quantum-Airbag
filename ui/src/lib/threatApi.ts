import { ThreatLevel } from '../types';
import { THREAT_API_URL } from './constants';

export async function getThreatLevel(): Promise<ThreatLevel> {
  try {
    const response = await fetch(`${THREAT_API_URL}/status`);
    const data = await response.json();
    return data.level;
  } catch (error) {
    console.error('Failed to fetch threat level:', error);
    return 'none';
  }
}

export async function setThreatLevel(level: ThreatLevel): Promise<void> {
  try {
    await fetch(`${THREAT_API_URL}/admin/set-level`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level }),
    });
  } catch (error) {
    console.error('Failed to set threat level:', error);
  }
}
