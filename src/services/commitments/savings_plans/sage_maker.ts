import {
  type CommitmentsFilters,
  getSageMakerSavingsPlans,
  type SavingsPlansResponse,
} from '../../../lib/api/commitments.js';

export function listSageMakerSavingsPlans(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<SavingsPlansResponse> {
  return getSageMakerSavingsPlans(token, organizationId, filters);
}
