import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { resolveRuntime } from './runtime.mjs';

const help = `1688-shopping read-only catalog
  node scripts/catalog.mjs --help
  node scripts/catalog.mjs --doctor
  node scripts/catalog.mjs --request request.json

Request: one of keyword, image_url, image_path, product_url; optional limit 1-10.
Or: {"product_ids":["934435255816"]} (1-10 string IDs).
Relative image_path is resolved against the request file directory.
Requires Node.js >=20 and npm ci in the skill directory.
Success: JSON on stdout. Failure: sanitized JSON on stderr, exit 1.
Prices are channel references, not verified consumer prices.
`;
let client;
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log(help);
  } else {
    const doctor = args.length === 1 && args[0] === '--doctor';
    if (!doctor && !(args.length === 2 && args[0] === '--request')) throw new Error('USAGE_REQUEST_JSON_FILE');
    let sdk, stdio, core;
    try {
      [sdk, stdio, core] = await Promise.all([
        import('@modelcontextprotocol/client'), import('@modelcontextprotocol/client/stdio'), import('./catalog-core.mjs'),
      ]);
    } catch { throw new Error('DEPENDENCIES_MISSING'); }
    if (doctor) {
      const runtime = await resolveRuntime();
      console.log(JSON.stringify({ ok: true, node: process.versions.node, platform: process.platform, arch: process.arch,
        utpVersion: runtime.version, localReady: true, networkChecked: false, browserChecked: false }, null, 2));
    } else {
      let input;
      const requestPath = resolve(args[1]);
      try { input = JSON.parse((await readFile(requestPath, 'utf8')).replace(/^\uFEFF/, '')); }
      catch { throw new Error('REQUEST_FILE_INVALID'); }
      const request = core.requestSchema.parse(input);
      if (request.image_path) {
        request.image_path = resolve(dirname(requestPath), request.image_path);
        try { await access(request.image_path); } catch { throw new Error('IMAGE_FILE_NOT_FOUND'); }
      }
      const runtime = await resolveRuntime();
      client = new sdk.Client({ name: '1688-shopping-readonly', version: '2.0.0' });
      // Execute the platform binary directly: no shell, .cmd shim, or Unix symlink dependency.
      const transport = new stdio.StdioClientTransport({ command: runtime.binary,
        args: ['--no-update-check', 'mcp', 'serve'], stderr: 'ignore' });
      await client.connect(transport, { timeout: 25000 });
      const call = (name, parameters) => client.callTool({ name, arguments: parameters }, undefined, { timeout: 25000 });
      const output = await core.queryCatalog(request, call);
      console.log(JSON.stringify(output, null, 2));
    }
  }
} catch (error) {
  const known = /^(USAGE_REQUEST_JSON_FILE|DEPENDENCIES_MISSING|REQUEST_FILE_INVALID|IMAGE_FILE_NOT_FOUND|NODE_VERSION_UNSUPPORTED|UNSUPPORTED_PLATFORM|UTP_BINARY_MISSING|UTP_BINARY_NOT_EXECUTABLE|UPSTREAM_TOOL_ERROR|INVALID_BUSINESS_PAYLOAD|UPSTREAM_HTTP_\d{3}|DISCOVERY_FAILED|MISSING_SESSION|INVALID_PRODUCTS)$/;
  const code = error?.name === 'ZodError' ? 'SCHEMA_VALIDATION_FAILED' : known.test(error?.message) ? error.message : 'CATALOG_REQUEST_FAILED';
  console.error(JSON.stringify({ ok: false, error: code }));
  process.exitCode = 1;
} finally {
  try { await client?.close(); } catch { /* Preserve sanitized result. */ }
}
