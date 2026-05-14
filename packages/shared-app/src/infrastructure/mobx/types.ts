export interface ReactiveView<S extends object> {
  readonly state: S;
  update(partial: Partial<S>): void;
}
