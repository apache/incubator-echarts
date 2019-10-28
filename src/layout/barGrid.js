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

import * as zrUtil from 'zrender/src/core/util';
import {parsePercent} from '../util/number';
import {isDimensionStacked} from '../data/helper/dataStackHelper';
import createRenderPlanner from '../chart/helper/createRenderPlanner';

var STACK_PREFIX = '__ec_stack_';
var LARGE_BAR_MIN_WIDTH = 0.5;

var LargeArr = typeof Float32Array !== 'undefined' ? Float32Array : Array;

function getSeriesStackId(seriesModel) {
    return seriesModel.get('stack') || STACK_PREFIX + seriesModel.seriesIndex;
}

function getAxisKey(axis) {
    return axis.dim + axis.index;
}

/**
 * @param {Object} opt
 * @param {module:echarts/coord/Axis} opt.axis Only support category axis currently.
 * @param {number} opt.count Positive interger.
 * @param {number} [opt.barWidth]
 * @param {number} [opt.barMaxWidth]
 * @param {number} [opt.barGap]
 * @param {number} [opt.barCategoryGap]
 * @return {Object} {width, offset, offsetCenter} If axis.type is not 'category', return undefined.
 */
export function getLayoutOnAxis(opt) {
    var params = [];
    var baseAxis = opt.axis;
    var axisKey = 'axis0';

    if (baseAxis.type !== 'category') {
        return;
    }
    var bandWidth = baseAxis.getBandWidth();

    for (var i = 0; i < opt.count || 0; i++) {
        params.push(zrUtil.defaults({
            bandWidth: bandWidth,
            axisKey: axisKey,
            stackId: STACK_PREFIX + i
        }, opt));
    }
    var widthAndOffsets = doCalBarWidthAndOffset(params);

    var result = [];
    for (var i = 0; i < opt.count; i++) {
        var item = widthAndOffsets[axisKey][STACK_PREFIX + i];
        item.offsetCenter = item.offset + item.width / 2;
        result.push(item);
    }

    return result;
}

export function prepareLayoutBarSeries(seriesType, ecModel) {
    var seriesModels = [];
    ecModel.eachSeriesByType(seriesType, function (seriesModel) {
        // Check series coordinate, do layout for cartesian2d only
        if (isOnCartesian(seriesModel) && !isInLargeMode(seriesModel)) {
            seriesModels.push(seriesModel);
        }
    });
    return seriesModels;
}


/**
 * Map from axis.index to min gap of two adjacent values.
 * This works for time axes, value axes, and log axes.
 * For a single time axis, return value is in the form like
 * [[1000000]].
 * The value of 1000000 is in milliseconds.
 */
function getValueAxesMinGaps(barSeries) {
    /**
     * Map from axis.index to values.
     * For a single time axis, axisValues is in the form like
     * [[1495555200000, 1495641600000, 1495728000000]].
     * Items in axisValues[x], e.g. 1495555200000, are time values of all
     * series.
     */
    var axisValues = [];
    zrUtil.each(barSeries, function (seriesModel) {
        var cartesian = seriesModel.coordinateSystem;
        var baseAxis = cartesian.getBaseAxis();
        if (baseAxis.type !== 'time' && baseAxis.type !== 'value') {
            return;
        }

        var data = seriesModel.getData();
        var axisId = baseAxis.index;
        for (var i = 0, cnt = data.count(); i < cnt; ++i) {
            var value = data.get(baseAxis.dim, i);
            if (!axisValues[axisId]) {
                // No previous data for the axis
                axisValues[axisId] = [value];
            }
            else {
                // No value in previous series
                axisValues[axisId].push(value);
            }
            // Ignore duplicated time values in the same axis
        }
    });

    var axisMinGaps = [];
    for (var i = 0; i < axisValues.length; ++i) {
        if (axisValues[i]) {
            // Sort axis values into ascending order to calculate gaps
            axisValues[i].sort(function (a, b) {
                return a - b;
            });

            var min = Number.MAX_VALUE;
            for (var j = 1; j < axisValues[i].length; ++j) {
                // Ignore 0 delta because they are of the same axis value
                var delta = axisValues[i][j] - axisValues[i][j - 1];
                delta = delta === 0 ? Number.MAX_VALUE : delta;
                min = Math.min(min, delta);
            }
            // Set to null if only have one data
            axisMinGaps[i] = min === Number.MAX_VALUE ? null : min;
        }
    }
    return axisMinGaps;
}

