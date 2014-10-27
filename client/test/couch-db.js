var t = require('blue-tape');
var mkdb = require('../couch-db.js');
var db = mkdb('https://irc.softver.org.mk/api')

t.test('getInfo', function(t) {
    db.getInfo().then(function(info) {
    });
});
