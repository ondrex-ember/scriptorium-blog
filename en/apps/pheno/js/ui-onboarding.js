// First-start profile question (spec 6.1). Skip and "a bit of everything" are equal: profile = mixed.
import { ctx } from './ctx.js';
import { clear, h, put } from './dom.js';
import { PROFILE_KEYS, setProfile } from './profile.js';
import { navigate } from './router.js';
import { S } from './strings.cs.js';
import { importSheet } from './ui-settings.js';

export async function renderOnboarding(root) {
  const choose = async (key) => { await setProfile(ctx.db, key, 'onboarding'); navigate('/'); };
  put(clear(root),
    h('div', { class: 'top-bar' }, h('h1', {}, S.profile.question)),
    h('p', { class: 'muted' }, S.profile.intro),
    h('div', { class: 'stack onboarding-options', id: 'onboarding' },
      PROFILE_KEYS.map((k) => h('button', { type: 'button', class: 'btn btn-secondary option-btn', dataset: { profile: k }, onclick: () => choose(k) }, S.profile[k]))),
    h('div', { class: 'form-actions onboarding-skip' },
      h('button', { type: 'button', class: 'btn btn-secondary', id: 'onboarding-skip', onclick: () => choose('mixed') }, S.profile.skip)),
    h('button', { type: 'button', class: 'btn btn-ghost', id: 'onboarding-restore', onclick: () => importSheet(() => navigate('/')) }, S.profile.restore));
}
