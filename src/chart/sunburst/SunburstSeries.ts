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
import {wrapTreePathInfo} from '../helper/treeHelper';
import {
    SeriesOption,
    CircleLayoutOptionMixin,
    SeriesLabelOption,
    ItemStyleOption,
    OptionDataValue,
    CallbackDataParams,
    StatesOptionMixin,
    OptionDataItemObject,
    DefaultEmphasisFocus,
    SunburstColorByMixin
} from '../../util/types';
import GlobalModel from '../../model/Global';
import List from '../../data/List';
import Model from '../../model/Model';
import enableAriaDecalForTree from '../helper/enableAriaDecalForTree';

interface SunburstItemStyleOption extends ItemStyleOption {
    // can be 10
    // which means that both innerCornerRadius and outerCornerRadius are 10
    // can also be an array [20, 10]
    // which means that innerCornerRadius is 20
    // and outerCornerRadius is 10
    // can also be a string or string array, such as ['20%', '50%']
    // which means that innerCornerRadius is 20% of the innerRadius
    // and outerCornerRadius is half of outerRadius.
    borderRadius?: (number | string)[] | number | string
}

interface SunburstLabelOption extends Omit<SeriesLabelOption, 'rotate' | 'position'> {
    rotate?: 'radial' | 'tangential' | number
    minAngle?: number
    silent?: boolean
    position?: SeriesLabelOption['position'] | 'outside'
}

interface SunburstDataParams extends CallbackDataParams {
    treePathInfo: {
        name: string,
        dataIndex: number
        value: SunburstSeriesNodeItemOption['value']
    }[]
}

interface ExtraStateOption {
    emphasis?: {
        focus?: DefaultEmphasisFocus | 'descendant' | 'ancestor'
    }
}

export interface SunburstStateOption {
    itemStyle?: SunburstItemStyleOption
    label?: SunburstLabelOption
}

export interface SunburstSeriesNodeItemOption extends
    SunburstStateOption, StatesOptionMixin<SunburstStateOption, ExtraStateOption>,
    OptionDataItemObject<OptionDataValue>
{
    nodeClick?: 'rootToNode' | 'link'
    // Available when nodeClick is link
    link?: string
    target?: string

    children?: SunburstSeriesNodeItemOption[]

    collapsed?: boolean

    cursor?: string
}
export interface SunburstSeriesLevelOption extends SunburstStateOption, StatesOptionMixin<SunburstStateOption> {
    highlight?: {
        itemStyle?: SunburstItemStyleOption
        label?: SunburstLabelOption
    }
}

interface SortParam {
    dataIndex: number
    depth: number
    height: number
    getValue(): number
}
export interface SunburstSeriesOption extends
    SeriesOption<SunburstStateOption, ExtraStateOption>, SunburstStateOption,
    SunburstColorByMixin,
    CircleLayoutOptionMixin {

    type?: 'sunburst'

    clockwise?: boolean
    startAngle?: number
    minAngle?: number
    /**
     * If still show when all data zero.
     */
    stillShowZeroSum?: boolean
    /**
     * Policy of highlighting pieces when hover on one
     * Valid values: 'none' (for not downplay others), 'descendant',
     * 'ancestor', 'self'
     */
    // highlightPolicy?: 'descendant' | 'ancestor' | 'self'

    nodeClick?: 'rootToNode' | 'link'

    renderLabelForZeroData?: boolean

    levels?: SunburstSeriesLevelOption[]

    animationType?: 'expansion' | 'scale'

    sort?: 'desc' | 'asc' | ((a: SortParam, b: SortParam) => number)
}

interface SunburstSeriesModel {
    getFormattedLabel(
        dataIndex: number,
        state?: 'emphasis' | 'normal' | 'highlight' | 'blur' | 'select'
    ): string
}
class SunburstSeriesModel extends SeriesModel<SunburstSeriesOption> {

    static readonly type = 'series.sunburst';
    readonly type = SunburstSeriesModel.type;

    ignoreStyleOnData = true;

    private _viewRoot: TreeNode;

    getInitialData(option: SunburstSeriesOption, ecModel: GlobalModel) {
        // Create a virtual root.
        const root = { name: option.name, children: option.data } as SunburstSeriesNodeItemOption;

        completeTreeValue(root);

        const levelModels = zrUtil.map(option.levels || [], function (levelDefine) {
            return new Model(levelDefine, this, ecModel);
        }, this);

        // Make sure always a new tree is created when setOption,
        // in TreemapView, we check whether oldTree === newTree
        // to choose mappings approach among old shapes and new shapes.
        const tree = Tree.createTree(root, this, beforeLink);

        function beforeLink(nodeData: List) {
            nodeData.wrapMethod('getItemModel', function (model, idx) {
                const node = tree.getNodeByDataIndex(idx);
                const levelModel = levelModels[node.depth];
                levelModel && (model.parentModel = levelModel);
                return model;
            });
        }
        return tree.data;
    }

    optionUpdated() {
        this.resetViewRoot();
    }

    /*
     * @override
     */
    getDataParams(dataIndex: number) {
        const params = super.getDataParams.apply(this, arguments as any) as SunburstDataParams;

        const node = this.getData().tree.getNodeByDataIndex(dataIndex);
        params.treePathInfo = wrapTreePathInfo<SunburstSeriesNodeItemOption['value']>(node, this);

        return params;
    }

    static defaultOption: SunburstSeriesOption = {
        zlevel: 0,
        z: 2,

        // 默认全局居中
        center: ['50%', '50%'],
        radius: [0, '75%'],
        // 默认顺时针
        clockwise: true,
        startAngle: 90,
        // 最小角度改为0
        minAngle: 0,

        // If still show when all data zero.
        stillShowZeroSum: true,

        // 'rootToNode', 'link', or false
        nodeClick: 'rootToNode',

        renderLabelForZeroData: false,

        label: {
            // could be: 'radial', 'tangential', or 'none'
            rotate: 'radial',
            show: true,
            opacity: 1,
            // 'left' is for inner side of inside, and 'right' is for outter
            // side for inside
            align: 'center',
            position: 'inside',
            distance: 5,
            silent: true
        },
        itemStyle: {
            borderWidth: 1,
            borderColor: 'white',
            borderType: 'solid',
            shadowBlur: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            opacity: 1
        },

        emphasis: {
            focus: 'descendant'
        },

        blur: {
            itemStyle: {
                opacity: 0.2
            },
            label: {
                opacity: 0.1
            }
        },

        // Animation type canbe expansion, scale
        animationType: 'expansion',
        animationDuration: 1000,
        animationDurationUpdate: 500,

        data: [],

        /**
         * Sort order.
         *
         * Valid values: 'desc', 'asc', null, or callback function.
         * 'desc' and 'asc' for descend and ascendant order;
         * null for not sorting;
         * example of callback function:
         * function(nodeA, nodeB) {
         *     return nodeA.getValue() - nodeB.getValue();
         * }
         */
        sort: 'desc'
    };

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



function completeTreeValue(dataNode: SunburstSeriesNodeItemOption) {
    // Postorder travel tree.
    // If value of none-leaf node is not set,
    // calculate it by suming up the value of all children.
    let sum = 0;

    zrUtil.each(dataNode.children, function (child) {

        completeTreeValue(child);

        let childValue = child.value;
        // TODO First value of array must be a number
        zrUtil.isArray(childValue) && (childValue = childValue[0]);
        sum += childValue as number;
    });

    let thisValue = dataNode.value as number;
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


export default SunburstSeriesModel;
