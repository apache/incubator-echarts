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

import * as layout from '../../util/layout';
import * as zrUtil from 'zrender/src/core/util';
import {groupData} from '../../util/model';

export default function (ecModel, api, payload) {

    ecModel.eachSeriesByType('sankey', function (seriesModel) {

        var nodeWidth = seriesModel.get('nodeWidth');
        var nodeGap = seriesModel.get('nodeGap');

        var mode = seriesModel.get('mode');

        var layoutInfo = getViewRect(seriesModel, api);

        seriesModel.layoutInfo = layoutInfo;

        var width = layoutInfo.width;
        var height = layoutInfo.height;

        var graph = seriesModel.getGraph();

        var nodes = graph.nodes;
        var edges = graph.edges;

        computeNodeValues(nodes, mode);

        var filteredNodes = zrUtil.filter(nodes, function (node) {
            return node.getLayout().value === 0;
        });

        var iterations = filteredNodes.length !== 0 ? 0 : seriesModel.get('layoutIterations');

        var orient = seriesModel.get('orient');

        var nodeAlign = seriesModel.get('nodeAlign');

        layoutSankey(nodes, edges, nodeWidth, nodeGap, width, height, iterations, orient, nodeAlign);
    });
}

/**
 * Get the layout position of the whole view
 *
 * @param {module:echarts/model/Series} seriesModel  the model object of sankey series
 * @param {module:echarts/ExtensionAPI} api  provide the API list that the developer can call
 * @return {module:zrender/core/BoundingRect}  size of rect to draw the sankey view
 */
function getViewRect(seriesModel, api) {
    return layout.getLayoutRect(
        seriesModel.getBoxLayoutParams(), {
            width: api.getWidth(),
            height: api.getHeight()
        }
    );
}

function layoutSankey(nodes, edges, nodeWidth, nodeGap, width, height, iterations, orient, nodeAlign) {
    computeNodeBreadths(nodes, edges, nodeWidth, width, height, orient, nodeAlign);
    computeNodeDepths(nodes, edges, height, width, nodeGap, iterations, orient);
    computeEdgeDepths(nodes, orient);
}

/**
 * Compute the value of each node by summing the associated edge's value
 *
 * @param {module:echarts/data/Graph~Node} nodes  node of sankey view
 * @param {string} mode  mode of sankey view
 */
function computeNodeValues(nodes, mode) {
    var isUnevenMode = mode === 'uneven';
    zrUtil.each(nodes, function (node) {
        var value1 = sum(node.outEdges, getEdgeValue);
        var value2 = sum(node.inEdges, getEdgeValue);
        var nodeRawValue = node.getValue() || 0;
        var value = Math.max(value1, value2, nodeRawValue);
        if (isUnevenMode) {
          value = nodeRawValue || value;
        }
        node.setLayout({value: value}, true);
    });
}

/**
 * Compute the x-position for each node.
 *
 * Here we use Kahn algorithm to detect cycle when we traverse
 * the node to computer the initial x position.
 *
 * @param {module:echarts/data/Graph~Node} nodes  node of sankey view
 * @param  {number} nodeWidth  the dx of the node
 * @param  {number} width  the whole width of the area to draw the view
 */
