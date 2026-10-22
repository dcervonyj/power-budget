import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Provider } from '@nestjs/common';
import type { HouseholdId, UserId } from '@power-budget/core';
import type { EncryptedString } from '@power-budget/core';
import type {
  HouseholdRepository,
  TotpSecretRepository,
  TotpStepUpStore,
} from '../../../domain/auth/ports.js';
import type { Household, HouseholdMembership, TotpSecret } from '../../../domain/auth/entities.js';
import { RedisTotpStepUpStore } from '../../../infrastructure/auth/RedisTotpStepUpStore.js';
import { DrizzleTotpSecretRepository } from '../../../infrastructure/auth/DrizzleTotpSecretRepository.js';
import { HouseholdsController } from '../HouseholdsController.js';
import { CreateHouseholdUseCase } from '../../../application/auth/use-cases/CreateHouseholdUseCase.js';
import { InviteToHouseholdUseCase } from '../../../application/auth/use-cases/InviteToHouseholdUseCase.js';
import { AcceptInviteUseCase } from '../../../application/auth/use-cases/AcceptInviteUseCase.js';
import { ExportHouseholdDataUseCase } from '../../../application/auth/use-cases/ExportHouseholdDataUseCase.js';
import { GetHouseholdExportStatusUseCase } from '../../../application/auth/use-cases/GetHouseholdExportStatusUseCase.js';
import { DeleteHouseholdUseCase } from '../../../application/auth/use-cases/DeleteHouseholdUseCase.js';
import { ResendHouseholdInviteUseCase } from '../../../application/auth/use-cases/ResendHouseholdInviteUseCase.js';
import { RevokeHouseholdInviteUseCase } from '../../../application/auth/use-cases/RevokeHouseholdInviteUseCase.js';
import { ListHouseholdInvitesUseCase } from '../../../application/auth/use-cases/ListHouseholdInvitesUseCase.js';
import { ListHouseholdMembersUseCase } from '../../../application/auth/use-cases/ListHouseholdMembersUseCase.js';
import type { HouseholdInviteView } from '../../../application/auth/use-cases/HouseholdInviteView.js';
import { AUTH_THROTTLERS } from '../throttling.js';
import {
  EmailMismatchError,
  HouseholdFullError,
  HouseholdNotEmptyError,
  HouseholdNotFoundError,
  HouseholdOwnerRequiredError,
  InviteExpiredError,
  InviteNotFoundError,
} from '../../../domain/auth/errors.js';
import {
  bearerFor,
  createHttpTestApp,
  type HttpTestApp,
} from '../../../test/http/createHttpTestApp.js';

const ALICE = '01900000-0000-7000-8000-00000000000a' as UserId;
const ALICE_HOUSEHOLD = '01900000-0000-7000-8000-0000000000a1' as HouseholdId;
const BOB_HOUSEHOLD = '01900000-0000-7000-8000-0000000000b1' as HouseholdId;

const INVITE_ID = '01900000-0000-7000-8000-0000000000c1';

interface InviteUseCaseMocks {
  readonly invite: ReturnType<typeof mock<InviteToHouseholdUseCase>>;
  readonly accept: ReturnType<typeof mock<AcceptInviteUseCase>>;
  readonly resend: ReturnType<typeof mock<ResendHouseholdInviteUseCase>>;
  readonly revoke: ReturnType<typeof mock<RevokeHouseholdInviteUseCase>>;
  readonly list: ReturnType<typeof mock<ListHouseholdInvitesUseCase>>;
  readonly members: ReturnType<typeof mock<ListHouseholdMembersUseCase>>;
}

function makeInviteMocks(): InviteUseCaseMocks {
  return {
    invite: mock<InviteToHouseholdUseCase>(),
    accept: mock<AcceptInviteUseCase>(),
    resend: mock<ResendHouseholdInviteUseCase>(),
    revoke: mock<RevokeHouseholdInviteUseCase>(),
    list: mock<ListHouseholdInvitesUseCase>(),
    members: mock<ListHouseholdMembersUseCase>(),
  };
}

function inviteProviders(mocks: InviteUseCaseMocks): Provider[] {
  return [
    { provide: InviteToHouseholdUseCase, useValue: mocks.invite },
    { provide: AcceptInviteUseCase, useValue: mocks.accept },
    { provide: ResendHouseholdInviteUseCase, useValue: mocks.resend },
    { provide: RevokeHouseholdInviteUseCase, useValue: mocks.revoke },
    { provide: ListHouseholdInvitesUseCase, useValue: mocks.list },
    { provide: ListHouseholdMembersUseCase, useValue: mocks.members },
  ];
}

