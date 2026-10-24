import { createRequire } from 'node:module';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const supported = new Set(['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-x64']);

export function platformPackage(platform = process.platform, arch = process.arch) {
  const key = `${platform}-${arch}`;
  if (!supported.has(key)) throw new Error('UNSUPPORTED_PLATFORM');
  return `@ut-protocol/utp-${key}`;
}

export async function resolveRuntime() {
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('NODE_VERSION_UNSUPPORTED');
  const packageName = platformPackage();
  let packagePath;
  try { packagePath = require.resolve(`${packageName}/package.json`); }
  catch { throw new Error('UTP_BINARY_MISSING'); }
  const binary = join(dirname(packagePath), process.platform === 'win32' ? 'utp.exe' : 'utp');
  try { await access(binary, process.platform === 'win32' ? constants.F_OK : constants.X_OK); }
  catch { throw new Error('UTP_BINARY_NOT_EXECUTABLE'); }
  return { binary, packageName, version: require(packagePath).version };
}
