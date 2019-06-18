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

/**
 * Separate legend and scrollable legend to reduce package size.
 */

import * as zrUtil from 'zrender/src/core/util';
import * as graphic from '../../util/graphic';
import * as layoutUtil from '../../util/layout';
import LegendView from './LegendView';

var Group = graphic.Group;

var WH = ['width', 'height'];
var XY = ['x', 'y'];

var ScrollableLegendView = LegendView.extend({

    type: 'legend.scroll',

    newlineDisabled: true,

    init: function () {

        ScrollableLegendView.superCall(this, 'init');

        /**
         * @private
         * @type {number} For `scroll`.
         */
        this._currentIndex = 0;

        /**
         * @private
         * @type {module:zrender/container/Group}
         */
        this.group.add(this._containerGroup = new Group());
        this._containerGroup.add(this.getContentGroup());

        /**
         * @private
         * @type {module:zrender/container/Group}
         */
        this.group.add(this._controllerGroup = new Group());

        /**
         *
         * @private
         */
        this._showController;
    },

    /**
     * @override
     */
    resetInner: function () {
        ScrollableLegendView.superCall(this, 'resetInner');

        this._controllerGroup.removeAll();
        this._containerGroup.removeClipPath();
        this._containerGroup.__rectSize = null;
    },

    /**
     * @override
     */
    renderInner: function (itemAlign, legendModel, ecModel, api) {
        var me = this;

        // Render content items.
        ScrollableLegendView.superCall(this, 'renderInner', itemAlign, legendModel, ecModel, api);

        var controllerGroup = this._controllerGroup;

        // FIXME: support be 'auto' adapt to size number text length,
        // e.g., '3/12345' should not overlap with the control arrow button.
        var pageIconSize = legendModel.get('pageIconSize', true);
        if (!zrUtil.isArray(pageIconSize)) {
            pageIconSize = [pageIconSize, pageIconSize];
        }

        createPageButton('pagePrev', 0);

        var pageTextStyleModel = legendModel.getModel('pageTextStyle');
        controllerGroup.add(new graphic.Text({
            name: 'pageText',
            style: {
                textFill: pageTextStyleModel.getTextColor(),
                font: pageTextStyleModel.getFont(),
                textVerticalAlign: 'middle',
                textAlign: 'center'
            },
            silent: true
        }));

        createPageButton('pageNext', 1);

        function createPageButton(name, iconIdx) {
            var pageDataIndexName = name + 'DataIndex';
            var icon = graphic.createIcon(
                legendModel.get('pageIcons', true)[legendModel.getOrient().name][iconIdx],
                {
                    // Buttons will be created in each render, so we do not need
                    // to worry about avoiding using legendModel kept in scope.
                    onclick: zrUtil.bind(
                        me._pageGo, me, pageDataIndexName, legendModel, api
                    )
                },
                {
                    x: -pageIconSize[0] / 2,
                    y: -pageIconSize[1] / 2,
                    width: pageIconSize[0],
                    height: pageIconSize[1]
                }
            );
            icon.name = name;
            controllerGroup.add(icon);
        }
    },

    /**
     * @override
     */
    layoutInner: function (legendModel, itemAlign, maxSize, isFirstRender) {
        var contentGroup = this.getContentGroup();
        var containerGroup = this._containerGroup;
        var controllerGroup = this._controllerGroup;

        var orientIdx = legendModel.getOrient().index;
        var wh = WH[orientIdx];
        var hw = WH[1 - orientIdx];
        var yx = XY[1 - orientIdx];

        // layout controllerGroup first to get correct boundingRect next
        layoutUtil.box(
            // Buttons in controller are layout always horizontally.
            'horizontal',
            controllerGroup,
            legendModel.get('pageButtonItemGap', true)
        );

        // Place items in contentGroup.
        layoutUtil.box(
            legendModel.get('orient'),
            contentGroup,
            legendModel.get('itemGap'),
            !orientIdx ? (maxSize.width - controllerGroup.getBoundingRect().width) : maxSize.width,
            orientIdx ? (maxSize.height - controllerGroup.getBoundingRect().height) : maxSize.height
        );

        var contentRect = contentGroup.getBoundingRect();
        var controllerRect = controllerGroup.getBoundingRect();
        var showController = this._showController = contentRect[wh] > maxSize[wh];

        var contentPos = [-contentRect.x, -contentRect.y];
        // Remain contentPos when scroll animation perfroming.
        // If first rendering, `contentGroup.position` is [0, 0], which
        // does not make sense and may cause unexepcted animation if adopted.
        if (!isFirstRender) {
            contentPos[orientIdx] = contentGroup.position[orientIdx];
        }

        // Layout container group based on 0.
        var containerPos = [0, 0];
        var controllerPos = [-controllerRect.x, -controllerRect.y];
        var pageButtonGap = zrUtil.retrieve2(
            legendModel.get('pageButtonGap', true), legendModel.get('itemGap', true)
        );

        // Place containerGroup and controllerGroup and contentGroup.
        if (showController) {
            var pageButtonPosition = legendModel.get('pageButtonPosition', true);
            // controller is on the right / bottom.
            if (pageButtonPosition === 'end') {
                controllerPos[orientIdx] += maxSize[wh] - controllerRect[wh];
            }
            // controller is on the left / top.
            else {
                containerPos[orientIdx] += controllerRect[wh] + pageButtonGap;
            }
        }

        // Always align controller to content as 'middle'.
        controllerPos[1 - orientIdx] += contentRect[hw] / 2 - controllerRect[hw] / 2;

        contentGroup.attr('position', contentPos);
        containerGroup.attr('position', containerPos);
        controllerGroup.attr('position', controllerPos);

        // Calculate `mainRect` and set `clipPath`.
        // mainRect should not be calculated by `this.group.getBoundingRect()`
        // for sake of the overflow.
        var mainRect = this.group.getBoundingRect();
        var mainRect = {x: 0, y: 0};
        // Consider content may be overflow (should be clipped).
        mainRect[wh] = showController ? maxSize[wh] : contentRect[wh];
        mainRect[hw] = Math.max(contentRect[hw], controllerRect[hw]);
        // `containerRect[yx] + containerPos[1 - orientIdx]` is 0.
        mainRect[yx] = Math.min(0, controllerRect[yx] + controllerPos[1 - orientIdx]);

        containerGroup.__rectSize = maxSize[wh];
        if (showController) {
            var clipShape = {x: 0, y: 0};
            clipShape[wh] = Math.max(maxSize[wh] - controllerRect[wh] - pageButtonGap, 0);
            clipShape[hw] = mainRect[hw];
            containerGroup.setClipPath(new graphic.Rect({shape: clipShape}));
            // Consider content may be larger than container, container rect
            // can not be obtained from `containerGroup.getBoundingRect()`.
            containerGroup.__rectSize = clipShape[wh];
        }
        else {
            // Do not remove or ignore controller. Keep them set as place holders.
            controllerGroup.eachChild(function (child) {
                child.attr({invisible: true, silent: true});
            });
        }

        // Content translate animation.
        var pageInfo = this._getPageInfo(legendModel);
        pageInfo.pageIndex != null && graphic.updateProps(
            contentGroup,
            {position: pageInfo.contentPosition},
            // When switch from "show controller" to "not show controller", view should be
            // updated immediately without animation, otherwise causes weird efffect.
            showController ? legendModel : false
        );

        this._updatePageInfoView(legendModel, pageInfo);

        return mainRect;
    },

    _pageGo: function (to, legendModel, api) {
        var scrollDataIndex = this._getPageInfo(legendModel)[to];

        scrollDataIndex != null && api.dispatchAction({
            type: 'legendScroll',
            scrollDataIndex: scrollDataIndex,
            legendId: legendModel.id
        });
    },

    _updatePageInfoView: function (legendModel, pageInfo) {
        var controllerGroup = this._controllerGroup;

        zrUtil.each(['pagePrev', 'pageNext'], function (name) {
            var canJump = pageInfo[name + 'DataIndex'] != null;
            var icon = controllerGroup.childOfName(name);
            if (icon) {
                icon.setStyle(
                    'fill',
                    canJump
                        ? legendModel.get('pageIconColor', true)
                        : legendModel.get('pageIconInactiveColor', true)
                );
                icon.cursor = canJump ? 'pointer' : 'default';
            }
        });

        var pageText = controllerGroup.childOfName('pageText');
        var pageFormatter = legendModel.get('pageFormatter');
        var pageIndex = pageInfo.pageIndex;
        var current = pageIndex != null ? pageIndex + 1 : 0;
        var total = pageInfo.pageCount;

        pageText && pageFormatter && pageText.setStyle(
            'text',
            zrUtil.isString(pageFormatter)
                ? pageFormatter.replace('{current}', current).replace('{total}', total)
                : pageFormatter({current: current, total: total})
        );
    },

    /**
     * @param {module:echarts/model/Model} legendModel
     * @return {Object} {
     *  contentPosition: Array.<number>, null when data item not found.
     *  pageIndex: number, null when data item not found.
     *  pageCount: number, always be a number, can be 0.
     *  pagePrevDataIndex: number, null when no next page.
     *  pageNextDataIndex: number, null when no previous page.
     * }
     */
    _getPageInfo: function (legendModel) {
        var scrollDataIndex = legendModel.get('scrollDataIndex', true);
        var contentGroup = this.getContentGroup();
        var containerRectSize = this._containerGroup.__rectSize;
        var orientIdx = legendModel.getOrient().index;
        var wh = WH[orientIdx];
        var xy = XY[orientIdx];

        var targetItemIndex = this._findTargetItemIndex(scrollDataIndex);
        var children = contentGroup.children();
        var targetItem = children[targetItemIndex];
        var itemCount = children.length;
        var pCount = !itemCount ? 0 : 1;

        var result = {
            contentPosition: contentGroup.position.slice(),
            pageCount: pCount,
            pageIndex: pCount - 1,
            pagePrevDataIndex: null,
            pageNextDataIndex: null
        };

        if (!targetItem) {
            return result;
        }

        var targetItemInfo = getItemInfo(targetItem);
        result.contentPosition[orientIdx] = -targetItemInfo.s;

        // Strategy:
        // (1) Always align based on the left/top most item.
        // (2) It is user-friendly that the last item shown in the
        // current window is shown at the begining of next window.
        // Otherwise if half of the last item is cut by the window,
        // it will have no chance to display entirely.
        // (3) Consider that item size probably be different, we
        // have calculate pageIndex by size rather than item index,
        // and we can not get page index directly by division.
        // (4) The window is to narrow to contain more than
        // one item, we should make sure that the page can be fliped.

        for (var i = targetItemIndex + 1,
            winStartItemInfo = targetItemInfo,
            winEndItemInfo = targetItemInfo,
            currItemInfo = null;
            i <= itemCount;
            ++i
        ) {
            currItemInfo = getItemInfo(children[i]);
            if (
                // Half of the last item is out of the window.
                (!currItemInfo && winEndItemInfo.e > winStartItemInfo.s + containerRectSize)
                // If the current item does not intersect with the window, the new page
                // can be started at the current item or the last item.
                || (currItemInfo && !intersect(currItemInfo, winStartItemInfo.s))
            ) {
                if (winEndItemInfo.i > winStartItemInfo.i) {
                    winStartItemInfo = winEndItemInfo;
                }
                else { // e.g., when page size is smaller than item size.
                    winStartItemInfo = currItemInfo;
                }
                if (winStartItemInfo) {
                    if (result.pageNextDataIndex == null) {
                        result.pageNextDataIndex = winStartItemInfo.i;
                    }
                    ++result.pageCount;
                }
            }
            winEndItemInfo = currItemInfo;
        }

        for (var i = targetItemIndex - 1,
            winStartItemInfo = targetItemInfo,
            winEndItemInfo = targetItemInfo,
            currItemInfo = null;
            i >= -1;
            --i
        ) {
            currItemInfo = getItemInfo(children[i]);
            if (
                // If the the end item does not intersect with the window started
                // from the current item, a page can be settled.
                (!currItemInfo || !intersect(winEndItemInfo, currItemInfo.s))
                // e.g., when page size is smaller than item size.
                && winStartItemInfo.i < winEndItemInfo.i
            ) {
                winEndItemInfo = winStartItemInfo;
                if (result.pagePrevDataIndex == null) {
                    result.pagePrevDataIndex = winStartItemInfo.i;
                }
                ++result.pageCount;
                ++result.pageIndex;
            }
            winStartItemInfo = currItemInfo;
        }

        return result;

        function getItemInfo(el) {
            if (el) {
                var itemRect = el.getBoundingRect();
                var start = itemRect[xy] + el.position[orientIdx];
                return {
                    s: start,
                    e: start + itemRect[wh],
                    i: el.__legendDataIndex
                };
            }
        }

        function intersect(itemInfo, winStart) {
            return itemInfo.e >= winStart && itemInfo.s <= winStart + containerRectSize;
        }
    },

    _findTargetItemIndex: function (targetDataIndex) {
        var index;
        var contentGroup = this.getContentGroup();
        var defaultIndex;

        if (this._showController) {
            contentGroup.eachChild(function (child, idx) {
                var legendDataIdx = child.__legendDataIndex;
                // FIXME
                // If the given targetDataIndex (from model) is illegal,
                // we use defualtIndex. But the index on the legend model and
                // action payload is still illegal. That case will not be
                // changed until some scenario requires.
                if (defaultIndex == null && legendDataIdx != null) {
                    defaultIndex = idx;
                }
                if (legendDataIdx === targetDataIndex) {
                    index = idx;
                }
            });
        }

        return index != null ? index : defaultIndex;
    }

});

export default ScrollableLegendView;
