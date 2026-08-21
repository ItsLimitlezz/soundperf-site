// Player for the test signal.
//
// The segment timeline is read from signals/manifest.json, which the signal generator writes.
// It is not restated here. If the two ever disagreed, this page would confidently label the
// wrong position, and the user would move the phone at the wrong moment.

(function () {
  "use strict";

  var audio = document.getElementById("audio");
  var toggle = document.getElementById("toggle");
  var icon = document.getElementById("icon");
  var label = document.getElementById("label");
  var phaseEl = document.getElementById("phase");
  var detailEl = document.getElementById("detail");
  var trackEl = document.getElementById("track");
  var elapsedEl = document.getElementById("elapsed");
  var remainingEl = document.getElementById("remaining");

  var PLAY_PATH = "M8 5v14l11-7z";
  var PAUSE_PATH = "M6 5h4v14H6zM14 5h4v14h-4z";

  var timeline = null;
  var prompts = [];
  var total = 0;
  var segments = [];

  function clock(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  fetch("signals/manifest.json")
    .then(function (response) {
      if (!response.ok) throw new Error("manifest " + response.status);
      return response.json();
    })
    .then(function (manifest) {
      timeline = manifest.timeline;
      prompts = manifest.positionPrompts || [];
      fillPositionList();
      total = timeline.reduce(function (acc, entry) {
        return Math.max(acc, entry.startSeconds + entry.durationSeconds);
      }, 0);
      buildTrack();
      remainingEl.textContent = clock(total);
      label.textContent = "Press to start. " + clock(total) + " long.";
    })
    .catch(function () {
      // The signal still plays. Only the position readout is unavailable.
      trackEl.style.display = "none";
      detailEl.textContent = "Position readout unavailable. The signal still plays normally.";
    });

  // The positions come from the generator's manifest, not from a list written out again here.
  // The app doing the recording reads the same five strings, so the two cannot give different
  // instructions.
  function fillPositionList() {
    var list = document.getElementById("positions");
    if (!list || !prompts.length) return;
    list.innerHTML = "";
    prompts.forEach(function (prompt, index) {
      var item = document.createElement("li");
      item.innerHTML = "<strong>Position " + (index + 1) + ".</strong> " + prompt;
      list.appendChild(item);
    });
    var fallback = document.getElementById("positions-fallback");
    if (fallback) fallback.remove();
  }

  function buildTrack() {
    trackEl.innerHTML = "";
    segments = timeline.map(function (entry) {
      var el = document.createElement("div");
      el.className = "seg " + entry.kind;
      el.style.flex = String(entry.durationSeconds);
      el.textContent = entry.kind === "noise" ? String(entry.position) : "";
      el.title = entry.label;
      trackEl.appendChild(el);
      return el;
    });
  }

  function entryAt(time) {
    if (!timeline) return null;
    for (var i = 0; i < timeline.length; i++) {
      var e = timeline[i];
      if (time >= e.startSeconds && time < e.startSeconds + e.durationSeconds) {
        return { entry: e, index: i };
      }
    }
    return null;
  }

  function describe(found, time) {
    var entry = found.entry;
    var into = time - entry.startSeconds;
    var left = Math.ceil(entry.durationSeconds - into);
    if (entry.kind === "noise") {
      phaseEl.className = "phase noise";
      phaseEl.textContent = "Position " + entry.position + ".";
      var where = prompts[entry.position - 1];
      detailEl.textContent = (where ? where + " " : "") + "Hold still, " + left + " s left.";
      return;
    }
    phaseEl.className = "phase";
    if (entry.kind === "levelTone") {
      phaseEl.textContent = "Set the level.";
      detailEl.textContent = left + " s of midrange noise.";
    } else if (entry.kind === "marker") {
      phaseEl.textContent = "Marker.";
      detailEl.textContent = "The app starts recording after this.";
    } else {
      var next = timeline[found.index + 1];
      phaseEl.textContent = "Silence.";
      if (next && next.kind === "marker") {
        // Name the position being moved to, rather than just saying to move.
        var upcoming = timeline[found.index + 2];
        var number = upcoming && upcoming.position ? upcoming.position : null;
        var where = number ? prompts[number - 1] : null;
        detailEl.textContent = number
          ? "Move to position " + number + ". " + (where || "")
          : "Move to the next position now.";
      } else {
        detailEl.textContent = "Waiting.";
      }
    }
  }

  // Driven by the audio element's own timeupdate, plus a timer, rather than by
  // requestAnimationFrame alone. Animation frames stop in a background tab, and the whole
  // point of this readout is that the user is looking at their phone rather than at this page.
  function frame() {
    var time = audio.currentTime;
    elapsedEl.textContent = clock(time);
    remainingEl.textContent = clock(total - time);

    var found = entryAt(time);
    if (found) {
      describe(found, time);
      for (var i = 0; i < segments.length; i++) {
        segments[i].classList.toggle("active", i === found.index);
        segments[i].classList.toggle("done", i < found.index);
      }
    }
  }

  var ticker = null;

  function startTicking() {
    if (ticker === null) ticker = setInterval(frame, 250);
  }

  function stopTicking() {
    if (ticker !== null) { clearInterval(ticker); ticker = null; }
  }

  audio.addEventListener("timeupdate", frame);

  toggle.addEventListener("click", function () {
    if (audio.paused) {
      audio.play().then(function () {
        icon.querySelector("path").setAttribute("d", PAUSE_PATH);
        toggle.setAttribute("aria-label", "Stop the test signal");
        label.textContent = "Playing. Leave the volume alone from here.";
        startTicking();
        frame();
      }).catch(function (error) {
        label.textContent = "The browser refused to play. " + error.message;
      });
    } else {
      audio.pause();
      stopTicking();
      icon.querySelector("path").setAttribute("d", PLAY_PATH);
      toggle.setAttribute("aria-label", "Play the test signal");
      label.textContent = "Stopped.";
    }
  });

  audio.addEventListener("ended", function () {
    stopTicking();
    icon.querySelector("path").setAttribute("d", PLAY_PATH);
    label.textContent = "Finished. All five positions played.";
    phaseEl.className = "phase";
    phaseEl.textContent = "Done.";
    detailEl.textContent = "Check the app for the result.";
    segments.forEach(function (s) { s.classList.remove("active"); s.classList.add("done"); });
  });

  audio.addEventListener("waiting", function () {
    detailEl.textContent = "Buffering.";
  });
})();
