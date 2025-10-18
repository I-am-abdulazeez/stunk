import { describe, it, expect, vi } from 'vitest';
import { chunk } from '../../src/core/core';
import { select } from '../../src/core/selector';

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

    // Update age only (name stays the same)
    source.set({ name: 'John', age: 26 });

    expect(subscriber).not.toHaveBeenCalled();
  });

  it('should notify subscribers when selected value changes', () => {
    const source = chunk({ name: 'John', age: 25 });
    const nameSelector = select(source, user => user.name);

    const subscriber = vi.fn();
    nameSelector.subscribe(subscriber);

    source.set({ name: 'Jane', age: 25 });

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith('Jane');
  });

  it('should prevent direct modifications to selector', () => {
    const source = chunk({ name: 'John', age: 25 });
    const nameSelector = select(source, user => user.name);

    expect(() => {
      // @ts-expect-error - Testing that set doesn't exist
      nameSelector.set('Jane');
    }).toThrow();
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

    source.set({ name: 'John', age: 26 });
    expect(nameSubscriber).not.toHaveBeenCalled();
    expect(ageSubscriber).toHaveBeenCalledWith(26);

    source.set({ name: 'Jane', age: 26 });
    expect(nameSubscriber).toHaveBeenCalledWith('Jane');
    expect(ageSubscriber).toHaveBeenCalledTimes(1); // Still from previous update
  });

  it("should not update if selected object has the same values (shallow equal)", () => {
    const source = chunk({ name: "John", details: { age: 25, city: "Lagos" } });
    const detailsSelector = select(source, (user) => user.details, { useShallowEqual: true });

    const callback = vi.fn();
    detailsSelector.subscribe(callback);

    // Setting a new object with the same values
    source.set({ name: "John", details: { age: 25, city: "Lagos" } });

    expect(callback).not.toHaveBeenCalled();
  });

  it("should update if selected object is new but has same values (without shallow equal)", () => {
    const source = chunk({ name: "John", details: { age: 25, city: "Lagos" } });
    const detailsSelector = select(source, (user) => user.details);

    const callback = vi.fn();
    detailsSelector.subscribe(callback);

    // Setting a new object with the same values
    source.set({ name: "John", details: { age: 25, city: "Lagos" } });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should support nested derivation', () => {
    const source = chunk({ user: { profile: { name: 'John' } } });
    const profileSelector = select(source, (data) => data.user.profile);
    const nameSelector = profileSelector.derive(profile => profile.name);

    expect(nameSelector.get()).toBe('John');

    source.set({ user: { profile: { name: 'Alice' } } });
    expect(nameSelector.get()).toBe('Alice');
  });

  it('should pass options to nested selectors', () => {
    const source = chunk({
      user: {
        profile: { details: { age: 30, city: 'New York' } }
      }
    });

    const profileSelector = select(source, (data) => data.user.profile, { useShallowEqual: true });
    const detailsSelector = profileSelector.derive(profile => profile.details);

    const callback = vi.fn();
    detailsSelector.subscribe(callback);

    // Update with new object but same values
    source.set({
      user: {
        profile: { details: { age: 30, city: 'New York' } }
      }
    });

    expect(callback).not.toHaveBeenCalled(); // Should NOT trigger due to shallow equality
  });

  it('should be read-only (no set or reset methods)', () => {
    const source = chunk({ name: 'John' });
    const nameSelector = select(source, (user) => user.name);

    // @ts-ignore - checking properties don't exist
    expect(nameSelector.set).toBeUndefined();
    // @ts-ignore - checking properties don't exist
    expect(nameSelector.reset).toBeUndefined();
  });

  it('should unsubscribe from source when destroyed', () => {
    const source = chunk({ name: 'John' });
    const nameSelector = select(source, (user) => user.name);

    const callback = vi.fn();
    nameSelector.subscribe(callback);

    nameSelector.destroy();
    source.set({ name: 'Alice' });

    expect(callback).not.toHaveBeenCalled();
  });

  // ✅ NEW TEST: peek() should work on selectors
  it('should support peek() for non-reactive reads', () => {
    const source = chunk({ name: 'John', age: 25 });
    const nameSelector = select(source, user => user.name);

    expect(nameSelector.peek()).toBe('John');

    source.set({ name: 'Jane', age: 25 });
    expect(nameSelector.peek()).toBe('Jane');
  });

  // ✅ NEW TEST: Selector should update on source changes even without subscribers
  it('should update selector value even without subscribers', () => {
    const source = chunk({ count: 0 });
    const doubleSelector = select(source, state => state.count * 2);

    expect(doubleSelector.get()).toBe(0);

    source.set({ count: 5 });
    expect(doubleSelector.get()).toBe(10);

    source.set({ count: 10 });
    expect(doubleSelector.get()).toBe(20);
  });

  // ✅ NEW TEST: Primitive values with shallow equal
  it('should handle primitives with shallow equal option', () => {
    const source = chunk({ value: 5 });
    const valueSelector = select(source, state => state.value, { useShallowEqual: true });

    const callback = vi.fn();
    valueSelector.subscribe(callback);

    // Same value
    source.set({ value: 5 });
    expect(callback).not.toHaveBeenCalled();

    // Different value
    source.set({ value: 10 });
    expect(callback).toHaveBeenCalledWith(10);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  // ✅ NEW TEST: Selector with null values
  it('should handle null values in selectors', () => {
    const source = chunk<{ user: string | null }>({ user: 'John' });
    const userSelector = select(source, state => state.user);

    expect(userSelector.get()).toBe('John');

    source.set({ user: null });
    expect(userSelector.get()).toBeNull();

    source.set({ user: 'Jane' });
    expect(userSelector.get()).toBe('Jane');
  });

  // ✅ NEW TEST: Selector with array transformations
  it('should handle array transformations', () => {
    const source = chunk({ items: [1, 2, 3, 4, 5] });
    const evenSelector = select(source, state => state.items.filter(n => n % 2 === 0));

    expect(evenSelector.get()).toEqual([2, 4]);

    source.set({ items: [1, 2, 3, 4, 5, 6] });
    expect(evenSelector.get()).toEqual([2, 4, 6]);
  });

  // ✅ NEW TEST: Multiple levels of selection
  it('should support multiple levels of selection chaining', () => {
    const source = chunk({
      app: {
        user: {
          profile: {
            name: 'John',
            email: 'john@example.com'
          }
        }
      }
    });

    const userSelector = select(source, state => state.app.user);
    const profileSelector = select(userSelector, user => user.profile);
    const nameSelector = select(profileSelector, profile => profile.name);

    expect(nameSelector.get()).toBe('John');

    source.set({
      app: {
        user: {
          profile: {
            name: 'Jane',
            email: 'jane@example.com'
          }
        }
      }
    });

    expect(nameSelector.get()).toBe('Jane');
  });
});
