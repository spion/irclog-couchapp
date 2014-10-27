// Copyright: 2014, Damjan Georgievski
var xhr = require('./myxhr');

module.exports = function(url) {
    return function(id) {
        return xhr({
            method: "GET",
            url:    this.url + id
        });
    }
}
