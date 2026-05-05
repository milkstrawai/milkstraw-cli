import {
  type CommitmentsFilters,
  getOpensearchCommitments,
  type OpensearchCommitmentsResponse,
} from '../../lib/api/commitments.js';

export function listOpensearchCommitments(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<OpensearchCommitmentsResponse> {
  return getOpensearchCommitments(token, organizationId, filters);
}
