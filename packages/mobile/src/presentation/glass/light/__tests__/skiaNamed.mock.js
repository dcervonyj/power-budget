// Per-suite variant of the jest Skia mock: every Skia node renders a View whose testID is
// `skia-<Name>`, so tests can count what a component draws (the shared mock drops the names).
const React = require('react');
const { View } = require('react-native');

function named(name) {
  function Node(props) {
    return React.createElement(View, { testID: `skia-${name}` }, props.children);
  }
  Node.displayName = name;

  return Node;
}

const noop = () => undefined;
const cache = {};

module.exports = new Proxy(
  { __esModule: true, Skia: new Proxy({}, { get: () => noop }) },
  {
    get(target, name) {
      if (name in target || typeof name !== 'string') {
        return target[name];
      }
      if (!/^[A-Z]/.test(name)) {
        return noop;
      }
      cache[name] = cache[name] ?? named(name);

      return cache[name];
    },
  },
);
