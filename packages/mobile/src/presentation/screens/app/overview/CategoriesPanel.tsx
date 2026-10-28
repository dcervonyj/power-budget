import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { makeStyles } from '../../../theme/index.js';
import { GlassPanel } from '../../../glass/material/GlassPanel.js';
import { CategoryRow } from '../../../glass/rows/CategoryRow.js';
import { AmountText } from '../../../glass/atoms/AmountText.js';
import { TOUCH_TARGET } from '../../../glass/controls/fonts.js';
import type { OverviewModel } from './overviewModel.js';
import { useOverviewStyles } from './overviewStyles.js';
import { useOverviewLabels } from './useOverviewLabels.js';

/** Rows shown before "Show all". */
export const COLLAPSED_CATEGORIES = 4;

const useStyles = makeStyles((glass) => ({
  rows: { gap: glass.space.md },
  toggle: {
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: glass.radius.chip,
    backgroundColor: glass.colors.clear,
    boxShadow: glass.colors.clearRim,
  },
  toggleText: {
    color: glass.colors.fg,
    fontFamily: 'Geist_600SemiBold',
    fontSize: glass.type.small.mobile,
  },
  unplanned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: glass.space.sm,
    paddingTop: glass.space.sm,
    borderTopWidth: 1,
    borderTopColor: glass.colors.edge,
  },
  unplannedTexts: { flex: 1, gap: 2 },
  unplannedTitle: {
    color: glass.colors.fg,
    fontFamily: 'Geist_600SemiBold',
    fontSize: glass.type.label.mobile,
  },
}));

export interface CategoriesPanelProps {
  readonly model: OverviewModel;
}

/**
 * Frosted Categories list: one CategoryRow (light rod, status in words, forecast when a category
 * ends above its plan at this pace) per expense category, then the unplanned spending.
 */
export function CategoriesPanel({ model }: CategoriesPanelProps): React.JSX.Element {
  const styles = useStyles();
  const text = useOverviewStyles();
  const labels = useOverviewLabels();
  const [expanded, setExpanded] = useState(false);
  const { categories } = model;
  const shown = expanded ? categories : categories.slice(0, COLLAPSED_CATEGORIES);

  return (
    <GlassPanel
      material="frosted"
      decor={{ specular: true, film: true }}
      rise={4}
      contentStyle={text.panel}
    >
      <View style={text.headingRow}>
        <Text accessibilityRole="header" style={text.heading}>
          {labels.categoriesTitle()}
        </Text>
        <Text style={text.small}>{labels.categoriesLegend()}</Text>
      </View>
      {categories.length === 0 ? (
        <Text style={text.body}>{labels.categoriesEmpty()}</Text>
      ) : (
        <View style={styles.rows}>
          {shown.map((category, index) => (
            <CategoryRow key={category.id} category={category} index={index} />
          ))}
        </View>
      )}
      {categories.length > COLLAPSED_CATEGORIES ? (
        <Pressable
          testID="overview-categories-toggle"
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>
            {expanded ? labels.showFewer() : labels.showAll(categories.length)}
          </Text>
        </Pressable>
      ) : null}
      {model.unplannedExpenses.amountMinor > 0n ? (
        <View testID="overview-unplanned" style={styles.unplanned}>
          <View style={styles.unplannedTexts}>
            <Text style={styles.unplannedTitle}>{labels.unplannedTitle()}</Text>
            <Text style={text.small}>{labels.unplannedHint()}</Text>
          </View>
          <AmountText amount={model.unplannedExpenses} />
        </View>
      ) : null}
    </GlassPanel>
  );
}
