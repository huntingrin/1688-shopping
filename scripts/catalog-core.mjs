import { z } from 'zod';

const text = z.string().trim().min(1);
const id = z.string().regex(/^\d+$/);
const url = text.url().refine(value => /^https?:\/\//.test(value));
export const requestSchema = z.object({
  keyword: text.optional(), image_url: url.optional(), image_path: text.optional(), product_url: url.optional(),
  limit: z.number().int().min(1).max(10).optional(),
  product_ids: z.array(id).min(1).max(10).optional(),
}).strict().refine(value => {
  const searches = ['keyword', 'image_url', 'image_path', 'product_url'].filter(key => value[key] !== undefined).length;
  return value.product_ids ? searches === 0 && value.limit === undefined : searches === 1;
});
const cents = value => value?.currency === 'CNY' && Number.isSafeInteger(value.amount) && value.amount >= 0 ? value.amount : null;
const int = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const string = value => typeof value === 'string' ? value : null;
const offer = value => `https://detail.1688.com/offer/${id.parse(String(value))}.html`;

export function payload(result) {
  if (result.isError) throw new Error('UPSTREAM_TOOL_ERROR');
  let value = result.structuredContent;
  if (!Number.isInteger(value?.status_code)) {
    value = undefined;
    for (const content of result.content ?? []) {
      if (content.type !== 'text') continue;
      const source = content.text.match(/```json\s*\n([\s\S]*?)\n```/)?.[1] ?? content.text;
      try {
        const parsed = JSON.parse(source);
        if (Number.isInteger(parsed?.status_code)) { value = parsed; break; }
      } catch { /* Ignore prose, never echo raw upstream data. */ }
    }
  }
  if (!Number.isInteger(value?.status_code)) throw new Error('INVALID_BUSINESS_PAYLOAD');
  if (value.status_code < 200 || value.status_code >= 300) throw new Error(`UPSTREAM_HTTP_${value.status_code}`);
  if (!value.body || typeof value.body !== 'object') throw new Error('INVALID_BUSINESS_PAYLOAD');
  return value.body;
}

function product(value) {
  const productId = id.parse(String(value?.id));
  return {
    id: productId, title: string(value.title), url: offer(productId),
    providerMoq: int(value.b2b_pricing?.moq),
    shippingBadge: typeof value.metadata?.freeShipping === 'boolean' || typeof value.metadata?.freeShipping === 'string'
      ? value.metadata.freeShipping : null,
    variants: (Array.isArray(value.variants) ? value.variants : []).map(variant => ({
      id: typeof variant.id === 'string' || Number.isSafeInteger(variant.id) ? String(variant.id) : null,
      title: string(variant.title), referenceUnitCents: cents(variant.price), providerStock: int(variant.stock),
    })),
    consumerPriceStatus: 'needs_web_verification', consumerUnitCents: null, landedTotalCents: null,
  };
}

// Injectable tool call for offline verification; no checkout or message methods.
export async function queryCatalog(input, call) {
  const request = requestSchema.parse(input);
  const discovery = await call('utp_discover', { host: 'https://ucp-b2b.com' });
  if (discovery.isError) throw new Error('DISCOVERY_FAILED');
  const session_id = discovery.structuredContent?.session_id;
  if (typeof session_id !== 'string' || !session_id) throw new Error('MISSING_SESSION');
  let output;
  if (request.product_ids) {
    const products = [];
    for (const product_id of new Set(request.product_ids)) {
      products.push(product(payload(await call('utp_catalog_product', { session_id, product_id })).product));
    }
    output = { products };
  } else {
    const body = payload(await call('utp_catalog_search', { ...request, limit: request.limit ?? 5, session_id }));
    if (!Array.isArray(body.products)) throw new Error('INVALID_PRODUCTS');
    const seen = new Set();
    const products = body.products.filter(p => p && /^\d+$/.test(String(p.id)) && !seen.has(String(p.id)) && seen.add(String(p.id)))
      .slice(0, request.limit ?? 5).map(p => ({
        id: String(p.id), title: string(p.title), url: offer(p.id),
        referenceMinCents: cents(p.price_range?.min), requiresDetail: true, consumerPriceStatus: 'needs_web_verification',
      }));
    output = { upstreamCount: body.products.length, products };
  }
  return { source: 'UTP catalog reference only', checkedAt: new Date().toISOString(), ...output };
}
