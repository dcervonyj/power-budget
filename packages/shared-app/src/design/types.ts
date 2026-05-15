// Shared prop types for web and mobile components

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export type InputState = 'default' | 'error' | 'disabled';

export interface SelectOption<T = string> {
  readonly value: T;
  readonly label: string;
}
