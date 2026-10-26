import React, { createContext, useContext, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import type { BlurViewProps } from 'expo-blur';

type BlurTargetRef = NonNullable<BlurViewProps['blurTarget']>;

const BlurTargetContext = createContext<BlurTargetRef | null>(null);

/**
 * Android blurs only what sits inside a BlurTargetView, so a screen wraps the content that panels
 * blur (the ambient field and whatever scrolls under them) in this. Other platforms render a plain
 * View; the context is only read on Android.
 */
export function GlassBlurTarget({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}): React.JSX.Element {
  const target = useRef<NonNullable<BlurTargetRef['current']>>(null);

  return (
    <BlurTargetContext.Provider value={target}>
      <BlurTargetView ref={target} style={style}>
        {children}
      </BlurTargetView>
    </BlurTargetContext.Provider>
  );
}

/** The enclosing blur target, or null when the panel is not inside a `GlassBlurTarget`. */
export function useBlurTarget(): BlurTargetRef | null {
  return useContext(BlurTargetContext);
}
