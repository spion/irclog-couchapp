// Copyright: 2014, Damjan Georgievski
// MIT License applies
//

var xhr = require('./myxhr.js');
var Q = require('p-promise');
var xtend = require('xtend');
var copy = require('xtend/immutable');

function CouchView(url, params, method) {
    this.method = method || 'GET';
    this.url    = url;
    this.params = params;
    this._loaded = Q.defer();
}

CouchView.prototype.get = function() {
    var self = this;
    return Q.when(self.params).then(function (params) {
        var req = getView(self.method, self.url, params);
        return Q.all({req: req, params: params});
    }).then(function(all) {
        // prepare params for loadAfter and loadBefore
        var nextparams, prevparams;
        if (all.req.config.params && all.req.config.params.limit) {
            if (all.req.rows.length == all.req.config.params.limit) {
                // pop the extra last row for pagination
                var last = all.req.rows.pop();
                nextparams = copy(all.params);
                nextparams.startkey = last.key;
                nextparams.startkey_docid = last.id;
            }
        }
        if (all.req.rows.length > 0) {
            var first = all.req.rows[0];
            prevparams = copy(all.params);
            prevparams.endkey = first.key;
            prevparams.endkey_docid = first.id;
        }
        self._loaded.resolve({nextparams:nextparams, prevparams:prevparams});
        return {rows: all.req.rows, last_seq: all.req.update_seq };
    });
};

CouchView.prototype.loadAfter = function() {
    var next = new CouchView(this.url, null, this.method);
    next.params = this._loaded.promise.then(function (obj) { return obj.nextparams});
    return next;
};

CouchView.prototype.loadBefore = function() {
    var prev = new CouchView(this.url, null, this.method);
    prev.params = this._loaded.promise.then(function (obj) { return obj.prevparams});
    return prev;
};

function getView (method, url, _params) {

    var params = { reduce: false, update_seq: true};
    xtend(params, _params);

    // Raise limit by 1 for pagination
    if (params.limit) { params.limit++; }
    // Convert key parameters to JSON
    for (var p in params) switch (p) {
    case "key":
    case "keys":
    case "startkey":
    case "endkey":
        params[p] = JSON.stringify(params[p]);
    }

    return xhr({method: method, url: url, params: params});
}

module.exports = function (url, params, method) {
    return new CouchView(url, params, method);
};
