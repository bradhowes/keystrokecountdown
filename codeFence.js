"use strict";

const escapeHtml = require("./escapeHtml.js");

// Tweaked version of stock Remarkable code fence renderer that works with Prism as a highlighter.
//
module.exports = (md) => {
  md.renderer.rules.fence = (tokens, idx, options, env, instance) => {
    const token = tokens[idx];
    const langPrefix = options.langPrefix;

    let langName = '', fences, langClass = '';
    if (token.params) {

      // ```foo bar
      //
      // Try custom renderer "foo" first. That will simplify overwrite for diagrams, latex, and any other fenced
      // block with custom look
      //
      fences = token.params.split(/\s+/g);
      if (Object.prototype.hasOwnProperty.call(instance.rules.fence_custom, fences[0])) {
        return instance.rules.fence_custom[fences[0]](tokens, idx, options, env, instance);
      }

      langName = fences.join(' ');
      langClass = ' class="' + langPrefix + langName + '"';
    }

    let highlighted;
    if (options.highlight) {
      highlighted = options.highlight.apply(options.highlight, [ token.content ].concat(fences))
        || escapeHtml(token.content);
    } else {
      highlighted = escapeHtml(token.content);
    }

    return '<pre' + langClass + '><code' + langClass + '>' + highlighted + '</code></pre>\n';
  };

  return md;
};
