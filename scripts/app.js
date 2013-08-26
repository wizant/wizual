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

//define applicaton
var wizualyApp = angular.module('wizualy', ['ngResource', 'ngRoute', 'ngSanitize']);

//chart directive
angular.module('wizualy').directive('bubbleChart', function () {
    // constants
    var margin = 20,
        width = 960,
        height = 500 - margin,
        color = d3.interpolateRgb("#f77", "#77f"),
        scale = d3.scale.linear();

    return {
        restrict: 'A',
        replace: true,
        transclude: true,
        scope: {
            entities: '='
        },
        link: function (scope, element, attrs) {
            var chart = d3.select(element[0])
                .append("svg")
                .attr("width", width)
                .attr("height", height + margin + 100);

            scope.drawBubble = function (entity) {
            };

            scope.$watch('entities', function(data){

                angular.forEach(data, function(value, key){
                    scope.drawBubble(value);
                });
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
    $http.defaults.useXDomain = true;

    //store categories
    $scope.categories = Data.categories;
    $scope.results = {};

    //get results
    $scope.getCategoryResults = function(){
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
wizualyApp.controller('EntityController', ['$scope', 'Data', '$http', function($scope, Data, $http){
    //get entity data
    $scope.getEntityData = function(permalink){
        $http({
            'method': 'GET',
            'url': 'http://vc-interactive-lb-393591138.us-east-1.elb.amazonaws.com/vc-webapp/api/v3/relations/su/' + permalink
        }).success(
            function(data, status, headers, config){
                $scope.x = data;
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
    $scope.z = 'http://vc-interactive-lb-393591138.us-east-1.elb.amazonaws.com/vc-webapp/api/v3/name/pe/';
}]);