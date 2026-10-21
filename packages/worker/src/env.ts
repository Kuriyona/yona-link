import type { AppConfig, Bindings } from './config';
import type { Db } from './db/client';
import type { AuthContext } from './middleware/auth';

export interface Variables {
  db: Db;
  config: AppConfig;
  auth: AuthContext | null;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
