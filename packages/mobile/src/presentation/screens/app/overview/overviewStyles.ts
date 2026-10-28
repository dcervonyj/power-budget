import { makeStyles } from '../../../theme/index.js';

/** Text and panel styles shared by the Overview sections (D7-M-Dashboard). */
export const useOverviewStyles = makeStyles((glass) => ({
  panel: { padding: glass.space.lg, gap: glass.space.md },
  heading: {
    color: glass.colors.fg,
    fontFamily: 'Geist_600SemiBold',
    fontSize: glass.type.panelLabel.mobile,
  },
  headingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: glass.space.xs,
  },
  body: {
    color: glass.colors.dim,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.body.mobile,
    lineHeight: 21,
  },
  small: {
    color: glass.colors.dim,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.small.mobile,
    lineHeight: 19,
  },
  strong: { color: glass.colors.fg, fontFamily: 'Geist_600SemiBold' },
  centered: { textAlign: 'center' },
}));