export function makeColumnLayout(barSeries) {
    var axisMinGaps = getValueAxesMinGaps(barSeries);

    var seriesInfoList = [];
    zrUtil.each(barSeries, function (seriesModel) {
        var cartesian = seriesModel.coordinateSystem;
        var baseAxis = cartesian.getBaseAxis();
        var axisExtent = baseAxis.getExtent();

        var bandWidth;
        if (baseAxis.type === 'category') {
            bandWidth = baseAxis.getBandWidth();
        }
        else if (baseAxis.type === 'value' || baseAxis.type === 'time') {
            var minGap = axisMinGaps[baseAxis.index];
            var extentSpan = Math.abs(axisExtent[1] - axisExtent[0]);
            var scale = baseAxis.scale.getExtent();
            var scaleSpan = Math.abs(scale[1] - scale[0]);
            bandWidth = minGap
                ? extentSpan / scaleSpan * minGap
                : extentSpan; // When there is only one data value
        }
        else {
            var data = seriesModel.getData();
            bandWidth = Math.abs(axisExtent[1] - axisExtent[0]) / data.count();
        }

        var barWidth = parsePercent(
            seriesModel.get('barWidth'), bandWidth
        );
        var barMaxWidth = parsePercent(
            seriesModel.get('barMaxWidth'), bandWidth
        );
        var barGap = seriesModel.get('barGap');
        var barCategoryGap = seriesModel.get('barCategoryGap');

        seriesInfoList.push({
            bandWidth: bandWidth,
            barWidth: barWidth,
            barMaxWidth: barMaxWidth,
            barGap: barGap,
            barCategoryGap: barCategoryGap,
            axisKey: getAxisKey(baseAxis),
            stackId: getSeriesStackId(seriesModel)
        });
    });

    return doCalBarWidthAndOffset(seriesInfoList);
}

function doCalBarWidthAndOffset(seriesInfoList) {
    // Columns info on each category axis. Key is cartesian name
    var columnsMap = {};

    zrUtil.each(seriesInfoList, function (seriesInfo, idx) {
        var axisKey = seriesInfo.axisKey;
        var bandWidth = seriesInfo.bandWidth;
        var columnsOnAxis = columnsMap[axisKey] || {
            bandWidth: bandWidth,
            remainedWidth: bandWidth,
            autoWidthCount: 0,
            categoryGap: '20%',
            gap: '30%',
            stacks: {}
        };
        var stacks = columnsOnAxis.stacks;
        columnsMap[axisKey] = columnsOnAxis;

        var stackId = seriesInfo.stackId;

        if (!stacks[stackId]) {
            columnsOnAxis.autoWidthCount++;
        }
        stacks[stackId] = stacks[stackId] || {
            width: 0,
            maxWidth: 0
        };

        // Caution: In a single coordinate system, these barGrid attributes
        // will be shared by series. Consider that they have default values,
        // only the attributes set on the last series will work.
        // Do not change this fact unless there will be a break change.

        // TODO
        var barWidth = seriesInfo.barWidth;
        if (barWidth && !stacks[stackId].width) {
            // See #6312, do not restrict width.
            stacks[stackId].width = barWidth;
            barWidth = Math.min(columnsOnAxis.remainedWidth, barWidth);
            columnsOnAxis.remainedWidth -= barWidth;
        }

        var barMaxWidth = seriesInfo.barMaxWidth;
        barMaxWidth && (stacks[stackId].maxWidth = barMaxWidth);
        var barGap = seriesInfo.barGap;
        (barGap != null) && (columnsOnAxis.gap = barGap);
        var barCategoryGap = seriesInfo.barCategoryGap;
        (barCategoryGap != null) && (columnsOnAxis.categoryGap = barCategoryGap);
    });

    var result = {};

    zrUtil.each(columnsMap, function (columnsOnAxis, coordSysName) {

        result[coordSysName] = {};

        var stacks = columnsOnAxis.stacks;
        var bandWidth = columnsOnAxis.bandWidth;
        var categoryGap = parsePercent(columnsOnAxis.categoryGap, bandWidth);
        var barGapPercent = parsePercent(columnsOnAxis.gap, 1);

        var remainedWidth = columnsOnAxis.remainedWidth;
        var autoWidthCount = columnsOnAxis.autoWidthCount;
        var autoWidth = (remainedWidth - categoryGap)
            / (autoWidthCount + (autoWidthCount - 1) * barGapPercent);
        autoWidth = Math.max(autoWidth, 0);

        // Find if any auto calculated bar exceeded maxBarWidth
        zrUtil.each(stacks, function (column, stack) {
            var maxWidth = column.maxWidth;
            if (maxWidth && maxWidth < autoWidth) {
                maxWidth = Math.min(maxWidth, remainedWidth);
                if (column.width) {
                    maxWidth = Math.min(maxWidth, column.width);
                }
                remainedWidth -= maxWidth;
                column.width = maxWidth;
                autoWidthCount--;
            }
        });

        // Recalculate width again
        autoWidth = (remainedWidth - categoryGap)
            / (autoWidthCount + (autoWidthCount - 1) * barGapPercent);
        autoWidth = Math.max(autoWidth, 0);

        var widthSum = 0;
        var lastColumn;
        zrUtil.each(stacks, function (column, idx) {
            if (!column.width) {
                column.width = autoWidth;
            }
            lastColumn = column;
            widthSum += column.width * (1 + barGapPercent);
        });
        if (lastColumn) {
            widthSum -= lastColumn.width * barGapPercent;
        }

        var offset = -widthSum / 2;
        zrUtil.each(stacks, function (column, stackId) {
            result[coordSysName][stackId] = result[coordSysName][stackId] || {
                bandWidth: bandWidth,
                offset: offset,
                width: column.width
            };

            offset += column.width * (1 + barGapPercent);
        });
    });

    return result;
}

