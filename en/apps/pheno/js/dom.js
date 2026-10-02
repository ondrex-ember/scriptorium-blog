// Tiny DOM helpers. Text goes in via textContent, never innerHTML, so user input cannot inject markup.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.setAttribute('style', v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && typeof v !== 'string' || k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function icon(name, cls = '') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', `ui-icon ${cls}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

export function clear(el) { el.replaceChildren(); return el; }

/** Append children, skipping null/false (native append would print "null"). */
export function put(el, ...children) {
  el.append(...children.flat(Infinity).filter((c) => c != null && c !== false));
  return el;
}

export function field(label, input, hint) {
  return h('div', { class: 'field' }, h('label', {}, label), input, hint ? h('div', { class: 'field-hint' }, hint) : null);
}

/** Single-choice chip group. Returns {el, get(), set(v)}. */
export function chipGroup(options, value, onChange) {
  let cur = value;
  const el = h('div', { class: 'chip-group', role: 'radiogroup' });
  const btns = options.map(([v, label]) => h('button', {
    type: 'button', class: 'chip' + (v === cur ? ' selected' : ''), dataset: { value: v },
    onclick: () => { set(v); onChange?.(v); }
  }, label));
  el.append(...btns);
  function set(v) {
    cur = v;
    btns.forEach((b) => b.classList.toggle('selected', b.dataset.value === String(v)));
  }
  return { el, get: () => cur, set };
}
