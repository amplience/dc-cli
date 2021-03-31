import { ApiResource } from '../api/model/ApiResource';

export class StringList extends ApiResource {
  private data?: string[];
  private content?: string[];
  private count: number;

  public getItems(): string[] {
    return (this.data || this.content) as string[];
  }
}
