/* Copyright: 2014, Damjan Georgievski
 * MIT License applies
 *
 * A module for the CouchDB changes feed
 *
 * it will use either EventSource or longpoll depending on what's available in the browser or on the server (todo)
 * it provides a unified api through a promise that notifies.
 */

var xhr = require('./myxhr');
var q = require('p-promise');
var copy = require('xtend/immutable')
var most = require('most');
//var most = {};

function delay(t) {
    return q().delay(t);
}

function xhrTimeout(opt) {
    var t = delay(opt.timeout).then(function() {
        var e = new Error("Timeout");
        e.status = 0;
        throw e;
    });
    return q.race(t, xhr(opt));
}

function buildUrl(url, params) {
    var str = [];
    for(var p in params)
        if (params.hasOwnProperty(p)) {
            str.push(encodeURIComponent(p) + "=" + encodeURIComponent(params[p]));
        }
    return url + '?' + str.join("&");
}

// a longpoll request can get stuck at the TCP level
// so kill it each 60 seconds and retry it just in case
var DEADLINE = 60000;
var HEARTBEAT = 20000;

function longPollFallback (url, params, r) {
    var _params = copy(params);
    _params.feed = 'longpoll';
    _params.heartbeat = HEARTBEAT;
    function loop(last_seq) {
        _params.since = last_seq;
        var req = xhrTimeout({method: 'GET', url: url, params: _params, timeout: DEADLINE});
        req.done(function(response) {
            r.push(response.results);
        }, function(err) {
            if (err.isTimeout) loop(last_seq);
            else r.error(err);
        });
    }
    loop(params.since);
}


module.exports = function (url, params) {
    // return error if no since ?

    return most.create(function(push, end, error) {
        if (!!window.EventSource) {
            var _params = copy(params);
            _params.feed = 'eventsource';
            _params.heartbeat = HEARTBEAT;
            var _url = buildUrl(url, _params);
            var do_fallback = true;
            var source = new window.EventSource(_url);

            source.addEventListener('error', function() {
                // don't do the fallback if we succeed, Firefox was firing a lingering
                // longpoll fallback on a page reload
                do_fallback = false;
            });
            source.addEventListener('error', function(err) {
                if (source.readyState == window.EventSource.CLOSED &&
                    err.type == 'error' && err.eventPhase == 2) {
                    if (do_fallback) {
                        // EventSource not supported on the backend, run the longpolled fallback
                        console.log('EventSource not supported on the backend? runing longpoll');
                        longPollFallback(url, params, {push:push, end: end, error:error});
                    }
                } else if (source.readyState == window.EventSource.CLOSED) {
                    error(err);
                }
            }, false);

            source.addEventListener('message', function(ev) {
                var data = JSON.parse(ev.data);
                push([data]);
            }, false);
        } else {
            // no window.EventSource
            longPollFallback(url, params, {push: push, end: end, error: error});
        }
    });

}
