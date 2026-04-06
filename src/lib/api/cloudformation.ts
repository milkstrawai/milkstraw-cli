import { apiFetch } from './client.js';

export interface CloudFormationTemplate {
  name: string;
  url: string;
  version: string;
}

export interface CloudFormationTemplates {
  templates: {
    management: CloudFormationTemplate;
    stackset: CloudFormationTemplate;
  };
  milkstrawAccountId: string;
}

interface RawCloudFormationTemplates {
  templates: {
    management: CloudFormationTemplate;
    stackset: CloudFormationTemplate;
  };
  milkstraw_account_id: string;
}

export async function getCloudFormationTemplates(): Promise<CloudFormationTemplates> {
  const response = await apiFetch('/api/cloudformation/templates');
  const rawTemplates = await response.json<RawCloudFormationTemplates>();

  return {
    templates: rawTemplates.templates,
    milkstrawAccountId: rawTemplates.milkstraw_account_id,
  };
}
