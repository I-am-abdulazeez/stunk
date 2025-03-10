import { AsyncChunk } from "./asyncChunk";

export type AsyncChunkOpt<T, E extends Error> = {
  initialData?: T | null;
  onError?: (error: E) => void;
  retryCount?: number;
  retryDelay?: number;
}

export type InferAsyncData<T> = T extends AsyncChunk<infer U, Error> ? U : never;

export type CombinedData<T> = { [K in keyof T]: InferAsyncData<T[K]> | null };
export type CombinedState<T> = {
  loading: boolean;
  error: Error | null;
  data: CombinedData<T>;
};
