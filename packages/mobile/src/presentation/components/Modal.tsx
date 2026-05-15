import React from 'react';
import { Modal as RNModal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FormattedMessage } from 'react-intl';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';

const t = rnDarkTheme;

export interface MobileModalButton {
  readonly label: string;
  readonly variant?: 'primary' | 'secondary' | 'danger';
  readonly onPress: () => void;
}

export interface ModalProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly children: React.ReactNode;
  readonly onClose: () => void;
  readonly footerButtons?: ReadonlyArray<MobileModalButton>;
}

export function Modal({
  isOpen,
  title,
  children,
  onClose,
  footerButtons,
}: ModalProps): React.JSX.Element {
  return (
    <RNModal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.close}>
                <FormattedMessage id="common.closeIcon" defaultMessage="×" />
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.body}>{children}</View>
          {footerButtons && footerButtons.length > 0 && (
            <View style={styles.footer}>
              {footerButtons.map((btn) => {
                const btnColor =
                  btn.variant === 'primary'
                    ? t.colorAccentDefault
                    : btn.variant === 'danger'
                      ? t.colorStatusDanger
                      : 'transparent';
                const btnTextColor =
                  btn.variant === 'primary' ? t.colorAccentOnAccent : t.colorTextPrimary;
                return (
                  <TouchableOpacity
                    key={btn.label}
                    onPress={btn.onPress}
                    style={[styles.footerBtn, { backgroundColor: btnColor }]}
                  >
                    <Text style={[styles.footerBtnText, { color: btnTextColor }]}>{btn.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: t.colorSurfaceRaised,
    borderRadius: t.radiusLg,
    padding: t.space2xl,
    width: '88%',
    maxWidth: 480,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: t.spaceLg,
  },
  title: {
    color: t.colorTextPrimary,
    fontSize: t.fontSizeXl,
    fontWeight: t.fontWeightSemibold,
    flex: 1,
  },
  close: { color: t.colorTextSecondary, fontSize: t.fontSizeXl },
  body: {},
  footer: {
    flexDirection: 'row',
    gap: t.spaceSm,
    justifyContent: 'flex-end',
    marginTop: t.spaceLg,
  },
  footerBtn: {
    paddingVertical: t.spaceSm,
    paddingHorizontal: t.spaceLg,
    borderRadius: t.radiusMd,
  },
  footerBtnText: { fontSize: t.fontSizeMd, fontWeight: t.fontWeightMedium },
});
