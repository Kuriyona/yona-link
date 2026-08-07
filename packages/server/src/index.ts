import { createApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { ensureAdminUser } from './services/user-service';

const config = loadConfig();
const db = createDb(config.databasePath);
await ensureAdminUser(db, config);

createApp(db, config).listen(config.port);

console.log(`[Yona-Link] 服务已启动: http://localhost:${config.port}`);
console.log(`[Yona-Link] 短链跳转与 API(/api) 共用同一端口`);
