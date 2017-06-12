"use strict";

(function () {

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
     * When the document is finished loading, install event handlers to show/hide sidebar menu
     */
    window.document.addEventListener("DOMContentLoaded", function (event) {
        installClickHandlers();
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
