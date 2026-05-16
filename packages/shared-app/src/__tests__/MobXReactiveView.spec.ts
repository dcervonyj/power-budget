import { describe, it, expect } from 'vitest';
import { MobXReactiveView } from '../infrastructure/mobx/MobXReactiveView.js';

describe('MobXReactiveView', () => {
  it('initialises state from constructor argument', () => {
    const view = new MobXReactiveView({ count: 0, name: 'test' });
    expect(view.state.count).toBe(0);
    expect(view.state.name).toBe('test');
  });

  it('update() merges partial state into existing state', () => {
    const view = new MobXReactiveView({ count: 0, name: 'before' });
    view.update({ name: 'after' });
    expect(view.state.name).toBe('after');
    expect(view.state.count).toBe(0);
  });

  it('update() replaces the changed property only', () => {
    const view = new MobXReactiveView({ x: 1, y: 2, z: 3 });
    view.update({ y: 99 });
    expect(view.state.x).toBe(1);
    expect(view.state.y).toBe(99);
    expect(view.state.z).toBe(3);
  });

  it('multiple updates accumulate correctly', () => {
    const view = new MobXReactiveView({ value: 0 });
    view.update({ value: 10 });
    view.update({ value: 20 });
    expect(view.state.value).toBe(20);
  });
});
