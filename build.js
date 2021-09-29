"use strict";

const branch = require("metalsmith-branch");
const Buffer = require('buffer').Buffer;
const collections = require("metalsmith-collections");
const crypto = require("crypto");
const define = require("metalsmith-define");
const discoverPartials = require('metalsmith-discover-partials');
const fs = require("fs");
const Gaze = require("gaze").Gaze;
const Handlebars = require('handlebars');
const KatexFilter = require("notebookjs-katex");
const katexPlugin = require("remarkable-katex");
const layouts = require("metalsmith-layouts");
const metalsmith = require("metalsmith");
const minify = require("html-minifier").minify;
const moment = require("moment");
const nb = require("notebookjs");
const path = require("path");
const process = require("process");
const Prism = require('prismjs');
const Remarkable = require("remarkable").Remarkable;
const rimraf = require("rimraf");
const rss = require("metalsmith-rss");
const serve = require("metalsmith-serve");
const srcset = require("./srcset");
const tags = require("metalsmith-tags");
const uglify = require("metalsmith-uglifyjs");

const home = process.env["HOME"];

const argv = require("yargs")
        .option("p", {alias: "prod", default: false, describe: "running in production", type: "boolean"})
        .option("n", {alias: "noserve", default: false, describe: "do not run web server after building",
                      type: "boolean"})
        .argv;

const isProd = argv.p;
const isServing = !argv.n;

/**
 * The `run` function executes the site generation steps. We define it this way so that we can rerun it when
 * a file changes.
 *
 * @param {bool} firstTime when true, this is the initial execution of this method.
 */
