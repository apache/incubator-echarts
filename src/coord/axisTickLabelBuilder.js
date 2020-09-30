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
import * as textContain from 'zrender/src/contain/text';
import {makeInner} from '../util/model';
import {
    makeLabelFormatter,
    getOptionCategoryInterval,
    shouldShowAllLabels
} from './axisHelper';

var inner = makeInner();

/**
 * @param {module:echats/coord/Axis} axis
 * @return {Object} {
 *     labels: [{
 *         formattedLabel: string,
 *         rawLabel: string,
 *         tickValue: number
 *     }, ...],
 *     labelCategoryInterval: number
 * }
 */
export function createAxisLabels(axis) {
    // Only ordinal scale support tick interval
    return axis.type === 'category'
        ? makeCategoryLabels(axis)
        : makeRealNumberLabels(axis);
}

/**
 * @param {module:echats/coord/Axis} axis
 * @param {module:echarts/model/Model} tickModel For example, can be axisTick, splitLine, splitArea.
 * @return {Object} {
 *     ticks: Array.<number>
 *     tickCategoryInterval: number
 * }
 */
export function createAxisTicks(axis, tickModel) {
    // Only ordinal scale support tick interval
    return axis.type === 'category'
        ? makeCategoryTicks(axis, tickModel)
        : {ticks: axis.scale.getTicks()};
}

function makeCategoryLabels(axis) {
    var labelModel = axis.getLabelModel();
    var result = makeCategoryLabelsActually(axis, labelModel);

    return (!labelModel.get('show') || axis.scale.isBlank())
        ? {labels: [], labelCategoryInterval: result.labelCategoryInterval}
        : result;
}

function makeCategoryLabelsActually(axis, labelModel) {
    var labelsCache = getListCache(axis, 'labels');
    var optionLabelInterval = getOptionCategoryInterval(labelModel);
    var result = listCacheGet(labelsCache, optionLabelInterval);

    if (result) {
        return result;
    }

    var labels;
    var numericLabelInterval;

    if (zrUtil.isFunction(optionLabelInterval)) {
        labels = makeLabelsByCustomizedCategoryInterval(axis, optionLabelInterval);
    }
    else {
        numericLabelInterval = optionLabelInterval === 'auto'
            ? makeAutoCategoryInterval(axis) : optionLabelInterval;
        labels = makeLabelsByNumericCategoryInterval(axis, numericLabelInterval);
    }

    // Cache to avoid calling interval function repeatly.
    return listCacheSet(labelsCache, optionLabelInterval, {
        labels: labels, labelCategoryInterval: numericLabelInterval
    });
}

function makeCategoryTicks(axis, tickModel) {
    var ticksCache = getListCache(axis, 'ticks');
    var optionTickInterval = getOptionCategoryInterval(tickModel);
    var result = listCacheGet(ticksCache, optionTickInterval);

    if (result) {
        return result;
    }

    var ticks;
    var tickCategoryInterval;

    // Optimize for the case that large category data and no label displayed,
    // we should not return all ticks.
    if (!tickModel.get('show') || axis.scale.isBlank()) {
        ticks = [];
    }

    if (zrUtil.isFunction(optionTickInterval)) {
        ticks = makeLabelsByCustomizedCategoryInterval(axis, optionTickInterval, true);
    }
    // Always use label interval by default despite label show. Consider this
    // scenario, Use multiple grid with the xAxis sync, and only one xAxis shows
    // labels. `splitLine` and `axisTick` should be consistent in this case.
    else if (optionTickInterval === 'auto') {
        var labelsResult = makeCategoryLabelsActually(axis, axis.getLabelModel());
        tickCategoryInterval = labelsResult.labelCategoryInterval;
        ticks = zrUtil.map(labelsResult.labels, function (labelItem) {
            return labelItem.tickValue;
        });
    }
    else {
        tickCategoryInterval = optionTickInterval;
        ticks = makeLabelsByNumericCategoryInterval(axis, tickCategoryInterval, true);
    }

    // Cache to avoid calling interval function repeatly.
    return listCacheSet(ticksCache, optionTickInterval, {
        ticks: ticks, tickCategoryInterval: tickCategoryInterval, optionTickInterval: optionTickInterval
    });
}

