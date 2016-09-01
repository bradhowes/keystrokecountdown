function run(firstTime) {

    var branch = require("metalsmith-branch");
    var cleancss = require("metalsmith-clean-css");
    var collections = require("metalsmith-collections");
    var concat = require("metalsmith-concat");
    var crypto = require("crypto");
    var define = require("metalsmith-define");
    var entities = require("entities");
    var fs = require("fs");
    var Gaze = require("gaze").Gaze;
    var layouts = require("metalsmith-layouts");
    var markdown = require("metalsmith-markdown-remarkable");
    var metalsmith = require("metalsmith");
    var moment = require("moment");
    var notebookjs = require("notebookjs");
    var path = require("path");
    var remarkable = require("remarkable");
    var rss = require("metalsmith-rss");
    var serve = require("metalsmith-serve");
    var tags = require("metalsmith-tags");
    var uglify = require("metalsmith-uglify");
    var srcset = require("./srcset");
    var home = process.env["HOME"];
    
    var argv = require("yargs")
        .option("p", {
            alias: "prod",
            default: false,
            describe: "running in production",
            type: "boolean"})
        .option("n", {
            alias: "noserve",
            default: false,
            describe: "do not run web server after building",
            type: "boolean"})
        .argv;

    var isProd = argv.p;

    /*
     * Metalsmith plugin that does nothing.
     */
    var noop = function(files, metalsmith, done) { return done(); };
    
    /*
     * Metalsmith plugin that executs a proc if a give test value evaluates to true.
     */
    var maybe = function(test, proc) { return test ? proc : noop; };

    /*
     * Metalsmith plugin that executes a proc only if `firsttime` is true.
     */
    var ifFirstTime = function(proc) { return maybe(firstTime && !argv.n, proc); };

    /*
     * Meta data for the templates.
     */
    var site = {
        isProd: isProd,
        url: "http://keystrokecountdown.com",
        title: "Keystroke Countdown",
        description: "Sporadic musings on software, algorithms, platforms",
        navigation: null,
        integrations: {
            verification: "5iLi_clt29n1AVjPn8ELBcDwVQn4RZgG20-Cxs1Vcrw",
            analytics: "UA-77645652-1"
        },
        author: {
            name: "Brad Howes",
            bio: "Programmer in C++, Python, Swift, Javascript, Elisp. Started out doing punch cards in FORTRAN.",
            image: "/images/HarrisonsLaugh.jpg",
            location: "Prague, Czech Republic",
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
        langPrefix: "language-" // Prefix to use for <code> language designation (set to match Prism setting)
    };

    /*
     * Create a Markdown converter that we will use when converting Markdown text for the snippet.
     */
    var md = new remarkable("full", markdownOptions);

    /*
     * Generate a hash value that we will append to CSS and Javascript assests.
     */
    var assetHash = crypto.createHash("md5").update("" + Date.now()).digest("hex").substring(0, 10);

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
        var format = "MMM Do, YYYY", tmp;
        if (typeof date === "object") {
            format = date.hash.format;
            date = moment.now();
        }
        return moment(date).format(format);
    };

    /*
     * Obtain a relative URL from the given argument.
     */
    function relativeUrl(url) {
        var dir = path.dirname(url);
        var ext = path.extname(url);
        if (ext == ".md" || ext == ".ipynb") url = url.replace(ext, ".html");
        if (isProd && (dir == "css" || dir == "js")) {
            url = url + "?v=" + encodeURIComponent(assetHash);
        }
        url = path.join("/", url);
        return url;
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
        
        if (typeof data["date"] === "undefined") {
            data.date = "";
            data.formattedDate = "";
        }
        else {
            data.formattedDate = formatDate(data.date);
        }

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
        var bits = para.replace(/\\\\\((.*)\\\\\)/g, "$1").split(/[ \n]+/);
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

        // Convert the Markdown into HTML and return.
        //
        return md.render(snippet + "\n\n");
    }

    // --- Start of Metalsmith processing ---

    if (firstTime) console.log("-- isProd:", isProd, "noserve:", argv.n);

    metalsmith(absPath(""))
        .clean(false)           // !!! Necessary to keep our .git directory at the destination
        .source(absPath("./src"))
        .destination(home + "/Sites/keystrokecountdown")
        .ignore([".~/*", "**/*~", "**/.~/*"]) // Ignore Emacs backup files
        .use(define({site: site}))            // Pass in `site` definitions from above
        .use(srcset({                         // Generate images for various screen sizes
            rule: "(min-width: 768px) 625px, calc(100vw-6rem)",
            sizes: site.images,
            attribution: true,
            fileExtension: ".md"
        }))
        .use(branch("**/*.md")
            .use(function(files, metalsmith, done) {
                
                // Generate metadata for each Markdown file.
                //
                Object.keys(files).forEach(function(file) {
                    var data = files[file];
                    updateMetadata(file, data);
                    if (typeof data["description"] === "undefined" || data.description === '') {
                        data.description = createSnippet(data.contents);
                    }
                });
                return done();
            })
            .use(markdown("full", markdownOptions)) // Generate HTML from Markdown
        )
        .use(branch("**/*.ipynb")
            .use(function(files, metalsmith, done) {
                
                // Convert preprocessed IPython files into HTML.
                //
                Object.keys(files).forEach(function(file) {
                    var data = files[file];
                    var html = file.replace(".ipynb", ".html");
                    var ipynb, notebook, str;
                    var tmp;

                    ipynb = JSON.parse(fs.readFileSync(path.join(metalsmith.source(), file)));
                    tmp = ipynb["metadata"]["blog"];

                    if (typeof tmp === "undefined") {
                        console.log("** skipping IPython file", file, "-- missing 'blog' contents");
                        return;
                    }
                    
                    // Parse the notebook and generate HTML from it
                    //
                    notebook = notebookjs.parse(ipynb);
                    str = notebook.render().outerHTML;
                    data.contents = new Buffer(str);
                    
                    // Set metadata
                    //
                    data.title = tmp["title"] || path.basename(path.dirname(file));
                    if (tmp["image"]) {
                        data.image = tmp["image"];
                    }

                    data.author = tmp["author"] || site.author.name;
                    data.layout = "post.hbs";
                    data.tags = tmp["tags"] || "";
                    data.description = tmp["description"] || "";
                    data.date = tmp["date"] || "";
                    
                    updateMetadata(file, data);

                    delete files[file];
                    files[html] = data;
                });

                return done();
        }))
        .use(tags({             // Generate tag pages
            handle: "tags",
            path: "topics/:tag.html",
            layout: "tag.hbs",
            sortBy: "tag"
        }))
        .use(function(files, metalsmith, done) {

            // Generate an array of tag objects alphabetically ordered in case-insensitive manner. Also, add to
            // each tag object an `articleCount` with the number of articles containing the tag, and a `tag`
            // attribute containing the tag value.
            //
            var sortedTags = [];
            var tags = metalsmith.metadata()["tags"];
            Object.keys(tags).forEach(function(tag) {
                var count = tags[tag].length;
                tags[tag].articleCount = count;
                tags[tag].tag = tag;
                sortedTags.push([tag.toLowerCase(), tags[tag]]);
            });

            // Sort the lower-case tags
            //
            sortedTags.sort(function(a, b) {return a[0].localeCompare(b[0]);});

            // Save the array of tag objects that are properly ordered
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
                    data["tags"] = data["tags"].map(function(a) {return tags[a];});
                }
            });

            return done();
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
                asset: relativeUrl
            }
        }))
        .use(concat({           // Generate one CSS file
            files: "css/*.css",
            output: "css/all.css"
        }))
        .use(cleancss({         // Compress the CSS file
            files: "css/*.css"
        }))
        .use(uglify({           // Generate one Javascript file and compress it
            order: ["js/katex-0.6.0.min.js", "js/prism.min.js", "js/index.js"],
            filter: "js/*.js",
            concat: "js/all.js"
        }))
        .use(rss({              // Generate an `rss.xml` file for all of the articles
            feedOptions: {
                title: site.title,
                description: site.description,
                site_url: site.url,
                feed_url: site.url + "/rss.xml",
                managingEditor: site.author.name,
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
            return done();
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

            if (typeof metalsmith["__gazer"] == "undefined") {
                
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
                        run(false);
                        console.log("-- watcher: done");
                    }, updateDelay);
                });
            }

            return done();
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
                throw err;
            }
        });
}

run(true);
