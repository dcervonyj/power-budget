// jest mock of expo-blur: BlurView is a plain View (no native blur in jest).
const React = require('react');
const { View } = require('react-native');

function BlurView(props) {
  return React.createElement(View, props);
}

module.exports = { __esModule: true, BlurView };
