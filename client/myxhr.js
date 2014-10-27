var xhr = require('xhr-json');
var mkError = require('create-error');

var CodedError = mkError('CodedError', {code: 500});

module.exports = function(opt) {
    return xhr(opt).then(function(res) {
        if (res.status != 200)
            throw new CodedError(res.body, res.status);
        return res.body;
    });
}
