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

import { lift } from 'zrender/src/tool/color';
import { extend, map } from 'zrender/src/core/util';
import GlobalModel from '../../model/Global';
import SunburstSeriesModel, { SunburstSeriesNodeItemOption } from './SunburstSeries';
import { Dictionary, ColorString, ZRColor } from '../../util/types';
import { setItemVisualFromData } from '../../visual/helper';
import { TreeNode } from '../../data/Tree';

type ParentColorMap = {
    node: TreeNode,
    parentColor: ZRColor
};

export default function sunburstVisual(ecModel: GlobalModel) {

    const paletteScope: Dictionary<ColorString> = {};

    // Default color strategy
    function pickColor(node: TreeNode, seriesModel: SunburstSeriesModel, treeHeight: number) {
        // Choose color from palette based on the first level.
        let current = node;
        while (current && current.depth > 1) {
            current = current.parentNode;
        }
        let color = seriesModel.getColorFromPalette((current.name || current.dataIndex + ''), paletteScope);
        if (node.depth > 1 && typeof color === 'string') {
            // Lighter on the deeper level.
            color = lift(color, (node.depth - 1) / (treeHeight - 1) * 0.5);
        }
        return color;
    }

    ecModel.eachSeriesByType('sunburst', function (seriesModel: SunburstSeriesModel) {
        const data = seriesModel.getData();
        const tree = data.tree;

        tree.eachNode(function (node) {
            const model = node.getModel<SunburstSeriesNodeItemOption>();
            const style = model.getModel('itemStyle').getItemStyle();

            if (!style.fill) {
                style.fill = pickColor(node, seriesModel, tree.root.height);
            }

            const existsStyle = data.ensureUniqueItemVisual(node.dataIndex, 'style');
            extend(existsStyle, style);
        });

        // TODO: This following code is for sunburst color mapping on levels and items,
        // which is not ready for release untill we decide what to do with treemap similarly.
        // if (!tree.root.children || tree.root.children.length === 0) {
        //     return;
        // }

        // const levels = seriesModel.get('levels');
        // const level0Color = levels.length > 1 && levels[0].itemStyle && levels[0].itemStyle.color || '#ccc';
        // setItemVisualFromData(data, 0, 'color', level0Color);

        // let nodeMapList: ParentColorMap[] = map(tree.root.children, node => {
        //     return {
        //         node,
        //         parentColor: level0Color
        //     };
        // }) ;
        // while (nodeMapList.length) {
        //     const nodeMap = nodeMapList.shift();
        //     const node = nodeMap.node;
        //     const model = node.getModel<SunburstSeriesNodeItemOption>();
        //     const style = model.getModel('itemStyle').getItemStyle();
        //     let color: ZRColor;

        //     if (!style.fill) {
        //         switch (model.get('colorBy')) {
        //             case 'id':
        //                 color = seriesModel.getColorFromPalette(node.getId(), paletteScope);
        //                 break;

        //             case 'dataIndex':
        //                 color = seriesModel.getColorFromPalette(node.dataIndex + '', paletteScope);
        //                 break;

        //             case 'name':
        //                 color = seriesModel.getColorFromPalette(node.name || (node.dataIndex + ''), paletteScope);
        //                 break;

        //             case 'childIndex':
        //                 color = seriesModel.getColorFromPalette(node.getChildIndex() + '', paletteScope);
        //                 break;

        //             case 'lighter':
        //                 if (typeof nodeMap.parentColor === 'string') {
        //                     color = lift(nodeMap.parentColor, (node.depth - 1) / (tree.root.height - 1) * 0.5);
        //                     break;
        //                 }
        //                 // Else, gradient or pattern, use 'inherit'
        //                 // No "break;" here
        //                 // TODO: support gradient in lift

        //             case 'inherit':
        //             default:
        //                 color = nodeMap.parentColor || seriesModel.getColorFromPalette('0', paletteScope);
        //                 break;
        //         }
        //     }
        //     else {
        //         color = style.fill;
        //     }

        //     const existsStyle = data.ensureUniqueItemVisual(node.dataIndex, 'style');
        //     extend(existsStyle, style);

        //     setItemVisualFromData(data, node.dataIndex, 'color', color);

        //     nodeMapList = map(node.children, node => {
        //         return {
        //             node,
        //             parentColor: color
        //         };
        //     }).concat(nodeMapList);
        // }
    });
}
