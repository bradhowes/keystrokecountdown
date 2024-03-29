--- 
title: Sliding UIViews with Core Animation
description: Shows how to easily animate sliding UIViews for a nice visual effect
date: 2016-09-28 12:18:02+02:00
author: Brad Howes
tags: Swift, UI
layout: post.hbs
image: animation.gif
---

For fun, I've been rewriting an app I had created on iOS for measuring push notification performance. The
original was written in Objective-C (Obj-C), but the rewrite is in Swift. The application uses
[Core Plot](https://github.com/core-plot/core-plot) for visualizing, and much of my work so far has focused on
getting the plots to look and work right. Revisiting my code brought back memories of the difficulties I
encountered getting desired behavior out of the complex library (the generated documentation helps somewhat as
do the demo apps, but I often need to dive into Core Plot code to get the desired behavior -- I will write about
this in another post).

With the graphing done and the main display layout working, I next tackled the transitioning between the lower
views shown in the app. Here's what it looks like:

![animation.gif](animation.gif)

The tab buttons at the top right trigger different views at the bottom, keeping the primary scatter plot showing
in the top-half of the view at all times. This is all done in [Auto
Layout](https://developer.apple.com/library/content/documentation/UserExperience/Conceptual/AutolayoutPG/)
which, like Core Plot, can be confusing at times to understand why unexpected behavior strikes. The three views
at the bottom lie on-top of another empty one whose sole purpose in life is to keep the upper scatter plot
view properly sized on the display; the other views simply follow its layout. This is all pretty straightforward
and I accomplished it all in Xcode's Interface Builder.

For the sliding transition effect, I rely on the
[Core Animation](https://developer.apple.com/library/content/documentation/Cocoa/Conceptual/CoreAnimation_guide/Introduction/Introduction.html)
functionality that all `UIView` objects have. For some properties, one can set a new value and then have Core
Animation generate a list of values from the old to new value over the duration of the animation. For the
sliding effect, I am updating the `constant` property of an
[NSLayoutConstraint](https://developer.apple.com/reference/uikit/nslayoutconstraint) which is animatable. This
property tells Auto Layout engine how far apart it should keep specific edges of two views. For instance, for
the leading spacing constraint, setting this to zero (0) will keep the left edge of a view flush with the left
edge of the containing view. If we set then set the constraint's `constant` property to the width of the view,
then the view will essentially be shoved all the way over to the right. Have Core Animation drive this setting
change, and we can see the sliding take place.

## Finding Constraints

To handle the animation, I need to locate the right constraints to manipulate. Constraints for a view are held
by the parent view. Each `NSLayoutConstraint` defines a relationship between two views, so we have to check two
properties of a constraint to see if it pertains to the view we want to slide. Here is code from my `LowerView`
struct which does this:

```swift
weak var view: UIView!
weak var button: UIBarButtonItem!
weak var top: NSLayoutConstraint!
weak var bottom: NSLayoutConstraint!
weak var left: NSLayoutConstraint!
weak var right: NSLayoutConstraint!

init?(view: UIView, button: UIBarButtonItem) {
    guard let constraints = view.superview?.constraints else { return nil }
    self.view = view
    self.button = button
    constraints.forEach {
        if $0.firstItem === view {
            switch $0.firstAttribute {
            case .top: self.top = $0
            case .bottom: self.bottom = $0
            case .leading: self.left = $0
            case .trailing: self.right = $0
            default: break
            }
        }
        else if $0.secondItem === view {
            switch $0.secondAttribute {
            case .top: self.top = $0
            case .bottom: self.bottom = $0
            case .leading: self.left = $0
            case .trailing: self.right = $0
            default: break
            }
        }
    }
}
```

> Outstanding question: is this the best way to do this?

## Doing the [Electric Slide](https://www.youtube.com/watch?v=-mOY2eWO2qw)

Once the constraints are found, we can animate the view. Here is a general `slide` function which handles all of
the sliding operations. It takes the following parameters

* `from` -- defines the side of the view that will be leading the slide
* `to` -- defines the opposite side of the view we are sliding

If the view is currently hidden, then it will slide into view, otherwise it will slide out of view. The
orientation of the slide depends on the constraints we give to `from` and `to`, and the direction by their
ordering.

```swift
private func slide(from: NSLayoutConstraint, to: NSLayoutConstraint) {
    let slidingIn = view.isHidden
    let offset = from === left || from === right ? view.frame.size.width : view.frame.size.height

    // Start state
    //
    if slidingIn {
        to.constant = offset
        from.constant = -offset
        view.superview?.layoutIfNeeded() // (1)
    }

    // End state
    //
    if slidingIn {
        to.constant = 0
        from.constant = 0
        view.isHidden = false
    }
    else {
        to.constant = -offset
        from.constant = offset
    }

    // Animate transition from start to end state
    //
    UIView.animate(withDuration: 0.25,
                   animations: { self.view.superview?.layoutIfNeeded() }, // (2)
                   completion: { _ in
                    self.view.superview?.layoutIfNeeded() // (3)
                    self.view.isHidden = !slidingIn
                    self.button.tintColor = slidingIn ? LowerView.activeTint : LowerView.inactiveTint
    })
}
```

The key to making this work is the proper placement of calls from the view's parent to `layoutIfNeeded()`. When
sliding in, the view needs to have the initial state we want (we cannot depend on prior state here). The first
call at *(1)* to `layoutIfNeeded()` makes this happen. Next, we set the end state which for sliding in requires
that the constraint constants be zero. We also make the view visible so that we will see the sliding effect.

The `UIView.animate` class method does the animation work for us, but we need to again call `layoutIfNeeded()`
*(2)* after each animation frame so we can see the updated view. Finally at *(3)* we have the view in its final
position, so we once again call `layoutIfNeeded()` to make it permanent. It is also at this point that we hide
the view if it was sliding out.

The above `slide` method is private to the `LowerView` struct. Here are the public functions which simply invoke
it using the right constraints in the right order:

```swift
func slideLeft() {
    slide(from: right, to: left)
}

func slideRight() {
    slide(from: left, to: right)
}

func slideDown() {
    slide(from: top, to: bottom)
}

func slideUp() {
    slide(from: bottom, to: top)
}
```

Now that we have the methods for sliding, we need to add the necessary functionality to coordinate the sliding
of two views at a time -- sliding one view out while sliding another one it to replace the first.

## Managing LowerView Appearances

I have a `LowerViewManager` which coordinates the appearance of a view in the lower part of the main display. It
knows which view is currently active, and properly transitions between them using the right direction. For
instance, there are three views in my app -- histogram, log, events -- with three buttons at the upper-right of
the app. Switching from histogram to log should look like the log view comes in from the right since the log
button is to the right of the histogram one. Likewise, going from the events view to log or histogram view should
have the events view slide out to the right, with the other view coming in from the left.

Here is the `transition` method of the `LowerViewManager` struct. Interestingly, the second parameter is a
`LowerView` method which returns another method. Swift allows one to pass around functions, but here we are
passing around an instance method. Before we can invoke it, we need to *bind* the instance value to the method,
which we do in the `method()` invocation. What we get back is a method bound to the `LowerView` object we wish to
slide. To do *that* part, we do a second method call.

```swift
private mutating func transition(activate: Kind, method: (_ : LowerView) -> () -> () ) {
    if activate == active { return }
    method(lowerViews[active]!)()
    active = activate
    method(lowerViews[active]!)()
}
```

Again, the above is private to `LowerViewManager`. Here are the two public methods which perform transitions in
a horizontal or vertical manner. They pass in the right `LowerView` slide method depending on the ordering of
the current view and the view being activated.

```swift
mutating func slideVertically(activate: Kind) {
    let method = activate.rawValue < active.rawValue ? LowerView.slideUp : LowerView.slideDown
    transition(activate: activate, method: method)
}

mutating func slideHorizontally(activate: Kind) {
    let method = active.rawValue < activate.rawValue ? LowerView.slideLeft : LowerView.slideRight
    transition(activate: activate, method: method)
}
```

Pretty simple.

## Source

Here is the complete source for `LowerView`:

```swift
/**
 A pairing of view and bar button which is managed by a LowerViewManager instance.
 
 Instances know how to slide themselves around horizontally and vertically in either direction.
 */
struct LowerView {
    
    static let inactiveTint = UIColor(red: 10.0/255.0, green: 96.0/255.0, blue: 254.0/255.0, alpha: 1.0)
    static let activeTint = UIColor(red: 0.0/255.0, green: 255.0/255.0, blue: 255.0/255.0, alpha:1.0)
 
    weak var view: UIView!
    weak var button: UIBarButtonItem!
    weak var top: NSLayoutConstraint!
    weak var bottom: NSLayoutConstraint!
    weak var left: NSLayoutConstraint!
    weak var right: NSLayoutConstraint!

    /**
     Initialize new instance. Scans the constraints held by the parent view and records the ones that are
     useful for sliding purposes, namely:
     
     * top -- the constraint managing the top edge of the view
     * bottom -- the constraint managing the bottom edge of the view
     * leading -- the constraint managing the left edge of the view
     * trailing -- the constraint managing the right edge of the view
     
     - parameter view: the UIView object to manage
     - parameter button: the UIBarButtonItem that, when pressed, makes the linked UIView visible
     */
    init?(view: UIView, button: UIBarButtonItem) {
        guard let constraints = view.superview?.constraints else { return nil }
        self.view = view
        self.button = button
        
        // Is there an easier, less verbose way of doing this?
        //
        constraints.forEach {
            if $0.firstItem === view {
                switch $0.firstAttribute {
                case .top: self.top = $0
                case .bottom: self.bottom = $0
                case .leading: self.left = $0
                case .trailing: self.right = $0
                default: break
                }
            }
            else if $0.secondItem === view {
                switch $0.secondAttribute {
                case .top: self.top = $0
                case .bottom: self.bottom = $0
                case .leading: self.left = $0
                case .trailing: self.right = $0
                default: break
                }
            }
        }
    }

    /**
     Slide the view in the direction managed by the given constraints. Uses CoreAnimation to show the 
     view sliding in/out
     
     - parameter state: indicates if the view is sliding into view (true) or sliding out of view (false)
     - parameter a: the constraint for left or top
     - parameter b: the constraint for right or bottom
     - parameter constant: the value that will be used to animate over
     */
    private func slide(from: NSLayoutConstraint, to: NSLayoutConstraint) {
        let slidingIn = view.isHidden
        let offset = from === left || from === right ? view.frame.size.width : view.frame.size.height

        // Start state
        //
        if slidingIn {
            to.constant = offset
            from.constant = -offset
            view.superview?.layoutIfNeeded()
        }

        // End state
        //
        if slidingIn {
            to.constant = 0
            from.constant = 0
            view.isHidden = false
        }
        else {
            to.constant = -offset
            from.constant = offset
        }

        // Animate transition from start to end state
        //
        UIView.animate(withDuration: 0.25,
                       animations: { self.view.superview?.layoutIfNeeded() },
                       completion: { _ in
                        self.view.superview?.layoutIfNeeded()
                        self.view.isHidden = !slidingIn
                        self.button.tintColor = slidingIn ? LowerView.activeTint : LowerView.inactiveTint
        })
    }

    /**
     Slide the view to the left.
     */
    func slideLeft() {
        slide(from: right, to: left)
    }

    /**
     Slide the view to the right.
     */
    func slideRight() {
        slide(from: left, to: right)
    }
    
    /**
     Slide the view down.
     */
    func slideDown() {
        slide(from: top, to: bottom)
    }
    
    /**
     Slide the view to up.
     */
    func slideUp() {
        slide(from: bottom, to: top)
    }
}
```

And here is `LowerViewManager`:

```swift
/**
 Inner struct that manages the lower view in the main view.
 
 Views have associated buttons that, when pressed, cause the associated view to be shown. 
 There are currently two ways to reveal a view:

 * slideUpDown - vertically slide old/new views
 * slideLeftRight - horizontally slide old/new views

 If the pressed button has a tag value smaller than the previously shown view, then the direction of the sliding is
 down/up or right/left. If the the tag value is greater than the previously shown view, then the direction is
 opposite -- up/down or left/right
 
 */
struct LowerViewManager {

    enum Kind : Int {
        case histogram, log, events
    }

    /**
     Error indicator for when a managed view is missing a required layout constraint
     */
    enum Failure : Error {
        case MissingConstraint
        case InvalidTag
    }

    private var lowerViews = [Kind:LowerView]()
    private var active: Kind = .histogram

    /**
     Add a view/button pair to the managed collection.

     Creates a new LowerView instance and if successful inserts it into the array of managed views
     
     - parameter view: the view to add
     - parameter button: the button to associate with the view
     */
    mutating func add(view: UIView, button: UIBarButtonItem) throws {
        guard let value = LowerView(view: view, button: button) else { throw Failure.MissingConstraint }
        guard let key = Kind(rawValue: view.tag) else { throw Failure.InvalidTag }
        lowerViews[key] = value
    }

    /**
     Slide two views, the old one slides out while the new one slides it.
     
     - parameter index: the unique tag value for the view to slide in and make current
     - parameter method: the sliding method to invoke to do the sliding
     */
    private mutating func transition(activate: Kind, method: (_ : LowerView) -> () -> () ) {
        if activate == active { return }
        method(lowerViews[active]!)()
        active = activate
        method(lowerViews[active]!)()
    }

    /**
     Slide views vertically
     
     - parameter index: the view to make current
     */
    mutating func slideVertically(activate: Kind) {
        let method = activate.rawValue < active.rawValue ? LowerView.slideUp : LowerView.slideDown
        transition(activate: activate, method: method)
    }

    /**
     Slide views horizontally

     - parameter index: the view to make current
     */
    mutating func slideHorizontally(activate: Kind) {
        let method = active.rawValue < activate.rawValue ? LowerView.slideLeft : LowerView.slideRight
        transition(activate: activate, method: method)
    }
}
```
