import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import type {
  CategoryDto,
  HouseholdDashboardCategoryDto,
  HouseholdInviteResponseDto,
  HouseholdMemberResponseDto,
} from '@power-budget/shared-app/contract';
import { AcceptInviteView } from '../../screens/app/AcceptInviteView.js';
import { CategoriesView, type CategoriesViewProps } from '../../screens/app/CategoriesView.js';
import { AuthLayoutView } from '../../shell/AuthLayoutView.js';
import { AmbientField } from '../../glass/material/AmbientField.js';
import { HouseholdAggregatesCardView } from './HouseholdAggregatesCardView.js';
import type { HouseholdAggregatesCardViewProps } from './HouseholdAggregatesCardView.js';
import { HouseholdCategoryDrillInView } from './HouseholdCategoryDrillInView.js';
import { HouseholdMembersCardView } from './HouseholdMembersCardView.js';
import type { HouseholdMembersCardViewProps } from './HouseholdMembersCardView.js';
import { HouseholdPage } from './HouseholdPage.js';

/** Sample data of the D7 spec: Anna and Marek, October 2026. */
const STAGE: React.CSSProperties = {
  position: 'relative',
  isolation: 'isolate',
  margin: 'calc(-1 * var(--pb-glass-space-3xl))',
  minHeight: 600,
  overflow: 'hidden',
  color: 'var(--pb-glass-fg)',
};

const LAYER: React.CSSProperties = { position: 'relative', zIndex: 1 };

function noop(): void {
  // Gallery fixtures do not react to input.
}

async function noopInvite(): Promise<boolean> {
  return false;
}

