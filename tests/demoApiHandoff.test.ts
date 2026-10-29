import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { DEMO_API_HANDOFF_URLS } from '../src/lib/demoApiHandoff';

const read = (path: string): string => fs.readFileSync(path, 'utf8');
const component = read('src/components/DemoApiHandoff.tsx');
const home = read('app/page.tsx');
const lookup = read('app/lookup/page.tsx');
const history = read('app/history/page.tsx');
const changes = read('app/changes/page.tsx');
const css = read('app/globals.css');

test('every outbound demo handoff has a fixed, privacy-safe acquisition source', () => {
  assert.deepEqual(Object.keys(DEMO_API_HANDOFF_URLS).sort(), ['changes', 'history', 'home', 'lookup']);
  for (const [moment, value] of Object.entries(DEMO_API_HANDOFF_URLS)) {
    const url = new URL(value);
    assert.equal(url.origin, 'https://grizzlybulls.com');
    assert.equal(url.pathname, '/aircraft-api');
    assert.equal(url.hash, '#quickstart-heading');
    assert.deepEqual([...url.searchParams.keys()].sort(), [
      'utm_campaign',
      'utm_content',
      'utm_medium',
      'utm_source',
    ]);
    assert.equal(url.searchParams.get('utm_source'), 'aircraft_demo');
    assert.equal(url.searchParams.get('utm_medium'), 'referral');
    assert.equal(url.searchParams.get('utm_campaign'), 'demo_first_value');
    assert.equal(url.searchParams.get('utm_content'), moment);
    assert.doesNotMatch(value, /N\d|api_key|GRIZZLY_BULLS_API_KEY|email|userId|nNumber|serialNumber|ownerName/i);
  }
});

test('public demo links to existing Free activation rather than creating a local account or exposing credentials', () => {
  assert.match(component, /href=\{DEMO_API_HANDOFF_URLS\[moment\]\}/);
  assert.match(component, /Get a Free API key/);
  assert.match(component, /Signed delivery to your endpoint is available on a paid plan/);
  assert.match(component, /<aside className="demoApiHandoff" aria-label=/);
  assert.doesNotMatch(component, /['"]use client['"]|fetch\(|Authorization|localStorage|sessionStorage|N-number:/);
  assert.match(css, /\.demoApiHandoff/);
  assert.match(css, /@media \(max-width: 620px\)/);
});

test('home offers a first-value path while successful real API samples show contextual next steps', () => {
  assert.match(home, /<DemoApiHandoff moment="home" \/>/);
  assert.match(lookup, /\{record \? \([\s\S]*?<DemoApiHandoff moment="lookup" \/>/);
  assert.match(history, /\{history && nNumber \? <DemoApiHandoff moment="history" \/> : null\}/);
  assert.match(changes, /\{changes \? <DemoApiHandoff moment="changes" \/> : null\}/);
  for (const page of [home, lookup, history, changes]) {
    assert.doesNotMatch(page, /NEXT_PUBLIC_.*KEY|window\.location.*nNumber/);
  }
});
