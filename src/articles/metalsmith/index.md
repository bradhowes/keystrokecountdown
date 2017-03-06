--- 
title: Metalsmith Static Site on Azure
description: Where I describe how I use Metalsmith to run a static site blog on Azure
date: 2016-08-30 09:56:02+02:00
author: Brad Howes
tags: Javascript, Metalsmith, Markdown, Azure
layout: post.hbs
image: computer-keyboard-stones-on-grass-background-header.jpg
---

I enjoy reading blogs, and I've always wanted one of my own. However, I had a short set of requirements that I
wanted to satisfy with any solution I came up with:

* [Markdown](https://daringfireball.net/projects/markdown/) support (plus some useful extensions)
* Mobile support (at least iPad)
* Easy photo integration
* Perhaps [IPython](https://ipython.org/index.html) integration

I quickly found the [Ghost](http://ghost.org) platform (and app) which is an incredibly cool bit of technology.
I really liked the ability to create and edit in Markdown in a browser app. Adding a photo inline is incredibly
easy to do, and there are some nice themes. I played around with Ghost until my 14-day trial period came to an
end. I was nearly hooked, but in the end I thought that 29 USD / month was too steep a price for just one blog.
So I looked elsewhere.

## An Azure Sky

I used to work at Skype (Microsoft), and I was and still am really impressed with Microsoft's
[Azure](http://azure.microsoft.com) service. I decided to see if I could use Azure to host my site. There are
variety of hosting options available, but the simplist is just a stock Azure Web app. A big feature of this
setup is that one can allow updates to the web content via Git. Thus, a reasonable workflow becomes:

* Update blog content
* Commit changes to local Git repository
* Push changes to Azure remote Git repository

With the last step, Azure will do whatever is necessary to incorporate the changes from Git, including
restarting the IIS server when there are configuration changes in the `web.config` file -- which is necessary
when adding additional media MIME types.

## Static Cling

Using the above work flow, I could craft my own HTML pages and be done, but I've been there back in Netscape
days, and I'm not interested in doing that again. I'd rather do some version of Markdown in a text editor such
as Emacs, and then run some kind of conversion process to generate the HTML pages. Also, I did not want to do
the conversion upon each request on the Azure server -- instead, I should be able to do the conversion away from
the server, and then add the converted output to the Azure web server.

Thus, I wanted a static site generator. I began looking at various static site generators (see
https://www.staticgen.com for a good place to start), focusing on the scripting languages I already knew
(Javascript and Python). I evaluated several, and I was close to going with [Nikola](http://www.getnikola.com)
but in the end I went with [Metalsmith](http://metalsmith.io) for reasons I can no longer recall.

## Metalsmith

In brief, Metalsmith is a pipeline processor which takes in a set of files, pushes them through one or more
user-defined processing steps, resulting in (hopefully) a set of HTML and media files (pictures, movies, etc.).
The input files can be anything, really: the default action is to copy them to a destination directory. There
are various canned Metalsmith processors available on the [Metalsmith site](http://metalsmith.io) (scroll down),
and additional ones can also be found on [NPM](https://www.npmjs.com/search?q=metalsmith) -- just search for
`metalsmith`.

The processing chain I came up with is a mixture of canned processors plus some custom (inline) processors I
created to do things they way I thought made sense. The whole beautiful mess is available on my
[GitHub site](https://github.com/bradhowes/keystrokecountdown), where I also take a stab at documenting the
processing flow. So far, the flow makes sense and does everything I want the way I want it. I especially like to
IPython support using [notebookjs](https://github.com/jsvine/notebookjs) and the inline math rendering obtained
through [KaTeX](https://github.com/Khan/KaTeX). Both highly recommended.

## Workflow

To post a new blog item, I create a new directory under `src/articles` and drop a new `index.md` file into the
new directory. This will hold the Markdown content of the new post. Each file starts with a header such as below
(taken from this very post):

```text
---
title: Metalsmith Static Site on Azure
description: Where I describe how I use Metalsmith to run a static site blog on Azure
date: 2016-08-30 09:56:02+02:00
author: Brad Howes
tags: Javascript, Metalsmith, Markdown, Azure
layout: post.hbs
image: computer-keyboard-stones-on-grass-background-header.jpg
---
```

The `title` is what appears at the top of the post and in post listings. The `description` content supposedly
describes what the post is about -- it is shown below the title in all pages except for the post itself.
Scroll to the bottom of this page to see what I mean.

I think `date` and `author` are self-explanatory. I can add or more tags to the `tags` header which allows
grouping posts by their tag values. Note that on the site, I confusingly refer to these as "topics" but not
consistently -- I should fix that. Next, `layout` says which [Handlebar](http://handlebarsjs.com) template to
use for rendering into HTML. Finally, the `image` header identifies an image to show as a banner across the top
of the blog post, above the title.

Below the metadata header comes the contents of the post.

If I am on my laptop, I can easily preview the post after each save of the `index.md` file by running the
following in the top-level of the blog's repository:

```bash
% node build
```

This will create a simple web server that is running on `localhost:7000` with the feature of rebuilding the site
when a file changes. *NOTE*: this is different than the stock Metalsmith behavior which tries to only reprocess
the file that changed. I was unable to get some changes to cause a proper reprocess so I wrote my own file
watcher and reprocessor and just regenerate the whole site when any file changes. Expensive but simple.

## Saving and Deploying

When I'm satisfied with the blog post, I can add the new file(s) to the local repository, commit them, and then
push the changes to GitHub.

```bash
% cd ~/src/keystrokecountdown
% git add src/articles/newpost
% git commit -am 'New post'
% git push
```

To deploy the new blog post to my Azure web site, I have to do basically the same, but from the site's
deployment directory:

```bash
% cd ~/Sites/keystrokecountdown
% git add src/articles/newpost
% git commit -am 'New post'
% git push
```

That last step will cause my Azure Web service to deploy the new content. These steps are fairly easy to
automate via a Bash script or function which just takes in a post directory name and a comment:

```bash
#!/bin/bash
DIR="${1}"
shift 1
COMMENT="${@}"
cd ${HOME}/src/keystrokecountdown || { echo "*** missing source repository"; exit 1 }
git add src/articles/${DIR} || { echo "*** failed to add '${DIR}' to source repository"; exit 1 }
git commit -am "${COMMENT}" || { echo "*** failed to commit changes to source repository"; exit 1 }
git push || { echo "*** failed to push changes to GitHub"; exit 1 }

cd ${HOME}/Sites/keystrokecountdown || { echo "*** missing site repository"; exit 1 }
git add articles/${DIR} || { echo "*** failed to add ${DIR}' to site repository"; exit 1 }
git commit -am "${COMMENT}" || { echo "*** failed to commit changes to site repository"; exit 1 }
git push || { echo "*** failed to push changes to Azure"; exit 1 }
```

Not too shabby…

## Serving Static Media using IIS

As I mentioned above, one must muck with a `web.config` file when serving anything other than HTML and image
files. For instance, my site uses some free fonts which have the `.woff` or `.woff2` extension. To allow these,
and to pass them with the right MIME type header, the following must be part of the `src/web.config` file in the
blog source repository (which is just `web.config` in the Azure site's repository):

```xml
<?xml version="1.0" encoding="utf-8" ?> <!-- -*- Mode: xml -*- -->
<configuration>
  <system.webServer>
    <staticContent>
      <remove fileExtension=".woff" /> <!-- In case IIS already has this mime type -->
      <mimeMap fileExtension=".woff" mimeType="application/x-font-woff" />
      <remove fileExtension=".woff2" /> <!-- In case IIS already has this mime type -->
      <mimeMap fileExtension=".woff2" mimeType="application/x-font-woff" />
    </staticContent>    
  </system.webServer>
</configuration>
```

Furthermore, I want to support RSS feeds, which requires allowing XML responses from an RSS query, I need to
amend the above with the following snippet:

```xml
<remove fileExtension=".xml" /> <!-- In case IIS already has this mime type -->
<mimeMap fileExtension=".xml" mimeType="application/rss+xml" />
```

Finally, if I want to serve a video file with an `.m4v` or `.mp4` extension, I need the following entries:

```xml
<remove fileExtension=".m4v" /> <!-- In case IIS already has this mime type -->
<mimeMap fileExtension=".m4v" mimeType="video/mp4" />
<remove fileExtension=".mp4" /> <!-- In case IIS already has this mime type -->
<mimeMap fileExtension=".mp4" mimeType="video/mp4" />
```

That's is it so far. To see a blog post with an embedded movie, go [here](/articles/radardisplay/index.html).

