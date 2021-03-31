import { ApiResource } from '../api/model/ApiResource';

export interface SystemSettings {
  'auth-api-url': string;
  'publishing-service': string;
  'im-api-url': string;
  'virtual-staging-service': string;
  'dam-mixpanel-token': string;
  'analytics-beacon-url': string;
  'analytics-query-api-url': string;
  'dam-version': string;
  'stream-api-url': string;
  'ca-mixpanel-token': string;
  'access-service': string;
  'cms-api-url': string;
  'provisioning-api': string;
  'identity-service': string;
  'media-graphics-host': string;
}

export interface DiSettingsEndpoint {
  path: string;
  staticHost: string;
  textProtocols: string[];
  schemaIds: string[];
  dynamicHost: string;
  id: string;
  staticProtocols: string[];
  serviceId: string;
  textHost: string;
  dynamicProtocols: string[];
}

export interface DiSettings {
  endpoints: DiSettingsEndpoint[];
  defaultEndpoint: string;
  enabled: boolean;
}

export class Settings extends ApiResource {
  companyId: string;
  companyClassificationType: string;
  system: SystemSettings;
  di: DiSettings;
}
