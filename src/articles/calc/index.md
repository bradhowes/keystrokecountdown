---
title: Playing with Emacs Calc
description: Example of scripting Emacs Calc
date: 2026-10-25 23:18:02+01:00
author: Brad Howes
tags: Emacs, calc
layout: post.hbs
image: hp28s.jpg
---

# Using Calc in Emacs

I had a calculation I wanted to perform using data I had pasted into a Markdown document. After a brief search in
[Emacs][emacs] help, I ended up just using `M-x quick-calc` and pasting in the result. But then I thought that Emacs
[calc][calc] would have facilities to do this inline. It does, but the documentation is a bit confusing and I think
misleading.

First, Emacs `calc` is incredibly powerful if a bit hard to get to know. There is a [tutorial][tutorial], but it covers
the use of `calc` as an application within Emacs. I did not want to learn that; I just wanted to treat a region of text
as a mathematical expression and evaluate it for a result. I found [calc-embedded][embedded] which at first seemed like
a good prospect, but then my eyes glazed over with the discussion of the modes. I was able to get some stuff to parse
and evaluate, like below:

```
This is $ sin(0.3) $ a test.
```

Putting the cursor _between_ the two `$` characters and then executing `C-x * e` (`calc-embedded`) would replace the
`sine(0.3)` with a value:

```
This is $ 5.23596383142e-3 $ a test.
```

> NOTE: after performing `C-x * e` you are left in _Embedded Calc mode_, and you are asked to perform another `C-x * e`
> to exit it. Much easier to just type `q`. However, `calc` failed to do anything your pointer may have moved and you
> would **not** be in _Embedded Calc mode_.

This is a pain, since I don't want the remaining `$` characters -- I just want the result.

According to the documentation for `calc-embedded`:

> With a prefix argument of zero, Calc uses the current region (delimited by point and mark) instead of formula
> delimiters. With a prefix argument of C-u only, Calc uses the current line as the formula.

Only the first worked for me -- usually. Doing it twice in a row always failed the second time. And when it did succeed,
I often forgot to exit the embedded mode before continuing on. When attempting to evaluate the line via `C-u C-x * e` on
the following line

```
3 + 8 * 13 / 2
```

I receive the error `Expected a number` no matter where the cursor was.

# Try Again

I decided to search for what others were able to come up with. I landed on a page from Mickey Petersen's excellent
[Mastering Emacs][me] blog. He shows how one can use [calc-eval][ce] to evaluate the contents of a string and receive a
result from `calc`. This seemed workable -- I can easily pull out a string from a buffer between `mark` and `point` and
replace it with the results of `calc-eval`.

But first I fell into following various attempts to convert latitude and longitude string values into floating-point
values. Here's the Mastering Emacs solution:

```lisp
(defun hms-to-dec (hms-str)
  (let ((hms (split-string hms-str "[°′″NW ]" t)))
    (flet ((to-deg ()
                   (string-to-number
                    (calc-eval (format "deg(%s@ %s' %s\")"
                                       (pop hms) (pop hms) (pop hms))))))
          (list (to-deg) (to-deg)))))
```

And here is a non-calc version from the [Irreal blog][irreal] that Petersen used as inspiration for his `calc` version:

```lisp
(require 'cl)

(defun decimalize-lat-lon (lat-lon)
  "Decimalize latitude longitude
\"37°26′36.42″N 06°15′14.28″W\" --> (37.44345 -6.253966666666667)"
  (let (result)
    (dolist (ll (split-string lat-lon " +"))
      (destructuring-bind (deg min sec dir)
          (split-string ll "[°′″]")
        (if (string= "" dir) (error "malformed lat-lon %s" ll))
        (let ((factor (if (member dir '("S" "W")) -1 1)))
          (push (* factor (+ (string-to-number deg)
                             (/ (string-to-number min) 60.0)
                             (/ (string-to-number sec) 3600.0))) result))))
    (reverse result)))

```

First, I loved learning about `destructuring-bind` (though now it is found in Emacs with the `cl-` prefix). Second, the
`calc` solution from Petersen is not quite correct: it does not properly account for direction. The suffixes `N/S` for
latitude and `E/W` for longitude get dropped during the splitting of the string into its component parts. As a result,
coordinates west of the prime meridian report as if they are east of it, and likewise latitude values below the equator
report as if they are above it.

