import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import { Icon } from '../../glass/atoms/Icon.js';
import '../../glass/controls/controls.css';
import { HEADER_STYLE, PAGE_STYLE, TITLE_STYLE } from '../../screens/app/planStyles.js';
import { LINK_BUTTON_STYLE } from './householdStyles.js';

export interface HouseholdPageProps {
  /** Shows the way back to the household overview (the category drill-in). */
  readonly backLink?: boolean;
  readonly children: React.ReactNode;
}

const COLUMNS_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
  gap: 'var(--pb-glass-space-md)',
  alignItems: 'start',
};

/** Frame of `/household`: title, optional back link and the cards in a responsive grid. */
export function HouseholdPage({
  backLink = false,
  children,
}: HouseholdPageProps): React.JSX.Element {
  return (
    <div style={PAGE_STYLE}>
      <header style={HEADER_STYLE}>
        <h1 style={TITLE_STYLE}>
          <FormattedMessage id="screen.household.title" defaultMessage="Household" />
        </h1>
        {backLink && (
          <Link to="/household" className="pbg-ctl" style={LINK_BUTTON_STYLE}>
            <Icon name="arrow-left" size={18} />
            <FormattedMessage id="household.backToOverview" defaultMessage="Back to household" />
          </Link>
        )}
      </header>
      <div style={COLUMNS_STYLE}>{children}</div>
    </div>
  );
}
