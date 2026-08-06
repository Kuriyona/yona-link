import { createApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { runMigrations } from './db/migrate';

const config = loadConfig();
const db = createDb(config.databasePath);
runMigrations(db);

createApp(db, config).listen(config.port);

console.log(`[Yona-Link] 服务已启动: http://localhost:${config.port}`);
console.log(`[Yona-Link] 短链跳转与 API(/api) 共用同一端口`);
