---
title: Remarkable Customizations
description: How I customized Remarkable to get what I wanted
date: 2020-04-12 01:10:02+01:00
author: Brad Howes
tags: Javascript, Markdown, Remarkable, SVG
template: post.hbs
layout: post.hbs
image: /images/computer-keyboard-stones-on-grass-background-header.jpg
---

The [Remarkable](https://github.com/jonschlinkert/remarkable) processor for Markdown is great way to render
Markdown text into HTML, especially for something like a static site generator such as the one I crafted to make
this site. But it does have some minor limitations. First, the _fence_ block processing is a tad too limiting
for my tastes. In particular, I was not easily able to adapt it to use [Prism](https://prismjs.com) for
highlighting code or console output. I could get it to run OK from within the user's browser, but the whole
point of having a static site is to minimize them amount of processing done by the reader.

Here is the snippet of code from my
[build.js](https://github.com/bradhowes/keystrokecountdown/blob/master/build.js) file that initializes the
Remarkable object that does the Markdown processing:

```javascript
const md = new Remarkable("full", markdownOptions)
  .use(katexPlugin)
  .use(require("./codeFence.js"))
  .use(require("./consoleFence.js"))
  .use(require("./graphFence.js"));
```

The KaTex plugin is one I wrote -- see [Remarkable KaTeX](https://github.com/bradhowes/remarkable-katex). The
other three custom `use` injections pull in files local to the `build.js` file. These are described below.

## Custom Static Prism Highlighting

Below is my adaptation of the _fence_ function that resides in Remarkable. This function detects _fence_ blocks:
a collection of lines that begin and end with the sequence ``\` (three backticks), like so:

~~~
```
This is the first line of the block
This is the second line of the block
This is the last line of the block
```
~~~

Fence blocks are most often used to render code, usually in a monospace font and perhaps with some colorizing to
keep things interesting.

My function simply enables highlighing of fenced text before adding it to the rendered output. Since it usually
involves code, I put it in the `codeFence.js` file, but this is more of a misnomer since it applies to all fence
blocks that are not handled by another fence type handler (see below).

```javascript
const escapeHtml = require("./escapeHtml.js");

// Tweaked version of stock Remarkable code fence renderer that works with Prism as a highlighter.
//
module.exports = (md, options) => {
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
      if (instance.rules.fence_custom.hasOwnProperty(fences[0])) {
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
```

## Console Output

I have a need to show Unix commands and their output in my blog postings. Prism and friends have a nice way to
do this -- though not without some customization on my part:
see [Formatting Console Output](https://keystrokecountdown.com/articles/console/index.html).

```javascript
const escapeHtml = require("./escapeHtml.js");

// Custom fence block render used when 'prompt' follows the beginning of the block -- ```prompt
//
// Emits the contents of the fence block wrapped in <pre> and <code> elements. The <pre> element has classes
// `command-line` and `language-console` in order to take advantage of the `command-line` plugin from Prism code
// colorizing library. Additional text after the `prompt` tag will appear in the <pre> tag as attributes,
// presumably ones that `command-line` understands.
//
module.exports = (md, options) => {
  md.renderer.rules.fence_custom.console = (tokens, idx, options, env, instance) => {
    const token = tokens[idx];
    const body = token.content.replace(/(^\s+|\s+$)/g,''); // strip leading/trailing whitespace
    let lines = body.split('\n');
    const bits = token.params.split(/\s+/g);
    let args = bits.length > 1 ? bits.slice(1) : [];
    if (args.length > 0) args = args[0].split(',');

    let demo = false;
    if (args.length > 0 && args[0] == "-d") {
      args = args.slice(1);
      demo = true;
    }

    const prompt = args.length > 0 ? args[0] : '%';
    const lang = 'language-' + (args.length > 1 ? args[1] : 'console');

    const promptOut = '<span data-prompt="' + prompt + '"></span>';
    let output = '<pre class="' + lang + '"><code class="' + lang + '"><span class="command-line-prompt">';

    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];
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

  return md;
};
```

Here's an example of this fence rendering. First the source:

~~~
```console howes%
howes% ls
one    four   seven
two    five   eight
three  six    nine
howes%
```
~~~

And now the rendered result:

```console howes%
howes% ls
one    four   seven
two    five   eight
three  six    nine
howes%
```

## Embedded SVG Graphics

Sometimes, I wish to draw something in a textual form that I can then render as a pretty picture. Editing the
text is fairly easy whereas editing a graphic is much more cumbersome to get into a format that is suitable for
the web. Enter the `viz.js` package (or hack per the author) which brings the power
[Graphviz](http://www.graphviz.org) to browsers and static site generators.

A simple example. The following code block:

~~~
```graph Figure 1
digraph {a->b->c;}
```
~~~

generates the following when rendered:

```graph Figure 1
digraph {a->b->c;}
```

An older version worked just fine, but recent updates made it difficult to use with Remarkable due to how it
manages asynchronicity. However, I was able to get it working reasonably well by adding some Promise support to
Remarkable and my `build.js` script. I added a `addPromise` method to the Remarkable instance which records
promises of future rendering output. These are stored under `placeholder` token which is also injected into the
rendered HTML output.

```javascript const Viz = require('viz.js'); const { Module, render } =
require('viz.js/full.render.js');

// Custom fence processor for "```graph" blocks.
//
module.exports = (md, options) => {
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
```

In the `processMarkdown` function of my `build.js` file, I process all promises with the following:

```javascript
// Generate HTML from the Markdown.
//
var contents = md.render(data.contents.toString());

// If the rendering left any promises, allow them to update the content with their resolved value.
//
for (let [placeholder, promise] of Object.entries(md.renderer.promises)) {
  promise.then(value => {
    contents = contents.replace(placeholder, value);
    return value;
  });
}

// Finally, when all promises are done, we update the metadata and signal Metalsmith to continue.
//
let allPromise = Promise.all(Object.values(md.renderer.promises));
allPromise.then(value => {
  data.contents = Buffer.from(contents);
  delete files[file];
  files[htmlPath] = data;
  done();
});
```

First, we replace each placeholder value with the actual value from the promise. Next, we wait for all promises
to be resolved, and then we update the Metalsmith records with the new HTML output. Finally, we signal Metalsmith
that we are done by calling the Metalsmith `done` sentinal function.
