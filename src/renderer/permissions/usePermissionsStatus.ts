import { useQuery } from '@tanstack/react-query';
import type { PermissionsSnapshot } from 'main/platform/permissions/IPermissionsGate';

const EMPTY: PermissionsSnapshot = {
  screen: 'unknown',
  microphone: 'unknown',
  accessibility: 'unknown',
};

/**
 * Polls permission status every 2 seconds while the window is focused.
 * The user typically grants permission in System Settings then returns
 * to the app — short polling catches the transition without requiring
 * an explicit IPC event from the OS (none is available).
 */
export function usePermissionsStatus() {
  return useQuery<PermissionsSnapshot>({
    queryKey: ['permissions'],
    queryFn: () => window.permissions.snapshot(),
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
    initialData: EMPTY,
  });
}
