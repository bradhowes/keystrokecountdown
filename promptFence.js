"use strict";

// Escape given text so that nonething in it will be taken as the start or end of an HTML element or entity.
//
function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (s) {
      var entityMap = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': '&quot;'
        };
      return entityMap[s];
    });
}

// Custom fence block render used when 'prompt' follows the beginning of the block -- ```prompt
// 
// Emits the contents of the fence block wrapped in <pre> and <code> elements. The <pre> element has classes
// `command-line` and `language-console` in order to take advantage of the `command-line` plugin from Prism code
// colorizing library. Additional text after the `prompt` tag will appear in the <pre> tag as attributes, 
// presumably ones that `command-line` understands.
//
module.exports = function(md, options) {
    md.renderer.rules.fence_custom.prompt = function(tokens, idx, options, env, instance) {
        var token = tokens[idx];
        var body = token.content.replace(/(^\s+|\s+$)/g,''); // strip leading/trailing whitespace
        var bits = token.params.split(/\s+/g);
        var attributes = ' ' + (bits.slice(1).join(' ') || 'data-prompt="%" data-filter="1"');
        return '<pre class="command-line language-console"' + attributes + '><code>' + escapeHtml(body) + 
            '</code></pre>';
    };
};
