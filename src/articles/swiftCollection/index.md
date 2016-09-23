--- 
title: Adding Binary Search to Swift Collections
description: My first foray into extending Swift's Collection protocol in order to provide fast searching of ordered elements.
date: 2016-09-23 12:18:02 UTC+02:00
author: Brad Howes
tags: Algorithms, Swift
layout: post.hbs
image: header.png
---

[Swift](http://swift.org) is a great programming language. I've been working in Swift off and on for the past
year or so, but with the release of v3.0 of the language, I've been spending a lot more time with it. I'm
currently rewriting in Swift some of my older Objective-C iOS apps. Some of the code has not been touched since
iOS 4/5 timeframe, which makes for some interesting reading.

In one of my projects, I have an array of samples taken over time, and the items in the array are ordered by an
increasing timestamp value. Naturally, these samples are just appended to a Swift
[Array](http://swiftdoc.org/v3.0/type/Array)

```swift
var samples: [Sample] = []
var sample = Sample(Date())
samples.append(sample)
```

In my app, I have a scatter plot which shows the samples, the horizontal (X) axis being time and the vertical
(Y) axis showing the sampled value. As the user swipes the plot to see a different window of points, I wanted to
adjust the bounds of the Y axis so that the points were optimally displayed in the available pixels. To do this,
I needed to quickly locate two sample points in the data set, the first/last ones to appear in the viewport.
Between these two points I then locate the min/max value and update the Y axis bounds as appropriate.

A fast way to locate items in an ordered collection is to use binary search, which gives **O(log N)**
performance [^1]. This is a simple thing to do, though with Swift
[Collection](http://swiftdoc.org/v3.0/protocol/Collection) indices there are some subtleties to abide by.

```swift
extension Collection {
    typealias OrderPredicate = (Iterator.Element, Iterator.Element) -> Bool
    func insertionIndexOf(value: Iterator.Element, predicate: OrderPredicate) -> Index {
        var low = startIndex
        var high = endIndex
        while low != high {
            let mid = index(low, offsetBy: distance(from: low, to: high) / 2)
            if predicate(self[mid], value) {
                low = index(mid, offsetBy: 1)
            }
            else {
                high = mid
            }
        }
        return low
    }
}
```

The new function `insertionIndexOf` locates the point in a collection to insert a given value such that the
collection still remains sorted after the insertion takes place. Note that the function can return a position
that is at the end of the collection -- in other words, equal to the size of the collection -- when all items in
the collection are ordered before the value given to the function. The interesting bit about `Collection`
indices is that they do not have to be integers. Thus, we cannot use normal math operations on them. Instead we
need to use methods such as `distance` and `index` to generate new indices from old ones.

## Collection Membership Checking

We can use the above `insertionIndexOf` method to provide a quick check whether a given value is held in a
collection. All we need to do is make sure that the index returned from `insertionIndexOf` points to an element
in the collection and that the value it points to matches the one that was given. Below is a definition for a
function `binarySearchFor` which does just that, returning `true` if the given value was found in the
collection.

```swift
extension Collection where Iterator.Element: Equatable {
    func binarySearchFor(value: Iterator.Element, predicate: OrderPredicate) -> Bool {
        let pos = insertionIndexOf(value: value, predicate: predicate)
        return pos < endIndex && self[pos] == value
    }
}
```

Note that we cannot just add `binarySearchFor` to the `Collection` type like we did for `insertionIndexOf`
because the `binarySearchFor` function requires the ability to test for equality between elements in the
collection. Therefore, we must constrain the extension to only those collections that contains element types
that implement the [Equatable](http://swiftdoc.org/v3.0/protocol/Equatable) protocol.

## MinMax on a Collection

Since we are having so much fun, here is a simple implementation of a `minMax` function for `Collection` types.
One could easily calculate this by doing to iterations over the collection like so:

```swift
let minValue = samples.min()
let maxValue = samples.max()
```

However, we can do better by determining the min/max values in one pass. In the implementation below, `minMax`
will return a 2-tuple containing the minimum and maximum values of a collection. If the collection is empty,
then `minMax` will return nil. For non-empty collections, we take the first value as the min/max values and then
we iterate over the rest of the elements and look for lesser/greater values.

```swift
extension Collection where Iterator.Element: Comparable {
    func minMax() -> (min: Iterator.Element?, max: Iterator.Element?) {
        guard let value = first else { return (nil, nil) }
        var min = value
        var max = value
        var pos = index(after: startIndex)
        while pos < endIndex {
            let value = self[pos]
            if value < min { min = value }
            if value > max { max = value }
            pos = index(after: pos)
        }
        return (min, max)
    }
```

Note that here we require (constrain) that the collection holds elements which implement the
[Comparable](http://swiftdoc.org/v3.0/protocol/Comparable) protocol so that we can determine if one value is
greater than another.

[^1]: Actual performance depends on implementation of the `index` and `distance` methods. Types that support
[RandomAccessCollection](http://swiftdoc.org/v3.0/protocol/RandomAccessCollection) protocol have **O(1)***
implementations for these methods. Since the [Array](http://swiftdoc.org/v3.0/type/Array) type implements
`RandomAccessCollection`, it will have true **O(log N)** binary search performance.
