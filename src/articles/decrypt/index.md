--- 
title: Decrypting Logs in Python
description: A tutorial on how to properly use cryptography libraries available in Python.
date: 2016-05-02 12:18:02 UTC+02:00
author: Brad Howes
tags: Python, crypto
template: post.hbs
image: system_log.png
layout: post.hbs
---

On a project I was part of, we temporarily stored text logs from our C# service in Azure blobs. We compressed
and encrypted the logs prior to sending them to Azure. The encryption step uses AES, with the password encrypted
by the private key of a cert (the private key being password protected) and then stored in a header of the log
blob. By including the encrypted password with the file, we can be sure we can decrypt the blob even if the AES
password changes in the future. All of this is pretty standard fare for encrypting data.

The team also developed a tool in C# that would download the log blogs for a time period, decrypt and uncompress
them, and optionally search for a given text. This was our primary way to diagnose a problem reported by another
team. Using the tool was cumbersome to say the least, and it required a Windows machine. Furthermore, the team
became the bottleneck for assistance request from other teams, and providing said assistance was becoming a
drain on development time.

I thought perhaps I could cobble together a web site that would do the steps of the C# tool, but on a server and
in Python (2.7). A big hurdle to overcome was the decryption step. Python out of the box does not provide
encryption or certificate functionality, but there are two packages that fill in the gaps:

