import { type CommitmentsFilters, type Ec2CommitmentsResponse, getEc2Commitments } from '../../lib/api/commitments.js';

export function listEc2Commitments(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<Ec2CommitmentsResponse> {
  return getEc2Commitments(token, organizationId, filters);
}
