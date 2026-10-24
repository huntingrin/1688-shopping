import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const read = (rel) => readFileSync(join(root, rel), 'utf8');

const frontmatter = (text) => {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
};

const markdownFiles = () => {
  const files = ['SKILL.md', 'README.md'];
  for (const name of readdirSync(join(root, 'references'))) {
    if (name.endsWith('.md')) files.push(join('references', name));
  }
  return files;
};

test('SKILL.md 有合法的 frontmatter 且 name 与目录一致', () => {
  const meta = frontmatter(read('SKILL.md'));
  assert.ok(meta, 'SKILL.md 缺少 frontmatter');
  assert.equal(meta.name, '1688-shopping');
  assert.ok(meta.description && meta.description.length > 20, 'description 太短或缺失');
  assert.ok(!/\n/.test(meta.description), 'description 应为单行');
});

test('技能版本与 package.json 一致', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '2.1.0');
  assert.match(read('SKILL.md'), /version:\s*"2\.1\.0"/, 'SKILL.md 的 metadata.version 与 package.json 不一致');
});

test('技能声明的参考文档都存在', () => {
  for (const rel of [
    'references/catalog.md',
    'references/browser-verification.md',
    'references/installation.md',
    'references/ordering.md',
    'references/dom-recipes.md',
    'references/sizing.md',
    'scripts/catalog.mjs',
    'agents/openai.yaml',
  ]) {
    assert.ok(existsSync(join(root, rel)), `缺少 ${rel}`);
  }
});

test('所有相对链接指向真实文件', () => {
  const broken = [];
  for (const file of markdownFiles()) {
    const text = read(file);
    const base = dirname(join(root, file));
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = m[1].trim().split('#')[0];
      if (!target || /^(https?:|mailto:|#)/.test(target)) continue;
      if (!existsSync(resolve(base, target))) broken.push(`${file} -> ${target}`);
    }
  }
  assert.deepEqual(broken, [], `失效链接:\n${broken.join('\n')}`);
});

test('授权与支付边界写在入口文档里', () => {
  const skill = read('SKILL.md');
  assert.match(skill, /授权/, 'SKILL.md 未说明下单需要授权');
  assert.match(skill, /停[在到].{0,4}收银台|停在收银台/, 'SKILL.md 未写明停在收银台');
  assert.match(skill, /支付由用户本人完成/, 'SKILL.md 未写明支付由用户完成');
});

test('下单文档覆盖已知坑', () => {
  const ordering = read('references/ordering.md');
  const recipes = read('references/dom-recipes.md');
  assert.match(ordering, /先采后付/, '未记录收银台默认先采后付');
  assert.match(ordering, /未付款/, '未要求声明未付款');
  assert.match(recipes, /东城区|区县/, '未记录地址自动识别会错区县');
  assert.match(recipes, /q-button/, '未记录下单按钮是 q-button');
  assert.match(recipes, /expand-view-item/, '未记录规格价格矩阵的读取方式');
});
