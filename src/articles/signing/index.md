--- 
title: Signing Embedded Frameworks in an Embedded Framework
description: Short discussion about an issue I had using an embedded framework that itself contained embedded frameworks
date: 2017-02-14 12:18:02+01:00
author: Brad Howes
tags: Swift, Xcode
layout: post.hbs
image: image.png
---
I have been working on a feature for a mobile application that was developed by another company. My feature is
written in Swift while the main app is in Objective-C. No biggie there -- the bridging between the two works
great. However, my feature is built as a dynamic framework and it has framework dependencies itself. When I add
the framework by itself to the Objective-C application, I can run in the simulator but not on the device. The
crash I sometimes get is often nothing more than below, with no messages in the console window:

```nasm
dyld`__abort_with_payload:
    0x4f53cc <+0>:  mov    r12, sp
    0x4f53d0 <+4>:  push   {r4, r5, r6, r8}
    0x4f53d4 <+8>:  ldm    r12, {r4, r5, r6}
    0x4f53d8 <+12>: mov    r12, #512
    0x4f53dc <+16>: orr    r12, r12, #9
    0x4f53e0 <+20>: svc    #0x80
->  0x4f53e4 <+24>: pop    {r4, r5, r6, r8}
    0x4f53e8 <+28>: blo    0x4f5400                  ; <+52>
    0x4f53ec <+32>: ldr    r12, [pc, #0x4]           ; <+44>
    0x4f53f0 <+36>: ldr    r12, [pc, r12]
    0x4f53f4 <+40>: b      0x4f53fc                  ; <+48>
    0x4f53f8 <+44>: andeq  r9, r0, r8, lsl #27
    0x4f53fc <+48>: bx     r12
    0x4f5400 <+52>: bx     lr
```

Other times, I get text in the console complaining about an unsigned framework, with the framework name
being one of the frameworks embedded in my own:

```log
dyld: Library not loaded: @rpath/Siesta.framework/Siesta
  Referenced from: /private/var/containers/Bundle/Application/6370F0D4-4D48-4EBF-82DC-2E63EB421341/Nedbank.app/Frameworks/TaskMe.framework/TaskMe
  Reason: no suitable image found.  Did find:
	/private/var/containers/Bundle/Application/6370F0D4-4D48-4EBF-82DC-2E63EB421341/Nedbank.app/Frameworks/TaskMe.framework/Frameworks/Siesta.framework/Siesta: required code signature missing for '/private/var/containers/Bundle/Application/6370F0D4-4D48-4EBF-82DC-2E63EB421341/Nedbank.app/Frameworks/TaskMe.framework/Frameworks/Siesta.framework/Siesta'
```

Note that I had previously updated the *Runpath Search Paths* build setting value with
`$executable_path/Frameworks/TaskMe.framework/Frameworks` so that the dynamic linker would see into my custom
framework. However, clearly the code signing stage that takes place automatically in Xcode does not descend into
such embedded frameworks. Fortunately a quick look at a build log shows what needs to take place:

```console
% /usr/bin/codesign --force --deep --sign "${EXPANDED_CODE_SIGN_IDENTITY}" --entitlements
"${TARGET_TEMP_DIR}/${PRODUCT_NAME}.app.xcent" --timestamp=none <FILE>
```

Here `<FILE>` is the object to sign, such as a framework.

## Deep into Nothing

The man page for `codesign` documents a flag called `--deep` which seems like the perfect match for this
problem. Unfortunately, the codesign step is not configurable as far as I can tell. Natch.

## A New Hope (in a Build Phase)

Fortunately, Xcode does allow for build customization in the Build Phases tab of a target, and one such
customization option is the ability to run a shell script. I created a new one with the following content that
signs each of the embedded frameworks in my own framework:

```bash
pushd ${TARGET_BUILD_DIR}/${PRODUCT_NAME}.app/Frameworks/TaskMe.framework/Frameworks
for EACH in *.framework; do
    echo "-- signing ${EACH}"
    /usr/bin/codesign --force --deep --sign "${EXPANDED_CODE_SIGN_IDENTITY}" --entitlements "${TARGET_TEMP_DIR}/${PRODUCT_NAME}.app.xcent" --timestamp=none $EACH
done
popd
```

Here we move into the `Frameworks` directory of my own framework called `TaskMe` and I iterate over all
`*.framework` entities found there. Each one gets the `codesign` treatment using the same parameter settings
that I found in the original build log. Note that the `--deep` flag above is left-over from my other attempts --
these embedded-embedded frameworks do not have any frameworks of their own to sign, so `--deep` is useless here.

A quick clean and rebuild, and my app runs fine on my device.

## Conclusion

I feel confident that this addition to the build process is kosher, but there is always a chance that future
changes to Xcode iOS building will break it -- or render it obsolete. There is an alternative approach which
also works: embed all embedded frameworks in the top-level target. However, I am less enamored with this
approach due to the fact that if I add or remove a framework from my own, I have to remember to do the same with
the top-level app target. With my 'Build Process' script, this is handled for me auto-magically.
