"use strict";

(function (doc) {

    var installClickHandlers = function () {

        var navElement = doc.getElementById("nav");

        // The click handler just toggles classes to do the showing/hiding
        //
        var clickHandler = function(e) {
            doc.body.classList.toggle("nav-opened");
            doc.body.classList.toggle("nav-closed");
            if (navElement) {
                navElement.classList.toggle("nav-opened");
                navElement.classList.toggle("nav-closed");
            }
        };

        // Find elements we wish to tap for click events
        //
        var elements = Array.prototype.slice.call(doc.querySelectorAll(".menu-button, .nav-cover, .nav-close"));
        if (elements && elements.length > 0) {
            elements.forEach(function (element) {
                element.addEventListener('click', clickHandler);
            });
        }
    };

    // When the document is finished loading, install event handlers to show/hide sidebar menu
    //
    doc.addEventListener("DOMContentLoaded", function (event) {
        installClickHandlers();

        // Set the copyright year at the bottom of our pages
        //
        doc.getElementById("copyrightYear").innerHTML = (new Date()).getFullYear();
    });
})(window.document);
