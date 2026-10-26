import React from 'react';
import { AmbientField } from './AmbientField.js';
import { DepthPanes } from './DepthPanes.js';
import { GlassPanel, type GlassDepth, type GlassMaterial } from './GlassPanel.js';

const DEPTHS: readonly GlassDepth[] = [0, 1, 2];

const STAGE: React.CSSProperties = {
  position: 'relative',
  isolation: 'isolate',
  minHeight: 360,
  padding: 'var(--pb-glass-space-xl)',
  borderRadius: 'var(--pb-glass-radius-panel)',
  overflow: 'hidden',
};

const GRID: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 'var(--pb-glass-space-lg)',
};

const TEXT: React.CSSProperties = {
  margin: 0,
  minHeight: 120,
  padding: 'var(--pb-glass-space-lg)',
  color: 'var(--pb-glass-fg)',
};

const LABELS: Readonly<Record<string, string>> = {
  decor: 'Panel decor',
  depth: 'Depth panes',
  specular: 'specular',
  'specular + film': 'specular + film',
  'specular + film + sweep': 'specular + film + sweep',
  'hero over depth panes': 'hero over depth panes',
};

function materialLabel(material: GlassMaterial, depth: GlassDepth): string {
  return `${material} depth ${depth}`;
}

function sectionLabel(material: GlassMaterial): string {
  return `${material} glass`;
}

function MaterialStage({ material }: { material: GlassMaterial }): React.JSX.Element {
  return (
    <section aria-label={sectionLabel(material)} style={STAGE}>
      <AmbientField position="absolute" />
      <div style={GRID}>
        {DEPTHS.map((depth) => (
          <GlassPanel key={depth} material={material} depth={depth}>
            <p style={TEXT}>{materialLabel(material, depth)}</p>
          </GlassPanel>
        ))}
      </div>
    </section>
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
  return (
    <section aria-label={LABELS['decor']} style={STAGE}>
      <AmbientField position="absolute" />
      <div style={GRID}>
        <GlassPanel decor={{ specular: true }}>
          <p style={TEXT}>{LABELS['specular']}</p>
        </GlassPanel>
        <GlassPanel decor={{ specular: true, film: true }}>
          <p style={TEXT}>{LABELS['specular + film']}</p>
        </GlassPanel>
        <GlassPanel depth={0} decor={{ specular: true, film: true, sweep: 0 }}>
          <p style={TEXT}>{LABELS['specular + film + sweep']}</p>
        </GlassPanel>
      </div>
    </section>
  );
}

/** Two clear panes behind a hero panel. */
export function Depth(): React.JSX.Element {
  return (
    <section
      aria-label={LABELS['depth']}
      style={{ ...STAGE, padding: 'var(--pb-glass-space-3xl)' }}
    >
      <AmbientField position="absolute" />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 520 }}>
        <DepthPanes>
          <GlassPanel depth={0} decor={{ specular: true, film: true }}>
            <p style={TEXT}>{LABELS['hero over depth panes']}</p>
          </GlassPanel>
        </DepthPanes>
      </div>
    </section>
  );
}
