'use strict';

const SCOPED_METHODS = new Set([
  'findById',
  'list',
  'listActive',
  'listByUser',
  'listByPlan',
  'listByItem',
  'read',
]);

function hasHouseholdScopeArg(args) {
  return args.some((arg) => {
    if (arg.type === 'Identifier' && /scope/i.test(arg.name)) return true;
    if (arg.type === 'ObjectExpression') {
      return arg.properties.some(
        (p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'householdId',
      );
    }
    return false;
  });
}

module.exports = {
  rules: {
    'no-repo-without-scope': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Repository query methods must receive a HouseholdScope argument',
          recommended: true,
        },
        schema: [],
        messages: {
          missingScope:
            'Repository method "{{method}}" called without a HouseholdScope argument. Pass `scope: HouseholdScope` to prevent cross-tenant data leaks.',
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            if (node.callee.type !== 'MemberExpression') return;
            const obj = node.callee.object;
            const prop = node.callee.property;
            if (obj.type !== 'Identifier') return;
            if (!/[Rr]epository$|[Rr]epo$/.test(obj.name)) return;
            if (prop.type !== 'Identifier') return;
            if (!SCOPED_METHODS.has(prop.name)) return;
            if (hasHouseholdScopeArg(node.arguments)) return;
            context.report({
              node,
              messageId: 'missingScope',
              data: { method: prop.name },
            });
          },
        };
      },
    },
  },
};
