// Engine constants (read by calendar.js from S2). Editable config.
export const ENV_MULTIPLIER = { outdoor: 1.0, greenhouse: 0.8, indoor: 1.3, controlled: 1.0 };
export const STAGE_FACTOR = {
  seedling: 1.2, planted: 1.0, growing: 1.0, vegetative: 1.0, harvested: 1.0,
  budding: 0.9, flowering: 0.9, fruiting: 0.8, dormant: 3.0, done: 1.0
};
export const SEASON_MODIFIER = { summer: 0.85, spring: 1.0, autumn: 1.0, winter: 1.3 };
export const SEASONAL_ENVIRONMENTS = ['outdoor', 'greenhouse'];
export const PEST_BOOST_DAYS = 14;
export const LEARN = {
  minInformative: 5, minFactor: 0.4, maxFactor: 3, window: 5, blendOld: 0.6, blendNew: 0.4, confidenceN: 8
};

// Learning rule constants (spec 4.2). Editable.
export const RULE = {
  dryLate: 1.1, wetEarly: 0.9,
  impliedDry: 0.85, impliedOk: 1.05, impliedWet: 1.3,
  blendDry: 0.5, blendOk: 0.3,
  recheckFraction: 0.3
};
// Other tasks (spec 4.6, 5.3, 4.9). Fertilizing interval = category days × FERT_STAGE_FACTOR[stage] ?? 1.
export const FERT_STAGE_FACTOR = {};
export const FOLLOWUP_DAYS = 3;
export const LOOKAHEAD_DAYS = 3;
export const EVAL_REMINDER_DAYS = [14, 44, 74];
export const EVAL_REVIEW_DAYS = 90;
