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

/* global Float32Array */

import {subPixelOptimize} from '../../util/graphic';
import createRenderPlanner from '../helper/createRenderPlanner';
import {parsePercent} from '../../util/number';
import {retrieve2} from 'zrender/src/core/util';

var LargeArr = typeof Float32Array !== 'undefined' ? Float32Array : Array;

export default {

    seriesType: 'candlestick',

    plan: createRenderPlanner(),

    reset: function (seriesModel) {

        var coordSys = seriesModel.coordinateSystem;
        var data = seriesModel.getData();
        var candleWidth = calculateCandleWidth(seriesModel, data);
        var cDimIdx = 0;
        var vDimIdx = 1;
        var coordDims = ['x', 'y'];
        var cDim = data.mapDimension(coordDims[cDimIdx]);
        var vDims = data.mapDimension(coordDims[vDimIdx], true);
        var openDim = vDims[0];
        var closeDim = vDims[1];
        var lowestDim = vDims[2];
        var highestDim = vDims[3];

        data.setLayout({
            candleWidth: candleWidth,
            // The value is experimented visually.
            isSimpleBox: candleWidth <= 1.3
        });

        if (cDim == null || vDims.length < 4) {
            return;
        }

        return {
            progress: seriesModel.pipelineContext.large
                ? largeProgress : normalProgress
        };

        function normalProgress(params, data) {
            var dataIndex;
            while ((dataIndex = params.next()) != null) {

                var axisDimVal = data.get(cDim, dataIndex);
                var openVal = data.get(openDim, dataIndex);
                var closeVal = data.get(closeDim, dataIndex);
                var lowestVal = data.get(lowestDim, dataIndex);
                var highestVal = data.get(highestDim, dataIndex);

                var ocLow = Math.min(openVal, closeVal);
                var ocHigh = Math.max(openVal, closeVal);

                var ocLowPoint = getPoint(ocLow, axisDimVal);
                var ocHighPoint = getPoint(ocHigh, axisDimVal);
                var lowestPoint = getPoint(lowestVal, axisDimVal);
                var highestPoint = getPoint(highestVal, axisDimVal);

                var ends = [];
                addBodyEnd(ends, ocHighPoint, 0);
                addBodyEnd(ends, ocLowPoint, 1);

                ends.push(
                    subPixelOptimizePoint(highestPoint),
                    subPixelOptimizePoint(ocHighPoint),
                    subPixelOptimizePoint(lowestPoint),
                    subPixelOptimizePoint(ocLowPoint)
                );

                data.setItemLayout(dataIndex, {
                    sign: getSign(data, dataIndex, openVal, closeVal, closeDim, highestVal, lowestVal),
                    initBaseline: openVal > closeVal
                        ? ocHighPoint[vDimIdx] : ocLowPoint[vDimIdx], // open point.
                    ends: ends,
                    brushRect: makeBrushRect(lowestVal, highestVal, axisDimVal)
                });
            }

            function getPoint(val, axisDimVal) {
                var p = [];
                p[cDimIdx] = axisDimVal;
                p[vDimIdx] = val;
                return (isNaN(axisDimVal) || isNaN(val))
                    ? [NaN, NaN]
                    : coordSys.dataToPoint(p);
            }

            function addBodyEnd(ends, point, start) {
                var point1 = point.slice();
                var point2 = point.slice();

                point1[cDimIdx] = subPixelOptimize(
                    point1[cDimIdx] + candleWidth / 2, 1, false
                );
                point2[cDimIdx] = subPixelOptimize(
                    point2[cDimIdx] - candleWidth / 2, 1, true
                );

                start
                    ? ends.push(point1, point2)
                    : ends.push(point2, point1);
            }

            function makeBrushRect(lowestVal, highestVal, axisDimVal) {
                var pmin = getPoint(lowestVal, axisDimVal);
                var pmax = getPoint(highestVal, axisDimVal);

                pmin[cDimIdx] -= candleWidth / 2;
                pmax[cDimIdx] -= candleWidth / 2;

                return {
                    x: pmin[0],
                    y: pmin[1],
                    width: vDimIdx ? candleWidth : pmax[0] - pmin[0],
                    height: vDimIdx ? pmax[1] - pmin[1] : candleWidth
                };
            }

            function subPixelOptimizePoint(point) {
                point[cDimIdx] = subPixelOptimize(point[cDimIdx], 1);
                return point;
            }
        }

        function largeProgress(params, data) {
            // Structure: [sign, x, yhigh, ylow, sign, x, yhigh, ylow, ...]
            var points = new LargeArr(params.count * 4);
            var offset = 0;
            var point;
            var tmpIn = [];
            var tmpOut = [];
            var dataIndex;

            while ((dataIndex = params.next()) != null) {
                var axisDimVal = data.get(cDim, dataIndex);
                var openVal = data.get(openDim, dataIndex);
                var closeVal = data.get(closeDim, dataIndex);
                var lowestVal = data.get(lowestDim, dataIndex);
                var highestVal = data.get(highestDim, dataIndex);

                if (isNaN(axisDimVal) || isNaN(lowestVal) || isNaN(highestVal)) {
                    points[offset++] = NaN;
                    offset += 3;
                    continue;
                }

                points[offset++] = getSign(data, dataIndex, openVal, closeVal, closeDim, highestVal, lowestVal);

                tmpIn[cDimIdx] = axisDimVal;

                tmpIn[vDimIdx] = lowestVal;
                point = coordSys.dataToPoint(tmpIn, null, tmpOut);
                points[offset++] = point ? point[0] : NaN;
                points[offset++] = point ? point[1] : NaN;
                tmpIn[vDimIdx] = highestVal;
                point = coordSys.dataToPoint(tmpIn, null, tmpOut);
                points[offset++] = point ? point[1] : NaN;
            }

            data.setLayout('largePoints', points);
        }
    }
};

function getSign(data, dataIndex, openVal, closeVal, closeDim, highestVal, lowestVal) {
    var sign;
    if (openVal > closeVal) {
        sign = -1;
    }
    else if (openVal < closeVal) {
        sign = 1;
    }
    else if (openVal
            && closeVal
            && highestVal
            && lowestVal
            && openVal === closeVal
            && highestVal !== lowestVal) {  // scenario of doji
        sign = 0;
    }
    else {  // scenario of limit at the opening
        sign = dataIndex > 0
            // If close === open, compare with close of last record
            ? (data.get(closeDim, dataIndex - 1) <= closeVal ? 1 : -1)
            // No record of previous, set to be positive
            : 1;
    }

    return sign;
}

function calculateCandleWidth(seriesModel, data) {
    var baseAxis = seriesModel.getBaseAxis();
    var extent;

    var bandWidth = baseAxis.type === 'category'
        ? baseAxis.getBandWidth()
        : (
            extent = baseAxis.getExtent(),
            Math.abs(extent[1] - extent[0]) / data.count()
        );

    var barMaxWidth = parsePercent(
        retrieve2(seriesModel.get('barMaxWidth'), bandWidth),
        bandWidth
    );
    var barMinWidth = parsePercent(
        retrieve2(seriesModel.get('barMinWidth'), 1),
        bandWidth
    );
    var barWidth = seriesModel.get('barWidth');

    return barWidth != null
        ? parsePercent(barWidth, bandWidth)
        // Put max outer to ensure bar visible in spite of overlap.
        : Math.max(Math.min(bandWidth / 2, barMaxWidth), barMinWidth);
}
