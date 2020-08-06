---
title: Converting WMA Files to MP3
description: Using FFMpeg toolkit to transcode MWA files to MP3 format
date: 2020-05-19 23:18:02+01:00
author: Brad Howes
tags: Audio, FFmpeg, WMA, MP3
layout: post.hbs
---

During the pandemic lockdown in France, my son's German teacher has been sending out listening exercises in the
WMA format. WMA stands for _Windows Media Audio_ and in our household we don't have any Windows devices that can
natively play this proprietary format. At least they are not encumbered with any digit rights management (DRM)
crap. Yet I still had to come up with a means for my son to be able to listen to these files to do his
assignments. He does have an iPhone, so ideally he will be able to use it and not my personal laptop while
figuring out what Christina is saying in German.

As one might expect, macOS and iOS do not natively know what to do with a WMA file. My son even went so far as
installing GarageBand on his phone to try and play the file as an instrument. I did a quick search and found
that the most popular solution was [mplayer](http://www.mplayerhq.hu/design7/news.html). After installing via
[Homebrew](https://brew.sh), I was indeed able to play the file using

```bash
% mplayer Christina.mp3
```

But that was not going to do much good for him and his iPhone. But I already had a solution to recording audio
from the system output: I fired up the excellent [Audio Hijack](https://rogueamoeba.com/audiohijack/)
application, and started an ad-hoc recording session just to record the output of `mplayer`. A bit heavy-handed
to get a conversion, it nonetheless did what I needed to give my son a playable audio file.

A further search revealed a command-line solution using the excellent [FFmpeg](https://ffmpeg.org) toolkit. I
already had FFmpeg installed (again via the lovely [Homebrew](https://brew.sh) macOS package manager) for
another project, so it took little effort to recreate the solution. Here is the Bash/Zsh script I came up with
to do the work:

```bash
#!/bin/bash

INPUT="${1}"
OUTPUT="${INPUT%%.wma}.mp3"
BIT_RATE=$(ffprobe -v error -show_entries format=bit_rate -of default=noprint_wrappers=1:nokey=1 "${INPUT}")
ffmpeg -i "${INPUT}" -vn -ar 44100 -ac 2 -ab "${BIT_RATE}" -f mp3 "${OUTPUT}"
```

First, we use `ffprobe` to identify the bit rate of the WMA file. Then we use the bit rate as an option to the
`ffmpeg` command to convert from WMA to MP3. A WMA input file of `foo/bar.wma` be converted into an MP3 file
named `foo/bar.mp3`. Short and sweet. The only remaining step is sending the file to my son via SMS or email or
Apple's quite handy [AirDrop](https://en.wikipedia.org/wiki/AirDrop).

_Alles ist gut._
