// WhatsApp rejects a template send (error 132000, "Number of parameters does
// not match the expected number of params") if the number of body variables
// filled in doesn't match the number of {{n}} placeholders in the template.
// The backend silently drops empty values before sending, so this must be
// checked client-side before the send button is enabled — not left to fail
// at the WhatsApp API with a confusing error.
export function getMissingTemplateVars(template: any, params: Record<string, any>): number[] {
  const bodyComp = Array.isArray(template?.components)
    ? template.components.find((c: any) => c.type === 'BODY')
    : null;
  const bodyText: string = bodyComp?.text || template?.body || '';
  const varNumbers = new Set<number>();
  const re = /\{\{(\d+)\}\}/g;
  let m;
  while ((m = re.exec(bodyText))) varNumbers.add(parseInt(m[1], 10));
  const bodyValues: any[] = params?.body || [];
  return [...varNumbers].filter(n => !String(bodyValues[n - 1] ?? '').trim()).sort((a, b) => a - b);
}