/**
 * @param {Object} barWidthAndOffset The result of makeColumnLayout
 * @param {module:echarts/coord/Axis} axis
 * @param {module:echarts/model/Series} [seriesModel] If not provided, return all.
 * @return {Object} {stackId: {offset, width}} or {offset, width} if seriesModel provided.
 */
export function retrieveColumnLayout(barWidthAndOffset, axis, seriesModel) {
    if (barWidthAndOffset && axis) {
        var result = barWidthAndOffset[getAxisKey(axis)];
        if (result != null && seriesModel != null) {
            result = result[getSeriesStackId(seriesModel)];
        }
        return result;
    }
}

/**
 * @param {string} seriesType
 * @param {module:echarts/model/Global} ecModel
 */
export function layout(seriesType, ecModel) {

    var seriesModels = prepareLayoutBarSeries(seriesType, ecModel);
    var barWidthAndOffset = makeColumnLayout(seriesModels);

    var lastStackCoords = {};
    var lastStackCoordsOrigin = {};

    zrUtil.each(seriesModels, function (seriesModel) {

        var data = seriesModel.getData();
        var cartesian = seriesModel.coordinateSystem;
        var baseAxis = cartesian.getBaseAxis();

        var stackId = getSeriesStackId(seriesModel);
        var columnLayoutInfo = barWidthAndOffset[getAxisKey(baseAxis)][stackId];
        var columnOffset = columnLayoutInfo.offset;
        var columnWidth = columnLayoutInfo.width;
        var valueAxis = cartesian.getOtherAxis(baseAxis);

        var barMinHeight = seriesModel.get('barMinHeight') || 0;

        lastStackCoords[stackId] = lastStackCoords[stackId] || [];
        lastStackCoordsOrigin[stackId] = lastStackCoordsOrigin[stackId] || []; // Fix #4243

        data.setLayout({
            bandWidth: columnLayoutInfo.bandWidth,
            offset: columnOffset,
            size: columnWidth
        });

        var valueDim = data.mapDimension(valueAxis.dim);
        var baseDim = data.mapDimension(baseAxis.dim);
        var stacked = isDimensionStacked(data, valueDim /*, baseDim*/);
        var isValueAxisH = valueAxis.isHorizontal();

        var valueAxisStart = getValueAxisStart(baseAxis, valueAxis, stacked);

        for (var idx = 0, len = data.count(); idx < len; idx++) {
            var value = data.get(valueDim, idx);
            var baseValue = data.get(baseDim, idx);

            // If dataZoom in filteMode: 'empty', the baseValue can be set as NaN in "axisProxy".
            if (isNaN(value) || isNaN(baseValue)) {
                continue;
            }

            var sign = value >= 0 ? 'p' : 'n';
            var baseCoord = valueAxisStart;

            // Because of the barMinHeight, we can not use the value in
            // stackResultDimension directly.
            if (stacked) {
                // Only ordinal axis can be stacked.
                if (!lastStackCoords[stackId][baseValue]) {
                    lastStackCoords[stackId][baseValue] = {
                        p: valueAxisStart, // Positive stack
                        n: valueAxisStart  // Negative stack
                    };
                }
                // Should also consider #4243
                baseCoord = lastStackCoords[stackId][baseValue][sign];
            }

            var x;
            var y;
            var width;
            var height;

            if (isValueAxisH) {
                var coord = cartesian.dataToPoint([value, baseValue]);
                x = baseCoord;
                y = coord[1] + columnOffset;
                width = coord[0] - valueAxisStart;
                height = columnWidth;

                if (Math.abs(width) < barMinHeight) {
                    width = (width < 0 ? -1 : 1) * barMinHeight;
                }
                stacked && (lastStackCoords[stackId][baseValue][sign] += width);
            }
            else {
                var coord = cartesian.dataToPoint([baseValue, value]);
                x = coord[0] + columnOffset;
                y = baseCoord;
                width = columnWidth;
                height = coord[1] - valueAxisStart;

                if (Math.abs(height) < barMinHeight) {
                    // Include zero to has a positive bar
                    height = (height <= 0 ? -1 : 1) * barMinHeight;
                }
                stacked && (lastStackCoords[stackId][baseValue][sign] += height);
            }
            data.setItemLayout(idx, {
                x: x,
                y: y,
                width: width,
                height: height
            });
        }

    }, this);
}

