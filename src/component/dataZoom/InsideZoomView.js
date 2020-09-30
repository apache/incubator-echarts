/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/

import * as zrUtil from 'zrender/src/core/util';
import DataZoomView from './DataZoomView';
import sliderMove from '../helper/sliderMove';
import * as roams from './roams';

var bind = zrUtil.bind;

var InsideZoomView = DataZoomView.extend({

    type: 'dataZoom.inside',

    /**
     * @override
     */
    init: function (ecModel, api) {
        /**
         * 'throttle' is used in this.dispatchAction, so we save range
         * to avoid missing some 'pan' info.
         * @private
         * @type {Array.<number>}
         */
        this._range;
    },

    /**
     * @override
     */
    render: function (dataZoomModel, ecModel, api, payload) {
        InsideZoomView.superApply(this, 'render', arguments);

        // Hence the `throttle` util ensures to preserve command order,
        // here simply updating range all the time will not cause missing
        // any of the the roam change.
        this._range = dataZoomModel.getPercentRange();

        // Reset controllers.
        zrUtil.each(this.getTargetCoordInfo(), function (coordInfoList, coordSysName) {

            var allCoordIds = zrUtil.map(coordInfoList, function (coordInfo) {
                return roams.generateCoordId(coordInfo.model);
            });

            zrUtil.each(coordInfoList, function (coordInfo) {
                var coordModel = coordInfo.model;

                var getRange = {};
                zrUtil.each(['pan', 'zoom', 'scrollMove'], function (eventName) {
                    getRange[eventName] = bind(roamHandlers[eventName], this, coordInfo, coordSysName);
                }, this);

                roams.register(
                    api,
                    {
                        coordId: roams.generateCoordId(coordModel),
                        allCoordIds: allCoordIds,
                        containsPoint: function (e, x, y) {
                            return coordModel.coordinateSystem.containPoint([x, y]);
                        },
                        dataZoomId: dataZoomModel.id,
                        dataZoomModel: dataZoomModel,
                        getRange: getRange
                    }
                );
            }, this);

        }, this);
    },

    /**
     * @override
     */
    dispose: function () {
        roams.unregister(this.api, this.dataZoomModel.id);
        InsideZoomView.superApply(this, 'dispose', arguments);
        this._range = null;
    }

});

var roamHandlers = {

    /**
     * @this {module:echarts/component/dataZoom/InsideZoomView}
     */
    zoom: function (coordInfo, coordSysName, controller, e) {
        var lastRange = this._range;
        var range = lastRange.slice();

        // Calculate transform by the first axis.
        var axisModel = coordInfo.axisModels[0];
        if (!axisModel) {
            return;
        }

        var directionInfo = getDirectionInfo[coordSysName](
            null, [e.originX, e.originY], axisModel, controller, coordInfo
        );

        // diff=0 will freezing dataZoom
        var rangeDiff = (range[1] - range[0]) || 0.1;

        var percentPoint = (
            directionInfo.signal > 0
                ? (directionInfo.pixelStart + directionInfo.pixelLength - directionInfo.pixel)
                : (directionInfo.pixel - directionInfo.pixelStart)
            ) / directionInfo.pixelLength * (rangeDiff) + range[0];

        var scale = Math.max(1 / e.scale, 0);
        range[0] = (range[0] - percentPoint) * scale + percentPoint;
        range[1] = (range[1] - percentPoint) * scale + percentPoint;

        // Restrict range.
        var minMaxSpan = this.dataZoomModel.findRepresentativeAxisProxy().getMinMaxSpan();

        sliderMove(0, range, [0, 100], 0, minMaxSpan.minSpan, minMaxSpan.maxSpan);

        this._range = range;

        if (lastRange[0] !== range[0] || lastRange[1] !== range[1]) {
            return range;
        }
    },

    /**
     * @this {module:echarts/component/dataZoom/InsideZoomView}
     */
    pan: makeMover(function (range, axisModel, coordInfo, coordSysName, controller, e) {
        var directionInfo = getDirectionInfo[coordSysName](
            [e.oldX, e.oldY], [e.newX, e.newY], axisModel, controller, coordInfo
        );

        return directionInfo.signal
            * (range[1] - range[0])
            * directionInfo.pixel / directionInfo.pixelLength;
    }),

    /**
     * @this {module:echarts/component/dataZoom/InsideZoomView}
     */
    scrollMove: makeMover(function (range, axisModel, coordInfo, coordSysName, controller, e) {
        var directionInfo = getDirectionInfo[coordSysName](
            [0, 0], [e.scrollDelta, e.scrollDelta], axisModel, controller, coordInfo
        );
        return directionInfo.signal * (range[1] - range[0]) * e.scrollDelta;
    })
};

