#!/usr/bin/env node
/**
 * generate_dynamic_icons.js
 * CLI runner for dynamic folder icon generation using pure Node.js.
 * 
 * Run from project root:
 *     npm run generate:icons
 *     node scripts/generate/generate_dynamic_icons.js
 */

const path = require('path');
const { generateDynamicIcons } = require('../../app/lang/icons/dynamicFolderIcons');

const ROOT = path.join(__dirname, '..', '..');
generateDynamicIcons(ROOT);
