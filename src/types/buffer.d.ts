declare module 'buffer' {
  export const Buffer: unknown;
  export const SlowBuffer: unknown;
  export const INSPECT_MAX_BYTES: number;
  export const kMaxLength: number;
  export const kStringMaxLength: number;
  export const constants: {
    MAX_LENGTH: number;
    MAX_STRING_LENGTH: number;
  };
}