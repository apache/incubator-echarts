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

import * as echarts from '../../echarts';
import * as zrUtil from 'zrender/src/core/util';
import env from 'zrender/src/core/env';
import TooltipContent from './TooltipContent';
import TooltipRichContent from './TooltipRichContent';
import * as formatUtil from '../../util/format';
import * as numberUtil from '../../util/number';
import * as graphic from '../../util/graphic';
import findPointFromSeries from '../axisPointer/findPointFromSeries';
import * as layoutUtil from '../../util/layout';
import Model from '../../model/Model';
import * as globalListener from '../axisPointer/globalListener';
import * as axisHelper from '../../coord/axisHelper';
import * as axisPointerViewHelper from '../axisPointer/viewHelper';
import { getTooltipRenderMode } from '../../util/model';

var bind = zrUtil.bind;
var each = zrUtil.each;
var parsePercent = numberUtil.parsePercent;

var proxyRect = new graphic.Rect({
    shape: {x: -1, y: -1, width: 2, height: 2}
});

export default echarts.extendComponentView({

    type: 'tooltip',

    init: function (ecModel, api) {
        if (env.node) {
            return;
        }

        var tooltipModel = ecModel.getComponent('tooltip');
        var renderMode = tooltipModel.get('renderMode');
        this._renderMode = getTooltipRenderMode(renderMode);

        var renderer = tooltipModel.get('renderer');
        var tooltipContent;
        if (renderer) {
            tooltipContent = new renderer({
                appendToBody: tooltipModel.get('appendToBody', true)
            });
            this._newLine = renderer.newLine;
        }
        else if (this._renderMode === 'html') {
            tooltipContent = new TooltipContent(api.getDom(), api, {
                appendToBody: tooltipModel.get('appendToBody', true)
            });
            this._newLine = '<br/>';
        }
        else {
            tooltipContent = new TooltipRichContent(api);
            this._newLine = '\n';
        }

        this._tooltipContent = tooltipContent;
    },

    render: function (tooltipModel, ecModel, api) {
        if (env.node) {
            return;
        }

        // Reset
        this.group.removeAll();

        /**
         * @private
         * @type {module:echarts/component/tooltip/TooltipModel}
         */
        this._tooltipModel = tooltipModel;

        /**
         * @private
         * @type {module:echarts/model/Global}
         */
        this._ecModel = ecModel;

        /**
         * @private
         * @type {module:echarts/ExtensionAPI}
         */
        this._api = api;

        /**
         * Should be cleaned when render.
         * @private
         * @type {Array.<Array.<Object>>}
         */
        this._lastDataByCoordSys = null;

        /**
         * @private
         * @type {boolean}
         */
        this._alwaysShowContent = tooltipModel.get('alwaysShowContent');

        var tooltipContent = this._tooltipContent;
        tooltipContent.update(tooltipModel);
        tooltipContent.setEnterable(tooltipModel.get('enterable'));

        this._initGlobalListener();

        this._keepShow();
    },

    _initGlobalListener: function () {
        var tooltipModel = this._tooltipModel;
        var triggerOn = tooltipModel.get('triggerOn');

        globalListener.register(
            'itemTooltip',
            this._api,
            bind(function (currTrigger, e, dispatchAction) {
                // If 'none', it is not controlled by mouse totally.
                if (triggerOn !== 'none') {
                    if (triggerOn.indexOf(currTrigger) >= 0) {
                        this._tryShow(e, dispatchAction);
                    }
                    else if (currTrigger === 'leave') {
                        this._hide(dispatchAction);
                    }
                }
            }, this)
        );
    },

    _keepShow: function () {
        var tooltipModel = this._tooltipModel;
        var ecModel = this._ecModel;
        var api = this._api;

        // Try to keep the tooltip show when refreshing
        if (this._lastX != null
            && this._lastY != null
            // When user is willing to control tooltip totally using API,
            // self.manuallyShowTip({x, y}) might cause tooltip hide,
            // which is not expected.
            && tooltipModel.get('triggerOn') !== 'none'
        ) {
            var self = this;
            clearTimeout(this._refreshUpdateTimeout);
            this._refreshUpdateTimeout = setTimeout(function () {
                // Show tip next tick after other charts are rendered
                // In case highlight action has wrong result
                // FIXME
                !api.isDisposed() && self.manuallyShowTip(tooltipModel, ecModel, api, {
                    x: self._lastX,
                    y: self._lastY
                });
            });
        }
    },

    /**
     * Show tip manually by
     * dispatchAction({
     *     type: 'showTip',
     *     x: 10,
     *     y: 10
     * });
     * Or
     * dispatchAction({
     *      type: 'showTip',
     *      seriesIndex: 0,
     *      dataIndex or dataIndexInside or name
     * });
     *
     *  TODO Batch
     */
    manuallyShowTip: function (tooltipModel, ecModel, api, payload) {
        if (payload.from === this.uid || env.node) {
            return;
        }

        var dispatchAction = makeDispatchAction(payload, api);

        // Reset ticket
        this._ticket = '';

        // When triggered from axisPointer.
        var dataByCoordSys = payload.dataByCoordSys;

        if (payload.tooltip && payload.x != null && payload.y != null) {
            var el = proxyRect;
            el.position = [payload.x, payload.y];
            el.update();
            el.tooltip = payload.tooltip;
            // Manually show tooltip while view is not using zrender elements.
            this._tryShow({
                offsetX: payload.x,
                offsetY: payload.y,
                target: el
            }, dispatchAction);
        }
        else if (dataByCoordSys) {
            this._tryShow({
                offsetX: payload.x,
                offsetY: payload.y,
                position: payload.position,
                dataByCoordSys: payload.dataByCoordSys,
                tooltipOption: payload.tooltipOption
            }, dispatchAction);
        }
        else if (payload.seriesIndex != null) {

            if (this._manuallyAxisShowTip(tooltipModel, ecModel, api, payload)) {
                return;
            }

            var pointInfo = findPointFromSeries(payload, ecModel);
            var cx = pointInfo.point[0];
            var cy = pointInfo.point[1];
            if (cx != null && cy != null) {
                this._tryShow({
                    offsetX: cx,
                    offsetY: cy,
                    position: payload.position,
                    target: pointInfo.el
                }, dispatchAction);
            }
        }
        else if (payload.x != null && payload.y != null) {
            // FIXME
            // should wrap dispatchAction like `axisPointer/globalListener` ?
            api.dispatchAction({
                type: 'updateAxisPointer',
                x: payload.x,
                y: payload.y
            });

            this._tryShow({
                offsetX: payload.x,
                offsetY: payload.y,
                position: payload.position,
                target: api.getZr().findHover(payload.x, payload.y).target
            }, dispatchAction);
        }
    },

    manuallyHideTip: function (tooltipModel, ecModel, api, payload) {
        var tooltipContent = this._tooltipContent;

        if (!this._alwaysShowContent && this._tooltipModel) {
            tooltipContent.hideLater(this._tooltipModel.get('hideDelay'));
        }

        this._lastX = this._lastY = null;

        if (payload.from !== this.uid) {
            this._hide(makeDispatchAction(payload, api));
        }
    },

    // Be compatible with previous design, that is, when tooltip.type is 'axis' and
    // dispatchAction 'showTip' with seriesIndex and dataIndex will trigger axis pointer
    // and tooltip.
    _manuallyAxisShowTip: function (tooltipModel, ecModel, api, payload) {
        var seriesIndex = payload.seriesIndex;
        var dataIndex = payload.dataIndex;
        var coordSysAxesInfo = ecModel.getComponent('axisPointer').coordSysAxesInfo;

        if (seriesIndex == null || dataIndex == null || coordSysAxesInfo == null) {
            return;
        }

        var seriesModel = ecModel.getSeriesByIndex(seriesIndex);
        if (!seriesModel) {
            return;
        }

        var data = seriesModel.getData();
        var tooltipModel = buildTooltipModel([
            data.getItemModel(dataIndex),
            seriesModel,
            (seriesModel.coordinateSystem || {}).model,
            tooltipModel
        ]);

        if (tooltipModel.get('trigger') !== 'axis') {
            return;
        }

        api.dispatchAction({
            type: 'updateAxisPointer',
            seriesIndex: seriesIndex,
            dataIndex: dataIndex,
            position: payload.position
        });

        return true;
    },

    _tryShow: function (e, dispatchAction) {
        var el = e.target;
        var tooltipModel = this._tooltipModel;

        if (!tooltipModel) {
            return;
        }

        // Save mouse x, mouse y. So we can try to keep showing the tip if chart is refreshed
        this._lastX = e.offsetX;
        this._lastY = e.offsetY;

        var dataByCoordSys = e.dataByCoordSys;
        if (dataByCoordSys && dataByCoordSys.length) {
            this._showAxisTooltip(dataByCoordSys, e);
        }
        // Always show item tooltip if mouse is on the element with dataIndex
        else if (el && el.dataIndex != null) {
            this._lastDataByCoordSys = null;
            this._showSeriesItemTooltip(e, el, dispatchAction);
        }
        // Tooltip provided directly. Like legend.
        else if (el && el.tooltip) {
            this._lastDataByCoordSys = null;
            this._showComponentItemTooltip(e, el, dispatchAction);
        }
        else {
            this._lastDataByCoordSys = null;
            this._hide(dispatchAction);
        }
    },

    _showOrMove: function (tooltipModel, cb) {
        // showDelay is used in this case: tooltip.enterable is set
        // as true. User intent to move mouse into tooltip and click
        // something. `showDelay` makes it easier to enter the content
        // but tooltip do not move immediately.
        var delay = tooltipModel.get('showDelay');
        cb = zrUtil.bind(cb, this);
        clearTimeout(this._showTimout);
        delay > 0
            ? (this._showTimout = setTimeout(cb, delay))
            : cb();
    },

    _showAxisTooltip: function (dataByCoordSys, e) {
        var ecModel = this._ecModel;
        var globalTooltipModel = this._tooltipModel;

        var point = [e.offsetX, e.offsetY];

        var singleDefaultHTML = [];
        var singleParamsList = [];
        var singleTooltipModel = buildTooltipModel([
            e.tooltipOption,
            globalTooltipModel
        ]);

        var renderMode = this._renderMode;
        var newLine = this._newLine;

        var markers = {};

        each(dataByCoordSys, function (itemCoordSys) {
            // var coordParamList = [];
            // var coordDefaultHTML = [];
            // var coordTooltipModel = buildTooltipModel([
            //     e.tooltipOption,
            //     itemCoordSys.tooltipOption,
            //     ecModel.getComponent(itemCoordSys.coordSysMainType, itemCoordSys.coordSysIndex),
            //     globalTooltipModel
            // ]);
            // var displayMode = coordTooltipModel.get('displayMode');
            // var paramsList = displayMode === 'single' ? singleParamsList : [];

            each(itemCoordSys.dataByAxis, function (item) {
                var axisModel = ecModel.getComponent(item.axisDim + 'Axis', item.axisIndex);
                var axisValue = item.value;
                var seriesDefaultHTML = [];

                if (!axisModel || axisValue == null) {
                    return;
                }

                var valueLabel = axisPointerViewHelper.getValueLabel(
                    axisValue, axisModel.axis, ecModel,
                    item.seriesDataIndices,
                    item.valueLabelOpt
                );

                zrUtil.each(item.seriesDataIndices, function (idxItem) {
                    var series = ecModel.getSeriesByIndex(idxItem.seriesIndex);
                    var dataIndex = idxItem.dataIndexInside;
                    var dataParams = series && series.getDataParams(dataIndex);
                    dataParams.axisDim = item.axisDim;
                    dataParams.axisIndex = item.axisIndex;
                    dataParams.axisType = item.axisType;
                    dataParams.axisId = item.axisId;
                    dataParams.axisValue = axisHelper.getAxisRawValue(axisModel.axis, axisValue);
                    dataParams.axisValueLabel = valueLabel;

                    if (dataParams) {
                        singleParamsList.push(dataParams);
                        var seriesTooltip = series.formatTooltip(dataIndex, true, null, renderMode);

                        var html;
                        if (zrUtil.isObject(seriesTooltip)) {
                            html = seriesTooltip.html;
                            var newMarkers = seriesTooltip.markers;
                            zrUtil.merge(markers, newMarkers);
                        }
                        else {
                            html = seriesTooltip;
                        }
                        seriesDefaultHTML.push(html);
                    }
                });

                // Default tooltip content
                // FIXME
                // (1) should be the first data which has name?
                // (2) themeRiver, firstDataIndex is array, and first line is unnecessary.
                var firstLine = valueLabel;
                if (renderMode !== 'html') {
                    singleDefaultHTML.push(seriesDefaultHTML.join(newLine));
                }
                else {
                    singleDefaultHTML.push(
                        (firstLine ? formatUtil.encodeHTML(firstLine) + newLine : '')
                        + seriesDefaultHTML.join(newLine)
                    );
                }
            });
        }, this);

        // In most case, the second axis is shown upper than the first one.
        singleDefaultHTML.reverse();
        singleDefaultHTML = singleDefaultHTML.join(this._newLine + this._newLine);

        var positionExpr = e.position;
        this._showOrMove(singleTooltipModel, function () {
            if (this._updateContentNotChangedOnAxis(dataByCoordSys)) {
                this._updatePosition(
                    singleTooltipModel,
                    positionExpr,
                    point[0], point[1],
                    this._tooltipContent,
                    singleParamsList
                );
            }
            else {
                this._showTooltipContent(
                    singleTooltipModel, singleDefaultHTML, singleParamsList, Math.random(),
                    point[0], point[1], positionExpr, undefined, markers
                );
            }
        });

        // Do not trigger events here, because this branch only be entered
        // from dispatchAction.
    },

    _showSeriesItemTooltip: function (e, el, dispatchAction) {
        var ecModel = this._ecModel;
        // Use dataModel in element if possible
        // Used when mouseover on a element like markPoint or edge
        // In which case, the data is not main data in series.
        var seriesIndex = el.seriesIndex;
        var seriesModel = ecModel.getSeriesByIndex(seriesIndex);

        // For example, graph link.
        var dataModel = el.dataModel || seriesModel;
        var dataIndex = el.dataIndex;
        var dataType = el.dataType;
        var data = dataModel.getData(dataType);

        var tooltipModel = buildTooltipModel([
            data.getItemModel(dataIndex),
            dataModel,
            seriesModel && (seriesModel.coordinateSystem || {}).model,
            this._tooltipModel
        ]);

        var tooltipTrigger = tooltipModel.get('trigger');
        if (tooltipTrigger != null && tooltipTrigger !== 'item') {
            return;
        }

        var params = dataModel.getDataParams(dataIndex, dataType);
        var seriesTooltip = dataModel.formatTooltip(dataIndex, false, dataType, this._renderMode);
        var defaultHtml;
        var markers;
        if (zrUtil.isObject(seriesTooltip)) {
            defaultHtml = seriesTooltip.html;
            markers = seriesTooltip.markers;
        }
        else {
            defaultHtml = seriesTooltip;
            markers = null;
        }

        var asyncTicket = 'item_' + dataModel.name + '_' + dataIndex;

        this._showOrMove(tooltipModel, function () {
            this._showTooltipContent(
                tooltipModel, defaultHtml, params, asyncTicket,
                e.offsetX, e.offsetY, e.position, e.target, markers
            );
        });

        // FIXME
        // duplicated showtip if manuallyShowTip is called from dispatchAction.
        dispatchAction({
            type: 'showTip',
            dataIndexInside: dataIndex,
            dataIndex: data.getRawIndex(dataIndex),
            seriesIndex: seriesIndex,
            from: this.uid
        });
    },

    _showComponentItemTooltip: function (e, el, dispatchAction) {
        var tooltipOpt = el.tooltip;
        if (typeof tooltipOpt === 'string') {
            var content = tooltipOpt;
            tooltipOpt = {
                content: content,
                // Fixed formatter
                formatter: content
            };
        }
        var subTooltipModel = new Model(tooltipOpt, this._tooltipModel, this._ecModel);
        var defaultHtml = subTooltipModel.get('content');
        var asyncTicket = Math.random();

        // Do not check whether `trigger` is 'none' here, because `trigger`
        // only works on coordinate system. In fact, we have not found case
        // that requires setting `trigger` nothing on component yet.

        this._showOrMove(subTooltipModel, function () {
            this._showTooltipContent(
                subTooltipModel, defaultHtml, subTooltipModel.get('formatterParams') || {},
                asyncTicket, e.offsetX, e.offsetY, e.position, el
            );
        });

        // If not dispatch showTip, tip may be hide triggered by axis.
        dispatchAction({
            type: 'showTip',
            from: this.uid
        });
    },

    _showTooltipContent: function (
        tooltipModel, defaultHtml, params, asyncTicket, x, y, positionExpr, el, markers
    ) {
        // Reset ticket
        this._ticket = '';

        if (!tooltipModel.get('showContent') || !tooltipModel.get('show')) {
            return;
        }

        var tooltipContent = this._tooltipContent;

        var formatter = tooltipModel.get('formatter');
        positionExpr = positionExpr || tooltipModel.get('position');
        var html = defaultHtml;

        if (formatter && typeof formatter === 'string') {
            html = formatUtil.formatTpl(formatter, params, true);
        }
        else if (typeof formatter === 'function') {
            var callback = bind(function (cbTicket, html) {
                if (cbTicket === this._ticket) {
                    tooltipContent.setContent(html, markers, tooltipModel);
                    this._updatePosition(
                        tooltipModel, positionExpr, x, y, tooltipContent, params, el
                    );
                }
            }, this);
            this._ticket = asyncTicket;
            html = formatter(params, asyncTicket, callback);
        }

        tooltipContent.setContent(html, markers, tooltipModel);
        tooltipContent.show(tooltipModel);

        this._updatePosition(
            tooltipModel, positionExpr, x, y, tooltipContent, params, el
        );
    },

    /**
     * @param  {string|Function|Array.<number>|Object} positionExpr
     * @param  {number} x Mouse x
     * @param  {number} y Mouse y
     * @param  {boolean} confine Whether confine tooltip content in view rect.
     * @param  {Object|<Array.<Object>} params
     * @param  {module:zrender/Element} el target element
     * @param  {module:echarts/ExtensionAPI} api
     * @return {Array.<number>}
     */
    _updatePosition: function (tooltipModel, positionExpr, x, y, content, params, el) {
        var viewWidth = this._api.getWidth();
        var viewHeight = this._api.getHeight();

        positionExpr = positionExpr || tooltipModel.get('position');

        var contentSize = content.getSize();
        var align = tooltipModel.get('align');
        var vAlign = tooltipModel.get('verticalAlign');
        var rect = el && el.getBoundingRect().clone();
        el && rect.applyTransform(el.transform);

        if (typeof positionExpr === 'function') {
            // Callback of position can be an array or a string specify the position
            positionExpr = positionExpr([x, y], params, content.el, rect, {
                viewSize: [viewWidth, viewHeight],
                contentSize: contentSize.slice()
            });
        }

        if (zrUtil.isArray(positionExpr)) {
            x = parsePercent(positionExpr[0], viewWidth);
            y = parsePercent(positionExpr[1], viewHeight);
        }
        else if (zrUtil.isObject(positionExpr)) {
            positionExpr.width = contentSize[0];
            positionExpr.height = contentSize[1];
            var layoutRect = layoutUtil.getLayoutRect(
                positionExpr, {width: viewWidth, height: viewHeight}
            );
            x = layoutRect.x;
            y = layoutRect.y;
            align = null;
            // When positionExpr is left/top/right/bottom,
            // align and verticalAlign will not work.
            vAlign = null;
        }
        // Specify tooltip position by string 'top' 'bottom' 'left' 'right' around graphic element
        else if (typeof positionExpr === 'string' && el) {
            var pos = calcTooltipPosition(
                positionExpr, rect, contentSize
            );
            x = pos[0];
            y = pos[1];
        }
        else {
            var pos = refixTooltipPosition(
                x, y, content, viewWidth, viewHeight, align ? null : 20, vAlign ? null : 20
            );
            x = pos[0];
            y = pos[1];
        }

        align && (x -= isCenterAlign(align) ? contentSize[0] / 2 : align === 'right' ? contentSize[0] : 0);
        vAlign && (y -= isCenterAlign(vAlign) ? contentSize[1] / 2 : vAlign === 'bottom' ? contentSize[1] : 0);

        if (tooltipModel.get('confine')) {
            var pos = confineTooltipPosition(
                x, y, content, viewWidth, viewHeight
            );
            x = pos[0];
            y = pos[1];
        }

        content.moveTo(x, y);
    },

    // FIXME
    // Should we remove this but leave this to user?
    _updateContentNotChangedOnAxis: function (dataByCoordSys) {
        var lastCoordSys = this._lastDataByCoordSys;
        var contentNotChanged = !!lastCoordSys
            && lastCoordSys.length === dataByCoordSys.length;

        contentNotChanged && each(lastCoordSys, function (lastItemCoordSys, indexCoordSys) {
            var lastDataByAxis = lastItemCoordSys.dataByAxis || {};
            var thisItemCoordSys = dataByCoordSys[indexCoordSys] || {};
            var thisDataByAxis = thisItemCoordSys.dataByAxis || [];
            contentNotChanged &= lastDataByAxis.length === thisDataByAxis.length;

            contentNotChanged && each(lastDataByAxis, function (lastItem, indexAxis) {
                var thisItem = thisDataByAxis[indexAxis] || {};
                var lastIndices = lastItem.seriesDataIndices || [];
                var newIndices = thisItem.seriesDataIndices || [];

                contentNotChanged
                    &= lastItem.value === thisItem.value
                    && lastItem.axisType === thisItem.axisType
                    && lastItem.axisId === thisItem.axisId
                    && lastIndices.length === newIndices.length;

                contentNotChanged && each(lastIndices, function (lastIdxItem, j) {
                    var newIdxItem = newIndices[j];
                    contentNotChanged
                        &= lastIdxItem.seriesIndex === newIdxItem.seriesIndex
                        && lastIdxItem.dataIndex === newIdxItem.dataIndex;
                });
            });
        });

        this._lastDataByCoordSys = dataByCoordSys;

        return !!contentNotChanged;
    },

    _hide: function (dispatchAction) {
        // Do not directly hideLater here, because this behavior may be prevented
        // in dispatchAction when showTip is dispatched.

        // FIXME
        // duplicated hideTip if manuallyHideTip is called from dispatchAction.
        this._lastDataByCoordSys = null;
        dispatchAction({
            type: 'hideTip',
            from: this.uid
        });
    },

    dispose: function (ecModel, api) {
        if (env.node) {
            return;
        }
        this._tooltipContent.dispose();
        globalListener.unregister('itemTooltip', api);
    }
});


