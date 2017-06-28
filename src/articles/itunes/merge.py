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
