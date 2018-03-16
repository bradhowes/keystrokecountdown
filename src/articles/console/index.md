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

```
 ```bash command-line
```

This _should_ colorize any Bash keywords and invoke the command-line plugin processing. Here's the result
showing the results of an `ls -l` in the repository for this blog:

```bash command-line
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

Not bad, but needs some work. The documentation for the plugin mentions that one can control what is shown as a
prompt (the greyish text on the left) and also which lines will have a prompt. However, to control the latter
I must use numbers and ranges, which is a bit too much effort for my tastes -- I'll get to that in a second.
First, we need a way to manipulate the HTML `<pre>` element that will wrap the console output so that I can set
the attributes the way I want. Fortunately the [Remarkable](https://www.npmjs.com/package/remarkable) package
I'm using allows for this if I create and install a custom code fence. Here's what I came up with:

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
    md.renderer.rules.fence_custom.prompt = function(tokens, idx, options, env, instance) {
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
_prompt_. We simply emit the text in the fence wrapped by `<pre>` and `<code>` tags, setting the right
attributes in the `<pre>` tag so that the command-line plugin will function correctly. I updated my `build.js`
static site generator to load this custom fence parser like so:


```javascript
var promptFence = require("./promptFence.js");
...
        .use(branch("**/*.md")
            .use(function(files, metalsmith, done) {

                // Update metadata for each Markdown file. Create a description from the initial text of the
                // page if not set. We create *another* Markdown parser just to handle auto-generated snippet
                // text.
                //
                var md = new Remarkable("full", markdownOptions);
                md.use(katexPlugin).use(promptFence);

                Object.keys(files).forEach(function(file) {
                    var data = files[file];
                    updateMetadata(file, data);
                    if (typeof data["description"] === "undefined" || data.description === '') {
                        data.description = md.render(createSnippet(data.contents));
                    }
                });
                return process.nextTick(done);
            })
            .use(markdown("full", markdownOptions).use(katexPlugin).use(promptFence))
        )
```

Now, if I add `prompt` to the end of the code fence start, Remarkable will use my custom fence render routine
instead of the stock one. Let's give it a shot while adding some attribute settings to set the prompt and to
identify the lines of output (`data-prompt="howes%" data-output="2-999"`):

```prompt data-prompt="howes%" data-output="2-999"
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

```prompt data-prompt="howes%" data-filter="1"
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

```prompt data-prompt="howes%" data-filter="1"
howes% date
Fri Mar 16 12:50:13 CET 2018
howes% ls
LICENSE            build.js           myfence.js         package-lock.json  promptFence.js     srcset.js
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
