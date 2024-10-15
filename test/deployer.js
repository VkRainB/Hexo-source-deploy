'use strict';

const should = require('chai').should(); // eslint-disable-line
const pathFn = require('path');
const util = require('hexo-util');
const fs = require('hexo-fs');
const { stub, assert: sinonAssert } = require('sinon');
const Promise = require('bluebird');
const spawn = util.spawn;
const { underline } = require('picocolors');

describe('deployer', () => {
  const baseDir = pathFn.join(__dirname, 'deployer_test');
  const publicDir = pathFn.join(baseDir, 'public');
  const fakeRemote = pathFn.join(baseDir, 'remote');
  const validateDir = pathFn.join(baseDir, 'validate');
  const extendDir = pathFn.join(baseDir, 'extend');

  const ctx = {
    base_dir: baseDir,
    public_dir: publicDir,
    log: {
      info: () => {}
    }
  };

  const deployer = require('../lib/deployer').bind(ctx);

  before(() => {
    return fs.writeFile(pathFn.join(publicDir, 'foo.txt'), 'foo');
  });

  beforeEach(() => {
    // Create a bare repo as a fake remote repo
    return fs.mkdirs(fakeRemote).then(() => {
      return spawn('git', ['init', '--bare', fakeRemote]);
    });
  });

  after(() => {
    return fs.rmdir(baseDir);
  });

  afterEach(() => {
    return fs.rmdir(fakeRemote).then(() => {
      return fs.rmdir(validateDir);
    });
  });

  function validate(branch) {
    branch = branch || 'master';

    // Clone the remote repo
    return spawn('git', ['clone', fakeRemote, validateDir, '--branch', branch]).then(() => {
      // Check the branch name
      return fs.readFile(pathFn.join(validateDir, '.git', 'HEAD'));
    }).then(content => {
      content.trim().should.eql('ref: refs/heads/' + branch);

      // Check files
      return fs.readFile(pathFn.join(validateDir, 'foo.txt'));
    }).then(content => {
      content.should.eql('foo');
    });
  }

  // it('default', () => {
  //   return deployer({
  //     repo: fakeRemote,
  //     silent: true
  //   }).then(() => {
  //     return validate();
  //   });
  // });



  it.skip('custom message', () => {
    return deployer({
      repo: fakeRemote,
      message: 'custom message',
      silent: true
    }).then(() => {
      return validate();
    }).then(() => {
      return spawn('git', ['log', '-1', '--pretty=format:%s'], {cwd: validateDir});
    }).then(content => {
      content.should.eql('custom message');
    });
  });


  // 测试用例：在没有仓库和存储库的情况下
  it('without repo and repository', () => {
    fs.mkdirSync(validateDir);
    const logStub = stub(console, 'log');
    process.env.HEXO_DEPLOYER_REPO = '';
    deployer({});
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
    sinonAssert.calledWithMatch(logStub, help);
    logStub.restore();
  });
});
