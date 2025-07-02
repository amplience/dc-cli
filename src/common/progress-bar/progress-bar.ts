import cliProgress from 'cli-progress';

export const createProgressBar = ({ title = 'Progress' }) => {
  return new cliProgress.SingleBar({
    format: `${title} | {bar} | {percentage}% || {value}/{total}`
  });
};

export const progressBar = (total: number, start: number, { title = 'Progress' }) => {
  const progress = createProgressBar({ title });
  progress.start(total, start);

  return progress;
};
