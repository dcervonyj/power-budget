import React from 'react';
import { EmptyState } from '../../components/shared/EmptyState.js';
import { ErrorBanner } from '../../components/shared/ErrorBanner.js';
import { SkeletonBlock } from '../../components/shared/SkeletonBlock.js';
import { SkeletonList } from '../../components/shared/SkeletonList.js';
import { Toast } from '../../components/shared/Toast.js';
import { Drawer } from '../../components/Drawer.js';
import { Modal } from '../../components/Modal.js';
import { AmbientField } from '../material/AmbientField.js';
import { Sheet } from './Sheet.js';

const STAGE: React.CSSProperties = {
  position: 'relative',
  isolation: 'isolate',
  minHeight: 600,
  overflow: 'hidden',
  color: 'var(--pb-glass-fg)',
};

const BODY: React.CSSProperties = { margin: 0, color: 'var(--pb-glass-dim)' };

const MODAL_TEXT = 'The plan and its mappings are removed. Transactions stay in place.';

const DRAWER_TEXT = 'Groceries were raised from 800 to 900 on 3 October.';

const SHEET_TEXT = 'Name, icon and monthly amount.';

function noop(): void {
  // Gallery fixtures do not react to input.
}

/** Frosted centred dialog with footer buttons. */
export function Modals(): React.JSX.Element {
  return (
    <Backdrop>
      <Modal
        title="Delete this plan?"
        isOpen
        onClose={noop}
        footerButtons={[
          { label: 'Cancel', variant: 'secondary', onClick: noop },
          { label: 'Delete', variant: 'danger', onClick: noop },
        ]}
      >
        <p style={BODY}>{MODAL_TEXT}</p>
      </Modal>
    </Backdrop>
  );
}

/** Right-edge drawer. */
export function Drawers(): React.JSX.Element {
  return (
    <Backdrop>
      <Drawer isOpen onClose={noop} title="History">
        <p style={BODY}>{DRAWER_TEXT}</p>
      </Drawer>
    </Backdrop>
  );
}

/** Side sheet on desktop, bottom sheet at 820 px and below (follows the viewport). */
export function Sheets(): React.JSX.Element {
  return (
    <Backdrop>
      <Sheet isOpen onClose={noop} title="Edit category">
        <p style={BODY}>{SHEET_TEXT}</p>
      </Sheet>
    </Backdrop>
  );
}

/** Toast notice. */
export function Toasts(): React.JSX.Element {
  return (
    <Backdrop>
      <Toast message="Transaction saved" onDismiss={noop} />
    </Backdrop>
  );
}

/** Error banner, empty state and skeletons. */
export function States(): React.JSX.Element {
  return (
    <Backdrop>
      <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 24, padding: 24 }}>
        <ErrorBanner message="Could not load transactions." onRetry={noop} />
        <ErrorBanner message="Network error" />
        <EmptyState
          title="No transactions yet"
          subtitle="Connect a bank or add one by hand."
          action={{ label: 'Add account', onPress: noop }}
        />
        <SkeletonList rows={3} />
        <SkeletonBlock height={120} borderRadius={28} />
      </div>
    </Backdrop>
  );
}

function Backdrop({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={STAGE}>
      <AmbientField />
      {children}
    </div>
  );
}
