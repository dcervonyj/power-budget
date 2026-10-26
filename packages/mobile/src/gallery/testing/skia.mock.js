// jest mock of @shopify/react-native-skia: no CanvasKit in jest, so the canvas and every Skia node
// render as plain Views (children kept), and hooks / helpers are no-ops. Any named export
// resolves, so new glass components need no mock change.
const React = require('react');
const { View } = require('react-native');

function Passthrough(props) {
  return React.createElement(View, { testID: props.testID }, props.children);
}

const noop = () => undefined;
const stubs = {
  __esModule: true,
  Canvas: Passthrough,
  Skia: new Proxy({}, { get: () => noop }),
  useCanvasRef: () => ({ current: null }),
  useCanvasSize: () => ({ ref: { current: null }, size: { width: 0, height: 0 } }),
};

module.exports = new Proxy(stubs, {
  get(target, name) {
    if (name in target || typeof name !== 'string') {
      return target[name];
    }

    return /^[A-Z]/.test(name) ? Passthrough : noop;
  },
});