function computeNodeBreadths(nodes, edges, nodeWidth, width, height, orient, nodeAlign) {
    // Used to mark whether the edge is deleted. if it is deleted,
    // the value is 0, otherwise it is 1.
    var remainEdges = [];
    // Storage each node's indegree.
    var indegreeArr = [];
    //Used to storage the node with indegree is equal to 0.
    var zeroIndegrees = [];
    var nextTargetNode = [];
    var x = 0;
    var kx = 0;

    for (var i = 0; i < edges.length; i++) {
        remainEdges[i] = 1;
    }
    for (i = 0; i < nodes.length; i++) {
        indegreeArr[i] = nodes[i].inEdges.length;
        if (indegreeArr[i] === 0) {
            zeroIndegrees.push(nodes[i]);
        }
    }
    var maxNodeDepth = -1;
    // Traversing nodes using topological sorting to calculate the
    // horizontal(if orient === 'horizontal') or vertical(if orient === 'vertical')
    // position of the nodes.
    while (zeroIndegrees.length) {
        for (var idx = 0; idx < zeroIndegrees.length; idx++) {
            var node = zeroIndegrees[idx];
            var item = node.hostGraph.data.getRawDataItem(node.dataIndex);
            var isItemDepth = item.depth != null && item.depth >= 0;
            if (isItemDepth && item.depth > maxNodeDepth) {
                maxNodeDepth = item.depth;
            }
            node.setLayout({depth: isItemDepth ? item.depth : x}, true);
            orient === 'vertical'
                ? node.setLayout({dy: nodeWidth}, true)
                : node.setLayout({dx: nodeWidth}, true);

            for (var edgeIdx = 0; edgeIdx < node.outEdges.length; edgeIdx++) {
                var edge = node.outEdges[edgeIdx];
                var indexEdge = edges.indexOf(edge);
                remainEdges[indexEdge] = 0;
                var targetNode = edge.node2;
                var nodeIndex = nodes.indexOf(targetNode);
                if (--indegreeArr[nodeIndex] === 0 && nextTargetNode.indexOf(targetNode) < 0) {
                    nextTargetNode.push(targetNode);
                }
            }
        }
        ++x;
        zeroIndegrees = nextTargetNode;
        nextTargetNode = [];
    }

    for (i = 0; i < remainEdges.length; i++) {
        if (remainEdges[i] === 1) {
            throw new Error('Sankey is a DAG, the original data has cycle!');
        }
    }

    var maxDepth = maxNodeDepth > x - 1 ? maxNodeDepth : x - 1;
    if (nodeAlign && nodeAlign !== 'left') {
        adjustNodeWithNodeAlign(nodes, nodeAlign, orient, maxDepth);
    }
    var kx = orient === 'vertical'
                ? (height - nodeWidth) / maxDepth
                : (width - nodeWidth) / maxDepth;

    scaleNodeBreadths(nodes, kx, orient);
}

function isNodeDepth(node) {
    var item = node.hostGraph.data.getRawDataItem(node.dataIndex);
    return item.depth != null && item.depth >= 0;
}

function adjustNodeWithNodeAlign(nodes, nodeAlign, orient, maxDepth) {
    if (nodeAlign === 'right') {
        var nextSourceNode = [];
        var remainNodes = nodes;
        var nodeHeight = 0;
        while (remainNodes.length) {
            for (var i = 0; i < remainNodes.length; i++) {
                var node = remainNodes[i];
                node.setLayout({skNodeHeight: nodeHeight}, true);
                for (var j = 0; j < node.inEdges.length; j++) {
                    var edge = node.inEdges[j];
                    if (nextSourceNode.indexOf(edge.node1) < 0) {
                        nextSourceNode.push(edge.node1);
                    }
                }
            }
            remainNodes = nextSourceNode;
            nextSourceNode = [];
            ++nodeHeight;
        }

        zrUtil.each(nodes, function (node) {
            if (!isNodeDepth(node)) {
                node.setLayout({depth: Math.max(0, maxDepth - node.getLayout().skNodeHeight)}, true);
            }
        });
    }
    else if (nodeAlign === 'justify') {
        moveSinksRight(nodes, maxDepth);
    }
}

/**
 * All the node without outEgdes are assigned maximum x-position and
 *     be aligned in the last column.
 *
 * @param {module:echarts/data/Graph~Node} nodes.  node of sankey view.
 * @param {number} maxDepth.  use to assign to node without outEdges as x-position.
 */
function moveSinksRight(nodes, maxDepth) {
    zrUtil.each(nodes, function (node) {
        if (!isNodeDepth(node) && !node.outEdges.length) {
            node.setLayout({depth: maxDepth}, true);
        }
    });
}

/**
 * Scale node x-position to the width
 *
 * @param {module:echarts/data/Graph~Node} nodes  node of sankey view
 * @param {number} kx   multiple used to scale nodes
 */
function scaleNodeBreadths(nodes, kx, orient) {
    zrUtil.each(nodes, function (node) {
        var nodeDepth = node.getLayout().depth * kx;
        orient === 'vertical'
            ? node.setLayout({y: nodeDepth}, true)
            : node.setLayout({x: nodeDepth}, true);
    });
}

/**
 * Using Gauss-Seidel iterations method to compute the node depth(y-position)
 *
 * @param {module:echarts/data/Graph~Node} nodes  node of sankey view
 * @param {module:echarts/data/Graph~Edge} edges  edge of sankey view
 * @param {number} height  the whole height of the area to draw the view
 * @param {number} nodeGap  the vertical distance between two nodes
 *     in the same column.
 * @param {number} iterations  the number of iterations for the algorithm
 */
