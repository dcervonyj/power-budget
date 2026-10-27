import React from 'react';
import { Text, View } from 'react-native';
import { makeStyles } from '../../theme/index.js';
import { Modal } from '../../components/Modal.js';
import { Button } from '../../components/Button.js';
import { AmbientField } from '../material/AmbientField.js';
import { BODY_FONT } from '../controls/fonts.js';
import { BiometricOptInPanel, BiometricUnlockPanel } from './BiometricPanels.js';
import { EmptyState } from './EmptyState.js';
import { ErrorBanner } from './ErrorBanner.js';
import { Sheet } from './Sheet.js';
import { Skeleton, SkeletonList } from './Skeleton.js';
import { Toast } from './Toast.js';

const SAVE_LABEL = 'Save';
const SHEET_TEXT = 'Name, icon and monthly amount.';
const MODAL_TEXT = 'The plan and its mappings are removed. Transactions stay in place.';

const useStyles = makeStyles((glass) => ({
  stage: { minHeight: 600, gap: glass.space.lg },
  body: { color: glass.colors.dim, fontFamily: BODY_FONT, fontSize: glass.type.body.mobile },
  center: { minHeight: 600, justifyContent: 'center' },
}));

function noop(): void {}

/** Bottom sheet with a tinted header, open on the ambient field. */
export function Sheets(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.stage}>
      <AmbientField />
      <Sheet isOpen onClose={noop} title="Edit category" footer={<Button>{SAVE_LABEL}</Button>}>
        <Text style={styles.body}>{SHEET_TEXT}</Text>
      </Sheet>
    </View>
  );
}

/** The pre-glass Modal props, restyled as a sheet with footer buttons. */
export function Modals(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.stage}>
      <AmbientField />
      <Modal
        isOpen
        title="Delete this plan?"
        onClose={noop}
        footerButtons={[
          { label: 'Cancel', variant: 'secondary', onPress: noop },
          { label: 'Delete', variant: 'danger', onPress: noop },
        ]}
      >
        <Text style={styles.body}>{MODAL_TEXT}</Text>
      </Modal>
    </View>
  );
}

/** Toast notice at the bottom of the screen. */
export function Toasts(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.stage}>
      <AmbientField />
      <Toast message="Transaction saved" onDismiss={noop} />
    </View>
  );
}

/** Error banner (with and without retry), empty state and skeletons. */
export function States(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.stage}>
      <AmbientField />
      <ErrorBanner message="Could not load transactions." onRetry={noop} />
      <ErrorBanner message="Network error" />
      <EmptyState
        title="No transactions yet"
        subtitle="Connect a bank or add one by hand."
        action={{ label: 'Add account', onPress: noop }}
      />
      <SkeletonList rows={3} />
      <Skeleton height={120} borderRadius={28} />
    </View>
  );
}

/** Biometric opt-in card, and the lock card in its retry and failed states. */
export function BiometricCards(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={[styles.stage, styles.center]}>
      <AmbientField />
      <BiometricOptInPanel loading={false} onEnable={noop} onSkip={noop} />
      <BiometricUnlockPanel authenticating={false} failed onRetry={noop} />
      <BiometricUnlockPanel authenticating failed={false} onRetry={noop} />
    </View>
  );
}
