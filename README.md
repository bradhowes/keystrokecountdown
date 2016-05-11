# Brad Howes

This is the source for a static site generator that generates my personal blog,
[keystrokecountdown.com](http://keystrokecountdown.com). It uses [metalsmith.io](http://metalsmith.io) as its
engine. The site generates HTML files from Markdown text files and IPython notebook files.

Feel free to fork and reuse the design and implementation for your own blog.

## New Posts

In my blog, all posts are under the `src/articles` directory. I first create a new directory to host the
posting, then I create a new `index.md` within the new directory. If necessary, I add image files to the
directory and then reference them without any path info in the Markdown text. For example:

```
This is my new car: ![new car](newCar.jpg)
```

In the `index.md` file (can be named something else BTW), I populate the preamble that contains the metadata
that describes the new post. Here is the preamble for one of my posts:

```
--- 
title: Power of Optimal Algorithm Design
description: A brief look at how a simple choice in algorithm implementation can greatly affect performance.
date: 2016-05-01 12:18:02 UTC+02:00
author: Brad Howes
tags: Algorithms
layout: post.hbs
image: power.png
---
```

## Generating Site

To generate static pages from what is found in `src`, do

```sh
node build
```

After generating the pages, this will start up a simple web server at `localhost:7000` at which you can connect
via a browser to view the blog site.

## License

MIT
