
/* jshint newcap: false */

var React = require('react');
var rrc = require('react-router-component');
var Locations = rrc.Locations;
var Location = rrc.Location;

var Link = rrc.Link;

var couchView = require('./couch-view');
var couchChanges = require('./couch-changes');

var URL_BASE = '';

// when testing locally, change the base URL
if (location.host === 'localhost:8000')
    URL_BASE = 'https://irc.softver.org.mk/';



var LogApp = React.createClass({
    render: function() {
        return Locations(
            null,
            Location({
                path: '/',
                handler: Home
            }),
            Location({
                path: '/:channel',
                handler: ChannelLogs
            }),
            Location({path: '/:channel/by-id/:docid', handler:ChannelLogsAroundDoc}),
            rrc.NotFound({handler: Home})
        );
    }
});

var $ = React.DOM;

var Home = React.createClass({
    componentDidMount: function() {
        var self = this;
        couchView(URL_BASE + 'ddoc/_view/channel', {
            reduce: true,
            group_level: 1
        }).get().then(function(result) {
            self.setState({rows: result.rows});
        });
    },
    getInitialState: function() {
        return {rows: []};
    },
    render: function() {
        var content = [
            $.p(null, 'This web page is a viewer of irclogs collected by my',
                $.a({href: "https://github.com/gdamjan/erlang-irc-bot"}, 'erlang irc bot'),
                'The bot stores the logs in a CouchDB where this web-app (or couchapp)',
                'is also stored. You can also',
                $.a({href: "http://wiki.apache.org/couchdb/Replication"}, 'replicate'),
                'the database at',
                $.a({href: "https://irc.softver.org.mk/api"}, "https://irc.softver.org.mk/api")),
            $.p(null, 'The following channels are currently logged:'),
            $.ul(null,
            this.state.rows.map(function(row) {
                return $.li(null, Link({
                    href: row.key[0],
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
    componentDidMount: function() {
        this.view = couchView(URL_BASE + 'ddoc/_view/channel', {
            include_docs: true,
            descending: true,
            limit: 100,
            startkey: [this.props.channel, {}],
            endkey: [this.props.channel, 0]
        });
        var self = this;
        this.view.get().then(function(result) {
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
                if ($scope.unreadCount != null) {
                    $scope.unreadCount += data.length
                    if (!$scope.flashing) {
                        flashTitlebar().then(function() {
                            if ($scope.unreadCount)
                                $rootScope.flashMessage = '('+$scope.unreadCount+') ';
                        });
                    }
                }
            }
            function flashTitlebar(n) {
                if (n == null) n = 5;
                $scope.flashing = true;
                var turnon = n % 2 && $scope.unreadCount;
                $rootScope.flashMessage = turnon && $scope.unreadCount ? '*** ' : '';
                if (n <= 0)
                    return ($scope.flashing = false);
                else
                    return $timeout(function(){}, 500)
                    .then(flashTitlebar.bind(null, n - 1));
            }


        });

    }
});


   var pager = view;
   $scope.prevClick = function() {
      // because of "descending: true" we go back towards the past,
      // so counterintuitively use .loadAfter()
      pager = pager.loadAfter();
      pager.get().then(function (result) {
         $scope.rows.push.apply($scope.rows, result.rows);
      })
   };
    // flashing
    function notifyNewRows(data) {
        if ($scope.unreadCount == null) return;
        $scope.unreadCount += data.length
        if ($scope.flashing) return;
        flashTitlebar().then(function() {
            if (!$scope.unreadCount) return;
            $rootScope.flashMessage = '('+$scope.unreadCount+') ';
        });
    }
    function flashTitlebar(n) {
        if (n == null) n = 5;
        $scope.flashing = true;
        var turnon = n % 2 && $scope.unreadCount;
        $rootScope.flashMessage = turnon && $scope.unreadCount ? '*** ' : '';
        if (n <= 0)
            return ($scope.flashing = false);
        else
            return $timeout(function(){}, 500)
            .then(flashTitlebar.bind(null, n - 1));
    }
    var win = angular.element($window);
    win.bind('blur', function() {
        $scope.unreadCount = 0;
    });
    win.bind('focus', function() {
        $scope.unreadCount = null;
        $rootScope.flashMessage = '';
        $rootScope.$apply();
    });
})

logApp.controller('ChannelLogAroundDocController', function ($rootScope, $scope, $routeParams,
                                               $q, couchDB, couchView) {
   $scope.channel = $rootScope.title = $routeParams.channel;
   $scope.docid = $routeParams.docid;
   $scope.rows = [];

   var getDoc = couchDB(URL_BASE + 'api');
   getDoc($routeParams.docid).then(function (doc) {

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
         startkey: [$routeParams.channel, doc.timestamp],
         startkey_docid: doc._id,
         endkey: [$routeParams.channel, {}]
      });

      $q.all([view1.get(), view2.get()]).then(function (views) {
         $scope.rows.push.apply($scope.rows, views[0].rows);
         $scope.rows.shift(); // we get the same row twice
         $scope.rows.push.apply($scope.rows, views[1].rows);
      });

      var pager1 = view1;
      $scope.prevClick = function() {
         // because of "descending: true" we go back towards the past,
         // so counterintuitively use .loadAfter()
         pager1 = pager1.loadAfter();
         pager1.get().then(function (result) {
            $scope.rows.push.apply($scope.rows, result.rows);
         })
      };

      var pager2 = view2;
      $scope.nextClick = function() {
         pager2 = pager2.loadAfter();
         pager2.get().then(function (result) {
            $scope.rows.push.apply($scope.rows, result.rows);
         })
      };
   })

})
