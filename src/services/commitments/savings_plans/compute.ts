import {
  type CommitmentsFilters,
  getComputeSavingsPlans,
  type SavingsPlansResponse,
} from '../../../lib/api/commitments.js';

export function listComputeSavingsPlans(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<SavingsPlansResponse> {
  return getComputeSavingsPlans(token, organizationId, filters);
}
