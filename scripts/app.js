(function($){
    //add classes to form inputs based on their type
    $('input').each(function(){
        $(this).addClass($(this).attr('type'));
    });

    //open external links in a new window
    $('a').filter(function(index){
        return /^https?:\/\/(www.)?/i.test($(this).attr('href')) && $(this).attr('href').toLowerCase().indexOf(window.location.hostname) == -1;
    }).attr('target', '_blank').addClass('external');
})(jQuery);

/******************************************************************/
//helper functions
function safeApply(scope, fn) {
    var phase = scope.$root.$$phase;
    if (phase === '$apply' || phase === '$digest')
        scope.$eval(fn);
    else
        scope.$apply(fn);
}

function getDimmensions(element) {
    return {
        x: $(element).offset().left,
        y: $(element).offset().top,
        height: 480,
        width: $(element).width()
    };
};


//define applicaton
var wizualyApp = angular.module('wizualy', ['ngResource', 'ngRoute', 'ngSanitize']);

wizualyApp.config(['$httpProvider', function($httpProvider) {
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
}
]);

//chart directive
angular.module('wizualy').directive('bubbleChart', function () {
    // constants
    var MAX_BUBBLE_SIZE_RELATIVE = .8,
        MIN_BUBBLE_SIZE = 2,
        margin = 20,
        width = 960,
        height = 500 - margin,
        color = d3.interpolateRgb("#f77", "#77f"),
        scale = d3.scale.linear(),
        cluster = d3.layout.cluster().size([height, width - 160]),
        diagonal = d3.svg.diagonal().projection(function(d) { return [d.y, d.x]; });

    return {
        restrict: 'A',
        replace: true,
        transclude: true,
        scope: {
            entities: '='
        },
        link: function (scope, element, attrs) {
            var container = getDimmensions(element[0]),
                chart = d3.select( element[0] )
                    .append("svg")
                    .attr("width", container.width * MAX_BUBBLE_SIZE_RELATIVE)
                    .attr("height", container.height * MAX_BUBBLE_SIZE_RELATIVE);

            scope.drawConnection = function(node, htmlId, point) {
                console.log('point: ', point);

                var x1 = point.x,
                    y1 = point.y,
                    x2 = 89,
                    y2 = 200,
                    curveX = (x2 + x1) / 2,
                    controlX1 = x1 + (curveX - x1) / 5,
                    controlX2 = x1 + (curveX - x1) / 2;

                    console.log('a(', x1, ", ", y1, "), b(", x2, " ,", y2, ")");
                    console.log("curveX: ", curveX);
                    console.log("controlX1: ", controlX1);
                    console.log("controlX2: ", controlX2);
                    console.log('node:', node);

                    node.append("line")
                            .attr("x1", x2)
                            .attr("y1", y2)
                            .attr("x2", curveX)
                            .attr("y2", y2);

                    x1 = 240;
                    y1 = 9.5;
                    controlX1 = 312.35;
                    controlX2 = 420.875;
                    y2 = 210.5;
                    curveX = 601.75;

                    node.append("path")
                            .attr("d", "M" + x1 + "," + y1 + "C" + [controlX1, y1, controlX2, y2, curveX, y2].join(","))
                            .style("fill", "transparent")
            };

            scope.showConnections = function (investors) {
                
                var self = this;
                console.log('this: ', this);

                var g = chart.append("g")
                    .datum(investors)
                        .attr("class", "connections")
                        .attr("width", container.width)
                        .attr("height", container.height);

                console.log('investors: ', investors);

                angular.forEach(investors, function(value, i) {

                    console.log('investor: ', value);
                    var node = g.append("g")
                        .datum(value)
                            .attr("class", "link-su link-su-vc");

                    angular.forEach(value.investor.investors, function(investment, ii) {
                        console.log('investment: ', investment);

                        var point = {x: value.x, y: value.y};
                        console.log('mypoint: ', point);

                        scope.drawConnection(node, "#vc-"+investment.permalink, point);
                    });
                });

                // var vcData = angular.forEach(entity.round_radiuses, function (r, i) {
                //     var vcPoints = vcPointsByRound[i];
                //     if (!vcPoints) return null;
                //     return _.map(vcPoints, function (vcPoint) {
                //         return {
                //             x1: vcPoint.x,
                //             y1: Math.floor(vcPoint.y) + .5,
                //             x2: startup.x + self.left,
                //             y2: Math.floor(startup.y + r + self.top) + .5
                //         }
                //     })
                // }).flatten().without(null).value();

                // this.chart.select(".connections").selectAll(".link-su-vc").data(vcData).enter().append("g").attr("class", "link-su link-su-vc").each(function (d) {
                //     var node = d3.select(this);
                //     var x1 = d.x1,
                //         y1 = d.y1,
                //         x2 = d.x2,
                //         y2 = d.y2,
                //         curveX = (x2 + x1) / 2,
                //         controlX1 = x1 + (curveX - x1) / 5,
                //         controlX2 = x1 + (curveX - x1) / 2;
                //     node.append("line").attr("x1", x2).attr("y1", y2).attr("x2", curveX).attr("y2", y2);
                //     node.append("path").attr("d", "M" + x1 + "," + y1 + "C" + [controlX1, y1, controlX2, y2, curveX, y2].join(",")).style("fill", "transparent")
                // })
            };

            scope.drawBubble = function (entity) {

                // console.log('[DEBUG] container: ', container);
                
                var g, self = this,
                    content = $('#content'),
                    strokeColor = '#000',
                    cx = Math.ceil((container.x + container.width) / 2) - 300,
                    cy = Math.ceil((container.y + container.height) / 2) - 80; 

                var g = chart.append("g")
                    .datum(entity)
                        .attr("class", "bubble")
                        .attr("width", container.width)
                        .attr("height", container.height);

                var R = Math.round(Math.min(container.height, container.width) * 0.3);

                console.log('entity: ', entity);
                console.log('total: ', entity.total, ', length: ', entity.funding_rounds.length);

                var linearScale = d3.scale.linear().domain([0, entity.total]).range([MIN_BUBBLE_SIZE, R]);
                console.log('linear(2): ', linearScale(2));
                console.log('linear(167500000): ', linearScale(167500000));
                console.log('linear(90000000): ', linearScale(90000000));

                g.append("circle")
                    .attr("class", "bubble-round")
                    .attr("cx", cx)
                    .attr("cy", cy)
                    .attr("r", R )
                    .style("fill", '#9d844f');

                var t = 0;
                var round_radiuses = [];
                var investors = [];
                angular.forEach(entity.funding_rounds, function(e, i) {
                    var r = linearScale(e.raised_amount + t);
                    t += e.raised_amount;

                    // add each funding .. as event timeline
                    g.append("circle")
                        .attr("class", "bubble-round")
                        .attr("cx", cx)
                        .attr("cy", cy)
                        .attr("r",  r)
                        .style("stroke", "#554")
                        .style("stroke-width", 1.3)
                        .style("fill", "transparent");

                    round_radiuses.push(r);
                    investors.push({investor: e, x: cx, y: cy + r});
                });

                // display the links between a VC (col1) and round
                scope.showConnections(investors);
            };

            scope.$watch('entities', function(data){
                if(typeof data != 'undefined') {
                    // console.log('data: ', data.length);

                    scope.drawBubble(data);
                } else {
                    console.log('[DEBUG] data is undefined');
                }
            });
        }
    }
});

