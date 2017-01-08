/**
 * Created by Mohamed on 18/12/2016.
 */
var app = angular.module("starter", ["ui.router", 'angular-jwt', 'angular-storage']);
var socket = io.connect("http://localhost:8082");
var baseUrl = "http://localhost:8080";
app.config(['$stateProvider', '$urlRouterProvider', 'jwtInterceptorProvider', '$httpProvider', function ($stateProvider, $urlRouterProvider, jwtInterceptorProvider, $httpProvider) {

    jwtInterceptorProvider.tokenGetter = function (store) {
        return store.get('jwt');
    };
    $stateProvider.state('home',
        {
            url: '/home',
            templateUrl: 'views/home2.html',
            controller: 'HomeCtrl',
            data: {
                requiresLogin: true
            }
        }).state('societe',
        {
            url: '/societe',
            templateUrl: 'views/societe.html',
            controller: 'SocieteCtrl',
            data: {
                requiresLogin: true
            }
        }).state('consulte',
        {
            url: '/consulte',
            templateUrl: 'views/consulte.html',
            controller: 'ConsulteCtrl',
            data: {
                requiresLogin: true
            }
        }).state('ordre',
        {
            url: '/ordre',
            templateUrl: 'views/ordre.html',
            controller: 'OrdreCtrl',
            data: {
                requiresLogin: true
            }
        }).state('showSocieteDetails',
        {
            url: '/showSocieteDetails/:id',
            templateUrl: 'views/showSocieteDetails.html',
            controller: 'showSocieteDetailsCtrl',
            data: {
                requiresLogin: true
            }
        }).state("login", {
        url: "/login",
        templateUrl: 'views/login.html',
        controller: 'loginCtrl'
    });

    $urlRouterProvider.otherwise('home');
}]);
app.run(['$rootScope', '$state', 'store', 'jwtHelper', function ($rootScope, $state, store, jwtHelper) {

    $rootScope.$on('$stateChangeStart', function (e, to) {
        if (to.data && to.data.requiresLogin) {
            if (!store.get('jwt') || jwtHelper.isTokenExpired(store.get('jwt'))) {
                e.preventDefault();
                $state.go('login');
            }
        }
    });
    $rootScope.$state = $state;
}]);

app.controller('loginCtrl', ['$scope', '$http', 'store', '$state', function ($scope, $http, store, $state) {
    $scope.user = {};
    store.set('jwt', "");
    $scope.login = function () {
        $http({
            url: 'http://localhost:8080/auth',
            method: 'POST',
            data: $scope.user
        }).then(function (response) {
            store.set('jwt', response.data.token);
            console.log(response.data.token);
            $state.go('home');
        }, function (error) {
            console.log(error);
            if (error.status == 401) $scope.messageError = "Identifiant ou mot de passe incorrect";
            else $scope.messageError = "Erreur du web service !!";
        });

    };
    $scope.annuler = function () {
        $scope.user = {};
    };

}]);

