--- 
title: Emacs Markdown Editing and Viewing
description: Discussing sone customizations to markdown-mode
date: 2026-10-28 10:06:00+01:00
author: Brad Howes
tags: Emacs, Markdown, pandoc
layout: post.hbs
image: intl.jpg
---

There has been an Emacs [Markdown][md] mode for many years (2007 to be exact), which I have been using for editing files
such as this one for my blog. Written by Jason Blevins, it is full-featured and a very capable editing mode for Markdown
content. However, Emacs v31 brought out a new ["experimental" markdown-ts-mode][mdts] that I have been using, and
although tagged as experimental, it is now what I have enabled for editing Markdown files.

The article I linked to above by [Rahul M. Juliato][rmj] does a pretty good job describing how to get `markdown-ts-mode`
working properly. In short, I execute the following function at startup to make sure that there is a Markdown
Tree-sitter grammar available to use. And I make sure that any attempts to use `markdown-mode` will map instead to the
new `markdown-ts-mode`.

```elisp
(defun my/markdown-ts-mode-init ()
  "Initialization for `markdown-ts-mode'."
  (setq treesit-auto-install-grammar t
        treesit-enabled-modes t)
  (markdown-ts-mode-install-parsers t)
  (setopt markdown-ts-default-converter '(html . pandoc)
          markdown-ts-convert-display-function #'my/markdown-render-display)
  (add-to-list 'major-mode-remap-alist '(markdown-mode . markdown-ts-mode)))
```

For completeness, Here is what is run when I start editing a markdown file:

```elisp
(defun my/markdown-ts-mode-hook ()
  "Customization hook for `markdown-ts-mode'."
  (keymap-local-set "C-c *" #'my/markdown-escape-last-word)
  (keymap-local-set "C-c `" #'my/markdown-codify-last-word)
  (keymap-local-set "H-c e" #'my/replace-region-with-calc-eval)
  (keymap-local-set "M-<left>" #'backward-word)
  (keymap-local-set "M-<right>" #'forward-word)
  (keymap-local-set "C-c <space>" #'my/markdown-make-link)
  (keymap-local-set "H-c r" #'my/markdown-render)
  (keymap-local-set "H-c H-c" #'my/markdown-render)
  (flyspell-mode t))
```

Just some custom bindings (hi hyper!), most that map to some custom functions. The `my/markdown-escape-last-word`
function _escapes_ the "_" and "*" characters so that `markdown-ts-mode` will not treat them as inline Markdown
formatting characters. So the string "this_is_a_test" becomes "this\\_is\\_a\\_test" in the Markdown document but when
rendered to HTML it will just be "this_is_a_test"[^1].

```elisp
(defun my/markdown-escape-last-word ()
  "Escape '_' and '*' characters in the word before point."
  (interactive)
  (let ((pos (point)))
    (save-excursion
      (re-search-forward "\\s " nil nil -1)
      (format-replace-strings '(("_" . "\\_") ("*" . "\\*")) nil (point) pos))))
```

The `my/markdown-codify-last-word` wraps the word before the cursor (point) with backquotes, so "blah" becomes \`blah\`
and when rendered appears as `blah`.

```elisp
(defun my/markdown-codify-last-word ()
  "Escape wrap the last word with backquotes."
  (interactive)
  (save-excursion
    (re-search-forward "\\s " nil nil -1)
    (when (looking-at "\\s ")
      (forward-char 1))
    (insert-char ?`))
  (insert-char ?`))
```

Finally, `my/markdown-render` asks for an HTML rendering of the Markdown content using [pandoc][pandoc] (installed
separately via `brew install pandoc`).

```elisp
(defun my/markdown-render ()
  "Render to tmp file and show/update in `eww' buffer."
  (interactive)
  (markdown-ts-convert nil ".markdown_convert.html" '(html . pandoc) t t t))
```

When the conversion is done, `markdown-ts-mode` invokes the function found in the `markdown-ts-convert-display-function`
variable, which points to `my/markdown-render-display`, a function that presents the HTML output in a buffer below the
Markdown source using the [Emacs Web Wowser (eww)][eww] to do the HTML rendering.

```elisp
(defun my/markdown-render-display (file)
  "Show the HTML in FILE."
  (other-window-prefix)
  (eww-open-file file))
```

Thus a quick `H-c H-c` will process the Markdown in a buffer and render the HTML output below. The output buffer is
view-only, so a quick `q` will dismiss the HTML output. Very nice!

[md]: https://jblevins.org/projects/markdown-mode
[mdts]: https://rahuljuliato.com/posts/markdown-ts-mode-emacs-31
[rmj]: https://rahuljuliato.com
[pandoc]: https://pandoc.org
[eww]: https://www.gnu.org/software/emacs/manual/html_node/eww/index.html#Top
[^1]: this *was* an issue with the older `markdown-mode` mode, but it appears that the Tree-sitter version does the right
thing without any escaping needed.
