"use strict";

const Buffer = require('buffer').Buffer;
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
  const sizes = options.sizes;
  const defaultSize = options.defaultSize || sizes[0];
  const rule = options.rule || "100vw";
  const attribution = options.attribution || true;

  return ((files, metalsmith, done) => {
    const sourceDirectory = metalsmith.source();
    const destinationDirectory = metalsmith.destination();

    const processFile = (file, contents, promises) => {

      // Markdown (extended) image tag contains 3 elements:
      // - title (inside [ ])
      // - image name / URL + image suffix
      // - optional image caption text between double quotes
      //
      const markdownImageRE = /!\[(.*)?\]\((.*)\.(jpe?g|png)( *"(.*)")?\)/mg;
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

        let imgrep = "<img src=\"" + fileName + "_" + defaultSize + "." + fileSuffix + "\" " +
              "title=\"" + title + "\" srcset=\"";

        const sourceFile = match[2] + '.' + match[3];
        const sourcePath = path.join(sourceDirectory, parentDir, sourceFile);
        const sourcePathWhen = fs.statSync(sourcePath).mtimeMs;
        let imgrepComma = "";

        promises.push(...sizes.flatMap(size => {
          const sizedFile = fileName + '_' + size + '.' + fileSuffix;
          const sizedPath = path.join(sourceDirectory, parentDir, sizedFile);
          const sizedPathWhen = fs.existsSync(sizedPath) ? fs.statSync(sizedPath).mtimeMs : 0.0;
          const resizePromise = sourcePathWhen > sizedPathWhen ? sharp(sourcePath)
                  .resize(size) .toFile(sizedPath) .then(value => {
                    value.sizedPath = sizedPath;
                    return value;
                  }) : null;

          imgrep += imgrepComma + sizedFile + " " + size + "w";
          imgrepComma = ",";

          const buildPath = path.join(destinationDirectory, parentDir, sizedFile);
          const buildPathWhen = fs.existsSync(buildPath) ? fs.statSync(buildPath).mtimeMs : -1.0;
          const copyPromise = sizedPathWhen > buildPathWhen ?
                  (resizePromise != null ?
                   resizePromise.then(() => copyFile(sizedPath, buildPath)) :
                   copyFile(sizedPath, buildPath))
                : null;
          return [copyPromise];
        }));

        imgrep += "\" sizes=\"" + rule + "\"";
        imgrep += "/>";

        if (attribution && caption && caption.length > 0) {

          // Take the caption as-is. Assume it can contain raw HTML such as <a>, so no escaping.
          //
          imgrep = "<figure>" + imgrep + "<figcaption>" + caption + "</figcaption></figure>";
        }

        contents = contents.replace(matched, imgrep);
      }

      return contents;
    };

    const promises = [];
    for (let file in files) {
      const data = files[file];
      data.contents = Buffer.from(processFile(file, data.contents.toString(), promises));
    }

    const promise = Promise.all(promises);
    promise.then(() => done());
  });
};

module.exports = srcset;
