import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useGlass } from '../theme/index.js';
import { LABEL_FONT } from '../glass/controls/fonts.js';

/** Glass styling for a native stack header (the auth stack): base colours, ink title, no hairline. */
export function useNativeHeaderOptions(): NativeStackNavigationOptions {
  const glass = useGlass();

  return {
    headerStyle: { backgroundColor: glass.colors.base },
    headerTintColor: glass.colors.fg,
    headerTitleStyle: { color: glass.colors.fg, fontFamily: LABEL_FONT },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: glass.colors.base },
  };
}
