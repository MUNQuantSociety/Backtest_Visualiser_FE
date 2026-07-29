import { useQuery } from '@tanstack/react-query';

import { LIVE_REFETCH_MS, LOG_TAIL_SIZE } from '@/config/constants';

import { systemKeys } from '../api/query-keys';
import { fetchLogTail, fetchSystemStatus } from '../api/system-api';

export function useSystemStatus() {
  return useQuery({
    queryKey: systemKeys.status(),
    queryFn: fetchSystemStatus,
    refetchInterval: LIVE_REFETCH_MS,
    refetchIntervalInBackground: false,
  });
}

export function useLogTail(size: number = LOG_TAIL_SIZE) {
  return useQuery({
    queryKey: systemKeys.logs(size),
    queryFn: () => fetchLogTail(size),
    // Logs move faster than portfolio valuations and are what someone watches
    // during an incident, so this polls harder than the rest of the live views.
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });
}
