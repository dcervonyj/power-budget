import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useIntl } from 'react-intl';
import { makeStyles, useGlass, useReducedMotion } from '../../theme/index.js';
import { IconButton } from '../controls/IconButton.js';
import { LABEL_FONT } from '../controls/fonts.js';
import { GlassPanel } from '../material/GlassPanel.js';
import { bezier } from '../material/motion.js';
import { CloseGlyph } from './glyphs.js';
import { clampDrag, shouldCloseOnDrag } from './sheetDrag.js';

export interface SheetProps {
  readonly isOpen: boolean;
  /** Called by the close button, the scrim, the hardware back button, Esc and a drag past the threshold. */
  readonly onClose: () => void;
  readonly title?: string;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
}

const useStyles = makeStyles((glass) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: glass.colors.scrim,
  },
  sheet: { maxHeight: '90%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: glass.space.sm,
    paddingHorizontal: glass.space.xl,
    paddingTop: glass.space.lg,
    paddingBottom: glass.space.sm,
    borderTopLeftRadius: glass.radius.mobilePanel,
    borderTopRightRadius: glass.radius.mobilePanel,
    backgroundColor: glass.colors.tint,
    boxShadow: glass.colors.tintRim,
  },
  grabber: {
    position: 'absolute',
    top: glass.space.xs,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: glass.colors.faint,
  },
  title: {
    flex: 1,
    color: glass.colors.fg,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.heading.mobile,
  },
  body: { flexShrink: 1 },
  bodyContent: { padding: glass.space.xl },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: glass.space.sm,
    paddingHorizontal: glass.space.xl,
  },
}));

/**
 * D7 bottom sheet on a frosted panel: 420 ms rise, tinted header with a grabber, drag the header
 * down to close, and the back button, Esc, the scrim and the close button all call `onClose`.
 * The title takes screen reader focus on open, then the body, then the footer.
 */
export function Sheet({
  isOpen,
  onClose,
  title,
  children,
  footer,
}: SheetProps): React.JSX.Element | null {
  const glass = useGlass();
  const reduced = useReducedMotion();
  const mounted = useMountedWhileLeaving(isOpen, reduced ? 0 : glass.motion.sheet.durationMs);
  const { height } = useWindowDimensions();
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const target = isOpen && mounted ? 1 : 0;

  useEffect(() => {
    cancelAnimation(progress);
    if (reduced) {
      progress.value = target;

      return;
    }
    progress.value = withTiming(target, {
      duration: glass.motion.sheet.durationMs,
      easing: bezier(glass.motion.sheet.easing),
    });
  }, [target, reduced, progress, glass.motion.sheet.durationMs, glass.motion.sheet.easing]);

  useEffect(() => {
    if (isOpen) {
      drag.value = 0;
    }
  }, [isOpen, drag]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * height + drag.value }],
  }));

  if (!mounted && !isOpen) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      {...dialogName(title)}
    >
      <SheetContent
        onClose={onClose}
        title={title}
        footer={footer}
        animatedStyle={animatedStyle}
        drag={drag}
        focusTitle={isOpen}
      >
        {children}
      </SheetContent>
    </Modal>
  );
}

interface SheetContentProps {
  readonly onClose: () => void;
  readonly title?: string;
  readonly footer?: React.ReactNode;
  readonly animatedStyle: ReturnType<typeof useAnimatedStyle>;
  readonly drag: { value: number };
  readonly focusTitle: boolean;
  readonly children: React.ReactNode;
}

function SheetContent({
  onClose,
  title,
  footer,
  animatedStyle,
  drag,
  focusTitle,
  children,
}: SheetContentProps): React.JSX.Element {
  const intl = useIntl();
  const glass = useGlass();
  const styles = useStyles();
  const titleRef = useRef<React.ComponentRef<typeof Text>>(null);
  const dragStart = useRef({ y: 0, at: 0 });
  const closeLabel = intl.formatMessage({ id: 'glass-overlays.close', defaultMessage: 'Close' });
  const radius = glass.radius.mobilePanel;

  useEffect(() => {
    // Screen reader focus by node handle exists on native only; the web dialog manages its own.
    if (!focusTitle || Platform.OS === 'web') {
      return;
    }
    const node = findNodeHandle(titleRef.current);
    if (typeof node === 'number') {
      AccessibilityInfo.setAccessibilityFocus(node);
    }
  }, [focusTitle]);

  function startDrag(event: GestureResponderEvent): void {
    dragStart.current = { y: event.nativeEvent.pageY, at: event.timeStamp };
  }

  function moveDrag(event: GestureResponderEvent): void {
    drag.value = clampDrag(event.nativeEvent.pageY - dragStart.current.y);
  }

  function endDrag(event: GestureResponderEvent): void {
    const deltaY = event.nativeEvent.pageY - dragStart.current.y;
    const elapsed = event.timeStamp - dragStart.current.at;
    if (shouldCloseOnDrag(deltaY, elapsed)) {
      onClose();

      return;
    }
    drag.value = withTiming(0, { duration: glass.motion.press.durationMs });
  }

  return (
    <View style={styles.root} accessibilityViewIsModal onAccessibilityEscape={onClose}>
      <Pressable accessible={false} style={styles.scrim} onPress={onClose} />
      <Animated.View style={[styles.sheet, animatedStyle]}>
        <GlassPanel
          material="frosted"
          depth={2}
          decor={{ specular: true }}
          radius={radius}
          style={{ marginBottom: -radius }}
          contentStyle={{ paddingBottom: radius + glass.space.lg }}
        >
          <View
            testID="sheet-header"
            style={styles.header}
            onStartShouldSetResponder={returnTrue}
            onResponderGrant={startDrag}
            onResponderMove={moveDrag}
            onResponderRelease={endDrag}
          >
            <View
              style={styles.grabber}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            {title === undefined ? (
              <View style={styles.title} />
            ) : (
              <Text ref={titleRef} accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
            )}
            <IconButton label={closeLabel} onPress={onClose}>
              <CloseGlyph color={glass.colors.fg} />
            </IconButton>
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {children}
          </ScrollView>
          {footer === undefined ? null : <View style={styles.footer}>{footer}</View>}
        </GlassPanel>
      </Animated.View>
    </View>
  );
}

/** On web the dialog element takes its name from `aria-label`; native Modals ignore it. */
function dialogName(title: string | undefined): Record<string, string | undefined> {
  return { 'aria-label': title };
}

function returnTrue(): boolean {
  return true;
}

/** Stays true for `leaveMs` after `isOpen` turns false, so the sheet can finish sliding out. */
function useMountedWhileLeaving(isOpen: boolean, leaveMs: number): boolean {
  const [mounted, setMounted] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);

      return undefined;
    }
    const timer = setTimeout(() => {
      setMounted(false);
    }, leaveMs);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, leaveMs]);

  return mounted;
}
