---
title: Selecting Bluetooth Audio Devices with Keyboard Maestro
description: Convoluted way to use a keyboard to select a Bluetooth device
date: 2026-10-31 23:18:02+01:00
author: Brad Howes
tags: macOS, Bluetooth, AirPod, Keyboard Maestro
layout: post.hbs
image: image.png
---

# Introduction

Often times, especially at work, I have the need to switch my AirPods from my iPhone to my laptop in order to use the
AirPods for a meeting. I have two pairs of AirPods Pro, so I need a way to choose from those depending on which one I am
currently wearing, or whichever one I would like to use. I have been a happy user of [Keyboard Maestro][km] for doing
stuff like this, but unfortunately, it is lacking in Bluetooth support. In particular, it cannot query for known
Bluetooth devices, nor affect their connected state. However, once a device is connected to the computer, Keyboard Maestro
can select it to be the destination for system audio output and/or for alerts.

To handle the missing Bluetooth functionality, I found the command-line tool [blueutil][bu] that is installable via
`brew install blueutil`. The `blueutil` offers a way to connect a device:

```shell
% blueutil --connect ADDR
```

where ADDR is the unique address of the device to connect. Here is how to get a list of paired devices:

```shell
% blueutil --paired
address: ec-46-54-1b-9b-1c, not connected, not favourite, paired, name: "AirPods Pro 2", recent access date: 2026-10-31 20:16:28 +0000
address: f4-33-b7-3c-e2-2d, not connected, not favourite, paired, name: "AirPods Pro 3", recent access date: 2026-10-31 20:16:28 +0000
address: c4-f7-c1-08-4a-44, not connected, not favourite, paired, name: "Home Cinema", recent access date: 2026-10-31 20:16:28 +0000
```

This can also be formatted as JSON:

```shell
% blueutil --paired --format json-pretty
[
  {
    "address" : "ec-46-54-1b-9b-1c",
    "recentAccessDate" : "2026-10-31T21:22:08+01:00",
    "favourite" : false,
    "name" : "AirPods Pro 2",
    "connected" : false,
    "paired" : true
  },
  {
    "address" : "f4-33-b7-3c-e2-2d",
    "recentAccessDate" : "2026-10-31T21:22:08+01:00",
    "favourite" : false,
    "name" : "AirPods Pro 3",
    "connected" : false,
    "paired" : true
  },
  {
    "address" : "c4-f7-c1-08-4a-44",
    "recentAccessDate" : "2026-10-31T21:22:08+01:00",
    "favourite" : false,
    "name" : "Home Cinema",
    "connected" : false,
    "paired" : true
  }
]
```

Using [jq][jq]


[km]: https://www.keyboardmaestro.com/main/
[bu]: https://github.com/toy/blueutil
[jq]: https://jqlang.org

