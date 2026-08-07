import { cpSync, existsSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const outDir = join(root, 'dist');

rmSync(outDir, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [join(root, 'src', 'index.ts'), join(root, 'src', 'db', 'migrate.ts')],
  outdir: outDir,
  target: 'bun',
  format: 'esm',
  sourcemap: 'inline'
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

renameSync(join(outDir, 'index.js'), join(outDir, 'yona-link.js'));

const nestedMigrate = join(outDir, 'db', 'migrate.js');
if (existsSync(nestedMigrate)) {
  renameSync(nestedMigrate, join(outDir, 'migrate.js'));
  rmSync(join(outDir, 'db'), { recursive: true, force: true });
}

const drizzleDir = join(root, 'drizzle');
if (existsSync(drizzleDir)) {
  cpSync(drizzleDir, join(outDir, 'drizzle'), { recursive: true });
}

for (const output of result.outputs) {
  console.log(`[Yona-Link] 已生成: ${output.path}`);
}
console.log('[Yona-Link] 打包完成，产物位于 dist/');
