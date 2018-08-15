"use strict";

const Viz = require('viz.js');

/*
 * Custom fence processor for "```graph" blocks.
 */
module.exports = function(tokens, idx, options, env, instance) {
    var token = tokens[idx];
    var svg = Viz('digraph {a -> b}');
    var title = token.params.split(/\s+/g).slice(1).join(' ');
    return '<figure class="graph">' + svg + '<figcaption>' + title + '</figcaption></figure>';
};