// TODO: Do not support stack in large mode yet.
export var largeLayout = {

    seriesType: 'bar',

    plan: createRenderPlanner(),

    reset: function (seriesModel) {
        if (!isOnCartesian(seriesModel) || !isInLargeMode(seriesModel)) {
            return;
        }

        var data = seriesModel.getData();
        var cartesian = seriesModel.coordinateSystem;
        var baseAxis = cartesian.getBaseAxis();
        var valueAxis = cartesian.getOtherAxis(baseAxis);
        var valueDim = data.mapDimension(valueAxis.dim);
        var baseDim = data.mapDimension(baseAxis.dim);
        var valueAxisHorizontal = valueAxis.isHorizontal();
        var valueDimIdx = valueAxisHorizontal ? 0 : 1;

        var barWidth = retrieveColumnLayout(
            makeColumnLayout([seriesModel]), baseAxis, seriesModel
        ).width;
        if (!(barWidth > LARGE_BAR_MIN_WIDTH)) { // jshint ignore:line
            barWidth = LARGE_BAR_MIN_WIDTH;
        }

        return {progress: progress};

        function progress(params, data) {
            var count = params.count;
            var largePoints = new LargeArr(count * 2);
            var largeDataIndices = new LargeArr(count);
            var dataIndex;
            var coord = [];
            var valuePair = [];
            var pointsOffset = 0;
            var idxOffset = 0;

            while ((dataIndex = params.next()) != null) {
                valuePair[valueDimIdx] = data.get(valueDim, dataIndex);
                valuePair[1 - valueDimIdx] = data.get(baseDim, dataIndex);

                coord = cartesian.dataToPoint(valuePair, null, coord);
                // Data index might not be in order, depends on `progressiveChunkMode`.
                largePoints[pointsOffset++] = coord[0];
                largePoints[pointsOffset++] = coord[1];
                largeDataIndices[idxOffset++] = dataIndex;
            }

            data.setLayout({
                largePoints: largePoints,
                largeDataIndices: largeDataIndices,
                barWidth: barWidth,
                valueAxisStart: getValueAxisStart(baseAxis, valueAxis, false),
                valueAxisHorizontal: valueAxisHorizontal
            });
        }
    }
};

function isOnCartesian(seriesModel) {
    return seriesModel.coordinateSystem && seriesModel.coordinateSystem.type === 'cartesian2d';
}

function isInLargeMode(seriesModel) {
    return seriesModel.pipelineContext && seriesModel.pipelineContext.large;
}

// See cases in `test/bar-start.html` and `#7412`, `#8747`.
function getValueAxisStart(baseAxis, valueAxis, stacked) {
    return valueAxis.toGlobalCoord(valueAxis.dataToCoord(valueAxis.type === 'log' ? 1 : 0));
}
