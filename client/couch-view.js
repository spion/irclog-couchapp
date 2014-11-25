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
    return Q(self.params).then(function (params) {
        var req = getView(self.method, self.url, params);
        return Q.all([req, params]);
    }).spread(function(req, params) {
        console.log(req);
        // prepare params for loadAfter and loadBefore
        var nextparams, prevparams;
        if (req.config && req.config.params && req.config.params.limit) {
            if (req.rows.length == req.config.params.limit) {
                // pop the extra last row for pagination
                var last = req.rows.pop();
                nextparams = copy(params);
                nextparams.startkey = last.key;
                nextparams.startkey_docid = last.id;
            }
        }
        if (req.rows.length > 0) {
            var first = req.rows[0];
            prevparams = copy(params);
            prevparams.endkey = first.key;
            prevparams.endkey_docid = first.id;
        }
        self._loaded.resolve({nextparams:nextparams, prevparams:prevparams});
        return {rows: req.rows, last_seq: req.update_seq };
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
    params = xtend(params, _params);
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
