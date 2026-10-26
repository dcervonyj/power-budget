import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Canvas, Circle } from '@shopify/react-native-skia';

function Glass(): React.JSX.Element {
  const progress = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ opacity: withTiming(progress.value + 1) }));

  return (
    <BlurView intensity={28} testID="blur">
      <Animated.View style={style} testID="animated">
        <Canvas testID="canvas">
          <Circle cx={1} cy={1} r={1} />
        </Canvas>
        <Text>glass</Text>
      </Animated.View>
    </BlurView>
  );
}

describe('native module mocks', () => {
  it('lets a glass-style component render under jest-expo', async () => {
    await render(<Glass />);

    expect(screen.getByTestId('blur')).toBeTruthy();
    expect(screen.getByTestId('animated').props.style).toEqual({ opacity: 1 });
    expect(screen.getByTestId('canvas')).toBeTruthy();
    expect(screen.getByText('glass')).toBeTruthy();
  });
});
