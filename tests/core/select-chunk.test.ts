import { describe, it, expect, vi } from 'vitest';
import { chunk } from '../../src/core/core';
import { select } from '../../src/core/selector';


describe('select', () => {
  it('should return the correct initial value', () => {
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

    source.set({ name: 'John', age: 26 }); // age changed, name did not

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

  it('should be read-only — no set or reset methods', () => {
    const source = chunk({ name: 'John' });
    const nameSelector = select(source, user => user.name);

    // @ts-ignore
    expect(nameSelector.set).toBeUndefined();
    // @ts-ignore
    expect(nameSelector.reset).toBeUndefined();
  });

  it('should work with complex nested selectors', () => {
    const source = chunk({ user: { profile: { name: 'John' } } });
    const nameSelector = select(source, state => state.user.profile.name);

    expect(nameSelector.get()).toBe('John');

    source.set({ user: { profile: { name: 'Jane' } } });
    expect(nameSelector.get()).toBe('Jane');
  });

  it('should handle array selectors', () => {
    const source = chunk({ items: [1, 2, 3] });
    const firstItem = select(source, state => state.items[0]);

    expect(firstItem.get()).toBe(1);

    source.set({ items: [4, 2, 3] });
    expect(firstItem.get()).toBe(4);
  });

  it('should work with computed / derived values', () => {
    const source = chunk({ numbers: [1, 2, 3, 4, 5] });
    const sum = select(source, state => state.numbers.reduce((s, n) => s + n, 0));

    expect(sum.get()).toBe(15);

    source.set({ numbers: [1, 2, 3] });
    expect(sum.get()).toBe(6);
  });

  it('should update selector value even without active subscribers', () => {
    const source = chunk({ count: 0 });
    const doubled = select(source, state => state.count * 2);

    expect(doubled.get()).toBe(0);

    source.set({ count: 5 });
    expect(doubled.get()).toBe(10);

    source.set({ count: 10 });
    expect(doubled.get()).toBe(20);
  });

  it('should handle null values', () => {
    const source = chunk<{ user: string | null }>({ user: 'John' });
    const userSelector = select(source, state => state.user);

    expect(userSelector.get()).toBe('John');

    source.set({ user: null });
    expect(userSelector.get()).toBeNull();

    source.set({ user: 'Jane' });
    expect(userSelector.get()).toBe('Jane');
  });

  it('should handle array transformations', () => {
    const source = chunk({ items: [1, 2, 3, 4, 5] });
    const evens = select(source, state => state.items.filter(n => n % 2 === 0));

    expect(evens.get()).toEqual([2, 4]);

    source.set({ items: [1, 2, 3, 4, 5, 6] });
    expect(evens.get()).toEqual([2, 4, 6]);
  });

  it('should work with multiple independent selectors on the same source', () => {
    const source = chunk({ name: 'John', age: 25 });
    const nameSelector = select(source, user => user.name);
    const ageSelector = select(source, user => user.age);

    const nameSpy = vi.fn();
    const ageSpy = vi.fn();

    nameSelector.subscribe(nameSpy);
    ageSelector.subscribe(ageSpy);

    source.set({ name: 'John', age: 26 });
    expect(nameSpy).not.toHaveBeenCalled();
    expect(ageSpy).toHaveBeenCalledWith(26);

    source.set({ name: 'Jane', age: 26 });
    expect(nameSpy).toHaveBeenCalledWith('Jane');
    expect(ageSpy).toHaveBeenCalledTimes(1); // no change to age
  });

  it('should properly clean up source subscription on destroy', () => {
    const source = chunk({ name: 'John', age: 25 });
    const nameSelector = select(source, user => user.name);

    const subscriber = vi.fn();
    const unsubscribe = nameSelector.subscribe(subscriber);

    unsubscribe();
    nameSelector.destroy();
    source.set({ name: 'Jane', age: 25 });

    expect(subscriber).not.toHaveBeenCalled();
  });

  it('should unsubscribe from source when destroyed even with active subscribers', () => {
    const source = chunk({ name: 'John' });
    const nameSelector = select(source, user => user.name);

    const callback = vi.fn();
    nameSelector.subscribe(callback);

    nameSelector.destroy();
    source.set({ name: 'Alice' });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should support peek() for non-reactive reads', () => {
    const source = chunk({ name: 'John', age: 25 });
    const nameSelector = select(source, user => user.name);

    expect(nameSelector.peek()).toBe('John');

    source.set({ name: 'Jane', age: 25 });
    expect(nameSelector.peek()).toBe('Jane');
  });


  describe('select — useShallowEqual', () => {
    it('should not notify when selected object has same values (shallow equal)', () => {
      const source = chunk({ name: 'John', details: { age: 25, city: 'Lagos' } });
      const detailsSelector = select(source, user => user.details, { useShallowEqual: true });

      const callback = vi.fn();
      detailsSelector.subscribe(callback);

      source.set({ name: 'John', details: { age: 25, city: 'Lagos' } }); // new object, same values

      expect(callback).not.toHaveBeenCalled();
    });

    it('should notify when selected object is new with same values (without shallow equal)', () => {
      const source = chunk({ name: 'John', details: { age: 25, city: 'Lagos' } });
      const detailsSelector = select(source, user => user.details);

      const callback = vi.fn();
      detailsSelector.subscribe(callback);

      source.set({ name: 'John', details: { age: 25, city: 'Lagos' } });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle primitives with shallow equal option', () => {
      const source = chunk({ value: 5 });
      const valueSelector = select(source, state => state.value, { useShallowEqual: true });

      const callback = vi.fn();
      valueSelector.subscribe(callback);

      source.set({ value: 5 }); // same value
      expect(callback).not.toHaveBeenCalled();

      source.set({ value: 10 });
      expect(callback).toHaveBeenCalledWith(10);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });


  describe('select — derive and chaining', () => {
    it('should support derive() on a selector', () => {
      const source = chunk({ user: { profile: { name: 'John' } } });
      const profileSelector = select(source, data => data.user.profile);
      const nameSelector = profileSelector.derive(profile => profile.name);

      expect(nameSelector.get()).toBe('John');

      source.set({ user: { profile: { name: 'Alice' } } });
      expect(nameSelector.get()).toBe('Alice');
    });

    it('should pass options to nested selectors via derive', () => {
      const source = chunk({
        user: { profile: { details: { age: 30, city: 'New York' } } }
      });

      const profileSelector = select(source, data => data.user.profile, { useShallowEqual: true });
      const detailsSelector = profileSelector.derive(profile => profile.details);

      const callback = vi.fn();
      detailsSelector.subscribe(callback);

      source.set({
        user: { profile: { details: { age: 30, city: 'New York' } } }
      });

      expect(callback).not.toHaveBeenCalled(); // shallow equal prevents notification
    });

    it('should support multiple levels of selection chaining', () => {
      const source = chunk({
        app: { user: { profile: { name: 'John', email: 'john@example.com' } } }
      });

      const userSelector = select(source, state => state.app.user);
      const profileSelector = select(userSelector, user => user.profile);
      const nameSelector = select(profileSelector, profile => profile.name);

      expect(nameSelector.get()).toBe('John');

      source.set({
        app: { user: { profile: { name: 'Jane', email: 'jane@example.com' } } }
      });

      expect(nameSelector.get()).toBe('Jane');
    });
  });
});
