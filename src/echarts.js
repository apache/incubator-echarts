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
import {__DEV__} from './config';
import * as zrender from 'zrender/src/zrender';
import * as zrUtil from 'zrender/src/core/util';
import * as colorTool from 'zrender/src/tool/color';
import env from 'zrender/src/core/env';
import timsort from 'zrender/src/core/timsort';
import Eventful from 'zrender/src/mixin/Eventful';
import GlobalModel from './model/Global';
import ExtensionAPI from './ExtensionAPI';
import CoordinateSystemManager from './CoordinateSystem';
import OptionManager from './model/OptionManager';
import backwardCompat from './preprocessor/backwardCompat';
import dataStack from './processor/dataStack';
import ComponentModel from './model/Component';
import SeriesModel from './model/Series';
import ComponentView from './view/Component';
import ChartView from './view/Chart';
import * as graphic from './util/graphic';
import * as modelUtil from './util/model';
import {throttle} from './util/throttle';
import seriesColor from './visual/seriesColor';
import aria from './visual/aria';
import loadingDefault from './loading/default';
import Scheduler from './stream/Scheduler';
import lightTheme from './theme/light';
import darkTheme from './theme/dark';
import './component/dataset';
import mapDataStorage from './coord/geo/mapDataStorage';

var assert = zrUtil.assert;
var each = zrUtil.each;
var isFunction = zrUtil.isFunction;
var isObject = zrUtil.isObject;
var parseClassType = ComponentModel.parseClassType;

export var version = '4.9.0';

export var dependencies = {
    zrender: '4.3.2'
};

var TEST_FRAME_REMAIN_TIME = 1;

var PRIORITY_PROCESSOR_FILTER = 1000;
var PRIORITY_PROCESSOR_SERIES_FILTER = 800;
var PRIORITY_PROCESSOR_DATASTACK = 900;
var PRIORITY_PROCESSOR_STATISTIC = 5000;

var PRIORITY_VISUAL_LAYOUT = 1000;
var PRIORITY_VISUAL_PROGRESSIVE_LAYOUT = 1100;
var PRIORITY_VISUAL_GLOBAL = 2000;
var PRIORITY_VISUAL_CHART = 3000;
var PRIORITY_VISUAL_POST_CHART_LAYOUT = 3500;
var PRIORITY_VISUAL_COMPONENT = 4000;
// FIXME
// necessary?
var PRIORITY_VISUAL_BRUSH = 5000;

export var PRIORITY = {
    PROCESSOR: {
        FILTER: PRIORITY_PROCESSOR_FILTER,
        SERIES_FILTER: PRIORITY_PROCESSOR_SERIES_FILTER,
        STATISTIC: PRIORITY_PROCESSOR_STATISTIC
    },
    VISUAL: {
        LAYOUT: PRIORITY_VISUAL_LAYOUT,
        PROGRESSIVE_LAYOUT: PRIORITY_VISUAL_PROGRESSIVE_LAYOUT,
        GLOBAL: PRIORITY_VISUAL_GLOBAL,
        CHART: PRIORITY_VISUAL_CHART,
        POST_CHART_LAYOUT: PRIORITY_VISUAL_POST_CHART_LAYOUT,
        COMPONENT: PRIORITY_VISUAL_COMPONENT,
        BRUSH: PRIORITY_VISUAL_BRUSH
    }
};

// Main process have three entries: `setOption`, `dispatchAction` and `resize`,
// where they must not be invoked nestedly, except the only case: invoke
// dispatchAction with updateMethod "none" in main process.
// This flag is used to carry out this rule.
// All events will be triggered out side main process (i.e. when !this[IN_MAIN_PROCESS]).
var IN_MAIN_PROCESS = '__flagInMainProcess';
var OPTION_UPDATED = '__optionUpdated';
var ACTION_REG = /^[a-zA-Z0-9_]+$/;


function createRegisterEventWithLowercaseName(method, ignoreDisposed) {
    return function (eventName, handler, context) {
        if (!ignoreDisposed && this._disposed) {
            disposedWarning(this.id);
            return;
        }

        // Event name is all lowercase
        eventName = eventName && eventName.toLowerCase();
        Eventful.prototype[method].call(this, eventName, handler, context);
    };
}

/**
 * @module echarts~MessageCenter
 */
function MessageCenter() {
    Eventful.call(this);
}
MessageCenter.prototype.on = createRegisterEventWithLowercaseName('on', true);
MessageCenter.prototype.off = createRegisterEventWithLowercaseName('off', true);
MessageCenter.prototype.one = createRegisterEventWithLowercaseName('one', true);
zrUtil.mixin(MessageCenter, Eventful);

/**
 * @module echarts~ECharts
 */
function ECharts(dom, theme, opts) {
    opts = opts || {};

    // Get theme by name
    if (typeof theme === 'string') {
        theme = themeStorage[theme];
    }

    /**
     * @type {string}
     */
    this.id;

    /**
     * Group id
     * @type {string}
     */
    this.group;

    /**
     * @type {HTMLElement}
     * @private
     */
    this._dom = dom;

    var defaultRenderer = 'canvas';
    if (__DEV__) {
        defaultRenderer = (
            typeof window === 'undefined' ? global : window
        ).__ECHARTS__DEFAULT__RENDERER__ || defaultRenderer;
    }

    /**
     * @type {module:zrender/ZRender}
     * @private
     */
    var zr = this._zr = zrender.init(dom, {
        renderer: opts.renderer || defaultRenderer,
        devicePixelRatio: opts.devicePixelRatio,
        width: opts.width,
        height: opts.height
    });

    /**
     * Expect 60 fps.
     * @type {Function}
     * @private
     */
    this._throttledZrFlush = throttle(zrUtil.bind(zr.flush, zr), 17);

    var theme = zrUtil.clone(theme);
    theme && backwardCompat(theme, true);
    /**
     * @type {Object}
     * @private
     */
    this._theme = theme;

    /**
     * @type {Array.<module:echarts/view/Chart>}
     * @private
     */
    this._chartsViews = [];

    /**
     * @type {Object.<string, module:echarts/view/Chart>}
     * @private
     */
    this._chartsMap = {};

    /**
     * @type {Array.<module:echarts/view/Component>}
     * @private
     */
    this._componentsViews = [];

    /**
     * @type {Object.<string, module:echarts/view/Component>}
     * @private
     */
    this._componentsMap = {};

    /**
     * @type {module:echarts/CoordinateSystem}
     * @private
     */
    this._coordSysMgr = new CoordinateSystemManager();

    /**
     * @type {module:echarts/ExtensionAPI}
     * @private
     */
    var api = this._api = createExtensionAPI(this);

    // Sort on demand
    function prioritySortFunc(a, b) {
        return a.__prio - b.__prio;
    }
    timsort(visualFuncs, prioritySortFunc);
    timsort(dataProcessorFuncs, prioritySortFunc);

    /**
     * @type {module:echarts/stream/Scheduler}
     */
    this._scheduler = new Scheduler(this, api, dataProcessorFuncs, visualFuncs);

    Eventful.call(this, this._ecEventProcessor = new EventProcessor());

    /**
     * @type {module:echarts~MessageCenter}
     * @private
     */
    this._messageCenter = new MessageCenter();

    // Init mouse events
    this._initEvents();

    // In case some people write `window.onresize = chart.resize`
    this.resize = zrUtil.bind(this.resize, this);

    // Can't dispatch action during rendering procedure
    this._pendingActions = [];

    zr.animation.on('frame', this._onframe, this);

    bindRenderedEvent(zr, this);

    // ECharts instance can be used as value.
    zrUtil.setAsPrimitive(this);
}

var echartsProto = ECharts.prototype;

echartsProto._onframe = function () {
    if (this._disposed) {
        return;
    }

    var scheduler = this._scheduler;

    // Lazy update
    if (this[OPTION_UPDATED]) {
        var silent = this[OPTION_UPDATED].silent;

        this[IN_MAIN_PROCESS] = true;

        prepare(this);
        updateMethods.update.call(this);

        this[IN_MAIN_PROCESS] = false;

        this[OPTION_UPDATED] = false;

        flushPendingActions.call(this, silent);

        triggerUpdatedEvent.call(this, silent);
    }
    // Avoid do both lazy update and progress in one frame.
    else if (scheduler.unfinished) {
        // Stream progress.
        var remainTime = TEST_FRAME_REMAIN_TIME;
        var ecModel = this._model;
        var api = this._api;
        scheduler.unfinished = false;
        do {
            var startTime = +new Date();

            scheduler.performSeriesTasks(ecModel);

            // Currently dataProcessorFuncs do not check threshold.
            scheduler.performDataProcessorTasks(ecModel);

            updateStreamModes(this, ecModel);

            // Do not update coordinate system here. Because that coord system update in
            // each frame is not a good user experience. So we follow the rule that
            // the extent of the coordinate system is determin in the first frame (the
            // frame is executed immedietely after task reset.
            // this._coordSysMgr.update(ecModel, api);

            // console.log('--- ec frame visual ---', remainTime);
            scheduler.performVisualTasks(ecModel);

            renderSeries(this, this._model, api, 'remain');

            remainTime -= (+new Date() - startTime);
        }
        while (remainTime > 0 && scheduler.unfinished);

        // Call flush explicitly for trigger finished event.
        if (!scheduler.unfinished) {
            this._zr.flush();
        }
        // Else, zr flushing be ensue within the same frame,
        // because zr flushing is after onframe event.
    }
};

