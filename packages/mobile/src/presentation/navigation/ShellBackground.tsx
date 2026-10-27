import React from 'react';
import { View } from 'react-native';
import { makeStyles } from '../theme/index.js';
import { AmbientField } from '../glass/material/AmbientField.js';
import { GlassBlurBackground, GlassBlurProvider } from '../glass/material/GlassBlurTarget.js';

const useStyles = makeStyles((glass) => ({
  root: { flex: 1, backgroundColor: glass.colors.base },
}));

/** Ambient field behind the shell, registered as the Android blur target for the glass panels. */
export function ShellBackground({ children }: { children: React.ReactNode }): React.JSX.Element {
  const styles = useStyles();

  return (
    <GlassBlurProvider>
      <View style={styles.root}>
        <GlassBlurBackground>
          <AmbientField />
        </GlassBlurBackground>
        {children}
      </View>
    </GlassBlurProvider>
  );
}
