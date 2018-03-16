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
    md.renderer.rules.fence_custom.console = function(tokens, idx, options, env, instance) {
        var token = tokens[idx];
        var body = token.content.replace(/(^\s+|\s+$)/g,''); // strip leading/trailing whitespace
        var lines = body.split('\n');
        var bits = token.params.split(/\s+/g);
        var args = bits.length > 1 ? bits.slice(1) : [];
        if (args.length > 0) {
            args = args[0].split(',');
        }
        
        console.log('prompt fence -', args);
        var demo = false;
        if (args.length > 0 && args[0] == "-d") {
            args = args.slice(1);
            demo = true;
        }

        var prompt = args.length > 0 ? args[0] : '%';
        var lang = 'language-' + (args.length > 1 ? args[1] : 'console');

        var promptOut = '<span data-prompt="' + prompt + '"></span>';
        var output = '<pre class="' + lang + '"><code class="' + lang + '"><span class="command-line-prompt">';

        for (var i = 0; i < lines.length; ++i) {
            var line = lines[i];
            if (demo) {
                if (args.length == 1 || i == 0) {
                    output = output + promptOut;
                }
                else {
                    output = output + '<span data-prompt=" "></span>';
                }
            }
            else if (line.slice(0, prompt.length) == prompt) {
                lines[i] = '<span class="command-line-command">' + escapeHtml(line.slice(prompt.length + 1)) +
                    '</span>';
                output = output + promptOut;
            }
            else {
                lines[i] = escapeHtml(line);
                output = output + '<span data-prompt=" "></span>';
            }
        }

        return output + '</span>' + lines.join('\n') + '</code></pre>';
    };
};