/**
 * @return {HTMLElement}
 */
echartsProto.getDom = function () {
    return this._dom;
};

/**
 * @return {module:zrender~ZRender}
 */
echartsProto.getZr = function () {
    return this._zr;
};

/**
 * Usage:
 * chart.setOption(option, notMerge, lazyUpdate);
 * chart.setOption(option, {
 *     notMerge: ...,
 *     lazyUpdate: ...,
 *     silent: ...
 * });
 *
 * @param {Object} option
 * @param {Object|boolean} [opts] opts or notMerge.
 * @param {boolean} [opts.notMerge=false]
 * @param {boolean} [opts.lazyUpdate=false] Useful when setOption frequently.
 */
echartsProto.setOption = function (option, notMerge, lazyUpdate) {
    if (__DEV__) {
        assert(!this[IN_MAIN_PROCESS], '`setOption` should not be called during main process.');
    }
    if (this._disposed) {
        disposedWarning(this.id);
        return;
    }

    var silent;
    if (isObject(notMerge)) {
        lazyUpdate = notMerge.lazyUpdate;
        silent = notMerge.silent;
        notMerge = notMerge.notMerge;
    }

    this[IN_MAIN_PROCESS] = true;

    if (!this._model || notMerge) {
        var optionManager = new OptionManager(this._api);
        var theme = this._theme;
        var ecModel = this._model = new GlobalModel();
        ecModel.scheduler = this._scheduler;
        ecModel.init(null, null, theme, optionManager);
    }

    this._model.setOption(option, optionPreprocessorFuncs);

    if (lazyUpdate) {
        this[OPTION_UPDATED] = {silent: silent};
        this[IN_MAIN_PROCESS] = false;
    }
    else {
        prepare(this);

        updateMethods.update.call(this);

        // Ensure zr refresh sychronously, and then pixel in canvas can be
        // fetched after `setOption`.
        this._zr.flush();

        this[OPTION_UPDATED] = false;
        this[IN_MAIN_PROCESS] = false;

        flushPendingActions.call(this, silent);
        triggerUpdatedEvent.call(this, silent);
    }
};

/**
 * @DEPRECATED
 */
echartsProto.setTheme = function () {
    console.error('ECharts#setTheme() is DEPRECATED in ECharts 3.0');
};

/**
 * @return {module:echarts/model/Global}
 */
echartsProto.getModel = function () {
    return this._model;
};

/**
 * @return {Object}
 */
echartsProto.getOption = function () {
    return this._model && this._model.getOption();
};

/**
 * @return {number}
 */
echartsProto.getWidth = function () {
    return this._zr.getWidth();
};

/**
 * @return {number}
 */
echartsProto.getHeight = function () {
    return this._zr.getHeight();
};

/**
 * @return {number}
 */
echartsProto.getDevicePixelRatio = function () {
    return this._zr.painter.dpr || window.devicePixelRatio || 1;
};

/**
 * Get canvas which has all thing rendered
 * @param {Object} opts
 * @param {string} [opts.backgroundColor]
 * @return {string}
 */
echartsProto.getRenderedCanvas = function (opts) {
    if (!env.canvasSupported) {
        return;
    }
    opts = opts || {};
    opts.pixelRatio = opts.pixelRatio || 1;
    opts.backgroundColor = opts.backgroundColor
        || this._model.get('backgroundColor');
    var zr = this._zr;
    // var list = zr.storage.getDisplayList();
    // Stop animations
    // Never works before in init animation, so remove it.
    // zrUtil.each(list, function (el) {
    //     el.stopAnimation(true);
    // });
    return zr.painter.getRenderedCanvas(opts);
};

/**
 * Get svg data url
 * @return {string}
 */
echartsProto.getSvgDataURL = function () {
    if (!env.svgSupported) {
        return;
    }

    var zr = this._zr;
    var list = zr.storage.getDisplayList();
    // Stop animations
    zrUtil.each(list, function (el) {
        el.stopAnimation(true);
    });

    return zr.painter.toDataURL();
};

/**
 * @return {string}
 * @param {Object} opts
 * @param {string} [opts.type='png']
 * @param {string} [opts.pixelRatio=1]
 * @param {string} [opts.backgroundColor]
 * @param {string} [opts.excludeComponents]
 */
echartsProto.getDataURL = function (opts) {
    if (this._disposed) {
        disposedWarning(this.id);
        return;
    }

    opts = opts || {};
    var excludeComponents = opts.excludeComponents;
    var ecModel = this._model;
    var excludesComponentViews = [];
    var self = this;

    each(excludeComponents, function (componentType) {
        ecModel.eachComponent({
            mainType: componentType
        }, function (component) {
            var view = self._componentsMap[component.__viewId];
            if (!view.group.ignore) {
                excludesComponentViews.push(view);
                view.group.ignore = true;
            }
        });
    });

    var url = this._zr.painter.getType() === 'svg'
        ? this.getSvgDataURL()
        : this.getRenderedCanvas(opts).toDataURL(
            'image/' + (opts && opts.type || 'png')
        );

    each(excludesComponentViews, function (view) {
        view.group.ignore = false;
    });

    return url;
};


/**
 * @return {string}
 * @param {Object} opts
 * @param {string} [opts.type='png']
 * @param {string} [opts.pixelRatio=1]
 * @param {string} [opts.backgroundColor]
 */
echartsProto.getConnectedDataURL = function (opts) {
    if (this._disposed) {
        disposedWarning(this.id);
        return;
    }

    if (!env.canvasSupported) {
        return;
    }
    var isSvg = opts.type === 'svg';
    var groupId = this.group;
    var mathMin = Math.min;
    var mathMax = Math.max;
    var MAX_NUMBER = Infinity;
    if (connectedGroups[groupId]) {
        var left = MAX_NUMBER;
        var top = MAX_NUMBER;
        var right = -MAX_NUMBER;
        var bottom = -MAX_NUMBER;
        var canvasList = [];
        var dpr = (opts && opts.pixelRatio) || 1;

        zrUtil.each(instances, function (chart, id) {
            if (chart.group === groupId) {
                var canvas = isSvg
                    ? chart.getZr().painter.getSvgDom().innerHTML
                    : chart.getRenderedCanvas(zrUtil.clone(opts));
                var boundingRect = chart.getDom().getBoundingClientRect();
                left = mathMin(boundingRect.left, left);
                top = mathMin(boundingRect.top, top);
                right = mathMax(boundingRect.right, right);
                bottom = mathMax(boundingRect.bottom, bottom);
                canvasList.push({
                    dom: canvas,
                    left: boundingRect.left,
                    top: boundingRect.top
                });
            }
        });

        left *= dpr;
        top *= dpr;
        right *= dpr;
        bottom *= dpr;
        var width = right - left;
        var height = bottom - top;
        var targetCanvas = zrUtil.createCanvas();
        var zr = zrender.init(targetCanvas, {
            renderer: isSvg ? 'svg' : 'canvas'
        });
        zr.resize({
            width: width,
            height: height
        });

        if (isSvg) {
            var content = '';
            each(canvasList, function (item) {
                var x = item.left - left;
                var y = item.top - top;
                content += '<g transform="translate(' + x + ','
                    + y + ')">' + item.dom + '</g>';
            });
            zr.painter.getSvgRoot().innerHTML = content;

            if (opts.connectedBackgroundColor) {
                zr.painter.setBackgroundColor(opts.connectedBackgroundColor);
            }

            zr.refreshImmediately();
            return zr.painter.toDataURL();
        }
        else {
            // Background between the charts
            if (opts.connectedBackgroundColor) {
                zr.add(new graphic.Rect({
                    shape: {
                        x: 0,
                        y: 0,
                        width: width,
                        height: height
                    },
                    style: {
                        fill: opts.connectedBackgroundColor
                    }
                }));
            }

            each(canvasList, function (item) {
                var img = new graphic.Image({
                    style: {
                        x: item.left * dpr - left,
                        y: item.top * dpr - top,
                        image: item.dom
                    }
                });
                zr.add(img);
            });

            zr.refreshImmediately();
            return targetCanvas.toDataURL('image/' + (opts && opts.type || 'png'));
        }
    }
    else {
        return this.getDataURL(opts);
    }
};

