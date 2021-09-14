const rmdir = require('rimraf');

function rimraf(dir) {
  return new Promise(resolve => {
    rmdir(dir, resolve);
  });
}

afterAll(async () => {
  await rimraf(`temp_${process.env.JEST_WORKER_ID}/`);
});
