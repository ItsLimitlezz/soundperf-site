// Fills in file sizes from the manifest the signal generator writes.
//
// Sizes are not hardcoded in the markup. A stale number next to a download link is a small lie,
// and this whole product is an argument against small lies.

(function () {
  "use strict";

  function readable(bytes) {
    if (!bytes) return "";
    var mb = bytes / 1048576;
    return mb >= 1 ? mb.toFixed(1) + " MB" : Math.round(bytes / 1024) + " kB";
  }

  function stamp(seconds) {
    var minutes = Math.floor(seconds / 60);
    return minutes + "m " + Math.round(seconds % 60) + "s";
  }

  fetch("signals/manifest.json")
    .then(function (response) {
      if (!response.ok) throw new Error("manifest " + response.status);
      return response.json();
    })
    .then(function (manifest) {
      var byName = {};
      manifest.files.forEach(function (file) { byName[file.filename] = file; });

      document.querySelectorAll("[data-meta]").forEach(function (el) {
        var host = el.hasAttribute("data-file") ? el : el.closest("[data-file]");
        if (!host) return;
        var name = host.getAttribute("data-file");
        var file = byName[name];
        if (file) {
          el.textContent = readable(file.bytes) + "  ·  " + stamp(file.durationSeconds);
        }
      });
    })
    .catch(function () {
      // Sizes simply do not appear. Every download link still works.
    });
})();
