import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { chmodSync, existsSync, statSync } from 'node:fs';

// node-pty 1.1.0 ships its macOS spawn-helper as mode 0644. Restore the
// executable bits expected by posix_spawnp, without modifying binary contents,
// signatures or macOS quarantine/security settings.
if (process.platform !== 'win32') {
  const require = createRequire(import.meta.url);
  const root = dirname(require.resolve('node-pty/package.json'));
  for (const directory of ['build/Release', 'build/Debug', `prebuilds/${process.platform}-${process.arch}`]) {
    const helper = join(root, directory, 'spawn-helper');
    if (existsSync(helper)) {
      const mode = statSync(helper).mode;
      if ((mode & 0o111) !== 0o111) chmodSync(helper, mode | 0o111);
    }
  }
}
