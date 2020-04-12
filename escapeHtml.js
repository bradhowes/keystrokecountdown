/*
 * Escape given text so that nonething in it will be taken as the start or end of an HTML element or entity.
 */
const entityMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': '&quot;'
};

module.exports = contents => contents.replace(/[&<>"]/g, character => entityMap[character]);
