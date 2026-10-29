/**
 * Fixed outbound handoff from the public hosted demonstration to Grizzly Bulls.
 * Never include N-numbers, customer data, account ids, or API credentials in
 * these URLs. This records only a broad demo entry point in normal page analytics.
 */
export const DEMO_API_HANDOFF_URLS = Object.freeze({
  home: 'https://grizzlybulls.com/aircraft-api?utm_source=aircraft_demo&utm_medium=referral&utm_campaign=demo_first_value&utm_content=home#quickstart-heading',
  lookup: 'https://grizzlybulls.com/aircraft-api?utm_source=aircraft_demo&utm_medium=referral&utm_campaign=demo_first_value&utm_content=lookup#quickstart-heading',
  history: 'https://grizzlybulls.com/aircraft-api?utm_source=aircraft_demo&utm_medium=referral&utm_campaign=demo_first_value&utm_content=history#quickstart-heading',
  changes: 'https://grizzlybulls.com/aircraft-api?utm_source=aircraft_demo&utm_medium=referral&utm_campaign=demo_first_value&utm_content=changes#quickstart-heading',
} as const);

export type DemoApiHandoffMoment = keyof typeof DEMO_API_HANDOFF_URLS;
