"use strict";

var fs = require("fs");
var path = require("path");
var mkdirp = require("mkdirp");
var im = require("imagemagick-native");

var srcset = function(opts) {

    // this helper looks through a markdown file, rips out any images and
    // sets them up properly to use image src sets and sizes with attribution
    // using a figure and figcaption if that's provided.
    var options = opts || {};
    var defaultSize = options.sizes.defaultSize || 500;
    var sizes = options.sizes.sizes;
    var rule = options.rule || "100vw";
    var attribution = options.attribution || true;
    var filetypes = options.fileExtension || ".md";

    return (function(files, metalsmith, done) {
        
        // FIXME: disable for now until we better understand
        //
        return done();
        
        var src = metalsmith.source();
        var dst = metalsmith.destination();
        var added = {};
        for (var file in files) {
            if (file.endsWith(filetypes)) {
                var data = files[file];
                var parentDir = path.dirname(file);
                var contents = files[file].contents.toString();
                var imgpatt = /\!\[(.*)\]\((.*)\.(jpe?g|png)(.*)?\)/mg;
                var match;

                while ((match = imgpatt.exec(contents))) {
                    var srcFile = match[2] + "." + match[3];
                    var imgrep = "<img src=\"" + match[2] + "_" + defaultSize + "." + match[3] + "\" ";

                    // Ignore external images
                    //
                    if (match[2].startsWith("http")) continue;

                    imgrep += "title=\"" + match[1] + "\" srcset=\"";
                    sizes.forEach(function(size) {
                        var dstFile = match[2] + "_" + size + "." + match[3];
                        var srcPath = path.join(src, parentDir, srcFile);
                        var dstPath = path.join(src, parentDir, dstFile);
                        var data;

                        imgrep += dstFile + " " + size + "w, ";

                        try {
                            data = fs.readFileSync(srcPath);
                            var f1 = fs.statSync(srcPath);
                            var f2 = fs.statSync(dstPath);
                            if (f1.mtime.getTime() > f2.mtime.getTime()) {
                                throw "Regenerate";
                            }
                        }
                        catch(err) {
                            console.log('-- srcset: regenerating', dstPath);
                            data = im.convert({
                                srcData: data,
                                width: size,
                                resizeStyle: 'aspectfit',
                                gravity: 'Center'
                            });
                            fs.writeFileSync(dstPath, data);
                        }

                        srcPath = dstPath;
                        dstPath = path.join(dst, parentDir, dstFile);
                        try {
                            var f1 = fs.statSync(srcPath);
                            var f2 = fs.statSync(dstPath);
                            if (f1.mtime.getTime() > f2.mtime.getTime()) {
                                throw "Copy";
                            }
                        }
                        catch(err) {
                            console.log('-- srcset: copying to ', dstPath);
                            mkdirp.sync(path.dirname(dstPath));
                            fs.writeFileSync(dstPath, data);
                        }

                    });

                    // ensure the appropriate sizes rule is updates
                    imgrep += "\" sizes=\"" + rule + "\"";
                    imgrep += "/>";

                    // add attribition element if required
                    if (attribution) {
                        var attr = "";
                        var caption = "";
                        var url = "";

                        if (match[1].indexOf("http://") >= 0) {
                            caption = match[1].substring(0, match[1].indexOf("http://")-1);
                            url = match[1].substring(match[1].indexOf("http://"));
                        } else {
                            caption = match[1];
                        }

                        attr += "<figcaption>";
                        if (url !== "") {
                            attr += "<a href=\"" + url + "\">";
                        }
                        attr += caption;
                        if (url !== "") {
                            attr += "</a>";
                        }
                        attr += "</figcaption>";

                        imgrep = "<figure>" + imgrep + attr + "</figure>";
                    }

                    contents = contents.replace(match[0], imgrep);
                }
                // write the file contents back to the file.
                files[file].contents = new Buffer(contents);
            }
        }
        
        for (file in added) {
            files[file] = added[file];
        }
        
        return done();
    });
};

module.exports = srcset;