//placeholder
angular.module('wizualy').directive('placeholder', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs){
            var self = $(element[0]);

            if(!Modernizr.placeholder && attrs.placeholder != ''){
                self.val(attrs.placeholder);

                self.addClass('has-placeholder');

                self.focus(function(){
                    if(self.val() == attrs.placeholder) {
                        self.val('');
                        self.removeClass('has-placeholder');
                    }
                });

                self.blur(function(){
                    if(self.val() === ''){
                        self.val(attrs.placeholder);
                        self.addClass('has-placeholder');
                    }
                });
            }
        }
    }
});

//custom scrollbar directive
angular.module('wizualy').directive('scrollPane', function () {
    return {
        restrict: 'C',
        replace: true,
        priority: 1000,
        link: function (scope, element, attrs){
            $(element[0]).jScrollPane({
                autoReinitialise: true,
                contentWidth: '0px'
            });
        }
    }
});

//dropdowns
angular.module('wizualy').directive('dropDown', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs){
            var hideMenu = false;

            $(element[0]).mouseenter(function(){
                $(this).siblings().removeClass('on');
                $(this).addClass('on');
                if(hideMenu){
                    clearTimeout(hideMenu);
                }
            }).mouseleave(function(){
                hideMenu = setTimeout(function(){
                    $(element[0]).removeClass('on');
                }, 1000);
            });
        }
    }
});

