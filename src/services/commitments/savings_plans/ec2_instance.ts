import {
  type CommitmentsFilters,
  getEc2InstanceSavingsPlans,
  type SavingsPlansResponse,
} from '../../../lib/api/commitments.js';

export function listEc2InstanceSavingsPlans(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<SavingsPlansResponse> {
  return getEc2InstanceSavingsPlans(token, organizationId, filters);
}