function makeRealNumberLabels(axis) {
    var ticks = axis.scale.getTicks();
    var labelFormatter = makeLabelFormatter(axis);
    return {
        labels: zrUtil.map(ticks, function (tickValue, idx) {
            return {
                formattedLabel: labelFormatter(tickValue, idx),
                rawLabel: axis.scale.getLabel(tickValue),
                tickValue: tickValue
            };
        })
    };
}

// Large category data calculation is performence sensitive, and ticks and label
// probably be fetched by multiple times. So we cache the result.
// axis is created each time during a ec process, so we do not need to clear cache.
function getListCache(axis, prop) {
    // Because key can be funciton, and cache size always be small, we use array cache.
    return inner(axis)[prop] || (inner(axis)[prop] = []);
}

function listCacheGet(cache, key) {
    for (var i = 0; i < cache.length; i++) {
        if (cache[i].key === key) {
            return cache[i].value;
        }
    }
}

function listCacheSet(cache, key, value) {
    cache.push({key: key, value: value});
    return value;
}

function makeAutoCategoryInterval(axis) {
    var result = inner(axis).autoInterval;
    return result != null
        ? result
        : (inner(axis).autoInterval = axis.calculateCategoryInterval());
}

/**
 * Calculate interval for category axis ticks and labels.
 * To get precise result, at least one of `getRotate` and `isHorizontal`
 * should be implemented in axis.
 */
export function calculateCategoryInterval(axis) {
    var params = fetchAutoCategoryIntervalCalculationParams(axis);
    var labelFormatter = makeLabelFormatter(axis);
    var rotation = (params.axisRotate - params.labelRotate) / 180 * Math.PI;

    var ordinalScale = axis.scale;
    var ordinalExtent = ordinalScale.getExtent();
    // Providing this method is for optimization:
    // avoid generating a long array by `getTicks`
    // in large category data case.
    var tickCount = ordinalScale.count();

    if (ordinalExtent[1] - ordinalExtent[0] < 1) {
        return 0;
    }

    var step = 1;
    // Simple optimization. Empirical value: tick count should less than 40.
    if (tickCount > 40) {
        step = Math.max(1, Math.floor(tickCount / 40));
    }
    var tickValue = ordinalExtent[0];
    var unitSpan = axis.dataToCoord(tickValue + 1) - axis.dataToCoord(tickValue);
    var unitW = Math.abs(unitSpan * Math.cos(rotation));
    var unitH = Math.abs(unitSpan * Math.sin(rotation));

    var maxW = 0;
    var maxH = 0;

    // Caution: Performance sensitive for large category data.
    // Consider dataZoom, we should make appropriate step to avoid O(n) loop.
    for (; tickValue <= ordinalExtent[1]; tickValue += step) {
        var width = 0;
        var height = 0;

        // Not precise, do not consider align and vertical align
        // and each distance from axis line yet.
        var rect = textContain.getBoundingRect(
            labelFormatter(tickValue), params.font, 'center', 'top'
        );
        // Magic number
        width = rect.width * 1.3;
        height = rect.height * 1.3;

        // Min size, void long loop.
        maxW = Math.max(maxW, width, 7);
        maxH = Math.max(maxH, height, 7);
    }

    var dw = maxW / unitW;
    var dh = maxH / unitH;
    // 0/0 is NaN, 1/0 is Infinity.
    isNaN(dw) && (dw = Infinity);
    isNaN(dh) && (dh = Infinity);
    var interval = Math.max(0, Math.floor(Math.min(dw, dh)));

    var cache = inner(axis.model);
    var axisExtent = axis.getExtent();
    var lastAutoInterval = cache.lastAutoInterval;
    var lastTickCount = cache.lastTickCount;

    // Use cache to keep interval stable while moving zoom window,
    // otherwise the calculated interval might jitter when the zoom
    // window size is close to the interval-changing size.
    // For example, if all of the axis labels are `a, b, c, d, e, f, g`.
    // The jitter will cause that sometimes the displayed labels are
    // `a, d, g` (interval: 2) sometimes `a, c, e`(interval: 1).
    if (lastAutoInterval != null
        && lastTickCount != null
        && Math.abs(lastAutoInterval - interval) <= 1
        && Math.abs(lastTickCount - tickCount) <= 1
        // Always choose the bigger one, otherwise the critical
        // point is not the same when zooming in or zooming out.
        && lastAutoInterval > interval
        // If the axis change is caused by chart resize, the cache should not
        // be used. Otherwise some hiden labels might not be shown again.
        && cache.axisExtend0 === axisExtent[0]
        && cache.axisExtend1 === axisExtent[1]
    ) {
        interval = lastAutoInterval;
    }
    // Only update cache if cache not used, otherwise the
    // changing of interval is too insensitive.
    else {
        cache.lastTickCount = tickCount;
        cache.lastAutoInterval = interval;
        cache.axisExtend0 = axisExtent[0];
        cache.axisExtend1 = axisExtent[1];
    }

    return interval;
}

