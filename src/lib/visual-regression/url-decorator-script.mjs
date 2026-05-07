/**
 * Browser-side decorator that adds source-URL links to each item in the
 * reg-cli report. Reads window.__reg_urls__ (injected separately) and watches
 * for items rendered into #app, decorating each filename heading with a small
 * outbound-link icon that points at the URL the screenshot was captured from.
 *
 * This file is read as a string at build/runtime and inlined into index.html
 * by injectUrlsIntoReport — it is NEVER imported as a module.
 */
export const URL_DECORATOR_SCRIPT = `
(function () {
  var raw = window.__reg_urls__ || { expected: {}, actual: {} };
  var urls = Object.assign({}, raw.expected || {}, raw.actual || {});
  var keys = Object.keys(urls);
  if (keys.length === 0) return;

  var remaining = new Set(keys);

  function decorate(textNode, key) {
    var parent = textNode.parentElement;
    if (!parent || parent.dataset.vrUrlDecorated) return false;
    parent.dataset.vrUrlDecorated = '1';

    var url = urls[key];
    var link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = url;
    link.textContent = '\\u2197';
    link.setAttribute('aria-label', 'Open source URL: ' + url);
    link.style.cssText = 'margin-left:6px;text-decoration:none;font-size:0.85em;color:#2582c7;';
    link.addEventListener('click', function (e) { e.stopPropagation(); });
    parent.appendChild(link);
    return true;
  }

  function scan(root) {
    if (!root || remaining.size === 0) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var hits = [];
    var node;
    while ((node = walker.nextNode())) {
      var t = node.nodeValue && node.nodeValue.trim();
      if (t && remaining.has(t)) hits.push({ node: node, key: t });
    }
    for (var i = 0; i < hits.length; i++) {
      if (decorate(hits[i].node, hits[i].key)) remaining.delete(hits[i].key);
    }
  }

  function start() {
    var app = document.getElementById('app') || document.body;
    scan(app);
    if (remaining.size === 0) return;

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType === 1) scan(n);
          else if (n.nodeType === 3 && n.parentElement) scan(n.parentElement);
        }
      }
      if (remaining.size === 0) observer.disconnect();
    });
    observer.observe(app, { childList: true, subtree: true });
    setTimeout(function () { observer.disconnect(); }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
`;