app.controller("showSocieteDetailsCtrl", ["$scope", "ProjectService", "$rootScope", "$stateParams", "$state", function ($scope, ProjectService, $rootScope, $stateParams, $state) {
    console.log($stateParams.id);
    $scope.societe = {};
    $scope.totalAchat = "";
    $scope.totalVente = "";
    $scope.moyenneVente = "";
    $scope.moyenneAchat = "";
    $scope.ordres = [];
    $scope.page = 0;
    $scope.size = 10;
    $scope.TotalPage = 0;
    ProjectService.getSocieteById($stateParams.id, function (r) {

        $scope.societe = r;
        if ($scope.societe != null) {
            ProjectService.totalAchat($stateParams.id, function (r) {
                $scope.totalAchat = r;
            });
            ProjectService.totalVente($stateParams.id, function (r) {
                $scope.totalVente = r;

            });
            ProjectService.moyenneVente($stateParams.id, function (r) {
                $scope.moyenneVente = r;

            });
            ProjectService.moyenneAchat($stateParams.id, function (r) {
                $scope.moyenneAchat = r;

            });
            google.charts.load("current", {packages: ["corechart"]});
            google.charts.setOnLoadCallback(drawChart);
            function drawChart() {
                var data = google.visualization.arrayToDataTable([
                    ['Ordre', 'Total'],
                    ['Achats', $scope.totalVente],
                    ['Vente', $scope.totalAchat]
                ]);
                var options = {
                    title: 'Chart Pie Total Achats / Ventes -Societe :  ' + $scope.societe.nameSociete,
                    is3D: true,
                };

                var chart = new google.visualization.PieChart(document.getElementById('piechart_3d'));
                chart.draw(data, options);
            }

            ProjectService.getOrdresSociete($scope.societe.idSociete, $scope.page, $scope.size, function (r) {
                angular.forEach(r.content, function (value, key) {
                    this.push(value);
                }, $scope.ordres);

                $scope.page = r.number;
                $scope.TotalPage = r.totalPages;
            })
            $scope.goToPage = function (page) {
                $scope.page = page;
                $scope.ordres = [];
                ProjectService.getOrdresSociete($scope.societe.idSociete, $scope.page, $scope.size, function (r) {
                    angular.forEach(r.content, function (value, key) {
                        this.push(value);
                    }, $scope.ordres);
                    $scope.page = r.number;
                    $scope.TotalPage = r.totalPages;
                })

            }

        }
    })
    /*Debuut NodeJs*/
    socket.on('AjoutOrdre', function (rep) {
        $scope.message = $scope.replaceAll(rep.message, '"', '')
        if ($scope.societe.idSociete == $scope.message) {
            $scope.goToPage($scope.page);
            $scope.$watch('ordres', function (newNames, oldNames) {
                $scope.ordres = newNames;
            });
        }
        $rootScope.$apply();


    })
    /* Fin Nodejs*/
    $scope.range = function (min, max, step) {
        step = step || 1;
        var input = [];
        for (var i = min; i <= max; i += step) {
            input.push(i);
        }
        return input;
    };
    $scope.replaceAll = function (str, find, replace) {
        return str.replace(new RegExp(find, 'g'), replace);
    }
}])
app.controller("ConsulteCtrl", ["$scope", "ProjectService", "$rootScope", "$state", function ($scope, ProjectService, $rootScope, $state) {
    $scope.societes = [];
    $scope.page = 0;
    $scope.size = 10;
    $scope.TotalPage = 0;
    $scope.idSupprimer = 0;
    $scope.actualite = null;
    $(".ignore-click").click(function () {
        return false;
    });
    $scope.SocieteSearch = "";
    $scope.chercher = function () {
        console.log("ana hona");
        $state.go("showSocieteDetails", {"id": $scope.SocieteSearch});
    }
    $scope.chargerSocietes = function () {
        ProjectService.getSocietesByPage($scope.page, $scope.size, function (r) {
            angular.forEach(r.content, function (value, key) {
                this.push(value);
            }, $scope.societes);
            $scope.page = r.number;
            $scope.TotalPage = r.totalPages;
            // $scope.$apply($scope.societes);
        })

    }
    $scope.chargerSocietes();
    $scope.goToPage = function (page) {
        $scope.page = page;
        $scope.societes = [];
        $scope.chargerSocietes();
    }
    $scope.IdSociete = "";
    $scope.ShowOrdres = function (id) {
        $scope.IdSociete = id;
        $state.go("showSocieteDetails", {"id": $scope.IdSociete});

    }

    /*Debuut NodeJs*/
    socket.on('AjoutSociete', function (message) {
        console.log("AjoutSociete");
        $scope.societes = [];
        $scope.page = $scope.page;
        $scope.size = 10;
        $scope.chargerSocietes();
        $rootScope.$apply();


    })
    /* Fin Nodejs*/
    $scope.range = function (min, max, step) {
        step = step || 1;
        var input = [];
        for (var i = min; i <= max; i += step) {
            input.push(i);
        }
        return input;
    };
}])

