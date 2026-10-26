import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import { Icon } from '../../glass/atoms/Icon.js';
import { CountBadge } from '../../glass/controls/CountBadge.js';
import { TO_SORT_PATH } from '../../shell/shellNav.js';
import { CLEAR_CARD_STYLE } from './overviewStyles.js';

export interface ToSortCardProps {
  readonly count: number;
}

const MAX_COUNT = 99;

/**
 * Clear-glass link to the transactions still to sort, with a honey count badge. Until sorted they
 * count as unplanned, so the card sits in the Unplanned panel.
 */
export function ToSortCard({ count }: ToSortCardProps): React.JSX.Element {
  return (
    <Link
      to={TO_SORT_PATH}
      style={{
        ...CLEAR_CARD_STYLE,
        marginTop: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: 52,
        padding: '0 16px',
        color: 'var(--pb-glass-fg)',
        textDecoration: 'none',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0 0.3em',
          flexWrap: 'wrap',
          fontSize: 'var(--pb-glass-type-body-web)',
        }}
      >
        <FormattedMessage
          id="overview.toSort.text"
          defaultMessage="<badge></badge> <b>to sort</b> <hint>· waiting for a category</hint>"
          values={{
            badge: renderBadge(count),
            b: renderStrong,
            hint: renderHint,
          }}
        />
      </span>
      <span style={{ display: 'inline-flex', color: 'var(--pb-glass-dim)' }}>
        <Icon name="arrow-right" size={18} />
      </span>
    </Link>
  );
}

function renderBadge(count: number): () => React.JSX.Element {
  return function badge(): React.JSX.Element {
    return <CountBadge count={count} max={MAX_COUNT} />;
  };
}

function renderStrong(chunks: React.ReactNode[]): React.JSX.Element {
  return <span style={{ fontWeight: 600 }}>{chunks}</span>;
}

function renderHint(chunks: React.ReactNode[]): React.JSX.Element {
  return <span style={{ color: 'var(--pb-glass-dim)' }}>{chunks}</span>;
}
