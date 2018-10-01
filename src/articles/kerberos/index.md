---
title: Using Kerboros on macOS
description: A post to help me remember some Kerberos commands
date: 2018-10-01 12:18:02+01:00
author: Brad Howes
tags: Kerberos, macOS
template: post.hbs
layout: post.hbs
image: Kerberos.png
---

There are times when I need to use Kerberos. It has been so infrequent that I often forget the stuff that I need
to do to get where I want via Kerberos authentication. This situation is made even worse by the fact that Apple
rarely updates their Kerberos tools:

```console
% kinit --version
kinit (Heimdal 1.5.1apple1)
Copyright 1995-2011 Kungliga Tekniska Högskolan
Send bug-reports to heimdal-bugs@h5l.org
```

The net result of this is that documentation I find online via [Google](https://duckduckgo.com/?q=kerberos) or [Stack
Overflow](https://stackoverflow.com/search?q=kerberos) rarely matches what is running on my Macintosh. So, I'm documenting for
posterity and my sanity…

# Creating Keytabs Files

Kerboros supports storing sensitive information in _keytab_ files. As long you are comfortable with the security
of your host system, there should not be a problem with this. My macOS is running File Vault, I have a strong
password, and I don't run any network services through which a malicious actor could impersonate me and steal my
keytab file. So. To add a Kerberos principal's credentials to a keytab file:

```console
% ktutil --keytab=keytab.krb add -p b.howes@REALM -w PASSWORD -e aes256-cts-hmac-sha1-96 -V 1
```

Yikes! So, here is an explanation for the options:

* --keytab -- points to the file that will hold the credentials
* -p -- the Kerberos _principal_ whose credentials will be stored
* -w -- the password to store (NOTE: this could leak your password to any nefarious process that is scanning the
  process list)
* -e -- the encryption to use to encode the password
* -V -- the key version

Yeah, so perhaps I cannot be faulted too much for having a hard time remembering this incantation.

To verify things went well:

```console
% ktutil --keytab=keytab.krb list
keytab.krb:

Vno  Type                     Principal             Aliases
  1  aes256-cts-hmac-sha1-96  b.howes@REALM
```

# Fetching New Kerberos Tokens

This is a bit simpler. To fetch a valid Kerberos token using the credentials in the keytab file above:

```console
% kinit --keytab=keytab.krb -f b.howes@REALM
```

(the `-f` is to allow forwarding of the Kerberos ticket to another machine and still be valid)

OK -- I think. Let's check:

```console
% klist
Credentials cache: API:8CDD3B8D-D3E2-4999-9609-585254AC6508
        Principal: b.howes@REALM

  Issued                Expires               Principal
Oct  1 18:14:43 2018  Oct  2 04:14:43 2018  krbtgt/REALM
```

Of course, much of the above can be simplified with Bash aliases and/or functions. For now though, I can go back
to work now that I've resumed connectivity.
