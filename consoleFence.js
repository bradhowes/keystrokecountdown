"use strict";

const escapeHtml = require("./escapeHtml.js");

// Custom fence block render used when 'console' follows the beginning of the block -- ```console
// Accepts two optional arguments:
//
// - prompt (default '%')
// - language (default 'console')
//
// The 'prompt' serves as a simple text string to look for at the beginning of lines in the block. If found, it treats everything
// *after* the prompt as a command-line entry. Lines following a prompt make up the output (up until the next prompt match or the
// end of the block.
//
module.exports = (md) => {
  md.renderer.rules.fence_custom.console = (tokens, idx) => {
    const token = tokens[idx];
    const body = token.content.replace(/(^\s+|\s+$)/g,''); // strip leading/trailing whitespace
    let lines = body.split('\n');
    const bits = token.params.split(/\s+/g);

    let args = bits.length > 1 ? bits.slice(1) : [];
    console.log("-- consoleFence", args)

    const prompt = args.length > 0 ? args[0] : '%';
    const lang = 'language-' + (args.length > 1 ? args[1] : 'console');
    const promptOut = '<span data-prompt="' + prompt + '"></span>';
    let output = '<pre class="' + lang + '"><code class="' + lang + '"><span class="command-line-prompt">';

    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];
      if (line.slice(0, prompt.length) == prompt) {
        lines[i] = prompt + ' <span class="command-line-command">' + escapeHtml(line.slice(prompt.length + 1)) + '</span>';
        output = output + promptOut;
      }
      else {
        lines[i] = escapeHtml(line);
        output = output + '<span data-prompt=" "></span>';
      }
    }

    return output + '</span>' + lines.join('\n') + '</code></pre>';
  };

  return md;
};
