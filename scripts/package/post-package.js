const { existsSync, copyFileSync, unlinkSync } = require('fs');
const { resolve } = require('path');

// Temporarily patch Axios package.json to fix issue when used in conjuction with `@yao-pkg/pkg`
// Relates to: https://github.com/yao-pkg/pkg/issues/16 & https://github.com/yao-pkg/pkg/pull/33
const axiosPkgPath = resolve(__dirname, '../../node_modules/axios/package.json');
const backupPath = `${axiosPkgPath}.bak`;

if (existsSync(backupPath)) {
  copyFileSync(backupPath, axiosPkgPath);
  unlinkSync(backupPath);
}
