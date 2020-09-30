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
 * @file Sunburst action
 */

import * as echarts from '../../echarts';
import * as helper from '../helper/treeHelper';

var ROOT_TO_NODE_ACTION = 'sunburstRootToNode';

echarts.registerAction(
    {type: ROOT_TO_NODE_ACTION, update: 'updateView'},
    function (payload, ecModel) {

        ecModel.eachComponent(
            {mainType: 'series', subType: 'sunburst', query: payload},
            handleRootToNode
        );

        function handleRootToNode(model, index) {
            var targetInfo = helper
                .retrieveTargetInfo(payload, [ROOT_TO_NODE_ACTION], model);

            if (targetInfo) {
                var originViewRoot = model.getViewRoot();
                if (originViewRoot) {
                    payload.direction = helper.aboveViewRoot(originViewRoot, targetInfo.node)
                        ? 'rollUp' : 'drillDown';
                }
                model.resetViewRoot(targetInfo.node);
            }
        }
    }
);


var HIGHLIGHT_ACTION = 'sunburstHighlight';

echarts.registerAction(
    {type: HIGHLIGHT_ACTION, update: 'updateView'},
    function (payload, ecModel) {

        ecModel.eachComponent(
            {mainType: 'series', subType: 'sunburst', query: payload},
            handleHighlight
        );

        function handleHighlight(model, index) {
            var targetInfo = helper
                .retrieveTargetInfo(payload, [HIGHLIGHT_ACTION], model);

            if (targetInfo) {
                payload.highlight = targetInfo.node;
            }
        }
    }
);


var UNHIGHLIGHT_ACTION = 'sunburstUnhighlight';

echarts.registerAction(
    {type: UNHIGHLIGHT_ACTION, update: 'updateView'},
    function (payload, ecModel) {

        ecModel.eachComponent(
            {mainType: 'series', subType: 'sunburst', query: payload},
            handleUnhighlight
        );

        function handleUnhighlight(model, index) {
            payload.unhighlight = true;
        }
    }
);

const SHOWTIP_ACTION = 'sunburstShowTip';

echarts.registerAction(
    {type: SHOWTIP_ACTION, update: 'update'},
    function (payload, ecModel) {
        ecModel.eachComponent(
            {mainType: 'series', subType: 'sunburst', query: payload},
            handleShowTip
        );

        function handleShowTip(model, index) {
            var targetInfo = helper
                .retrieveTargetInfo(payload, [SHOWTIP_ACTION], model);

            if (targetInfo) {
                const {targetNodeId, postion} = payload;
                const {dataIndex, seriesIndex} = targetInfo.node.piece;

                window.chart.dispatchAction({
                    type: 'showTip',
                    targetNodeId,
                    name: targetNodeId,
                    postion,
                    dataIndex,
                    seriesIndex
                });
            }
        }
    }
);