/**
 * Convert from logical coordinate system to pixel coordinate system.
 * See CoordinateSystem#convertToPixel.
 * @param {string|Object} finder
 *        If string, e.g., 'geo', means {geoIndex: 0}.
 *        If Object, could contain some of these properties below:
 *        {
 *            seriesIndex / seriesId / seriesName,
 *            geoIndex / geoId, geoName,
 *            bmapIndex / bmapId / bmapName,
 *            xAxisIndex / xAxisId / xAxisName,
 *            yAxisIndex / yAxisId / yAxisName,
 *            gridIndex / gridId / gridName,
 *            ... (can be extended)
 *        }
 * @param {Array|number} value
 * @return {Array|number} result
 */
echartsProto.convertToPixel = zrUtil.curry(doConvertPixel, 'convertToPixel');

/**
 * Convert from pixel coordinate system to logical coordinate system.
 * See CoordinateSystem#convertFromPixel.
 * @param {string|Object} finder
 *        If string, e.g., 'geo', means {geoIndex: 0}.
 *        If Object, could contain some of these properties below:
 *        {
 *            seriesIndex / seriesId / seriesName,
 *            geoIndex / geoId / geoName,
 *            bmapIndex / bmapId / bmapName,
 *            xAxisIndex / xAxisId / xAxisName,
 *            yAxisIndex / yAxisId / yAxisName
 *            gridIndex / gridId / gridName,
 *            ... (can be extended)
 *        }
 * @param {Array|number} value
 * @return {Array|number} result
 */
echartsProto.convertFromPixel = zrUtil.curry(doConvertPixel, 'convertFromPixel');

function doConvertPixel(methodName, finder, value) {
    if (this._disposed) {
        disposedWarning(this.id);
        return;
    }

    var ecModel = this._model;
    var coordSysList = this._coordSysMgr.getCoordinateSystems();
    var result;

    finder = modelUtil.parseFinder(ecModel, finder);

    for (var i = 0; i < coordSysList.length; i++) {
        var coordSys = coordSysList[i];
        if (coordSys[methodName]
            && (result = coordSys[methodName](ecModel, finder, value)) != null
        ) {
            return result;
        }
    }

    if (__DEV__) {
        console.warn(
            'No coordinate system that supports ' + methodName + ' found by the given finder.'
        );
    }
}

/**
 * Is the specified coordinate systems or components contain the given pixel point.
 * @param {string|Object} finder
 *        If string, e.g., 'geo', means {geoIndex: 0}.
 *        If Object, could contain some of these properties below:
 *        {
 *            seriesIndex / seriesId / seriesName,
 *            geoIndex / geoId / geoName,
 *            bmapIndex / bmapId / bmapName,
 *            xAxisIndex / xAxisId / xAxisName,
 *            yAxisIndex / yAxisId / yAxisName,
 *            gridIndex / gridId / gridName,
 *            ... (can be extended)
 *        }
 * @param {Array|number} value
 * @return {boolean} result
 */
echartsProto.containPixel = function (finder, value) {
    if (this._disposed) {
        disposedWarning(this.id);
        return;
    }

    var ecModel = this._model;
    var result;

    finder = modelUtil.parseFinder(ecModel, finder);

    zrUtil.each(finder, function (models, key) {
        key.indexOf('Models') >= 0 && zrUtil.each(models, function (model) {
            var coordSys = model.coordinateSystem;
            if (coordSys && coordSys.containPoint) {
                result |= !!coordSys.containPoint(value);
            }
            else if (key === 'seriesModels') {
                var view = this._chartsMap[model.__viewId];
                if (view && view.containPoint) {
                    result |= view.containPoint(value, model);
                }
                else {
                    if (__DEV__) {
                        console.warn(key + ': ' + (view
                            ? 'The found component do not support containPoint.'
                            : 'No view mapping to the found component.'
                        ));
                    }
                }
            }
            else {
                if (__DEV__) {
                    console.warn(key + ': containPoint is not supported');
                }
            }
        }, this);
    }, this);

    return !!result;
};

/**
 * Get visual from series or data.
 * @param {string|Object} finder
 *        If string, e.g., 'series', means {seriesIndex: 0}.
 *        If Object, could contain some of these properties below:
 *        {
 *            seriesIndex / seriesId / seriesName,
 *            dataIndex / dataIndexInside
 *        }
 *        If dataIndex is not specified, series visual will be fetched,
 *        but not data item visual.
 *        If all of seriesIndex, seriesId, seriesName are not specified,
 *        visual will be fetched from first series.
 * @param {string} visualType 'color', 'symbol', 'symbolSize'
 */
echartsProto.getVisual = function (finder, visualType) {
    var ecModel = this._model;

    finder = modelUtil.parseFinder(ecModel, finder, {defaultMainType: 'series'});

    var seriesModel = finder.seriesModel;

    if (__DEV__) {
        if (!seriesModel) {
            console.warn('There is no specified seires model');
        }
    }

    var data = seriesModel.getData();

    var dataIndexInside = finder.hasOwnProperty('dataIndexInside')
        ? finder.dataIndexInside
        : finder.hasOwnProperty('dataIndex')
        ? data.indexOfRawIndex(finder.dataIndex)
        : null;

    return dataIndexInside != null
        ? data.getItemVisual(dataIndexInside, visualType)
        : data.getVisual(visualType);
};

/**
 * Get view of corresponding component model
 * @param  {module:echarts/model/Component} componentModel
 * @return {module:echarts/view/Component}
 */
echartsProto.getViewOfComponentModel = function (componentModel) {
    return this._componentsMap[componentModel.__viewId];
};

/**
 * Get view of corresponding series model
 * @param  {module:echarts/model/Series} seriesModel
 * @return {module:echarts/view/Chart}
 */
echartsProto.getViewOfSeriesModel = function (seriesModel) {
    return this._chartsMap[seriesModel.__viewId];
};

