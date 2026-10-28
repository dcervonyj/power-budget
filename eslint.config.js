// @ts-check
// Root ESLint config: the shared base (eslint.base.js) plus the per-package style ratchet (CLN-062).
// Package-local configs (backend, core) spread eslint.base.js and add their own ratchet blocks.
const baseConfig = require('./eslint.base.js');
const { ratchetBlocks } = require('./eslint.ratchet.js');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [...baseConfig, ...ratchetBlocks(__dirname)];
