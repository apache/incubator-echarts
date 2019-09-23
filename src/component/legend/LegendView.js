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

import {__DEV__} from '../../config';
import * as echarts from '../../echarts';
import * as zrUtil from 'zrender/src/core/util';
import {createSymbol} from '../../util/symbol';
import * as graphic from '../../util/graphic';
import {makeBackground} from '../helper/listComponent';
import * as layoutUtil from '../../util/layout';

var curry = zrUtil.curry;
var each = zrUtil.each;
var Group = graphic.Group;

export default echarts.extendComponentView({

    type: 'legend.plain',

    newlineDisabled: false,

    /**
     * @override
     */
    init: function () {

        /**
         * @private
         * @type {module:zrender/container/Group}
         */
        this.group.add(this._contentGroup = new Group());

        /**
         * @private
         * @type {module:zrender/Element}
         */
        this._backgroundEl;

        /**
         * @private
         * @type {module:zrender/container/Group}
         */
        this.group.add(this._selectorGroup = new Group());

        /**
         * If first rendering, `contentGroup.position` is [0, 0], which
         * does not make sense and may cause unexepcted animation if adopted.
         * @private
         * @type {boolean}
         */
        this._isFirstRender = true;
    },

    /**
     * @protected
     */
    getContentGroup: function () {
        return this._contentGroup;
    },

    /**
     * @protected
     */
    getSelectorGroup: function () {
        return this._selectorGroup;
    },

    /**
     * @override
     */
    render: function (legendModel, ecModel, api) {
        var isFirstRender = this._isFirstRender;
        this._isFirstRender = false;

        this.resetInner();

        if (!legendModel.get('show', true)) {
            return;
        }

        var itemAlign = legendModel.get('align');
        var orient = legendModel.get('orient');
        if (!itemAlign || itemAlign === 'auto') {
            itemAlign = (
                legendModel.get('left') === 'right'
                && orient === 'vertical'
            ) ? 'right' : 'left';
        }

        var selector = legendModel.get('selector', true);
        var selectorPosition = legendModel.get('selectorPosition', true);
        if (selector && (!selectorPosition || selectorPosition === 'auto')) {
            selectorPosition = orient === 'horizontal' ? 'end' : 'start';
        }

        this.renderInner(itemAlign, legendModel, ecModel, api, selector, orient, selectorPosition);

        // Perform layout.
        var positionInfo = legendModel.getBoxLayoutParams();
        var viewportSize = {width: api.getWidth(), height: api.getHeight()};
        var padding = legendModel.get('padding');

        var maxSize = layoutUtil.getLayoutRect(positionInfo, viewportSize, padding);

        var mainRect = this.layoutInner(legendModel, itemAlign, maxSize, isFirstRender, selector, selectorPosition);

        // Place mainGroup, based on the calculated `mainRect`.
        var layoutRect = layoutUtil.getLayoutRect(
            zrUtil.defaults({width: mainRect.width, height: mainRect.height}, positionInfo),
            viewportSize,
            padding
        );
        this.group.attr('position', [layoutRect.x - mainRect.x, layoutRect.y - mainRect.y]);

        // Render background after group is layout.
        this.group.add(
            this._backgroundEl = makeBackground(mainRect, legendModel)
        );
    },

    /**
     * @protected
     */
    resetInner: function () {
        this.getContentGroup().removeAll();
        this._backgroundEl && this.group.remove(this._backgroundEl);
        this.getSelectorGroup().removeAll();
    },

    /**
     * @protected
     */
    renderInner: function (itemAlign, legendModel, ecModel, api, selector, orient, selectorPosition) {
        var contentGroup = this.getContentGroup();
        var legendDrawnMap = zrUtil.createHashMap();
        var selectMode = legendModel.get('selectedMode');

        var excludeSeriesId = [];
        ecModel.eachRawSeries(function (seriesModel) {
            !seriesModel.get('legendHoverLink') && excludeSeriesId.push(seriesModel.id);
        });

        each(legendModel.getData(), function (itemModel, dataIndex) {
            var name = itemModel.get('name');

            // Use empty string or \n as a newline string
            if (!this.newlineDisabled && (name === '' || name === '\n')) {
                contentGroup.add(new Group({
                    newline: true
                }));
                return;
            }

            // Representitive series.
            var seriesModel = ecModel.getSeriesByName(name)[0];

            if (legendDrawnMap.get(name)) {
                // Have been drawed
                return;
            }

            // Series legend
            if (seriesModel) {
                var data = seriesModel.getData();
                var color = getLegendColor(data, dataIndex, seriesModel, itemModel, ecModel)

                // Using rect symbol defaultly
                var legendSymbolType = data.getVisual('legendSymbol') || 'roundRect';
                var symbolType = data.getVisual('symbol');

                var itemGroup = this._createItem(
                    name, dataIndex, itemModel, legendModel,
                    legendSymbolType, symbolType,
                    itemAlign, color,
                    selectMode
                );

                itemGroup.on('click', curry(dispatchSelectAction, name, api))
                    .on('mouseover', curry(dispatchHighlightAction, seriesModel.name, null, api, excludeSeriesId))
                    .on('mouseout', curry(dispatchDownplayAction, seriesModel.name, null, api, excludeSeriesId));

                legendDrawnMap.set(name, true);
            }
            else {
                // Data legend of pie, funnel
                ecModel.eachRawSeries(function (seriesModel) {
                    // In case multiple series has same data name
                    if (legendDrawnMap.get(name)) {
                        return;
                    }

                    if (seriesModel.legendDataProvider) {
                        var data = seriesModel.legendDataProvider();
                        var idx = data.indexOfName(name);
                        if (idx < 0) {
                            return;
                        }

                        var color = data.getItemVisual(idx, 'color');

                        var legendSymbolType = 'roundRect';

                        var itemGroup = this._createItem(
                            name, dataIndex, itemModel, legendModel,
                            legendSymbolType, null,
                            itemAlign, color,
                            selectMode
                        );

                        // FIXME: consider different series has items with the same name.
                        itemGroup.on('click', curry(dispatchSelectAction, name, api))
                            // Should not specify the series name, consider legend controls
                            // more than one pie series.
                            .on('mouseover', curry(dispatchHighlightAction, null, name, api, excludeSeriesId))
                            .on('mouseout', curry(dispatchDownplayAction, null, name, api, excludeSeriesId));

                        legendDrawnMap.set(name, true);
                    }

                }, this);
            }

            if (__DEV__) {
                if (!legendDrawnMap.get(name)) {
                    console.warn(
                        name + ' series not exists. Legend data should be same with series name or data name.'
                    );
                }
            }
        }, this);

        if (selector) {
            this._createSelector(selector, legendModel, api, orient, selectorPosition);
        }
    },

    _createSelector: function (selector, legendModel, api, orient, selectorPosition) {
        var selectorGroup = this.getSelectorGroup();

        each(selector, function (selectorItem) {
            createSelectorButton(selectorItem);
        });

        function createSelectorButton(selectorItem) {
            var type = selectorItem.type;

            var labelText = new graphic.Text({
                style: {
                    x: 0,
                    y: 0,
                    align: 'center',
                    verticalAlign: 'middle'
                },
                onclick: function () {
                    api.dispatchAction({
                        type: type === 'all' ? 'legendAllSelect' : 'legendInverseSelect'
                    });
                }
            });

            selectorGroup.add(labelText);

            var labelModel = legendModel.getModel('selectorLabel');
            var emphasisLabelModel = legendModel.getModel('emphasis.selectorLabel');

            graphic.setLabelStyle(
                labelText.style, labelText.hoverStyle = {}, labelModel, emphasisLabelModel,
                {
                    defaultText: selectorItem.title,
                    isRectText: false
                }
            );
            graphic.setHoverStyle(labelText);
        }
    },

    _createItem: function (
        name, dataIndex, itemModel, legendModel,
        legendSymbolType, symbolType,
        itemAlign, color, selectMode
    ) {
        var itemWidth = legendModel.get('itemWidth');
        var itemHeight = legendModel.get('itemHeight');
        var inactiveColor = legendModel.get('inactiveColor');
        var symbolKeepAspect = legendModel.get('symbolKeepAspect');

        var isSelected = legendModel.isSelected(name);
        var itemGroup = new Group();

        var textStyleModel = itemModel.getModel('textStyle');

        var itemIcon = itemModel.get('icon');

        var tooltipModel = itemModel.getModel('tooltip');
        var legendGlobalTooltipModel = tooltipModel.parentModel;

        // Use user given icon first
        legendSymbolType = itemIcon || legendSymbolType;
        itemGroup.add(createSymbol(
            legendSymbolType,
            0,
            0,
            itemWidth,
            itemHeight,
            isSelected ? color : inactiveColor,
            // symbolKeepAspect default true for legend
            symbolKeepAspect == null ? true : symbolKeepAspect
        ));

        // Compose symbols
        // PENDING
        if (!itemIcon && symbolType
            // At least show one symbol, can't be all none
            && ((symbolType !== legendSymbolType) || symbolType === 'none')
        ) {
            var size = itemHeight * 0.8;
            if (symbolType === 'none') {
                symbolType = 'circle';
            }
            // Put symbol in the center
            itemGroup.add(createSymbol(
                symbolType,
                (itemWidth - size) / 2,
                (itemHeight - size) / 2,
                size,
                size,
                isSelected ? color : inactiveColor,
                // symbolKeepAspect default true for legend
                symbolKeepAspect == null ? true : symbolKeepAspect
            ));
        }

        var textX = itemAlign === 'left' ? itemWidth + 5 : -5;
        var textAlign = itemAlign;

        var formatter = legendModel.get('formatter');
        var content = name;
        if (typeof formatter === 'string' && formatter) {
            content = formatter.replace('{name}', name != null ? name : '');
        }
        else if (typeof formatter === 'function') {
            content = formatter(name);
        }

        itemGroup.add(new graphic.Text({
            style: graphic.setTextStyle({}, textStyleModel, {
                text: content,
                x: textX,
                y: itemHeight / 2,
                textFill: isSelected ? textStyleModel.getTextColor() : inactiveColor,
                textAlign: textAlign,
                textVerticalAlign: 'middle'
            })
        }));

        // Add a invisible rect to increase the area of mouse hover
        var hitRect = new graphic.Rect({
            shape: itemGroup.getBoundingRect(),
            invisible: true,
            tooltip: tooltipModel.get('show') ? zrUtil.extend({
                content: name,
                // Defaul formatter
                formatter: legendGlobalTooltipModel.get('formatter', true) || function () {
                    return name;
                },
                formatterParams: {
                    componentType: 'legend',
                    legendIndex: legendModel.componentIndex,
                    name: name,
                    $vars: ['name']
                }
            }, tooltipModel.option) : null
        });
        itemGroup.add(hitRect);

        itemGroup.eachChild(function (child) {
            child.silent = true;
        });

        hitRect.silent = !selectMode;

        this.getContentGroup().add(itemGroup);

        graphic.setHoverStyle(itemGroup);

        itemGroup.__legendDataIndex = dataIndex;

        return itemGroup;
    },

    /**
     * @protected
     */
    layoutInner: function (legendModel, itemAlign, maxSize, isFirstRender, selector, selectorPosition) {
        var contentGroup = this.getContentGroup();
        var selectorGroup = this.getSelectorGroup();

        // Place items in contentGroup.
        layoutUtil.box(
            legendModel.get('orient'),
            contentGroup,
            legendModel.get('itemGap'),
            maxSize.width,
            maxSize.height
        );

        var contentRect = contentGroup.getBoundingRect();
        var contentPos = [-contentRect.x, -contentRect.y];

        if (selector) {
            // Place buttons in selectorGroup
            layoutUtil.box(
                // Buttons in selectorGroup always layout horizontally
                'horizontal',
                selectorGroup,
                legendModel.get('selectorItemGap', true)
            );

            var selectorRect = selectorGroup.getBoundingRect();
            var selectorPos = [-selectorRect.x, -selectorRect.y];
            var selectorButtonGap = legendModel.get('selectorButtonGap', true);

            var orientIdx = legendModel.getOrient().index;
            var wh = orientIdx === 0 ? 'width' : 'height';
            var hw = orientIdx === 0 ? 'height' : 'width';
            var yx = orientIdx === 0 ? 'y' : 'x';

            if (selectorPosition === 'end') {
                selectorPos[orientIdx] += contentRect[wh] + selectorButtonGap;
            }
            else {
                contentPos[orientIdx] += selectorRect[wh] + selectorButtonGap;
            }

            //Always align selector to content as 'middle'
            selectorPos[1 - orientIdx] += contentRect[hw] / 2 - selectorRect[hw] / 2;
            selectorGroup.attr('position', selectorPos);
            contentGroup.attr('position', contentPos);

            var mainRect = {x: 0, y: 0};
            mainRect[wh] = contentRect[wh] + selectorButtonGap + selectorRect[wh];
            mainRect[hw] = Math.max(contentRect[hw], selectorRect[hw]);
            mainRect[yx] = Math.min(0, selectorRect[yx] + selectorPos[1 - orientIdx]);
            return mainRect;
        }
        else {
            contentGroup.attr('position', contentPos);
            return this.group.getBoundingRect();
        }
    },

    /**
     * @protected
     */
    remove: function () {
        this.getContentGroup().removeAll();
        this._isFirstRender = true;
    }

});

