"use strict";

(function () {

    var findEndOfMath = function(delimiter, text, startIndex) {
        // Adapted from
        // https://github.com/Khan/perseus/blob/master/src/perseus-markdown.jsx
        var index = startIndex;
        var braceLevel = 0;

        var delimLength = delimiter.length;

        while (index < text.length) {
            var character = text[index];

            if (braceLevel <= 0 &&
                text.slice(index, index + delimLength) === delimiter) {
                return index;
            } else if (character === "\\") {
                index++;
            } else if (character === "{") {
                braceLevel++;
            } else if (character === "}") {
                braceLevel--;
            }

            index++;
        }

        return -1;
    };

    var splitAtDelimiters = function(startData, leftDelim, rightDelim, display) {
        var finalData = [];

        for (var i = 0; i < startData.length; i++) {
            if (startData[i].type === "text") {
                var text = startData[i].data;

                var lookingForLeft = true;
                var currIndex = 0;
                var nextIndex;

                nextIndex = text.indexOf(leftDelim);
                if (nextIndex !== -1) {
                    currIndex = nextIndex;
                    finalData.push({
                        type: "text",
                        data: text.slice(0, currIndex)
                    });
                    lookingForLeft = false;
                }

                while (true) {
                    if (lookingForLeft) {
                        nextIndex = text.indexOf(leftDelim, currIndex);
                        if (nextIndex === -1) {
                            break;
                        }

                        finalData.push({
                            type: "text",
                            data: text.slice(currIndex, nextIndex)
                        });

                        currIndex = nextIndex;
                    } else {
                        nextIndex = findEndOfMath(
                            rightDelim,
                            text,
                            currIndex + leftDelim.length);
                        if (nextIndex === -1) {
                            break;
                        }

                        finalData.push({
                            type: "math",
                            data: text.slice(
                                currIndex + leftDelim.length,
                                nextIndex),
                            rawData: text.slice(
                                currIndex,
                                nextIndex + rightDelim.length),
                            display: display
                        });

                        currIndex = nextIndex + rightDelim.length;
                    }

                    lookingForLeft = !lookingForLeft;
                }

                finalData.push({
                    type: "text",
                    data: text.slice(currIndex)
                });
            } else {
                finalData.push(startData[i]);
            }
        }

        return finalData;
    };

    var splitWithDelimiters = function(text, delimiters) {
        var data = [{type: "text", data: text}];
        for (var i = 0; i < delimiters.length; i++) {
            var delimiter = delimiters[i];
            data = splitAtDelimiters(
                data, delimiter.left, delimiter.right,
                delimiter.display || false);
        }
        return data;
    };

    var renderMathInText = function(text, delimiters) {
        var data = splitWithDelimiters(text, delimiters);

        var fragment = document.createDocumentFragment();

        for (var i = 0; i < data.length; i++) {
            if (data[i].type === "text") {
                fragment.appendChild(document.createTextNode(data[i].data));
            } else {
                var span = document.createElement("span");
                var math = data[i].data;
                try {
                    katex.render(math, span, {
                        displayMode: data[i].display,
                    });
                } catch (e) {
                    if (!(e instanceof katex.ParseError)) {
                        throw e;
                    }
                    console.error(
                        "KaTeX auto-render: Failed to parse `" + data[i].data +
                            "` with ",
                        e
                    );
                    fragment.appendChild(document.createTextNode(data[i].rawData));
                    continue;
                }
                fragment.appendChild(span);
            }
        }

        return fragment;
    };

    var renderElem = function(elem, delimiters, ignoredTags) {
        for (var i = 0; i < elem.childNodes.length; i++) {
            var childNode = elem.childNodes[i];
            if (childNode.nodeType === 3) {
                // Text node
                var frag = renderMathInText(childNode.textContent, delimiters);
                i += frag.childNodes.length - 1;
                elem.replaceChild(frag, childNode);
            } else if (childNode.nodeType === 1) {
                // Element node
                var shouldRender = ignoredTags.indexOf(
                    childNode.nodeName.toLowerCase()) === -1;

                if (shouldRender) {
                    renderElem(childNode, delimiters, ignoredTags);
                }
            }
            // Otherwise, it's something else, and ignore it.
        }
    };

    var defaultOptions = {
        delimiters: [
            {left: "$$", right: "$$", display: true},
            {left: "\\[", right: "\\]", display: true},
            {left: "\\(", right: "\\)", display: false}
        ],
        ignoredTags: [
            "script", "noscript", "style", "textarea", "pre", "code"
        ]
    };

    var extend = function(obj) {
        // Adapted from underscore.js' `_.extend`. See LICENSE.txt for license.
        var source;
        var prop;
        for (var i = 1, length = arguments.length; i < length; i++) {
            source = arguments[i];
            for (prop in source) {
                if (Object.prototype.hasOwnProperty.call(source, prop)) {
                    obj[prop] = source[prop];
                }
            }
        }
        return obj;
    };

    var renderMathInElement = function(elem, options) {
        if (!elem) {
            throw new Error("No element provided to render");
        }

        options = extend({}, defaultOptions, options);
        renderElem(elem, options.delimiters, options.ignoredTags);
    };

    /*
     * Locate any KanTex math to render in a post.
     */
    var renderMathInDocument = function () {
        var postContent = document.querySelector(".post-content");
        if (postContent) renderMathInElement(postContent);
    };

    var installClickHandlers = function () {

        // Find elements we wish to tap for click events
        //
        var elements = Array.prototype.slice.call(
            document.querySelectorAll(".menu-button, .nav-cover, .nav-close"));
        var navElement = document.getElementById("nav");

        // The click handler just toggles classes to do the showing/hiding
        //
        var clickHandler = function(e) {
            document.body.classList.toggle("nav-opened");
            document.body.classList.toggle("nav-closed");
            if (navElement) {
                navElement.classList.toggle("nav-opened");
                navElement.classList.toggle("nav-closed");
            }
        };

        if (elements && elements.length > 0) {
            elements.forEach(function (element) {
                element.addEventListener('click', clickHandler);
            });
        }
    };

    /*
     * When the document is finished loading, install event handlers to show/hide sidebar menu and render any
     * KanTex math in document.
     */
    window.document.addEventListener("DOMContentLoaded", function (event) {
        installClickHandlers();
        renderMathInDocument();
    });

    /*
     * Activate Google Analytics
     */
    (function(i,s,o,g,r,a,m) {
        i['GoogleAnalyticsObject'] = r;
        i[r] = i[r] || function() {
            (i[r].q = i[r].q || []).push(arguments);
        }, i[r].l = 1 * new Date();
        a = s.createElement(o), m = s.getElementsByTagName(o)[0];
        a.async = 1;
        a.src = g;
        m.parentNode.insertBefore(a,m);
    })(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');
    ga('create', 'UA-77645652-1', 'auto');
    ga('send', 'pageview');
})();
