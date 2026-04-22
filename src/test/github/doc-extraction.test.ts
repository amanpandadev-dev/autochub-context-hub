import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDeprecatedMethodsFromMarkdown,
  extractReplacementHintsFromMarkdown,
} from '../../lib/github/doc-extraction';

test('extracts deprecated methods with migration context', () => {
  const markdown = `
# OpenAI Migration

\`openai.ChatCompletion.create()\` is deprecated in v4.
Use \`client.chat.completions.create()\` instead.

\`openai.Completion.create()\` was replaced by \`client.responses.create()\`.
`;

  const methods = extractDeprecatedMethodsFromMarkdown(markdown);
  assert.ok(methods.includes('openai.ChatCompletion.create()'));
  assert.ok(methods.includes('openai.Completion.create()'));
});

test('extracts replacement hints while avoiding noisy tokens', () => {
  const markdown = `
Deprecated in v1.2.3. See https://example.com/changelog for details.
Use \`client.responses.create()\` instead of \`openai.Completion.create()\`.
`;

  const hints = extractReplacementHintsFromMarkdown(markdown);
  assert.ok(hints.includes('client.responses.create()'));
  assert.ok(!hints.includes('v1.2.3'));
  assert.ok(!hints.some((hint) => hint.includes('http')));
});

test('reduces false positives from generic markdown code tokens', () => {
  const markdown = `
## Deprecated Fields

Deprecated values:
- \`v2\`
- \`HTTP_400\`
- \`RFC-1234\`
- \`legacyClient.complete()\`
`;

  const methods = extractDeprecatedMethodsFromMarkdown(markdown);
  assert.deepEqual(methods, ['legacyClient.complete()']);
});

