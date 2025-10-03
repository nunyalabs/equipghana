// Publish script: builds and force-pushes only dist/ to a remote branch.
// Env:
//   REPO (default: nunyalabs/equipghana)
//   BRANCH (default: gh-pages)
//   GH_TOKEN (optional; if set uses HTTPS, else tries SSH)
//   GIT_USER_NAME (optional; default github-actions)
//   GIT_USER_EMAIL (optional; default actions@users.noreply.github.com)
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const os = require('os');

function sh(cmd, opts={}) {
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

async function main() {
  const root = __dirname;
  const dist = path.join(root, 'dist');
  const repo = process.env.REPO || 'nunyalabs/equipghana';
  const branch = process.env.BRANCH || 'main';
  const token = process.env.GH_TOKEN || '';
  const userName = process.env.GIT_USER_NAME || 'github-actions';
  const userEmail = process.env.GIT_USER_EMAIL || 'actions@users.noreply.github.com';

  // 1) Build
  sh('npm run build', { cwd: root });
  if (!fs.existsSync(dist)) {
    throw new Error('dist/ not found after build');
  }

  // 2) Temp dir
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'equip-dist-'));
  await fse.copy(dist, tmp);
  // Ensure GitHub Pages doesn't process with Jekyll
  fs.writeFileSync(path.join(tmp, '.nojekyll'), '');

  // If pushing to main, include workflows so CI can mirror/sync to gh-pages
  if (branch === 'main') {
    const workflowsSrc = path.join(root, '.github', 'workflows');
    const workflowsDst = path.join(tmp, '.github', 'workflows');
    if (fs.existsSync(workflowsSrc)) {
      await fse.mkdirp(workflowsDst);
      await fse.copy(workflowsSrc, workflowsDst);
    }
  }

  // 3) Init and push
  const remote = token
    ? `https://${token}@github.com/${repo}.git`
    : `git@github.com:${repo}.git`;

  sh('git init -q', { cwd: tmp });
  sh(`git config user.name "${userName}"`, { cwd: tmp });
  sh(`git config user.email "${userEmail}"`, { cwd: tmp });
  sh('git add .', { cwd: tmp });
  sh(`git commit -m "Publish dist $(date -u +%Y-%m-%dT%H:%M:%SZ)"`, { cwd: tmp, shell: '/bin/bash' });
  sh(`git branch -M ${branch}`, { cwd: tmp });
  sh(`git remote add origin ${remote}`, { cwd: tmp });
  sh(`git push -f origin ${branch}`, { cwd: tmp });

  console.log(`\nPublish complete → ${repo} (${branch}).`);
  console.log('If using GitHub Pages, set Source: gh-pages / root.');
}

main().catch(err => { console.error(err); process.exit(1); });
