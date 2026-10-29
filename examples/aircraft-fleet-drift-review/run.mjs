import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FleetInputError, FleetApiError, HistoryAuditError, parseInventoryCsv, reviewFleetDrift,
} from './drift.mjs';

export function parseArguments(argv) {
  let input = null;
  let output = null;
  let live = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' && !input && i + 1 < argv.length) input = argv[++i];
    else if (arg === '--output' && !output && i + 1 < argv.length) output = argv[++i];
    else if (arg === '--live' && !live) live = true;
    else throw new FleetInputError('Usage: node run.mjs --input known-fleet.csv [--live --output private-report.json]');
  }
  if (!input) throw new FleetInputError('Provide --input with local known-fleet CSV');
  if (live !== Boolean(output)) {
    throw new FleetInputError('--live requires --output; --output requires --live');
  }
  if (output && resolve(input) === resolve(output)) {
    throw new FleetInputError('Input and output must be different files');
  }
  return { input, output, live };
}

export async function main(argv, {
  read = readFile, write = writeFile, environment = process.env,
  review = reviewFleetDrift, print = console.log, error = console.error,
} = {}) {
  try {
    const { input, output, live } = parseArguments(argv);
    const inventory = parseInventoryCsv(await read(input, 'utf8'));
    if (!live) {
      print('DRY RUN: ' + inventory.length + ' known aircraft; no API calls or writes.');
      print('Live mode would make up to ' + (inventory.length * 2)
        + ' metered API requests, paced at Free-plan limits.');
      return 0;
    }
    const apiKey = environment.GRIZZLY_BULLS_API_KEY;
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      throw new FleetInputError('Set GRIZZLY_BULLS_API_KEY privately before --live');
    }
    const result = await review(inventory, { apiKey });
    // Private local file; no overwrite and no aircraft fields printed to logs.
    await write(output, JSON.stringify(result, null, 2) + '\n', {
      encoding: 'utf8', mode: 0o600, flag: 'wx',
    });
    print('Saved ' + result.rows.length + ' reviewed aircraft to ' + resolve(output)
      + '. Inspect identity conflicts manually; no fleet records were changed.');
    return 0;
  } catch (caught) {
    error(caught instanceof FleetInputError
      || caught instanceof FleetApiError || caught instanceof HistoryAuditError
      ? caught.message
      : 'Fleet drift review failed. Check local inventory and API status; no report was written.');
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
