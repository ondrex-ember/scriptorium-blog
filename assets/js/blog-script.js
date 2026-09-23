/**
 * blog-script.js — Script block widget for Scriptorium Blog
 *
 * Features:
 *   • Loads script content from an external file (data-src) or uses inline HTML
 *   • Prism.js syntax highlighting (works gracefully if Prism isn't loaded)
 *   • Copy to clipboard with fallback for older browsers
 *   • Collapse / expand toggle
 *   • Auto line-count in meta bar
 *
 * HTML usage:
 *   <div class="script-block" data-src="/assets/scripts/my-script.js" data-lang="javascript">
 *     <div class="script-block-header">
 *       <span class="script-block-name">Název skriptu</span>
 *       <div class="script-block-actions">
 *         <button class="script-btn" data-action="copy">Kopírovat</button>
 *         <button class="script-btn" data-action="toggle">Rozbalit</button>
 *       </div>
 *     </div>
 *     <div class="script-block-code collapsed">
 *       <pre><code class="language-javascript"></code></pre>
 *     </div>
 *     <p class="script-block-meta">načítám…</p>
 *   </div>
 *
 * Load order in HTML (before </body>):
 *   1. prism.min.js (from cdnjs)
 *   2. prism-javascript.min.js
 *   3. THIS FILE (blog-script.js)
 */

(function () {
  'use strict';

  /* ── clipboard helper ── */
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // Legacy fallback
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy') ? resolve() : reject(new Error('execCommand failed'));
      } catch (e) {
        reject(e);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  /* ── Prism highlight helper (no-op if Prism not loaded) ── */
  function highlight(el) {
    if (window.Prism && typeof Prism.highlightElement === 'function') {
      Prism.highlightElement(el);
    }
  }

  /* ── count non-empty trailing lines ── */
  function countLines(text) {
    return text.trim().split('\n').length;
  }

  /* ── format language label for display ── */
  function langLabel(lang) {
    var map = { javascript: 'JavaScript', js: 'JavaScript', css: 'CSS', html: 'HTML', python: 'Python' };
    return map[lang.toLowerCase()] || lang;
  }

  /* ── wire up copy button ── */
  function setupCopy(btn, getText) {
    btn.addEventListener('click', function () {
      copyToClipboard(getText())
        .then(function () {
          btn.textContent = 'Zkopírováno ✓';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = 'Kopírovat';
            btn.classList.remove('copied');
          }, 2400);
        })
        .catch(function () {
          btn.textContent = 'Chyba ✗';
          setTimeout(function () {
            btn.textContent = 'Kopírovat';
          }, 2000);
        });
    });
  }

  /* ── wire up collapse/expand toggle ── */
  function setupToggle(btn, codeWrap) {
    var collapsed = codeWrap.classList.contains('collapsed');

    function sync() {
      btn.textContent = collapsed ? 'Rozbalit' : 'Sbalit';
    }

    sync();

    btn.addEventListener('click', function () {
      collapsed = !collapsed;
      codeWrap.classList.toggle('collapsed', collapsed);
      sync();
    });
  }

  /* ── initialise one .script-block element ── */
  function initBlock(block) {
    var codeWrap  = block.querySelector('.script-block-code');
    var codeEl    = block.querySelector('code');
    var meta      = block.querySelector('.script-block-meta');
    var copyBtn   = block.querySelector('[data-action="copy"]');
    var toggleBtn = block.querySelector('[data-action="toggle"]');
    var src       = block.dataset.src;
    var lang      = block.dataset.lang || 'javascript';

    if (!codeWrap || !codeEl) return;

    if (toggleBtn) setupToggle(toggleBtn, codeWrap);

    /* called once the raw script text is available */
    function onText(text) {
      codeEl.textContent = text;          // auto-escapes < > & — safe
      codeEl.className = 'language-' + lang;
      highlight(codeEl);

      if (meta) {
        meta.textContent = countLines(text) + ' řádků · ' + langLabel(lang);
      }
      if (copyBtn) {
        setupCopy(copyBtn, function () { return text; });
      }
    }

    if (src) {
      /* fetch external script file */
      fetch(src)
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(onText)
        .catch(function (err) {
          codeEl.textContent = 'Skript se nepodařilo načíst. (' + err.message + ')';
          if (meta) meta.textContent = 'Chyba';
        });
    } else {
      /* content already inlined in HTML */
      var inlineText = codeEl.textContent;
      if (inlineText.trim()) onText(inlineText);
    }
  }

  /* ── boot ── */
  function init() {
    document.querySelectorAll('.script-block').forEach(initBlock);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
