
/* jshint newcap: false */

var React = require('react');
var rrc = require('react-router-component');
var Locations = rrc.Locations;
var Location = rrc.Location;

var Link = rrc.Link;

var couchDB = require('./couch-db');
var couchView = require('./couch-view');
var couchChanges = require('./couch-changes');

var colorize = require('./colorizer');

var URL_BASE = '';

var Q = require('p-promise');

// when testing locally, change the base URL
if (location.host === 'localhost:8000')
    URL_BASE = 'https://irc.softver.org.mk/';


var LogApp = React.createClass({
    render: function() {
        return Locations({hash: true},[
            Location({
                path: '/',
                handler: Home
            }),
            Location({
                path: '/:channel',
                handler: ChannelLogs
            }),
            Location({
                path: '/:channel/by-id/:docid',
                handler:ChannelLogAroundDoc
            }),
            rrc.NotFound({handler: Home})
        ]);
    }
});

var $ = React.DOM;

var Home = React.createClass({
    componentDidMount: function() {
        var self = this;
        couchView(URL_BASE + 'ddoc/_view/channel', {
            reduce: true,
            group_level: 1
        }).get().done(function(result) {
            console.log("Channels", result);
            self.setState({rows: result.rows});
        });
    },
    getInitialState: function() {
        return {rows: []};
    },
    render: function() {
        var content = [
            $.p(null, 'This web page is a viewer of irclogs collected by my ',
                $.a({href: "https://github.com/gdamjan/erlang-irc-bot"}, 'erlang irc bot'),
                '. The bot stores the logs in a CouchDB where this web-app (or couchapp)',
                ' is also stored. You can also ',
                $.a({href: "http://wiki.apache.org/couchdb/Replication"}, 'replicate'),
                ' the database at ',
                $.a({href: "https://irc.softver.org.mk/api"}, "https://irc.softver.org.mk/api"),
               " freely."),
            $.p(null, 'The following channels are currently logged:'),
            $.ul(null,
            this.state.rows.map(function(row) {
                return $.li(null, Link({
                    href: '/' + row.key[0],
                    title: 'Number of messages logged: ' + row.value
                }, row.key[0]));
            })),
            $.p(null, "If you want your irc channel on freenode logged, contact 'damjan' on #lugola.")
        ];
        return $.div({
            id: 'infobox'
        }, content)
    }
});


var ChannelLogs = React.createClass({
    getInitialState: function() {
        return {rows: []}
    },
    prevClick: function() {},
    nextClick: function() {},
    componentDidMount: function() {
        var self = this;
        var view = couchView(URL_BASE + 'ddoc/_view/channel', {
            include_docs: true,
            descending: true,
            limit: 100,
            startkey: [this.props.channel, {}],
            endkey: [this.props.channel, 0]
        });
        installPagers.call(self, view, view);
        view.get().done(function(result) {
            self.setState({rows: result.rows});
            var params = { include_docs:true, since: result.last_seq,
                           filter: 'log/channel', channel: 'lugola' };
            var feed = self.feed = couchChanges(URL_BASE + 'api/_changes', params)

            feed.observe(function(rows) {
                notifyNewRows(rows);
                self.setState({rows: self.state.rows.concat(rows)});
            });
            feed.flatMapError(function(e) {
                console.error(e);
            });


            function notifyNewRows(data) {
                if (self.state.unreadCount != null) {
                    self.setState({
                        unreadCount: self.state.unreadCount + data.length
                    });
                }
            }
        });

    },
    render: channelLogTemplate
});



var ChannelLogAroundDoc = React.createClass({
    getInitialState: function() {
        return {rows: []}
    },
    prevClick: function() {},
    nextClick: function() {},
    componentDidMount: function() {
        var getDoc = couchDB(URL_BASE + 'api');
        var self = this;
        getDoc(this.props.docid).done(function (doc) {
            var view1 = couchView(URL_BASE + 'ddoc/_view/channel', {
                include_docs: true,
                descending: true,
                limit: 8,
                startkey: [doc.channel, doc.timestamp],
                startkey_docid: doc._id,
                endkey: [doc.channel, 0]
            });
            var view2 = couchView(URL_BASE + 'ddoc/_view/channel', {
                include_docs: true,
                descending: false,
                limit: 8,
                startkey: [self.props.channel, doc.timestamp],
                startkey_docid: doc._id,
                endkey: [self.props.channel, {}]
            });

            Q.all([view1.get(), view2.get()]).done(function (views) {
                self.setState({rows: views[0].rows.concat(views[1].rows)})
            });
            installPagers.call(self, view1, view2, {reversed:true});
        })
    },
    render: channelLogTemplate
});


function installPagers(pager1, pager2, opt) {
    var self = this;
    self.pager1 = pager1;
    self.pager2 = pager2;
    self.prevClick = function prevClick() {
        if (opt && opt.reversed)
            self.pager1 = self.pager1.loadAfter();
        else
            self.pager1 = self.pager1.loadBefore();
        self.pager1.get().done(function (result) {
            self.setState({ rows: self.state.rows.concat(result.rows) });
        })
    }

    self.nextClick = function nextClick() {
        self.pager2 = self.pager2.loadAfter();
        self.pager2.get().done(function (result) {
            self.setState({rows:self.state.rows.concat(result.rows)});
        });
    }
}

function channelLogTemplate() {
    var self = this;
    var msgs = this.state.rows.map(function(row) {
        return $.tr({className: self.props.docid == row.id ? 'highlight':''}, [
            $.td({className: 'message'}, [
                $.span({
                    className: 'nickname',
                    style: {backgroundColor: colorize(row.doc.sender)}
                }, row.doc.sender),
                $.span(null, row.doc.message)]),
            $.td({className: 'timestamp', valign: 'top', width: '1%'},
                 Link({
                     id: row.id,
                     href: '/'+ self.props.channel+'/by-id/'+row.id
                 }, new Date(1000 * row.doc.timestamp).toDateString()))
        ]);
    });
    return $.div({}, [
        $.div({
            className: 'pagination',
            onClick: self.prevClick
        }, 'previous history'),
        $.table({id: 'irclog'}, [
            $.tbody({id: '2000-00-00'},[
                $.tr({className: 'date'},
                     $.th({collSpan: 2},
                          $.span({}, Link({href: '#/lugola/2000-00-00'}))))
            ].concat(msgs))]),
        $.div({
            className: 'pagination',
            onClick: self.nextClick
        }, 'continue')
    ]);
}

var appEl = document.getElementById('app');
React.renderComponent(LogApp(null), appEl);