var updateMethods = {

    prepareAndUpdate: function (payload) {
        prepare(this);
        updateMethods.update.call(this, payload);
    },

    /**
     * @param {Object} payload
     * @private
     */
    update: function (payload) {
        // console.profile && console.profile('update');

        var ecModel = this._model;
        var api = this._api;
        var zr = this._zr;
        var coordSysMgr = this._coordSysMgr;
        var scheduler = this._scheduler;

        // update before setOption
        if (!ecModel) {
            return;
        }

        scheduler.restoreData(ecModel, payload);

        scheduler.performSeriesTasks(ecModel);

        // TODO
        // Save total ecModel here for undo/redo (after restoring data and before processing data).
        // Undo (restoration of total ecModel) can be carried out in 'action' or outside API call.

        // Create new coordinate system each update
        // In LineView may save the old coordinate system and use it to get the orignal point
        coordSysMgr.create(ecModel, api);

        scheduler.performDataProcessorTasks(ecModel, payload);

        // Current stream render is not supported in data process. So we can update
        // stream modes after data processing, where the filtered data is used to
        // deteming whether use progressive rendering.
        updateStreamModes(this, ecModel);

        // We update stream modes before coordinate system updated, then the modes info
        // can be fetched when coord sys updating (consider the barGrid extent fix). But
        // the drawback is the full coord info can not be fetched. Fortunately this full
        // coord is not requied in stream mode updater currently.
        coordSysMgr.update(ecModel, api);

        clearColorPalette(ecModel);
        scheduler.performVisualTasks(ecModel, payload);

        render(this, ecModel, api, payload);

        // Set background
        var backgroundColor = ecModel.get('backgroundColor') || 'transparent';

        // In IE8
        if (!env.canvasSupported) {
            var colorArr = colorTool.parse(backgroundColor);
            backgroundColor = colorTool.stringify(colorArr, 'rgb');
            if (colorArr[3] === 0) {
                backgroundColor = 'transparent';
            }
        }
        else {
            zr.setBackgroundColor(backgroundColor);
        }

        performPostUpdateFuncs(ecModel, api);

        // console.profile && console.profileEnd('update');
    },

    /**
     * @param {Object} payload
     * @private
     */
    updateTransform: function (payload) {
        var ecModel = this._model;
        var ecIns = this;
        var api = this._api;

        // update before setOption
        if (!ecModel) {
            return;
        }

        // ChartView.markUpdateMethod(payload, 'updateTransform');

        var componentDirtyList = [];
        ecModel.eachComponent(function (componentType, componentModel) {
            var componentView = ecIns.getViewOfComponentModel(componentModel);
            if (componentView && componentView.__alive) {
                if (componentView.updateTransform) {
                    var result = componentView.updateTransform(componentModel, ecModel, api, payload);
                    result && result.update && componentDirtyList.push(componentView);
                }
                else {
                    componentDirtyList.push(componentView);
                }
            }
        });

        var seriesDirtyMap = zrUtil.createHashMap();
        ecModel.eachSeries(function (seriesModel) {
            var chartView = ecIns._chartsMap[seriesModel.__viewId];
            if (chartView.updateTransform) {
                var result = chartView.updateTransform(seriesModel, ecModel, api, payload);
                result && result.update && seriesDirtyMap.set(seriesModel.uid, 1);
            }
            else {
                seriesDirtyMap.set(seriesModel.uid, 1);
            }
        });

        clearColorPalette(ecModel);
        // Keep pipe to the exist pipeline because it depends on the render task of the full pipeline.
        // this._scheduler.performVisualTasks(ecModel, payload, 'layout', true);
        this._scheduler.performVisualTasks(
            ecModel, payload, {setDirty: true, dirtyMap: seriesDirtyMap}
        );

        // Currently, not call render of components. Geo render cost a lot.
        // renderComponents(ecIns, ecModel, api, payload, componentDirtyList);
        renderSeries(ecIns, ecModel, api, payload, seriesDirtyMap);

        performPostUpdateFuncs(ecModel, this._api);
    },

    /**
     * @param {Object} payload
     * @private
     */
    updateView: function (payload) {
        var ecModel = this._model;

        // update before setOption
        if (!ecModel) {
            return;
        }

        ChartView.markUpdateMethod(payload, 'updateView');

        clearColorPalette(ecModel);

        // Keep pipe to the exist pipeline because it depends on the render task of the full pipeline.
        this._scheduler.performVisualTasks(ecModel, payload, {setDirty: true});

        render(this, this._model, this._api, payload);

        performPostUpdateFuncs(ecModel, this._api);
    },

    /**
     * @param {Object} payload
     * @private
     */
    updateVisual: function (payload) {
        updateMethods.update.call(this, payload);

        // var ecModel = this._model;

        // // update before setOption
        // if (!ecModel) {
        //     return;
        // }

        // ChartView.markUpdateMethod(payload, 'updateVisual');

        // clearColorPalette(ecModel);

        // // Keep pipe to the exist pipeline because it depends on the render task of the full pipeline.
        // this._scheduler.performVisualTasks(ecModel, payload, {visualType: 'visual', setDirty: true});

        // render(this, this._model, this._api, payload);

        // performPostUpdateFuncs(ecModel, this._api);
    },

    /**
     * @param {Object} payload
     * @private
     */
    updateLayout: function (payload) {
        updateMethods.update.call(this, payload);

        // var ecModel = this._model;

        // // update before setOption
        // if (!ecModel) {
        //     return;
        // }

        // ChartView.markUpdateMethod(payload, 'updateLayout');

        // // Keep pipe to the exist pipeline because it depends on the render task of the full pipeline.
        // // this._scheduler.performVisualTasks(ecModel, payload, 'layout', true);
        // this._scheduler.performVisualTasks(ecModel, payload, {setDirty: true});

        // render(this, this._model, this._api, payload);

        // performPostUpdateFuncs(ecModel, this._api);
    }
};

function prepare(ecIns) {
    var ecModel = ecIns._model;
    var scheduler = ecIns._scheduler;

    scheduler.restorePipelines(ecModel);

    scheduler.prepareStageTasks();

    prepareView(ecIns, 'component', ecModel, scheduler);

    prepareView(ecIns, 'chart', ecModel, scheduler);

    scheduler.plan();
}

/**
 * @private
 */
function updateDirectly(ecIns, method, payload, mainType, subType) {
    var ecModel = ecIns._model;

    // broadcast
    if (!mainType) {
        // FIXME
        // Chart will not be update directly here, except set dirty.
        // But there is no such scenario now.
        each(ecIns._componentsViews.concat(ecIns._chartsViews), callView);
        return;
    }

    var query = {};
    query[mainType + 'Id'] = payload[mainType + 'Id'];
    query[mainType + 'Index'] = payload[mainType + 'Index'];
    query[mainType + 'Name'] = payload[mainType + 'Name'];

    var condition = {mainType: mainType, query: query};
    subType && (condition.subType = subType); // subType may be '' by parseClassType;

    var excludeSeriesId = payload.excludeSeriesId;
    if (excludeSeriesId != null) {
        excludeSeriesId = zrUtil.createHashMap(modelUtil.normalizeToArray(excludeSeriesId));
    }

    // If dispatchAction before setOption, do nothing.
    ecModel && ecModel.eachComponent(condition, function (model) {
        if (!excludeSeriesId || excludeSeriesId.get(model.id) == null) {
            callView(ecIns[
                mainType === 'series' ? '_chartsMap' : '_componentsMap'
            ][model.__viewId]);
        }
    }, ecIns);

    function callView(view) {
        view && view.__alive && view[method] && view[method](
            view.__model, ecModel, ecIns._api, payload
        );
    }
}

/**
 * Resize the chart
 * @param {Object} opts
 * @param {number} [opts.width] Can be 'auto' (the same as null/undefined)
 * @param {number} [opts.height] Can be 'auto' (the same as null/undefined)
 * @param {boolean} [opts.silent=false]
 */
echartsProto.resize = function (opts) {
    if (__DEV__) {
        assert(!this[IN_MAIN_PROCESS], '`resize` should not be called during main process.');
    }
    if (this._disposed) {
        disposedWarning(this.id);
        return;
    }

    this._zr.resize(opts);

    var ecModel = this._model;

    // Resize loading effect
    this._loadingFX && this._loadingFX.resize();

    if (!ecModel) {
        return;
    }

    var optionChanged = ecModel.resetOption('media');

    var silent = opts && opts.silent;

    this[IN_MAIN_PROCESS] = true;

    optionChanged && prepare(this);
    updateMethods.update.call(this);

    this[IN_MAIN_PROCESS] = false;

    flushPendingActions.call(this, silent);

    triggerUpdatedEvent.call(this, silent);
};

function updateStreamModes(ecIns, ecModel) {
    var chartsMap = ecIns._chartsMap;
    var scheduler = ecIns._scheduler;
    ecModel.eachSeries(function (seriesModel) {
        scheduler.updateStreamModes(seriesModel, chartsMap[seriesModel.__viewId]);
    });
}

/**
 * Show loading effect
 * @param  {string} [name='default']
 * @param  {Object} [cfg]
 */
echartsProto.showLoading = function (name, cfg) {
    if (this._disposed) {
        disposedWarning(this.id);
        return;
    }

    if (isObject(name)) {
        cfg = name;
        name = '';
    }
    name = name || 'default';

    this.hideLoading();
    if (!loadingEffects[name]) {
        if (__DEV__) {
            console.warn('Loading effects ' + name + ' not exists.');
        }
        return;
    }
    var el = loadingEffects[name](this._api, cfg);
    var zr = this._zr;
    this._loadingFX = el;

    zr.add(el);
};

/**
 * Hide loading effect
 */
echartsProto.hideLoading = function () {
    if (this._disposed) {
        disposedWarning(this.id);
        return;
    }

    this._loadingFX && this._zr.remove(this._loadingFX);
    this._loadingFX = null;
};

/**
 * @param {Object} eventObj
 * @return {Object}
 */
echartsProto.makeActionFromEvent = function (eventObj) {
    var payload = zrUtil.extend({}, eventObj);
    payload.type = eventActionMap[eventObj.type];
    return payload;
};

/**
 * @pubilc
 * @param {Object} payload
 * @param {string} [payload.type] Action type
 * @param {Object|boolean} [opt] If pass boolean, means opt.silent
 * @param {boolean} [opt.silent=false] Whether trigger events.
 * @param {boolean} [opt.flush=undefined]
 *                  true: Flush immediately, and then pixel in canvas can be fetched
 *                      immediately. Caution: it might affect performance.
 *                  false: Not flush.
 *                  undefined: Auto decide whether perform flush.
 */
echartsProto.dispatchAction = function (payload, opt) {
    if (this._disposed) {
        disposedWarning(this.id);
        return;
    }

    if (!isObject(opt)) {
        opt = {silent: !!opt};
    }

    if (!actions[payload.type]) {
        return;
    }

    // Avoid dispatch action before setOption. Especially in `connect`.
    if (!this._model) {
        return;
    }

    // May dispatchAction in rendering procedure
    if (this[IN_MAIN_PROCESS]) {
        this._pendingActions.push(payload);
        return;
    }

    doDispatchAction.call(this, payload, opt.silent);

    if (opt.flush) {
        this._zr.flush(true);
    }
    else if (opt.flush !== false && env.browser.weChat) {
        // In WeChat embeded browser, `requestAnimationFrame` and `setInterval`
        // hang when sliding page (on touch event), which cause that zr does not
        // refresh util user interaction finished, which is not expected.
        // But `dispatchAction` may be called too frequently when pan on touch
        // screen, which impacts performance if do not throttle them.
        this._throttledZrFlush();
    }

    flushPendingActions.call(this, opt.silent);

    triggerUpdatedEvent.call(this, opt.silent);
};