/**
 * @param {Array.<Object|module:echarts/model/Model>} modelCascade
 * From top to bottom. (the last one should be globalTooltipModel);
 */
function buildTooltipModel(modelCascade) {
    var resultModel = modelCascade.pop();
    while (modelCascade.length) {
        var tooltipOpt = modelCascade.pop();
        if (tooltipOpt) {
            if (Model.isInstance(tooltipOpt)) {
                tooltipOpt = tooltipOpt.get('tooltip', true);
            }
            // In each data item tooltip can be simply write:
            // {
            //  value: 10,
            //  tooltip: 'Something you need to know'
            // }
            if (typeof tooltipOpt === 'string') {
                tooltipOpt = {formatter: tooltipOpt};
            }
            resultModel = new Model(tooltipOpt, resultModel, resultModel.ecModel);
        }
    }
    return resultModel;
}

function makeDispatchAction(payload, api) {
    return payload.dispatchAction || zrUtil.bind(api.dispatchAction, api);
}

function refixTooltipPosition(x, y, content, viewWidth, viewHeight, gapH, gapV) {
    var size = content.getOuterSize();
    var width = size.width;
    var height = size.height;

    if (gapH != null) {
        if (x + width + gapH > viewWidth) {
            x -= width + gapH;
        }
        else {
            x += gapH;
        }
    }
    if (gapV != null) {
        if (y + height + gapV > viewHeight) {
            y -= height + gapV;
        }
        else {
            y += gapV;
        }
    }
    return [x, y];
}

