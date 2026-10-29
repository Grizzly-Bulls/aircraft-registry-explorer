import { DEMO_API_HANDOFF_URLS, type DemoApiHandoffMoment } from '../lib/demoApiHandoff';

const nextSteps = {
  home: {
    title: 'Building your own aircraft workflow?',
    detail: 'Try these examples without a key, then create a Free API key to make the same requests from your own server.',
    action: 'Get a Free API key',
  },
  lookup: {
    title: 'Use current FAA records in your application',
    detail: 'Your Free key can request this same current-record contract from your server. The demo uses a separate credential; it never gives yours to the browser.',
    action: 'Get a Free API key',
  },
  history: {
    title: 'Inspect observed history from your own service',
    detail: 'Use Free API requests to retrieve bounded observed versions and privacy-safe change events for N-numbers you already know.',
    action: 'Get a Free API key',
  },
  changes: {
    title: 'Integrate the observed change feed',
    detail: 'Query bounded privacy-safe registry changes with a Free key. Signed delivery to your endpoint is available on a paid plan.',
    action: 'Get a Free API key',
  },
} as const satisfies Record<DemoApiHandoffMoment, {
  title: string;
  detail: string;
  action: string;
}>;

export function DemoApiHandoff({ moment }: { moment: DemoApiHandoffMoment }) {
  const nextStep = nextSteps[moment];
  return (
    <aside className="demoApiHandoff" aria-label="Use the Aircraft API in your product">
      <div>
        <strong>{nextStep.title}</strong>
        <p>{nextStep.detail}</p>
      </div>
      <a className="button secondary" href={DEMO_API_HANDOFF_URLS[moment]}>
        {nextStep.action}
      </a>
    </aside>
  );
}