function fetchAutoCategoryIntervalCalculationParams(axis) {
    var labelModel = axis.getLabelModel();
    return {
        axisRotate: axis.getRotate
            ? axis.getRotate()
            : (axis.isHorizontal && !axis.isHorizontal())
            ? 90
            : 0,
        labelRotate: labelModel.get('rotate') || 0,
        font: labelModel.getFont()
    };
}

function makeLabelsByNumericCategoryInterval(axis, categoryInterval, onlyTick) {
    var labelFormatter = makeLabelFormatter(axis);
    var ordinalScale = axis.scale;
    var ordinalExtent = ordinalScale.getExtent();
    var labelModel = axis.getLabelModel();
    var result = [];

    // TODO: axisType: ordinalTime, pick the tick from each month/day/year/...

    var step = Math.max((categoryInterval || 0) + 1, 1);
    var startTick = ordinalExtent[0];
    var tickCount = ordinalScale.count();

    // Calculate start tick based on zero if possible to keep label consistent
    // while zooming and moving while interval > 0. Otherwise the selection
    // of displayable ticks and symbols probably keep changing.
    // 3 is empirical value.
    if (startTick !== 0 && step > 1 && tickCount / step > 2) {
        startTick = Math.round(Math.ceil(startTick / step) * step);
    }

    // (1) Only add min max label here but leave overlap checking
    // to render stage, which also ensure the returned list
    // suitable for splitLine and splitArea rendering.
    // (2) Scales except category always contain min max label so
    // do not need to perform this process.
    var showAllLabel = shouldShowAllLabels(axis);
    var includeMinLabel = labelModel.get('showMinLabel') || showAllLabel;
    var includeMaxLabel = labelModel.get('showMaxLabel') || showAllLabel;

    if (includeMinLabel && startTick !== ordinalExtent[0]) {
        addItem(ordinalExtent[0]);
    }

    // Optimize: avoid generating large array by `ordinalScale.getTicks()`.
    var tickValue = startTick;
    for (; tickValue <= ordinalExtent[1]; tickValue += step) {
        addItem(tickValue);
    }

    if (includeMaxLabel && tickValue - step !== ordinalExtent[1]) {
        addItem(ordinalExtent[1]);
    }

    function addItem(tVal) {
        result.push(onlyTick
            ? tVal
            : {
                formattedLabel: labelFormatter(tVal),
                rawLabel: ordinalScale.getLabel(tVal),
                tickValue: tVal
            }
        );
    }

    return result;
}

// When interval is function, the result `false` means ignore the tick.
// It is time consuming for large category data.
function makeLabelsByCustomizedCategoryInterval(axis, categoryInterval, onlyTick) {
    var ordinalScale = axis.scale;
    var labelFormatter = makeLabelFormatter(axis);
    var result = [];

    zrUtil.each(ordinalScale.getTicks(), function (tickValue) {
        var rawLabel = ordinalScale.getLabel(tickValue);
        if (categoryInterval(tickValue, rawLabel)) {
            result.push(onlyTick
                ? tickValue
                : {
                    formattedLabel: labelFormatter(tickValue),
                    rawLabel: rawLabel,
                    tickValue: tickValue
                }
            );
        }
    });

    return result;
}
