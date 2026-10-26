import React, { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { IntlProvider } from 'react-intl';
import { FontGate, ThemeProvider, makeStyles, useTheme } from '../presentation/theme/index.js';
import type { ResolvedThemeName } from '../presentation/theme/index.js';
import type { GalleryParams } from './params.js';
import type { GalleryEntry } from './registry.js';

const THEMES: readonly ResolvedThemeName[] = ['dark', 'light'];

export interface GalleryAppProps {
  readonly params: GalleryParams;
  readonly entries: readonly GalleryEntry[];
  readonly onNavigate: (params: GalleryParams) => void;
}

/** Providers plus the selected entry (or the index). The theme comes from the launch params. */
export function GalleryApp({ params, entries, onNavigate }: GalleryAppProps): React.JSX.Element {
  return (
    <ThemeProvider>
      <FontGate>
        <IntlProvider locale="en" defaultLocale="en" onError={ignoreMissingTranslation}>
          <ForcedTheme theme={params.theme}>
            <GalleryBody params={params} entries={entries} onNavigate={onNavigate} />
          </ForcedTheme>
        </IntlProvider>
      </FontGate>
    </ThemeProvider>
  );
}

function ForcedTheme({
  theme,
  children,
}: {
  readonly theme: ResolvedThemeName;
  readonly children: React.ReactNode;
}): React.JSX.Element | null {
  const { resolvedName, setPreference } = useTheme();

  useEffect(() => {
    setPreference(theme);
  }, [theme, setPreference]);

  // Nothing renders until the requested theme is active, so a screenshot never sees the other one.
  return resolvedName === theme ? <>{children}</> : null;
}

const useStyles = makeStyles((glass) => ({
  page: { flex: 1, backgroundColor: glass.colors.base },
  content: { padding: glass.space['3xl'] },
  title: {
    color: glass.colors.fg,
    fontFamily: 'Geist_600SemiBold',
    fontSize: glass.type.title.mobile,
  },
  row: {
    flexDirection: 'row',
    gap: glass.space.md,
    marginTop: glass.space.md,
    alignItems: 'center',
  },
  entry: {
    color: glass.colors.fg,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.body.mobile,
  },
  link: {
    color: glass.colors.accent,
    fontFamily: 'Geist_500Medium',
    fontSize: glass.type.body.mobile,
  },
}));

function GalleryBody({ params, entries, onNavigate }: GalleryAppProps): React.JSX.Element {
  const styles = useStyles();
  const selected = entries.find((entry) => entry.id === params.entry);

  return (
    <ScrollView
      testID="gallery-main"
      nativeID="gallery-main"
      style={styles.page}
      contentContainerStyle={styles.content}
    >
      {selected ? (
        <selected.Component />
      ) : (
        <View testID="gallery-index">
          <Text accessibilityRole="header" style={styles.title}>
            Gallery
          </Text>
          {entries.map((entry) => (
            <View key={entry.id} style={styles.row}>
              <Text style={styles.entry}>{entry.id}</Text>
              {THEMES.map((theme) => (
                <Pressable
                  key={theme}
                  accessibilityRole="link"
                  onPress={() => onNavigate({ entry: entry.id, theme })}
                >
                  <Text style={styles.link}>{theme}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function ignoreMissingTranslation(): void {
  // Gallery fixtures render with default messages only.
}
