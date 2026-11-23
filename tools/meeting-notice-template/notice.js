"use strict";

function formatDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  var parts = iso.split("-");
  var y = Number(parts[0]);
  var m = Number(parts[1]);
  var d = Number(parts[2]);
  var dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return "";
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatTime(value) {
  if (!value) return "";
  var match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return "";
  var h = Number(match[1]);
  var min = Number(match[2]);
  if (h > 23 || min > 59) return "";
  var suffix = h >= 12 ? "p.m." : "a.m.";
  var hour = h % 12;
  if (hour === 0) hour = 12;
  var minText = min < 10 ? "0" + min : String(min);
  return hour + ":" + minText + " " + suffix;
}

function agendaItems(text) {
  if (!text) return [];
  return String(text).split(/\r?\n/).map(function (line) {
    return line.trim().replace(/^\d+[.)]\s+/, "").trim();
  }).filter(function (line) {
    return line.length > 0;
  });
}

var MEETING_TYPES = {
  board: {
    heading: "NOTICE OF BOARD MEETING",
    held: "a board meeting"
  },
  annual: {
    heading: "NOTICE OF ANNUAL MEETING",
    held: "its annual meeting"
  },
  special: {
    heading: "NOTICE OF SPECIAL MEETING",
    held: "a special meeting"
  }
};

function buildNotice(input) {
  var type = MEETING_TYPES[input.meetingType] || MEETING_TYPES.board;
  var name = String(input.association || "").trim();
  var nameMissing = name.length === 0;
  if (nameMissing) name = "[Association name]";

  var date = formatDate(input.date);
  var dateMissing = date.length === 0;
  if (dateMissing) date = "[date]";

  var time = formatTime(input.time);
  var timeMissing = time.length === 0;
  if (timeMissing) time = "[time]";

  var location = String(input.location || "").trim();
  var locationMissing = location.length === 0;
  if (locationMissing) location = "[location or video link]";

  var items = agendaItems(input.agenda);
  var itemsMissing = items.length === 0;
  if (itemsMissing) items = ["[Agenda item]"];

  var notes = String(input.notes || "").trim();
  var sentence = "Please take notice that " + name + " will hold " + type.held + ".";

  var lines = [
    type.heading,
    "",
    name,
    "",
    sentence,
    "",
    "Date: " + date,
    "Time: " + time,
    "Location: " + location,
    "",
    "Agenda"
  ];
  items.forEach(function (item, index) {
    lines.push((index + 1) + ". " + item);
  });
  if (notes) {
    lines.push("", "Notes", notes);
  }

  return {
    heading: type.heading,
    name: name,
    sentence: sentence,
    date: date,
    time: time,
    location: location,
    items: items,
    notes: notes,
    plain: lines.join("\n"),
    missing: {
      name: nameMissing,
      date: dateMissing,
      time: timeMissing,
      location: locationMissing,
      items: itemsMissing
    }
  };
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(function () {
      return fallbackCopy(text);
    });
  }
  return fallbackCopy(text);
}

function fallbackCopy(text) {
  return new Promise(function (resolve, reject) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.focus();
    area.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(area);
    if (ok) resolve();
    else reject(new Error("copy failed"));
  });
}

function mark(el, value, missing) {
  el.textContent = value;
  el.classList.toggle("placeholder", !!missing);
}

function initNoticeForm() {
  var form = document.getElementById("notice-form");
  if (!form) return;

  var kicker = document.getElementById("n-kicker");
  var nameEl = document.getElementById("n-name");
  var sentenceEl = document.getElementById("n-sentence");
  var dateEl = document.getElementById("n-date");
  var timeEl = document.getElementById("n-time");
  var locationEl = document.getElementById("n-location");
  var agendaEl = document.getElementById("n-agenda");
  var notesWrap = document.getElementById("n-notes-wrap");
  var notesEl = document.getElementById("n-notes");
  var status = document.getElementById("copy-status");

  function readForm() {
    return {
      association: document.getElementById("association").value,
      meetingType: document.getElementById("meeting-type").value,
      date: document.getElementById("meeting-date").value,
      time: document.getElementById("meeting-time").value,
      location: document.getElementById("location").value,
      agenda: document.getElementById("agenda").value,
      notes: document.getElementById("notes").value
    };
  }

  function render() {
    var data = buildNotice(readForm());
    kicker.textContent = data.heading;
    mark(nameEl, data.name, data.missing.name);
    sentenceEl.textContent = data.sentence;
    mark(dateEl, data.date, data.missing.date);
    mark(timeEl, data.time, data.missing.time);
    mark(locationEl, data.location, data.missing.location);
    agendaEl.replaceChildren();
    data.items.forEach(function (item) {
      var li = document.createElement("li");
      li.textContent = item;
      if (data.missing.items) li.classList.add("placeholder");
      agendaEl.appendChild(li);
    });
    if (data.notes) {
      notesWrap.hidden = false;
      notesEl.textContent = data.notes;
    } else {
      notesWrap.hidden = true;
      notesEl.textContent = "";
    }
    form.dataset.plain = data.plain;
  }

  form.addEventListener("input", function () {
    if (status) status.textContent = "";
    render();
  });
  form.addEventListener("change", render);
  form.addEventListener("submit", function (event) {
    event.preventDefault();
  });

  document.getElementById("copy-notice").addEventListener("click", function () {
    var text = (form.dataset.plain || "") + "\n";
    copyText(text).then(function () {
      if (status) status.textContent = "Copied the notice.";
    }).catch(function () {
      if (status) status.textContent = "Select the notice and copy it manually.";
    });
  });

  document.getElementById("print-notice").addEventListener("click", function () {
    window.print();
  });

  document.getElementById("clear-notice").addEventListener("click", function () {
    form.reset();
    if (status) status.textContent = "";
    render();
    document.getElementById("association").focus();
  });

  render();
}

window.CCNotice = {
  formatDate: formatDate,
  formatTime: formatTime,
  agendaItems: agendaItems,
  buildNotice: buildNotice
};

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNoticeForm);
  } else {
    initNoticeForm();
  }
}
