'use strict';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow raw hex colour literals outside tokens.ts and themes.ts',
      recommended: true,
    },
    schema: [],
    messages: {
      noHex: 'Raw hex colour "{{ value }}" is not allowed. Import from @power-budget/design-tokens instead.',
    },
  },
  create(context) {
    const filename = context.getFilename();
    // Allow hex in the canonical token files and snapshots
    if (
      filename.includes('tokens.ts') ||
      filename.includes('themes.ts') ||
      filename.includes('__snapshots__')
    ) {
      return {};
    }

    const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

    return {
      Literal(node) {
        if (typeof node.value === 'string' && HEX_RE.test(node.value)) {
          context.report({
            node,
            messageId: 'noHex',
            data: { value: node.value },
          });
        }
      },
    };
  },
};