//autocomplete
angular.module('wizualy').directive('autoComplete', function ($location) {
    return {
        restrict: 'C',
        scope: {
            source: '@source',
            minlength: '@minlength'
        },
        link: function (scope, element, attrs){
            $(element[0]).autocomplete({
                source: function(request, response) {
                    $.ajax({
                        'type': 'GET',
                        'url': scope.source + request.term,
                        'cache': false,
                        'success': function(data){
                            response( $.map(data, function (item)
                            {
                                return {
                                    label: item.name,
                                    value: item.permalink
                                }
                            }));
                        }
                    });
                },
                minLength: scope.minlength,
                select: function( event, ui ) {
                    return false;
                },
                focus: function(event, ui){},
                open: function(event, ui){
                }
            }).data("uiAutocomplete")._renderItem = (function (ul, item) {
                return $("<li></li>")
                    .data("item.uiAutocomplete", item)
                    .append('<a href="#/x/' + item.value + '">' + item.label + "</a>")
                    .appendTo(ul);
            });
        }
    }
});

//normalize JSON structure
function normalizeCategoryResults(results){
    return {
        count: results.count,
        data: results.data
    }
}

function normalizeXResults(results){
    return {
        name: results.name,
        permalink: results.permalink,
        website: results.homepage_url,
        twitter: results.twitter_user,
        category: results.category_code,
        email: results.email_address,
        description: results.description,
        overview: results.overview,
        image: results.image[0].image,
        locations: results.offices,
        funding_rounds : results.funding_rounds,
        total : results.total_funding_raised,
        color : '#9D844F',
        radius : 200, // TODO: compute radius
        funding: {
            unit: "USD",
            total: results.total_founding_raised
        }
    }
}

//configure routes
wizualyApp.config(['$routeProvider', '$locationProvider',
    function ($routeProvider, $locationProvider) {
        $routeProvider.
            when('/', {
                templateUrl: 'partials/index.html'
            }).
            when('/x/:permalink', {
                templateUrl: 'partials/x.html'
            }).
            when('/y/:permalink', {
                templateUrl: 'partials/y.html'
            }).
            when('/z/:permalink', {
                templateUrl: 'partials/z.html'
            }).
            otherwise({
                redirectTo: '/'
            });

        //$locationProvider.html5Mode(Modernizr.history ? true : false);
    }
]).run(function(Data, $http, $rootScope){
    $http({
        'method': 'GET',
        'url': 'data/categories.json'
    }).success(
        function(data, status, headers, config){
            Data.categories = data;
        }
    ).error(
        function(data, status, headers, config){
        }
    );
});

/******************************************************************/
//data
wizualyApp.factory('Data', function(){
    return {
        results: {}
    };
});


/******************************************************************/
//categories
wizualyApp.controller('CategoryController', ['$scope', 'Data', '$http', function($scope, Data, $http){
    //store categories
    $scope.categories = Data.categories;
    $scope.results = {};

    $scope.catColor = function(category){
        return {
            background: category.color
        }
    };

    //get results
    $scope.getCategoryResults = function(){
        console.log('[DEBUG] showCategoryResults');
        var permalink = this.category.permalink;

        if(!$scope.results[permalink]) {
            $http({
                'method': 'GET',
                'url': 'http://vc-interactive-lb-393591138.us-east-1.elb.amazonaws.com/vc-webapp/api/v3/categories/su/' + permalink + '/50'
            }).success(
                function(data, status, headers, config){
                    $scope.results[permalink] = data;
                }
            ).error(
                function(data, status, headers, config){
                    console.log('error occured when downloading ' + permalink);
                }
            );
        }
    };
}]);

//entity controller
wizualyApp.controller('XController', ['$scope', 'Data', '$http', function($scope, Data, $http){
    //get entity data
    $scope.getEntityData = function(permalink){
        $http({
            'method': 'GET',
            'url': 'http://vc-interactive-lb-393591138.us-east-1.elb.amazonaws.com/vc-webapp/api/v3/relations/su/' + permalink
        }).success(
            function(data, status, headers, config){
                console.log('data: ', data);

                $scope.x = normalizeXResults(data);

                console.log('data-normalized: ', $scope.x);
            }
        ).error(
            function(data, status, headers, config){
            }
        );
    };

    //get entity data when the route has changed
    $scope.$on('$routeChangeSuccess', function(scope, next, current){
        if(next.templateUrl === 'partials/x.html') {
            $scope.getEntityData(next.params.permalink);
        }
    });
}]);

//search controller
wizualyApp.controller('SearchController', ['$scope', function($scope){
}]);