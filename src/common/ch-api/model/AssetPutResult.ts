import { ApiResource } from '../api/model/ApiResource';

export interface AssetPutResult {
  id: string;
  status: string;
}

export class AssetPutResultList extends ApiResource {
  results: AssetPutResult[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public parse(data: any): void {
    this.results = data;
  }
}
