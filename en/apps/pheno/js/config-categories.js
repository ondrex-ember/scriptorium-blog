// Category defaults (editable config). Method-neutral.
export const CYCLE_STAGES = {
  herb: ['seedling', 'vegetative', 'flowering', 'harvested', 'done'],
  vegetable: ['seedling', 'vegetative', 'flowering', 'fruiting', 'harvested', 'done'],
  fruit: ['planted', 'growing', 'flowering', 'fruiting', 'harvested', 'done'],
  tree_shrub: ['planted', 'growing', 'flowering', 'fruiting', 'harvested', 'done'],
  flower: ['seedling', 'vegetative', 'budding', 'flowering', 'done'],
  houseplant: ['growing', 'done'],
  other: ['growing', 'harvested', 'done']
};
export const PERENNIAL_STAGES = ['planted', 'growing', 'flowering', 'fruiting', 'dormant'];
export const STAGE_FLAGS = { done: { terminal: true }, harvested: { postHarvest: true }, dormant: { dormant: true } };

const num = (key, min = 0) => ({ key, type: 'number', min });

export const CATEGORIES = {
  herb: {
    lifecycle: 'cycle', harvestable: true, fertilizingDays: 14, pestCheckDays: 7, baseDryingDays: 3,
    harvestFields: [num('freshWeight'), num('processedWeight')],
    criteria: ['aroma', 'flavor', 'usability']
  },
  vegetable: {
    lifecycle: 'cycle', harvestable: true, fertilizingDays: 10, pestCheckDays: 5, baseDryingDays: 2,
    harvestFields: [num('totalWeight'), num('pieceCount'), num('avgSize')],
    criteria: ['taste', 'texture', 'yieldSatisfaction']
  },
  fruit: {
    lifecycle: 'cycle', harvestable: true, fertilizingDays: 21, pestCheckDays: 7, baseDryingDays: 3,
    harvestFields: [num('totalWeight'), num('pieceCount'), num('brix')],
    criteria: ['sweetness', 'juiciness', 'appearance']
  },
  flower: {
    lifecycle: 'cycle', harvestable: true, fertilizingDays: 14, pestCheckDays: 10, baseDryingDays: 3,
    harvestFields: [num('bloomCount'), num('bloomDurationDays'), num('totalWeight')],
    criteria: ['appearance', 'fragrance', 'bloomDuration']
  },
  tree_shrub: {
    lifecycle: 'perennial', harvestable: true, fertilizingDays: 30, pestCheckDays: 14, baseDryingDays: 5,
    harvestFields: [num('totalWeight'), num('pieceCount')],
    criteria: ['taste', 'appearance']
  },
  houseplant: {
    lifecycle: 'perennial', harvestable: false, fertilizingDays: 30, pestCheckDays: 14, baseDryingDays: 7,
    harvestFields: [],
    criteria: ['growth', 'health', 'appearance']
  },
  other: {
    lifecycle: 'cycle', harvestable: false, fertilizingDays: 14, pestCheckDays: 7, baseDryingDays: 3,
    harvestFields: [num('quantity')],
    criteria: []
  }
};

/** Icon per category (custom categories add their own entry). */
export const CATEGORY_ICON = { herb: 'leaf', vegetable: 'sprout', fruit: 'pot', flower: 'sun', tree_shrub: 'leaf', houseplant: 'sprout', other: 'pot' };
export const CATEGORY_ICON_CHOICES = ['leaf', 'sprout', 'pot', 'sun'];

export const ENVIRONMENTS = ['outdoor', 'greenhouse', 'indoor', 'controlled'];
export const SOURCES = ['seed', 'cutting', 'seedling', 'other'];
export const PROBLEM_TYPES = ['pest', 'mold', 'wilting', 'nutrient', 'other'];
export const PROCESSING_METHODS = ['drying', 'curing', 'fermenting', 'pickling', 'freezing', 'storing', 'none', 'other'];
/** Batch phases a user can move a batch to: the processing phases, then ready / used / discarded. */
export const PROCESSING_PHASES = ['drying', 'curing', 'fermenting', 'pickling', 'freezing', 'storing', 'other'];
export const BATCH_PHASES = [...PROCESSING_PHASES, 'ready', 'used', 'discarded'];
export const BATCH_ENDED = ['used', 'discarded'];
/** Categories whose harvest is eaten fresh: they get storage and "use by" handling, not drying. */
export const FRESH_CATEGORIES = ['vegetable', 'fruit', 'tree_shrub'];
export const DRYNESS_MAX = 5;
export const CARE_KINDS = ['pruning', 'repotting', 'misting', 'rotation', 'cleaning', 'custom'];
export const EVAL_KINDS = ['tasting', 'final'];
export const MOISTURE_ANSWERS = ['dry', 'ok', 'wet'];
export const RATING_MAX = 5;

export function getStages(category, lifecycle) {
  if (lifecycle === 'perennial') return PERENNIAL_STAGES;
  return CYCLE_STAGES[category] || CYCLE_STAGES.other;
}