function confineTooltipPosition(x, y, content, viewWidth, viewHeight) {
    var size = content.getOuterSize();
    var width = size.width;
    var height = size.height;

    x = Math.min(x + width, viewWidth) - width;
    y = Math.min(y + height, viewHeight) - height;
    x = Math.max(x, 0);
    y = Math.max(y, 0);

    return [x, y];
}

function calcTooltipPosition(position, rect, contentSize) {
    var domWidth = contentSize[0];
    var domHeight = contentSize[1];
    var gap = 5;
    var x = 0;
    var y = 0;
    var rectWidth = rect.width;
    var rectHeight = rect.height;
    switch (position) {
        case 'inside':
            x = rect.x + rectWidth / 2 - domWidth / 2;
            y = rect.y + rectHeight / 2 - domHeight / 2;
            break;
        case 'top':
            x = rect.x + rectWidth / 2 - domWidth / 2;
            y = rect.y - domHeight - gap;
            break;
        case 'bottom':
            x = rect.x + rectWidth / 2 - domWidth / 2;
            y = rect.y + rectHeight + gap;
            break;
        case 'left':
            x = rect.x - domWidth - gap;
            y = rect.y + rectHeight / 2 - domHeight / 2;
            break;
        case 'right':
            x = rect.x + rectWidth + gap;
            y = rect.y + rectHeight / 2 - domHeight / 2;
    }
    return [x, y];
}

function isCenterAlign(align) {
    return align === 'center' || align === 'middle';
}
