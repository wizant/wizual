(function($){
    //add classes to form inputs based on their type
    $('input').each(function(){
        $(this).addClass($(this).attr('type'));
    });

    //open external links in a new window
    $('a').filter(function(index){
        return /^https?:\/\/(www.)?/i.test($(this).attr('href')) && $(this).attr('href').toLowerCase().indexOf(window.location.hostname) == -1;
    }).attr('target', '_blank').addClass('external');

    //placeholders
    $('input, textarea').placeholder();
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
                console.log(entity);
            };

            scope.$watch('entities', function(data){

                angular.forEach(data, function(value, key){
                    scope.drawBubble(value);
                });
            });
        }
    }
});

//configure routes
wizualyApp.config(['$routeProvider',
        function ($routeProvider) {
            $routeProvider.
                when('/', {
                    templateUrl: 'partials/index.html'
                }).
                when('/entity/:permalink', {
                    templateUrl: 'partials/entity.html'
                }).
                otherwise({
                    redirectTo: '/'
                });
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
    $scope.getCategoryResults = function(permalink){
        if(!$scope.results[permalink]) {
            $http({
                'method': 'GET',
                'url': 'http://vc-interactive-lb-393591138.us-east-1.elb.amazonaws.com/vc-webapp/api/v3/categories/su/' + permalink + '/50'
            }).success(
                function(data, status, headers, config){
                    $scope.results[permalink] = data;

                    $('.drop-down').jScrollPane();
                }
            ).error(
                function(data, status, headers, config){
                    console.log('error occured when downloading ' + permalink);
                }
            );
        }
    };

    //show cats
    $scope.showCats = function(){
        $('#category-'+this.category.permalink+' .drop-down').show();
        $scope.getCategoryResults(this.category.permalink);
    };

    //hide cats
    $scope.hideCats = function(){
        $('#category-'+this.category.permalink+' .drop-down').hide();
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
                $scope.entity = data;
            }
        ).error(
            function(data, status, headers, config){
            }
        );
    };

    //get entity data when the route has changed
    $scope.$on('$routeChangeSuccess', function(scope, next, current){
        if(next.templateUrl === 'partials/entity.html') {
            $scope.getEntityData(next.params.permalink);
        }
    });
}]);