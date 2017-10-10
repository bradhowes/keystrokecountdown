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
