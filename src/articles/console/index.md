--- 
title: Formatting Console Output
description: Short discussion on how I updated my blog to show formatted console output
date: 2018-03-16 10:06:00+01:00
author: Brad Howes
tags: Javascript, Metalsmith, Markdown, Remarkable, Prismjs
layout: post.hbs
image: computer-keyboard-stones-on-grass-background-header.jpg
---

I recently spent some time with Docker and .NET Core and I have been documenting my efforts for a future post
on this blog. While doing that, I got side-tracked by a plugin I saw on [Prism](http://prismjs.com) called
[Command Line](http://prismjs.com/plugins/command-line/) which looked promising for showing console commands and
output. So I updated the Prism Javascript and CSS files and decided to try it out using the following markdown
code _fence_:

```markdown
 ```bash command-line
```

This _should_ colorize any Bash keywords and invoke the command-line plugin processing. Here's the result
showing the results of an `ls -l` in the repository for this blog:

```console -d,[user@localhost] $
howes% ls -l
total 856
-rw-r--r--    1 howes  staff    1077 Mar 14 15:21 LICENSE
-rw-r--r--    1 howes  staff   13310 Mar 14 15:42 README.md
-rw-r--r--    1 howes  staff   19530 Mar 15 10:06 build.js
drwxr-xr-x    7 howes  staff     224 Mar 14 15:21 images/
-rw-r--r--    1 howes  staff     854 Mar 15 15:18 myfence.js
drwxr-xr-x  678 howes  staff   21696 Mar 14 15:47 node_modules/
-rw-r--r--    1 howes  staff  380823 Mar 14 15:47 package-lock.json
-rw-r--r--    1 howes  staff    1046 Mar 14 15:46 package.json
drwxr-xr-x   15 howes  staff     480 Mar 14 15:21 src/
-rw-r--r--    1 howes  staff    5099 Mar 14 15:21 srcset.js
drwxr-xr-x    8 howes  staff     256 Mar 14 15:21 templates/
```

Not bad, but needs some work. The [documentation for the plugin](http://prismjs.com/plugins/command-line/)
mentions that one can control what is shown as a prompt (the greyish text on the left) and also which lines will
have a prompt. However, to control the latter I must use numbers and ranges, which is a bit too much effort for
my tastes -- I'll get to that in a second. Right now, we need a way to manipulate the HTML `<pre>` element that
will wrap the console output so that I can set the attributes the way I want. Fortunately the
[Remarkable](https://www.npmjs.com/package/remarkable) package I'm using allows for this if I create and install
a custom code fence. Here's what I came up with:

```javascript
"use strict";

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

module.exports = function(md, options) {
    md.renderer.rules.fence_custom.console = function(tokens, idx, options, env, instance) {
        var token = tokens[idx];
        var body = token.content.replace(/(^\s+|\s+$)/g,''); // strip leading/trailing whitespace
        var bits = token.params.split(/\s+/g);
        var attributes = ' ' + (bits.slice(1).join(' ') || 'data-prompt="%"');
        return '<pre class="command-line language-console"' + attributes + '><code>' + escapeHtml(body) + 
            '</code></pre>';
    };
};
```

The key bit is the function defintion at the bottom that will be used when I tag a code block with the name
_console_. We simply emit the text in the fence wrapped by `<pre>` and `<code>` tags, setting the right
attributes in the `<pre>` tag so that the command-line plugin will function correctly. I updated my `build.js`
static site generator to load this custom fence parser like so:


```javascript
var consoleFence = require("./consoleFence.js");
...
.use(branch("**/*.md")
    .use(function(files, metalsmith, done) {

        // Update metadata for each Markdown file. Create a description from the initial text of the
        // page if not set. We create *another* Markdown parser just to handle auto-generated snippet
        // text.
        //
        var md = new Remarkable("full", markdownOptions);
        md.use(katexPlugin).use(consoleFence);

        Object.keys(files).forEach(function(file) {
            var data = files[file];
            updateMetadata(file, data);
            if (typeof data["description"] === "undefined" || data.description === '') {
                data.description = md.render(createSnippet(data.contents));
            }
        });
        return process.nextTick(done);
    })
    .use(markdown("full", markdownOptions).use(katexPlugin).use(consoleFence))
)
```

Now, if I add `console` to the end of the code fence start, Remarkable will use my custom fence render routine
instead of the stock one. Let's give it a shot while adding some attribute settings to set the prompt and to
identify the lines of output (`data-prompt="howes%" data-output="2-999"`):

```console -d,howes%,2-99
howes% ls -l
total 856
-rw-r--r--    1 howes  staff    1077 Mar 14 15:21 LICENSE
-rw-r--r--    1 howes  staff   13310 Mar 14 15:42 README.md
-rw-r--r--    1 howes  staff   19530 Mar 15 10:06 build.js
drwxr-xr-x    7 howes  staff     224 Mar 14 15:21 images/
-rw-r--r--    1 howes  staff     854 Mar 15 15:18 myfence.js
drwxr-xr-x  678 howes  staff   21696 Mar 14 15:47 node_modules/
-rw-r--r--    1 howes  staff  380823 Mar 14 15:47 package-lock.json
-rw-r--r--    1 howes  staff    1046 Mar 14 15:46 package.json
drwxr-xr-x   15 howes  staff     480 Mar 14 15:21 src/
-rw-r--r--    1 howes  staff    5099 Mar 14 15:21 srcset.js
drwxr-xr-x    8 howes  staff     256 Mar 14 15:21 templates/
```

Better, but two things irk me. First, I have to manually remove the duplicate `howes%` from the first line, and
I *still* have to indicate which lines are output. Too much manual work. Perhaps I can tweak the command-line
plugin to do what I want. The plugin code itself is pretty straightforward, and with a little effort I come up
with the following addition:

```javascript
var filterContent = getAttribute('data-filter', '');
if (filterContent.length > 0) {
	for (var i = 0; i < content.length; i++) {
		var line = content[i];
		if (line.slice(0, promptText.length) == promptText) {
			// We have a command -- strip off the prompt from the source text and wrap in <span>
			content[i] = '<span class="command-line-command">' + line.slice(promptText.length + 1) + 
				'</span>';
		}
		else {
			// We have output -- strip off the prompt tags for the line
			var node = prompt.children[i];
			node.removeAttribute('data-user');
			node.removeAttribute('data-host');
			node.removeAttribute('data-prompt');
		}
	}
	env.element.innerHTML = content.join('\n');
}
```

I look for a _new_ attribute called `data-filter` and if it holds a non-empty value, then I go through each of
the lines wrapped in the `<code>` block. If the line starts with a prompt, I strip it off and wrap the rest of
the line in a `<span>` with a class of `command-line-command`, which I can now customize with CSS like so:

```css
.command-line-command {
   color: #3f3
}
```

Otherwise, I assume the line is part of the output and I remove the attributes which show a prompt (same
behavior as the stock plugin). Using this modified plugin, I now get:

```console howes%
howes% ls -l
total 856
-rw-r--r--    1 howes  staff    1077 Mar 14 15:21 LICENSE
-rw-r--r--    1 howes  staff   13310 Mar 14 15:42 README.md
-rw-r--r--    1 howes  staff   19530 Mar 15 10:06 build.js
drwxr-xr-x    7 howes  staff     224 Mar 14 15:21 images/
-rw-r--r--    1 howes  staff     854 Mar 15 15:18 myfence.js
drwxr-xr-x  678 howes  staff   21696 Mar 14 15:47 node_modules/
-rw-r--r--    1 howes  staff  380823 Mar 14 15:47 package-lock.json
-rw-r--r--    1 howes  staff    1046 Mar 14 15:46 package.json
drwxr-xr-x   15 howes  staff     480 Mar 14 15:21 src/
-rw-r--r--    1 howes  staff    5099 Mar 14 15:21 srcset.js
drwxr-xr-x    8 howes  staff     256 Mar 14 15:21 templates/
```

Bingo! One more example just for kicks, this time with multiple commands:

```console howes%
howes% date
Fri Mar 16 12:50:13 CET 2018
howes% ls
LICENSE            build.js           myfence.js         package-lock.json  consoleFence.js    srcset.js
README.md          images/            node_modules/      package.json       src/               templates/
howes% head build.js
var branch = require("metalsmith-branch");
var cleancss = require("metalsmith-clean-css");
var collections = require("metalsmith-collections");
var crypto = require("crypto");
var define = require("metalsmith-define");
var fs = require("fs");
var Gaze = require("gaze").Gaze;
var KatexFilter = require("notebookjs-katex");
var katexPlugin = require("remarkable-katex");
var layouts = require("metalsmith-layouts");
```

My work is done here.

# Code

I've submitted a [pull request](https://github.com/PrismJS/prism/pull/1358) with my command-line plugin changes.
The rest of the changes described here are part of the
[blog repository](https://github.com/bradhowes/keystrokecountdown).

# Wait! Forget All of the Above

Thinking about all of this console coloring *finally* brought about a realization that I'm doing it all wrong.
My blog is supposed to be a _static_ site, with little to no Javascript being run on the client. So why do I
have a customized Javascript routine just to render console output? I should be able to do it all from within
Metalsmith.

First, I refactored my [build.js](https://github.com/bradhowes/keystrokecountdown/blob/master/build.js) script
so that it would have just one `Remarkable` instance: 

```javascript
var md = new Remarkable("full", markdownOptions).use(katexPlugin).use(consoleFence);
```

I then created a custom _highlighter_ for `md` to use when rendering fenced blocks:

```javascript
var highlighter = function(code, lang) {
    if (typeof lang === 'undefined') {
        lang = 'markup';
    }
    
    if (!Prism.languages.hasOwnProperty(lang)) {
        try {
            require('prismjs/components/prism-' + lang + '.js');
        } catch (e) {
            console.warn('** Failed to load prism lang: ' + lang);
            Prism.languages[lang] = false;
        }
    }

    if (Prism.languages[lang]) {
        var s = Prism.highlight(code, Prism.languages[lang]);
        return s;
    }
    
    return '';
};
```

We check for a language definition in Prism, and if it does not exist we attempt to load it. If that fails, we
just set it to `false` so that we won't try again in the future. Finally, if we _really_ have a language
definition, we ask Prism to perform the highlighting of the code block.

Now, we need to provide the `md` instance with our highlighter method. Here is the updated `markdownOptions`
defintion with it:

```javascript
var markdownOptions = {
    html: true,             // Allow and pass inline HTML
    sup: true,              // Accept '^' as a superscript operator
    breaks: false,          // Require two new lines to end a paragraph
    typographer: true,      // Allow substitutions for nicer looking text
    smartypants: true,      // Allow substitutions for nicer looking text
    gfm: true,              // Allow GitHub Flavored Markdown (GFM) constructs
    footnote: true,         // Allow footnotes
    tables: true,           // Allow table constructs
    langPrefix: "language-", // Prefix to use for <code> language designation (set to match Prism setting)
    highlight: highlighter
};
```

Finally, I decided to drop the use of
[metalsmith-markdown-remarkable](https://www.npmjs.com/package/metalsmith-markdown-remarkable) because it was
creating a new `Remarkable`, and I wanted to be able to use my own instance. In its place, I just have a generic
Metalsmith processor for Markdown files:

```javascript
.use(function(files, metalsmith, done) {
    Object.keys(files).forEach(function (file) {
        var data = files[file], dirName = path.dirname(file),
                   htmlName = path.basename(file, path.extname(file)) + '.html';
        if (dirName !== '.') {
            htmlName = dirName + '/' + htmlName;
        }

        var str = md.render(data.contents.toString());
        data.contents = new Buffer(str);
        delete files[file];
        files[htmlName] = data;
    });
    return process.nextTick(done);
})
```

The last step was to remove the `prism.min.js` file so the final HTML pages no longer see it. Enough.

For closure, here is my updated consoleFence routine shown above, modified to _Do the Right Thing_ without any
help from Prism. Also, it supports a `-d` mode so it can act or _demo_ like the original command-line plugin I
talked about above.

```javascript
module.exports = function(md, options) {
    md.renderer.rules.fence_custom.console = function(tokens, idx, options, env, instance) {
        var token = tokens[idx];
        var body = token.content.replace(/(^\s+|\s+$)/g,''); // strip leading/trailing whitespace
        var lines = body.split('\n'); // separate into individual lines
        var bits = token.params.split(/\s+/g); // "console [parameter,list]
        var args = bits.length > 1 ? bits.slice(1) : []; // Parameters afer 'console' separated by ','
        if (args.length > 0) args = args[0].split(',');

        var demo = false;
        if (args.length > 0 && args[0] == '-d') {
            args = args.slice(1);
            demo = true;
        }

        var prompt = args.length > 0 ? args[0] : '%'; // Prompt to look for in lines
        var lang = 'language-' + (args.length > 1 ? args[1] : 'console'); // Language to colorize

        var promptOut = '<span data-prompt="' + prompt + '"></span>';
        var output = '<pre class="' + lang + '"><code class="' + lang + '"><span class="command-line-prompt">';

        // Visit each line. If line starts with the prompt value, then mark as a command. Otherwise, treat as
        // output and don't show the prompt next to it.
        //
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
```