function computeNodeDepths(nodes, edges, height, width, nodeGap, iterations, orient) {
    var nodesByBreadth = prepareNodesByBreadth(nodes, orient);

    initializeNodeDepth(nodesByBreadth, edges, height, width, nodeGap, orient);
    resolveCollisions(nodesByBreadth, nodeGap, height, width, orient);

    for (var alpha = 1; iterations > 0; iterations--) {
        // 0.99 is a experience parameter, ensure that each iterations of
        // changes as small as possible.
        alpha *= 0.99;
        relaxRightToLeft(nodesByBreadth, alpha, orient);
        resolveCollisions(nodesByBreadth, nodeGap, height, width, orient);
        relaxLeftToRight(nodesByBreadth, alpha, orient);
        resolveCollisions(nodesByBreadth, nodeGap, height, width, orient);
    }
}

function prepareNodesByBreadth(nodes, orient) {
    var nodesByBreadth = [];
    var keyAttr = orient === 'vertical' ? 'y' : 'x';

    var groupResult = groupData(nodes, function (node) {
        return node.getLayout()[keyAttr];
    });
    groupResult.keys.sort(function (a, b) {
        return a - b;
    });
    zrUtil.each(groupResult.keys, function (key) {
        nodesByBreadth.push(groupResult.buckets.get(key));
    });

    return nodesByBreadth;
}

/**
 * Compute the original y-position for each node
 *
 * @param {module:echarts/data/Graph~Node} nodes  node of sankey view
 * @param {Array.<Array.<module:echarts/data/Graph~Node>>} nodesByBreadth
 *     group by the array of all sankey nodes based on the nodes x-position.
 * @param {module:echarts/data/Graph~Edge} edges  edge of sankey view
 * @param {number} height  the whole height of the area to draw the view
 * @param {number} nodeGap  the vertical distance between two nodes
 */
function initializeNodeDepth(nodesByBreadth, edges, height, width, nodeGap, orient) {
    var minKy = Infinity;
    zrUtil.each(nodesByBreadth, function (nodes) {
        var n = nodes.length;
        var sum = 0;
        zrUtil.each(nodes, function (node) {
            sum += node.getLayout().value;
        });
        var ky = orient === 'vertical'
                    ? (width - (n - 1) * nodeGap) / sum
                    : (height - (n - 1) * nodeGap) / sum;

        if (ky < minKy) {
            minKy = ky;
        }
    });

    zrUtil.each(nodesByBreadth, function (nodes) {
        zrUtil.each(nodes, function (node, i) {
            var nodeDy = node.getLayout().value * minKy;
            if (orient === 'vertical') {
                node.setLayout({x: i}, true);
                node.setLayout({dx: nodeDy}, true);
            }
            else {
                node.setLayout({y: i}, true);
                node.setLayout({dy: nodeDy}, true);
            }
        });
    });

    zrUtil.each(edges, function (edge) {
        var edgeDy = +edge.getValue() * minKy;
        edge.setLayout({dy: edgeDy}, true);
    });
}

/**
 * Resolve the collision of initialized depth (y-position)
 *
 * @param {Array.<Array.<module:echarts/data/Graph~Node>>} nodesByBreadth
 *     group by the array of all sankey nodes based on the nodes x-position.
 * @param {number} nodeGap  the vertical distance between two nodes
 * @param {number} height  the whole height of the area to draw the view
 */
function resolveCollisions(nodesByBreadth, nodeGap, height, width, orient) {
    var keyAttr = orient === 'vertical' ? 'x' : 'y';
    zrUtil.each(nodesByBreadth, function (nodes) {
        nodes.sort(function (a, b) {
            return a.getLayout()[keyAttr] - b.getLayout()[keyAttr];
        });
        var nodeX;
        var node;
        var dy;
        var y0 = 0;
        var n = nodes.length;
        var nodeDyAttr = orient === 'vertical' ? 'dx' : 'dy';
        for (var i = 0; i < n; i++) {
            node = nodes[i];
            dy = y0 - node.getLayout()[keyAttr];
            if (dy > 0) {
                nodeX = node.getLayout()[keyAttr] + dy;
                orient === 'vertical'
                    ? node.setLayout({x: nodeX}, true)
                    : node.setLayout({y: nodeX}, true);
            }
            y0 = node.getLayout()[keyAttr] + node.getLayout()[nodeDyAttr] + nodeGap;
        }
        var viewWidth = orient === 'vertical' ? width : height;
        // If the bottommost node goes outside the bounds, push it back up
        dy = y0 - nodeGap - viewWidth;
        if (dy > 0) {
            nodeX = node.getLayout()[keyAttr] - dy;
            orient === 'vertical'
                ? node.setLayout({x: nodeX}, true)
                : node.setLayout({y: nodeX}, true);

            y0 = nodeX;
            for (i = n - 2; i >= 0; --i) {
                node = nodes[i];
                dy = node.getLayout()[keyAttr] + node.getLayout()[nodeDyAttr] + nodeGap - y0;
                if (dy > 0) {
                    nodeX = node.getLayout()[keyAttr] - dy;
                    orient === 'vertical'
                        ? node.setLayout({x: nodeX}, true)
                        : node.setLayout({y: nodeX}, true);
                }
                y0 = node.getLayout()[keyAttr];
            }
        }
    });
}

