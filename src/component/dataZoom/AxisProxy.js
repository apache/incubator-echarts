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
import * as numberUtil from '../../util/number';
import * as helper from './helper';
import sliderMove from '../helper/sliderMove';

var each = zrUtil.each;
var asc = numberUtil.asc;

/**
 * Operate single axis.
 * One axis can only operated by one axis operator.
 * Different dataZoomModels may be defined to operate the same axis.
 * (i.e. 'inside' data zoom and 'slider' data zoom components)
 * So dataZoomModels share one axisProxy in that case.
 *
 * @class
 */
var AxisProxy = function (dimName, axisIndex, dataZoomModel, ecModel) {

    /**
     * @private
     * @type {string}
     */
    this._dimName = dimName;

    /**
     * @private
     */
    this._axisIndex = axisIndex;

    /**
     * @private
     * @type {Array.<number>}
     */
    this._valueWindow;

    /**
     * @private
     * @type {Array.<number>}
     */
    this._percentWindow;

    /**
     * @private
     * @type {Array.<number>}
     */
    this._dataExtent;

    /**
     * {minSpan, maxSpan, minValueSpan, maxValueSpan}
     * @private
     * @type {Object}
     */
    this._minMaxSpan;

    /**
     * @readOnly
     * @type {module: echarts/model/Global}
     */
    this.ecModel = ecModel;

    /**
     * @private
     * @type {module: echarts/component/dataZoom/DataZoomModel}
     */
    this._dataZoomModel = dataZoomModel;

    // /**
    //  * @readOnly
    //  * @private
    //  */
    // this.hasSeriesStacked;
};

