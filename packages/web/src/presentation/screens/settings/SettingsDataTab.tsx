import { settingsStore } from '../../../composition.js';
import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import {
  ACTIONS_STYLE,
  ERROR_STYLE,
  HEADING_STYLE,
  NOTE_STYLE,
  SECTION_STYLE,
} from './settingsStyles.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Modal } from '../../components/Modal.js';

const CONFIRM_WORD = 'DELETE';

export const SettingsDataTab = observer(function SettingsDataTab(): React.JSX.Element {
  const intl = useIntl();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const needsTotp =
    settingsStore.deleteError === 'requires_totp' || settingsStore.deleteError === 'totp_invalid';

  function handleOpenDeleteModal(): void {
    setConfirmText('');
    setTotpCode('');
    setDeleteModalOpen(true);
  }

  function handleCloseDeleteModal(): void {
    setDeleteModalOpen(false);
    setConfirmText('');
  }

  async function handleConfirmDelete(): Promise<void> {
    if (confirmText !== CONFIRM_WORD) return;
    await settingsStore.deleteAccount(needsTotp ? totpCode : '');
    if (!settingsStore.deleteError) {
      setDeleteModalOpen(false);
    }
  }

  const canConfirm = confirmText === CONFIRM_WORD;

  const deleteModalTitle = intl.formatMessage({
    id: 'settings.data.delete.title',
    defaultMessage: 'Delete account',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-lg)' }}>
      <GlassPanel material="frosted" depth={1} contentStyle={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>
          <FormattedMessage id="settings.data.export.title" defaultMessage="Export my data" />
        </h2>
        <p style={NOTE_STYLE}>
          <FormattedMessage
            id="settings.data.export.description"
            defaultMessage="Download a copy of all your household data in JSON format."
          />
        </p>

        <div style={ACTIONS_STYLE}>
          <Button
            variant="secondary"
            loading={settingsStore.isExporting}
            disabled={settingsStore.isExporting || !!settingsStore.exportUrl}
            onClick={() => {
              void settingsStore.exportData();
            }}
          >
            <FormattedMessage id="settings.data.export.button" defaultMessage="Export" />
          </Button>

          {settingsStore.isExporting && (
            <span role="status" style={NOTE_STYLE}>
              <FormattedMessage
                id="settings.data.export.downloading"
                defaultMessage="Preparing export…"
              />
            </span>
          )}

          {settingsStore.exportUrl && (
            <a
              href={settingsStore.exportUrl}
              download
              onClick={() => {
                settingsStore.clearExportUrl();
              }}
              style={{
                color: 'var(--pb-glass-accent)',
                fontSize: 'var(--pb-glass-type-small-web)',
                fontWeight: 'var(--pb-glass-type-label-weight)',
              }}
            >
              <FormattedMessage id="settings.data.export.ready" defaultMessage="Download ready" />
            </a>
          )}

          {settingsStore.exportError && (
            <span role="alert" style={ERROR_STYLE}>
              <FormattedMessage
                id="settings.data.export.error"
                defaultMessage="Export failed. Please try again."
              />
            </span>
          )}
        </div>
      </GlassPanel>

      <GlassPanel
        material="tinted"
        depth={1}
        contentStyle={{ ...SECTION_STYLE, boxShadow: 'inset 0 0 0 1px var(--pb-glass-over)' }}
      >
        <h2 style={HEADING_STYLE}>
          <FormattedMessage id="settings.data.dangerZone" defaultMessage="Danger Zone" />
        </h2>
        <p style={NOTE_STYLE}>
          <FormattedMessage
            id="settings.data.delete.warning"
            defaultMessage="This action schedules account deletion in 30 days."
          />
        </p>
        <div style={ACTIONS_STYLE}>
          <Button variant="danger" onClick={handleOpenDeleteModal}>
            <FormattedMessage id="settings.data.delete.button" defaultMessage="Delete account" />
          </Button>
        </div>
      </GlassPanel>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteModalOpen}
        title={deleteModalTitle}
        onClose={handleCloseDeleteModal}
        footerButtons={[
          {
            label: intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' }),
            variant: 'secondary',
            onClick: handleCloseDeleteModal,
          },
          {
            label: intl.formatMessage({
              id: 'settings.data.delete.button',
              defaultMessage: 'Delete account',
            }),
            variant: 'danger',
            onClick: () => {
              void handleConfirmDelete();
            },
          },
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-md)' }}>
          <p style={NOTE_STYLE}>
            <FormattedMessage
              id="settings.data.delete.warning"
              defaultMessage="This action schedules account deletion in 30 days."
            />
          </p>
          <p style={{ ...ERROR_STYLE, margin: 0, fontWeight: 'var(--pb-glass-type-label-weight)' }}>
            <FormattedMessage
              id="settings.data.delete.holdWarning"
              defaultMessage="Your household and all associated data will be permanently deleted after 30 days. This cannot be undone."
            />
          </p>

          <Input
            id="settings-delete-confirm"
            label={intl.formatMessage({
              id: 'settings.data.delete.confirm',
              defaultMessage: 'Type DELETE to confirm',
            })}
            value={confirmText}
            onChange={setConfirmText}
            placeholder={CONFIRM_WORD}
          />

          {!canConfirm && confirmText.length > 0 && (
            <span style={ERROR_STYLE}>
              <FormattedMessage
                id="settings.data.delete.confirmMismatch"
                defaultMessage="Please type DELETE exactly to confirm."
              />
            </span>
          )}

          {needsTotp && (
            <Input
              id="settings-delete-totp"
              label={intl.formatMessage({
                id: 'settings.data.delete.totp',
                defaultMessage: 'Authenticator code (required to delete)',
              })}
              value={totpCode}
              onChange={setTotpCode}
            />
          )}

          {settingsStore.deleteError && (
            <span role="alert" style={ERROR_STYLE}>
              {settingsStore.deleteError === 'requires_totp' && (
                <FormattedMessage
                  id="settings.data.delete.requiresTotp"
                  defaultMessage="Enter a code from your authenticator app to confirm."
                />
              )}
              {settingsStore.deleteError === 'totp_invalid' && (
                <FormattedMessage
                  id="screen.login.error.invalidTotp"
                  defaultMessage="Invalid authenticator code."
                />
              )}
              {settingsStore.deleteError === 'requires_totp_enrollment' && (
                <Link to="/auth/totp-enroll">
                  <FormattedMessage
                    id="settings.data.delete.requiresTotpEnrollment"
                    defaultMessage="Set up two-factor authentication first."
                  />
                </Link>
              )}
              {settingsStore.deleteError === 'too_many_requests' && (
                <FormattedMessage
                  id="auth.error.tooManyAttempts"
                  defaultMessage="Too many attempts. Please wait a few minutes and try again."
                />
              )}
              {settingsStore.deleteError === 'delete_failed' && (
                <FormattedMessage
                  id="settings.data.delete.error"
                  defaultMessage="Failed to schedule deletion. Please try again."
                />
              )}
            </span>
          )}
        </div>
      </Modal>
    </div>
  );
});