function doDispatchAction(payload, silent) {
    var payloadType = payload.type;
    var escapeConnect = payload.escapeConnect;
    var actionWrap = actions[payloadType];
    var actionInfo = actionWrap.actionInfo;

    var cptType = (actionInfo.update || 'update').split(':');
    var updateMethod = cptType.pop();
    cptType = cptType[0] != null && parseClassType(cptType[0]);

    this[IN_MAIN_PROCESS] = true;

    var payloads = [payload];
    var batched = false;
    // Batch action
    if (payload.batch) {
        batched = true;
        payloads = zrUtil.map(payload.batch, function (item) {
            item = zrUtil.defaults(zrUtil.extend({}, item), payload);
            item.batch = null;
            return item;
        });
    }

    var eventObjBatch = [];
    var eventObj;
    var isHighDown = payloadType === 'highlight' || payloadType === 'downplay';

    each(payloads, function (batchItem) {
        // Action can specify the event by return it.
        eventObj = actionWrap.action(batchItem, this._model, this._api);
        // Emit event outside
        eventObj = eventObj || zrUtil.extend({}, batchItem);
        // Convert type to eventType
        eventObj.type = actionInfo.event || eventObj.type;
        eventObjBatch.push(eventObj);

        // light update does not perform data process, layout and visual.
        if (isHighDown) {
            // method, payload, mainType, subType
            updateDirectly(this, updateMethod, batchItem, 'series');
        }
        else if (cptType) {
            updateDirectly(this, updateMethod, batchItem, cptType.main, cptType.sub);
        }
    }, this);

    if (updateMethod !== 'none' && !isHighDown && !cptType) {
        // Still dirty
        if (this[OPTION_UPDATED]) {
            // FIXME Pass payload ?
            prepare(this);
            updateMethods.update.call(this, payload);
            this[OPTION_UPDATED] = false;
        }
        else {
            updateMethods[updateMethod].call(this, payload);
        }
    }

    // Follow the rule of action batch
    if (batched) {
        eventObj = {
            type: actionInfo.event || payloadType,
            escapeConnect: escapeConnect,
            batch: eventObjBatch
        };
    }
    else {
        eventObj = eventObjBatch[0];
    }

    this[IN_MAIN_PROCESS] = false;

    !silent && this._messageCenter.trigger(eventObj.type, eventObj);
}

function flushPendingActions(silent) {
    var pendingActions = this._pendingActions;
    while (pendingActions.length) {
        var payload = pendingActions.shift();
        doDispatchAction.call(this, payload, silent);
    }
}

function triggerUpdatedEvent(silent) {
    !silent && this.trigger('updated');
}

/**
 * Event `rendered` is triggered when zr
 * rendered. It is useful for realtime
 * snapshot (reflect animation).
 *
 * Event `finished` is triggered when:
 * (1) zrender rendering finished.
 * (2) initial animation finished.
 * (3) progressive rendering finished.
 * (4) no pending action.
 * (5) no delayed setOption needs to be processed.
 */
function bindRenderedEvent(zr, ecIns) {
    zr.on('rendered', function () {

        ecIns.trigger('rendered');

        // The `finished` event should not be triggered repeatly,
        // so it should only be triggered when rendering indeed happend
        // in zrender. (Consider the case that dipatchAction is keep
        // triggering when mouse move).
        if (
            // Although zr is dirty if initial animation is not finished
            // and this checking is called on frame, we also check
            // animation finished for robustness.
            zr.animation.isFinished()
            && !ecIns[OPTION_UPDATED]
            && !ecIns._scheduler.unfinished
            && !ecIns._pendingActions.length
        ) {
            ecIns.trigger('finished');
        }
    });
}

/**
 * @param {Object} params
 * @param {number} params.seriesIndex
 * @param {Array|TypedArray} params.data
 */
echartsProto.appendData = function (params) {
    if (this._disposed) {
        disposedWarning(this.id);
        return;
    }

    var seriesIndex = params.seriesIndex;
    var ecModel = this.getModel();
    var seriesModel = ecModel.getSeriesByIndex(seriesIndex);

    if (__DEV__) {
        assert(params.data && seriesModel);
    }

    seriesModel.appendData(params);

    // Note: `appendData` does not support that update extent of coordinate
    // system, util some scenario require that. In the expected usage of
    // `appendData`, the initial extent of coordinate system should better
    // be fixed by axis `min`/`max` setting or initial data, otherwise if
    // the extent changed while `appendData`, the location of the painted
    // graphic elements have to be changed, which make the usage of
    // `appendData` meaningless.

    this._scheduler.unfinished = true;
};

/**
 * Register event
 * @method
 */
echartsProto.on = createRegisterEventWithLowercaseName('on', false);
echartsProto.off = createRegisterEventWithLowercaseName('off', false);
echartsProto.one = createRegisterEventWithLowercaseName('one', false);

/**
 * Prepare view instances of charts and components
 * @param  {module:echarts/model/Global} ecModel
 * @private
 */
function prepareView(ecIns, type, ecModel, scheduler) {
    var isComponent = type === 'component';
    var viewList = isComponent ? ecIns._componentsViews : ecIns._chartsViews;
    var viewMap = isComponent ? ecIns._componentsMap : ecIns._chartsMap;
    var zr = ecIns._zr;
    var api = ecIns._api;

    for (var i = 0; i < viewList.length; i++) {
        viewList[i].__alive = false;
    }

    isComponent
        ? ecModel.eachComponent(function (componentType, model) {
            componentType !== 'series' && doPrepare(model);
        })
        : ecModel.eachSeries(doPrepare);

    function doPrepare(model) {
        // Consider: id same and type changed.
        var viewId = '_ec_' + model.id + '_' + model.type;
        var view = viewMap[viewId];
        if (!view) {
            var classType = parseClassType(model.type);
            var Clazz = isComponent
                ? ComponentView.getClass(classType.main, classType.sub)
                : ChartView.getClass(classType.sub);

            if (__DEV__) {
                assert(Clazz, classType.sub + ' does not exist.');
            }

            view = new Clazz();
            view.init(ecModel, api);
            viewMap[viewId] = view;
            viewList.push(view);
            zr.add(view.group);
        }

        model.__viewId = view.__id = viewId;
        view.__alive = true;
        view.__model = model;
        view.group.__ecComponentInfo = {
            mainType: model.mainType,
            index: model.componentIndex
        };
        !isComponent && scheduler.prepareView(view, model, ecModel, api);
    }

    for (var i = 0; i < viewList.length;) {
        var view = viewList[i];
        if (!view.__alive) {
            !isComponent && view.renderTask.dispose();
            zr.remove(view.group);
            view.dispose(ecModel, api);
            viewList.splice(i, 1);
            delete viewMap[view.__id];
            view.__id = view.group.__ecComponentInfo = null;
        }
        else {
            i++;
        }
    }
}

// /**
//  * Encode visual infomation from data after data processing
//  *
//  * @param {module:echarts/model/Global} ecModel
//  * @param {object} layout
//  * @param {boolean} [layoutFilter] `true`: only layout,
//  *                                 `false`: only not layout,
//  *                                 `null`/`undefined`: all.
//  * @param {string} taskBaseTag
//  * @private
//  */
// function startVisualEncoding(ecIns, ecModel, api, payload, layoutFilter) {
//     each(visualFuncs, function (visual, index) {
//         var isLayout = visual.isLayout;
//         if (layoutFilter == null
//             || (layoutFilter === false && !isLayout)
//             || (layoutFilter === true && isLayout)
//         ) {
//             visual.func(ecModel, api, payload);
//         }
//     });
// }

function clearColorPalette(ecModel) {
    ecModel.clearColorPalette();
    ecModel.eachSeries(function (seriesModel) {
        seriesModel.clearColorPalette();
    });
}

function render(ecIns, ecModel, api, payload) {

    renderComponents(ecIns, ecModel, api, payload);

    each(ecIns._chartsViews, function (chart) {
        chart.__alive = false;
    });

    renderSeries(ecIns, ecModel, api, payload);

    // Remove groups of unrendered charts
    each(ecIns._chartsViews, function (chart) {
        if (!chart.__alive) {
            chart.remove(ecModel, api);
        }
    });
}

function renderComponents(ecIns, ecModel, api, payload, dirtyList) {
    each(dirtyList || ecIns._componentsViews, function (componentView) {
        var componentModel = componentView.__model;
        componentView.render(componentModel, ecModel, api, payload);

        updateZ(componentModel, componentView);
    });
}

/**
 * Render each chart and component
 * @private
 */
