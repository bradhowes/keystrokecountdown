function run(firstTime) {

    var branch = require('metalsmith-branch');
    var cleancss = require('metalsmith-clean-css');
    var collections = require('metalsmith-collections');
    var convert = require('metalsmith-convert');
    var concat = require('metalsmith-concat');
    var crypto = require('crypto');
    var define = require('metalsmith-define');
    var entities = require('entities');
    var fs = require('fs');
    var Gaze = require('gaze').Gaze;
    var layouts = require('metalsmith-layouts');
    var markdown = require('metalsmith-markdown-remarkable');
    var metalsmith = require('metalsmith');
    var moment = require('moment');
    var notebookjs = require('notebookjs');
    var path = require('path');
    var remarkable = require('remarkable');
    var serve = require('metalsmith-serve');
    var snippet = require('metalsmith-snippet');
    var srcset = require('./srcset');
    var uglify = require('metalsmith-uglify');
    var argv = require('yargs')
        .option('p', {
            alias: 'prod',
            default: false,
            describe: 'running in production',
            type: 'boolean'})
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
    var ifFirstTime = function(proc) { return maybe(firstTime, proc); };

    /*
     * Meta data for the templates.
     */
    var site = {
        isProd: isProd,
        url: 'http://keystrokecountdown.com',
        title: 'Keystroke Countdown',
        description: 'Sporadic musings on software, algorithms, platforms',
        navigation: null,
        integrations: {
            /* disqus: 'blakeembrey', */
            /* analytics: 'UA-22855713-2' */
        },
        author: {
            name: "Brad Howes",
            bio: "Programmer in C++, Python, Swift, Javascript, Elisp. Started out doing punch cards in FORTRAN.",
            image: '/images/HarrisonsLaugh.jpg',
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
        html: true,
        sup: true,
        breaks: false,
        typographer: true,
        smartypants: true,
        gfm: true,
        footnote: true,
        tables: true,
        langPrefix: 'language-'
    };

    var md = new remarkable('full', markdownOptions);

    var assetHash = crypto.createHash('md5').update('' + Date.now()).digest('hex').substring(0, 10);

    function absPath(p) { return path.join(__dirname, p); }

    function formatDate(date) {
        var format = "MMM Do, YYYY", tmp;
        if (typeof date === 'object') {
            format = date.hash.format;
            date = moment.now();
        }
        return moment(date).format(format);
    };

    function relativeUrl(url) {
        var dir = path.dirname(url);
        var ext = path.extname(url);
        if (ext == '.md' || ext == '.ipynb') url = url.replace(ext, '.html');
        if (isProd && (dir == 'css' || dir == 'js')) {
            url = url + '?v=' + encodeURIComponent(assetHash);
        }

        url = path.join('/', url);
        return url;
    }

    function updateMetadata(file, data) {
        var url = relativeUrl(file);
        data.relativeUrl = url;
        data.absoluteUrl = path.join(site.url, url);

        if (typeof data.author === 'undefined') data["author"] = site.author.name;
        if (typeof data.date === 'undefined') {
            data.date = "";
            data.formattedDate = "";
        }
        else {
            data.formattedDate = formatDate(data.date);
        }

        if (data.image) {
            var prefix = path.dirname(url);
            data.image = path.join('/', prefix, data.image).replace(/ /g, "%20");
        }
    }

    /**
     * Generate a 'snippet' of text from Markdown material.
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
        var para = contents.toString().split("\n\n")[0].replace(/\[(.*)\]\(.*\)/g, '$1');
        var bits = para.replace(/\\\\\((.*)\\\\\)/g, '$1').split(/[ \n]+/);
        var index = 0;
        var maxLength = site.snippet.maxLength;
        var snippet = '';
        while (index < bits.length && (snippet.length + bits[index].length + 1) < maxLength) {
            if (bits[index].length > 0) {
                snippet += ' ' + bits[index];
            }
            index += 1;
        }

        // If there are still some words remaining in the paragraph, add an elipses
        //
        if (index < bits.length) snippet += site.snippet.suffix;
        
        // Convert the Markdown into HTML and return.
        //
        return md.render(snippet + '\n\n');
    }

    metalsmith(absPath(''))
        .clean(false)
        .source(absPath('./src'))
        .destination('/Users/howes/Sites/keystrokecountdown')
        .ignore([".~/*", "**/*~", "**/.~/*"])
        .use(define({site: site}))
        .use(srcset({
            rule: "(min-width: 768px) 625px, calc(100vw-6rem)",
            sizes: site.images,
            attribution: true,
            fileExtension: ".md"
        }))
        .use(branch('**/*.md')
            .use(function(files, metalsmith, done) {
                Object.keys(files).forEach(function(file) {
                    var data = files[file];
                    updateMetadata(file, data);
                    if (typeof data["snippet"] == 'undefined') {
                        data.snippet = createSnippet(data.contents);
                    }
                });
                return done();
            })
            .use(markdown('full', markdownOptions))
        )
        .use(branch('**/*.ipynb')
            .use(function(files, metalsmith, done) {
                Object.keys(files).forEach(function(file) {
                    var data = files[file];
                    var html = file.replace('.ipynb', '.html');
                    var ipynb, notebook, str;
                    var tmp;

                    ipynb = JSON.parse(fs.readFileSync(path.join(metalsmith.source(), file)));
                    tmp = ipynb["metadata"]["nikola"];
                    notebook = notebookjs.parse(ipynb);
                    str = notebook.render().outerHTML;

                    data.contents = new Buffer(str);
                    data.title = tmp["title"] || path.basename(path.dirname(file));
                    if (tmp["image"]) {
                        data.image = tmp["image"];
                    }

                    data.author = tmp["author"] || site.author.name;
                    data.layout = 'post.hbs';
                    data.tags = tmp["tags"] || "";
                    data.description = tmp["description"] || "";

                    if (tmp["date"]) {
                        data.date = moment(tmp["date"]).format();
                        data.formattedDate = formatDate(tmp["date"]);
                    }
                    else {
                        data.date = "";
                        data.formattedDate = "";
                    }

                    updateMetadata(file, data);
                    data["snippet"] = createSnippet(data["description"]);

                    delete files[file];
                    files[html] = data;
                });

                return done();
        }))
        .use(collections({
            articles: {
                pattern: 'articles/**/*.html',
                sortBy: 'date',
                reverse: true
            }
        }))
        .use(layouts({
            engine: "handlebars",
            directory: "templates",
            partials: "templates/partials",
            pattern: "**/*.html",
            helpers: {
                encode: encodeURIComponent,
                date: formatDate,
                asset: relativeUrl
            }
        }))
        .use(concat({
            files: 'css/*.css',
            output: 'css/all.css'
        }))
        .use(cleancss({
            files: 'css/*.css'
        }))
        .use(uglify({
            order: ["js/katex-0.6.0.min.js", "js/prism.min.js", "js/index.html"],
            filter: "js/*.js",
            concat: "js/all.js"
        }))
        .use(ifFirstTime(function(files, metalsmith, done) {
            
            // Locations to watch for file changes.
            //
            var paths = [
                "src/**/*.+(ipynb|md)", // HTML source files
                "src/css/**/*",         // CSS and font files
                "src/js/**/*",          // Javascript files
                "templates/**/*"        // Handlebar templates and partials
            ];

            if (typeof metalsmith["__gazer"] == 'undefined') {
                var pendingUpdate = false;
                var updateDelay = 100; // msecs

                console.log('-- watcher: starting');
                metalsmith.__gazer = new Gaze(paths);
                metalsmith.__gazer.on('all', function(event, path) {
                    console.log('-- watcher:', path, event);
                    if (pendingUpdate) {
                        clearTimeout(pendingUpdate);
                    }
                    pendingUpdate = setTimeout(function() {
                        console.log('-- watcher: rebuilding');
                        run(false);
                        console.log('-- watcher: done');
                    }, updateDelay);
                });
            }

            return done();
        }))
        .use(ifFirstTime(serve({
            port: 7000,
            http_error_files: {
                404: "/404.html"
            }
        })))
        .build(function (err) {
            if (err) {
                console.log(err);
                throw err;
            }
        });
}

run(true);
