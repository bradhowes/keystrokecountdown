from __future__ import print_function
import cPickle, os, time, plistlib, sys
from pprint import pprint
from urlparse import urlparse

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
    for trackId, attributes in dstRoot['Tracks'].items():
        if attributes.get('Genre') == 'Voice Memo':
            continue

        itemKey = makeKey(attributes)
        srcItem = srcMap.get(itemKey)
        if srcItem is not None:
            changed = []
            for attributeName in ('Play Count', 'Play Date', 'Play Date UTC',
                                  'Skip Count', 'Skip Date'
                                  'Rating', 'Rating Computed',
                                  'Album Rating', 'Album Rating Computed',
                                  'Loved', 'Album Loved'):
                value = srcItem.get(attributeName)
                if value is not None:
                    attributes[attributeName] = value
                    changed.append(attributeName)
            if len(changed) > 0:
                print('-- updated', itemKey, changed)

def merge(srcPath, dstPath):

    print('-- loading', srcPath)
    srcRoot = plistlib.readPlist(srcPath)

    srcMap = makeSrcMap(srcRoot)
    print('-- found', len(srcMap), 'tracks with metadata')

    print('-- loading', dstPath)
    dstRoot = plistlib.readPlist(dstPath)

    copyAttributes(dstRoot, srcMap)
    plistlib.writePlist(dstRoot, dstPath)

if __name__ == '__main__':
    merge(sys.argv[1], sys.argv[2])
