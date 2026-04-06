import type { Account, Organization } from './api/index.js';

interface SubAccountSummary {
  total: number;
  granted: number;
  byStatus: {
    granted: Account[];
    denied: Account[];
    suspended: Account[];
    closed: Account[];
  };
}

export function summarizeSubAccounts(organization: Organization): SubAccountSummary {
  // Filter by internal ID (not AWS account number)
  const managementAccountId = organization.managementAccount.id;
  const subAccounts = organization.accounts.filter((account) => account.id !== managementAccountId);
  const byStatus = {
    granted: subAccounts.filter((account) => account.access === 'granted'),
    denied: subAccounts.filter((account) => account.access === 'denied'),
    suspended: subAccounts.filter((account) => account.access === 'suspended'),
    closed: subAccounts.filter((account) => account.access === 'closed'),
  };

  return {
    total: subAccounts.length,
    granted: byStatus.granted.length,
    byStatus,
  };
}
