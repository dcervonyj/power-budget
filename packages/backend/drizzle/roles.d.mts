import type { Client, Pool } from 'pg';

export function applyRoles(
  db: Pool | Client,
  options: { appUser: string; appPassword: string },
): Promise<void>;
