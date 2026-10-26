import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import type { BlurViewProps } from 'expo-blur';

type BlurTargetRef = NonNullable<BlurViewProps['blurTarget']>;
type BlurTargetNode = NonNullable<BlurTargetRef['current']>;

interface BlurTargetState {
  readonly ref: BlurTargetRef | null;
  readonly register: (node: BlurTargetNode | null) => void;
}

const BlurTargetContext = createContext<BlurTargetState>({ ref: null, register: ignore });

/**
 * Android blurs only what sits inside a BlurTargetView. Put this provider at the screen root, wrap
 * the background (ambient field, scrolling content) in `GlassBlurBackground`, and render the panels
 * beside that background, never inside it. The target is held as state, so a panel's BlurView
 * mounts (or updates) only after the target view is attached. Other platforms ignore all of this.
 */
export function GlassBlurProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [node, setNode] = useState<BlurTargetNode | null>(null);
  const register = useCallback((next: BlurTargetNode | null) => {
    setNode(next);
  }, []);
  const value = useMemo(
    () => ({ ref: node === null ? null : { current: node }, register }),
    [node, register],
  );

  return <BlurTargetContext.Provider value={value}>{children}</BlurTargetContext.Provider>;
}

/** The layer panels blur on Android. Fills its parent; render it before the panels. */
export function GlassBlurBackground({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}): React.JSX.Element {
  const { register } = useContext(BlurTargetContext);

  return (
    <BlurTargetView ref={register} pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {children}
    </BlurTargetView>
  );
}

/** The attached blur target, or null outside a provider or before the target view is attached. */
export function useBlurTarget(): BlurTargetRef | null {
  return useContext(BlurTargetContext).ref;
}

function ignore(): void {
  // No provider: nothing to register.
}
