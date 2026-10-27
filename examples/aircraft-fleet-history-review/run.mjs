import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FleetInputError, HistoryAuditError, parseAuditFleetCsv, reviewFleetHistory,
} from './history.mjs';

export function parseArguments(argv) {
  let input = null;
  let output = null;
  let live = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' && !input && i + 1 < argv.length) input = argv[++i];
    else if (arg === '--output' && !output && i + 1 < argv.length) output = argv[++i];
    else if (arg === '--live' && !live) live = true;
    else throw new FleetInputError('Usage: node run.mjs --input fleet.csv [--live --output local-report.json]');
  }
  if (!input) throw new FleetInputError('Provide --input with a one-column nNumber CSV');
  if (output && !live) throw new FleetInputError('--output requires explicit --live mode');
  if (input === output) throw new FleetInputError('Output must be different from input');
  return { input, output, live };
}

export async function main(argv, {
  read = readFile,
  write = writeFile,
  environment = process.env,
  print = console.log,
  error = console.error,
  review = reviewFleetHistory,
} = {}) {
  try {
    const { input, output, live } = parseArguments(argv);
    const nNumbers = parseAuditFleetCsv(await read(input, 'utf8'));
    if (!live) {
      print('DRY RUN: ' + nNumbers.length + ' distinct known N-numbers; no API requests.');
      print('Use --live to make at most ' + nNumbers.length + ' metered history calls, one bounded event page each.');
      return 0;
    }
    const apiKey = environment.GRIZZLY_BULLS_API_KEY;
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      throw new FleetInputError('Set GRIZZLY_BULLS_API_KEY privately before --live');
    }
    const report = await review(nNumbers, { apiKey });
    const serialized = JSON.stringify(report, null, 2) + '\n';
    if (output) {
      await write(output, serialized, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      print('Saved ' + report.rows.length + ' privacy-safe review rows to ' + resolve(output));
    } else {
      print(serialized);
    }
    return 0;
  } catch (caught) {
    error(caught instanceof FleetInputError || caught instanceof HistoryAuditError
      ? caught.message
      : 'History review failed; no result was saved. Check input and API status.');
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
