/**
 * apex/no-ui-literals: UI text must come from the i18n catalogue (src/ui/i18n), not from literals in
 * components, so every visible word can be translated (Sprint 6.2). Flags text that contains a word
 * (two or more letters) in:
 *   - JSX text:                       <p>Hello</p>
 *   - string children:                <p>{'Hello'}</p>, <p>{`Year ${n}`}</p>
 *   - text-bearing JSX attributes:    aria-label="Close", title={`Speed ${s}`}
 *   - text-bearing object properties: { label: 'Real growth' }
 * Symbols, numbers and units without words (✕, ×, ₹, %) are allowed.
 */
const WORD = /\p{L}{2,}/u;

export const TEXT_PROPS = new Set([
  'aria-label',
  'aria-description',
  'aria-valuetext',
  'aria-roledescription',
  'title',
  'placeholder',
  'alt',
  'label',
  'description',
  'hint',
  'note',
  'heading',
  'subtitle',
  'text',
  'summary',
  'caption',
  'legend',
  'emptyText',
  'confirmLabel',
]);

const hasWord = (value) => typeof value === 'string' && WORD.test(value);
const templateHasWord = (node) => node.quasis.some((q) => hasWord(q.value.cooked ?? q.value.raw));

function textOf(node) {
  if (!node) return null;
  if (node.type === 'Literal' && hasWord(node.value)) return node.value;
  if (node.type === 'TemplateLiteral' && templateHasWord(node)) return node.quasis.map((q) => q.value.raw).join('…');
  if (node.type === 'ConditionalExpression') return textOf(node.consequent) ?? textOf(node.alternate);
  if (node.type === 'LogicalExpression') return textOf(node.right);
  return null;
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow hard-coded UI text; use t() from src/ui/i18n.' },
    schema: [],
    messages: { literal: 'Hard-coded UI text "{{text}}": move it to src/ui/i18n/en and use t().' },
  },
  create(context) {
    const report = (node, text) =>
      context.report({ node, messageId: 'literal', data: { text: String(text).trim().slice(0, 40) } });
    return {
      JSXText(node) {
        if (hasWord(node.value)) report(node, node.value);
      },
      JSXExpressionContainer(node) {
        if (node.parent.type !== 'JSXElement' && node.parent.type !== 'JSXFragment') return;
        const text = textOf(node.expression);
        if (text) report(node, text);
      },
      JSXAttribute(node) {
        const name = node.name.type === 'JSXNamespacedName' ? node.name.name.name : node.name.name;
        if (!TEXT_PROPS.has(name) || !node.value) return;
        const text = node.value.type === 'Literal' ? textOf(node.value) : textOf(node.value.expression);
        if (text) report(node, text);
      },
      Property(node) {
        const key = node.key.type === 'Identifier' ? node.key.name : node.key.value;
        if (!TEXT_PROPS.has(key)) return;
        const text = textOf(node.value);
        if (text) report(node, text);
      },
    };
  },
};
