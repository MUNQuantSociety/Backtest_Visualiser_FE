// /**
//  * Generic API response wrapper
//  */
//
// export type ApiErrors = string[];
//
// export interface ApiResponseInterface<T> {
//     success: boolean;
//     status_code: number;
//     data?: T;
//     errors?: ApiErrors;
// }
//
// export interface CreateMockResponseInterface<T> extends Omit<
//     ApiResponseInterface<T>,
//     'status_code'
// > {
//     status_code?: number;
//     delay?: number;
// }
//
// /**
//  * Mock API response helper
//  */
// export function createMockResponse<T>({
//     success,
//     data,
//     errors,
//     status_code = 200,
//     delay = 800,
// }: CreateMockResponseInterface<T>): Promise<ApiResponseInterface<T>> {
//     return new Promise((resolve) => {
//         setTimeout(() => {
//             resolve({
//                 success,
//                 data,
//                 errors,
//                 status_code,
//             });
//         }, delay);
//     });
// }
//
// export function getApiResponseErrorMsg(
//     response: ApiResponseInterface<unknown>,
//     fallback: string
// ): string {
//     const errorsArray = response.errors ?? [];
//
//     if (errorsArray.length === 0) {
//         return fallback;
//     }
//
//     return errorsArray
//         .map(([field, messages]) => {
//             return `${field}: ${messages.join(', ')}`;
//         })
//         .join('\n');
// }
