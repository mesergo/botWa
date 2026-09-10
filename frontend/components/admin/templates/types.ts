// Shared TypeScript types for the admin-panel WhatsApp template CRUD (add/edit/duplicate/delete).
// Mirrors Meta/360dialog's template "components" schema (HEADER/BODY/FOOTER/BUTTONS).

export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export type TemplateHeaderType = 'none' | 'text' | 'image' | 'video' | 'document';

export type TemplateButtonType = 'quick_reply' | 'url' | 'phone_number';

export interface TemplateButtonForm {
  type: TemplateButtonType;
  text: string;
  url?: string;
  phone_number?: string;
}

export interface TemplateBodyVariable {
  index: number;
  example: string;
}

export interface TemplateComponentsFormState {
  headerType: TemplateHeaderType;
  headerText: string;
  headerMediaUrl: string;
  bodyText: string;
  bodyVariables: TemplateBodyVariable[];
  footerText: string;
  buttons: TemplateButtonForm[];
}

export type TemplateModalMode = 'add' | 'edit' | 'duplicate';

export interface TemplateFormState {
  name: string;
  category: TemplateCategory;
  language: string;
  components: TemplateComponentsFormState;
}

export const CURATED_LANGUAGES: { code: string; label: string }[] = [
  { code: 'he', label: 'עברית' },
  { code: 'en', label: 'English' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'ar', label: 'العربية' },
  { code: 'ru', label: 'Русский' },
];

export const emptyTemplateComponentsForm = (): TemplateComponentsFormState => ({
  headerType: 'none',
  headerText: '',
  headerMediaUrl: '',
  bodyText: '',
  bodyVariables: [],
  footerText: '',
  buttons: [],
});

export const emptyTemplateForm = (): TemplateFormState => ({
  name: '',
  category: 'MARKETING',
  language: 'he',
  components: emptyTemplateComponentsForm(),
});

// Detects `{{1}}`, `{{2}}`, ... occurrences in the body text (order of first appearance),
// returning the sorted, de-duplicated list of variable indexes found.
export const extractBodyVariableIndexes = (bodyText: string): number[] => {
  const found = new Set<number>();
  const regex = /\{\{\s*(\d+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(bodyText)) !== null) {
    found.add(parseInt(match[1], 10));
  }
  return Array.from(found).sort((a, b) => a - b);
};

// Builds the Meta/360dialog-style `components` array from the form state, ready to send
// to the add_template / edit_template external API.
export const buildComponentsPayload = (components: TemplateComponentsFormState): any[] => {
  const result: any[] = [];

  if (components.headerType === 'text' && components.headerText.trim()) {
    result.push({ type: 'HEADER', format: 'TEXT', text: components.headerText.trim() });
  } else if (['image', 'video', 'document'].includes(components.headerType) && components.headerMediaUrl.trim()) {
    const format = components.headerType.toUpperCase();
    const handleKey = components.headerType === 'image' ? 'image' : components.headerType === 'video' ? 'video' : 'document';
    result.push({
      type: 'HEADER',
      format,
      example: { header_handle: [components.headerMediaUrl.trim()] },
      [handleKey]: { link: components.headerMediaUrl.trim() }
    });
  }

  if (components.bodyText.trim()) {
    const body: any = { type: 'BODY', text: components.bodyText.trim() };
    if (components.bodyVariables.length > 0) {
      body.example = { body_text: [components.bodyVariables.map(v => v.example || '')] };
    }
    result.push(body);
  }

  if (components.footerText.trim()) {
    result.push({ type: 'FOOTER', text: components.footerText.trim() });
  }

  if (components.buttons.length > 0) {
    result.push({
      type: 'BUTTONS',
      buttons: components.buttons.map(b => {
        if (b.type === 'url') return { type: 'URL', text: b.text, url: b.url || '' };
        if (b.type === 'phone_number') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone_number || '' };
        return { type: 'QUICK_REPLY', text: b.text };
      })
    });
  }

  return result;
};

// Reverse-maps an existing template's `components` array (as returned by the read API)
// into the form state, used for edit/duplicate prefill.
export const componentsToFormState = (rawComponents: any[]): TemplateComponentsFormState => {
  const form = emptyTemplateComponentsForm();
  if (!Array.isArray(rawComponents)) return form;

  const header = rawComponents.find((c: any) => c.type === 'HEADER');
  if (header) {
    if (header.format === 'TEXT') {
      form.headerType = 'text';
      form.headerText = header.text || '';
    } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(header.format)) {
      form.headerType = header.format.toLowerCase() as TemplateHeaderType;
      form.headerMediaUrl = header.example?.header_handle?.[0] || header[form.headerType]?.link || '';
    }
  }

  const body = rawComponents.find((c: any) => c.type === 'BODY');
  if (body) {
    form.bodyText = body.text || '';
    const indexes = extractBodyVariableIndexes(form.bodyText);
    const examples: string[] = body.example?.body_text?.[0] || [];
    form.bodyVariables = indexes.map((idx, i) => ({ index: idx, example: examples[i] || '' }));
  }

  const footer = rawComponents.find((c: any) => c.type === 'FOOTER');
  if (footer) form.footerText = footer.text || '';

  const buttonsComponent = rawComponents.find((c: any) => c.type === 'BUTTONS');
  if (buttonsComponent && Array.isArray(buttonsComponent.buttons)) {
    form.buttons = buttonsComponent.buttons.map((b: any) => {
      if (b.type === 'URL') return { type: 'url', text: b.text || '', url: b.url || '' };
      if (b.type === 'PHONE_NUMBER') return { type: 'phone_number', text: b.text || '', phone_number: b.phone_number || '' };
      return { type: 'quick_reply', text: b.text || '' };
    });
  }

  return form;
};
