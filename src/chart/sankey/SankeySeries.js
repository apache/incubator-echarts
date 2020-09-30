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

import SeriesModel from '../../model/Series';
import createGraphFromNodeEdge from '../helper/createGraphFromNodeEdge';
import {encodeHTML} from '../../util/format';
import Model from '../../model/Model';
import { __DEV__ } from '../../config';

var SankeySeries = SeriesModel.extend({

    type: 'series.sankey',

    layoutInfo: null,

    levelModels: null,

    /**
     * Init a graph data structure from data in option series
     *
     * @param  {Object} option  the object used to config echarts view
     * @return {module:echarts/data/List} storage initial data
     */
    getInitialData: function (option, ecModel) {
        var links = option.edges || option.links;
        var nodes = option.data || option.nodes;
        var levels = option.levels;
        var levelModels = this.levelModels = {};

        for (var i = 0; i < levels.length; i++) {
            if (levels[i].depth != null && levels[i].depth >= 0) {
                levelModels[levels[i].depth] = new Model(levels[i], this, ecModel);
            }
            else {
                if (__DEV__) {
                    throw new Error('levels[i].depth is mandatory and should be natural number');
                }
            }
        }
        if (nodes && links) {
            var graph = createGraphFromNodeEdge(nodes, links, this, true, beforeLink);
            return graph.data;
        }
        function beforeLink(nodeData, edgeData) {
            nodeData.wrapMethod('getItemModel', function (model, idx) {
                model.customizeGetParent(function (path) {
                    var parentModel = this.parentModel;
                    var nodeDepth = parentModel.getData().getItemLayout(idx).depth;
                    var levelModel = parentModel.levelModels[nodeDepth];
                    return levelModel || this.parentModel;
                });
                return model;
            });

            edgeData.wrapMethod('getItemModel', function (model, idx) {
                model.customizeGetParent(function (path) {
                    var parentModel = this.parentModel;
                    var edge = parentModel.getGraph().getEdgeByIndex(idx);
                    var depth = edge.node1.getLayout().depth;
                    var levelModel = parentModel.levelModels[depth];
                    return levelModel || this.parentModel;
                });
                return model;
            });
        }
    },

    setNodePosition: function (dataIndex, localPosition) {
        var dataItem = this.option.data[dataIndex];
        dataItem.localX = localPosition[0];
        dataItem.localY = localPosition[1];
    },

    /**
     * Return the graphic data structure
     *
     * @return {module:echarts/data/Graph} graphic data structure
     */
    getGraph: function () {
        return this.getData().graph;
    },

    /**
     * Get edge data of graphic data structure
     *
     * @return {module:echarts/data/List} data structure of list
     */
    getEdgeData: function () {
        return this.getGraph().edgeData;
    },

    /**
     * @override
     */
    formatTooltip: function (dataIndex, multipleSeries, dataType) {
        // dataType === 'node' or empty do not show tooltip by default
        if (dataType === 'edge') {
            var params = this.getDataParams(dataIndex, dataType);
            var rawDataOpt = params.data;
            var html = rawDataOpt.source + ' -- ' + rawDataOpt.target;
            if (params.value) {
                html += ' : ' + params.value;
            }
            return encodeHTML(html);
        }
        else if (dataType === 'node') {
            var node = this.getGraph().getNodeByIndex(dataIndex);
            var value = node.getLayout().value;
            var name = this.getDataParams(dataIndex, dataType).data.name;
            if (value) {
                var html = name + ' : ' + value;
            }
            return encodeHTML(html);
        }
        return SankeySeries.superCall(this, 'formatTooltip', dataIndex, multipleSeries);
    },

    optionUpdated: function () {
        var option = this.option;
        if (option.focusNodeAdjacency === true) {
            option.focusNodeAdjacency = 'allEdges';
        }
    },

    // Override Series.getDataParams()
    getDataParams: function (dataIndex, dataType) {
        var params = SankeySeries.superCall(this, 'getDataParams', dataIndex, dataType);
        if (params.value == null && dataType === 'node') {
            var node = this.getGraph().getNodeByIndex(dataIndex);
            var nodeValue = node.getLayout().value;
            params.value = nodeValue;
        }
        return params;
    },

    defaultOption: {
        zlevel: 0,
        z: 2,

        coordinateSystem: 'view',

        layout: null,

        // The position of the whole view
        left: '5%',
        top: '5%',
        right: '20%',
        bottom: '5%',

        // Value can be 'vertical'
        orient: 'horizontal',

        // Value can be 'uneven'
        mode: 'normal',

        // The dx of the node
        nodeWidth: 20,

        // The vertical distance between two nodes
        nodeGap: 8,

        // Control if the node can move or not
        draggable: true,

        // Value can be 'inEdges', 'outEdges', 'allEdges', true (the same as 'allEdges').
        focusNodeAdjacency: false,

        // The number of iterations to change the position of the node
        layoutIterations: 32,

        label: {
            show: true,
            position: 'right',
            color: '#000',
            fontSize: 12
        },

        levels: [],

        // Value can be 'left' or 'right'
        nodeAlign: 'justify',

        itemStyle: {
            borderWidth: 1,
            borderColor: '#333'
        },

        lineStyle: {
            color: '#314656',
            opacity: 0.2,
            curveness: 0.5
        },

        emphasis: {
            label: {
                show: true
            },
            lineStyle: {
                opacity: 0.5
            }
        },

        animationEasing: 'linear',

        animationDuration: 1000
    }

});

export default SankeySeries;