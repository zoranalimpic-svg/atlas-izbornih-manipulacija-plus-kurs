(() => {
  'use strict';

  const KEY = 'atlas-script';
  let memoryMode = 'cyrl';
  const originals = new WeakMap();
  const attributeOriginals = new WeakMap();
  const skipTags = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'SVG', 'PATH', 'NOSCRIPT']);
  const map = {
    'љ':'lj','њ':'nj','џ':'dž','ђ':'đ','ћ':'ć','ч':'č','ж':'ž','ш':'š',
    'Љ':'Lj','Њ':'Nj','Џ':'Dž','Ђ':'Đ','Ћ':'Ć','Ч':'Č','Ж':'Ž','Ш':'Š',
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','з':'z','и':'i','ј':'j','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c',
    'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','З':'Z','И':'I','Ј':'J','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'H','Ц':'C'
  };

  function safeGetMode() {
    try {
      return localStorage.getItem(KEY) || memoryMode;
    } catch (_) {
      return memoryMode;
    }
  }

  function safeSaveMode(mode) {
    memoryMode = mode;
    try {
      localStorage.setItem(KEY, mode);
    } catch (_) {
      // file:// and privacy modes may block storage; the current page still works.
    }
  }

  function latinize(value) {
    return (value || '').replace(/[А-Ша-шЉЊЏЂЋЧЖШљњџђћчжш]/g, char => map[char] || char);
  }

  function shouldSkip(element) {
    if (!element) return true;
    if (skipTags.has(element.tagName)) return true;
    return Boolean(element.closest('[data-no-translit], .script-toggle'));
  }

  function rememberText(node) {
    if (!originals.has(node)) originals.set(node, node.nodeValue || '');
  }

  function getOriginalAttribute(element, name) {
    let attrs = attributeOriginals.get(element);
    if (!attrs) {
      attrs = {};
      attributeOriginals.set(element, attrs);
    }
    if (!(name in attrs)) attrs[name] = element.getAttribute(name) || '';
    return attrs[name];
  }

  function transform(root, mode) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      if (shouldSkip(node.parentElement)) return;
      rememberText(node);
      const original = originals.get(node);
      node.nodeValue = mode === 'latn' ? latinize(original) : original;
    });

    if (root.querySelectorAll) {
      root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(element => {
        if (shouldSkip(element)) return;
        ['placeholder', 'title', 'aria-label'].forEach(name => {
          if (!element.hasAttribute(name)) return;
          const original = getOriginalAttribute(element, name);
          element.setAttribute(name, mode === 'latn' ? latinize(original) : original);
        });
      });
    }

    if (!document.documentElement.dataset.origTitle) {
      document.documentElement.dataset.origTitle = document.title;
    }
    const originalTitle = document.documentElement.dataset.origTitle;
    document.title = mode === 'latn' ? latinize(originalTitle) : originalTitle;
    document.documentElement.lang = mode === 'latn' ? 'sr-Latn' : 'sr-Cyrl';
  }

  function updateButtons(mode) {
    document.querySelectorAll('.script-toggle button').forEach(button => {
      const selected = button.dataset.script === mode;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-active', selected);
    });
  }

  function setMode(mode) {
    if (mode !== 'latn' && mode !== 'cyrl') return;
    safeSaveMode(mode);
    transform(document.body, mode);
    updateButtons(mode);
  }

  function normalizeSearch(value) {
    return latinize(value).toLocaleLowerCase('sr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function clearOldHighlight() {
    document.querySelectorAll('.atlas-search-target').forEach(element => element.classList.remove('atlas-search-target'));
    document.querySelectorAll('mark.atlas-search-mark').forEach(mark => {
      mark.replaceWith(document.createTextNode(mark.textContent || ''));
    });
  }

  function highlightSearchTarget() {
    const query = new URLSearchParams(location.search).get('highlight');
    if (!query || query.trim().length < 2) return;

    clearOldHighlight();
    const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return;

    const excluded = 'header, nav, footer, .script-toggle, script, style, code, pre, textarea, [data-no-search-highlight]';
    const candidates = Array.from(document.querySelectorAll('main p, main li, main h1, main h2, main h3, main h4, main td, main th, main blockquote, main summary, main .card, article p, article li'));
    const target = candidates.find(element => {
      if (element.closest(excluded)) return false;
      const normalized = normalizeSearch(element.textContent || '');
      return terms.every(term => normalized.includes(term));
    });

    if (!target) return;
    target.classList.add('atlas-search-target');

    // Mark an exact occurrence when the query is written in the same script as the page text.
    const exact = query.trim();
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue || shouldSkip(node.parentElement)) continue;
      const lower = node.nodeValue.toLocaleLowerCase('sr');
      const index = lower.indexOf(exact.toLocaleLowerCase('sr'));
      if (index >= 0) {
        const before = node.nodeValue.slice(0, index);
        const match = node.nodeValue.slice(index, index + exact.length);
        const after = node.nodeValue.slice(index + exact.length);
        const fragment = document.createDocumentFragment();
        if (before) fragment.appendChild(document.createTextNode(before));
        const mark = document.createElement('mark');
        mark.className = 'atlas-search-mark';
        mark.textContent = match;
        fragment.appendChild(mark);
        if (after) fragment.appendChild(document.createTextNode(after));
        node.replaceWith(fragment);
        break;
      }
    }

    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); } catch (_) {}
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const mode = safeGetMode();
    setMode(mode);

    document.querySelectorAll('.script-toggle button').forEach(button => {
      button.addEventListener('click', () => setMode(button.dataset.script));
    });

    highlightSearchTarget();

    const observer = new MutationObserver(mutations => {
      if (safeGetMode() !== 'latn') return;
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) transform(node, 'latn');
        if (node.nodeType === Node.TEXT_NODE) {
          rememberText(node);
          node.nodeValue = latinize(originals.get(node));
        }
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  window.AtlasLatinize = latinize;
  window.AtlasSetScript = setMode;
})();
