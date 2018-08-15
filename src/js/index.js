"use strict";

(function () {

    var installClickHandlers = function () {
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

        // Find elements we wish to tap for click events
        //
        var elements = Array.prototype.slice.call(document.querySelectorAll(".menu-button, .nav-cover, .nav-close"));
        if (elements && elements.length > 0) {
            elements.forEach(function (element) {
                element.addEventListener('click', clickHandler);
            });
        }
    };

    // When the document is finished loading, install event handlers to show/hide sidebar menu
    //
    window.document.addEventListener("DOMContentLoaded", function (event) {
        installClickHandlers();

        // Set the copyright year at the bottom of our pages
        //
        window.document.getElementById("copyrightYear").innerHTML = (new Date()).getFullYear();
    });
})();
