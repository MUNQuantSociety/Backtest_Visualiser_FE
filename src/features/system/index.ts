/** Public surface of the system feature (MQS Master health and logs). */

export { LogViewer } from './components/log-viewer';
export { ServerStatusCard } from './components/server-status-card';
export { useLogTail, useSystemStatus } from './hooks/use-system';
export { systemKeys } from './api/query-keys';
export type { LogEntry, Service, ServiceState, SystemStatus } from './types/system';
