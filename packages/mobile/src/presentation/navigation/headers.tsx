import React from 'react';
import type { BottomTabHeaderProps } from '@react-navigation/bottom-tabs';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountMenu } from './AccountMenu.js';
import { GlassHeader } from './GlassHeader.js';
import { useShellLabels } from './useShellLabels.js';

/** Tab screens: tinted header with the account menu on the right. */
export function TabGlassHeader({ options, route }: BottomTabHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const labels = useShellLabels();

  return (
    <GlassHeader
      title={options.title ?? route.name}
      backLabel={labels.back()}
      right={<AccountMenu />}
      topInset={insets.top}
    />
  );
}

/** Stack screens: tinted header with a back button when there is somewhere to go back to. */
export function StackGlassHeader({
  options,
  route,
  navigation,
  back,
}: NativeStackHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const labels = useShellLabels();

  function goBack(): void {
    navigation.goBack();
  }

  return (
    <GlassHeader
      title={options.title ?? route.name}
      backLabel={labels.back()}
      onBack={back === undefined ? undefined : goBack}
      topInset={insets.top}
    />
  );
}

/** Navigator `header` options are called as functions, so these wrappers mount the hook users. */
export function renderTabHeader(props: BottomTabHeaderProps): React.JSX.Element {
  return <TabGlassHeader {...props} />;
}

export function renderStackHeader(props: NativeStackHeaderProps): React.JSX.Element {
  return <StackGlassHeader {...props} />;
}
