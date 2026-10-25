import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FleetApiError, FleetInputError, parseFleetCsv, refreshFleet } from './fleet.mjs';

export function parseArguments(argv) {
  let input = null;
  let output = null;
  let live = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' && !input && i + 1 < argv.length) input = argv[++i];
    else if (arg === '--output' && !output && i + 1 < argv.length) output = argv[++i];
    else if (arg === '--live' && !live) live = true;
    else throw new FleetInputError('Usage: node run.mjs --input path [--live] [--output path]');
  }
  if (!input) throw new FleetInputError('Specify --input with a one-column nNumber CSV');
  if (input === output) throw new FleetInputError('Input and output must be separate files');
  if (output && !live) throw new FleetInputError('Output files require explicit --live mode');
  return { input, output, live };
}

export async function main(argv, {
  read = readFile,
  write = writeFile,
  environment = process.env,
  print = console.log,
  error = console.error,
} = {}) {
  try {
    const { input, output, live } = parseArguments(argv);
    const nNumbers = parseFleetCsv(await read(input, 'utf8'));
    if (!live) {
      print('DRY RUN: ' + nNumbers.length + ' unique, valid N-number(s). No API calls made.');
      print('To spend up to ' + nNumbers.length + ' monthly current_lookup request(s), add --live.');
      return 0;
    }
    if (typeof environment.GRIZZLY_BULLS_API_KEY !== 'string'
        || !environment.GRIZZLY_BULLS_API_KEY.trim()) {
      throw new FleetInputError('Set GRIZZLY_BULLS_API_KEY privately before --live');
    }
    const report = await refreshFleet(nNumbers, { apiKey: environment.GRIZZLY_BULLS_API_KEY });
    const sanitized = JSON.stringify(report, null, 2) + '\n';
    if (output) {
      await write(output, sanitized, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      print('Saved ' + report.rows.length + ' sanitized rows to ' + resolve(output) + ' (private local file).');
    } else {
      print(sanitized);
    }
    return 0;
  } catch (caught) {
    // No HTTP body, authorization header, secret, or untrusted exception trace.
    error(caught instanceof FleetInputError || caught instanceof FleetApiError
      ? caught.message
      : 'Fleet refresh failed. Check input, API status, and quota; no output was saved.');
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
