// Self-contained jest mock of react-native-reanimated (its own `mock` still loads the native
// worklets runtime, which does not exist in jest). Shared values are plain `{ value }` objects,
// animations resolve to their target value immediately, animated components are the RN ones.
// Any other named export resolves too (capitalised: a chainable layout-animation builder,
// otherwise a no-op), so new glass components need no mock change. Tests may still
// `jest.mock('react-native-reanimated', factory)` themselves.
const React = require('react');
const { Image, ScrollView, Text, View } = require('react-native');

const noop = () => undefined;
const first = (value) => value;

function chainable() {
  const builder = new Proxy(function builder() {}, {
    get: (_target, name) => (name === 'build' ? () => undefined : () => builder),
  });

  return builder;
}

function useSharedValue(initial) {
  return React.useRef({ value: initial }).current;
}

const Animated = {
  View,
  Text,
  ScrollView,
  Image,
  createAnimatedComponent: first,
};

const stubs = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue,
  useAnimatedStyle: (factory) => factory(),
  useAnimatedProps: (factory) => factory(),
  useDerivedValue: (factory) => ({ value: factory() }),
  useAnimatedReaction: noop,
  useAnimatedRef: () => React.useRef(null),
  useReducedMotion: () => false,
  useReducedMotionValue: () => ({ value: false }),
  withTiming: first,
  withSpring: first,
  withDelay: (_delay, value) => value,
  withRepeat: first,
  withSequence: (...values) => values[values.length - 1],
  cancelAnimation: noop,
  runOnJS: first,
  runOnUI: first,
  interpolate: (value, input, output) => output[input.indexOf(value)] ?? output[0],
  Easing: new Proxy({}, { get: () => first }),
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
};

module.exports = new Proxy(stubs, {
  get(target, name) {
    if (name in target || typeof name !== 'string') {
      return target[name];
    }

    return /^[A-Z]/.test(name) ? chainable() : noop;
  },
});
