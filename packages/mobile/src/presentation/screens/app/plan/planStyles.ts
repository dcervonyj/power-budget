import { makeStyles } from '../../../theme/index.js';
import { BODY_FONT, LABEL_FONT } from '../../../glass/controls/fonts.js';

/** Styles shared by the plan Views. */
export const usePlanStyles = makeStyles((glass) => ({
  page: { padding: glass.space.lg, gap: glass.space.md, paddingBottom: glass.space['3xl'] },
  panelContent: { padding: glass.space.lg, gap: glass.space.sm },
  panelTitle: {
    color: glass.colors.fg,
    fontFamily: 'Geist_600SemiBold',
    fontSize: glass.type.panelLabel.mobile,
  },
  caption: { color: glass.colors.dim, fontFamily: BODY_FONT, fontSize: glass.type.small.mobile },
  label: { color: glass.colors.fg, fontFamily: LABEL_FONT, fontSize: glass.type.label.mobile },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: glass.space['3xl'] },
  noticeText: { color: glass.colors.over, fontFamily: BODY_FONT, fontSize: glass.type.body.mobile },
}));
