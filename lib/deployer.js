'use strict';

const pathFn = require('path');
const fs = require('hexo-fs');
const { underline } = require('picocolors');
const nunjucks = require('nunjucks');
const { DateTime } = require('luxon');
const Promise = require('bluebird');
const { spawn } = require('hexo-util');
const parseConfig = require('./parse_config');

const swigHelpers = {
  now: function(format) {
    return DateTime.now().toFormat(format);
  }
};

module.exports = function(args) {
  const baseDir = this.base_dir;
  // const deployDir = pathFn.join(baseDir, '.deploy_git');
  const gitDir = pathFn.join(baseDir, '.git');
  // const publicDir = this.public_dir;
  // 使用源码目录
  // const sourceDir = baseDir;
  // let extendDirs = args.extend_dirs;
  // const ignoreHidden = args.ignore_hidden;
  // const ignorePattern = args.ignore_pattern;
  const log = this.log;
  const message = commitMessage(args);
  const verbose = !args.silent;

  if (!args.repo && process.env.HEXO_DEPLOYER_REPO) {
    args.repo = process.env.HEXO_DEPLOYER_REPO;
  }

  if (!args.repo && !args.repository) {
    let help = '';

    help += 'You have to configure the deployment settings in _config.yml first!\n\n';
    help += 'Example:\n';
    help += '  deploy:\n';
    help += '    type: git\n';
    help += '    repo: <repository url>\n';
    help += '    branch: [branch]\n';
    help += '    message: [message]\n\n';
    help += '    extend_dirs: [extend directory]\n\n';
    help += 'For more help, you can check the docs: ' + underline('https://hexo.io/docs/deployment.html');

    console.log(help);
    return;
  }

  function git(...args) {
    return spawn('git', args, {
      cwd: baseDir,
      verbose: verbose,
      stdio: 'inherit'
    });
  }

  async function setNameEmail() {
    const userName = args.name || args.user || args.userName || '';
    const userEmail = args.email || args.userEmail || '';

    userName && await git('config', 'user.name', userName);
    userEmail && await git('config', 'user.email', userEmail);
  }

  async function setup() {
    // Create a placeholder for the first commit
    // await fs.writeFile(pathFn.join(deployDir, 'placeholder'), '');
    await git('init');
    await setNameEmail();
    // await git('add', '-A');
    // await git('commit', '-m', 'First commit');
  }

  async function push(repo) {
    await setNameEmail();
    await git('add', '-A');
    await git('commit', '-m', message).catch(() => {
      // Do nothing. It's OK if nothing to commit.
    });
    await git('push', '-u', repo.url, 'HEAD:' + repo.branch);
  }

  return fs.exists(gitDir).then(exist => {
    if (exist) return;

    log.info('Setting up Git deployment...');
    return setup();
  }).then(() => {
    log.info('fetching origin...');
    // 尝试更新
    return git('fetch', 'origin');
  }).then(() => {
    return parseConfig(args);
  }).each(repo => {
    return push(repo);
  });
};

function commitMessage(args) {
  const message = args.m || args.msg || args.message || 'Auto Commit by Site updated: {{ now("yyyy-MM-dd HH:mm:ss") }}';
  return nunjucks.renderString(message, swigHelpers);
}
