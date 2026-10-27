import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { makeStyles, useGlass } from '../theme/index.js';
import { GlassPanel } from '../glass/material/GlassPanel.js';
import { Icon } from '../glass/atoms/Icon.js';
import type { IconName } from '../glass/atoms/iconPaths.js';
import { IconButton } from '../glass/controls/IconButton.js';
import { BODY_FONT, TOUCH_TARGET } from '../glass/controls/fonts.js';
import type { AccountMenuKey } from './useShellLabels.js';

export interface AccountMenuEntry {
  readonly key: AccountMenuKey;
  readonly label: string;
  readonly icon: IconName;
}

export interface AccountMenuViewProps {
  readonly buttonLabel: string;
  readonly entries: readonly AccountMenuEntry[];
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onSelect: (key: AccountMenuKey) => void;
}

const useStyles = makeStyles((glass) => ({
  backdrop: { flex: 1, backgroundColor: glass.colors.scrim },
  anchor: {
    position: 'absolute',
    top: 88,
    right: glass.space.md,
    left: glass.space.md,
    alignItems: 'flex-end',
  },
  panel: { minWidth: 240 },
  item: {
    minHeight: TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: glass.space.sm,
    paddingHorizontal: glass.space.md,
  },
  itemLabel: { color: glass.colors.fg, fontFamily: BODY_FONT, fontSize: glass.type.body.mobile },
}));

/** Avatar-slot button that opens the account menu (Settings, Categories, Household, Banks, Audit). */
export function AccountMenuView({
  buttonLabel,
  entries,
  open,
  onOpen,
  onClose,
  onSelect,
}: AccountMenuViewProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();

  return (
    <>
      <IconButton label={buttonLabel} onPress={onOpen}>
        <Icon name="users" size={20} color={glass.colors.fg} />
      </IconButton>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        accessibilityLabel={buttonLabel}
        onRequestClose={onClose}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          onPress={onClose}
          style={styles.backdrop}
        />
        <View pointerEvents="box-none" style={styles.anchor}>
          <GlassPanel material="frosted" depth={0} style={styles.panel}>
            <View accessibilityLabel={buttonLabel} accessibilityRole="menu">
              {entries.map((entry) => (
                <Pressable
                  key={entry.key}
                  accessibilityRole="menuitem"
                  accessibilityLabel={entry.label}
                  onPress={() => {
                    onSelect(entry.key);
                  }}
                  style={styles.item}
                >
                  <Icon name={entry.icon} size={20} color={glass.colors.fg} />
                  <Text importantForAccessibility="no" style={styles.itemLabel}>
                    {entry.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </GlassPanel>
        </View>
      </Modal>
    </>
  );
}
