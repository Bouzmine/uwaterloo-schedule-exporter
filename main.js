/**
* uWaterloo Schedule Exporter
* (c) 2015-Present, Baraa Hamodi
*/

/**
 * Converts a Date object into the required calendar format.
 * @param {Object} date
 * @return {String} formatted date ('20150122')
 */
function getDateString(date) {
  var month = date.getMonth() + 1;
  if (month < 10) {
    month = '0' + month;
  }
  var day = date.getDate();
  if (day < 10) {
    day = '0' + day;
  }
  return '' + date.getFullYear() + month + day;
}

/**
 * Converts a time string into the required calendar format.
 * @param {String} time ('4:30PM')
 * @return {String} formatted time ('163000')
 */
function getTimeString(time) {
  var timeString = time;
  if (time.match(/[AP]M/)) {
    var timeString = time.substr(0, time.length - 2);
  }
  var parts = timeString.split(':');
  if (parts[0].length !== 2) {
    parts[0] = '0' + parts[0];
  }
  timeString = parts.join('') + '00';
  if (time.match(/PM/) && parts[0] < 12) {
    timeString = (parseInt(timeString, 10) + 120000).toString();
  }
  return timeString;
}

/**
 * Combines date and time strings into the required calendar format.
 * @param {String} date ('20150122')
 * @param {String} time ('163000')
 * @return {String} formatted date and time string ('20150122T163000')
 */
function getDateTimeString(date, time) {
  return getDateString(date) + 'T' + getTimeString(time);
}

/**
 * Combines days of the week that an event occurs into the required calendar format.
 * @param {String} daysOfWeek ('MTWThF')
 * @return {String} formatted days of the week string ('MO,TU,WE,TH,FR')
 */
function getDaysOfWeek(daysOfWeek) {
  daysOfWeek = daysOfWeek.trim();
  var formattedDays = [];
  if (daysOfWeek == "Dim") { // ?
    formattedDays.push('SU');
  }
  if (daysOfWeek == "Lun") {
    formattedDays.push('MO');
  }
  if (daysOfWeek == "Ma") {
    formattedDays.push('TU');
  }
  if (daysOfWeek == "Mer") {
    formattedDays.push('WE');
  }
  if (daysOfWeek == "J") {
    formattedDays.push('TH');
  }
  if (daysOfWeek == "V") {
    formattedDays.push('FR');
  }
  if (daysOfWeek == "Sa") { // ?
    formattedDays.push('SA');
  }

  return formattedDays.join(',');
}

/**
 * Wraps calendar event content into the required calendar format.
 * @param {String} iCalContent
 * @return {String} formatted calendar content
 */
function wrapICalContent(iCalContent) {
  return 'BEGIN:VCALENDAR\n' +
    'VERSION:2.0\n' +
    'PRODID:-//Baraa Hamodi/uWaterloo Schedule Exporter//EN\n' +
    iCalContent +
    'END:VCALENDAR\n';
}

/**
 * Makes a best effort to determine the locale of the browser.
 * navigator.languages[0] is more accurate, but only exists in Firefox and Chrome.
 * navigator.language is more supported, but less accurate.
 * See: http://stackoverflow.com/a/31135571
 * @return {String} browser's locale
 */
function getLocale() {
  if (navigator.languages != undefined) {
    return navigator.languages[0];
  } else {
    return navigator.language;
  }
}

/**
 * Extracts course schedule info and creates a downloadable iCalendar (.ics) file.
 */
