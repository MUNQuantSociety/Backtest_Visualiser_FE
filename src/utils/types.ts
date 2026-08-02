/** Envelope types shared by every endpoint. Feature-specific payloads live in
 *  `src/features/<feature>/types/`, not here. */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SortSpec<TField extends string = string> {
  field: TField;
  direction: 'asc' | 'desc';
}

export interface DateRange {
  /** ISO-8601 date, inclusive. */
  from: string;
  /** ISO-8601 date, inclusive. */
  to: string;
}

/** Async state for anything not routed through React Query. */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';
