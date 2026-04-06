import { apiFetch } from './client.js';

export type OnboardingStatus = 'complete' | 'in_progress' | 'pending';
export type AccessStatus = 'granted' | 'denied' | 'suspended' | 'closed';

export interface Account {
  id: string;
  accountId: string;
  nickname: string;
  access: AccessStatus;
}

interface StackInfo {
  name: string;
  version: string;
}

interface OrganizationStacks {
  managementStack?: StackInfo | null;
  stackset?: StackInfo | null;
}

export interface OrganizationListing {
  id: string;
  name: string;
  onboarding: OnboardingStatus;
  managementAccount: Account;
}

interface OrganizationCreate extends OrganizationListing {
  externalId: string;
  roleName: string;
}

export interface Organization extends OrganizationCreate {
  rootId?: string | null;
  accounts: Account[];
  stacks: OrganizationStacks;
}

interface RawAccount {
  id: string;
  account_id: string;
  nickname: string;
  access: AccessStatus;
}

interface RawOrganizationStacks {
  management_stack?: StackInfo | null;
  stackset?: StackInfo | null;
}

interface RawOrganizationListing {
  id: string;
  name: string;
  onboarding: OnboardingStatus;
  management_account: RawAccount;
}

interface RawOrganizationCreate extends RawOrganizationListing {
  external_id: string;
  role_name: string;
}

interface RawOrganization extends RawOrganizationCreate {
  root_id?: string | null;
  accounts: RawAccount[];
  stacks: RawOrganizationStacks;
}

function normalizeAccount(account: RawAccount): Account {
  return {
    id: account.id,
    accountId: account.account_id,
    nickname: account.nickname,
    access: account.access,
  };
}

function normalizeStacks(stacks?: RawOrganizationStacks | null): OrganizationStacks {
  return {
    managementStack: stacks?.management_stack ?? null,
    stackset: stacks?.stackset ?? null,
  };
}

function normalizeOrganizationListing(organization: RawOrganizationListing): OrganizationListing {
  return {
    id: organization.id,
    name: organization.name,
    onboarding: organization.onboarding,
    managementAccount: normalizeAccount(organization.management_account),
  };
}

function normalizeOrganizationCreate(organization: RawOrganizationCreate): OrganizationCreate {
  return {
    ...normalizeOrganizationListing(organization),
    externalId: organization.external_id,
    roleName: organization.role_name,
  };
}

function normalizeOrganization(organization: RawOrganization): Organization {
  return {
    ...normalizeOrganizationCreate(organization),
    rootId: organization.root_id,
    accounts: organization.accounts.map(normalizeAccount),
    stacks: normalizeStacks(organization.stacks),
  };
}

export async function listOrganizations(token: string): Promise<OrganizationListing[]> {
  const response = await apiFetch('/api/organizations', {}, token);
  const organizationsResponse = await response.json<{ organizations: RawOrganizationListing[] }>();
  return organizationsResponse.organizations.map(normalizeOrganizationListing);
}

export async function getOrganization(token: string, organizationId: string): Promise<Organization> {
  const response = await apiFetch(`/api/organizations/${organizationId}`, {}, token);
  const organizationResponse = await response.json<{ organization: RawOrganization }>();
  return normalizeOrganization(organizationResponse.organization);
}

export async function createOrganization(
  token: string,
  name: string,
  managementAccountId: string,
): Promise<OrganizationCreate> {
  const response = await apiFetch(
    '/api/organizations',
    {
      method: 'POST',
      body: {
        organization: { name, main_account_id: managementAccountId },
      },
    },
    token,
  );
  const organizationResponse = await response.json<{ organization: RawOrganizationCreate }>();
  return normalizeOrganizationCreate(organizationResponse.organization);
}

export async function verifyManagementAccount(token: string, organizationId: string): Promise<Organization> {
  const response = await apiFetch(`/api/organizations/${organizationId}/management_account`, { method: 'POST' }, token);
  const organizationResponse = await response.json<{ organization: RawOrganization }>();
  return normalizeOrganization(organizationResponse.organization);
}

export async function verifyAccounts(token: string, organizationId: string): Promise<Organization> {
  const response = await apiFetch(`/api/organizations/${organizationId}/accounts`, { method: 'POST' }, token);
  const organizationResponse = await response.json<{ organization: RawOrganization }>();
  return normalizeOrganization(organizationResponse.organization);
}

export async function reportStacksUpdated(token: string, organizationId: string): Promise<void> {
  await apiFetch(`/api/organizations/${organizationId}/stacks`, { method: 'PATCH' }, token);
}