/**
 * Change the y-position of the nodes, except most the right side nodes
 *
 * @param {Array.<Array.<module:echarts/data/Graph~Node>>} nodesByBreadth
 *     group by the array of all sankey nodes based on the node x-position.
 * @param {number} alpha  parameter used to adjust the nodes y-position
 */
function relaxRightToLeft(nodesByBreadth, alpha, orient) {
    zrUtil.each(nodesByBreadth.slice().reverse(), function (nodes) {
        zrUtil.each(nodes, function (node) {
            if (node.outEdges.length) {
                var y = sum(node.outEdges, weightedTarget, orient)
                    / sum(node.outEdges, getEdgeValue, orient);

                if (isNaN(y)) {
                    var len = node.outEdges.length;
                    y = len ? sum(node.outEdges, centerTarget, orient) / len : 0;
                }

                if (orient === 'vertical') {
                    var nodeX = node.getLayout().x + (y - center(node, orient)) * alpha;
                    node.setLayout({x: nodeX}, true);
                }
                else {
                    var nodeY = node.getLayout().y + (y - center(node, orient)) * alpha;
                    node.setLayout({y: nodeY}, true);
                }
            }
        });
    });
}

function weightedTarget(edge, orient) {
    return center(edge.node2, orient) * edge.getValue();
}
function centerTarget(edge, orient) {
    return center(edge.node2, orient);
}

function weightedSource(edge, orient) {
    return center(edge.node1, orient) * edge.getValue();
}
function centerSource(edge, orient) {
    return center(edge.node1, orient);
}

function center(node, orient) {
    return orient === 'vertical'
            ? node.getLayout().x + node.getLayout().dx / 2
            : node.getLayout().y + node.getLayout().dy / 2;
}

function getEdgeValue(edge) {
    return edge.getValue();
}

function sum(array, cb, orient) {
    var sum = 0;
    var len = array.length;
    var i = -1;
    while (++i < len) {
        var value = +cb.call(array, array[i], orient);
        if (!isNaN(value)) {
            sum += value;
        }
    }
    return sum;
}

/**
 * Change the y-position of the nodes, except most the left side nodes
 *
 * @param {Array.<Array.<module:echarts/data/Graph~Node>>} nodesByBreadth
 *     group by the array of all sankey nodes based on the node x-position.
 * @param {number} alpha  parameter used to adjust the nodes y-position
 */
function relaxLeftToRight(nodesByBreadth, alpha, orient) {
    zrUtil.each(nodesByBreadth, function (nodes) {
        zrUtil.each(nodes, function (node) {
            if (node.inEdges.length) {

                var y = sum(node.inEdges, weightedSource, orient)
                    / sum(node.inEdges, getEdgeValue, orient);

                if (isNaN(y)) {
                    var len = node.inEdges.length;
                    y = len ? sum(node.inEdges, centerSource, orient) / len : 0;
                }

                if (orient === 'vertical') {
                    var nodeX = node.getLayout().x + (y - center(node, orient)) * alpha;
                    node.setLayout({x: nodeX}, true);
                }
                else {
                    var nodeY = node.getLayout().y + (y - center(node, orient)) * alpha;
                    node.setLayout({y: nodeY}, true);
                }
            }
        });
    });
}

/**
 * Compute the depth(y-position) of each edge
 *
 * @param {module:echarts/data/Graph~Node} nodes  node of sankey view
 */
function computeEdgeDepths(nodes, orient) {
    var keyAttr = orient === 'vertical' ? 'x' : 'y';
    zrUtil.each(nodes, function (node) {
        node.outEdges.sort(function (a, b) {
            return a.node2.getLayout()[keyAttr] - b.node2.getLayout()[keyAttr];
        });
        node.inEdges.sort(function (a, b) {
            return a.node1.getLayout()[keyAttr] - b.node1.getLayout()[keyAttr];
        });
    });
    zrUtil.each(nodes, function (node) {
        var sy = 0;
        var ty = 0;
        zrUtil.each(node.outEdges, function (edge) {
            edge.setLayout({sy: sy}, true);
            sy += edge.getLayout().dy;
        });
        zrUtil.each(node.inEdges, function (edge) {
            edge.setLayout({ty: ty}, true);
            ty += edge.getLayout().dy;
        });
    });
}