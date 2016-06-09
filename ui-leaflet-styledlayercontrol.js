(function() {
	'use strict';
	
	angular.module('ui-leaflet-styledlayercontrol', ['nemLogging', 'ui-leaflet', 'oitozero.ngSweetAlert', 'ngAnimate', 'ui.bootstrap', 'color.picker', 'ui.bootstrap-slider', 'mgcrea.ngStrap', 'ngSanitize']);
	
	angular.module('ui-leaflet-styledlayercontrol').config(function($provide) {
		return $provide.decorator('leafletLayerHelpers', function($delegate){
			angular.extend($delegate.layerTypes, {
				geoJSONAwesomeMarkerHermes: {
				  mustHaveUrl: false,
				  createLayer: function(params) {
					return new L.geoJson(params.data, {
					  pointToLayer: function(feature, latlng) {
						return L.marker(latlng, {icon: L.AwesomeMarkers.icon({icon:params.options.icon, prefix: params.options.prefix, markerColor: params.options.markerColor, iconColor: params.options.iconColor})});
					  },
					});
				  },
				}
			});
			return $delegate;
		});
	});
	
	angular.module('ui-leaflet-styledlayercontrol').directive('hermeslayercontrol', ["$filter", "$log", "leafletData", "leafletHelpers", "SweetAlert", "$uibModal", "leafletLayerHelpers", function($filter, $log, leafletData, leafletHelpers, SweetAlert, $uibModal, leafletLayerHelpers) {
	
	  return {
		restrict: 'E',
		scope: {
		  icons: '=?',
		  autoHideOpacity: '=?', // Hide other opacity controls when one is activated.
		  showGroups: '=?', // Hide other opacity controls when one is activated.
		  title: '@',
		  baseTitle: '@',
		  overlaysTitle: '@',
		},
		replace: true,
		transclude: false,
		require: '^leaflet',
		controller: ["$scope", "$element", "$sce", function($scope, $element, $sce) {
		  $log.debug('[Angular Directive - Layers] layers', $scope, $element);
		  var safeApply = leafletHelpers.safeApply;
		  var isDefined = leafletHelpers.isDefined;
		  angular.extend($scope, {
			baselayer: '',
			oldGroup: '',
			layerProperties: {},
			groupProperties: {},
			rangeIsSupported: leafletHelpers.rangeIsSupported(),
			changeBaseLayer: function(key, e) {
			  leafletHelpers.safeApply($scope, function(scp) {
				scp.baselayer = key;
				leafletData.getMap().then(function(map) {
				  leafletData.getLayers().then(function(leafletLayers) {
					if (map.hasLayer(leafletLayers.baselayers[key])) {
					  return;
					}

					for (var i in scp.layers.baselayers) {
					  scp.layers.baselayers[i].icon = scp.icons.unradio;
					  if (map.hasLayer(leafletLayers.baselayers[i])) {
						map.removeLayer(leafletLayers.baselayers[i]);
					  }
					}

					map.addLayer(leafletLayers.baselayers[key]);
					scp.layers.baselayers[key].icon = $scope.icons.radio;
				  });
				});
			  });

			  e.preventDefault();
			},

			moveLayer: function(ly, newIndex, e) {
			  var delta = Object.keys($scope.layers.baselayers).length;
			  if (newIndex >= (1 + delta) && newIndex <= ($scope.overlaysArray.length + delta)) {
				var oldLy;
				for (var key in $scope.layers.overlays) {
				  if ($scope.layers.overlays[key].index === newIndex) {
					oldLy = $scope.layers.overlays[key];
					break;
				  }
				}

				if (oldLy) {
				  safeApply($scope, function() {
					oldLy.index = ly.index;
					ly.index = newIndex;
				  });
				}
			  }

			  e.stopPropagation();
			  e.preventDefault();
			},

			initIndex: function(layer, idx) {
			  var delta = Object.keys($scope.layers.baselayers).length;
			  layer.index = isDefined(layer.index) ? layer.index : idx + delta + 1;
			},

			initGroup: function(groupName) {
			  $scope.groupProperties[groupName] = $scope.groupProperties[groupName] ? $scope.groupProperties[groupName] : {};
			},

			toggleOpacity: function(e, layer) {
			  if (layer.visible) {
				if ($scope.autoHideOpacity && !$scope.layerProperties[layer.name].opacityControl) {
				  for (var k in $scope.layerProperties) {
					$scope.layerProperties[k].opacityControl = false;
				  }
				}

				$scope.layerProperties[layer.name].opacityControl = !$scope.layerProperties[layer.name].opacityControl;
			  }

			  e.stopPropagation();
			  e.preventDefault();
			},

			toggleLegend: function(layer) {
			  $scope.layerProperties[layer.name].showLegend = !$scope.layerProperties[layer.name].showLegend;
			},

			showLegend: function(layer) {
			  return layer.legend && $scope.layerProperties[layer.name].showLegend;
			},

			unsafeHTML: function(html) {
			  return $sce.trustAsHtml(html);
			},

			getOpacityIcon: function(layer) {
			  return layer.visible && $scope.layerProperties[layer.name].opacityControl ? $scope.icons.close : $scope.icons.open;
			},

			getGroupIcon: function(group) {
			  return group.visible ? $scope.icons.check : $scope.icons.uncheck;
			},

			changeOpacity: function(layer) {
			  var op = $scope.layerProperties[layer.name].opacity;
			  leafletData.getMap().then(function(map) {
				leafletData.getLayers().then(function(leafletLayers) {
				  var ly;
				  for (var k in $scope.layers.overlays) {
					if ($scope.layers.overlays[k] === layer) {
					  ly = leafletLayers.overlays[k];
					  break;
					}
				  }

				  if (map.hasLayer(ly)) {
					if (ly.setOpacity) {
					  ly.setOpacity(op / 100);
					}

					if (ly.getLayers && ly.eachLayer) {
					  ly.eachLayer(function(lay) {
						if (lay.setOpacity) {
						  lay.setOpacity(op / 100);
						}
					  });
					}
				  }
				});
			  });
			},

			changeGroupVisibility: function(groupName) {
			  if (!isDefined($scope.groupProperties[groupName])) {
				return;
			  }

			  var visible = $scope.groupProperties[groupName].visible;
			  for (var k in $scope.layers.overlays) {
				var layer = $scope.layers.overlays[k];
				if (layer.group === groupName) {
				  layer.visible = visible;
				}
			  }
			},
			
			deleteLayer: function(layerIndex, layer) {
				SweetAlert.swal({
					   title: "Delete Layer",
					   text: "Are you sure?",
					   type: "warning",
					   showCancelButton: true,
					   confirmButtonColor: "#DD6B55",
					   confirmButtonText: "Ok",
					   closeOnConfirm: true,
					   closeOnCancel: true 
					}, 
					function(isConfirm){
						if (isConfirm){
							for (var key in $scope.layers.overlays) {
							  if ($scope.layers.overlays[key].index === layerIndex) {
								delete $scope.layers.overlays[key];
								break;
							  }
							}
						}
					});
					
			  
			},
			
			editLayer: function(layerIndex, layer) {
				//Recuperamos el estilo
				if (layer.type == "geoJSONShape" || layer.type == "geoJSONAwesomeMarkerHermes"){
					var modalInstance = $uibModal.open({
					  animation: true,
					  //templateUrl: 'myModalLayer.htm',
					  template: '<div class="modal-header"> ' +
								'	<h3 class="modal-title"> ' +
								'		Edit Style ' +
								'	</h3> ' +
								'</div> ' +

								'<div class="modal-body"> ' + 
								'	<div class="form-group">' +
								'  		<label>Style</label> ' +
								'  		<select id="style" name="style" data-ng-model="styleSelected" class="form-control" data-ng-change="changeStyle()"> ' +
								'			<option value="geoJSONShape">Simple</option> ' +
								'			<option value="geoJSONAwesomeMarkerHermes">Marker</option> ' +
								'		</select> ' +	
								'	</div> ' +
									
								'	<div id="styleSimple" data-ng-show="showSimple"> ' +
								'		<div class="form-group"> ' +
								'			<label>Stroke Width</label> ' +
								'			<input type="text" name="weight" class="form-control" data-ng-model="weight"> ' +
								'		</div> ' +
										
								'		<div class="form-group"> ' +
								'			<label>Stroke color</label> ' +
								'			<color-picker ng-model="color" color-picker-swatch-only="true"></color-picker> ' +
								'		</div> ' +
										
								'		<div class="form-group"> ' +
								'			<label>Stroke opacity</label> ' +
								'			<slider ng-model="opacity" min="0" step="0.1" max="100" value="opacity"></slider> ' +
								'		</div> ' +
										
								'		<div class="form-group"> ' +	
								'			<label>Fill color</label> ' +
								'			<color-picker ng-model="fillColor" color-picker-swatch-only="true"></color-picker> ' +
								'		</div> ' +
										
								'		<div class="form-group"> ' +
								'			<label>Fill opacity</label> ' +
								'			<slider ng-model="fillOpacity" min="0" step="0.1" max="100" value="fillOpacity"></slider> ' +
								'		</div> ' +
								'	</div> ' +
									
								'	<div id="styleMarker" data-ng-hide="showSimple"> ' +
								'		<div class="form-group"> ' +
								'			<label>Icon</label> ' +
								'			<button type="button" class="btn btn-default" ng-model="selectedIcon" data-html="1" data-toggle="true" bs-options="icon.value as icon.label for icon in icons" bs-select> ' +
								'			  Action <span class="caret"></span> ' +
								'			</button> ' +
								'		</div> ' +
										
								'		<div class="form-group"> ' +
								'			<label>Marker color</label> ' +
								'			<select id="markerColor" name="style" data-ng-model="markerColor" class="form-control"> ' +
								'				<option value="red">Red</option> ' +
								'				<option value="darkred">Dark Red</option> ' +
								'				<option value="orange">Orange</option> ' +
								'				<option value="green">Green</option> ' +
								'				<option value="darkgreen">Dark Green</option> ' +
								'				<option value="blue">Blue</option> ' +
								'				<option value="purple">Purple</option> ' +
								'				<option value="darkpurple">Dark Purple</option> ' +
								'				<option value="cadetblue">Cadet Blue</option> ' +
								'			</select> ' +	
								'		</div> ' +
										
								'		<div class="form-group"> ' +
								'			<label>Icon color</label> ' +
								'			<color-picker ng-model="iconColor" color-picker-swatch-only="true"></color-picker> ' +
								'		</div> ' +
										
								'	</div> ' +
									
								'</div> ' +

								'<div class="modal-footer"> ' +
								'	<button class="btn btn-primary" type="button" ng-click="save()">Save</button> ' + 
								'	<button class="btn btn-warning" type="button" ng-click="cancel()">Cancel</button> ' +
								'</div> ',
					  controller: 'ModalLayerCtrl',
					  resolve: {
						styleType: function(){
							return layer.type;
						},
						style: function () {
							if (layer.type == "geoJSONShape"){
								return layer.layerOptions.style;
							}else{
								return layer.layerOptions; 
							}
						},
						layerIndex: function(){
							return layerIndex;
						}
					  }
					});
					
					modalInstance.result.then(function (response) {
						var styleType = response.styleType;
						var newStyle = response.style;
						var layerIndex = response.layerIndex;
						
						if (styleType === 'geoJSONShape'){
							//Asignamos los valors al estilo
							layer.layerOptions.style.color = newStyle.color;
							layer.layerOptions.style.fillColor = newStyle.fillColor;
							layer.layerOptions.style.fillOpacity = newStyle.fillOpacity;
							layer.layerOptions.style.opacity = newStyle.opacity;
							layer.layerOptions.style.weight = newStyle.weight;
						}else{
							layer.layerOptions.icon = newStyle.icon;
							layer.layerOptions.markerColor = newStyle.markerColor;
							layer.layerOptions.iconColor = newStyle.iconColor;
						}
						
						for (var key in $scope.layers.overlays) {
							  if ($scope.layers.overlays[key].index === layerIndex) {
								$scope.layers.overlays[key].doRefresh = true;
								break;
							  }
						}
							
					}, function () {
						//console.log('Modal dismissed at: ' + new Date());
					});
				}else{
					SweetAlert.swal("You cannot edit this kind of layer");
				}
			}
		  });

		  var div = $element.get(0);
		  if (!L.Browser.touch) {
			L.DomEvent.disableClickPropagation(div);
			L.DomEvent.on(div, 'mousewheel', L.DomEvent.stopPropagation);
		  } else {
			L.DomEvent.on(div, 'click', L.DomEvent.stopPropagation);
		  }
		}],

		template:
		'<div class="angular-leaflet-control-layers" ng-show="overlaysArray.length">' +
			'<h4 ng-if="title">{{ title }}</h4>' +
			'<div class="lf-baselayers">' +
				'<h5 class="lf-title" ng-if="baseTitle">{{ baseTitle }}</h5>' +
				'<div class="lf-row" ng-repeat="(key, layer) in baselayersArray">' +
					'<label class="lf-icon-bl" ng-click="changeBaseLayer(key, $event)">' +
						'<input class="leaflet-control-layers-selector" type="radio" name="lf-radio" ' +
							'ng-show="false" ng-checked="baselayer === key" ng-value="key" /> ' +
						'<i class="lf-icon lf-icon-radio" ng-class="layer.icon"></i>' +
						'<div class="lf-text">{{layer.name}}</div>' +
					'</label>' +
				'</div>' +
			'</div>' +
			'<div class="lf-overlays">' +
				'<h5 class="lf-title" ng-if="overlaysTitle">{{ overlaysTitle }}</h5>' +
				'<div class="lf-container">' +
					'<div class="lf-row" ng-repeat="layer in (o = (overlaysArray | orderBy:\'index\':order))" ng-init="initIndex(layer, $index)">' +
						'<label class="lf-icon-ol-group" ng-if="showGroups &amp;&amp; layer.group &amp;&amp; layer.group != o[$index-1].group">' +
							'<input class="lf-control-layers-selector" type="checkbox" ng-show="false" ' +
								'ng-change="changeGroupVisibility(layer.group)" ng-model="groupProperties[layer.group].visible"/> ' +
							'<i class="lf-icon lf-icon-check" ng-class="getGroupIcon(groupProperties[layer.group])"></i>' +
							'<div class="lf-text">{{ layer.group }}</div>' +
						'</label>' +
						'<label class="lf-icon-ol">' +
							'<input class="lf-control-layers-selector" type="checkbox" ng-show="false" ng-model="layer.visible"/> ' +
							'<i class="lf-icon lf-icon-check" ng-class="layer.icon"></i>' +
							'<div class="lf-text">{{layer.name}}</div>' +
						'</label>' +
						'<div class="lf-icons">' +
							'<i class="lf-icon lf-up" ng-class="icons.up" ng-click="moveLayer(layer, layer.index - orderNumber, $event)"></i> ' +
							'<i class="lf-icon lf-down" ng-class="icons.down" ng-click="moveLayer(layer, layer.index + orderNumber, $event)"></i> ' +
							'<i class="lf-icon lf-toggle-legend" ng-class="icons.toggleLegend" ng-if="layer.legend" ng-click="toggleLegend(layer)"></i> ' +
							'<i class="lf-icon lf-open" ng-class="getOpacityIcon(layer)" ng-click="toggleOpacity($event, layer)"></i>' +
							'<i class="lf-icon lf-deleteLayer" ng-class="icons.deleteLayer" ng-click="deleteLayer(layer.index, layer)"></i> ' +
							'<i class="lf-icon lf-editLayer" ng-class="icons.editLayer" ng-click="editLayer(layer.index, layer)"></i> ' +
						'</div>' +
						'<div class="lf-legend" ng-if="showLegend(layer)" ng-bind-html="unsafeHTML(layer.legend)"></div>' +
						'<div class="lf-opacity clearfix" ng-if="layer.visible &amp;&amp; layerProperties[layer.name].opacityControl">' +
							'<label ng-if="rangeIsSupported" class="pull-left" style="width: 50%">0</label>' +
							'<label ng-if="rangeIsSupported" class="pull-left text-right" style="width: 50%">100</label>' +
							'<input ng-if="rangeIsSupported" class="clearfix" type="range" min="0" max="100" class="lf-opacity-control" ' +
								'ng-model="layerProperties[layer.name].opacity" ng-change="changeOpacity(layer)"/>' +
							'<h6 ng-if="!rangeIsSupported">Range is not supported in this browser</h6>' +
						'</div>' +
					'</div>' +
				'</div>' +
			'</div>' +
		'</div>',
		link: function(scope, element, attrs, controller) {
		  var isDefined = leafletHelpers.isDefined;
		  var leafletScope = controller.getLeafletScope();
		  var layers = leafletScope.layers;

		  scope.$watch('icons', function() {
			var defaultIcons = {
			  uncheck: 'fa fa-square-o',
			  check: 'fa fa-check-square-o',
			  radio: 'fa fa-dot-circle-o',
			  unradio: 'fa fa-circle-o',
			  up: 'fa fa-angle-up',
			  down: 'fa fa-angle-down',
			  open: 'fa fa-angle-double-down',
			  close: 'fa fa-angle-double-up',
			  toggleLegend: 'fa fa-pencil-square-o',
			  deleteLayer: 'fa fa-trash',
			  editLayer: 'fa fa-pencil-square-o',
			};
			if (isDefined(scope.icons)) {
			  angular.extend(defaultIcons, scope.icons);
			  angular.extend(scope.icons, defaultIcons);
			} else {
			  scope.icons = defaultIcons;
			}
		  });

		  // Setting layer stack order.
		  attrs.order = (isDefined(attrs.order) && (attrs.order === 'normal' || attrs.order === 'reverse')) ? attrs.order : 'normal';
		  scope.order = attrs.order === 'normal';
		  scope.orderNumber = attrs.order === 'normal' ? -1 : 1;

		  scope.layers = layers;
		  controller.getMap().then(function(map) {
			leafletScope.$watch('layers.baselayers', function(newBaseLayers) {
			  var baselayersArray = {};
			  leafletData.getLayers().then(function(leafletLayers) {
				var key;
				for (key in newBaseLayers) {
				  var layer = newBaseLayers[key];
				  layer.icon = scope.icons[map.hasLayer(leafletLayers.baselayers[key]) ? 'radio' : 'unradio'];
				  baselayersArray[key] = layer;
				}

				scope.baselayersArray = baselayersArray;
			  });
			});

			leafletScope.$watch('layers.overlays', function(newOverlayLayers) {
			  var overlaysArray = [];
			  var groupVisibleCount = {};
			  leafletData.getLayers().then(function(leafletLayers) {
				var key;
				for (key in newOverlayLayers) {
				  var layer = newOverlayLayers[key];
				  layer.icon = scope.icons[(layer.visible ? 'check' : 'uncheck')];
				  overlaysArray.push(layer);
				  if (!isDefined(scope.layerProperties[layer.name])) {
					scope.layerProperties[layer.name] = {
					  opacity: isDefined(layer.layerOptions.opacity) ? layer.layerOptions.opacity * 100 : 100,
					  opacityControl: false,
					  showLegend: true,
					};
				  }

				  if (isDefined(layer.group)) {
					if (!isDefined(scope.groupProperties[layer.group])) {
					  scope.groupProperties[layer.group] = {
						visible: false,
					  };
					}

					groupVisibleCount[layer.group] = isDefined(groupVisibleCount[layer.group]) ? groupVisibleCount[layer.group] : {
					  count: 0,
					  visibles: 0,
					};
					groupVisibleCount[layer.group].count++;
					if (layer.visible) {
					  groupVisibleCount[layer.group].visibles++;
					}
				  }

				  if (isDefined(layer.index) && leafletLayers.overlays[key].setZIndex) {
					leafletLayers.overlays[key].setZIndex(newOverlayLayers[key].index);
				  }
				}

				for (key in groupVisibleCount) {
				  scope.groupProperties[key].visible = groupVisibleCount[key].visibles === groupVisibleCount[key].count;
				}

				scope.overlaysArray = overlaysArray;
			  });
			}, true);
		  });
		},
	  };
	}]);
	
	angular.module('ui-leaflet-styledlayercontrol').controller('ModalLayerCtrl', ["$scope", "$uibModalInstance", "styleType", "style", "layerIndex", function ($scope, $uibModalInstance, styleType, style, layerIndex) {
		$scope.styleType = styleType;
		$scope.layerIndex = layerIndex;
		
		$scope.styleSelected = $scope.styleType;
		
		$scope.icons = [{"value":"gear","label":"<i class=\"fa fa-gear\"></i> Gear"},{"value":"car","label":"<i class=\"fa fa-car\"></i> Car"},{"value":"heart","label":"<i class=\"fa fa-heart\"></i> Heart"},{"value":"camera","label":"<i class=\"fa fa-camera\"></i> Camera"}];
		
		//Asignamos los atributos del style
		if ($scope.styleSelected == "geoJSONShape"){
			$scope.color = style.color;
			$scope.opacity = style.opacity;
			$scope.fillColor = style.fillColor;
			$scope.fillOpacity = style.fillOpacity;
			$scope.weight = style.weight;
			
			$scope.showSimple = true;
		}else{
			$scope.selectedIcon = style.icon;
			$scope.markerColor = style.markerColor;
			$scope.iconColor = style.iconColor;
			
			$scope.showSimple = false;
		}
		
		$scope.changeStyle = function(){
			//Si el estilo elegido es simple mostramos las cosas de estilo de geoJSONShape y sino, del geoJSONAwesomeMarkerHermes
			if ($scope.styleSelected == "geoJSONShape"){
				$scope.showSimple = true;
			}else{
				$scope.showSimple = false;
			}
		};
		
		$scope.save = function() {
			//Asignamos los nuevos valores
			if ($scope.styleSelected == "geoJSONShape"){
				style.color = $scope.color;
				style.opacity = $scope.opacity;
				style.fillColor = $scope.fillColor;
				style.fillOpacity = $scope.fillOpacity;
				style.weight = $scope.weight;
			}else{
				style.icon = $scope.selectedIcon;
				style.markerColor = $scope.markerColor;
				style.iconColor = $scope.iconColor;
			}
			
			var response = {
				styleType: $scope.styleSelected,
				style: style,
				layerIndex: $scope.layerIndex
			};
			$uibModalInstance.close(response);
		};

		$scope.cancel = function() {
			$uibModalInstance.dismiss('cancel');
		};
	}]);

})();	