function category(
  id: string,
  name: string,
  icon: string,
  overrides: Partial<CategoryDto> = {},
): CategoryDto {
  return {
    id,
    name,
    kind: 'expense',
    icon,
    color: '#000000',
    isSystem: false,
    seedKey: null,
    privacy: 'full_detail',
    archived: false,
    archivedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const CATEGORIES: readonly CategoryDto[] = [
  category('c-rent', 'Rent', 'home', { isSystem: true, seedKey: 'expense.rent' }),
  category('c-food', 'Groceries', 'cart', { privacy: 'total_only' }),
  category('c-out', 'Eating out', 'utensils', { privacy: 'total_with_counts' }),
  category('c-transport', 'Transport', 'car'),
  category('c-health', 'Health', 'heart', { privacy: 'total_only' }),
  category('c-subs', 'Subscriptions', 'repeat', {
    archived: true,
    archivedAt: '2026-10-01T00:00:00.000Z',
  }),
  category('c-salary', 'Salary', 'wallet', { kind: 'income', privacy: 'total_only' }),
];

function categoriesProps(overrides: Partial<CategoriesViewProps> = {}): CategoriesViewProps {
  return {
    categories: CATEGORIES,
    loading: false,
    loadFailed: false,
    actionError: null,
    adding: false,
    onRetry: noop,
    onUpdate: noop,
    onAdd: noopInvite,
    ...overrides,
  };
}

const ANNA: HouseholdMemberResponseDto = {
  userId: 'user-anna',
  email: 'anna@example.com',
  displayName: 'Anna Kowalska',
  role: 'owner',
  joinedAt: '2026-09-01T10:00:00.000Z',
};

const MAREK: HouseholdMemberResponseDto = {
  userId: 'user-marek',
  email: 'marek@example.com',
  displayName: 'Marek Nowak',
  role: 'member',
  joinedAt: '2026-09-20T10:00:00.000Z',
};

function invite(status: HouseholdInviteResponseDto['status']): HouseholdInviteResponseDto {
  return {
    id: 'invite-1',
    email: 'marek@example.com',
    status,
    expiresAt: status === 'expired' ? '2026-10-14T12:00:00.000Z' : '2026-10-29T12:00:00.000Z',
    createdAt: '2026-10-22T12:00:00.000Z',
  };
}

function membersProps(
  overrides: Partial<HouseholdMembersCardViewProps> = {},
): HouseholdMembersCardViewProps {
  return {
    members: [ANNA, MAREK],
    invites: [],
    userId: 'user-anna',
    isOwner: true,
    canInvite: false,
    inviteBusy: false,
    inviteError: null,
    inviteNotice: null,
    onInvite: noopInvite,
    onResend: noop,
    onRevoke: noop,
    ...overrides,
  };
}

function line(
  id: string,
  name: string,
  privacyLevel: HouseholdDashboardCategoryDto['privacyLevel'],
  totalAmountMinor: string,
  transactionCount: number,
): HouseholdDashboardCategoryDto {
  return {
    categoryId: id,
    categoryName: name,
    privacyLevel,
    totalAmountMinor,
    currency: 'PLN',
    transactionCount,
  };
}

const AGGREGATES: readonly HouseholdDashboardCategoryDto[] = [
  line('c-rent', 'Rent', 'full_detail', '340000', 1),
  line('c-food', 'Groceries', 'total_only', '114864', 24),
  line('c-out', 'Eating out', 'total_with_counts', '56250', 9),
  line('c-transport', 'Transport', 'full_detail', '31239', 6),
];

function aggregatesProps(
  overrides: Partial<HouseholdAggregatesCardViewProps> = {},
): HouseholdAggregatesCardViewProps {
  return {
    plans: [{ id: 'plan-oct', name: 'October' }],
    selectedPlanId: 'plan-oct',
    categories: AGGREGATES,
    loading: false,
    error: null,
    onSelectPlan: noop,
    ...overrides,
  };
}

function Stage({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <MemoryRouter>
      <div style={STAGE}>
        <AmbientField />
        <div style={LAYER}>{children}</div>
      </div>
    </MemoryRouter>
  );
}

function Auth({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <MemoryRouter>
      <div style={{ margin: 'calc(-1 * var(--pb-glass-space-3xl))' }}>
        <AuthLayoutView language={<span />}>{children}</AuthLayoutView>
      </div>
    </MemoryRouter>
  );
}

/** Icon tiles, names, kind and privacy in words; one built-in, one archived. */
export function CategoriesList(): React.JSX.Element {
  return (
    <Stage>
      <CategoriesView {...categoriesProps()} />
    </Stage>
  );
}

export function CategoriesEmpty(): React.JSX.Element {
  return (
    <Stage>
      <CategoriesView {...categoriesProps({ categories: [] })} />
    </Stage>
  );
}

export function CategoriesLoading(): React.JSX.Element {
  return (
    <Stage>
      <CategoriesView {...categoriesProps({ categories: [], loading: true })} />
    </Stage>
  );
}

export function CategoriesLoadError(): React.JSX.Element {
  return (
    <Stage>
      <CategoriesView {...categoriesProps({ categories: [], loadFailed: true })} />
    </Stage>
  );
}

export function CategoriesNameTaken(): React.JSX.Element {
  return (
    <Stage>
      <CategoriesView {...categoriesProps({ actionError: 'nameTaken' })} />
    </Stage>
  );
}

/** Two members and the shared totals: Groceries is totals-only for the partner. */
export function HouseholdOverview(): React.JSX.Element {
  return (
    <Stage>
      <HouseholdPage>
        <HouseholdMembersCardView {...membersProps()} />
        <HouseholdAggregatesCardView {...aggregatesProps()} />
      </HouseholdPage>
    </Stage>
  );
}

/** Owner without a partner yet: the open invite with resend and revoke, and the invite form. */
export function HouseholdMembersInvited(): React.JSX.Element {
  return (
    <Stage>
      <HouseholdPage>
        <HouseholdMembersCardView
          {...membersProps({
            members: [ANNA],
            invites: [invite('pending')],
            canInvite: true,
            inviteNotice: 'sent',
          })}
        />
      </HouseholdPage>
    </Stage>
  );
}

export function HouseholdMembersInviteExpired(): React.JSX.Element {
  return (
    <Stage>
      <HouseholdPage>
        <HouseholdMembersCardView
          {...membersProps({
            members: [ANNA],
            invites: [invite('expired')],
            canInvite: true,
            inviteError: 'too_many_requests',
          })}
        />
      </HouseholdPage>
    </Stage>
  );
}

/** The partner's view: only the owner can invite. */
export function HouseholdMembersAlone(): React.JSX.Element {
  return (
    <Stage>
      <HouseholdPage>
        <HouseholdMembersCardView
          {...membersProps({ members: [MAREK], userId: 'user-marek', isOwner: false })}
        />
      </HouseholdPage>
    </Stage>
  );
}

export function HouseholdAggregatesNoPlan(): React.JSX.Element {
  return (
    <Stage>
      <HouseholdPage>
        <HouseholdAggregatesCardView
          {...aggregatesProps({ plans: [], selectedPlanId: null, categories: [] })}
        />
      </HouseholdPage>
    </Stage>
  );
}

export function HouseholdAggregatesTwoPlans(): React.JSX.Element {
  return (
    <Stage>
      <HouseholdPage>
        <HouseholdAggregatesCardView
          {...aggregatesProps({
            plans: [
              { id: 'plan-oct', name: 'October' },
              { id: 'plan-nov', name: 'November' },
            ],
          })}
        />
      </HouseholdPage>
    </Stage>
  );
}

export function HouseholdAggregatesLoading(): React.JSX.Element {
  return (
    <Stage>
      <HouseholdPage>
        <HouseholdAggregatesCardView {...aggregatesProps({ loading: true })} />
      </HouseholdPage>
    </Stage>
  );
}

export function HouseholdAggregatesFxError(): React.JSX.Element {
  return (
    <Stage>
      <HouseholdPage>
        <HouseholdAggregatesCardView {...aggregatesProps({ error: 'fx_unavailable' })} />
      </HouseholdPage>
    </Stage>
  );
}

export function HouseholdAggregatesEmpty(): React.JSX.Element {
  return (
    <Stage>
      <HouseholdPage>
        <HouseholdAggregatesCardView {...aggregatesProps({ categories: [] })} />
      </HouseholdPage>
    </Stage>
  );
}

/** Category drill-in at the three privacy levels. */
export function CategoryDrillInFullDetail(): React.JSX.Element {
  return (
    <Stage>
      <HouseholdPage backLink>
        <HouseholdCategoryDrillInView
          loading={false}
          error={null}
          category={line('c-rent', 'Rent', 'full_detail', '340000', 1)}
        />
      </HouseholdPage>
    </Stage>
  );
}

export function CategoryDrillInTotalWithCounts(): React.JSX.Element {
  return (
    <Stage>
      <HouseholdPage backLink>
        <HouseholdCategoryDrillInView
          loading={false}
          error={null}
          category={line('c-out', 'Eating out', 'total_with_counts', '56250', 9)}
        />
      </HouseholdPage>
    </Stage>
  );
}

export function CategoryDrillInTotalOnly(): React.JSX.Element {
  return (
    <Stage>
      <HouseholdPage backLink>
        <HouseholdCategoryDrillInView
          loading={false}
          error={null}
          category={line('c-food', 'Groceries', 'total_only', '114864', 24)}
        />
      </HouseholdPage>
    </Stage>
  );
}

export function CategoryDrillInNotFound(): React.JSX.Element {
  return (
    <Stage>
      <HouseholdPage backLink>
        <HouseholdCategoryDrillInView loading={false} error="not_found" category={null} />
      </HouseholdPage>
    </Stage>
  );
}

/** The invite page inside the auth card. */
export function AcceptInvite(): React.JSX.Element {
  return (
    <Auth>
      <AcceptInviteView error={null} busy={false} canAccept onAccept={noop} />
    </Auth>
  );
}

export function AcceptInviteEmailMismatch(): React.JSX.Element {
  return (
    <Auth>
      <AcceptInviteView error="email_mismatch" busy={false} canAccept onAccept={noop} />
    </Auth>
  );
}

export function AcceptInviteMissingToken(): React.JSX.Element {
  return (
    <Auth>
      <AcceptInviteView error="missing_token" busy={false} canAccept={false} onAccept={noop} />
    </Auth>
  );
}
