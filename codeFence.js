"use strict";

var escapeHtml = require("./escapeHtml.js");

/*
 * Tweaked version of stock Remarkable code fence renderer that works with Prism as a highlighter.
 */
module.exports = function(tokens, idx, options, env, instance) {
    var token = tokens[idx];
    var langClass = '';
    var langPrefix = options.langPrefix;
    var langName = '', fences, fenceName;
    var highlighted;

    if (token.params) {
            
        //
        // ```foo bar
        //
        // Try custom renderer "foo" first. That will simplify overwrite
        // for diagrams, latex, and any other fenced block with custom look
        //
        
        fences = token.params.split(/\s+/g);
        fenceName = fences.join(' ');

        if (instance.rules.fence_custom.hasOwnProperty(fences[0])) {
            return instance.rules.fence_custom[fences[0]](tokens, idx, options, env, instance);
        }

        langName = fenceName;
        langClass = ' class="' + langPrefix + langName + '"';
    }

    if (options.highlight) {
        highlighted = options.highlight.apply(options.highlight, [ token.content ].concat(fences))
            || escapeHtml(token.content);
    } else {
        highlighted = escapeHtml(token.content);
    }

    return '<pre' + langClass + '><code' + langClass + '>' + highlighted + '</code></pre>\n';
};
