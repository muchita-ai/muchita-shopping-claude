export const TOOLS = [
  {
    name: 'check_price',
    annotations: { title: 'Start a price check', readOnlyHint: false, openWorldHint: true, destructiveHint: false },
    description: 'Start a Muchita Shopping hunt in the shopper\'s own Chrome on this computer: it finds and verifies offers for one exact product at stores in the shopper\'s shopping country and currency. Give product (name and variant) or url (a product page the shopper chose). Returns as soon as the hunt is running (status hunting); then call get_price_check for the result, which takes 1-3 minutes. If Muchita is not installed, returns an install link instead.',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Exact product name and variant, for example "AirPods Pro 3" or "Sony WH-1000XM5 black". Preferred when the shopper names a product.' },
        url: { type: 'string', description: 'Public HTTPS product page the shopper gave, including variant parameters. Use instead of product.' },
        tips: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'Two or three short, concrete smart-shopping tips for this exact product (for example which model number or case to confirm). Shown to the shopper while the hunt runs. Never invent prices, dates or promotions.' },
        market: { type: 'string', description: 'Optional two-letter country the shopper buys in (for example DE). Only offers selling to that country are compared. Omit to use the shopping country set in Muchita.' },
      },
    },
  },
  {
    name: 'get_price_check',
    annotations: { title: 'Get the price check result', readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    description: 'Wait for the result of a Muchita hunt started by check_price (waits up to wait_seconds, default 170).',
    inputSchema: {
      type: 'object',
      properties: { job_id: { type: 'string' }, wait_seconds: { type: 'number', description: `Max 170.` } },
      required: ['job_id'],
    },
  },
];