var main = function() {
  var iCalContentArray = [];
  var timezone = 'America/Toronto';
  var numberOfEvents = 0;

  moment.locale(getLocale());

  $('.PSGROUPBOXWBO').each(function() {
    var eventTitle = $(this).find('.PAGROUPDIVIDER').text().split(' - ');
    var courseCode = eventTitle[0];
    var courseName = eventTitle[1];
    var componentRows = $(this).find('.PSLEVEL3GRID').find('tr');

    componentRows.each(function() {
      var classNumber = $(this).find('span[id*="DERIVED_CLS_DTL_CLASS_NBR"]').text();
      var section = $(this).find('a[id*="MTG_SECTION"]').text();
      var component = $(this).find('span[id*="MTG_COMP"]').text();

      var prev = $(this).prev();
      while ((classNumber == "" || section == "" || component == "") && prev.length > 0) {
        if(classNumber == '') {
          classNumber = prev.find('span[id*="DERIVED_CLS_DTL_CLASS_NBR"]').text();
        }

        if(section == '') {
          section = prev.find('a[id*="MTG_SECTION"]').text();
        }

        if(component == '') {
          component = prev.find('span[id*="MTG_COMP"]').text();
        }

        prev = prev.prev();
      }

      var daysTimes = $(this).find('span[id*="MTG_SCHED"]').text();
      var startEndTimes = daysTimes.match(/\d\d?:\d\d([AP]M)?/g);

      if (startEndTimes) {
        var daysOfWeek = getDaysOfWeek(daysTimes.match(/[A-Za-z]* /)[0]);
        var startTime = startEndTimes[0];
        var endTime = startEndTimes[1];

        var room = $(this).find('span[id*="MTG_LOC"]').text();
        var instructor = $(this).find('span[id*="DERIVED_CLS_DTL_SSR_INSTR_LONG"]').text();
        var startEndDate = $(this).find('span[id*="MTG_DATES"]').text();

        // Parse start/end dates like times to support one day (no end date) events better (e.g. exams)
        var startEndDates = startEndDate.match(/\d{2}\/\d{2}\/\d{4}/g);
        var startDateText = startEndDates[0];
        if(startEndDates.length > 1) {
          var endDateText = startEndDates[1];
        }else {
          var endDateText = startDateText;
        }

        // Start the event one day before the actual start date, then exclude it in an exception date
        // rule. This ensures an event does not occur on startDate if startDate is not on part of daysOfWeek.
        var startDate = moment(startDateText, 'L').toDate();
        startDate.setDate(startDate.getDate() - 1);

        // End the event one day after the actual end date. Technically, the RRULE UNTIL field should
        // be the start time of the last occurrence of an event. However, since the field does not
        // accept a timezone (only UTC time) and Toronto is always behind UTC, we can just set the
        // end date one day after and be guaranteed that no other occurrence of this event.
        var endDate = moment(endDateText, 'L').toDate();
        endDate.setDate(endDate.getDate() + 1);

        var iCalContent =
          'BEGIN:VEVENT\n' +
          'DTSTART;TZID=' + timezone + ':' + getDateTimeString(startDate, startTime) + '\n' +
          'DTEND;TZID=' + timezone + ':' + getDateTimeString(startDate, endTime) + '\n' +
          'LOCATION:' + room + '\n' +
          'RRULE:FREQ=WEEKLY;UNTIL=' + getDateTimeString(endDate, endTime) + 'Z;BYDAY=' + daysOfWeek + '\n' +
          'EXDATE;TZID=' + timezone + ':' + getDateTimeString(startDate, startTime) + '\n' +
          'SUMMARY:' + courseCode + ' (' + component + ')' + '\n' +
          'DESCRIPTION:' +
            'Nom du cours: ' + courseName + '\\n' +
            'Section: ' + section + '\\n' +
            'Instructeur: ' + instructor + '\\n' +
            'Volet: ' + component + '\\n' +
            'Numéro du cours: ' + classNumber + '\\n' +
            'Jour/Heures: ' + daysTimes + '\\n' +
            'Dates de début/fin: ' + startEndDate + '\\n' +
            'Lieu: ' + room + '\\n\n' +
          'END:VEVENT\n';

        // Remove double spaces from content.
        iCalContent = iCalContent.replace(/\s{2,}/g, ' ');

        iCalContentArray.push(iCalContent);
        numberOfEvents++;
      }
    });
  });

  // If no events were found, notify the user. Otherwise, proceed to download the ICS file.
  var linkContainer = $(".PSPAGECONTAINER .PAGROUPBOXLABELINVISIBLEWBO").closest("tr");
  if (linkContainer.html().indexOf('Télécharger') < 0) {
    if (numberOfEvents === 0) {
      var element = $('<tr><td><button type="button">Télécharger l\'horaire</button></td></tr>').click(function(e) {
        e.preventDefault();
        e.stopPropagation();
        alert('Impossible de récupérer l\'horaire, assurez-vous d\'être en mode Liste');
        return false;
      });
      linkContainer.before(element);
    } else {
      var studentName = $('.gh-username').text().toLowerCase();
      studentName = studentName.replace(/\ /g, '-');  // Replace spaces with dashes.
      var fileName = studentName + '-umontreal-class-schedule.ics';

      var element = $('<tr><td><a href="data:text/calendar;charset=UTF-8,' +
        encodeURIComponent(wrapICalContent(iCalContentArray.join(''))) +
        '" download="' + fileName + '">Télécharger l\'horaire</a></td></tr>').on("click", function(e) {
          e.stopPropagation();
        });
      linkContainer.before(element);
    }
  }
};

$(document).ready(tryAddDownloadScheduleButton);

function tryAddDownloadScheduleButton() {
  // Execute main function only when user is in the Enroll/my_class_schedule tab.
  if ($('.PATRANSACTIONTITLE').text() === 'Votre horaire cours') {
    // Only display the download button when the user is in List View.
    if ($('input[name="DERIVED_REGFRM1_SSR_SCHED_FORMAT$258$"][value="L"]').is(":checked")) {
      main();
    }
  }
}