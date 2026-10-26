import React from 'react';
import { Text, View } from 'react-native';
import { makeStyles } from '../../theme/index.js';
import { AmbientField } from './AmbientField.js';
import { DepthPanes } from './DepthPanes.js';
import { GlassPanel } from './GlassPanel.js';
import type { GlassDepth, GlassMaterial } from './GlassPanel.js';

// Fixture copy lives in constants so the gallery stays free of JSX literals.
const LABELS = {
  specular: 'specular',
  film: 'specular + film',
  sweep: 'specular + film + sweep',
  hero: 'hero over depth panes',
} as const;

const DEPTHS: readonly GlassDepth[] = [0, 1, 2];

const useStyles = makeStyles((glass) => ({
  stage: {
    minHeight: 360,
    padding: glass.space.xl,
    borderRadius: glass.radius.mobilePanel,
    overflow: 'hidden',
  },
  stack: { gap: glass.space.lg },
  depthStage: { padding: glass.space['3xl'] },
  text: {
    minHeight: 96,
    padding: glass.space.lg,
    color: glass.colors.fg,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.body.mobile,
  },
}));

function MaterialStage({ material }: { material: GlassMaterial }): React.JSX.Element {
  const styles = useStyles();

  return (
    <View accessibilityLabel={`${material} glass`} style={styles.stage}>
      <AmbientField />
      <View style={styles.stack}>
        {DEPTHS.map((depth) => (
          <GlassPanel key={depth} material={material} depth={depth}>
            <Text style={styles.text}>{materialLabel(material, depth)}</Text>
          </GlassPanel>
        ))}
      </View>
    </View>
  );
}

/** Frosted glass at depth 0, 1 and 2 over the ambient field. */
export function Frosted(): React.JSX.Element {
  return <MaterialStage material="frosted" />;
}

/** Clear glass at depth 0, 1 and 2 over the ambient field. */
export function Clear(): React.JSX.Element {
  return <MaterialStage material="clear" />;
}

/** Tinted glass at depth 0, 1 and 2 over the ambient field. */
export function Tinted(): React.JSX.Element {
  return <MaterialStage material="tinted" />;
}

/** Specular, thin-film rim and glint sweep decor. */
export function Decor(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View accessibilityLabel="Panel decor" style={styles.stage}>
      <AmbientField />
      <View style={styles.stack}>
        <GlassPanel decor={{ specular: true }}>
          <Text style={styles.text}>{LABELS.specular}</Text>
        </GlassPanel>
        <GlassPanel decor={{ specular: true, film: true }}>
          <Text style={styles.text}>{LABELS.film}</Text>
        </GlassPanel>
        <GlassPanel depth={0} decor={{ specular: true, film: true, sweep: 0 }}>
          <Text style={styles.text}>{LABELS.sweep}</Text>
        </GlassPanel>
      </View>
    </View>
  );
}

/** Two clear panes behind a hero panel. */
export function Depth(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View accessibilityLabel="Depth panes" style={[styles.stage, styles.depthStage]}>
      <AmbientField />
      <DepthPanes>
        <GlassPanel depth={0} decor={{ specular: true, film: true }}>
          <Text style={styles.text}>{LABELS.hero}</Text>
        </GlassPanel>
      </DepthPanes>
    </View>
  );
}

function materialLabel(material: GlassMaterial, depth: GlassDepth): string {
  return `${material} depth ${depth}`;
}
