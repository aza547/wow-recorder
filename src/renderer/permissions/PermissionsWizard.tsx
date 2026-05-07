import { usePermissionsStatus } from './usePermissionsStatus';

/**
 * First-run mac permissions wizard. Blocks the app UI until Screen
 * Recording is granted. Microphone and Accessibility are surfaced as
 * non-blocking warnings — the user can proceed without them.
 */
export default function PermissionsWizard() {
  const { data: status } = usePermissionsStatus();
  const screenGranted = status.screen === 'granted';
  const accessibilityGranted = status.accessibility === 'granted';

  if (screenGranted) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(17, 24, 39, 0.95)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 540,
          padding: 32,
          background: 'rgba(31, 41, 55, 1)',
          borderRadius: 8,
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>Permissions required</h1>
        <p style={{ marginBottom: 24, lineHeight: 1.5 }}>
          Warcraft Recorder needs <strong>Screen Recording</strong> permission
          to capture your gameplay. macOS gates this behind a system setting you
          must enable manually.
        </p>

        <PermissionRow
          label="Screen Recording (required)"
          status={status.screen}
          onOpen={() => window.permissions.openSettingsFor('screen')}
        />
        <PermissionRow
          label="Accessibility (for global hotkeys)"
          status={status.accessibility}
          optional
          onOpen={() => window.permissions.openSettingsFor('accessibility')}
        />

        <p style={{ marginTop: 24, fontSize: 13, opacity: 0.8 }}>
          After toggling a permission in System Settings, return to this window
          — the status will refresh automatically.
        </p>

        {!accessibilityGranted && (
          <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
            Without Accessibility, push-to-talk and other global hotkeys are
            disabled. You can grant it later.
          </p>
        )}
      </div>
    </div>
  );
}

function PermissionRow({
  label,
  status,
  optional,
  onOpen,
}: {
  label: string;
  status: string;
  optional?: boolean;
  onOpen: () => void;
}) {
  const granted = status === 'granted';
  const bg = granted ? '#065f46' : optional ? '#78350f' : '#991b1b';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: bg,
        padding: '12px 16px',
        borderRadius: 4,
        marginBottom: 8,
      }}
    >
      <span>{label}</span>
      <button
        type="button"
        onClick={onOpen}
        style={{
          background: 'white',
          color: 'black',
          padding: '6px 12px',
          borderRadius: 4,
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        {granted ? 'Granted ✓' : 'Open Settings'}
      </button>
    </div>
  );
}
