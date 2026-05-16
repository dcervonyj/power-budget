import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../../components/ThemeContext.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Modal } from '../../components/Modal.js';
import { settingsStore } from '../../../application/settings/SettingsStore.js';

const CONFIRM_WORD = 'DELETE';

export const SettingsDataTab = observer(function SettingsDataTab(): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  function handleOpenDeleteModal(): void {
    setConfirmText('');
    setDeleteModalOpen(true);
  }

  function handleCloseDeleteModal(): void {
    setDeleteModalOpen(false);
    setConfirmText('');
  }

  async function handleConfirmDelete(): Promise<void> {
    if (confirmText !== CONFIRM_WORD) return;
    await settingsStore.deleteAccount();
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space['2xl'] }}>
      {/* Export section */}
      <section>
        <h2
          style={{
            margin: `0 0 ${theme.space.md}px`,
            fontSize: theme.fontSize.lg,
            fontWeight: theme.fontWeight.semibold,
            color: theme.color.text.primary,
          }}
        >
          <FormattedMessage id="settings.data.export.title" defaultMessage="Export my data" />
        </h2>
        <p
          style={{
            margin: `0 0 ${theme.space.md}px`,
            color: theme.color.text.secondary,
            fontSize: theme.fontSize.sm,
          }}
        >
          <FormattedMessage
            id="settings.data.export.description"
            defaultMessage="Download a copy of all your household data in JSON format."
          />
        </p>

        <div
          style={{ display: 'flex', alignItems: 'center', gap: theme.space.md, flexWrap: 'wrap' }}
        >
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
            <span style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
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
                color: theme.color.accent.default,
                fontSize: theme.fontSize.sm,
                fontWeight: theme.fontWeight.medium,
              }}
            >
              <FormattedMessage id="settings.data.export.ready" defaultMessage="Download ready" />
            </a>
          )}

          {settingsStore.exportError && (
            <span style={{ color: theme.color.status.danger, fontSize: theme.fontSize.sm }}>
              <FormattedMessage
                id="settings.data.export.error"
                defaultMessage="Export failed. Please try again."
              />
            </span>
          )}
        </div>
      </section>

      {/* Danger zone */}
      <section
        style={{
          border: `1px solid ${theme.color.status.danger}`,
          borderRadius: theme.radius.md,
          padding: theme.space.lg,
        }}
      >
        <h2
          style={{
            margin: `0 0 ${theme.space.sm}px`,
            fontSize: theme.fontSize.lg,
            fontWeight: theme.fontWeight.semibold,
            color: theme.color.status.danger,
          }}
        >
          <FormattedMessage id="settings.data.dangerZone" defaultMessage="Danger Zone" />
        </h2>

        <p
          style={{
            margin: `0 0 ${theme.space.md}px`,
            color: theme.color.text.secondary,
            fontSize: theme.fontSize.sm,
          }}
        >
          <FormattedMessage
            id="settings.data.delete.warning"
            defaultMessage="This action schedules account deletion in 30 days."
          />
        </p>

        <Button variant="danger" onClick={handleOpenDeleteModal}>
          <FormattedMessage id="settings.data.delete.button" defaultMessage="Delete account" />
        </Button>
      </section>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.md }}>
          <p style={{ margin: 0, color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
            <FormattedMessage
              id="settings.data.delete.warning"
              defaultMessage="This action schedules account deletion in 30 days."
            />
          </p>
          <p
            style={{
              margin: 0,
              color: theme.color.status.danger,
              fontWeight: theme.fontWeight.medium,
              fontSize: theme.fontSize.sm,
            }}
          >
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
            <span style={{ color: theme.color.status.danger, fontSize: theme.fontSize.xs }}>
              <FormattedMessage
                id="settings.data.delete.confirmMismatch"
                defaultMessage="Please type DELETE exactly to confirm."
              />
            </span>
          )}

          {settingsStore.deleteError && (
            <span style={{ color: theme.color.status.danger, fontSize: theme.fontSize.sm }}>
              <FormattedMessage
                id="settings.data.delete.error"
                defaultMessage="Failed to schedule deletion. Please try again."
              />
            </span>
          )}
        </div>
      </Modal>
    </div>
  );
});
