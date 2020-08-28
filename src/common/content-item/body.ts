// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ObjectMap<T = Record<string, any>, K = any> = T & {
  [key: string]: K;
};

export type Body<T = {}> = ObjectMap<
  T & {
    _meta: ContentMeta;
  }
>;

interface ContentMeta {
  name: string;
  schema: string;
  deliveryKey?: string;
}