AxisProxy.prototype = {

    constructor: AxisProxy,

    /**
     * Whether the axisProxy is hosted by dataZoomModel.
     *
     * @public
     * @param {module: echarts/component/dataZoom/DataZoomModel} dataZoomModel
     * @return {boolean}
     */
    hostedBy: function (dataZoomModel) {
        return this._dataZoomModel === dataZoomModel;
    },

    /**
     * @return {Array.<number>} Value can only be NaN or finite value.
     */
    getDataValueWindow: function () {
        return this._valueWindow.slice();
    },

    /**
     * @return {Array.<number>}
     */
    getDataPercentWindow: function () {
        return this._percentWindow.slice();
    },

    /**
     * @public
     * @param {number} axisIndex
     * @return {Array} seriesModels
     */
    getTargetSeriesModels: function () {
        var seriesModels = [];
        var ecModel = this.ecModel;

        ecModel.eachSeries(function (seriesModel) {
            if (helper.isCoordSupported(seriesModel.get('coordinateSystem'))) {
                var dimName = this._dimName;
                var axisModel = ecModel.queryComponents({
                    mainType: dimName + 'Axis',
                    index: seriesModel.get(dimName + 'AxisIndex'),
                    id: seriesModel.get(dimName + 'AxisId')
                })[0];
                if (this._axisIndex === (axisModel && axisModel.componentIndex)) {
                    seriesModels.push(seriesModel);
                }
            }
        }, this);

        return seriesModels;
    },

    getAxisModel: function () {
        return this.ecModel.getComponent(this._dimName + 'Axis', this._axisIndex);
    },

    getOtherAxisModel: function () {
        var axisDim = this._dimName;
        var ecModel = this.ecModel;
        var axisModel = this.getAxisModel();
        var isCartesian = axisDim === 'x' || axisDim === 'y';
        var otherAxisDim;
        var coordSysIndexName;
        if (isCartesian) {
            coordSysIndexName = 'gridIndex';
            otherAxisDim = axisDim === 'x' ? 'y' : 'x';
        }
        else {
            coordSysIndexName = 'polarIndex';
            otherAxisDim = axisDim === 'angle' ? 'radius' : 'angle';
        }
        var foundOtherAxisModel;
        ecModel.eachComponent(otherAxisDim + 'Axis', function (otherAxisModel) {
            if ((otherAxisModel.get(coordSysIndexName) || 0)
                === (axisModel.get(coordSysIndexName) || 0)
            ) {
                foundOtherAxisModel = otherAxisModel;
            }
        });
        return foundOtherAxisModel;
    },

    getMinMaxSpan: function () {
        return zrUtil.clone(this._minMaxSpan);
    },

    /**
     * Only calculate by given range and this._dataExtent, do not change anything.
     *
     * @param {Object} opt
     * @param {number} [opt.start]
     * @param {number} [opt.end]
     * @param {number} [opt.startValue]
     * @param {number} [opt.endValue]
     */
    calculateDataWindow: function (opt) {
        var dataExtent = this._dataExtent;
        var axisModel = this.getAxisModel();
        var scale = axisModel.axis.scale;
        var rangePropMode = this._dataZoomModel.getRangePropMode();
        var percentExtent = [0, 100];
        var percentWindow = [];
        var valueWindow = [];
        var hasPropModeValue;

        each(['start', 'end'], function (prop, idx) {
            var boundPercent = opt[prop];
            var boundValue = opt[prop + 'Value'];

            // Notice: dataZoom is based either on `percentProp` ('start', 'end') or
            // on `valueProp` ('startValue', 'endValue'). (They are based on the data extent
            // but not min/max of axis, which will be calculated by data window then).
            // The former one is suitable for cases that a dataZoom component controls multiple
            // axes with different unit or extent, and the latter one is suitable for accurate
            // zoom by pixel (e.g., in dataZoomSelect).
            // we use `getRangePropMode()` to mark which prop is used. `rangePropMode` is updated
            // only when setOption or dispatchAction, otherwise it remains its original value.
            // (Why not only record `percentProp` and always map to `valueProp`? Because
            // the map `valueProp` -> `percentProp` -> `valueProp` probably not the original
            // `valueProp`. consider two axes constrolled by one dataZoom. They have different
            // data extent. All of values that are overflow the `dataExtent` will be calculated
            // to percent '100%').

            if (rangePropMode[idx] === 'percent') {
                boundPercent == null && (boundPercent = percentExtent[idx]);
                // Use scale.parse to math round for category or time axis.
                boundValue = scale.parse(numberUtil.linearMap(
                    boundPercent, percentExtent, dataExtent
                ));
            }
            else {
                hasPropModeValue = true;
                boundValue = boundValue == null ? dataExtent[idx] : scale.parse(boundValue);
                // Calculating `percent` from `value` may be not accurate, because
                // This calculation can not be inversed, because all of values that
                // are overflow the `dataExtent` will be calculated to percent '100%'
                boundPercent = numberUtil.linearMap(
                    boundValue, dataExtent, percentExtent
                );
            }

            // valueWindow[idx] = round(boundValue);
            // percentWindow[idx] = round(boundPercent);
            valueWindow[idx] = boundValue;
            percentWindow[idx] = boundPercent;
        });

        asc(valueWindow);
        asc(percentWindow);

        // The windows from user calling of `dispatchAction` might be out of the extent,
        // or do not obey the `min/maxSpan`, `min/maxValueSpan`. But we dont restrict window
        // by `zoomLock` here, because we see `zoomLock` just as a interaction constraint,
        // where API is able to initialize/modify the window size even though `zoomLock`
        // specified.
        var spans = this._minMaxSpan;
        hasPropModeValue
            ? restrictSet(valueWindow, percentWindow, dataExtent, percentExtent, false)
            : restrictSet(percentWindow, valueWindow, percentExtent, dataExtent, true);

        function restrictSet(fromWindow, toWindow, fromExtent, toExtent, toValue) {
            var suffix = toValue ? 'Span' : 'ValueSpan';
            sliderMove(0, fromWindow, fromExtent, 'all', spans['min' + suffix], spans['max' + suffix]);
            for (var i = 0; i < 2; i++) {
                toWindow[i] = numberUtil.linearMap(fromWindow[i], fromExtent, toExtent, true);
                toValue && (toWindow[i] = scale.parse(toWindow[i]));
            }
        }

        return {
            valueWindow: valueWindow,
            percentWindow: percentWindow
        };
    },

    /**
     * Notice: reset should not be called before series.restoreData() called,
     * so it is recommanded to be called in "process stage" but not "model init
     * stage".
     *
     * @param {module: echarts/component/dataZoom/DataZoomModel} dataZoomModel
     */
    reset: function (dataZoomModel) {
        if (dataZoomModel !== this._dataZoomModel) {
            return;
        }

        var targetSeries = this.getTargetSeriesModels();
        // Culculate data window and data extent, and record them.
        this._dataExtent = calculateDataExtent(this, this._dimName, targetSeries);

        // this.hasSeriesStacked = false;
        // each(targetSeries, function (series) {
            // var data = series.getData();
            // var dataDim = data.mapDimension(this._dimName);
            // var stackedDimension = data.getCalculationInfo('stackedDimension');
            // if (stackedDimension && stackedDimension === dataDim) {
                // this.hasSeriesStacked = true;
            // }
        // }, this);

        // `calculateDataWindow` uses min/maxSpan.
        setMinMaxSpan(this);

        var dataWindow = this.calculateDataWindow(dataZoomModel.settledOption);

        this._valueWindow = dataWindow.valueWindow;
        this._percentWindow = dataWindow.percentWindow;

        // Update axis setting then.
        setAxisModel(this);
    },

    /**
     * @param {module: echarts/component/dataZoom/DataZoomModel} dataZoomModel
     */
    restore: function (dataZoomModel) {
        if (dataZoomModel !== this._dataZoomModel) {
            return;
        }

        this._valueWindow = this._percentWindow = null;
        setAxisModel(this, true);
    },

    /**
     * @param {module: echarts/component/dataZoom/DataZoomModel} dataZoomModel
     */
    filterData: function (dataZoomModel, api) {
        if (dataZoomModel !== this._dataZoomModel) {
            return;
        }

        var axisDim = this._dimName;
        var seriesModels = this.getTargetSeriesModels();
        var filterMode = dataZoomModel.get('filterMode');
        var valueWindow = this._valueWindow;

        if (filterMode === 'none') {
            return;
        }

        // FIXME
        // Toolbox may has dataZoom injected. And if there are stacked bar chart
        // with NaN data, NaN will be filtered and stack will be wrong.
        // So we need to force the mode to be set empty.
        // In fect, it is not a big deal that do not support filterMode-'filter'
        // when using toolbox#dataZoom, utill tooltip#dataZoom support "single axis
        // selection" some day, which might need "adapt to data extent on the
        // otherAxis", which is disabled by filterMode-'empty'.
        // But currently, stack has been fixed to based on value but not index,
        // so this is not an issue any more.
        // var otherAxisModel = this.getOtherAxisModel();
        // if (dataZoomModel.get('$fromToolbox')
        //     && otherAxisModel
        //     && otherAxisModel.hasSeriesStacked
        // ) {
        //     filterMode = 'empty';
        // }

        // TODO
        // filterMode 'weakFilter' and 'empty' is not optimized for huge data yet.

        each(seriesModels, function (seriesModel) {
            var seriesData = seriesModel.getData();
            var dataDims = seriesData.mapDimension(axisDim, true);

            if (!dataDims.length) {
                return;
            }

            if (filterMode === 'weakFilter') {
                seriesData.filterSelf(function (dataIndex) {
                    var leftOut;
                    var rightOut;
                    var hasValue;
                    for (var i = 0; i < dataDims.length; i++) {
                        var value = seriesData.get(dataDims[i], dataIndex);
                        var thisHasValue = !isNaN(value);
                        var thisLeftOut = value < valueWindow[0];
                        var thisRightOut = value > valueWindow[1];
                        if (thisHasValue && !thisLeftOut && !thisRightOut) {
                            return true;
                        }
                        thisHasValue && (hasValue = true);
                        thisLeftOut && (leftOut = true);
                        thisRightOut && (rightOut = true);
                    }
                    // If both left out and right out, do not filter.
                    return hasValue && leftOut && rightOut;
                });
            }
            else {
                each(dataDims, function (dim) {
                    if (filterMode === 'empty') {
                        seriesModel.setData(
                            seriesData = seriesData.map(dim, function (value) {
                                return !isInWindow(value) ? NaN : value;
                            })
                        );
                    }
                    else {
                        var range = {};
                        range[dim] = valueWindow;

                        // console.time('select');
                        seriesData.selectRange(range);
                        // console.timeEnd('select');
                    }
                });
            }

            each(dataDims, function (dim) {
                seriesData.setApproximateExtent(valueWindow, dim);
            });
        });

        function isInWindow(value) {
            return value >= valueWindow[0] && value <= valueWindow[1];
        }
    }
};

