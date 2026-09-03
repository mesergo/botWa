import crypto from 'crypto';

// Generates a per-table secret used to authenticate calls to the external
// lookup/query API when the table isn't marked public (api.enabled === false).
export const generateApiKey = () => `idk_${crypto.randomBytes(24).toString('hex')}`;

// Extracts a caller-supplied API key from a request, checking (in order) the
// x-api-key header, an apiKey query param, and an apiKey body field — mirrors
// the ways the API generator tab's snippets send it (curl -H, GET url, POST json).
export const extractRequestApiKey = (req) => {
  return req.headers['x-api-key'] || req.query?.apiKey || req.body?.apiKey || null;
};
