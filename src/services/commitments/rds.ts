import { type CommitmentsFilters, getRdsCommitments, type RdsCommitmentsResponse } from '../../lib/api/commitments.js';

export function listRdsCommitments(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<RdsCommitmentsResponse> {
  return getRdsCommitments(token, organizationId, filters);
}
