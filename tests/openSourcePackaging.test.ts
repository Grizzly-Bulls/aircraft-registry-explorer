import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath: string): string =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const readme = read('README.md');
const contributing = read('CONTRIBUTING.md');
const screenshotGuide = read('docs/screenshots/README.md');
const githubMetadata = read('docs/github-metadata.md');
const bugTemplate = read('.github/ISSUE_TEMPLATE/bug_report.yml');
const integrationTemplate = read('.github/ISSUE_TEMPLATE/integration_question.yml');
const issueConfig = read('.github/ISSUE_TEMPLATE/config.yml');
const prTemplate = read('.github/pull_request_template.md');
const packageJson = JSON.parse(read('package.json')) as {
  description?: string;
  repository?: { url?: string };
  homepage?: string;
};

test('README gives a direct five-minute clone-to-run path', () => {
  assert.match(readme, /## Five-minute quickstart/);
  assert.match(readme, /git clone https:\/\/github\.com\/Grizzly-Bulls\/aircraft-registry-explorer\.git/);
  assert.match(readme, /pnpm install/);
  assert.match(readme, /cp \.env\.example \.env\.local/);
  assert.match(readme, /GRIZZLY_BULLS_API_KEY=your_key_here/);
  assert.match(readme, /pnpm dev/);
  assert.match(readme, /\/lookup/);
  assert.match(readme, /\/discover/);
  assert.match(readme, /\/history/);
});

test('README examples cover the implemented public API workflows', () => {
  assert.match(readme, /https:\/\/api\.grizzlybulls\.com\/v1\/aircraft\/N12345/);
  assert.match(
    readme,
    /aircraft\?manufacturer=CESSNA&model=172N&state=FL&limit=25/,
  );
  assert.match(
    readme,
    /N12345\/history\?versionsLimit=10&versionsOffset=0&eventsLimit=10&eventsOffset=0/,
  );
  assert.match(readme, /aircraft\/icao24\/A12239/);
  assert.match(readme, /aircraft\/n-number\/N172SP\/status/);
  assert.match(readme, /aircraft\/changes\?since=/);
  assert.match(readme, /Authorization: Bearer \$GRIZZLY_BULLS_API_KEY/);
  assert.match(readme, /process\.env\.GRIZZLY_BULLS_API_KEY/);
  assert.match(readme, /OpenAPI 3\.1/);
});

test('README explains the server-only architecture and product limits', () => {
  assert.match(readme, /The browser never receives the Aircraft API key/);
  assert.match(readme, /Browser CORS is intentionally not enabled/);
  assert.match(readme, /no aircraft database/i);
  assert.match(readme, /does \*\*not\*\* provide owner-name reverse search/i);
  assert.match(readme, /ICAO24 ranges/);
  assert.match(readme, /not a global aviation registry, flight tracker, legal ownership ledger, or unrestricted public registry-search service/);
  assert.match(readme, /Try the live demo/);
  assert.match(readme, /aircraft-demo\.grizzlybulls\.com/);
});

test('packaging includes focused issue and pull request workflows', () => {
  assert.match(bugTemplate, /Bug report/);
  assert.match(bugTemplate, /Do not include API keys/);
  assert.match(integrationTemplate, /Integration question/);
  assert.match(integrationTemplate, /Discovery cursor pagination/);
  assert.match(integrationTemplate, /Observed history/);
  assert.match(issueConfig, /https:\/\/grizzlybulls\.com\/aircraft-api/);
  assert.match(issueConfig, /https:\/\/api\.grizzlybulls\.com\/v1\/openapi\.json/);

  assert.match(prTemplate, /## Boundary review/);
  assert.match(prTemplate, /pnpm check/);
  assert.match(prTemplate, /git status --short/);
  assert.match(prTemplate, /docs\/screenshots\/README\.md/);
});

test('contribution guide keeps secrets, privacy, and unsupported scope bounded', () => {
  assert.match(contributing, /AGENTS\.md/);
  assert.match(contributing, /`GRIZZLY_BULLS_API_KEY` stays server-only/);
  assert.match(contributing, /owner-name or registrant-name reverse search/);
  assert.match(contributing, /ICAO24 range or fuzzy lookup/);
  assert.match(contributing, /must not become a way to recover personal information suppressed by current FAA public data/);
  assert.match(contributing, /Do not fabricate result data or generate imitation screenshots/);
});

test('README embeds real committed screenshots for the reviewed three-image product tour', () => {
  assert.match(readme, /## Product tour/);
  for (const filename of ['lookup.png', 'discover.png', 'history.png']) {
    assert.match(readme, new RegExp('docs/screenshots/' + filename.replace('.', '\\.')));
    const screenshotPath = path.join(root, 'docs/screenshots', filename);
    assert.equal(fs.existsSync(screenshotPath), true, `${filename} must be committed before merge`);
    assert.ok(fs.statSync(screenshotPath).size >= 10_000, `${filename} must be a real non-trivial image`);
  }
});

test('screenshot guide requires real app captures and privacy review', () => {
  for (const filename of ['lookup.png', 'discover.png', 'history.png']) {
    assert.match(screenshotGuide, new RegExp(filename.replace('.', '\\.')));
  }

  assert.match(screenshotGuide, /real Aircraft Registry Explorer application/);
  assert.match(screenshotGuide, /aircraft-demo\.grizzlybulls\.com/);
  assert.match(screenshotGuide, /Do not create mock aircraft records, generated imitation UI/);
  assert.match(screenshotGuide, /confirm no API key/);
  assert.match(screenshotGuide, /historical registrant names, addresses, aliases, and postal information are not displayed/);
});

test('repository metadata stays focused on the implemented developer product', () => {
  assert.match(githubMetadata, /Open-source Next\.js reference app/);
  for (const topic of [
    'aircraft',
    'aviation',
    'faa',
    'aircraft-registry',
    'api',
    'openapi',
    'nextjs',
    'typescript',
    'developer-tools',
    'open-source',
  ]) {
    assert.match(githubMetadata, new RegExp('^' + topic + '$', 'm'));
  }
  assert.match(githubMetadata, /Do not add topics that imply unsupported capabilities/);
  assert.match(githubMetadata, /https:\/\/aircraft-demo\.grizzlybulls\.com/);

  assert.match(packageJson.description ?? '', /Grizzly Bulls Aircraft Intelligence API/);
  assert.equal(
    packageJson.repository?.url,
    'https://github.com/Grizzly-Bulls/aircraft-registry-explorer.git',
  );
  assert.equal(packageJson.homepage, 'https://grizzlybulls.com/aircraft-api');
});

test('public packaging copy avoids internal phase language', () => {
  for (const [name, source] of [
    ['README.md', readme],
    ['CONTRIBUTING.md', contributing],
    ['docs/screenshots/README.md', screenshotGuide],
    ['docs/github-metadata.md', githubMetadata],
  ] as const) {
    assert.doesNotMatch(source, /\bAIR\d+[A-Z]*\b/, name);
  }
});
