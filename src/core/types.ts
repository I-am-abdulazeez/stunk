import { AsyncChunk } from "../query";

export type AsyncChunkOpt<T, E extends Error> = {
  initialData?: T | null;
  onError?: (error: E) => void;
  retryCount?: number;
  retryDelay?: number;
}

export type InferAsyncData<T> = T extends AsyncChunk<infer U, Error> ? U : never;

export type CombinedData<T extends Record<string, AsyncChunk<any>>> = {
  [K in keyof T]: InferAsyncData<T[K]> | null;
};

export type CombinedState<T extends Record<string, AsyncChunk<any>>> = {
  loading: boolean;
  error: Error | null;
  errors: Partial<{ [K in keyof T]: Error }>;
  data: CombinedData<T>;
};
