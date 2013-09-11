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
                chart = d3.select(element[0])
                    .append("svg")
                    .attr("width", container.width * MAX_BUBBLE_SIZE_RELATIVE)
                    .attr("height", container.height * MAX_BUBBLE_SIZE_RELATIVE);

            scope.drawBubble = function (entity) {

                console.log('[DEBUG] container: ', container);
                
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

                g.append("circle")
                    .attr("class", "bubble-round")
                    .attr("cx", cx)
                    .attr("cy", cy)
                    .attr("r", R )
                    .style("fill", '#9d844f');

                g.append("circle")
                    .attr("class", "bubble-round")
                    .attr("cx", cx)
                    .attr("cy", cy)
                    .attr("r", 100 )
                    .style("stroke", "#554")
                    .style("stroke-width", 1.3)
                    .style("fill", "transparent");

                angular.forEach(entity.funding_rounds, function() {
                    // add each funding .. as event timeline
                });
            };

            scope.$watch('entities', function(data){
                if(typeof data != 'undefined') {
                    console.log('data: ', data.length);

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

                console.log('x: ', $scope.x);
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