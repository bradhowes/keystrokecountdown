--- 
title: Different (Key)strokes for Different Folks
description: Short discussion on how I configured AutoHotKey to minimize my typing errors in Windows.
date: 2017-10-09 10:06:00+01:00
author: Brad Howes
tags: AutoHotKey, Windows, Emacs
layout: post.hbs
image: banner.png
---

I have been a programmer for nearly 40 years, and in all of that time I never really had to use a computer
running Windows. Even after Microsoft bought Skype in 2011, I was able to perform my day-to-day tasks on a
MacBook Pro 17" that I originally received when I joined Skype in 2010. I did give Windows a shot on a lovely
ASUS notebook I received after the sale, but the touchpad performance was so awful I gave up after a month or
two and went back to my original MacBook Pro.

Now I find myself coding in C# within Visual Studio 2017 and there is no easy way to get around being in a
Windows environment. This time there is no trackpad to irritate me -- instead, it is my stubborn muscle memory
that I have acquired over those 30+ years while writing code in Emacs. I am so used to keeping my fingers on the
home-row of a keyboard that even using arrow keys is a major nuisance; it just slows me down. In my humble
opnion, one of the greatest decisions someone at Apple made was to support some of the Emacs key
sequences in Mac OS X text fields for cursor movement and text editing. I suspect quite a few others feel the
same way, especailly those who came from a Unix background as I did.

## The Emacs Way

Emacs has a pretty simple model for moving a cursor around in a buffer of text:

* _^B_ - move the cursor _back_ one character
* _^F_ - move the cursor _forward_ one character
* _^A_ - move cursor to the beginning of the current line (think of _A_ in _A--Z_)
* _^E_ - move cursor to the _end_ of the current line
* _^P_ - move up to _previous_ line
* _^N_ - move down to _next_ line

(here, **^** means to hold down the Control modifier on the keyboard while pressing the next character)
 
Although some have reportedly developed an affliction known as _Emacs Pinky_, I have not. And I use these
control sequences many, many, many times a day -- so much in fact that I naturally and effortlessly press
_^B_ when I wish to move a cursor backwards in a sentence, only to discover that **this does not work in
Windows**!

## The AutoHotKey Way

