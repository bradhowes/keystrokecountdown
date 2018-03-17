--- 
title: Apple iTunes Library Manipulation with Python
description: Short discussion on using Python to manipulate the contents of an iTunes Library XML file.
date: 2017-06-26 10:06:00+01:00
author: Brad Howes
tags: Python, XML, iTunes
layout: post.hbs
image: image.png
---

At home my family uses Apple *iTunes* and Safari for the majority of our media playing on our TV. This simple
setup runs on a 2010 Mac Mini that I purchased prior to us moving to Prague. It has worked very well as a
barebones media server that the children know how to use without too much support from me. Recently, I decided
to try and consolidate onto one mirrored 4TB drive the media that was on two separate drives (one internal, one
external).

To perform the consolidation, I used [rsync](https://en.wikipedia.org/wiki/Rsync) to copy from the two source
drives to the new big drive. Though normally used to manage file collections among two or more separate
machines, it offers a great collection of features for copying locally on the same machine. For instance, the
[macOS version](https://developer.apple.com/legacy/library/documentation/Darwin/Reference/ManPages/man1/rsync.1.html)
contains the smarts to also sync any metadata and extended filesystem attributes associated with the media
files. Two `rsync` commands left me with a new disc with all of the media intact and no errors.

Next, I started up *iTunes* while holding down the `option` key in order to bring up a prompt that allowed me to
create a new library.

![iTunes Library Prompt](iTunesLibraryPrompt.png)

I then changed some advanced *iTunes* settings in order to use the new media disc drive and to let *iTunes* manage
its contents. I also enabled the `Share iTunes Library XML with other application` setting so that I could
perform some library manipulation described next.

![iTunes Advanced Settings](iTunesOptions.png)

## Migrating Metadata

Since I created a new library above, I no longer had any metadata associated with media content such as play
counts or ratings as these are held inside a specific *iTunes* library file. The next step was to copy over the
metdata from the old *iTunes* library file. The `Share iTunes Library XML with other application` options
mentioned above asks *iTunes* to generate and update an XML representation of the library. However changes made to
this file will **not** appear in *iTunes*. Instead, one must rely on AppleScript functionality to make any
updates to entity metadata (see below).

[Python](https://www.python.org) has a built-in library for reading in Apple XML files –
[plistlib](https://docs.python.org/3/library/plistlib.html). Although it seems to apply to just `plist` files
(those with a suffix of `.plist`), it properly handles the `.xml` file that *iTunes* creates from its library
contents. Using `plistlib` I was able to create a short script that migrated certain metadata values from the
old library to the new one.

```python
def merge(srcPath, dstPath):

    print('-- loading', srcPath)
    srcRoot = plistlib.readPlist(srcPath)

    srcMap = makeSrcMap(srcRoot)
    print('-- found', len(srcMap), 'tracks with metadata')

    print('-- loading', dstPath)
    dstRoot = plistlib.readPlist(dstPath)

    copyAttributes(dstRoot, srcMap)
    plistlib.writePlist(dstRoot, dstPath)
```

In an *iTunes* library each media *entity* (audio, movie, etc) is called a *track* and is given a unique integer.
Unfortunately, these integer values are not the same across libraries. Therefore, I had to generate my own keys
using track attributes that would not change across library instances yet would not collide with other tracks in
the library. I chose a 5-tuple made up of the following attributes:

* `Name` — track name
* `Album` — collection name where the track resides
* `Total Time` — measure of how long the media is in seconds
* `Size` — measure of how large the media is in bytes
* `Location` — location of the media file

The `Album` name protects against duplicate song names from different albums. The `Total Time` and `Size` use
physical characteristics to further protect against name collisions. Finally the last component of the
`Location` path protects against situations where there are duplicate audio files – something that should
probably be cleaned up in the future. Note that only the last component can be assumed to be shared across the
libraries; everything else in the path can be different.

```python
def makeKey(attributes):
    return (attributes.get('Name'), attributes.get('Album'), attributes.get('Total Time'),
            attributes.get('Size'), getTrackFile(attributes))

def getTrackFile(attributes):
    location = attributes.get('Location')
    if location is None: return ''
    return urlparse(location).path.split('/')[-1]
```

Now that I have (hopefully) unique keys that will apply across *iTunes* libraries, I next build a mapping of these
keys and track entities from the source library in order to find them with keys generated from the destination
library.

```python
def makeSrcMap(srcRoot):
    srcMap = {}
    for trackId, attributes in srcRoot['Tracks'].items():
        if attributes.get('Genre') == 'Voice Memo':
            continue

        itemKey = makeKey(attributes)
        if srcMap.get(itemKey) != None:
            print('*** duplicate itemKey:', itemKey)
            pprint(srcMap[itemKey])
            pprint(attributes)
            continue

        srcMap[itemKey] = attributes
    return srcMap
```

(the check for "Voice Memo" `Genre` attribute removes collisions I had with voice memos from an iPhone — this
was the easiest way to deal with them)

## AppleScript and Python

A long time ago, I made my own Python server to drive a [SLiMP3](http://wiki.slimdevices.com/index.php/SLIMP3)
device. The server (code available [here](https://github.com/bradhowes/pyslimp3)) parsed the *iTunes* library XML
file to figure out what audio files were available, and it used AppleScript to control *iTunes*. To bridge between
Python and AppleScript, the server relied on a wonderful package called
[appscript](http://appscript.sourceforge.net). Although development on *appscript*
[stopped in 2012](http://appscript.sourceforge.net/status.html), amazingly it still works on my macOS Sierra
(10.12.5) MacBook Pro.

Interacting with *iTunes* via *appscript* is suprisingly simple though there are times when lack of documentation
makes for rough going. First, to get access to the library of media tracks in *iTunes*:

```python
import appscript
app = appscript.app('iTunes')
lib = app.library_playlists['Library']
```

To get a subset of tracks, one needs to provide one or more criteria that tells *iTunes* which tracks to chose
from all in the library. For instance, to get tracks with names containing the word 'Alien':

```python
>>> found = lib.tracks[appscript.its.name.contains('Alien')].get()
>>> [z.name() for z in found]
[u'Sounds Alien', u'Alien Heart', u'I Want An Alien For Christmas', u'Praying to the Aliens', u'Subterranean Homesick A\
lien', u"Alien: The Director's Cut", u'Alien', u'Alien (Bonus Track)', u'I Thought I Was an Alien', u'Amalienbad', u'Vi\
a Caliente']
```

Note that trailing `get()` call causes the query to execute in the *iTunes* app. Before that, what is held locally
is a pending AppleEvent expression (which can be quite complex). We can create a similar query to get the track
we want to update by looking for the `Track ID` found in the XML file. The corresponding AppleEvent property to
compare against is `database_ID`.

```python
tracks = lib.tracks[appscript.its.database_ID == attributes['Track ID']].get()
if len(tracks) == 1:
    track = track[0]
else:
    track = 0
```

Here we fetch from *iTunes* the track(s) with the given `Track ID` value in their `database_ID` property. If we
get anything but an array of one element, we assign `0` to the `track` variable as a signal that there is no
track to work with.

Next, we handle each attribute with a custom *iTunes* AppleEvent `set` command. There are three kinds of settings
we look for and apply:

* Play/Skip counts and the date of the last play or skip if the count is non-zero
* User ratings — integer values between 0 and 100 inclusive for a track or an album
* Loved/Disliked flags — booleans assigned to a track or an album (NOTE: these are not always available)

Play and skip counts are handled in the same way, though the date of the last play has an unusual name since
there was a legacy read-only 'Play Date' attribute in the XML schema. For ratings, we only set a value if there
is not an associated *computed* property with a `true` value, which would indicate that the rating value was not
set by the user but rather calculated by *iTunes*.

```python
if 'Count' in attributeName:
    if tryAESet(track, attributeMap[attributeName], value):
        attributeName = attributeName.split()[0] + ' Date'
        if attributeName.startswith('Play'):
            attributeName += ' UTC'
        tmp = srcItem.get(attributeName)
        if tmp is not None:
            tryAESet(track, attributeMap[attributeName], tmp)

elif 'Rating' in attributeName:
    if srcItem.get(attributeName + ' Computed') != True:
        tryAESet(track, attributeMap[attributeName], value)

elif 'Loved' in attributeName or 'Disliked' in attributeName:
    try:
        tryAESet(track.attributeMap[attributeName], value)
    except AttributeError as err:
        print('*** track has no attribute "{}"'.format(attributeName))
```

## Full Script

[Here](merge.py) in full is the script that I used. To run from the command line:

```console
% python merge.py SRC DST
```

where `SRC` is the path to the source library XML file and `DST` is the path to the destination library XML
file.

```python
from __future__ import print_function
import appscript, plistlib, sys
from pprint import pprint
from urlparse import urlparse

# Mapping from XML attribute to iTunes track properties
#
attributeMap = {'Play Count': 'played_count',
                'Play Date UTC': 'played_date',
                'Skip Count': 'skipped_count',
                'Skip Date': 'skipped_date',
                'Rating': 'rating',
                'Album Rating': 'album_rating',
                'Loved': 'loved',
                'Album Loved': 'album_loved',
                'Disliked': 'disliked',
                'Album Disliked': 'album_disliked'
}

def tryAESet(ae, name, value):
    try:
        ae = getattr(ae, name)
        ae.set(value)
        return True
    except AttributeError as err:
        print('*** failed: track has no property "{}"'.format(name))
    except appscript.reference.commandError as err:
        print('*** failed:', err[0], '-', err.errormessage, int(err))
    return False

def getTrackFile(attributes):
    location = attributes.get('Location')
    if location is None: return ''
    return urlparse(location).path.split('/')[-1]

def makeKey(attributes):
    return (attributes.get('Name'), attributes.get('Album'), attributes.get('Total Time'),
            attributes.get('Size'), getTrackFile(attributes))

def makeSrcMap(srcRoot):
    srcMap = {}
    for trackId, attributes in srcRoot['Tracks'].items():
        if attributes.get('Genre') == 'Voice Memo':
            continue

        itemKey = makeKey(attributes)
        if srcMap.get(itemKey) != None:
            print('*** duplicate itemKey:', itemKey)
            pprint(srcMap[itemKey])
            pprint(attributes)
            continue

        srcMap[itemKey] = attributes
    return srcMap

def copyAttributes(dstRoot, srcMap):
    app = appscript.app('iTunes')
    lib = app.library_playlists['Library']

    for trackId, attributes in dstRoot['Tracks'].items():
        if attributes.get('Genre') == 'Voice Memo':
            continue

        itemKey = makeKey(attributes)
        srcItem = srcMap.get(itemKey)
        if srcItem is not None:
            changed = []
            track = None
            for attributeName in ('Play Count', 'Skip Count',
                                  'Rating', 'Album Rating',
                                  'Loved', 'Album Loved',
                                  'Disliked', 'Album Disliked'):
                value = srcItem.get(attributeName)
                if value is not None and track is not 0:
                    if track is None:
                        tracks = lib.tracks[appscript.its.database_ID == attributes['Track ID']].get()
                        if len(tracks) == 1:
                            track = tracks[0]
                        else:
                            track = 0

                    changed.append((attributeName, value))

                    if 'Count' in attributeName:
                        if tryAESet(track, attributeMap[attributeName], value):
                            attributeName = attributeName.split()[0] + ' Date'
                            if attributeName.startswith('Play'):
                                attributeName += ' UTC'
                            tmp = srcItem.get(attributeName)
                            if tmp is not None:
                                tryAESet(track, attributeMap[attributeName], tmp)

                    elif 'Rating' in attributeName:
                        if srcItem.get(attributeName + ' Computed') != True:
                            tryAESet(track, attributeMap[attributeName], value)

                    elif 'Loved' in attributeName or 'Disliked' in attributeName:
                        try:
                            tryAESet(track.attributeMap[attributeName], value)
                        except AttributeError as err:
                            print('*** track has no attribute "{}"'.format(attributeName))

            if len(changed) > 0:
                print('-- updated', itemKey[:2], changed)

def merge(srcPath, dstPath):

    print('-- loading', srcPath)
    srcRoot = plistlib.readPlist(srcPath)

    srcMap = makeSrcMap(srcRoot)
    print('-- found', len(srcMap), 'tracks with metadata')

    print('-- loading', dstPath)
    dstRoot = plistlib.readPlist(dstPath)

    copyAttributes(dstRoot, srcMap)

if __name__ == '__main__':
    merge(sys.argv[1], sys.argv[2])
```
