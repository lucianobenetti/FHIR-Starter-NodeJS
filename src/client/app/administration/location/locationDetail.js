/**
 * Copyright 2014 Peter Bernhardt, et. al.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use
 * this file except in compliance with the License. You may obtain a copy of the
 * License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
(function () {
    'use strict';

    var controllerId = 'locationDetail';

    angular.module('FHIRStarter').controller(controllerId,
        ['$location', '$routeParams', '$window', 'addressService',  'bootstrap.dialog', 'common', 'fhirServers', 'identifierService', 'localValueSets', 'locationService', 'organizationService', 'telecomService', 'valuesetService', locationDetail]);

    function locationDetail($location, $routeParams, $window, addressService, bsDialog, common, fhirServers, identifierService, localValueSets, locationService, organizationService, telecomService, valuesetService) {
        var vm = this;
        var logError = common.logger.getLogFn(controllerId, 'error');
        var logSuccess = common.logger.getLogFn(controllerId, 'success');
        var logWarning = common.logger.getLogFn(controllerId, 'warning');
        var $q = common.$q;

        vm.activeServer = null;
        vm.cancel = cancel;
        vm.activate = activate;
        vm.delete = deleteLocation;
        vm.edit = edit;
        vm.getLocationReference = getLocationReference;
        vm.getOrganizationReference = getOrganizationReference;
        vm.getTitle = getTitle;
        vm.goBack = goBack;
        vm.isSaving = false;
        vm.isEditing = true;
        vm.loadingLocations = false;
        vm.location = undefined;
        vm.locationTypes = undefined;
        vm.position = { "latitude": null, "longitude": null, "altitude": null };
        vm.save = save;
        vm.states = undefined;
        vm.title = 'locationDetail';

        Object.defineProperty(vm, 'canSave', {
            get: canSave
        });

        Object.defineProperty(vm, 'canDelete', {
            get: canDelete
        });

        activate();

        function activate() {
            common.activateController([getActiveServer(), getLocationModes(), getLocationPhysicalTypes(), getLocationStatuses()], controllerId)
                .then(function () {
                    getLocationRoleTypes();
                    getRequestedLocation();
                });
        }

        function cancel() {

        }

        function canDelete() {
            return !vm.isEditing;
        }

        function canSave() {
            return !vm.isSaving;
        }

        function deleteLocation(location) {
            return bsDialog.deleteDialog(location.name)
                .then(confirmDelete);

            function confirmDelete() {
            if (location && location.resourceId && location.hashKey) {
                locationService.deleteCachedLocation(location.hashKey, location.resourceId)
                    .then(function () {
                        logSuccess("Deleted location " + location.name);
                        $location.path('/locations');
                    },
                    function (error) {
                        logError(common.unexpectedOutcome(error));
                    }
                );
            }}
        }

        function edit(location) {
            if (location && location.hashKey) {
                $location.path('/location/edit/' + location.hashKey);
            }
        }

        function getActiveServer() {
            fhirServers.getActiveServer()
                .then(function (server) {
                    return vm.activeServer = server;
                });
        }

        function getLocationModes() {
            return vm.modes = localValueSets.locationMode();
        }

        function getLocationReference(input) {
            var deferred = $q.defer();
            vm.loadingLocations = true;
            locationService.getLocationReference(vm.activeServer.baseUrl, input)
                .then(function (data) {
                    vm.loadingLocations = false;
                    deferred.resolve(data);
                }, function (error) {
                    vm.loadingLocations = false;
                    logError(common.unexpectedOutcome(error));
                    deferred.reject();
                });
            return deferred.promise;
        }

        function getLocationRoleTypes() {
            valuesetService.getExpansion(vm.activeServer.baseUrl, "http://hl7.org/fhir/v3/vs/ServiceDeliveryLocationRoleType")
                .then(function (expansions) {
                    return vm.locationRoleTypes = expansions;
                }, function (error) {
                    logError(common.unexpectedOutcome(error));
                });
        }

        function getLocationPhysicalTypes() {
            return vm.physicalTypes = localValueSets.locationPhysicalType();
        }

        function getLocationStatuses() {
            return vm.statuses = localValueSets.locationStatus();
        }

        function getOrganizationReference(input) {
            var deferred = $q.defer();
            vm.loadingOrganizations = true;
            organizationService.getOrganizationReference(vm.activeServer.baseUrl, input)
                .then(function (data) {
                    vm.loadingOrganizations = false;
                    deferred.resolve(data);
                }, function (error) {
                    vm.loadingOrganizations = false;
                    logError(common.unexpectedOutcome(error));
                    deferred.reject();
                });
            return deferred.promise;
        }

        function getRequestedLocation() {
            if ($routeParams.hashKey === 'new') {
                var data = locationService.initializeNewLocation();
                intitializeRelatedData(data);
                vm.title = 'Add New Location';
                vm.isEditing = false;
            } else {
                if ($routeParams.hashKey) {
                    locationService.getCachedLocation($routeParams.hashKey)
                        .then(intitializeRelatedData, function (error) {
                            logError(common.unexpectedOutcome(error));
                        });
                } else if ($routeParams.id) {
                    var resourceId = vm.activeServer.baseUrl + '/Location/' + $routeParams.id;
                    locationService.getLocation(resourceId)
                        .then(intitializeRelatedData, function (error) {
                            logError(common.unexpectedOutcome(error));
                        });
                }
            }

            function intitializeRelatedData(data) {
                vm.location = data;
                if (angular.isUndefined(vm.location.type)) {
                    vm.location.type = { "coding": [] }
                }
                if (angular.isUndefined(vm.location.physicalType)) {
                    vm.location.physicalType = { "coding": [] }
                }
                vm.title = vm.location.name;
                identifierService.init(vm.location.identifier, 'multi');
                addressService.init([vm.location.address], false, 'single');
                telecomService.init(vm.location.telecom, false, false);
            }
        }

        function getTitle() {
            var title = '';
            if (vm.location) {
                title = vm.title = 'Edit ' + ((vm.location && vm.location.fullName) || '');
            } else {
                title = vm.title = 'Add New Location';
            }
            return vm.title = title;
        }

        function goBack() {
            $window.history.back();
        }

        function save() {
            if (vm.location.name.length < 5) {
                logError("Location Name must be at least 5 characters");
                return;
            }
            var location = locationService.initializeNewLocation();
            location.identifier = identifierService.getAll();
            location.name = vm.location.name;
            location.description = vm.location.description;
            location.type = vm.location.type;
            location.telecom = telecomService.mapFromViewModel();
            location.address = addressService.mapFromViewModel()[0];
            location.physicalType = vm.location.physicalType;
            location.managingOrganization = vm.location.managingOrganization;
            location.partOf = vm.location.partOf;
            location.position = vm.location.position;
            location.mode = vm.location.mode;
            location.status = vm.location.status;
            if (vm.isEditing) {
                locationService.updateLocation(vm.location.resourceId, location)
                    .then(processResult,
                    function (error) {
                        logError(common.unexpectedOutcome(error));
                    });
            } else {
                locationService.addLocation(location)
                    .then(processResult,
                    function (error) {
                        logError(common.unexpectedOutcome(error));
                    });
            }

            function processResult(results) {
                var resourceVersionId = results.headers.location || results.headers["content-location"];
                if (angular.isUndefined(resourceVersionId)) {
                    logWarning("Location saved, but remote location is unavailable. CORS not implemented correctly at remote host.");
                } else {
                    vm.location.resourceId = common.setResourceId(vm.location.resourceId, resourceVersionId);
                    logSuccess("Location saved at " + resourceVersionId);
                }
                vm.location.fullName = location.name;
                vm.isEditing = true;
                getTitle();
            }
        }
    }
})();