During my brief excursion into Windows on the ASUS laptop, I learned about a neat and powerful utility called
[AutoHotKey](https://autohotkey.com) that pretty much let's you reconfigure your keyboard (and more) as you
want. There is a big community of AutoHotKey users and there are a lot of examples available from various sites
that show you how to do various amazing things with AutoHotKey. For instance, I found several configurations
which promised some semblance of Emacs keystroke emulation. Unfortunately I encountered errors in some of them
which were difficult to debug due to my complete ignorance of all things AutoHotKey. Instead, I decided to write
my own, short version that would get me Emacs-like cursor motion and some editing, while at the same time
letting me use the plethora of keyboard shortcuts in Visual Studio 2017 (of which I know perhaps 2 by heart).

Having the cursor move like I want was surprisingly easy. Here, I convert from a control character
(eg. _^B_) to a native Windows key (here, _{Left}_ means the left arrow key). The `DoMove` function I
will get to in a second: 

```autohotkey
^b::DoMove("{Left}")	; Previous character
^f::DoMove("{Right}")	; Next character
^a::DoMove("{Home}")	; Beginning of line
^e::DoMove("{End}")		; End of line
^p::DoMove("{Up}")		; Previous line
^n::DoMove("{Down}")	; Next line
```

Two more very common Emacs keystrokes for me are _^K_ which will erase all characters from the cursor to
the end of the line; and _^D_ which erases the character ahead of the cursor.

To simulate these two using normal Windows keystrokes gives the following:

```autohotkey
^k::DoEdit("+{End}^x")	; Kill line
^d::DoEdit("{Delete}")  ; Delete next character
```

Here, a _^K_ results in two Windows keys: the _End_ key with the _Shift_ modifier pressed down,
followed by a _^X_: the first key selects the text from the cursor to the end of the line, and the second
key causes a _cut_ operation which removes the selected text and puts it into the clipboard for future
_pasting_.

## Methods of Madness

The `DoMove` and `DoEdit` tags above refer to AutoHotKey functions. They both take one argument, which is a
keystroke sequence to generate to replace the one that the user originally typed. They perform nearly the same
action -- in fact they both end up calling the same function, `DoSend`, to actually do some work. The `DoSend`
method is shown below in full:

```autohotkey
; If previous hotkey was Control-Return, then just echo the active hotkey
; Otherwise, issue the given key sequence, possibly with a shift modifier if
; we are selecting text.
DoSend(key) {
    if (A_PriorHotKey == "$^Return" && A_TimeSincePriorHotKey < 1000) {
	    Send, %A_ThisHotKey%
    }
    else if (selectMode) {
	    Send, +%key%
    }
    else {
	    Send, %key%
    }
}
```

The first conditional is true if the previous key sequence handled by AutoHotKey was a _Control-Return_ and it
was seen less than 1 second ago. I use _^Return_ as a way to signal AutoHotKey to **not** translate the
next keystroke. For instance, typing _^Return_ _^A_ results in AutoHotKey sending _^A_ to the active
application, and not the _Home_ keystroke it normally would.

The second _if_ clause will be true if the `selectMode` flag is non-zero. This flag is a coarse replica of
Emacs' selection mode which is enabled via _^Space_. When this flag is non-zero, all movement keys have a
phantom _Shift_ key pressed which causes Windows to select text. The `selectMode` flag is cleared when the
`DoEdit` function executes (this is actually the only difference between it and the `DoMove` method)

Finally, the last clause will be invoked if the first two are false. This simply sends the given keystroke to
Windows where the active application will see it and process it.

## Native Emacs Proceessing

Since I can and do also run a native Emacs process I need a way to *not* filter keys when it is the active
window. A one liner in the AutoHotKey configuration file does that for me:

```autohotkey
#If !(WinActive("ahk_class Emacs") or WinActive("ahk_class mintty"))
```

It also keeps out Emacs translations when there is a Cygwin terminal window active.

## Accented Characters

Sometime during my stay in Prague, I developed a custom keyboard mapping for my MacBook Pro using the
[Ukulele](http://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=ukelele) utility. My custom map allowed me
to easily enter diacritic characters found in the Czech language, in addition to the accented characters of
Latin languages that were already available natively in Mac OS X. As far as I know, entering characters with
diacritical markings in stock Windows 7 is not at all easy, requiring memorization of various numbers to be
entered on a number pad. I created something similar in AutoHotKey. Here's the complete part first; I'll break
it down later:

```autohotkey
; Lookup tables from AHK key descriptors to unicode values
;                            à À           á Á           ä Ä           â Â
global aMap = {"#VKC0SC029": 0x00E0, "#e": 0x00E1, "#u": 0x00E4, "#i": 0x00E2}
;                            è È           é É           ë Ë           ê Ê
global eMap = {"#VKC0SC029": 0x00E8, "#e": 0x00E9, "#u": 0x00EB, "#i": 0x00EA}
;                            ì Ì           í Í           ï Ï           î Î
global iMap = {"#VKC0SC029": 0x00EC, "#e": 0x00ED, "#u": 0x00EF, "#i": 0x00EE}
;                            ò Ò           ó Ó           ö Ö           ô Ô
global oMap = {"#VKC0SC029": 0x00F2, "#e": 0x00F3, "#u": 0x00F6, "#i": 0x00F4}
;                            ù Ù           ú Ú           ü Ü           û Û
global uMap = {"#VKC0SC029": 0x00F9, "#e": 0x00FA, "#u": 0x00FC, "#i": 0x00FB}
;                    ñ Ñ
global nMap = {"#n": 0x00F1}

; Dead keys - don't do anything until something else is typed (VKC0SC029 is the keycode for a back quote)
;
#VKC0SC029::Return		; grave
#e::Return		   		; acute
#u::Return				; umlaut
#i::Return				; circumflex
#n::Return				; tilde

; Lower-case characters that may acquire an accent
;
$a::DoDiac(aMap, "a")
$e::DoDiac(eMap, "e")
$i::DoDiac(iMap, "i")
$o::DoDiac(oMap, "o")
$u::DoDiac(uMap, "u")
$n::DoDiac(nMap, "n")

; Upper-case characters that may acquire an accent
;
+$a::DoDiac(aMap, "a")
+$e::DoDiac(eMap, "e")
+$i::DoDiac(iMap, "i")
+$o::DoDiac(oMap, "o")
+$u::DoDiac(uMap, "u")
+$n::DoDiac(nMap, "n")

; Possibly apply a diacritic mark to a given character.
; map - the mapping of Unicode characters to search in for a dead-key
; k - the key that was just typed
;
DoDiac(map, k) {
	shiftDown := GetKeyState("Shift")
	if (map.HasKey(A_PriorHotKey) && A_TimeSincePriorHotkey < 2000) {
		key := map[A_PriorHotkey]
		c := Chr(key - (ShiftDown ? 0x20 : 0x00))
		SendInput {Raw}%c%
	}
	else {
		if (shiftDown) {
			k := Chr(Ord(k) - 0x20)
		}
		SendInput {Raw}%k%
	}
}
```

There are basically three parts to the above snippet of AutoHotKey config magic:

1. Mapping from _dead_ keys to Unicode characters for each of the vowel characters and the letter _n_
2. Defining the _dead_ keys
3. Translating a vowel into something else if the previous keypress was a dead key

For instance, the `aMap` variable holds a mapping from deadkey values to Unicode character variations of the
letter _a_. An _a_ with an umlaut over it is obtained by pressing the `dead` key _Win U_ followed by the _a_
key. (here, _Win_ means the Windows keyboard modifier). There are translations for both lower-case and
upper-case vowels and _n_. They can use the same function `DoDiac` because the function can determine the state
of the _Shift_ key on its own.

The `DoDiac` function checks if there is an entry in the given map for the last keystroke seen. If so, then the
previous keystroke must have been a dead key. The function then obtains the keystroke to send to Windows, and
updates the value if the _Shift_ modifier is pressed. Otherwise, just send an unadorned character to Windows.

I also added some additional mappings that duplicate those from Mac OS X or come close. These too are obtained
using the _Win_ modifier:

```autohotkey
#+1::SendInput {U+0x00A1} ; ¡ (inverted exclamation mark)
#+4::SendInput {U+0x20AC} ; € (Euro currency symbol)
#;::SendInput {U+0x2026}  ; … (ellipsis)
#a::SendInput {U+0x00E5}  ; å
#+a::SendInput {U+0x00C5} ; Å
#+c::SendInput {U+0x00C7} ; Ç
#c::SendInput {U+0x00E7}  ; ç
```

## The Rest of the Story

Here's my whole [AutoHotKey configuration file](AutoHotKey.ahk):

```autohotkey
#SingleInstance Force
#UseHook

; Lookup tables from AHK key descriptors to unicode values
;                            à À           á Á           ä Ä           â Â
global aMap = {"#VKC0SC029": 0x00E0, "#e": 0x00E1, "#u": 0x00E4, "#i": 0x00E2}
;                            è È           é É           ë Ë           ê Ê
global eMap = {"#VKC0SC029": 0x00E8, "#e": 0x00E9, "#u": 0x00EB, "#i": 0x00EA}
;                            ì Ì           í Í           ï Ï           î Î
global iMap = {"#VKC0SC029": 0x00EC, "#e": 0x00ED, "#u": 0x00EF, "#i": 0x00EE}
;                            ò Ò           ó Ó           ö Ö           ô Ô
global oMap = {"#VKC0SC029": 0x00F2, "#e": 0x00F3, "#u": 0x00F6, "#i": 0x00F4}
;                            ù Ù           ú Ú           ü Ü           û Û
global uMap = {"#VKC0SC029": 0x00F9, "#e": 0x00FA, "#u": 0x00FC, "#i": 0x00FB}
;                    ñ Ñ
global nMap = {"#n": 0x00F1}

; Dead keys - don't do anything until something else is typed (VKC0SC029 is the keycode for a back quote)
;
#VKC0SC029::Return			; grave
#e::Return		   		; acute
#u::Return				; umlaut
#i::Return				; circumflex
#n::Return				; tilde

; Lower-case characters that may acquire an accent
;
$a::DoDiac(aMap, "a")
$e::DoDiac(eMap, "e")
$i::DoDiac(iMap, "i")
$o::DoDiac(oMap, "o")
$u::DoDiac(uMap, "u")
$n::DoDiac(nMap, "n")

; Upper-case characters that may acquire an accent
;
+$a::DoDiac(aMap, "a")
+$e::DoDiac(eMap, "e")
+$i::DoDiac(iMap, "i")
+$o::DoDiac(oMap, "o")
+$u::DoDiac(uMap, "u")
+$n::DoDiac(nMap, "n")

; Possibly apply a diacritic mark to a given character.
; map - the mapping of Unicode characters to search in for a dead-key
; k - the key that was just typed
;
DoDiac(map, k) {
	shiftDown := GetKeyState("Shift")
	if (map.HasKey(A_PriorHotKey) && A_TimeSincePriorHotkey < 2000) {
		key := map[A_PriorHotkey]
		c := Chr(key - (ShiftDown ? 0x20 : 0x00))
		SendInput {Raw}%c%
	}
	else {
		if (shiftDown) {
			k := Chr(Ord(k) - 0x20)
		}
		SendInput {Raw}%k%
	}
}

#+1::SendInput {U+0x00A1} ; ¡ (inverted exclamation mark)
#+4::SendInput {U+0x20AC} ; € (Euro currency symbol)
#;::SendInput {U+0x2026}  ; … (ellipsis)
#a::SendInput {U+0x00E5}  ; å
#+a::SendInput {U+0x00C5} ; Å
#+c::SendInput {U+0x00C7} ; Ç
#c::SendInput {U+0x00E7}  ; ç

; Control-Alt-R -- reload AutoHotKey configuration
^!r::Reload

; Control-Alt-F1 -- start new Cygwin shell
^!F1::Run C:\cygwin\bin\mintty.exe /bin/bash --login

!h::WinMinimize, A			; Minimize window ala Mac

; Flag indicating if we are in Emacs-style select mode
global selectMode = 0

; If previous hotkey was Control-Return, then just echo the active hotkey
; Otherwise, issue the given key sequence, possibly with a shift modifier if
; we are selecting text.
DoSend(key) {
    if (A_PriorHotKey == "$^Return" && A_TimeSincePriorHotKey < 1000) {
	Send, %A_ThisHotKey%
    }
    else if (selectMode) {
	Send, +%key%
    }
    else {
	Send, %key%
    }
}

; Perform an edit action, and stop selecting characters
DoEdit(key) {
    selectMode = 0
    DoSend(key)
}

; Perform movement, possibly selecting characters while we are doing it
DoMove(key) {
    DoSend(key)
}

; Don't perform the following key map if in Emacs or Cygwin terminal window
;
#If !(WinActive("ahk_class Emacs") or WinActive("ahk_class mintty"))

$^Space::selectMode = 1		; Begin selecting text while moving cursor
$^Return::return		; Control-Return will pass next hotkey

^b::DoMove("{Left}")		; Previous character
^f::DoMove("{Right}")		; Next character
^a::DoMove("{Home}")		; Beginning of line
^e::DoMove("{End}")		; End of line
^p::DoMove("{Up}")		; Previous line
^n::DoMove("{Down}")		; Next line
!b::DoMove("^{Left}")		; Back word
!f::DoMove("^{Right}")		; Forward word
^v::DoMove("{PgDn}")		; Page down
!v::DoMove("{PgUp}")		; Page up
+!,::DoMove("^{Home}")		; Start of buffer
+!.::DoMove("^{End}")		; End of buffer

^k::DoEdit("+{End}^x")		; Kill line
^d::DoEdit("{Delete}")		; Delete next character

^g::DoEdit("{Esc}")		; Stop
!w::DoEdit("^c")		; Copy selected text
^w::DoEdit("^x")		; Cut selected text
^y::DoEdit("^v")		; Paste from clipboard

$Left::DoMove("{Left}")		; Previous character (possibly selected)
$Right::DoMove("{Right}")	; Next character (possibly selected)
$Up::DoMove("{Up}")		; Previous line (possibly selected)
$Down::DoMove("{Down}")		; Next line (possibly selected)
$Home::DoMove("^{Home}")	; Beginning of buffer (possibly selected)
$End::DoMove("^{End}")		; End of buffer (possibly selected)

$^_::DoEdit("^z")		; Undo last edit
^h::DoEdit("{F1}")		; Show help screen
```
