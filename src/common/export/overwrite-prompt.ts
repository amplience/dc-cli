import DataPresenter from '../../view/data-presenter';
import readline from 'readline';

export const promptToOverwriteExports = (updatedExportsMap: { [key: string]: string }[]): Promise<boolean> => {
  return new Promise((resolve): void => {
    process.stdout.write('The following files will be overwritten:');
    // display updatedExportsMap as a table of uri x filename
    new DataPresenter(updatedExportsMap).render();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Do you want to continue (y/n)?: ', answer => {
      rl.close();
      return resolve(answer === 'y');
    });
  });
};
