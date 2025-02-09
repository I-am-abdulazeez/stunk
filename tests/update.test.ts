import { chunk } from '../src/core/core';

describe('chunk update', () => {
  it('should update value using updater function', () => {
    const store = chunk(5);
    store.update(value => value + 1);
    expect(store.get()).toBe(6);
  });

  it('should throw error if updater is not a function', () => {
    const store = chunk(5);
    // @ts-expect-error Testing invalid input
    expect(() => store.update('not a function')).toThrow('Updater must be a function');
  });

  it('should throw error if updater returns null or undefined', () => {
    const store = chunk(5);
    // @ts-expect-error Testing invalid input
    expect(() => store.update(() => null)).toThrow('Value cannot be null or undefined.');
    // @ts-expect-error Testing invalid input
    expect(() => store.update(() => undefined)).toThrow('Value cannot be null or undefined.');
  });

  it('should notify subscribers only if value changes', () => {
    const store = chunk(5);
    const subscriber = jest.fn();
    store.subscribe(subscriber);

    // Reset the mock to ignore initial subscription call
    subscriber.mockReset();

    // Update to same value
    store.update(value => value);
    expect(subscriber).not.toHaveBeenCalled();

    // Update to new value
    store.update(value => value + 1);
    expect(subscriber).toHaveBeenCalledWith(6);
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it('should handle complex update logic', () => {
    const store = chunk(5);
    store.update(value => {
      if (value > 3) {
        return value * 2;
      }
      return value + 1;
    });
    expect(store.get()).toBe(10);
  });

  it('should maintain type safety', () => {
    interface User {
      name: string;
      age: number;
    }

    const store = chunk<User>({ name: 'John', age: 30 });

    store.update(user => ({
      ...user,
      age: user.age + 1
    }));

    const user = store.get();
    expect(user.age).toBe(31);
    expect(user.name).toBe('John');
  });
});
