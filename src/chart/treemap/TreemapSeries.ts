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
import SeriesModel from '../../model/Series';
import Tree, { TreeNode } from '../../data/Tree';
import Model from '../../model/Model';
import {wrapTreePathInfo} from '../helper/treeHelper';
import {
    SeriesOption,
    BoxLayoutOptionMixin,
    ItemStyleOption,
    LabelOption,
    RoamOptionMixin,
    CallbackDataParams,
    ColorString,
    StatesOptionMixin,
    OptionId,
    OptionName,
    DecalObject,
    SeriesLabelOption,
    DefaultEmphasisFocus,
    AriaOptionMixin,
    ColorBy
} from '../../util/types';
import GlobalModel from '../../model/Global';
import { LayoutRect } from '../../util/layout';
import List from '../../data/List';
import { normalizeToArray } from '../../util/model';
import { createTooltipMarkup } from '../../component/tooltip/tooltipMarkup';
import enableAriaDecalForTree from '../helper/enableAriaDecalForTree';

// Only support numberic value.
type TreemapSeriesDataValue = number | number[];

interface BreadcrumbItemStyleOption extends ItemStyleOption {
    // TODO: textStyle should be in breadcrumb.label
    textStyle?: LabelOption
}

interface TreemapSeriesLabelOption extends SeriesLabelOption {
    ellipsis?: boolean
    formatter?: string | ((params: CallbackDataParams) => string)
}

interface TreemapSeriesItemStyleOption extends ItemStyleOption {
    borderRadius?: number | number[]

    colorAlpha?: number
    colorSaturation?: number

    borderColorSaturation?: number

    gapWidth?: number
}

interface TreePathInfo {
    name: string
    dataIndex: number
    value: TreemapSeriesDataValue
}

interface TreemapSeriesCallbackDataParams extends CallbackDataParams {
    treePathInfo?: TreePathInfo[]
}

interface ExtraStateOption {
    emphasis?: {
        focus?: DefaultEmphasisFocus | 'descendant' | 'ancestor'
    }
}

export interface TreemapStateOption {
    itemStyle?: TreemapSeriesItemStyleOption
    label?: TreemapSeriesLabelOption
    upperLabel?: TreemapSeriesLabelOption
}

export interface TreemapSeriesVisualOption {
    /**
     * Which dimension will be applied with the visual properties.
     */
    visualDimension?: number | string

    /**
     * @deprecated Use colorBy instead
     */
    colorMappingBy?: 'value' | 'index' | 'id'

    visualMin?: number
    visualMax?: number

    colorAlpha?: number[] | 'none'
    colorSaturation?: number[] | 'none'
    // A color list for a level. Each node in the level will obtain a color from the color list.
    // Only suuport ColorString for interpolation
    // color?: ColorString[]

    /**
     * A node will not be shown when its area size is smaller than this value (unit: px square).
     */
    visibleMin?: number
    /**
     * Children will not be shown when area size of a node is smaller than this value (unit: px square).
     */
    childrenVisibleMin?: number
}

export interface TreemapSeriesLevelOption extends TreemapSeriesVisualOption,
    TreemapStateOption, StatesOptionMixin<TreemapStateOption, ExtraStateOption> {

    color?: ColorString[] | 'none',
    decal?: DecalObject[] | 'none'
}

export interface TreemapSeriesNodeItemOption extends TreemapSeriesVisualOption,
    TreemapStateOption, StatesOptionMixin<TreemapStateOption, ExtraStateOption> {
    id?: OptionId
    name?: OptionName

    value?: TreemapSeriesDataValue

    children?: TreemapSeriesNodeItemOption[]

    color?: ColorString[] | 'none'

    decal?: DecalObject[] | 'none'
}

