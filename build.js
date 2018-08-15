"use strict";

var branch = require("metalsmith-branch");
var ccss = require("metalsmith-clean-css");
var collections = require("metalsmith-collections");
var crypto = require("crypto");
var define = require("metalsmith-define");
var fs = require("fs");
var Gaze = require("gaze").Gaze;
var KatexFilter = require("notebookjs-katex");
var katexPlugin = require("remarkable-katex");
var layouts = require("metalsmith-layouts");
var metalsmith = require("metalsmith");
var minify = require("html-minifier").minify;
var moment = require("moment");
var nb = require("notebookjs");
var path = require("path");
var Prism = require('prismjs');
var Remarkable = require("remarkable");
var rimraf = require("rimraf");
var rss = require("metalsmith-rss");
var serve = require("metalsmith-serve");
var tags = require("metalsmith-tags");
var uglify = require("metalsmith-uglifyjs");

// var srcset = require("./srcset");

var home = process.env["HOME"];

var argv = require("yargs")
    .option("p", {alias: "prod", default: false, describe: "running in production", type: "boolean"})
    .option("n", {alias: "noserve", default: false, describe: "do not run web server after building",
                  type: "boolean"})
    .argv;

var isProd = argv.p;

function run(firstTime) {
    
    /*
     * Run text through Prism for coloring.
     */
    var highlighter = function(code, lang) {
        if (typeof lang === 'undefined') {
            lang = 'markup';
        }

        if (!Prism.languages.hasOwnProperty(lang)) {
            try {
                require('prismjs/components/prism-' + lang + '.js');
            } catch (e) {
                console.warn('** failed to load Prism lang: ' + lang);
                Prism.languages[lang] = false;
            }
        }

        return Prism.languages[lang] ? Prism.highlight(code, Prism.languages[lang]) : code;
    };

    nb.highlighter = function(text, pre, code, lang) {
        var language = lang || 'text';
        pre.className = 'language-' + language;
        if (typeof code != 'undefined') {
            code.className = 'language-' + language;
        }
        return highlighter(text, language);
    };

    /*
     * Settings for the Remarkable Markdown processor. Declared here since we render in two places: normal *.md
     * processing; snippet generation.
     */
    var markdownOptions = {
        html: true,             // Allow and pass inline HTML
        sup: true,              // Accept '^' as a superscript operator
        breaks: false,          // Require two new lines to end a paragraph
        typographer: true,      // Allow substitutions for nicer looking text
        smartypants: true,      // Allow substitutions for nicer looking text
        gfm: true,              // Allow GitHub Flavored Markdown (GFM) constructs
        footnote: true,         // Allow footnotes
        tables: true,           // Allow table constructs
        langPrefix: "language-", // Prefix to use for <code> language designation (set to match Prism setting)
        highlight: highlighter
    };

    /*
     * Meta data for the templates.
     */
    var site = {
        isProd: isProd,
        url: "https://keystrokecountdown.com",
        title: "Keystroke Countdown",
        description: "Sporadic musings on software, algorithms, platforms",
        navigation: null,
        integrations: {
            verification: "5iLi_clt29n1AVjPn8ELBcDwVQn4RZgG20-Cxs1Vcrw",
            analytics: "UA-77645652-1"
        },
        author: {
            name: "Brad Howes",
            email: "bradhowes@mac.com (Brad Howes)",
            bio: "Programmer in C++, Python, Swift, Javascript, Elisp. Started out doing punch cards in FORTRAN.",
            image: "/images/HarrisonsLaugh.png",
            location: "Paris, France",
            website: "http://linkedin.com/in/bradhowes"
        },
        images: {
            sizes: [300, 400, 500, 650, 750, 1000, 1500],
            defaultSize: 650
        },
        snippet: {
            maxLength: 280,
            suffix: "..."       // Will be replaced by elipses character (…) during Markdown processing
        }
    };

    var md = new Remarkable("full", markdownOptions).use(katexPlugin).use(require("./consoleFence.js"));
    md.renderer.rules.fence = require("./codeFence.js");

    /*
     * Add custom fence processor for "```graph" blocks.
     */
    md.renderer.rules.fence_custom.graph = require("./graphFence.js");

    var fingerprinter = function(files, metalsmith, filepath, contentsArray) {
        var contents = contentsArray.join('');
        var hash = crypto.createHmac('md5', 'metalsmith').update(contents).digest('hex');
        console.log('--', filepath, hash);
        var ext = path.extname(filepath);
        var fingerprinted = [filepath.substring(0, filepath.lastIndexOf(ext)), '-', hash, ext]
            .join('').replace(/\\/g, '/');
        files[fingerprinted] = {contents: contents};
        metalsmith.metadata()[filepath] = relativeUrl(fingerprinted);
    };

    /*
     * Metalsmith plugin that does nothing.
     */
    var noop = function(files, metalsmith, done) { return process.nextTick(done); };

    /*
     * Metalsmith plugin that executs a proc if a give test value evaluates to true.
     */
    var maybe = function(test, proc) { return test ? proc : noop; };
        
    /*
     * Metalsmith plugin that executes a proc only if `firsttime` is true.
     */
    var ifFirstTime = function(proc) { return maybe(firstTime && !argv.n, proc); };

    /*
     * Convert a relative directory to an absolute one.
     */
    function absPath(p) { return path.join(__dirname, p); }

    /*
     * Obtain a string representation of a date in a particular format. The sole (optional) parameter `date`
     * can be a timestamp OR an object. If the former, then convert the date into the format "Month Day, Year". 
     * If the latter, then take the format from the object and use "now" as the timestamp to convert.
     */
    function formatDate(date) {
        var format = "MMM Do, YYYY";
        if (typeof date['hash'] !== 'undefined') {
            
            // We must have a custom format. Use the date that is from the article
            //
            format = date['hash'].format;
            date = date['data'].root.date;
        }
        return moment(date).format(format);
    };

    /*
     * Obtain a relative URL from the given argument.
     */
    function relativeUrl(url) {
        var dir, ext;
        dir = path.dirname(url);
        ext = path.extname(url);
        if (ext == ".md" || ext == ".ipynb") url = url.replace(ext, ".html");
        url = path.join("/", url);
        return url;
    }

    function asset(url) {
        return relativeUrl(url);
    }

    /**
     * Set various metadata elements for a given build file.
     * @param file the relative path of the file being processed
     * @param data the build object for the file
     */
    function updateMetadata(file, data) {
        var url = relativeUrl(file);

        data.relativeUrl = url;
        data.absoluteUrl = path.join(site.url, url);
        data.url = data.relativeUrl; // !!! This is for the RSS generator

        if (typeof data["author"] === "undefined") data["author"] = site.author.name;
        if (typeof data["draft"] === "undefined") data["draft"] = false;
        if (typeof data["tags"] === "undefined") data["tags"] = '';

        if (data.draft) {
            data.title = '[DRAFT] ' + data.title;
            if (data.tags.length) data.tags += ',';
            data.tags += 'DRAFT';
        }

        if (typeof data["date"] === "undefined") {
            data.date = "";
            data.formattedDate = "";
        }
        else {
            data.formattedDate = formatDate(data.date);
        }

        data.postDate = data.date;

        if (data.image) {
            var prefix = path.dirname(url);
            data.image = path.join("/", prefix, data.image).replace(/ /g, "%20");
        }
    }

    /**
     * Generate a "snippet" of text from Markdown material.
     * @param contents the Markdown text to use as the source material.
     * @return HTML code containing the snippet text between <p> tags.
     */
    function createSnippet(contents) {

        // Strategy:
        // - get first Markdown paragraph
        // - replace any inline images with their alt text values
        // - remove any inline Katex (MathJax) operators
        // - split the paragraph into words
        // - accumulate words until all of the words are used or the snippet reaches the max length limit
        //
        var para = contents.toString().split("\n\n")[0].replace(/\[(.*)\]\(.*\)/g, "$1");
        var bits = para.split(/[ \n]+/);
        var index = 0;
        var maxLength = site.snippet.maxLength;
        var snippet = "";
        while (index < bits.length && (snippet.length + bits[index].length + 1) < maxLength) {
            if (bits[index].length > 0) {
                snippet += " " + bits[index];
            }
            index += 1;
        }

        // If there are still some words remaining in the paragraph, add an elipses
        //
        if (index < bits.length) snippet += site.snippet.suffix;

        return snippet + "\n\n";
    }

    // --- Start of Metalsmith processing ---

    if (firstTime) console.log("-- isProd:", isProd, "noserve:", argv.n);

    metalsmith(absPath(""))
        .clean(false)           // !!! Necessary to keep our .git directory at the destination
        .source(absPath("./src"))
        .destination(home + "/Sites/keystrokecountdown")
        .ignore([".~/*", "**/*~", "**/.~/*"]) // Ignore Emacs backup files
        .use(define({site: site}))            // Pass in `site` definitions from above
        .use(function(files, metalsmith, done) {
            
            // We generate consolidated Javascript and CSS files that are tagged with a MD5 hash to overcome any
            // HTTP resource caching. Blow away anything with older hashes in the css and js directories before
            // we generate a new version.
            //
            var glob = metalsmith.destination() + '/{css,js}/all-*.*';
            console.log('-- removing', glob);
            rimraf(glob, function (err) {
                console.log('-- done removing', glob);
                return process.nextTick(done);
            });
        })
        .use(branch("**/*.css")
             
             // Process CSS files here. Minify them then concatenate their contents and make one file which has
             // a name based on a hash of the concatenated contents.
             //
            .use(function(files, metalsmith, done) {
                var outputPath = "css/all.css";
                var contentsArray = Object.keys(files).map(function(filepath) {
                    var content = files[filepath].contents;
                    delete files[filepath];
                    return content;
                });

                if (typeof contentsArray !== 'undefined') {
                    fingerprinter(files, metalsmith, outputPath, contentsArray);
                }

                return process.nextTick(done);
            })
        )
        .use(branch("**/*.js")
             
             // Process JS files here. Uglify them then concatenate their contents and make one file which has a
             // name based on a hash of the concatenated contents.
             //
            .use(uglify({deleteSources: true}))
            .use(function(files, metalsmith, done) {
                var outputPath = "js/all.js";
                var contentsArray = Object.keys(files).map(function(filepath) {
                    var content = '';
                    if (/^.*.min.js$/.test(filepath) === true) {
                        content = files[filepath].contents;
                    }
                    delete files[filepath];
                    return content;
                });

                if (typeof contentsArray !== 'undefined') {
                    fingerprinter(files, metalsmith, outputPath, contentsArray);
                }

                return process.nextTick(done);
            })
        )
        .use(branch("**/*.md")
            .use(function(files, metalsmith, done) {
                Object.keys(files).forEach(function(file) {
                    var data = files[file];

                    // Update metadata for each Markdown file. Create a description from the initial text of the
                    // page if not set. We create *another* Markdown parser just to handle auto-generated
                    // snippet text.
                    //
                    updateMetadata(file, data);
                    
                    // If the post does not have a description, generate one based on the start of post.
                    //
                    if (typeof data["description"] === "undefined" || data.description.length === 0) {
                        data.description = md.render(createSnippet(data.contents));
                    }

                    // Generate proper path and URL for the post
                    //
                    var dirName = path.dirname(file),
                        htmlName = path.basename(file, path.extname(file)) + '.html';
                    if (dirName !== '.') {
                        htmlName = dirName + '/' + htmlName;
                    }

                    // Generate HTML from the Markdown.
                    //
                    var str = md.render(data.contents.toString());
                    data.contents = new Buffer(str);
                    delete files[file];
                    files[htmlName] = data;
                });
                return process.nextTick(done);
            })
        )
        .use(branch("**/*.ipynb")
            .use(function(files, metalsmith, done) {
                
                // Convert IPython files into HTML. Handles math expressions - $...$ and $$...$$
                //
                var kf = new KatexFilter();
                Object.keys(files).forEach(function(file) {
                    var data = files[file];
                    var html = file.replace(".ipynb", ".html");
                    var ipynb = JSON.parse(fs.readFileSync(path.join(metalsmith.source(), file)));

                    kf.expandKatexInNotebook(ipynb);

                    var blog = ipynb["metadata"]["blog"];
                    if (typeof blog === "undefined") {
                        console.log("** skipping IPython file", file, "-- missing 'blog' contents");
                        return;
                    }

                    // Parse the notebook and generate HTML from it
                    //
                    var notebook = nb.parse(ipynb);
                    var str = notebook.render().outerHTML;
                    data.contents = new Buffer(str);

                    // Set metadata
                    //
                    data.title = blog["title"] || path.basename(path.dirname(file));
                    if (blog["image"]) {
                        data.image = blog["image"];
                    }

                    data.author = blog["author"] || site.author.name;
                    data.layout = "post.hbs";
                    data.tags = blog["tags"] || "";
                    data.description = blog["description"] || "";
                    data.date = moment(blog["date"] || "").toDate();
                    
                    updateMetadata(file, data);

                    delete files[file];
                    files[html] = data;
                });

                return process.nextTick(done);
            })
        )
        .use(function(files, metalsmith, done) {

            // Strip out anything that is a draft when building production artifacts
            //
            Object.keys(files).forEach(function(file) {
                var data = files[file];

                // Don't process this article if it is just a draft post AND we are in `prod` mode
                //
                if (data.draft && isProd) {
                    console.log('-- removing draft', file);
                    delete files[file];
                }
            });
            return process.nextTick(done);
        })
        .use(tags({             // Generate tag pages for the files above
            handle: "tags",
            path: "topics/:tag.html",
            layout: "tag.hbs",
            sortBy: "date",
            reverse: true
        }))
        .use(function(files, metalsmith, done) {

            // Generate an array of tag objects alphabetically ordered in case-insensitive manner. Also, add to
            // each tag object an `articleCount` with the number of articles containing the tag, and a `tag`
            // attribute containing the tag value.
            //
            var sortedTags = [];
            var tags = metalsmith.metadata()["tags"];
            Object.keys(tags).forEach(function(tag) {
                tags[tag].articleCount = tags[tag].length;
                tags[tag].tag = tag;
                sortedTags.push([tag.toLowerCase(), tags[tag]]);
            });

            // Sort the lower-case tags
            //
            sortedTags.sort(function(a, b) {return a[0].localeCompare(b[0]);});

            // Save the array of tag objects that are properly ordered -- used to render 'topics.html'
            //
            metalsmith.metadata()["sortedTags"] = sortedTags.map(function(a) {return a[1];});

            // Revise article metadata so that each tag is the tag object, and if there is no image, use
            // a default one from the home page.
            //
            Object.keys(files).forEach(function(file) {
                var data = files[file];
                if (! data["image"]) {
                    data["image"] = "/computer-keyboard-stones-on-grass-background-header.jpg";
                }

                if (data["tags"] && data["tags"].length) {
                    var tmp = data["tags"];
                    tmp.sort(function(a, b) {return a.slug.localeCompare(b.slug);});
                    data["tags"] = tmp.map(function(a) {return tags[a.name];});
                }
            });

            return process.nextTick(done);
        })
       .use(collections({      // Generate a collection of all of the articles
            articles: {
                pattern: "articles/**/*.html",
                sortBy: "date",
                reverse: true
            }
        }))
        .use(layouts({          // Generate HTML pages from Handlebar templates
            engine: "handlebars",
            directory: "templates",
            partials: "templates/partials",
            pattern: "**/*.html",
            cache: false,
            helpers: {
                encode: encodeURIComponent,
                date: formatDate,
                asset: asset
            }
        }))
        .use(rss({              // Generate an `rss.xml` file for all of the articles
            feedOptions: {
                title: site.title,
                description: site.description,
                site_url: site.url,
                feed_url: site.url + "/rss.xml",
                managingEditor: site.author.email,
                copyright: "Copyright © 2016, Brad Howes",
                language: "en"
            },
            collection: "articles",
            limit: 50,
            destination: "rss.xml"
        }))
        .use(function(files, metalsmith, done) {
            
            // The stock RSS generator wraps many of the text values in CDATA. Undo that since it seems to break
            // some RSS readers when they try to follow a URL from the CDATA.
            //
            var data = files["rss.xml"];
            var content = data.contents.toString();
            content = content.replace(/<!\[CDATA\[/g, '');
            content = content.replace(/]]>/g, '');
            data.contents = content;
            return process.nextTick(done);
        })
        .use(function(files, metalsmith, done) {

            // Minify all HTML docs.
            //
            Object.keys(files).forEach(function(filepath) {
                if (/.html$/.test(filepath) === true) {
                    var data = files[filepath];
                    var contents = data.contents.toString();
                    var minned = minify(contents, {removeComments: true,
                                                   removeCommentsFromCDATA: true,
                                                   collapseWhitespace: true,
                                                   removeAttributeQuotes: true});
                    files[filepath].contents = minned;
                }
            });
            return process.nextTick(done);
        })
        .use(ifFirstTime(function(files, metalsmith, done) {
            
            // Watch for changes in the source files.
            //
            var paths = [
                "src/**/*.+(ipynb|md)", // HTML source files
                "src/css/**/*",         // CSS and font files
                "src/js/**/*",          // Javascript files
                "templates/**/*"        // Handlebar templates and partials
            ];

            if (typeof metalsmith["__gazer"] === "undefined") {
                
                // Need to create a new file watcher
                //
                var pendingUpdate = false;
                var updateDelay = 100; // msecs

                console.log("-- watcher: starting");
                metalsmith.__gazer = new Gaze(paths);
                metalsmith.__gazer.on("all", function(event, path) {
                    console.log("-- watcher:", path, event);
                    if (pendingUpdate) {
                        clearTimeout(pendingUpdate);
                    }
                    pendingUpdate = setTimeout(function() {
                        console.log("-- watcher: rebuilding");

                        // Reexecute `run` with firstTime == false
                        //
                        run(false);
                        console.log("-- watcher: done");
                    }, updateDelay);
                });
            }

            return process.nextTick(done);
        }))
        .use(ifFirstTime(serve({ // Start a simple HTTP server to serve the generated HTML files.
            port: 7000,
            http_error_files: {
                404: "/404.html"
            }
        })))
        .build(function (err) { // Execute all of the above.
            if (err) {
                console.log(err);
                // throw err;
            }
        });
}

// Execute `run` with firstTime = true
//
run(true);
