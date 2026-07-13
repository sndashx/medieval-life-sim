/**
 * Social.js — back-compat re-exports.
 *
 * The classes previously defined here have been split into per-domain
 * modules (Relationships.js, Household.js, Kinship.js, Economy.js) per
 * the T3.3 module-boundary cleanup. This file remains so legacy imports
 * `from '../systems/Social.js'` keep working.
 */

export { Relationships } from './Relationships.js';
export { Household } from './Household.js';
export { Kinship } from './Kinship.js';
export { Economy } from './Economy.js';