function renderSeries(ecIns, ecModel, api, payload, dirtyMap) {
    // Render all charts
    var scheduler = ecIns._scheduler;
    var unfinished;
    ecModel.eachSeries(function (seriesModel) {
        var chartView = ecIns._chartsMap[seriesModel.__viewId];
        chartView.__alive = true;

        var renderTask = chartView.renderTask;
        scheduler.updatePayload(renderTask, payload);

        if (dirtyMap && dirtyMap.get(seriesModel.uid)) {
            renderTask.dirty();
        }

        unfinished |= renderTask.perform(scheduler.getPerformArgs(renderTask));

        chartView.group.silent = !!seriesModel.get('silent');

        updateZ(seriesModel, chartView);

        updateBlend(seriesModel, chartView);
    });
    scheduler.unfinished |= unfinished;

    // If use hover layer
    updateHoverLayerStatus(ecIns, ecModel);

    // Add aria
    aria(ecIns._zr.dom, ecModel);
}

function performPostUpdateFuncs(ecModel, api) {
    each(postUpdateFuncs, function (func) {
        func(ecModel, api);
    });
}


var MOUSE_EVENT_NAMES = [
    'click', 'dblclick', 'mouseover', 'mouseout', 'mousemove',
    'mousedown', 'mouseup', 'globalout', 'contextmenu'
];

/**
 * @private
 */
echartsProto._initEvents = function () {
    each(MOUSE_EVENT_NAMES, function (eveName) {
        var handler = function (e) {
            var ecModel = this.getModel();
            var el = e.target;
            var params;
            var isGlobalOut = eveName === 'globalout';

            // no e.target when 'globalout'.
            if (isGlobalOut) {
                params = {};
            }
            else if (el && el.dataIndex != null) {
                var dataModel = el.dataModel || ecModel.getSeriesByIndex(el.seriesIndex);
                params = dataModel && dataModel.getDataParams(el.dataIndex, el.dataType, el) || {};
            }
            // If element has custom eventData of components
            else if (el && el.eventData) {
                params = zrUtil.extend({}, el.eventData);
            }

            // Contract: if params prepared in mouse event,
            // these properties must be specified:
            // {
            //    componentType: string (component main type)
            //    componentIndex: number
            // }
            // Otherwise event query can not work.

            if (params) {
                var componentType = params.componentType;
                var componentIndex = params.componentIndex;
                // Special handling for historic reason: when trigger by
                // markLine/markPoint/markArea, the componentType is
                // 'markLine'/'markPoint'/'markArea', but we should better
                // enable them to be queried by seriesIndex, since their
                // option is set in each series.
                if (componentType === 'markLine'
                    || componentType === 'markPoint'
                    || componentType === 'markArea'
                ) {
                    componentType = 'series';
                    componentIndex = params.seriesIndex;
                }
                var model = componentType && componentIndex != null
                    && ecModel.getComponent(componentType, componentIndex);
                var view = model && this[
                    model.mainType === 'series' ? '_chartsMap' : '_componentsMap'
                ][model.__viewId];

                if (__DEV__) {
                    // `event.componentType` and `event[componentTpype + 'Index']` must not
                    // be missed, otherwise there is no way to distinguish source component.
                    // See `dataFormat.getDataParams`.
                    if (!isGlobalOut && !(model && view)) {
                        console.warn('model or view can not be found by params');
                    }
                }

                params.event = e;
                params.type = eveName;

                this._ecEventProcessor.eventInfo = {
                    targetEl: el,
                    packedEvent: params,
                    model: model,
                    view: view
                };

                this.trigger(eveName, params);
            }
        };
        // Consider that some component (like tooltip, brush, ...)
        // register zr event handler, but user event handler might
        // do anything, such as call `setOption` or `dispatchAction`,
        // which probably update any of the content and probably
        // cause problem if it is called previous other inner handlers.
        handler.zrEventfulCallAtLast = true;
        this._zr.on(eveName, handler, this);
    }, this);

    each(eventActionMap, function (actionType, eventType) {
        this._messageCenter.on(eventType, function (event) {
            this.trigger(eventType, event);
        }, this);
    }, this);
};

/**
 * @return {boolean}
 */
echartsProto.isDisposed = function () {
    return this._disposed;
};

/**
 * Clear
 */
echartsProto.clear = function () {
    if (this._disposed) {
        disposedWarning(this.id);
        return;
    }
    this.setOption({ series: [] }, true);
};

/**
 * Dispose instance
 */
echartsProto.dispose = function () {
    if (this._disposed) {
        disposedWarning(this.id);
        return;
    }
    this._disposed = true;

    modelUtil.setAttribute(this.getDom(), DOM_ATTRIBUTE_KEY, '');

    var api = this._api;
    var ecModel = this._model;

    each(this._componentsViews, function (component) {
        component.dispose(ecModel, api);
    });
    each(this._chartsViews, function (chart) {
        chart.dispose(ecModel, api);
    });

    // Dispose after all views disposed
    this._zr.dispose();

    delete instances[this.id];
};

zrUtil.mixin(ECharts, Eventful);

function disposedWarning(id) {
    if (__DEV__) {
        console.warn('Instance ' + id + ' has been disposed');
    }
}

function updateHoverLayerStatus(ecIns, ecModel) {
    var zr = ecIns._zr;
    var storage = zr.storage;
    var elCount = 0;

    storage.traverse(function (el) {
        elCount++;
    });

    if (elCount > ecModel.get('hoverLayerThreshold') && !env.node && !env.worker) {
        ecModel.eachSeries(function (seriesModel) {
            if (seriesModel.preventUsingHoverLayer) {
                return;
            }
            var chartView = ecIns._chartsMap[seriesModel.__viewId];
            if (chartView.__alive) {
                chartView.group.traverse(function (el) {
                    // Don't switch back.
                    el.useHoverLayer = true;
                });
            }
        });
    }
}

/**
 * Update chart progressive and blend.
 * @param {module:echarts/model/Series|module:echarts/model/Component} model
 * @param {module:echarts/view/Component|module:echarts/view/Chart} view
 */
function updateBlend(seriesModel, chartView) {
    var blendMode = seriesModel.get('blendMode') || null;
    if (__DEV__) {
        if (!env.canvasSupported && blendMode && blendMode !== 'source-over') {
            console.warn('Only canvas support blendMode');
        }
    }
    chartView.group.traverse(function (el) {
        // FIXME marker and other components
        if (!el.isGroup) {
            // Only set if blendMode is changed. In case element is incremental and don't wan't to rerender.
            if (el.style.blend !== blendMode) {
                el.setStyle('blend', blendMode);
            }
        }
        if (el.eachPendingDisplayable) {
            el.eachPendingDisplayable(function (displayable) {
                displayable.setStyle('blend', blendMode);
            });
        }
    });
}

/**
 * @param {module:echarts/model/Series|module:echarts/model/Component} model
 * @param {module:echarts/view/Component|module:echarts/view/Chart} view
 */
function updateZ(model, view) {
    var z = model.get('z');
    var zlevel = model.get('zlevel');
    // Set z and zlevel
    view.group.traverse(function (el) {
        if (el.type !== 'group') {
            var elZ = z;
            if (isFunction(z)) {
                var dataModel = el.dataModel || model.ecModel.getSeriesByIndex(el.seriesIndex);
                var params = dataModel && dataModel.getDataParams(el.dataIndex, el.dataType, el) || {};
                elZ = z(params);
            }
            elZ != null && (el.z = elZ);
            zlevel != null && (el.zlevel = zlevel);
        }
    });
}

function createExtensionAPI(ecInstance) {
    var coordSysMgr = ecInstance._coordSysMgr;
    return zrUtil.extend(new ExtensionAPI(ecInstance), {
        // Inject methods
        getCoordinateSystems: zrUtil.bind(
            coordSysMgr.getCoordinateSystems, coordSysMgr
        ),
        getComponentByElement: function (el) {
            while (el) {
                var modelInfo = el.__ecComponentInfo;
                if (modelInfo != null) {
                    return ecInstance._model.getComponent(modelInfo.mainType, modelInfo.index);
                }
                el = el.parent;
            }
        }
    });
}


/**
 * @class
 * Usage of query:
 * `chart.on('click', query, handler);`
 * The `query` can be:
 * + The component type query string, only `mainType` or `mainType.subType`,
 *   like: 'xAxis', 'series', 'xAxis.category' or 'series.line'.
 * + The component query object, like:
 *   `{seriesIndex: 2}`, `{seriesName: 'xx'}`, `{seriesId: 'some'}`,
 *   `{xAxisIndex: 2}`, `{xAxisName: 'xx'}`, `{xAxisId: 'some'}`.
 * + The data query object, like:
 *   `{dataIndex: 123}`, `{dataType: 'link'}`, `{name: 'some'}`.
 * + The other query object (cmponent customized query), like:
 *   `{element: 'some'}` (only available in custom series).
 *
 * Caveat: If a prop in the `query` object is `null/undefined`, it is the
 * same as there is no such prop in the `query` object.
 */
