import { HalResource, Page, Pageable, Sortable } from 'dc-management-sdk-js';
import { ResourceStatus } from './resource-status';
import paginator from './paginator';
import { createProgressBar } from '../progress-bar/progress-bar';

interface ProgressOptions {
  title: string;
}

export const paginateWithProgress = async <T extends HalResource>(
  pagableFn: (options?: Pageable & Sortable & ResourceStatus) => Promise<Page<T>>,
  options: Pageable & Sortable & ResourceStatus = {},
  progressOptions: ProgressOptions
) => {
  const progress = createProgressBar({ title: progressOptions.title });
  const results = await paginator(
    pagableFn,
    {
      ...options
    },
    {
      onPage: <T extends HalResource>(page: Page<T>) => {
        if (!progress.isActive) {
          progress.start(page.page?.totalElements || 0, 0);
        }
        progress.increment(page.getItems().length);
      }
    }
  );

  progress.stop();

  return results;
};
