---
title: Swift Snapshot Testing in Github Actions
description: Short discussion on how I run snapshot tests in Github CI
date: 2023-03-05 10:06:00+01:00
author: Brad Howes
tags: Swift, Github, CI
layout: post.hbs
image: computer-keyboard-stones-on-grass-background-header.jpg
---

I have a Swift package called [Knob](http://github.com/bradhowes/Knob) that creates a circular knob control for iOS and
macOS (and apparently tvOS too). For testing, I use the excellent
[SnapshotTesting](http://github.com/pointfreeco/swift-snapshot-testing) package from [Point•Free](https://pointfree.co)
that supports a nice collection of testable types like `NSView` and `UIView`, and artifact representations such as PNG
representations from those views. It works great on my laptop, but when run on Github, the tests fail because the PNG
images that the tests generate are not of the same format as they are on my laptop. This is primarily due to Retina
scaling, though there could also be colorspace issues and rendering environments (Metal vs CPU) coming into play as
well.

The key to making the tests work in a Github continuous-integration (CI) workflow is to partition the snapshot artifacts
into those that come from a dev environment such as my laptop, and those that comee from Github workflow. To that end, I
followed a comment made by another user of the SnapshotTesting library and modified the artifact names based on the
environment the test was running in. Here is the function I use to assert that the rendering of my test knob is the same
as before:


```swift
  func assertSnapshot(file: StaticString = #file, testName: String = #function, line: UInt = #line) throws {
    knob.layoutSubtreeIfNeeded()
    knob.display()
    let snapshotEnv = ProcessInfo.processInfo.environment["SNAPSHOT_ENV"] ?? "dev"
    let failure = verifySnapshot(matching: knob,
                                 as: .image(precision: 1.0, perceptualPrecision: 1.0),
                                 named: snapshotEnv,
                                 record: isRecording,
                                 snapshotDirectory: nil,
                                 file: file,
                                 testName: testName,
                                 line: line)
    guard let message = failure else { return }
    XCTFail(message, file: file, line: line)
  }
```

The start of the method asks the knob to render itself prior to being used for a snapshot -- for some reason on Github
without this I was seeing blank snapshots, and my tests were not exercising some custom `NSBezierPath` routines.

The Github CI workflow script set the `SNAPSHOT_ENV` value to be "ci" before it starts the bnild and test stage of the workflow:

```yaml
    - name: Build and Test
      run: make
      env:
        SNAPSHOT_ARTIFACTS: "$PWD/.snapshots"
        SNAPSHOT_ENV: ci
```

It also sets `SNAPSHOT_ARTIFACTS` so that if the SnapshotTesting library detects a difference, it will save the artifact
for the test failure in a location that we can use later on to upload to Github as a workflow artifact.

The ability to set `SNAPSHOT_ARTIFACTS` is nice, but unfortunately if the test failes because *no* artifact exists to
compare against, the SnapshotTesting library ignores it and instead plops the image file into the repo location where it
expected to find it, which is not very useful for me. To overcome this, I added a step in the CI workflow that saves the
entire contents of this location if the test step failed:

```yaml
    - name: Copy Snapshots
      if: ${{ failure() }}
      run: |
        mkdir .snapshots
        cp -r $(find . -name Knob-macOSTests)/__Snapshots__ .snapshots/
```

Now, when a new test fails because there is not a "ci" tagged image, I can download the artifacts, locate the new "ci"
image file and manually add it to the repo so that a subsequent commit will make it available for the CI tests. Not
ideal, but it works well enough for the times when I add a new test case.

If tests fail because of differences fonund in an existing artifact, the SnapshotTesting framework will do the right
thing and deposit the artifact from the failed test into the `SNAPSHOT_ARTIFACTS` directory. This allows me to evaluate
the difference and hopefully fix why the test failed.

Finally, here is the CI step that uploads any image artifacts. Note that it only executes if the build/test stage fails,
just like the copy step above.

```yaml
    - name: Upload Snapshot Failures
      uses: actions/upload-artifact@v3
      if: ${{ failure() }}
      with:
        name: snapshots
        path: .snapshots/
```

The entire CI script is viewable at [CI.yaml](https://github.com/bradhowes/Knob/blob/main/.github/workflows/CI.yml)