* [PyOpenSSL](https://pypi.python.org/pypi/pyOpenSSL) — a wrapper around the [OpenSSL](https://www.openssl.org)
  library which allows us to read certificates in PKCS12 format.
* [PyCrypto](https://www.dlitz.net/software/pycrypto/) — a powerful collection of cryptographic routines
  including RSA ciphers.

Below is a simple class I created to obtain an RSA cipher based on a private certificate in PKCS12 format:

```python
from OpenSSL import crypto
from Crypto.Cipher import PKCS1_v1_5
from Crypto.Cipher import PKCS1_OAEP
from Crypto.PublicKey import RSA

class CipherGenerator(object):
    '''Simple class that does the right thing to with a certificate containing a private key.
    '''
    def __init__(self, cert, password):
        '''Initialize new instance.
        
        cert -- certificate data to use (binary string)
        password -- the password to apply to the cert to read the private key
        '''
        self.key = crypto.load_pkcs12(cert, password).get_privatekey()
        self.rsa = RSA.importKey(crypto.dump_privatekey(crypto.FILETYPE_PEM, self.key))

    def getPublicKey(self):
        return self.rsa.publickey().exportKey('PEM')

    def getCipherPKCS_15(self):
        '''Obtain a new RSA cipher using the private key.
        '''
        return PKCS1_v1_5.new(self.rsa)

    def getCipherPKCS_OAEP(self):
        '''Obtain a new RSA cipher using the private key.
        '''
        return PKCS1_OAEP.new(self.rsa)

    getCipher = getCipherPKCS_OAEP
```

The two `getCipherPKCS*` routines reflect the different public-key cryptography standards (PKCS) that were being
used

* The 1.5 version which was
  [shown to be weak](https://cryptosense.com/why-pkcs1v1-5-encryption-should-be-put-out-of-our-misery/)
* The "optimal asymmetric encryption padding" (OAEP) scheme

The default is to use the OAEP version, but the original is there to support any old log files that might have
been encoded with PKCS 1.5.

## Blob Decryption 

Each log blob starts with an unencrypted header that contains metadata that defines how to decrypt the blob
using AES. In particular, it holds the encrypted AES password mentioned above, as well as a AES initialization
vector (IV)

After reading these header values, we can decrypt the AES password using an RSA cipher from the private key:

```python
cipher = self.cipherGenerator.getCipher()
decryptedKey = cipher.decrypt(encryptedKey)
```

Next, we create a new AES cipher with the decrypted password and the initialization vector from the header. We
also create a [zlib](https://docs.python.org/2/library/zlib.html) decompressor for the compressed data:

```python
cipher = AES.new(decryptedKey, AES.MODE_CBC, IV)
decompressor = zlib.decompressobj(-15)
```

The use of a negative argument in the `decompressobj` call suppresses the check for the standard gzip header
(the C# code does not create one when compressing the log data). The value of `15` is the default window size
setting, which unfortunately must be specified here to convey the header suppression.

With the initialization done, we can now decrypt and uncompress the blob data. In the loop below, we pass off
the resulting log data to a scanner object which performs the text search.

```python
while blob:
    block = blob.read(self.kReadBlockSize)
    if len(block) > 0:
        block = cipher.decrypt(block)
    else:
        block = ''
        blob = None
    if len(decompressor.unconsumed_tail) > 0:
        block = decompressor.unconsumed_tail + block
    if len(block) > 0:
        block = decompressor.decompress(block)
        self.scanner.scan(block)
found = self.scanner.getFound()
```

Due to the way the zlib decompressor works, we need to look for and prepend any unprocessed data before we
continue to decompress.

Here is the complete source for the `LogDecryptor` class

```python
import binascii, json, zlib
from Crypto.Cipher import AES
import Logger

class LogDecryptor(object):
    '''Decrypts and inflates blobs and subjects the result to a scan for interesting log entries.
    '''

    kBlockBitSize = 128
    kReadBlockSize = 256 * 1024 # 256K

    def __init__(self, cipherGenerator):
        '''Initialize new instance
        
        cipherGenerator -- instance of CipherGenerator that can provide a new RSA decryption object
        '''
        gLog.begin()
        self.cipherGenerator = cipherGenerator
        self.scanner = None
        gLog.end()

    def setScanner(self, scanner):
        '''Install a new log scanner to use in the LogDecryptor.scan method.
        
        scanner -- instance of LogScanner that will do the scanning of the unencrypted and inflated log data
        '''
        gLog.begin()
        self.scanner = scanner
        gLog.end()

    def scan(self, blob):
        '''Perform a scan of an encrypted and deflated blob.
        
        blob -- object that provide file-like behavior for reading blob data
        '''
        gLog.begin('')

        self.scanner.reset()

        # Validate that the header is what we expect
        tag = blob.read(5)
        if tag != 'SN01:':
            raise RuntimeError, 'Invalid file format: ' +  tag

        # Fetch the header length
        tmp = ''
        while True:
            c = blob.read(1)
            if c == ':':
                break
            tmp += c

        headerLength = int(tmp)
        gLog.debug('headerLength:', headerLength)

        # Fetch the header (ignored)
        header = json.loads(blob.read(headerLength))
        gLog.debug('header:', header)

        secretLength = ord(blob.read(1))
        gLog.debug('secretLength:', secretLength)

        # Fetch the key that was used to encrypt the blob. It was encrypted with the private key in the cert. 
        encryptedKey = blob.read(secretLength * 8)
        gLog.debug('len(encryptedKey):', len(encryptedKey))
        gLog.debug('encryptedKey:', binascii.hexlify(encryptedKey))

        # Decrypt the key using the same private key
        cipher = self.cipherGenerator.getCipher()

        decryptedKey = cipher.decrypt(encryptedKey)
        if decryptedKey == None:
            raise RuntimeError, 'Failed to decrypt key'
        gLog.debug('decryptedKey:', binascii.hexlify(decryptedKey))

        # Fetch the initialization vector that was used to encrypt with AES
        IV = blob.read(self.kBlockBitSize / 8)

        # Creat new cipher that can decrypt the log contents
        cipher = AES.new(decryptedKey, AES.MODE_CBC, IV)

        # Create a streaming inflator for the log data after it is decrypted
        decompressor = zlib.decompressobj(-15)

        while blob != None:

            # We read kReadBlockSize at a time so we don't start to swap to disk
            block = blob.read(self.kReadBlockSize)
            if len(block) > 0:

                # Decrypt the block
                gLog.debug('read', len(block), 'bytes')
                block = cipher.decrypt(block)
            else:
                gLog.debug('EOF')
                block = ''
                blob = None

            # The zlib decompressor may have left-over data we need to consume
            if len(decompressor.unconsumed_tail) > 0:
                gLog.debug('unconsumed:', len(decompressor.unconsumed_tail))
                block = decompressor.unconsumed_tail + block

            if len(block) > 0:

                # Inflate the unencrypted data and scan it
                block = decompressor.decompress(block)
                self.scanner.scan(block)

        found = self.scanner.getFound()

        gLog.end('found:', len(found))
        return found
```
