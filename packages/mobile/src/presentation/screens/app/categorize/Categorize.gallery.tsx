import React from 'react';
import { View } from 'react-native';
import { makeStyles } from '../../../theme/index.js';
import { ShellBackground } from '../../../navigation/ShellBackground.js';
import { CategorizeSheetView } from './CategorizeSheetView.js';
import type { CategorizeSheetViewProps } from './CategorizeSheetView.js';
import { ToSortView } from './ToSortView.js';
import { BOLT, QUEUE, ZABKA, ORLEN, sessionOf } from './categorizeFixtures.js';
import type { CategorizeSession } from './useCategorizeSession.js';

const useStyles = makeStyles(() => ({
  stage: { height: 980, overflow: 'hidden' },
  // Nothing focusable behind the sheet or in a skeleton: keep it shorter than the viewport so the page does not scroll.
  short: { height: 600, overflow: 'hidden' },
}));

function noop(): void {
  return undefined;
}

function Stage({
  children,
  short = false,
}: {
  readonly children: React.ReactNode;
  readonly short?: boolean;
}): React.JSX.Element {
  const styles = useStyles();

  return (
    <ShellBackground>
      <View style={short ? styles.short : styles.stage}>{children}</View>
    </ShellBackground>
  );
}

function sheet(
  session: CategorizeSession,
  overrides: Partial<CategorizeSheetViewProps> = {},
): React.JSX.Element {
  return (
    <Stage short>
      <CategorizeSheetView
        isOpen
        onClose={noop}
        session={session}
        choicesStatus="ready"
        onRetryChoices={noop}
        onBackToTransactions={noop}
        {...overrides}
      />
    </Stage>
  );
}

const NO_CHOICES: Partial<CategorizeSession> = {
  options: [],
  picked: undefined,
  impact: undefined,
};

/** A suggestion first and preselected, the rod previewing what the payment drains. */
export function SheetChoosing(): React.JSX.Element {
  return sheet(sessionOf(ORLEN));
}

/** The payment is sorted: the Confirmed card with Next and Undo. */
export function SheetConfirmed(): React.JSX.Element {
  return sheet(sessionOf(ORLEN, { phase: 'done' }));
}

/** The queue is done. */
export function SheetAllSorted(): React.JSX.Element {
  return sheet(
    sessionOf(ORLEN, {
      allDone: true,
      sortedCount: 3,
      row: undefined,
      picked: undefined,
      impact: undefined,
    }),
  );
}

/** A foreign-currency payment: no numbers for a plan in another currency. */
export function SheetForeignCurrency(): React.JSX.Element {
  return sheet(sessionOf(BOLT));
}

/** Confirm failed: the choices stay and the error says so. */
export function SheetConfirmFailed(): React.JSX.Element {
  return sheet(sessionOf(ZABKA, { failure: 'confirm' }));
}

export function SheetChoicesLoading(): React.JSX.Element {
  return sheet(sessionOf(ORLEN, NO_CHOICES), { choicesStatus: 'loading' });
}

export function SheetChoicesError(): React.JSX.Element {
  return sheet(sessionOf(ORLEN, NO_CHOICES), { choicesStatus: 'error' });
}

/** The To sort tab: every unsorted payment, with Sort all. */
export function ListToSort(): React.JSX.Element {
  return (
    <Stage>
      <ToSortView status="ready" rows={QUEUE} onOpen={noop} />
    </Stage>
  );
}

export function ListLoading(): React.JSX.Element {
  return (
    <Stage short>
      <ToSortView status="loading" rows={[]} onOpen={noop} />
    </Stage>
  );
}

export function ListError(): React.JSX.Element {
  return (
    <Stage>
      <ToSortView status="error" rows={[]} onRetry={noop} onOpen={noop} />
    </Stage>
  );
}

/** Nothing left to sort. */
export function ListAllSorted(): React.JSX.Element {
  return (
    <Stage short>
      <ToSortView status="ready" rows={[]} onOpen={noop} />
    </Stage>
  );
}
