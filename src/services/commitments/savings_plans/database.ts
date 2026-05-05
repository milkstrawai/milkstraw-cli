import {
  type CommitmentsFilters,
  getDatabaseSavingsPlans,
  type SavingsPlansResponse,
} from '../../../lib/api/commitments.js';

export function listDatabaseSavingsPlans(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<SavingsPlansResponse> {
  return getDatabaseSavingsPlans(token, organizationId, filters);
}
