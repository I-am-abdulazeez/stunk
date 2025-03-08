import { describe, it, expect, vi } from 'vitest';
import { chunk } from '../src/core/core';
import { select } from '../src/core/selector'

describe('select', () => {
  it('should create a selector that initially returns the correct value', () => {
    const source = chunk({ name: 'John', age: 25 });
    const nameSelector = select(source, user => user.name);

    expect(nameSelector.get()).toBe('John');
  });

  it('should update when selected value changes', () => {
    const source = chunk({ name: 'John', age: 25 });
    const nameSelector = select(source, user => user.name);

    source.set({ name: 'Jane', age: 25 });
    expect(nameSelector.get()).toBe('Jane');
  });

  it('should not notify subscribers when non-selected values change', () => {
    const source = chunk({ name: 'John', age: 25 });
    const nameSelector = select(source, user => user.name);

    const subscriber = vi.fn();
    nameSelector.subscribe(subscriber);

    // Reset the mock to ignore initial call
    subscriber.mockReset();

    // Update age only
    source.set({ name: 'John', age: 26 });

    expect(subscriber).not.toHaveBeenCalled();
  });

  it('should notify subscribers when selected value changes', () => {
    const source = chunk({ name: 'John', age: 25 });
    const nameSelector = select(source, user => user.name);

    const subscriber = vi.fn();
    nameSelector.subscribe(subscriber);

    // Reset the mock to ignore initial call
    subscriber.mockReset();

    source.set({ name: 'Jane', age: 25 });

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith('Jane');
  });

  it('should prevent direct modifications to selector', () => {
    const source = chunk({ name: 'John', age: 25 });
    const nameSelector = select(source, user => user.name);

    expect(() => {
      nameSelector.set('Jane');
    }).toThrow('Cannot set values directly on a selector');
  });

  it('should work with complex selectors', () => {
    const source = chunk({ user: { profile: { name: 'John' } } });
    const nameSelector = select(source, state => state.user.profile.name);

    expect(nameSelector.get()).toBe('John');

    source.set({ user: { profile: { name: 'Jane' } } });
    expect(nameSelector.get()).toBe('Jane');
  });

  it('should handle array selectors', () => {
    const source = chunk({ items: [1, 2, 3] });
    const firstItemSelector = select(source, state => state.items[0]);

    expect(firstItemSelector.get()).toBe(1);

    source.set({ items: [4, 2, 3] });
    expect(firstItemSelector.get()).toBe(4);
  });

  it('should work with computed values', () => {
    const source = chunk({ numbers: [1, 2, 3, 4, 5] });
    const sumSelector = select(source, state =>
      state.numbers.reduce((sum, num) => sum + num, 0)
    );

    expect(sumSelector.get()).toBe(15);

    source.set({ numbers: [1, 2, 3] });
    expect(sumSelector.get()).toBe(6);
  });

  it('should properly clean up subscriptions on destroy', () => {
    const source = chunk({ name: 'John', age: 25 });
    const nameSelector = select(source, user => user.name);

    const subscriber = vi.fn();
    const unsubscribe = nameSelector.subscribe(subscriber);

    // Reset mock to ignore initial call
    subscriber.mockReset();

    unsubscribe();
    nameSelector.destroy();
    source.set({ name: 'Jane', age: 25 });

    expect(subscriber).not.toHaveBeenCalled();
  });

  it('should work with multiple independent selectors', () => {
    const source = chunk({ name: 'John', age: 25 });
    const nameSelector = select(source, user => user.name);
    const ageSelector = select(source, user => user.age);

    const nameSubscriber = vi.fn();
    const ageSubscriber = vi.fn();

    nameSelector.subscribe(nameSubscriber);
    ageSelector.subscribe(ageSubscriber);

    // Reset mocks to ignore initial calls
    nameSubscriber.mockReset();
    ageSubscriber.mockReset();

    source.set({ name: 'John', age: 26 });
    expect(nameSubscriber).not.toHaveBeenCalled();
    expect(ageSubscriber).toHaveBeenCalledWith(26);

    source.set({ name: 'Jane', age: 26 });
    expect(nameSubscriber).toHaveBeenCalledWith('Jane');
    expect(ageSubscriber).toHaveBeenCalledTimes(1); // Still from previous update
  });
});