function EventProcessor() {
    // These info required: targetEl, packedEvent, model, view
    this.eventInfo;
}
EventProcessor.prototype = {
    constructor: EventProcessor,

    normalizeQuery: function (query) {
        var cptQuery = {};
        var dataQuery = {};
        var otherQuery = {};

        // `query` is `mainType` or `mainType.subType` of component.
        if (zrUtil.isString(query)) {
            var condCptType = parseClassType(query);
            // `.main` and `.sub` may be ''.
            cptQuery.mainType = condCptType.main || null;
            cptQuery.subType = condCptType.sub || null;
        }
        // `query` is an object, convert to {mainType, index, name, id}.
        else {
            // `xxxIndex`, `xxxName`, `xxxId`, `name`, `dataIndex`, `dataType` is reserved,
            // can not be used in `compomentModel.filterForExposedEvent`.
            var suffixes = ['Index', 'Name', 'Id'];
            var dataKeys = {name: 1, dataIndex: 1, dataType: 1};
            zrUtil.each(query, function (val, key) {
                var reserved = false;
                for (var i = 0; i < suffixes.length; i++) {
                    var propSuffix = suffixes[i];
                    var suffixPos = key.lastIndexOf(propSuffix);
                    if (suffixPos > 0 && suffixPos === key.length - propSuffix.length) {
                        var mainType = key.slice(0, suffixPos);
                        // Consider `dataIndex`.
                        if (mainType !== 'data') {
                            cptQuery.mainType = mainType;
                            cptQuery[propSuffix.toLowerCase()] = val;
                            reserved = true;
                        }
                    }
                }
                if (dataKeys.hasOwnProperty(key)) {
                    dataQuery[key] = val;
                    reserved = true;
                }
                if (!reserved) {
                    otherQuery[key] = val;
                }
            });
        }

        return {
            cptQuery: cptQuery,
            dataQuery: dataQuery,
            otherQuery: otherQuery
        };
    },

    filter: function (eventType, query, args) {
        // They should be assigned before each trigger call.
        var eventInfo = this.eventInfo;

        if (!eventInfo) {
            return true;
        }

        var targetEl = eventInfo.targetEl;
        var packedEvent = eventInfo.packedEvent;
        var model = eventInfo.model;
        var view = eventInfo.view;

        // For event like 'globalout'.
        if (!model || !view) {
            return true;
        }

        var cptQuery = query.cptQuery;
        var dataQuery = query.dataQuery;

        return check(cptQuery, model, 'mainType')
            && check(cptQuery, model, 'subType')
            && check(cptQuery, model, 'index', 'componentIndex')
            && check(cptQuery, model, 'name')
            && check(cptQuery, model, 'id')
            && check(dataQuery, packedEvent, 'name')
            && check(dataQuery, packedEvent, 'dataIndex')
            && check(dataQuery, packedEvent, 'dataType')
            && (!view.filterForExposedEvent || view.filterForExposedEvent(
                eventType, query.otherQuery, targetEl, packedEvent
            ));

        function check(query, host, prop, propOnHost) {
            return query[prop] == null || host[propOnHost || prop] === query[prop];
        }
    },

    afterTrigger: function () {
        // Make sure the eventInfo wont be used in next trigger.
        this.eventInfo = null;
    }
};


/**
 * @type {Object} key: actionType.
 * @inner
 */
var actions = {};

/**
 * Map eventType to actionType
 * @type {Object}
 */
var eventActionMap = {};

/**
 * Data processor functions of each stage
 * @type {Array.<Object.<string, Function>>}
 * @inner
 */
var dataProcessorFuncs = [];

/**
 * @type {Array.<Function>}
 * @inner
 */
var optionPreprocessorFuncs = [];

/**
 * @type {Array.<Function>}
 * @inner
 */
var postUpdateFuncs = [];

/**
 * Visual encoding functions of each stage
 * @type {Array.<Object.<string, Function>>}
 */
var visualFuncs = [];

/**
 * Theme storage
 * @type {Object.<key, Object>}
 */
var themeStorage = {};
/**
 * Loading effects
 */
var loadingEffects = {};

var instances = {};
var connectedGroups = {};

var idBase = new Date() - 0;
var groupIdBase = new Date() - 0;
var DOM_ATTRIBUTE_KEY = '_echarts_instance_';

function enableConnect(chart) {
    var STATUS_PENDING = 0;
    var STATUS_UPDATING = 1;
    var STATUS_UPDATED = 2;
    var STATUS_KEY = '__connectUpdateStatus';

    function updateConnectedChartsStatus(charts, status) {
        for (var i = 0; i < charts.length; i++) {
            var otherChart = charts[i];
            otherChart[STATUS_KEY] = status;
        }
    }

    each(eventActionMap, function (actionType, eventType) {
        chart._messageCenter.on(eventType, function (event) {
            if (connectedGroups[chart.group] && chart[STATUS_KEY] !== STATUS_PENDING) {
                if (event && event.escapeConnect) {
                    return;
                }

                var action = chart.makeActionFromEvent(event);
                var otherCharts = [];

                each(instances, function (otherChart) {
                    if (otherChart !== chart && otherChart.group === chart.group) {
                        otherCharts.push(otherChart);
                    }
                });

                updateConnectedChartsStatus(otherCharts, STATUS_PENDING);
                each(otherCharts, function (otherChart) {
                    if (otherChart[STATUS_KEY] !== STATUS_UPDATING) {
                        otherChart.dispatchAction(action);
                    }
                });
                updateConnectedChartsStatus(otherCharts, STATUS_UPDATED);
            }
        });
    });
}

/**
 * @param {HTMLElement} dom
 * @param {Object} [theme]
 * @param {Object} opts
 * @param {number} [opts.devicePixelRatio] Use window.devicePixelRatio by default
 * @param {string} [opts.renderer] Can choose 'canvas' or 'svg' to render the chart.
 * @param {number} [opts.width] Use clientWidth of the input `dom` by default.
 *                              Can be 'auto' (the same as null/undefined)
 * @param {number} [opts.height] Use clientHeight of the input `dom` by default.
 *                               Can be 'auto' (the same as null/undefined)
 */
export function init(dom, theme, opts) {
    if (__DEV__) {
        // Check version
        if ((zrender.version.replace('.', '') - 0) < (dependencies.zrender.replace('.', '') - 0)) {
            throw new Error(
                'zrender/src ' + zrender.version
                + ' is too old for ECharts ' + version
                + '. Current version need ZRender '
                + dependencies.zrender + '+'
            );
        }

        if (!dom) {
            throw new Error('Initialize failed: invalid dom.');
        }
    }

    var existInstance = getInstanceByDom(dom);
    if (existInstance) {
        if (__DEV__) {
            console.warn('There is a chart instance already initialized on the dom.');
        }
        return existInstance;
    }

    if (__DEV__) {
        if (zrUtil.isDom(dom)
            && dom.nodeName.toUpperCase() !== 'CANVAS'
            && (
                (!dom.clientWidth && (!opts || opts.width == null))
                || (!dom.clientHeight && (!opts || opts.height == null))
            )
        ) {
            console.warn('Can\'t get DOM width or height. Please check '
            + 'dom.clientWidth and dom.clientHeight. They should not be 0.'
            + 'For example, you may need to call this in the callback '
            + 'of window.onload.');
        }
    }

    var chart = new ECharts(dom, theme, opts);
    chart.id = 'ec_' + idBase++;
    instances[chart.id] = chart;

    modelUtil.setAttribute(dom, DOM_ATTRIBUTE_KEY, chart.id);

    enableConnect(chart);

    return chart;
}

/**
 * @return {string|Array.<module:echarts~ECharts>} groupId
 */
export function connect(groupId) {
    // Is array of charts
    if (zrUtil.isArray(groupId)) {
        var charts = groupId;
        groupId = null;
        // If any chart has group
        each(charts, function (chart) {
            if (chart.group != null) {
                groupId = chart.group;
            }
        });
        groupId = groupId || ('g_' + groupIdBase++);
        each(charts, function (chart) {
            chart.group = groupId;
        });
    }
    connectedGroups[groupId] = true;
    return groupId;
}

/**
 * @DEPRECATED
 * @return {string} groupId
 */
export function disConnect(groupId) {
    connectedGroups[groupId] = false;
}

/**
 * @return {string} groupId
 */
export var disconnect = disConnect;

/**
 * Dispose a chart instance
 * @param  {module:echarts~ECharts|HTMLDomElement|string} chart
 */