app.controller("HomeCtrl", ["$scope", "ProjectService", "$rootScope", "$state", function ($scope, ProjectService, $rootScope, $state) {

}])
app.controller("OrdreCtrl", ["$scope", "ProjectService", "$rootScope", function ($scope, ProjectService, $rootScope) {

    $scope.ordre = {};
    $scope.societes = [];
    $scope.codeSociete = "";
    $scope.typeOrdre = "";
    ProjectService.getSocietes(function (r) {

        angular.forEach(r._embedded.societes, function (value, key) {
            console.log(r);
            this.push(value);
        }, $scope.societes);

    })
    $scope.SocieteId = "";
    $scope.ordre.prix = 0;
    $scope.ordre.date = new Date();
    $scope.ordre.numberAction = 0;
    $scope.update = function () {
        $scope.codeSociete = $("#selectSociete").val().split(":")[1];
        $scope.typeOrdre = $("#coco input[type='radio']:checked").val();


    }

    $scope.saveOrder = function () {
        $scope.update();
        ProjectService.addOrdre($scope.codeSociete, $scope.ordre, $scope.typeOrdre, function (r) {
            console.log(r);
        })
    }
}])
app.controller("SocieteCtrl", ["$scope", "ProjectService", "$rootScope", function ($scope, ProjectService, $rootScope) {
    $scope.societe = {};
    $scope.societe.idSociete = "";
    $scope.societe.nameSociete = "";
    $scope.ajouterSociete = function () {

        ProjectService.addSociete($scope.societe, function (r) {
            console.log(r);
        })
    }
}])


app.service("ProjectService", ["$http", "$log", 'store', function ($http, $log, store) {
    this.getSocieteById = function (id, cb) {
        $http({
            url: baseUrl + "/findSociete?code=" + id,
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': store.get('jwt')
            },
            method: "GET",
            cache: true
        }).then(function (resp) {
            cb(resp.data)
        }, function (err) {
            $log.log(err);
        })
    }
    this.getOrdresSociete = function (code, page, size, cb) {
        $http({
            url: baseUrl + "/findOrdersByPage?code=" + code + "&page=" + page + "&size=" + size,
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': store.get('jwt')
            },
            method: "GET"
        }).then(function (resp) {
            console.log(resp.data)
            cb(resp.data)
        }, function (err) {
            $log.log("Erreuuur");
        })
    }
    this.getSocietes = function (cb) {
        $http({
            url: baseUrl + "/societes?page=0&size=100",
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': store.get('jwt')
            },
            method: "GET"
        }).then(function (resp) {
            cb(resp.data)
        }, function (err) {
            $log.log(err);
        })
    }
    this.getSocietesByPage = function (p, s, cb) {
        $http({
            url: baseUrl + "/findSocietes",
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': store.get('jwt')
            },
            params: {
                page: p, size: s,
            }
        }).then(function (resp) {
            cb(resp.data)
        }, function (err) {
            $log.log(err);
        })
    }
    this.moyenneAchat = function (code, cb) {
        $http({
            url: baseUrl + "/moyenneAchat?code=" + code,
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': store.get('jwt')
            },
            cache: true
        }).then(function (resp) {
            cb(resp.data)
        }, function (err) {
            $log.log(err);
        })
    }
    this.moyenneVente = function (code, cb) {
        $http({
            url: baseUrl + "/moyenneVente?code=" + code,
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': store.get('jwt')
            },
            cache: true
        }).then(function (resp) {
            cb(resp.data)
        }, function (err) {
            $log.log(err);
        })
    }
    this.totalVente = function (code, cb) {
        $http({
            url: baseUrl + "/totalVente?code=" + code,
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': store.get('jwt')
            },
            cache: true
        }).then(function (resp) {
            cb(resp.data)
        }, function (err) {
            $log.log(err);
        })
    }
    this.totalAchat = function (code, cb) {
        $http({
            url: baseUrl + "/totalAchat?code=" + code,
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': store.get('jwt')
            },
            cache: true
        }).then(function (resp) {
            cb(resp.data)
        }, function (err) {
            $log.log(err);
        })
    }
    this.addSociete = function (soc, cb) {
        console.log("Seriiivce");
        console.log(soc);
        $http({
            url: baseUrl + "/saveSociete",
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': store.get('jwt')
            },
            data: {idSociete: soc.idSociete, nameSociete: soc.nameSociete}
        }).then(function (resp) {
            cb(resp)
        }, function (err) {
            $log.log(err);
        })
    }
    this.addOrdre = function (code, ordre, type, cb) {
        $http({
            url: baseUrl + "/saveOrdre?code=" + code + "&type=" + type,
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': store.get('jwt')
            },

            data: {nbrAction: ordre.numberAction, prix: ordre.prix, date: ordre.date}
        }).then(function (resp) {
            cb(resp)
        }, function (err) {
            $log.log(err);
        })
    }


}]);


app.filter("addDhsSign", function () {
    return function (input) {
        return input + " Dhs";
    }
})