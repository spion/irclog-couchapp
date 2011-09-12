jQuery(function ($) {

   /* initialization */
   var current_channel = $Utils.getQueryVariable("channel", "lugola");

   var next_startkey;
   var previousDate = 0;
   var focused = false;

   $(window).focus(function () { focused = true; });
   $(window).blur(function () { focused = false; });
   $("#morehistory").click(loadMore);
   $("#pi").click(showChannelList);

   var table = $("#irclog");

   function fmtTimestamp(T) {
      function pad(x)
         {return x < 10 ? '0' + x.toString() : x.toString()}

      var t = new Date(T * 1000);
      return {
         dt: pad(t.getFullYear()) + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()),
         tm: pad(t.getHours()) + ':' + pad(t.getMinutes()) + ':' + pad(t.getSeconds())
      }
   }

   function fmtMessage(doc) {
      var color = $Colorizer(doc.sender);
      var out = '';
      out += '<span class="nickname" style="background-color:' + color + '">' + doc.sender + '</span>';
      msg = $Utils.escapeHTML(doc.message);
      msg = $Utils.autoLink(msg);
      msg = msg.replace(/^\x01ACTION (.*)\x01/g, '<span class="nickname" style="background-color:' + color + '">$1</span>');
      out += '<span>' + msg + '</span>';
      return out;
   }

   function fmtHtmlDoc(doc) {
      var t = fmtTimestamp(doc.timestamp);
      var permalink = '?channel=' + doc.channel + ';date=' + t.dt + '#' + t.tm;
      var out = '';
      // fucking ugly!!! think about a nicer way to leave the separators
      if (previousDate != t.dt) {
         out += '<tr><td class="date" colspan="2"><span>' + t.dt + '</span></td></tr>\n';
         previousDate = t.dt;
      }
      out += '<tr>';
      out += '<td valign="top" class="timestamp" width="1%">';
      out += '<a id="' + t.tm + '" href="' + permalink + '">' + t.tm + '</a>';
      out += '</td>';
      out += '<td class="message">' + fmtMessage(doc) + '</td>';
      out += '</tr>\n';
      return out;
   }

   // callback, called when new data arives from the _changes notification
   function cb_NewData(data) {
      for (var k = 0; k < data.results.length; k++) {
         var doc = data.results[k].doc;
         var html = fmtHtmlDoc(doc);

         if (!focused) {
            $TitleAlert.start();
         } else if (document.documentElement.scrollHeight - 100 < document.documentElement.clientHeight + window.pageYOffset) {
            window.scroll(window.scrollX, document.body.clientHeight);
         } else {
            $.noticeAdd({text: fmtMessage(doc)});
         }
         table.append(html);
      }
   }


   function showChannelList() {
      $.getJSON("ddoc/_view/channel", {
         group: true,
         group_level: 1
      }, function (data) {
            var div = $('<div></div>');
            var list = $('<ul class="channels"></ul>');
            for (var k = 0; k < data.rows.length; k++) {
               var key = data.rows[k].key[0];
               var value = data.rows[k].value;
               list.append('<li><a title="' + value + '" href="?channel=' + key + '">' + key + '</a></li>');
            }
            div.append(list);
            div.dialog({
               modal: true,
               height: 240,
               title: "Channels logged"
            });
         }
      );
   }


   function cb_GotLast100(data) {
      var html = '';
      for (var k = data.rows.length - 2; k >= 0; --k) {
         var doc = data.rows[k].doc;
         html += fmtHtmlDoc(doc);
      }
      table.prepend(html);
      next_startkey = data.rows[data.rows.length - 1].key;
   }


   function cb_GotHistory(data) {
      var html = '';
      for (var k = data.rows.length - 1; k >= 0; --k) {
         var doc = data.rows[k].doc;
         html += fmtHtmlDoc(doc);
      }
      table.append(html);
      var id = window.location.hash.substr(1);
      var el = document.getElementById(id);
      if (el) {
         el.focus();
         el.scrollIntoView(true);
      }
   }


   function startUpdates(last_update_seq, callback) {
      var options = {
         since: last_update_seq,
         channel: current_channel,
         filter: "log/channel",
         include_docs: "true",
         cache: false,
         async: true
      }
      //var changes = $.getJSON("api/_changes", options, function(data) {});
      //changes.onChange(callback);
   }


   function loadMore() {
      $.getJSON("ddoc/_view/channel", {
         reduce: false,
         include_docs: true,
         limit: 100,
         descending: true,
         cache: false,
         async: true,
         startkey: JSON.stringify(next_startkey),
         endkey: JSON.stringify([current_channel, 0])
      }, cb_GotLast100);
   }


   var start = $Utils.getQueryVariable("date");
   if (start) {
      start = new Date(start).getTime() / 1000;
      var end = start + 24 * 60 * 60;
      $.getJSON("ddoc/_view/channel", {
            reduce: false,
            include_docs: true,
            descending: true,
            cache: false,
            async: false,
            startkey: JSON.stringify([current_channel, end]),
            endkey: JSON.stringify([current_channel, start])
         }, function (data) {cb_GotHistory(data);}
      );
   } else {
      // get last 100 documents (and show 99)
      $.getJSON("ddoc/_view/channel", {
         startkey: JSON.stringify([current_channel, {}]),
         endkey: JSON.stringify([current_channel, 0]),
         limit: 100,
         descending: true,
         reduce: false,
         include_docs: true,
         cache: false,
         async: false,
         update_seq: true
      }, function (data) {
         cb_GotLast100(data);
         window.setTimeout(startUpdates, 1000, data.update_seq, cb_NewData);
      });
   }

});