export function dispose(chart) {
    if (typeof chart === 'string') {
        chart = instances[chart];
    }
    else if (!(chart instanceof ECharts)) {
        // Try to treat as dom
        chart = getInstanceByDom(chart);
    }
    if ((chart instanceof ECharts) && !chart.isDisposed()) {
        chart.dispose();
    }
}

/**
 * @param  {HTMLElement} dom
 * @return {echarts~ECharts}
 */
export function getInstanceByDom(dom) {
    return instances[modelUtil.getAttribute(dom, DOM_ATTRIBUTE_KEY)];
}

/**
 * @param {string} key
 * @return {echarts~ECharts}
 */
export function getInstanceById(key) {
    return instances[key];
}

/**
 * Register theme
 */
export function registerTheme(name, theme) {
    themeStorage[name] = theme;
}

/**
 * Register option preprocessor
 * @param {Function} preprocessorFunc
 */
export function registerPreprocessor(preprocessorFunc) {
    optionPreprocessorFuncs.push(preprocessorFunc);
}

/**
 * @param {number} [priority=1000]
 * @param {Object|Function} processor
 */
export function registerProcessor(priority, processor) {
    normalizeRegister(dataProcessorFuncs, priority, processor, PRIORITY_PROCESSOR_FILTER);
}

/**
 * Register postUpdater
 * @param {Function} postUpdateFunc
 */
export function registerPostUpdate(postUpdateFunc) {
    postUpdateFuncs.push(postUpdateFunc);
}

/**
 * Usage:
 * registerAction('someAction', 'someEvent', function () { ... });
 * registerAction('someAction', function () { ... });
 * registerAction(
 *     {type: 'someAction', event: 'someEvent', update: 'updateView'},
 *     function () { ... }
 * );
 *
 * @param {(string|Object)} actionInfo
 * @param {string} actionInfo.type
 * @param {string} [actionInfo.event]
 * @param {string} [actionInfo.update]
 * @param {string} [eventName]
 * @param {Function} action
 */
export function registerAction(actionInfo, eventName, action) {
    if (typeof eventName === 'function') {
        action = eventName;
        eventName = '';
    }
    var actionType = isObject(actionInfo)
        ? actionInfo.type
        : ([actionInfo, actionInfo = {
            event: eventName
        }][0]);

    // Event name is all lowercase
    actionInfo.event = (actionInfo.event || actionType).toLowerCase();
    eventName = actionInfo.event;

    // Validate action type and event name.
    assert(ACTION_REG.test(actionType) && ACTION_REG.test(eventName));

    if (!actions[actionType]) {
        actions[actionType] = {action: action, actionInfo: actionInfo};
    }
    eventActionMap[eventName] = actionType;
}

/**
 * @param {string} type
 * @param {*} CoordinateSystem
 */
export function registerCoordinateSystem(type, CoordinateSystem) {
    CoordinateSystemManager.register(type, CoordinateSystem);
}

/**
 * Get dimensions of specified coordinate system.
 * @param {string} type
 * @return {Array.<string|Object>}
 */
export function getCoordinateSystemDimensions(type) {
    var coordSysCreator = CoordinateSystemManager.get(type);
    if (coordSysCreator) {
        return coordSysCreator.getDimensionsInfo
                ? coordSysCreator.getDimensionsInfo()
                : coordSysCreator.dimensions.slice();
    }
}

/**
 * Layout is a special stage of visual encoding
 * Most visual encoding like color are common for different chart
 * But each chart has it's own layout algorithm
 *
 * @param {number} [priority=1000]
 * @param {Function} layoutTask
 */
export function registerLayout(priority, layoutTask) {
    normalizeRegister(visualFuncs, priority, layoutTask, PRIORITY_VISUAL_LAYOUT, 'layout');
}

/**
 * @param {number} [priority=3000]
 * @param {module:echarts/stream/Task} visualTask
 */
export function registerVisual(priority, visualTask) {
    normalizeRegister(visualFuncs, priority, visualTask, PRIORITY_VISUAL_CHART, 'visual');
}

/**
 * @param {Object|Function} fn: {seriesType, createOnAllSeries, performRawSeries, reset}
 */
function normalizeRegister(targetList, priority, fn, defaultPriority, visualType) {
    if (isFunction(priority) || isObject(priority)) {
        fn = priority;
        priority = defaultPriority;
    }

    if (__DEV__) {
        if (isNaN(priority) || priority == null) {
            throw new Error('Illegal priority');
        }
        // Check duplicate
        each(targetList, function (wrap) {
            assert(wrap.__raw !== fn);
        });
    }

    var stageHandler = Scheduler.wrapStageHandler(fn, visualType);

    stageHandler.__prio = priority;
    stageHandler.__raw = fn;
    targetList.push(stageHandler);

    return stageHandler;
}

/**
 * @param {string} name
 */
export function registerLoading(name, loadingFx) {
    loadingEffects[name] = loadingFx;
}

/**
 * @param {Object} opts
 * @param {string} [superClass]
 */
export function extendComponentModel(opts/*, superClass*/) {
    // var Clazz = ComponentModel;
    // if (superClass) {
    //     var classType = parseClassType(superClass);
    //     Clazz = ComponentModel.getClass(classType.main, classType.sub, true);
    // }
    return ComponentModel.extend(opts);
}

/**
 * @param {Object} opts
 * @param {string} [superClass]
 */
export function extendComponentView(opts/*, superClass*/) {
    // var Clazz = ComponentView;
    // if (superClass) {
    //     var classType = parseClassType(superClass);
    //     Clazz = ComponentView.getClass(classType.main, classType.sub, true);
    // }
    return ComponentView.extend(opts);
}

/**
 * @param {Object} opts
 * @param {string} [superClass]
 */
export function extendSeriesModel(opts/*, superClass*/) {
    // var Clazz = SeriesModel;
    // if (superClass) {
    //     superClass = 'series.' + superClass.replace('series.', '');
    //     var classType = parseClassType(superClass);
    //     Clazz = ComponentModel.getClass(classType.main, classType.sub, true);
    // }
    return SeriesModel.extend(opts);
}

/**
 * @param {Object} opts
 * @param {string} [superClass]
 */
export function extendChartView(opts/*, superClass*/) {
    // var Clazz = ChartView;
    // if (superClass) {
    //     superClass = superClass.replace('series.', '');
    //     var classType = parseClassType(superClass);
    //     Clazz = ChartView.getClass(classType.main, true);
    // }
    return ChartView.extend(opts);
}

/**
 * ZRender need a canvas context to do measureText.
 * But in node environment canvas may be created by node-canvas.
 * So we need to specify how to create a canvas instead of using document.createElement('canvas')
 *
 * Be careful of using it in the browser.
 *
 * @param {Function} creator
 * @example
 *     var Canvas = require('canvas');
 *     var echarts = require('echarts');
 *     echarts.setCanvasCreator(function () {
 *         // Small size is enough.
 *         return new Canvas(32, 32);
 *     });
 */
export function setCanvasCreator(creator) {
    zrUtil.$override('createCanvas', creator);
}

/**
 * @param {string} mapName
 * @param {Array.<Object>|Object|string} geoJson
 * @param {Object} [specialAreas]
 *
 * @example GeoJSON
 *     $.get('USA.json', function (geoJson) {
 *         echarts.registerMap('USA', geoJson);
 *         // Or
 *         echarts.registerMap('USA', {
 *             geoJson: geoJson,
 *             specialAreas: {}
 *         })
 *     });
 *
 *     $.get('airport.svg', function (svg) {
 *         echarts.registerMap('airport', {
 *             svg: svg
 *         }
 *     });
 *
 *     echarts.registerMap('eu', [
 *         {svg: eu-topographic.svg},
 *         {geoJSON: eu.json}
 *     ])
 */
export function registerMap(mapName, geoJson, specialAreas) {
    mapDataStorage.registerMap(mapName, geoJson, specialAreas);
}

/**
 * @param {string} mapName
 * @return {Object}
 */
export function getMap(mapName) {
    // For backward compatibility, only return the first one.
    var records = mapDataStorage.retrieveMap(mapName);
    return records && records[0] && {
        geoJson: records[0].geoJSON,
        specialAreas: records[0].specialAreas
    };
}

registerVisual(PRIORITY_VISUAL_GLOBAL, seriesColor);
registerPreprocessor(backwardCompat);
registerProcessor(PRIORITY_PROCESSOR_DATASTACK, dataStack);
registerLoading('default', loadingDefault);

// Default actions

registerAction({
    type: 'highlight',
    event: 'highlight',
    update: 'highlight'
}, zrUtil.noop);

registerAction({
    type: 'downplay',
    event: 'downplay',
    update: 'downplay'
}, zrUtil.noop);

// Default theme
registerTheme('light', lightTheme);
registerTheme('dark', darkTheme);

// For backward compatibility, where the namespace `dataTool` will
// be mounted on `echarts` is the extension `dataTool` is imported.
export var dataTool = {};
