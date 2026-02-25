#!/usr/bin/env node
/**
 * 自动递增版本号
 * 用法: node bump-version.js [patch|minor|major]
 * 默认递增 patch 版本 (1.0.0 -> 1.0.1)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const type = process.argv[2] || 'patch';

const packagePath = join(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

const version = packageJson.version || '1.0.0';
const [major, minor, patch] = version.split('.').map(Number);

let newVersion;
switch (type) {
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'patch':
  default:
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
}

packageJson.version = newVersion;
writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`📦 版本号已更新: ${version} → ${newVersion}`);
