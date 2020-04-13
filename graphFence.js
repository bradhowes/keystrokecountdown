"use strict";

const Viz = require('viz.js');
const { Module, render } = require('viz.js/full.render.js');

// Custom fence processor for "```graph" blocks.
//
module.exports = md => {
  md.renderer.rules.fence_custom.graph = (tokens, idx, options, env, instance) => {
    const token = tokens[idx];
    const title = token.params.split(/\s+/g).slice(1).join(' ');
    const viz = new Viz({ Module, render });
    const promise = viz.renderString(token.content);
    const placeholder = instance.addPromise(token.content, promise);
    return '<figure class="graph">' + placeholder + '<figcaption>' + title + '</figcaption></figure>';
  };

  return md;
};
