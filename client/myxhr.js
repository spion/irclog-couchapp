var mkError = require('create-error');
var Q = require('p-promise');
var qs = require('querystring');

var xhr = Q.denodeify(require('xhr'));

var CodedError = mkError('CodedError', {code: 500});

module.exports = function(opt) {
    if (opt.params) 
        opt.url += '?' + qs.stringify(opt.params);
    return xhr(opt).then(function(res) {
        if (res.status != 200)
            throw new CodedError(res.body, res.status);
        return JSON.parse(res.body);
    });
}