Here is my take using a more functional approach that properly accounts for the direction suffixes::

```lisp
(defun hms-to-dec (lat-lon &optional allow-neg)
  "Convert latitude and logitude LAT-LON into two decimal values.
A latitude and longitude consists of three (3) components: degrees,
minutes, and seconds. All are floating point values but they have
different suffixes. Degrees end with `°', minutes end with `\'' and
seconds end with `\"' followed by a direction indicator: `N/S' for
latitude and `E/W' for longitude. If ALLOW-NEG is not nil, then
direction indicators are not present; instead the sign of the degrees
value indicates the direction.

Examples:
- (hms-to-dec \"37°26'36.42\"N 06°15'14.28\"W\") -> (37.44345 -6.25396666667).
- (hms-to-dec \"37°26'36.42\" -06°15'14.28\"\", t) -> (37.44345 -6.25396666667)."
  (let* ((args-len (if allow-neg 3 4))
         (args-list (seq-partition (split-string lat-lon "[°'\" ]" t) args-len))
         (len-list (mapcar 'length args-list)))
    (when (or (/= (length len-list) 2)
              (any (lambda (len) (/= len args-len)) len-list))
      (error "Malformed lat-lon value %s" lat-lon))
    (mapcar (lambda (args)
              (seq-let (h m s d) args
                (string-to-number (calc-eval (format "deg(%s@ %s' %s\")*%d" h m s
                                                     (if (member d '("S" "W")) -1 1))))))
            args-list)))
```

First, I do much like the others and split the string into pieces, leaving any direction indicators. When the
`allow-neg` option is nil (default), there must be 4 components per coordinate: degrees, minutes, seconds, and
direction. The original split results in 8 components, so I partition them into two collections of 4 each via
`seq-partition`.

Next, like Irreal, I validate the input by checking sequence lengths (better would be to verify the values for each
component). Finally, I do pretty much what Petersen and invoke `calc-eval` twice, once for the latitude and then once
for the longitude. Pretty sure that could be done in one shot, but this works well.

My routine does allow for providing negative decimal values instead of stating the direction with a suffix. It also uses
a more succinct `seq-let` to destructure. Here are some calls to the `hms-to-dec` routine:

```lisp
(hms-to-dec "37°26'36.42\"N 06°15'14.28\"W")
(37.44345 -6.25396666667)
(hms-to-dec "37°26'36.42\" -06°15'14.28\"" t)
(37.44345 -6.25396666667)
(hms-to-dec "37°26'36.42\"N 06°15'14.28\"")
(error "Malformed lat-lon value 37°26'36.42\"N 06°15'14.28\"")
```

# Calc in Markdown

Now back to solving my original issue: selecting an expression in a Markdown document, evaluating it with `calc`, and
substituting the result for the selection:

```lisp
(defun my/markdown-calc-eval (start end)
  "Treat text in range START END as calc expression.
Replace selection with evaluation result."
  (interactive "r")
  (when (and start end)
    (let* ((eq (buffer-substring-no-properties start end))
           (result (calc-eval eq)))
      (if (stringp result)
          (replace-region-contents start end result)
        (message "%s" (cadr result))))))
```

Here we work on the active region, getting the string from the buffer, and then asking `calc-eval` for the result. If
the response is a string (from documentation) then replace the selection with it. Otherwise, it should be a list of 2
elements, the second being an error string; display that.

[emacs]: https://www.gnu.org/software/emacs/
[calc]: https://www.gnu.org/software/emacs/manual/html_mono/calc.html
[tutorial]: https://www.gnu.org/software/emacs/manual/html_mono/calc.html#Tutorial
[embedded]: https://www.gnu.org/software/emacs/manual/html_mono/calc.html#Embedded-Mode-1
[me]: https://www.masteringemacs.org/article/fun-emacs-calc
[ce]: https://www.gnu.org/software/emacs/manual/html_mono/calc.html#Calling-Calc-from-Your-Lisp-Programs
[irreal]: https://irreal.org/blog/?p=795
[source]: https://xahlee.blogspot.com/2012/04/programing-problem-decimalize-latitude.html
