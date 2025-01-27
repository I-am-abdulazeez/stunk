declare module 'stunk' {
  export type Subscriber<T> = (newValue: T) => void;

  export interface Chunk<T> {
    get: () => T;
    set: (value: T) => void;
    subscribe: (callback: Subscriber<T>) => () => void;
  }

  export function chunk<T>(initialValue: T): Chunk<T>;
}
