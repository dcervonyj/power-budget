// Shared prop types for web and mobile components

import type { SupportedLocale } from '@power-budget/core';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export type DesignLocale = SupportedLocale;

export type InputState = 'default' | 'error' | 'disabled';

export interface SelectOption<T = string> {
  readonly value: T;
  readonly label: string;
}

export type GlassMaterial = 'frosted' | 'clear' | 'tinted';
export type GlassDepth = 0 | 1 | 2;
export type StatusKind = 'ok' | 'over' | 'neutral';
export type SyncState = 'synced' | 'syncing' | 'error' | 'offline';
export type IconName =
  | 'add'
  | 'arrow-left'
  | 'arrow-right'
  | 'calendar'
  | 'check'
  | 'chevron-down'
  | 'clock'
  | 'close'
  | 'edit'
  | 'lock'
  | 'menu'
  | 'more'
  | 'search'
  | 'triangle'
  | 'warning';

export interface AmbientFieldProps {
  readonly showHeroGlow?: boolean;
  readonly farSlabCount?: 1 | 2;
}

export interface GlassPanelProps {
  readonly material: GlassMaterial;
  readonly depth?: GlassDepth;
  readonly showSpecular?: boolean;
  readonly showFilm?: boolean;
  readonly sweepDelay?: string;
}

export interface DepthPanesProps {
  readonly count?: 1 | 2;
}

export interface LensData {
  readonly fraction: number;
  readonly amountLabel: string;
  readonly caption: string;
  readonly ariaLabel: string;
  readonly size: 'hero' | 'mobile' | 'mini';
}

export interface LensProps {
  readonly lens: LensData;
}

export interface RodData {
  readonly fraction: number;
  readonly paceProgress?: number;
  readonly state: 'under' | 'over' | 'paid' | 'empty';
  readonly ariaLabel: string;
  readonly size: 'pace' | 'category';
}

export interface RodProps {
  readonly rod: RodData;
}

export interface TubeData {
  readonly fraction: number;
  readonly ariaLabel: string;
}

export interface TubeProps {
  readonly tube: TubeData;
}

export interface IconProps {
  readonly name: IconName;
  readonly label?: string;
  readonly size?: number;
}

export interface AmountTextProps {
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly locale: DesignLocale;
  readonly size?: 'display' | 'hero' | 'figure' | 'amount';
}

export interface StatusTagProps {
  readonly kind: StatusKind;
  readonly label: string;
  readonly icon: IconName;
}

export interface SyncChipProps {
  readonly state: SyncState;
  readonly label: string;
  readonly onPress?: () => void;
}

export interface AvatarData {
  readonly id: string;
  readonly name: string;
  readonly imageUrl?: string;
}

export interface AvatarPairProps {
  readonly primary: AvatarData;
  readonly secondary?: AvatarData;
  readonly onPress?: () => void;
}

export interface TxRowData {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly status: 'pending' | 'booked' | 'transfer' | 'to-sort';
  readonly categoryLabel?: string;
  readonly payer?: string;
  readonly originalAmountMinor?: bigint;
  readonly originalCurrency?: string;
  readonly suggestionLabel?: string;
  readonly suggestionConfidence?: number;
}

export interface TxRowProps {
  readonly transaction: TxRowData;
  readonly locale: AmountTextProps['locale'];
  readonly onPress?: (id: string) => void;
  readonly onConfirmSuggestion?: (id: string) => void;
  readonly onUndoSuggestion?: (id: string) => void;
  readonly onChooseCategory?: (id: string) => void;
}

export interface CategoryRowData {
  readonly id: string;
  readonly label: string;
  readonly spentMinor: bigint;
  readonly plannedMinor: bigint;
  readonly currency: string;
  readonly status: StatusKind;
  readonly paid: boolean;
  readonly totalOnly?: boolean;
  readonly forecastMinor?: bigint;
}

export interface CategoryRowProps {
  readonly category: CategoryRowData;
  readonly locale: AmountTextProps['locale'];
  readonly onPress?: (id: string) => void;
}

export interface FilterChip<T extends string = string> {
  readonly value: T;
  readonly label: string;
  readonly count?: number;
}

export interface FilterChipsProps<T extends string = string> {
  readonly options: readonly FilterChip<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly ariaLabel: string;
}

export interface SwitchProps {
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}

export interface StepperProps {
  readonly value: bigint;
  readonly step: bigint;
  readonly min?: bigint;
  readonly max?: bigint;
  readonly label: string;
  readonly onChange: (value: bigint) => void;
}

export interface KeypadProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit?: () => void;
  readonly submitLabel: string;
}

export interface SheetProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
}

export interface PrimaryButtonProps {
  readonly label: string;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly icon?: IconName;
  readonly onPress: () => void;
}

export interface CountBadgeProps {
  readonly count: number;
  readonly ariaLabel: string;
}
