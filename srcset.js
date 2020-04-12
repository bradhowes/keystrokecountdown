"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// Copy a file from one directory to another, making sure that all directories in
// destination path exist. Returns a Promise.
//
const copyFile = (src, dst) => {
  return new Promise((resolve, reject) => {

    // Try to create necessary directories
    fs.mkdir(path.dirname(dst), {recursive: true}, err => {
      if (err) reject(err);

      // Try to copy file
      fs.copyFile(src, dst, err => {
        if (err) reject(err);
        resolve(dst);
      });
    });
  });
};

const srcset = opts => {
  const options = opts || {};
  const purgeDrafts = options.purgeDrafts || false;
  const sizes = options.sizes;
  const defaultSize = options.defaultSize || sizes[0];
  const rule = options.rule || "100vw";
  const attribution = options.attribution || true;
  const filetypes = options.fileExtension || ".md";

  return ((files, metalsmith, done) => {
    const sourceDirectory = metalsmith.source();
    const destinationDirectory = metalsmith.destination();

    const processFile = (file, contents, promises) => {

      // Markdown image tag contains 1-4 elements:
      // - title (inside [ ])
      // - image name / URL
      // - image suffix
      // - image caption text (after suffix)
      //
      const markdownImageRE = /\!\[(.*)?\]\((.*)\.(jpe?g|png)( *"(.*)")?\)/mg;
      const parentDir = path.dirname(file);

      let match;
      while ((match = markdownImageRE.exec(contents))) {
        const matched = match[0];
        const title = match[1] || "";
        const fileName = match[2];
        const fileSuffix = match[3];
        const caption = match[5] || "";

        // Ignore external images
        //
        if (fileName.startsWith("http")) continue;

        var imgrep = "<img src=\"" + fileName + "_" + defaultSize + "." + fileSuffix + "\" ";
        imgrep += "title=\"" + title + "\" srcset=\"";

        const sourceFile = match[2] + '.' + match[3];
        const sourcePath = path.join(sourceDirectory, parentDir, sourceFile);
        const sourcePathWhen = fs.statSync(sourcePath).mtimeMs;

        promises.push(...sizes.flatMap(size => {
          const sizedFile = fileName + '_' + size + '.' + fileSuffix;
          const sizedPath = path.join(sourceDirectory, parentDir, sizedFile);
          const sizedPathWhen = fs.existsSync(sizedPath) ? fs.statSync(sizedPath).mtimeMs : 0.0;
          const resizePromise = sourcePathWhen > sizedPathWhen ? sharp(sourcePath)
                  .resize(size) .toFile(sizedPath) .then(value => {
                    value.sizedPath = sizedPath;
                    return value;
                  }) : null;

          imgrep += sizedFile + " " + size + "w, ";

          const buildPath = path.join(destinationDirectory, parentDir, sizedFile);
          const buildPathWhen = fs.existsSync(buildPath) ? fs.statSync(buildPath).mtimeMs : -1.0;

          const copyPromise = sizedPathWhen > buildPathWhen ?
                  (resizePromise != null ?
                   resizePromise.then(v => copyFile(sizedPath, buildPath)) :
                   copyFile(sizedPath, buildPath))
                : null;
          return [copyPromise];
        }));

        imgrep += "\" sizes=\"" + rule + "\"";
        imgrep += "/>";

        if (attribution && caption && caption.length > 0) {
          imgrep = "<figure>" + imgrep + "<figcaption>" + caption + "</figcaption></figure>";
        }

        contents = contents.replace(match[0], imgrep);
      }

      return contents;
    };

    var promises = [];
    for (let file in files) {
      const data = files[file];
      var contents = data.contents.toString();
      contents = processFile(file, contents, promises);
      data.contents = Buffer.from(contents);
    }

    const promise = Promise.all(promises);
    promise.then(value => done());
  });
};

module.exports = srcset;
