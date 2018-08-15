/*
 * Escape given text so that nonething in it will be taken as the start or end of an HTML element or entity.
 */
module.exports = function(s) {
    return s.replace(/[&<>"]/g, function (s) {
        var entityMap = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': '&quot;'
        };
        return entityMap[s];
    });
};
