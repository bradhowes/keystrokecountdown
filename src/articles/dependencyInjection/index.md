--- 
title: Dependency Injection for iOS in Swift
description: Documents how I implemented dependency injection in a Swift iOS project
date: 2016-10-08 12:18:02 UTC+02:00
author: Brad Howes
tags: Swift, UI, dependency injection
layout: post.hbs
image: dependency-injection.png
---

A powerful concept in modern software design is *dependency injection* [^1]. Basically, it holds that an instance
should never create any depedencies internally, but rather provide an interface that allows for installation or
*injection* of relationships from outside of the object. For example, in the code below an instance of class
`Foo` is held inside of class `Bar`, but class `Bar` has taken on the responsibility of creating the instance.

```swift
class Foo {}
class Bar {
    private var foo: Foo
    init() {
        self.foo = Foo()
    }
}
```

Though this is fine, the internal construction offers no way to modify the construction behavior of class `Foo`.
Moreover, there is no way to provide a substitude or *mock* of class `Foo` which would be very useful when
testing the behavior of class `Bar`. The easiest and safest way to allow this is to remove the construction of
`Foo` from inside `Bar` and instead provide an already-constructed instance of `Foo` in the constructor of `Bar`

```swift
class Foo {}
class Bar {
    private var foo: Foo
    init(foo: Foo) {
        self.foo = foo
    }
}
```

Now we are free to provide whatever we want for `Foo` in the constructor.

Unfortunately, this does not work well for iOS views and controllers that are designed in Xcode storyboards and
instantiated from bundles when the application runs. The first time a controller is available for manipulation,
the iOS platform has already created the instances -- there just is no easy way to provide additional values to
the constructor at runtime.

> There are some libraries arond that attempt to overcome these limitations. One in particular,
> [Dip](https://github.com/AliSoftware/Dip) appears to do a really nice job. However, for what I am working on
> now, I thought it overkill.

For views, we need to inject dependencies into their view controller before they appear. The normal way to do so
is in the `prepare(for segue:,sender:)` method of the current view controller. This works great, but we still
need something for the initial view. The best choice is to rely on the application delegate, which has control
prior to showing the main view of the application.

## Protocols / Interfaces

In my app, there are four protocols/interfaces that manage specific functionalities:

* `UserSettingsInterface` – settings that the user can set and modify to affect the behavior of the application
* `RecordingsStoreInterface` – manages the creation, updating, and deletion of `Recording` instances via Core
Data
* `DropboxControllerInterface` – handles uploading of data after a recording
* `RecordingActivityLogicInterface` - contains the "business logic" involved in performing a recording

The application delegate creates instances of these and holds strong references to them so that they will remain
alive for the duration of the application.

Each of the above protocols has an implementation that provides the functionality for the application. The use
of protocols however allows us to create synthetic implementations during testing. A test harness creates *mock
objects* that implement the above protocols/interfaces, but which act and respond in a well-defined manner using
synthetic data and actions since the goal is to exercise the code under test.

Here is the protocol for the `DropBoxController`:

```swift
public protocol DropboxControllerInterface: class {
    func toggleAccountLinking(viewController: UIViewController)
}
```

It only defines one method, to enable/disable account linking in the application. There is also an associated
*dependent* protocol – `DropboxControllerDependent` – which entities in the app can implement to announce that
they depend on a `DropBoxControllerInterface` object.

```swift
public protocol DropboxControllerDependent: class {
    var dropboxController: DropboxControllerInterface! { get set }
}
```

Though the actual `DropboxController` class is filled with functionality to work with the Dropbox cloud, the
application only needs to work with `toggleAccountLinking` to gain Dropbox functionality. The protocol
effectively hides or abstracts away implementation details for us.

## Injecting Dependencies

The main view of my app contains a `UITabBar` inside of which reside three other views. The tab bar controller
(`TabBarController`) does not have any custom dependencies, but the views that it contains do, so we must
navigate the view controller hierarchy to find those. Here is the code that does just that:

```swift
        guard let rvc = window!.rootViewController as? TabBarController else {
            fatalError("expected TabBarController as first view controller")
        }
        rvc.childViewControllers.forEach { viewController in
            let injector = { (viewController: AnyObject) in
                if let tmp = viewController as? UserSettingsDependent {
                    tmp.userSettings = userSettings
                }
                if let tmp = viewController as? RecordingsStoreDependent {
                    tmp.recordingsStore = recordingsStore
                }
                if let tmp = viewController as? DropboxControllerDependent {
                    tmp.dropboxController = dropboxController
                }
                if let tmp = viewController as? RecordingActivityLogicDependent {
                    tmp.recordingActivityLogic = recordingActivityLogic
                }
            }
            if let tmp = viewController as? UINavigationController {
                injector(tmp.topViewController!)
            }
            else {
                injector(viewController)
            }
        }
```

We iterate over the view controllers held by the tab bar controller and we invoke `injector()` on each to
install any declared dependencies. Note that if the controller is a `UINavigationController` we grab the
controller that is the top one since that is ours.

Here we see the *dependent* protocols for each of the interface protocols mentioned earlier. If a controller
implements a dependent protocol, then it has a property which will accept an object that implements the
associated interface protocol. Note that this kind of logic is what a package like
[Dip](https://github.com/AliSoftware/Dip) will do for you automatically.

## Segue Injection

Another point of injection for view controllers is the `prepare(for segue:…)` method of a current
UIViewController object. This method runs just before a new view appears on the screen, and the current view
controller gets a chance to forward pertinent information to the new view controller. My application currently
does not have any segues as all of the views appear from tab bar activity.

[^1]: Image adapted from one found at
[nearsoft's "Dependency Injection in AngularJS"](http://nearsoft.com/admin/wp-content/uploads/2015/10/top-dependency-injection-in-angularjs.jpg)
