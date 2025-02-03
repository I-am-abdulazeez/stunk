type AsyncChunkOpt<T> = {
  initialData?: T | null;
  onError?: (error: Error) => void;
  retryCount?: number;
  retryDelay?: number;
}
