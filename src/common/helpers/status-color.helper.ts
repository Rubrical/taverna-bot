import type { BotStatus } from '../../admin/domain/bot-status-info.js';

export function getStatusColor(status: BotStatus['status']): number {
  if (status === 'healthy') {
    return 0x2ecc71;
  }

  if (status === 'degraded') {
    return 0xf1c40f;
  }

  return 0xe74c3c;
}