const run = firstTime => {

  /**
   * Run text through Prism for coloring.
   *
   * @param {string} code The code text to colorize/highlight
   * @param {string} lang The programming language to format in
   */
  const highlighter = (code, lang) => {
    if (typeof lang === 'undefined') {
      lang = 'markup';
    }

    if (!Object.prototype.hasOwnProperty.call(Prism.languages, lang)) {
      try {
        require('prismjs/components/prism-' + lang + '.js');
      } catch (e) {
        console.warn('** failed to load Prism lang: ' + lang);
        Prism.languages[lang] = false;
      }
    }

    return Prism.languages[lang] ? Prism.highlight(code, Prism.languages[lang]) : code;
  };

  /**
   * Install a custom highlighter in the notebook processor.
   *
   * @param {string} text The text block (code) to process
   * @param {string} pre The `pre` entity that holds a `code` entity
   * @param {string} code The `code` entity that holds the code text
   * @param {string} lang The name of the programming language being used
   */
  nb.highlighter = (text, pre, code, lang) => {
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
  const markdownOptions = {
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
  const site = {
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
      email: "bradhowes@mac.com",
      bio: "Programmer in C++, Swift, Python, Javascript and more. Started out doing punch cards in FORTRAN.",
      appstore: "https://apps.apple.com/us/developer/b-ray-software/id430573224",
      image: "/images/HarrisonsLaugh.png",
      location: "Paris, France",
      website: "http://linkedin.com/in/bradhowes"
    },
    srcset: {
      purgeDrafts: isProd,
      rule: "(min-width: 960px) 960px, calc(100vw-6rem)",
      attribution: true,
      fileExtension: ".md",
      sizes: [480, 650, 960, 1440],
      defaultSize: 960
    },
    snippet: {
      maxLength: 280,
      suffix: "..."       // Will be replaced by elipses character (…) during Markdown processing
    }
  };

  const tagsOptions = {         // Generate tag pages for the files above
    handle: "tags",
    path: "topics/:tag.html",
    layout: "tag.hbs",
    sortBy: "date",
    reverse: true
  };

  const collectionsOptions = {  // Generate a collection of all of the articles
    articles: {
      pattern: "articles/" + "**/" + "*.html",
      sortBy: "date",
      reverse: true
    },
    extras: {
      pattern: "extras/" + "**/" + "*.html"
    }
  };

  /**
   * Obtain a string representation of a date in a particular format. The sole (optional) parameter `date`
   * can be a timestamp OR an object. If the former, then convert the date into the format "Month Day, Year".
   * If the latter, then take the format from the object and use "now" as the timestamp to convert.
   *
   * @param {Date} date The Date to format as a string
   */
  const formatDate = (date) => {
    let format = "MMM Do, YYYY";
    if (typeof date['hash'] !== 'undefined') {

      // We must have a custom format. Use the date that is from the article
      //
      format = date['hash'].format;
      date = date['data'].root.date;
    }
    return moment(date).format(format);
  };

  Handlebars.registerHelper('encode', encodeURIComponent);
  Handlebars.registerHelper('date', formatDate);
  Handlebars.registerHelper('asset', url => relativeUrl(url));

  const layoutsOptions = {
    engine: "handlebars",
    directory: "templates",
    pattern: "**/" + "*.html",
    cache: false,
    helpers: {
      encode: encodeURIComponent,
      date: formatDate,
      asset: url => relativeUrl(url)
    }
  };

  const rssOptions = {          // Generate an `rss.xml` file for all of the articles
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
  };

  const md = new Remarkable("full", markdownOptions).use(katexPlugin)
          .use(require("./codeFence.js"))
          .use(require("./consoleFence.js"))
          .use(require("./graphFence.js"));

  md.renderer.promises = {};
  md.renderer.addPromise = (key, promise) => {
    const placeholder = '@+@' + key + '@+@';
    md.renderer.promises[placeholder] = promise;
    return placeholder;
  };

  /**
   * Generate a `fingerprint` for an array of file paths.
   */
  const fingerprinter = (files, metalsmith, filepath, inputs) => {

    // Order the inputs filenames so we will generate the same hash for the same files.
    inputs.sort();

    // Concatenate the inputs and remove from further processing
    const contents = inputs.map(filepath => files[filepath].contents).join('\n');
    inputs.forEach(filepath => delete files[filepath]);

    // Hash the concatenated result
    const hash = crypto.createHmac('md5', 'metalsmith').update(contents).digest('hex');
    console.log('--', inputs, filepath, hash);

    // Create a new tracking entry for the concatenated file
    const ext = path.extname(filepath);
    const fingerprinted = [filepath.substring(0, filepath.lastIndexOf(ext)), '-', hash, ext]
            .join('').replace(/\\/g, '/');
    files[fingerprinted] = {contents: contents};
    metalsmith.metadata()[filepath] = relativeUrl(fingerprinted);
  };

  /**
   * Metalsmith plugin that does nothing.
   */
  const noop = (files, metalsmith, done) => process.nextTick(done);

  /**
   * Metalsmith plugin that executes a proc if a give test value evaluates to true.
   *
   * @param {bool} test Condition to check
   * @param {function} proc Closure to run if `test` is true
   */
  const maybe = (test, proc) => test ? proc : noop;

  /**
   * Metalsmith plugin that executes a proc only if `firsttime` is true.
   *
   * @param {function} proc Closure to run if this is the first execution of `run`.
   */
  const ifFirstTimeServing = (proc) => maybe(firstTime && isServing, proc);

  /**
   * Convert a relative directory to an absolute one.
   *
   * @param {string} p The relative directory to convert into an abolute one
   */
  const absPath = (p) => path.join(process.cwd(), p);

  /**
   * Obtain a relative URL from the given argument.
   *
   * @param {string} url The location to work with
   */
  const relativeUrl = (url) => {
    let ext = path.extname(url);
    if (ext == ".md" || ext == ".ipynb") url = url.replace(ext, ".html");
    return path.join("/", url);
  };

  /**
   * Set various metadata elements for a given build file.
   *
   * @param file the relative path of the file being processed
   * @param data the build object for the file
   */
  const updateMetadata = (file, data) => {
    const url = relativeUrl(file);

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
      if (data.image[0] !== "/") {
        const prefix = path.dirname(url);
        data.image = path.join("/", prefix, data.image).replace(/ /g, "%20");
      }
    }
  };

  /**
   * Generate a "snippet" of text from Markdown material.
   *
   * @param contents the Markdown text to use as the source material.
   * @return HTML code containing the snippet text between <p> tags.
   */
  const createSnippet = (contents) => {

    // Strategy:
    // - get first Markdown paragraph
    // - replace any inline images with their alt text values
    // - remove any inline Katex (MathJax) operators
    // - split the paragraph into words
    // - accumulate words until all of the words are used or the snippet reaches the max length limit
    //
    const para = contents.toString().split("\n\n")[0].replace(/\[(.*)\]\(.*\)/g, "$1");
    const bits = para.split(/[ \n]+/);
    const maxLength = site.snippet.maxLength;
    let snippet = "";
    let index = 0;
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
  };

  const removeOldFiles = (files, metalsmith, done) => {
    const glob = metalsmith.destination() + '/{css,js}/all-*.*';
    console.log('-- removing', glob);
    rimraf(glob, () => {
      console.log('-- done removing', glob);
      return process.nextTick(done);
    });
  };

  const consolidateCSS = (files, metalsmith, done) => {
    const outputPath = "css/all.css";
    const inputs = Object.keys(files);
    if (inputs.length > 0) fingerprinter(files, metalsmith, outputPath, inputs);
    return process.nextTick(done);
  };

  const consolidateJS = (files, metalsmith, done) => {
    const outputPath = "js/all.js";
    const inputs = Object.keys(files).flatMap(
      filepath => (/^.*.min.js$/.test(filepath) === true) ? filepath : null
    );

    if (inputs.length > 0) fingerprinter(files, metalsmith, outputPath, inputs);
    return process.nextTick(done);
  };

  const updatePostMetadata = (files, metalsmith, done) => {
    Object.keys(files).forEach(file => {
      const data = files[file];

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
    });
    return process.nextTick(done);
  };

  const processMarkdown = (files, metalsmith, done) => {
    Object.keys(files).forEach(file => {
      const data = files[file];

      // Generate proper path and URL for the post
      //
      const dirName = path.dirname(file);
      const htmlName = path.basename(file, path.extname(file)) + '.html';
      const htmlPath = dirName !== '.' ? path.join(dirName, htmlName) : htmlName;

      // Generate HTML from the Markdown.
      //
      var contents = md.render(data.contents.toString());

      // If the rendering left any promises, allow them to update the content with their resolved value.
      //
      for (let [placeholder, promise] of Object.entries(md.renderer.promises)) {
        promise.then(value => {
          contents = contents.replace(placeholder, value);
          return value;
        });
      }

      // Finally, when all promises are done, we update the metadata and signal Metalsmith to continue.
      //
      let allPromise = Promise.all(Object.values(md.renderer.promises));
      allPromise.then(() => {
        data.contents = Buffer.from(contents);
        delete files[file];
        files[htmlPath] = data;
        done();
      });
    });
  };

  const rmdir = (dirPath) => {
    if (fs.existsSync(dirPath)) {
      fs.readdirSync(dirPath).forEach(entry => {
        const entryPath = path.join(dirPath, entry);
        if (fs.lstatSync(entryPath).isDirectory()) {
          rmdir(entryPath);
        } else {
          fs.unlinkSync(entryPath);
        }
      });
      console.log('-- deleting', dirPath);
      fs.rmdirSync(dirPath);
    }
  };

  let drafts = [];
  const deleteDrafts = (files, metalsmith, done) => {
    if (isProd) {

      // Strip out anything that is a draft when building production artifacts
      //
      Object.keys(files).forEach(file => {
        const data = files[file];
        if (data.draft) {
          const parentDir = path.dirname(file);
          drafts.push(parentDir);
          console.log('-- removing draft', file);
          delete files[file];
        }
      });
    }
    return process.nextTick(done);
  };

  const deleteDraftFiles = (files, metalsmith, done) => {
    Object.keys(files).forEach(file => {
      const parentDir = path.dirname(file);
      if (drafts.includes(parentDir)) {
        console.log('-- removing draft file', file);
        delete files[file];
      }
    });
    return process.nextTick(done);
  };

  const rmDraftDirs = (files, metalsmith, done) => {
    drafts.forEach(dir => rmdir(path.join(metalsmith.destination(), dir)));
    return process.nextTick(done);
  };

  const processNotebooks = (files, metalsmith, done) => {

    // Convert IPython files into HTML. Handles math expressions - $...$ and $$...$$
    //
    const kf = new KatexFilter();
    Object.keys(files).forEach(file => {
      const data = files[file];
      const html = file.replace(".ipynb", ".html");
      const ipynb = JSON.parse(fs.readFileSync(path.join(metalsmith.source(), file)));

      kf.expandKatexInNotebook(ipynb);

      const blog = ipynb["metadata"]["blog"];
      if (typeof blog === "undefined") {
        console.log("** skipping IPython file", file, "-- missing 'blog' contents");
        return;
      }

      // Parse the notebook and generate HTML from it
      //
      const notebook = nb.parse(ipynb);
      const str = notebook.render().outerHTML;
      data.contents = Buffer.from(str);

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
  };


  /**
   * Generate an array of tag objects alphabetically ordered in case-insensitive manner. Also, add to each
   * tag object an `articleCount` with the number of articles containing the tag, and a `tag` attribute
   * containing the tag value.
   */
  const processTags = (files, metalsmith, done) => {
    const sortedTags = [];
    const tags = metalsmith.metadata()["tags"];
    Object.keys(tags).forEach(tag => {
      tags[tag].articleCount = tags[tag].length;
      tags[tag].tag = tag;
      sortedTags.push([tag.toLowerCase(), tags[tag]]);
    });

    // Sort the lower-case tags
    //
    sortedTags.sort((a, b) => a[0].localeCompare(b[0]));

    // Save the array of tag objects that are properly ordered -- used to render 'topics.html'
    //
    metalsmith.metadata()["sortedTags"] = sortedTags.map((a) => a[1]);

    // Revise article metadata so that each tag is the tag object, and if there is no image, use a default
    // one from the home page.
    //
    Object.keys(files).forEach(file => {
      const data = files[file];
      if (! data["image"]) data["image"] = "/computer-keyboard-stones-on-grass-background-header.jpg";
      if (data["tags"] && data["tags"].length) {
        const tmp = data["tags"];
        tmp.sort((a, b) => a.slug.localeCompare(b.slug));
        data["tags"] = tmp.map(a => tags[a.name]);
      }
    });

    return process.nextTick(done);
  };

  const filterRSS = (files, metalsmith, done) => {

    // The stock RSS generator wraps many of the text values in CDATA. Undo that since it seems to break
    // some RSS readers when they try to follow a URL from the CDATA.
    //
    const data = files["rss.xml"];
    let content = data.contents.toString();
    content = content.replace(/<!\[CDATA\[/g, '');
    content = content.replace(/]]>/g, '');
    data.contents = content;
    return process.nextTick(done);
  };

  /**
   * Minify all HTML docs.
   */
  const minifyHTML = (files, metalsmith, done) => {
    Object.keys(files).forEach(filepath => {
      if (/.html$/.test(filepath) === true) {
        const data = files[filepath];
        const contents = data.contents.toString();
        const minned = minify(contents, {removeComments: true,
                                         removeCommentsFromCDATA: true,
                                         collapseWhitespace: true,
                                         removeAttributeQuotes: true});
        files[filepath].contents = minned;
      }
    });
    return process.nextTick(done);
  };

  /**
   * Concatenate together the parts of the `ppi.m4v` movie together.
   */
  const concatter = (files, metalsmith, done) => {
    const outputPath = 'articles/radardisplay/ppi.m4v';
    const buffers = [];
    Object.keys(files).forEach(filepath => {
      if (/ppi.m4v.[a-d]$/.test(filepath) === true) {
        buffers.push(files[filepath].contents);
        delete files[filepath];
      }});

    files[outputPath] = {contents: Buffer.concat(buffers)};
    return process.nextTick(done);
  };

  const monitorFiles = (files, metalsmith, done) => {

    // Watch for changes in the source files.
    //
    const paths = [
      "src/" + "**/" + "*.+(ipynb|md)", // HTML source files
      "src/" + "css/" + "**/" + "*",    // CSS and font files
      "src/" + "js/" + "**/" + "*",     // Javascript files
      "templates/" + "**/" + "*"        // Handlebar templates and partials
    ];

    if (typeof metalsmith["__gazer"] === "undefined") {

      // Need to create a new file watcher
      //
      let pendingUpdate = false;
      const updateDelay = 100; // msecs

      console.log("-- watcher: starting");
      metalsmith.__gazer = new Gaze(paths);
      metalsmith.__gazer.on("changed", path => {
        console.log("** watcher:", path, "changed");
        if (pendingUpdate) clearTimeout(pendingUpdate);
        pendingUpdate = setTimeout(() => {
          console.log("-- watcher: rebuilding");

          // Reexecute `run` with firstTime == false
          //
          run(false);
          console.log("-- watcher: done");
        }, updateDelay);
      });
    }

    return process.nextTick(done);
  };

  const runServer = serve({ // Start a simple HTTP server to serve the generated HTML files.
    port: 7000,
    http_error_files: {
      404: "/404.html"
    }
  });

  // --- Start of Metalsmith processing ---

  if (firstTime) console.log("-- isProd:", isProd, "noserve:", argv.n);

  metalsmith(absPath(""))
    .clean(false)
    .source(absPath("./src"))
    .destination(home + "/Sites/keystrokecountdown")
    .ignore([".~/*", "**/*~", "**/.~/*"])
    .use(define({site: site}))
    .use(removeOldFiles)
    .use(concatter)
    .use(branch("**/" + "*.css")
         .use(consolidateCSS))
    .use(branch("**/" + "*.js")
         .use(uglify({deleteSources: true}))
         .use(consolidateJS))
    .use(branch("**/" + "*.md")
         .use(updatePostMetadata)
         .use(deleteDrafts)
         .use(srcset(site.srcset))
         .use(processMarkdown))
    .use(branch("**/" + "*.ipynb")
         .use(processNotebooks))
    .use(discoverPartials({
      directory: 'templates/partials',
      pattern: /\.hbs$/
    }))
    .use(deleteDraftFiles)
    .use(rmDraftDirs)
    .use(tags(tagsOptions))
    .use(processTags)
    .use(collections(collectionsOptions))
    .use(layouts(layoutsOptions))
    .use(rss(rssOptions))
    .use(filterRSS)
    .use(minifyHTML)
    .use(ifFirstTimeServing(monitorFiles))
    .use(ifFirstTimeServing(runServer))
    .build(err => { // Execute all of the above.
      if (err) {
        console.log(err);
        // throw err;
      }
    });
};

run(true);