export interface TreemapSeriesOption
    extends SeriesOption<TreemapStateOption, ExtraStateOption>,
    TreemapStateOption,
    BoxLayoutOptionMixin,
    RoamOptionMixin,
    TreemapSeriesVisualOption {

    type?: 'treemap'

    /**
     * configuration in echarts2
     * @deprecated
     */
    size?: (number | string)[]

    /**
     * If sort in desc order.
     * Default to be desc. asc has strange effect
     */
    sort?: boolean | 'asc' | 'desc'

    /**
     * Size of clipped window when zooming. 'origin' or 'fullscreen'
     */
    clipWindow?: 'origin' | 'fullscreen'

    squareRatio?: number
    /**
     * Nodes on depth from root are regarded as leaves.
     * Count from zero (zero represents only view root).
     */
    leafDepth?: number

    drillDownIcon?: string

    /**
     * Be effective when using zoomToNode. Specify the proportion of the
     * target node area in the view area.
     */
    zoomToNodeRatio?: number
    /**
     * Leaf node click behaviour: 'zoomToNode', 'link', false.
     * If leafDepth is set and clicking a node which has children but
     * be on left depth, the behaviour would be changing root. Otherwise
     * use behavious defined above.
     */
    nodeClick?: 'zoomToNode' | 'link'

    breadcrumb?: BoxLayoutOptionMixin & {
        show?: boolean
        height?: number

        emptyItemWidth?: number  // With of empty width
        itemStyle?: BreadcrumbItemStyleOption

        emphasis?: {
            itemStyle?: BreadcrumbItemStyleOption
        }
    }

    levels?: TreemapSeriesLevelOption[]

    data?: TreemapSeriesNodeItemOption[]
}

class TreemapSeriesModel extends SeriesModel<TreemapSeriesOption> {

    static type = 'series.treemap';
    type = TreemapSeriesModel.type;

    static layoutMode = 'box' as const;

    preventUsingHoverLayer = true;

    layoutInfo: LayoutRect;

    designatedVisualItemStyle: TreemapSeriesItemStyleOption;

    private _viewRoot: TreeNode;
    private _idIndexMap: zrUtil.HashMap<number>;
    private _idIndexMapCount: number;

    static defaultOption: TreemapSeriesOption = {
        // Disable progressive rendering
        progressive: 0,
        // size: ['80%', '80%'],            // deprecated, compatible with ec2.
        left: 'center',
        top: 'middle',
        width: '80%',
        height: '80%',
        sort: true,

        clipWindow: 'origin',
        squareRatio: 0.5 * (1 + Math.sqrt(5)), // golden ratio
        leafDepth: null,

        drillDownIcon: '▶',                 // Use html character temporarily because it is complicated
                                            // to align specialized icon. ▷▶❒❐▼✚

        zoomToNodeRatio: 0.32 * 0.32,

        roam: true,
        nodeClick: 'zoomToNode',
        animation: true,
        animationDurationUpdate: 900,
        animationEasing: 'quinticInOut',
        breadcrumb: {
            show: true,
            height: 22,
            left: 'center',
            top: 'bottom',
            // right
            // bottom
            emptyItemWidth: 25,             // Width of empty node.
            itemStyle: {
                color: 'rgba(0,0,0,0.7)', //'#5793f3',
                textStyle: {
                    color: '#fff'
                }
            }
        },
        label: {
            show: true,
            // Do not use textDistance, for ellipsis rect just the same as treemap node rect.
            distance: 0,
            padding: 5,
            position: 'inside', // Can be [5, '5%'] or position stirng like 'insideTopLeft', ...
            // formatter: null,
            color: '#fff',
            overflow: 'truncate'
            // align
            // verticalAlign
        },
        upperLabel: {                   // Label when node is parent.
            show: false,
            position: [0, '50%'],
            height: 20,
            // formatter: null,
            // color: '#fff',
            overflow: 'truncate',
            // align: null,
            verticalAlign: 'middle'
        },
        itemStyle: {
            color: null,            // Can be 'none' if not necessary.
            colorAlpha: null,       // Can be 'none' if not necessary.
            colorSaturation: null,  // Can be 'none' if not necessary.
            borderWidth: 0,
            gapWidth: 0,
            borderColor: '#fff',
            borderColorSaturation: null // If specified, borderColor will be ineffective, and the
                                        // border color is evaluated by color of current node and
                                        // borderColorSaturation.
        },
        emphasis: {
            upperLabel: {
                show: true,
                position: [0, '50%'],
                ellipsis: true,
                verticalAlign: 'middle'
            }
        },

        visualDimension: 0,                 // Can be 0, 1, 2, 3.
        visualMin: null,
        visualMax: null,

        color: [],                  // + treemapSeries.color should not be modified. Please only modified
                                    // level[n].color (if necessary).
                                    // + Specify color list of each level. level[0].color would be global
                                    // color list if not specified. (see method `setDefault`).
                                    // + But set as a empty array to forbid fetch color from global palette
                                    // when using nodeModel.get('color'), otherwise nodes on deep level
                                    // will always has color palette set and are not able to inherit color
                                    // from parent node.
                                    // + TreemapSeries.color can not be set as 'none', otherwise effect
                                    // legend color fetching (see seriesColor.js).
        colorAlpha: null,           // Array. Specify color alpha range of each level, like [0.2, 0.8]
        colorSaturation: null,      // Array. Specify color saturation of each level, like [0.2, 0.5]
        colorMappingBy: 'index',    // 'value' or 'index' or 'id'.
        visibleMin: 10,             // If area less than this threshold (unit: pixel^2), node will not
                                    // be rendered. Only works when sort is 'asc' or 'desc'.
        childrenVisibleMin: null,   // If area of a node less than this threshold (unit: pixel^2),
                                    // grandchildren will not show.
                                    // Why grandchildren? If not grandchildren but children,
                                    // some siblings show children and some not,
                                    // the appearance may be mess and not consistent,
        levels: []                  // Each item: {
                                    //     visibleMin, itemStyle, visualDimension, label
                                    // }
        // data: {
        //      value: [],
        //      children: [],
        //      link: 'http://xxx.xxx.xxx',
        //      target: 'blank' or 'self'
        // }
    };

