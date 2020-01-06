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

export default function (ecModel) {
    ecModel.eachSeriesByType('radar', function (seriesModel) {
        var data = seriesModel.getData();
        var points = [];
        var coordSys = seriesModel.coordinateSystem;
        if (!coordSys) {
            return;
        }

        var axes = coordSys.getIndicatorAxes();

        // when axes === [] && data !== [], points[idx] will be undefined
        if (!axes.length) {
            return;
        }
        zrUtil.each(axes, function (axis, axisIndex) {
            data.each(data.mapDimension(axes[axisIndex].dim), function (val, dataIndex) {
                points[dataIndex] = points[dataIndex] || [];
                var point = coordSys.dataToPoint(val, axisIndex);
                points[dataIndex][axisIndex] = isValidPoint(point)
                    ? point : getValueMissingPoint(coordSys);
            });
        });

        // Close polygon
        data.each(function (idx) {
            // TODO
            // Is it appropriate to connect to the next data when some data is missing?
            // Or, should trade it like `connectNull` in line chart?
            var firstPoint = zrUtil.find(points[idx], function (point) {
                return isValidPoint(point);
            }) || getValueMissingPoint(coordSys);

            // Copy the first actual point to the end of the array
            points[idx].push(firstPoint.slice());
            data.setItemLayout(idx, points[idx]);
        });
    });
}

function isValidPoint(point) {
    return !isNaN(point[0]) && !isNaN(point[1]);
}

function getValueMissingPoint(coordSys) {
    // It is error-prone to input [NaN, NaN] into polygon, polygon.
    // (probably cause problem when refreshing or animating)
    return [coordSys.cx, coordSys.cy];
}