function getLegendColor(data, dataIndex, seriesModel, itemModel, ecModel) {
  var itemColor = itemModel.get('color');
  var color = data.getVisual('color');
  var useDataColor = true

  if (itemColor !== ecModel.get('color')) {
      color = itemColor;
      useDataColor = false
  }

  if (zrUtil.isArray(color)) {
    color = color[useDataColor ? 0 : dataIndex]
  }
  
  // If color is a callback function
  if (typeof color === 'function') {
      // Use the first data
      color = color(seriesModel.getDataParams(0));
  }
  return color
}

function dispatchSelectAction(name, api) {
    api.dispatchAction({
        type: 'legendToggleSelect',
        name: name
    });
}

function dispatchHighlightAction(seriesName, dataName, api, excludeSeriesId) {
    // If element hover will move to a hoverLayer.
    var el = api.getZr().storage.getDisplayList()[0];
    if (!(el && el.useHoverLayer)) {
        api.dispatchAction({
            type: 'highlight',
            seriesName: seriesName,
            name: dataName,
            excludeSeriesId: excludeSeriesId
        });
    }
}

function dispatchDownplayAction(seriesName, dataName, api, excludeSeriesId) {
    // If element hover will move to a hoverLayer.
    var el = api.getZr().storage.getDisplayList()[0];
    if (!(el && el.useHoverLayer)) {
        api.dispatchAction({
            type: 'downplay',
            seriesName: seriesName,
            name: dataName,
            excludeSeriesId: excludeSeriesId
        });
    }
}
