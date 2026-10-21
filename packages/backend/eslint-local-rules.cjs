'use strict';

// Repository methods that read or write household data and must receive a HouseholdScope.
// (`listByUser` is user-scoped by design: a caller's own rows, still limited by RLS.)
const SCOPED_METHODS = new Set([
  'findById',
  'list',
  'listActive',
  'listByPlan',
  'listByItem',
  'listByConnection',
  'listByHousehold',
  'read',
  'patch',
  'remove',
  'update',
  'archive',
  'set',
  'bulkSet',
  'findByTransaction',
  'mark',
  'unmark',
  'upsertAll',
  'updateConsent',
  'markActive',
  'markDisconnected',
  'listOwned',
  'createManual',
  'findOwnedAccount',
  'findOwnedById',
]);

const REPOSITORY_NAME = /[Rr]epository$|[Rr]epo$/;
const SCOPE_NAME = /scope/i;

/** `planRepo`, `this.planRepo`, `deps.planRepo` -> 'planRepo'; anything else -> null. */
function receiverName(node) {
  if (node.type === 'Identifier') {
    return node.name;
  }
  if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
    return node.property.name;
  }

  return null;
}

function isScopeArg(arg) {
  if (arg.type === 'Identifier') {
    return SCOPE_NAME.test(arg.name);
  }
  if (arg.type === 'MemberExpression' && !arg.computed && arg.property.type === 'Identifier') {
    return SCOPE_NAME.test(arg.property.name);
  }
  if (arg.type === 'ObjectExpression') {
    return arg.properties.some(
      (p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'householdId',
    );
  }

  return false;
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
        schema: [
          {
            type: 'object',
            properties: {
              // Receiver names (regex sources) of repositories that hold no household data
              // (users, sessions, FX rates ...). Their methods are exempt.
              unscopedRepositories: { type: 'array', items: { type: 'string' } },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          missingScope:
            'Repository method "{{method}}" called without a HouseholdScope argument. Pass `scope: HouseholdScope` to prevent cross-tenant data leaks.',
        },
      },
      create(context) {
        const options = context.options[0] ?? {};
        const unscoped = (options.unscopedRepositories ?? []).map((source) => new RegExp(source));

        return {
          CallExpression(node) {
            if (node.callee.type !== 'MemberExpression' || node.callee.computed) return;
            const prop = node.callee.property;
            if (prop.type !== 'Identifier' || !SCOPED_METHODS.has(prop.name)) return;
            const name = receiverName(node.callee.object);
            if (name === null || !REPOSITORY_NAME.test(name)) return;
            if (unscoped.some((re) => re.test(name))) return;
            if (node.arguments.some(isScopeArg)) return;
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
