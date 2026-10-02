// Install guidance (spec 7.x): iOS Share → Add to Home Screen; Chromium install prompt.
import { clear, h, icon, put } from './dom.js';
import { canPromptInstall, isStandalone, onInstallChange, platform, promptInstall } from './pwa.js';
import { navigate } from './router.js';
import { S } from './strings.cs.js';

const steps = (list) => h('ol', { class: 'install-steps' }, list.map((t) => h('li', {}, t)));

export async function renderInstall(root) {
  const { ios } = platform();
  const build = () => {
    const btn = h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-install', disabled: !canPromptInstall(),
      onclick: async () => { await promptInstall(); build(); } }, S.install.btn);
    put(clear(root),
      h('div', { class: 'top-bar' },
        h('button', { type: 'button', class: 'btn btn-ghost', 'aria-label': S.ui.back, onclick: () => navigate('/settings') }, icon('back')),
        h('h1', {}, S.install.title)),
      h('p', { class: 'muted' }, S.install.intro),
      isStandalone() ? h('div', { class: 'banner', id: 'install-done' }, S.install.done) : null,
      h('div', { class: 'card pad', id: 'install-ios' }, h('h3', {}, S.install.iosTitle), steps(S.install.ios)),
      h('div', { class: 'card pad', id: 'install-chrome' }, h('h3', {}, S.install.chromeTitle), steps(S.install.chrome),
        ios ? null : btn, !ios && !canPromptInstall() ? h('p', { class: 'muted' }, S.install.unavailable) : null));
  };
  build();
  onInstallChange(build);
}
