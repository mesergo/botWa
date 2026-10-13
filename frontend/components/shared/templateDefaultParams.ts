// Fixed (default) values for a WhatsApp template's BODY params ({{1}}, {{2}}...),
// configured per template in Dashboard Settings → הודעות תבנית and stored as
// `defaultBodyParams` on the template setting. Each entry is one of:
//   ''              – no default (filled in manually when sending)
//   '__agent_name'  – the name of the agent/user sending the template
//   '__field:<ref>' – a contact field (same refs as TemplateBodyParamsEditor)
//   any other text  – a fixed literal value
export const AGENT_NAME_TOKEN = '__agent_name';
export const FIELD_PREFIX = '__field:';

// Build the initial `params.body` array for a template being picked for sending.
// - `agentName` replaces the agent-name token.
// - `resolveField` (optional) resolves a contact-field ref to a literal value, for
//   single-contact sends (chat). When omitted, the `__field:<ref>` token is kept as-is
//   so broadcasts can resolve it per recipient on the backend.
export function applyDefaultBodyParams(
  count: number,
  defaults: string[] | undefined,
  agentName?: string | null,
  resolveField?: (ref: string) => string,
): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = defaults?.[i] || '';
    if (d === AGENT_NAME_TOKEN) return agentName || '';
    if (d.startsWith(FIELD_PREFIX) && resolveField) return resolveField(d.slice(FIELD_PREFIX.length));
    return d;
  });
}

// Count of {{n}} placeholders in a template's BODY component (0 if none).
export function countBodyParams(template: any): number {
  const body = Array.isArray(template?.components)
    ? template.components.find((c: any) => c.type === 'BODY')
    : null;
  return (body?.text?.match(/\{\{\d+\}\}/g) || []).length;
}
