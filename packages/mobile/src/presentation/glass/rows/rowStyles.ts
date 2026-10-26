import { makeStyles } from '../../theme/index.js';

const MIN_TOUCH = 44;

/** Shared row styles: a clear-glass tile (never its own blur) with a title / small text column. */
export const useRowStyles = makeStyles((glass) => ({
  row: {
    gap: glass.space.sm,
    paddingVertical: glass.space.sm,
    paddingHorizontal: glass.space.md,
    borderRadius: glass.radius.tile,
    backgroundColor: glass.colors.clear,
    boxShadow: glass.colors.clearRim,
  },
  mainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: glass.space.sm,
    minHeight: MIN_TOUCH,
    minWidth: 0,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: glass.space.sm, minHeight: MIN_TOUCH },
  textColumn: { flex: 1, minWidth: 0, gap: 2 },
  title: {
    color: glass.colors.fg,
    fontFamily: 'Geist_600SemiBold',
    fontSize: glass.type.label.mobile,
  },
  small: {
    color: glass.colors.dim,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.small.mobile,
  },
  figures: { alignItems: 'flex-end', gap: 2 },
  figure: {
    color: glass.colors.fg,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.panelLabel.mobile,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: glass.space.xs },
  suggestion: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: glass.space.sm },
  suggestionText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: glass.space.xxs,
    minWidth: 140,
  },
  suggestionLabel: {
    color: glass.colors.fg,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.small.mobile,
    flexShrink: 1,
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH,
    paddingHorizontal: glass.space.md,
    borderRadius: glass.radius.control,
    backgroundColor: glass.colors.fill2,
  },
  primaryAction: { boxShadow: glass.colors.clearRim },
  pressed: { transform: [{ scale: 0.97 }] },
  actionText: {
    color: glass.colors.fg,
    fontFamily: 'Geist_600SemiBold',
    fontSize: glass.type.label.mobile,
  },
}));
