import { makeAutoObservable } from 'mobx';
import type { ReactiveView } from './types.js';

export class MobXReactiveView<S extends object> implements ReactiveView<S> {
  private _state: S;

  constructor(initialState: S) {
    this._state = initialState;
    makeAutoObservable(this);
  }

  get state(): S {
    return this._state;
  }

  update(partial: Partial<S>): void {
    Object.assign(this._state, partial);
  }
}