function calculateDataExtent(axisProxy, axisDim, seriesModels) {
    var dataExtent = [Infinity, -Infinity];

    each(seriesModels, function (seriesModel) {
        var seriesData = seriesModel.getData();
        if (seriesData) {
            each(seriesData.mapDimension(axisDim, true), function (dim) {
                var seriesExtent = seriesData.getApproximateExtent(dim);
                seriesExtent[0] < dataExtent[0] && (dataExtent[0] = seriesExtent[0]);
                seriesExtent[1] > dataExtent[1] && (dataExtent[1] = seriesExtent[1]);
            });
        }
    });

    if (dataExtent[1] < dataExtent[0]) {
        dataExtent = [NaN, NaN];
    }

    // It is important to get "consistent" extent when more then one axes is
    // controlled by a `dataZoom`, otherwise those axes will not be synchronized
    // when zooming. But it is difficult to know what is "consistent", considering
    // axes have different type or even different meanings (For example, two
    // time axes are used to compare data of the same date in different years).
    // So basically dataZoom just obtains extent by series.data (in category axis
    // extent can be obtained from axis.data).
    // Nevertheless, user can set min/max/scale on axes to make extent of axes
    // consistent.
    fixExtentByAxis(axisProxy, dataExtent);

    return dataExtent;
}

