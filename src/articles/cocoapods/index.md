--- 
title: Framework Bundles in Xcode and CocoaPods
description: Short discussion about an issue I had fetching a bundle in Xcode and CocoaPods
date: 2017-03-06 12:18:02+01:00
author: Brad Howes
tags: Swift, Xcode
layout: post.hbs
image: image.png
---
An iOS SDK I am working on needs to find resources in its own bundle. Originally, I was doing this with the
following snippet:

```swift
return Bundle(for: TaskMeAuthenticator.self)
```

This would work well within Xcode *and* when I embedded the resulting framework by myself without any CocoaPods
integration. However, when I tried to move over to buidling a CocoaPods repo for the SDK, I quickly encountered
crashes because resources were no longer found in this bundle. Frantic Google searches showed that this was not
uncommon: the fix was to look *inside* the bundle for another one which would then contain the actual resources,
something like this:

```swift
return Bundle(path: Bundle(for: TaskMeAuthenticator.self)
    .path(forResource: "TaskMe", ofType: "bundle")!)!
```

Yeah, the double presence of `!` is smelly, but it worked. However, *this* incantation would then fail in Xcode
without CocoaPods. Finally, I fixed it all with the following safer version:

```swift
let bundle = Bundle(for: TaskMeAuthenticator.self)
if let path = bundle.path(forResource: "TaskMe", ofType: "bundle") {
    if let inner = Bundle(path: path) {
        return inner
    }
}
return bundle
```

So far, so good.

Apparently, the difference is that CocoaPods will create a separate named bundle for resources. This is of
course mentioned in their docs somehwere, but I was not fully aware of what this meant until the crashes started.
