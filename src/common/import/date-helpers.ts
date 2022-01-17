export interface TimeRange {
  start?: string;
  end?: string;
}

export const dateOffset = (seconds: number): Date => {
  const date = new Date();
  date.setSeconds(date.getSeconds() + seconds);

  return date;
};

export const dateMax = (date1: Date, date2: Date): Date => {
  return date1 > date2 ? date1 : date2;
};

export const dateMin = (date1: Date, date2: Date): Date => {
  return date1 <= date2 ? date1 : date2;
};

export const sortByEndDate = <Type extends TimeRange>(ranges: Type[]): Type[] => {
  return ranges.sort((a, b) => new Date(a.end as string).getTime() - new Date(b.end as string).getTime());
};
