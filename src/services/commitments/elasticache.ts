import {
  type CommitmentsFilters,
  type ElasticacheCommitmentsResponse,
  getElasticacheCommitments,
} from '../../lib/api/commitments.js';

export function listElasticacheCommitments(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<ElasticacheCommitmentsResponse> {
  return getElasticacheCommitments(token, organizationId, filters);
}