    /**
     * @override
     */
    getInitialData(option: TreemapSeriesOption, ecModel: GlobalModel) {
        // Create a virtual root.
        const root: TreemapSeriesNodeItemOption = {
            name: option.name,
            children: option.data
        };

        completeTreeValue(root);

        let levels = option.levels || [];

        // Used in "visual priority" in `treemapVisual.js`.
        // This way is a little tricky, must satisfy the precondition:
        //   1. There is no `treeNode.getModel('itemStyle.xxx')` used.
        //   2. The `Model.prototype.getModel()` will not use any clone-like way.
        const designatedVisualItemStyle = this.designatedVisualItemStyle = {};
        const designatedVisualModel = new Model({itemStyle: designatedVisualItemStyle}, this, ecModel);

        levels = option.levels = setDefault(levels, ecModel);
        const levelModels = zrUtil.map(levels || [], function (levelDefine) {
            return new Model(levelDefine, designatedVisualModel, ecModel);
        }, this);

        // Make sure always a new tree is created when setOption,
        // in TreemapView, we check whether oldTree === newTree
        // to choose mappings approach among old shapes and new shapes.
        const tree = Tree.createTree(root, this, beforeLink);

        function beforeLink(nodeData: List) {
            nodeData.wrapMethod('getItemModel', function (model, idx) {
                const node = tree.getNodeByDataIndex(idx);
                const levelModel = node ? levelModels[node.depth] : null;
                // If no levelModel, we also need `designatedVisualModel`.
                model.parentModel = levelModel || designatedVisualModel;
                return model;
            });
        }

        return tree.data;
    }

    optionUpdated() {
        this.resetViewRoot();
    }

    /**
     * @override
     * @param {number} dataIndex
     * @param {boolean} [mutipleSeries=false]
     */
    formatTooltip(
        dataIndex: number,
        multipleSeries: boolean,
        dataType: string
    ) {
        const data = this.getData();
        const value = this.getRawValue(dataIndex) as TreemapSeriesDataValue;
        const name = data.getName(dataIndex);

        return createTooltipMarkup('nameValue', { name: name, value: value });
    }

    /**
     * Add tree path to tooltip param
     *
     * @override
     * @param {number} dataIndex
     * @return {Object}
     */
    getDataParams(dataIndex: number) {
        const params = super.getDataParams.apply(this, arguments as any) as TreemapSeriesCallbackDataParams;

        const node = this.getData().tree.getNodeByDataIndex(dataIndex);
        params.treePathInfo = wrapTreePathInfo(node, this);

        return params;
    }

