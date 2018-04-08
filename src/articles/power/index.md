--- 
title: Power of Optimal Algorithm Design
description: A brief look at how a simple choice in algorithm implementation can greatly affect performance.
date: 2016-05-01 12:18:02+01:00
author: Brad Howes
tags: Algorithms
layout: post.hbs
image: power.png
---

I just ran across a [great illustration](http://www.cs.cmu.edu/~rweba/algf09/solverecurrencesSF.pdf) of how a
small design detail can mean the difference between OK and great performance. The referenced slides show various
versions of a method to calculate the result of raising one integer to another (e.g. $35^3 = 42,785$). The
first version in the slides is given as a recursive function, but an equivalent and intuitive way of doing this
is by using a loop like so (Python).

```python
def power(x, n):
  if n == 0: return 1
  if n == 1: return x
  while n > 1:
    y = y * x
    n = n - 1
  return y
```

It is easy to see that there will be $n - 1$ multiplications performed. If one is not concerned too much with
performance, then we are done.

But can we do better?

One approach to take when looking to solve a problem involving counting or iterating is the divide and conquer
strategy, where one attempts to reduce a problem into smaller steps in hopes of saving some computation. For
instance, the case for $n = 4$ is the same as $n = 2$ but with $x = x \times x$. The case for an odd $n$ is less
compelling as we will see, but the reduction in the number of multiplications is there as well too.

Here is the second version, this time with recursion (a function invoking itself):

```python
def power(x, n):
  if n == 0: return 1
  if n == 1: return x
  if n % 2 == 0:
    return power(x * x, n / 2)
  return power(x * x, n / 2) * x
```

We can easily see that the recursion will quickly stop since n is being halved each time power calls itself. For
$n = 256$, we actually perform a multiplication only *8* times, a much better result than $n - 1 = 255$ times in
the first program above. In "Big-Oh" notation, the original code runs in **O(n)** while the recursive one
executes in **O(lg&nbsp;n)**.

Now I personally have never had to hand-write a power function; I just rely on whatever math library is
available. However, I have written plenty of loops in my time, and my guess is that there is at least one time
where I could have improved performance by thinking a bit more about what I was calculating.