function fixExtentByAxis(axisProxy, dataExtent) {
    var axisModel = axisProxy.getAxisModel();
    var min = axisModel.getMin(true);

    // For category axis, if min/max/scale are not set, extent is determined
    // by axis.data by default.
    var isCategoryAxis = axisModel.get('type') === 'category';
    var axisDataLen = isCategoryAxis && axisModel.getCategories().length;

    if (min != null && min !== 'dataMin') {
        if (typeof max === 'function') {
            dataExtent[0] = min({
                min: dataExtent[0],
                max: dataExtent[1]
            });
        }
        else {
            dataExtent[0] = min;
        }
    }
    else if (isCategoryAxis) {
        dataExtent[0] = axisDataLen > 0 ? 0 : NaN;
    }

    var max = axisModel.getMax(true);
    if (max != null && max !== 'dataMax') {
        if (typeof max === 'function') {
            dataExtent[1] = max({
                min: dataExtent[0],
                max: dataExtent[1]
            });
        }
        else {
            dataExtent[1] = max;
        }
    }
    else if (isCategoryAxis) {
        dataExtent[1] = axisDataLen > 0 ? axisDataLen - 1 : NaN;
    }

    if (!axisModel.get('scale', true)) {
        dataExtent[0] > 0 && (dataExtent[0] = 0);
        dataExtent[1] < 0 && (dataExtent[1] = 0);
    }

    // For value axis, if min/max/scale are not set, we just use the extent obtained
    // by series data, which may be a little different from the extent calculated by
    // `axisHelper.getScaleExtent`. But the different just affects the experience a
    // little when zooming. So it will not be fixed until some users require it strongly.

    return dataExtent;
}

function setAxisModel(axisProxy, isRestore) {
    var axisModel = axisProxy.getAxisModel();

    var percentWindow = axisProxy._percentWindow;
    var valueWindow = axisProxy._valueWindow;

    if (!percentWindow) {
        return;
    }

    // [0, 500]: arbitrary value, guess axis extent.
    var precision = numberUtil.getPixelPrecision(valueWindow, [0, 500]);
    precision = Math.min(precision, 20);
    // isRestore or isFull
    var useOrigin = isRestore || (percentWindow[0] === 0 && percentWindow[1] === 100);

    axisModel.setRange(
        useOrigin ? null : +valueWindow[0].toFixed(precision),
        useOrigin ? null : +valueWindow[1].toFixed(precision)
    );
}

function setMinMaxSpan(axisProxy) {
    var minMaxSpan = axisProxy._minMaxSpan = {};
    var dataZoomModel = axisProxy._dataZoomModel;
    var dataExtent = axisProxy._dataExtent;

    each(['min', 'max'], function (minMax) {
        var percentSpan = dataZoomModel.get(minMax + 'Span');
        var valueSpan = dataZoomModel.get(minMax + 'ValueSpan');
        valueSpan != null && (valueSpan = axisProxy.getAxisModel().axis.scale.parse(valueSpan));

        // minValueSpan and maxValueSpan has higher priority than minSpan and maxSpan
        if (valueSpan != null) {
            percentSpan = numberUtil.linearMap(
                dataExtent[0] + valueSpan, dataExtent, [0, 100], true
            );
        }
        else if (percentSpan != null) {
            valueSpan = numberUtil.linearMap(
                percentSpan, [0, 100], dataExtent, true
            ) - dataExtent[0];
        }

        minMaxSpan[minMax + 'Span'] = percentSpan;
        minMaxSpan[minMax + 'ValueSpan'] = valueSpan;
    });
}

export default AxisProxy;