function makeMover(getPercentDelta) {
    return function (coordInfo, coordSysName, controller, e) {
        var lastRange = this._range;
        var range = lastRange.slice();

        // Calculate transform by the first axis.
        var axisModel = coordInfo.axisModels[0];
        if (!axisModel) {
            return;
        }

        var percentDelta = getPercentDelta(
            range, axisModel, coordInfo, coordSysName, controller, e
        );

        sliderMove(percentDelta, range, [0, 100], 'all');

        this._range = range;

        if (lastRange[0] !== range[0] || lastRange[1] !== range[1]) {
            return range;
        }
    };
}

var getDirectionInfo = {

    grid: function (oldPoint, newPoint, axisModel, controller, coordInfo) {
        var axis = axisModel.axis;
        var ret = {};
        var rect = coordInfo.model.coordinateSystem.getRect();
        oldPoint = oldPoint || [0, 0];

        if (axis.dim === 'x') {
            ret.pixel = newPoint[0] - oldPoint[0];
            ret.pixelLength = rect.width;
            ret.pixelStart = rect.x;
            ret.signal = axis.inverse ? 1 : -1;
        }
        else { // axis.dim === 'y'
            ret.pixel = newPoint[1] - oldPoint[1];
            ret.pixelLength = rect.height;
            ret.pixelStart = rect.y;
            ret.signal = axis.inverse ? -1 : 1;
        }

        return ret;
    },

    polar: function (oldPoint, newPoint, axisModel, controller, coordInfo) {
        var axis = axisModel.axis;
        var ret = {};
        var polar = coordInfo.model.coordinateSystem;
        var radiusExtent = polar.getRadiusAxis().getExtent();
        var angleExtent = polar.getAngleAxis().getExtent();

        oldPoint = oldPoint ? polar.pointToCoord(oldPoint) : [0, 0];
        newPoint = polar.pointToCoord(newPoint);

        if (axisModel.mainType === 'radiusAxis') {
            ret.pixel = newPoint[0] - oldPoint[0];
            // ret.pixelLength = Math.abs(radiusExtent[1] - radiusExtent[0]);
            // ret.pixelStart = Math.min(radiusExtent[0], radiusExtent[1]);
            ret.pixelLength = radiusExtent[1] - radiusExtent[0];
            ret.pixelStart = radiusExtent[0];
            ret.signal = axis.inverse ? 1 : -1;
        }
        else { // 'angleAxis'
            ret.pixel = newPoint[1] - oldPoint[1];
            // ret.pixelLength = Math.abs(angleExtent[1] - angleExtent[0]);
            // ret.pixelStart = Math.min(angleExtent[0], angleExtent[1]);
            ret.pixelLength = angleExtent[1] - angleExtent[0];
            ret.pixelStart = angleExtent[0];
            ret.signal = axis.inverse ? -1 : 1;
        }

        return ret;
    },

    singleAxis: function (oldPoint, newPoint, axisModel, controller, coordInfo) {
        var axis = axisModel.axis;
        var rect = coordInfo.model.coordinateSystem.getRect();
        var ret = {};

        oldPoint = oldPoint || [0, 0];

        if (axis.orient === 'horizontal') {
            ret.pixel = newPoint[0] - oldPoint[0];
            ret.pixelLength = rect.width;
            ret.pixelStart = rect.x;
            ret.signal = axis.inverse ? 1 : -1;
        }
        else { // 'vertical'
            ret.pixel = newPoint[1] - oldPoint[1];
            ret.pixelLength = rect.height;
            ret.pixelStart = rect.y;
            ret.signal = axis.inverse ? -1 : 1;
        }

        return ret;
    }
};

export default InsideZoomView;