function makeHousehold(id: HouseholdId): Household {
  return { id, name: 'household', baseCurrency: 'PLN', createdAt: new Date() };
}

function makeTotpSecret(): TotpSecret {
  return {
    userId: ALICE,
    encryptedSecret: 'env-v1:aes-256-gcm:iv:ct:tag' as EncryptedString,
    enrolledAt: new Date(),
    verifiedAt: new Date(),
    lastUsedTimeStep: 1,
  };
}

function makeMembership(role: 'owner' | 'member'): HouseholdMembership {
  return { householdId: ALICE_HOUSEHOLD, userId: ALICE, role, joinedAt: new Date() };
}

describe('DELETE /households/:id (HTTP)', () => {
  let app: HttpTestApp;
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;
  let stepUpStore: ReturnType<typeof mock<TotpStepUpStore>>;
  let totpSecretRepo: ReturnType<typeof mock<TotpSecretRepository>>;

  beforeEach(async () => {
    householdRepo = mock<HouseholdRepository>();
    stepUpStore = mock<TotpStepUpStore>();
    stepUpStore.isRecent.mockResolvedValue(true);
    totpSecretRepo = mock<TotpSecretRepository>();
    totpSecretRepo.findByUser.mockResolvedValue(makeTotpSecret());
    householdRepo.findById.mockImplementation(async (id: HouseholdId) => makeHousehold(id));
    householdRepo.scheduleDelete.mockResolvedValue(undefined);
    app = await createHttpTestApp({
      controllers: [HouseholdsController],
      providers: [
        { provide: CreateHouseholdUseCase, useValue: mock<CreateHouseholdUseCase>() },
        ...inviteProviders(makeInviteMocks()),
        { provide: ExportHouseholdDataUseCase, useValue: mock<ExportHouseholdDataUseCase>() },
        {
          provide: GetHouseholdExportStatusUseCase,
          useValue: mock<GetHouseholdExportStatusUseCase>(),
        },
        { provide: DeleteHouseholdUseCase, useValue: new DeleteHouseholdUseCase(householdRepo) },
        { provide: RedisTotpStepUpStore, useValue: stepUpStore },
        { provide: DrizzleTotpSecretRepository, useValue: totpSecretRepo },
      ],
      imports: [ThrottlerModule.forRoot({ throttlers: [...AUTH_THROTTLERS] })],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 404 and schedules nothing for a household the caller does not belong to', async () => {
    householdRepo.findMembership.mockResolvedValue(null);

    const res = await app.inject({
      method: 'DELETE',
      url: `/households/${BOB_HOUSEHOLD}`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(404);
    expect(householdRepo.scheduleDelete).not.toHaveBeenCalled();
  });

  it('returns 403 when a non-owner member deletes their own household', async () => {
    householdRepo.findMembership.mockResolvedValue(makeMembership('member'));

    const res = await app.inject({
      method: 'DELETE',
      url: `/households/${ALICE_HOUSEHOLD}`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(403);
    expect(householdRepo.scheduleDelete).not.toHaveBeenCalled();
  });

  it('returns 202 and schedules deletion when the owner deletes their own household', async () => {
    householdRepo.findMembership.mockResolvedValue(makeMembership('owner'));

    const res = await app.inject({
      method: 'DELETE',
      url: `/households/${ALICE_HOUSEHOLD}`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(202);
    expect(householdRepo.findMembership).toHaveBeenCalledWith(ALICE_HOUSEHOLD, ALICE);
    expect(householdRepo.scheduleDelete).toHaveBeenCalledOnce();
    expect(householdRepo.scheduleDelete.mock.calls[0]?.[0]).toBe(ALICE_HOUSEHOLD);
  });

  it('returns 403 requires_totp and schedules nothing without a recent TOTP step-up', async () => {
    householdRepo.findMembership.mockResolvedValue(makeMembership('owner'));
    stepUpStore.isRecent.mockResolvedValue(false);

    const res = await app.inject({
      method: 'DELETE',
      url: `/households/${ALICE_HOUSEHOLD}`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'requires_totp' });
    expect(stepUpStore.isRecent).toHaveBeenCalledWith(ALICE);
    expect(householdRepo.scheduleDelete).not.toHaveBeenCalled();
  });

  it('returns 403 requires_totp_enrollment for an owner without TOTP', async () => {
    householdRepo.findMembership.mockResolvedValue(makeMembership('owner'));
    stepUpStore.isRecent.mockResolvedValue(false);
    totpSecretRepo.findByUser.mockResolvedValue(null);

    const res = await app.inject({
      method: 'DELETE',
      url: `/households/${ALICE_HOUSEHOLD}`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'requires_totp_enrollment' });
    expect(householdRepo.scheduleDelete).not.toHaveBeenCalled();
  });
});

describe('GET /households/export/status (HTTP)', () => {
  let app: HttpTestApp;
  let statusUseCase: ReturnType<typeof mock<GetHouseholdExportStatusUseCase>>;

  beforeEach(async () => {
    statusUseCase = mock<GetHouseholdExportStatusUseCase>();
    app = await createHttpTestApp({
      controllers: [HouseholdsController],
      providers: [
        { provide: CreateHouseholdUseCase, useValue: mock<CreateHouseholdUseCase>() },
        ...inviteProviders(makeInviteMocks()),
        { provide: ExportHouseholdDataUseCase, useValue: mock<ExportHouseholdDataUseCase>() },
        { provide: GetHouseholdExportStatusUseCase, useValue: statusUseCase },
        { provide: DeleteHouseholdUseCase, useValue: mock<DeleteHouseholdUseCase>() },
        { provide: RedisTotpStepUpStore, useValue: mock<TotpStepUpStore>() },
        { provide: DrizzleTotpSecretRepository, useValue: mock<TotpSecretRepository>() },
      ],
      imports: [ThrottlerModule.forRoot({ throttlers: [...AUTH_THROTTLERS] })],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the status and download url of the latest export', async () => {
    statusUseCase.execute.mockResolvedValue({
      status: 'ready',
      url: 'https://dl.example/x',
      expiresAt: new Date('2026-10-23T12:00:00Z'),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/households/export/status',
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'ready',
      url: 'https://dl.example/x',
      expiresAt: '2026-10-23T12:00:00.000Z',
    });
    expect(statusUseCase.execute).toHaveBeenCalledWith({ householdId: ALICE_HOUSEHOLD });
  });

  it('returns 404 when no export was requested', async () => {
    statusUseCase.execute.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/households/export/status',
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 without a household', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/households/export/status',
      headers: { authorization: bearerFor(ALICE, null) },
    });

    expect(res.statusCode).toBe(403);
    expect(statusUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 401 without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/households/export/status' });

    expect(res.statusCode).toBe(401);
  });
});

describe('household invite endpoints (HTTP)', () => {
  const VIEW: HouseholdInviteView = {
    id: INVITE_ID,
    email: 'bob@example.com',
    status: 'pending',
    expiresAt: new Date('2026-10-28T12:00:00Z'),
    createdAt: new Date('2026-10-21T12:00:00Z'),
  };
  const VIEW_JSON = {
    id: INVITE_ID,
    email: 'bob@example.com',
    status: 'pending',
    expiresAt: '2026-10-28T12:00:00.000Z',
    createdAt: '2026-10-21T12:00:00.000Z',
  };
  let app: HttpTestApp;
  let mocks: InviteUseCaseMocks;

  beforeEach(async () => {
    mocks = makeInviteMocks();
    app = await createHttpTestApp({
      controllers: [HouseholdsController],
      providers: [
        { provide: CreateHouseholdUseCase, useValue: mock<CreateHouseholdUseCase>() },
        ...inviteProviders(mocks),
        { provide: ExportHouseholdDataUseCase, useValue: mock<ExportHouseholdDataUseCase>() },
        {
          provide: GetHouseholdExportStatusUseCase,
          useValue: mock<GetHouseholdExportStatusUseCase>(),
        },
        { provide: DeleteHouseholdUseCase, useValue: mock<DeleteHouseholdUseCase>() },
        { provide: RedisTotpStepUpStore, useValue: mock<TotpStepUpStore>() },
        { provide: DrizzleTotpSecretRepository, useValue: mock<TotpSecretRepository>() },
      ],
      imports: [ThrottlerModule.forRoot({ throttlers: [...AUTH_THROTTLERS] })],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /households/invites returns 201 with the invite and no token', async () => {
    mocks.invite.execute.mockResolvedValue(VIEW);

    const res = await app.inject({
      method: 'POST',
      url: '/households/invites',
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
      payload: { email: 'bob@example.com' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual(VIEW_JSON);
    expect(mocks.invite.execute).toHaveBeenCalledWith({
      inviterUserId: ALICE,
      inviteeEmail: 'bob@example.com',
      householdId: ALICE_HOUSEHOLD,
    });
  });

  it('POST /households/invites answers 403 household_owner_required without a household', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/households/invites',
      headers: { authorization: bearerFor(ALICE, null) },
      payload: { email: 'bob@example.com' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'household_owner_required' });
    expect(mocks.invite.execute).not.toHaveBeenCalled();
  });

  it.each([
    [new HouseholdOwnerRequiredError(), 403, 'household_owner_required'],
    [new HouseholdFullError(), 409, 'household_full'],
  ])('POST /households/invites maps %s', async (error, status, code) => {
    mocks.invite.execute.mockRejectedValue(error);

    const res = await app.inject({
      method: 'POST',
      url: '/households/invites',
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
      payload: { email: 'bob@example.com' },
    });

    expect(res.statusCode).toBe(status);
    expect(res.json()).toMatchObject({ code });
  });

  it('GET /households/invites lists the open invites', async () => {
    mocks.list.execute.mockResolvedValue([VIEW]);

    const res = await app.inject({
      method: 'GET',
      url: '/households/invites',
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([VIEW_JSON]);
    expect(mocks.list.execute).toHaveBeenCalledWith({
      userId: ALICE,
      householdId: ALICE_HOUSEHOLD,
    });
  });

  it('GET /households/members lists the members with their role', async () => {
    mocks.members.execute.mockResolvedValue([
      {
        userId: ALICE,
        email: 'alice@example.com',
        displayName: 'Alice',
        role: 'owner',
        joinedAt: new Date('2026-10-01T10:00:00Z'),
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/households/members',
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      {
        userId: ALICE,
        email: 'alice@example.com',
        displayName: 'Alice',
        role: 'owner',
        joinedAt: '2026-10-01T10:00:00.000Z',
      },
    ]);
    expect(mocks.members.execute).toHaveBeenCalledWith({
      userId: ALICE,
      householdId: ALICE_HOUSEHOLD,
    });
  });

  it('GET /households/members answers 404 household_not_found for a non-member', async () => {
    mocks.members.execute.mockRejectedValue(new HouseholdNotFoundError());

    const res = await app.inject({
      method: 'GET',
      url: '/households/members',
      headers: { authorization: bearerFor(ALICE, BOB_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'household_not_found' });
  });

  it('POST /households/invites/accept returns the joined household and a new access token', async () => {
    mocks.accept.execute.mockResolvedValue({ householdId: BOB_HOUSEHOLD, accessToken: 'jwt' });

    const res = await app.inject({
      method: 'POST',
      url: '/households/invites/accept',
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
      payload: { token: 'raw-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ householdId: BOB_HOUSEHOLD, accessToken: 'jwt' });
    expect(mocks.accept.execute).toHaveBeenCalledWith({
      token: 'raw-token',
      acceptingUserId: ALICE,
    });
  });

  it.each([
    [new InviteNotFoundError(), 404, 'invite_not_found'],
    [new InviteExpiredError(), 410, 'invite_expired'],
    [new EmailMismatchError(), 403, 'email_mismatch'],
    [new HouseholdNotEmptyError(), 409, 'household_not_empty'],
  ])('POST /households/invites/accept maps %s', async (error, status, code) => {
    mocks.accept.execute.mockRejectedValue(error);

    const res = await app.inject({
      method: 'POST',
      url: '/households/invites/accept',
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
      payload: { token: 'raw-token' },
    });

    expect(res.statusCode).toBe(status);
    expect(res.json()).toMatchObject({ code });
  });

  it('POST /households/invites/:id/resend returns the rotated invite', async () => {
    mocks.resend.execute.mockResolvedValue(VIEW);

    const res = await app.inject({
      method: 'POST',
      url: `/households/invites/${INVITE_ID}/resend`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(VIEW_JSON);
    expect(mocks.resend.execute).toHaveBeenCalledWith({
      userId: ALICE,
      householdId: ALICE_HOUSEHOLD,
      inviteId: INVITE_ID,
    });
  });

  it('DELETE /households/invites/:id revokes and answers 204', async () => {
    mocks.revoke.execute.mockResolvedValue(undefined);

    const res = await app.inject({
      method: 'DELETE',
      url: `/households/invites/${INVITE_ID}`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(204);
    expect(mocks.revoke.execute).toHaveBeenCalledWith({
      userId: ALICE,
      householdId: ALICE_HOUSEHOLD,
      inviteId: INVITE_ID,
    });
  });

  it('DELETE /households/invites/:id answers 400 for an id that is not a uuid', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/households/invites/not-a-uuid',
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(400);
    expect(mocks.revoke.execute).not.toHaveBeenCalled();
  });
});