    /**
     * @public
     * @param {Object} layoutInfo {
     *                                x: containerGroup x
     *                                y: containerGroup y
     *                                width: containerGroup width
     *                                height: containerGroup height
     *                            }
     */
    setLayoutInfo(layoutInfo: LayoutRect) {
        /**
         * @readOnly
         * @type {Object}
         */
        this.layoutInfo = this.layoutInfo || {} as LayoutRect;
        zrUtil.extend(this.layoutInfo, layoutInfo);
    }

    /**
     * @param  {string} id
     * @return {number} index
     */
    mapIdToIndex(id: string): number {
        // A feature is implemented:
        // index is monotone increasing with the sequence of
        // input id at the first time.
        // This feature can make sure that each data item and its
        // mapped color have the same index between data list and
        // color list at the beginning, which is useful for user
        // to adjust data-color mapping.

        /**
         * @private
         * @type {Object}
         */
        let idIndexMap = this._idIndexMap;

        if (!idIndexMap) {
            idIndexMap = this._idIndexMap = zrUtil.createHashMap();
            /**
             * @private
             * @type {number}
             */
            this._idIndexMapCount = 0;
        }

        let index = idIndexMap.get(id);
        if (index == null) {
            idIndexMap.set(id, index = this._idIndexMapCount++);
        }

        return index;
    }

    getViewRoot() {
        return this._viewRoot;
    }

    resetViewRoot(viewRoot?: TreeNode) {
        viewRoot
            ? (this._viewRoot = viewRoot)
            : (viewRoot = this._viewRoot);

        const root = this.getRawData().tree.root;

        if (!viewRoot
            || (viewRoot !== root && !root.contains(viewRoot))
        ) {
            this._viewRoot = root;
        }
    }

    enableAriaDecal() {
        enableAriaDecalForTree(this);
    }
}

/**
 * @param {Object} dataNode
 */
function completeTreeValue(dataNode: TreemapSeriesNodeItemOption) {
    // Postorder travel tree.
    // If value of none-leaf node is not set,
    // calculate it by suming up the value of all children.
    let sum = 0;

    zrUtil.each(dataNode.children, function (child) {

        completeTreeValue(child);

        let childValue = child.value;
        zrUtil.isArray(childValue) && (childValue = childValue[0]);

        sum += childValue;
    });

    let thisValue = dataNode.value;
    if (zrUtil.isArray(thisValue)) {
        thisValue = thisValue[0];
    }

    if (thisValue == null || isNaN(thisValue)) {
        thisValue = sum;
    }
    // Value should not less than 0.
    if (thisValue < 0) {
        thisValue = 0;
    }

    zrUtil.isArray(dataNode.value)
        ? (dataNode.value[0] = thisValue)
        : (dataNode.value = thisValue);
}

/**
 * set default to level configuration
 */
function setDefault(levels: TreemapSeriesLevelOption[], ecModel: GlobalModel) {
    const globalColorList = normalizeToArray(ecModel.get('color')) as ColorString[];
    const globalDecalList = normalizeToArray(
        (ecModel as Model<AriaOptionMixin>).get(['aria', 'decal', 'decals'])
    ) as DecalObject[];

    if (!globalColorList) {
        return;
    }

    levels = levels || [];
    let hasColorDefine;
    let hasDecalDefine;
    zrUtil.each(levels, function (levelDefine) {
        const model = new Model(levelDefine);
        const modelColor = model.get('color');
        const modelDecal = model.get('decal');

        if (model.get(['itemStyle', 'color'])
            || (modelColor && modelColor !== 'none')
        ) {
            hasColorDefine = true;
        }
        if (model.get(['itemStyle', 'decal'])
            || (modelDecal && modelDecal !== 'none')
        ) {
            hasDecalDefine = true;
        }
    });

    const level0 = levels[0] || (levels[0] = {});
    if (!hasColorDefine) {
        level0.color = globalColorList.slice();
    }
    if (!hasDecalDefine && globalDecalList) {
        level0.decal = globalDecalList.slice();
    }

    return levels;
}

export default TreemapSeriesModel;