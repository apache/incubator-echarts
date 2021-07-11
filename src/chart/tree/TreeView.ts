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
import * as graphic from '../../util/graphic';
import {getECData} from '../../util/innerStore';
import SymbolClz from '../helper/Symbol';
import {radialCoordinate} from './layoutHelper';
import * as bbox from 'zrender/src/core/bbox';
import View from '../../coord/View';
import * as roamHelper from '../../component/helper/roamHelper';
import RoamController, { RoamControllerHost } from '../../component/helper/RoamController';
import {onIrrelevantElement} from '../../component/helper/cursorHelper';
import {parsePercent} from '../../util/number';
import ChartView from '../../view/Chart';
import TreeSeriesModel, { TreeSeriesOption, TreeSeriesNodeItemOption } from './TreeSeries';
import Path, { PathProps, PathStyleProps } from 'zrender/src/graphic/Path';
import GlobalModel from '../../model/Global';
import ExtensionAPI from '../../core/ExtensionAPI';
import { TreeNode } from '../../data/Tree';
import List from '../../data/List';
import { setStatesStylesFromModel, setStatesFlag, setDefaultStateProxy, HOVER_STATE_BLUR } from '../../util/states';
import { AnimationOption, ECElement } from '../../util/types';

type TreeSymbol = SymbolClz & {
    __edge: graphic.BezierCurve | TreePath

    __radialOldRawX: number
    __radialOldRawY: number
    __radialRawX: number
    __radialRawY: number

    __oldX: number
    __oldY: number
};

class TreeEdgeShape {
    parentPoint: number[] = [];
    childPoints: number[][] = [];
    orient: TreeSeriesOption['orient'];
    forkPosition: TreeSeriesOption['edgeForkPosition'];
}

interface TreeEdgePathProps extends PathProps {
    shape?: Partial<TreeEdgeShape>
}

interface TreeNodeLayout {
    x: number
    y: number
    rawX: number
    rawY: number
}

class TreePath extends Path<TreeEdgePathProps> {
    shape: TreeEdgeShape;
    constructor(opts?: TreeEdgePathProps) {
        super(opts);
    }

    getDefaultStyle() {
        return {
            stroke: '#000',
            fill: null as string
        };
    }

    getDefaultShape() {
        return new TreeEdgeShape();
    }

    buildPath(ctx: CanvasRenderingContext2D, shape: TreeEdgeShape) {
        const childPoints = shape.childPoints;
        const childLen = childPoints.length;
        const parentPoint = shape.parentPoint;
        const firstChildPos = childPoints[0];
        const lastChildPos = childPoints[childLen - 1];

        if (childLen === 1) {
            ctx.moveTo(parentPoint[0], parentPoint[1]);
            ctx.lineTo(firstChildPos[0], firstChildPos[1]);
            return;
        }

        const orient = shape.orient;
        const forkDim = (orient === 'TB' || orient === 'BT') ? 0 : 1;
        const otherDim = 1 - forkDim;
        const forkPosition = parsePercent(shape.forkPosition, 1);
        const tmpPoint = [];
        tmpPoint[forkDim] = parentPoint[forkDim];
        tmpPoint[otherDim] = parentPoint[otherDim] + (lastChildPos[otherDim] - parentPoint[otherDim]) * forkPosition;

        ctx.moveTo(parentPoint[0], parentPoint[1]);
        ctx.lineTo(tmpPoint[0], tmpPoint[1]);
        ctx.moveTo(firstChildPos[0], firstChildPos[1]);
        tmpPoint[forkDim] = firstChildPos[forkDim];
        ctx.lineTo(tmpPoint[0], tmpPoint[1]);
        tmpPoint[forkDim] = lastChildPos[forkDim];
        ctx.lineTo(tmpPoint[0], tmpPoint[1]);
        ctx.lineTo(lastChildPos[0], lastChildPos[1]);

        for (let i = 1; i < childLen - 1; i++) {
            const point = childPoints[i];
            ctx.moveTo(point[0], point[1]);
            tmpPoint[forkDim] = point[forkDim];
            ctx.lineTo(tmpPoint[0], tmpPoint[1]);
        }
    }
}

class TreeView extends ChartView {

    static readonly type = 'tree';
    readonly type = TreeView.type;

    private _mainGroup = new graphic.Group();

    private _controller: RoamController;
    private _controllerHost: RoamControllerHost;

    private _data: List<TreeSeriesModel>;

    private _nodeScaleRatio: number;
    private _min: number[];
    private _max: number[];

    init(ecModel: GlobalModel, api: ExtensionAPI) {


        this._controller = new RoamController(api.getZr());

        this._controllerHost = {
            target: this.group
        } as RoamControllerHost;

        this.group.add(this._mainGroup);
    }

    render(
        seriesModel: TreeSeriesModel,
        ecModel: GlobalModel,
        api: ExtensionAPI
    ) {
        const data = seriesModel.getData();

        const layoutInfo = seriesModel.layoutInfo;

        const group = this._mainGroup;

        const layout = seriesModel.get('layout');

        if (layout === 'radial') {
            group.x = layoutInfo.x + layoutInfo.width / 2;
            group.y = layoutInfo.y + layoutInfo.height / 2;
        }
        else {
            group.x = layoutInfo.x;
            group.y = layoutInfo.y;
        }

        this._updateViewCoordSys(seriesModel);
        this._updateController(seriesModel, ecModel, api);

        const oldData = this._data;

        data.diff(oldData)
            .add(function (newIdx) {
                if (symbolNeedsDraw(data, newIdx)) {
                    // Create node and edge
                    updateNode(data, newIdx, null, group, seriesModel);
                }
            })
            .update(function (newIdx, oldIdx) {
                const symbolEl = oldData.getItemGraphicEl(oldIdx) as TreeSymbol;
                if (!symbolNeedsDraw(data, newIdx)) {
                    symbolEl && removeNode(oldData, oldIdx, symbolEl, group, seriesModel);
                    return;
                }
                // Update node and edge
                updateNode(data, newIdx, symbolEl, group, seriesModel);
            })
            .remove(function (oldIdx) {
                const symbolEl = oldData.getItemGraphicEl(oldIdx) as TreeSymbol;
                // When remove a collapsed node of subtree, since the collapsed
                // node haven't been initialized with a symbol element,
                // you can't found it's symbol element through index.
                // so if we want to remove the symbol element we should insure
                // that the symbol element is not null.
                if (symbolEl) {
                    removeNode(oldData, oldIdx, symbolEl, group, seriesModel);
                }
            })
            .execute();

        this._nodeScaleRatio = seriesModel.get('nodeScaleRatio');

        this._updateNodeAndLinkScale(seriesModel);

        if (seriesModel.get('expandAndCollapse') === true) {
            data.eachItemGraphicEl(function (el, dataIndex) {
                el.off('click').on('click', function () {
                    api.dispatchAction({
                        type: 'treeExpandAndCollapse',
                        seriesId: seriesModel.id,
                        dataIndex: dataIndex
                    });
                });
            });
        }
        this._data = data;
    }

    _updateViewCoordSys(seriesModel: TreeSeriesModel) {
        const data = seriesModel.getData();
        const points: number[][] = [];
        data.each(function (idx) {
            const layout = data.getItemLayout(idx);
            if (layout && !isNaN(layout.x) && !isNaN(layout.y)) {
                points.push([+layout.x, +layout.y]);
            }
        });
        const min: number[] = [];
        const max: number[] = [];
        bbox.fromPoints(points, min, max);

        // If don't Store min max when collapse the root node after roam,
        // the root node will disappear.
        const oldMin = this._min;
        const oldMax = this._max;

        // If width or height is 0
        if (max[0] - min[0] === 0) {
            min[0] = oldMin ? oldMin[0] : min[0] - 1;
            max[0] = oldMax ? oldMax[0] : max[0] + 1;
        }
        if (max[1] - min[1] === 0) {
            min[1] = oldMin ? oldMin[1] : min[1] - 1;
            max[1] = oldMax ? oldMax[1] : max[1] + 1;
        }

        const viewCoordSys = seriesModel.coordinateSystem = new View();
        viewCoordSys.zoomLimit = seriesModel.get('scaleLimit');

        viewCoordSys.setBoundingRect(min[0], min[1], max[0] - min[0], max[1] - min[1]);

        viewCoordSys.setCenter(seriesModel.get('center'));
        viewCoordSys.setZoom(seriesModel.get('zoom'));

        // Here we use viewCoordSys just for computing the 'position' and 'scale' of the group
        this.group.attr({
            x: viewCoordSys.x,
            y: viewCoordSys.y,
            scaleX: viewCoordSys.scaleX,
            scaleY: viewCoordSys.scaleY
        });

        this._min = min;
        this._max = max;
    }

    _updateController(
        seriesModel: TreeSeriesModel,
        ecModel: GlobalModel,
        api: ExtensionAPI
    ) {
        const controller = this._controller;
        const controllerHost = this._controllerHost;
        const group = this.group;
        controller.setPointerChecker(function (e, x, y) {
            const rect = group.getBoundingRect();
            rect.applyTransform(group.transform);
            return rect.contain(x, y)
                && !onIrrelevantElement(e, api, seriesModel);
        });

        controller.enable(seriesModel.get('roam'));
        controllerHost.zoomLimit = seriesModel.get('scaleLimit');
        controllerHost.zoom = seriesModel.coordinateSystem.getZoom();

        controller
            .off('pan')
            .off('zoom')
            .on('pan', (e) => {
                roamHelper.updateViewOnPan(controllerHost, e.dx, e.dy);
                api.dispatchAction({
                    seriesId: seriesModel.id,
                    type: 'treeRoam',
                    dx: e.dx,
                    dy: e.dy
                });
            })
            .on('zoom', (e) => {
                roamHelper.updateViewOnZoom(controllerHost, e.scale, e.originX, e.originY);
                api.dispatchAction({
                    seriesId: seriesModel.id,
                    type: 'treeRoam',
                    zoom: e.scale,
                    originX: e.originX,
                    originY: e.originY
                });
                this._updateNodeAndLinkScale(seriesModel);
                // Only update label layout on zoom
                api.updateLabelLayout();
            });
    }

    _updateNodeAndLinkScale(seriesModel: TreeSeriesModel) {
        const data = seriesModel.getData();

        const nodeScale = this._getNodeGlobalScale(seriesModel);

        data.eachItemGraphicEl(function (el: SymbolClz, idx) {
            el.setSymbolScale(nodeScale);
        });
    }

    _getNodeGlobalScale(seriesModel: TreeSeriesModel) {
        const coordSys = seriesModel.coordinateSystem;
        if (coordSys.type !== 'view') {
            return 1;
        }

        const nodeScaleRatio = this._nodeScaleRatio;

        const groupZoom = coordSys.scaleX || 1;
        // Scale node when zoom changes
        const roamZoom = coordSys.getZoom();
        const nodeScale = (roamZoom - 1) * nodeScaleRatio + 1;

        return nodeScale / groupZoom;
    }

    dispose() {
        this._controller && this._controller.dispose();
        this._controllerHost = null;
    }

    remove() {
        this._mainGroup.removeAll();
        this._data = null;
    }

}

function symbolNeedsDraw(data: List, dataIndex: number) {
    const layout = data.getItemLayout(dataIndex);

    return layout
        && !isNaN(layout.x) && !isNaN(layout.y);
}


function updateNode(
    data: List,
    dataIndex: number,
    symbolEl: TreeSymbol,
    group: graphic.Group,
    seriesModel: TreeSeriesModel
) {
    const isInit = !symbolEl;
    const node = data.tree.getNodeByDataIndex(dataIndex);
    const itemModel = node.getModel<TreeSeriesNodeItemOption>();
    const visualColor = (node.getVisual('style') as PathStyleProps).fill;
    const symbolInnerColor = node.isExpand === false && node.children.length !== 0
            ? visualColor : '#fff';

    const virtualRoot = data.tree.root;

    const source = node.parentNode === virtualRoot ? node : node.parentNode || node;
    const sourceSymbolEl = data.getItemGraphicEl(source.dataIndex) as TreeSymbol;
    const sourceLayout = source.getLayout() as TreeNodeLayout;
    const sourceOldLayout = sourceSymbolEl
        ? {
            x: sourceSymbolEl.__oldX,
            y: sourceSymbolEl.__oldY,
            rawX: sourceSymbolEl.__radialOldRawX,
            rawY: sourceSymbolEl.__radialOldRawY
        }
        : sourceLayout;
    const targetLayout = node.getLayout();

    if (isInit) {
        symbolEl = new SymbolClz(data, dataIndex, null, {
            symbolInnerColor,
            useNameLabel: true
        }) as TreeSymbol;
        symbolEl.x = sourceOldLayout.x;
        symbolEl.y = sourceOldLayout.y;
    }
    else {
        symbolEl.updateData(data, dataIndex, null, {
            symbolInnerColor,
            useNameLabel: true
        });
    }

    symbolEl.__radialOldRawX = symbolEl.__radialRawX;
    symbolEl.__radialOldRawY = symbolEl.__radialRawY;
    symbolEl.__radialRawX = targetLayout.rawX;
    symbolEl.__radialRawY = targetLayout.rawY;

    group.add(symbolEl);
    data.setItemGraphicEl(dataIndex, symbolEl);

    symbolEl.__oldX = symbolEl.x;
    symbolEl.__oldY = symbolEl.y;

    graphic.updateProps(symbolEl, {
        x: targetLayout.x,
        y: targetLayout.y
    }, seriesModel);

    const symbolPath = symbolEl.getSymbolPath();

    if (seriesModel.get('layout') === 'radial') {
        const realRoot = virtualRoot.children[0];
        const rootLayout = realRoot.getLayout();
        const length = realRoot.children.length;
        let rad;
        let isLeft;

        if (targetLayout.x === rootLayout.x && node.isExpand === true) {
            const center = {
                x: (realRoot.children[0].getLayout().x + realRoot.children[length - 1].getLayout().x) / 2,
                y: (realRoot.children[0].getLayout().y + realRoot.children[length - 1].getLayout().y) / 2
            };
            rad = Math.atan2(center.y - rootLayout.y, center.x - rootLayout.x);
            if (rad < 0) {
                rad = Math.PI * 2 + rad;
            }
            isLeft = center.x < rootLayout.x;
            if (isLeft) {
                rad = rad - Math.PI;
            }
        }
        else {
            rad = Math.atan2(targetLayout.y - rootLayout.y, targetLayout.x - rootLayout.x);
            if (rad < 0) {
                rad = Math.PI * 2 + rad;
            }
            if (node.children.length === 0 || (node.children.length !== 0 && node.isExpand === false)) {
                isLeft = targetLayout.x < rootLayout.x;
                if (isLeft) {
                    rad = rad - Math.PI;
                }
            }
            else {
                isLeft = targetLayout.x > rootLayout.x;
                if (!isLeft) {
                    rad = rad - Math.PI;
                }
            }
        }

        const textPosition = isLeft ? 'left' as const : 'right' as const;
        const normalLabelModel = itemModel.getModel('label');
        const rotate = normalLabelModel.get('rotate');
        const labelRotateRadian = rotate * (Math.PI / 180);

        const textContent = symbolPath.getTextContent();
        if (textContent) {
            symbolPath.setTextConfig({
                position: normalLabelModel.get('position') || textPosition,
                rotation: rotate == null ? -rad : labelRotateRadian,
                origin: 'center'
            });
            textContent.setStyle('verticalAlign', 'middle');
        }

    }

    // Handle status
    const focus = itemModel.get(['emphasis', 'focus']);
    const focusDataIndices: number[] = focus === 'ancestor'
        ? node.getAncestorsIndices()
        : focus === 'descendant' ? node.getDescendantIndices() : null;

    if (focusDataIndices) {
        // Modify the focus to data indices.
        getECData(symbolEl).focus = focusDataIndices;
    }

    drawEdge(
        seriesModel, node, virtualRoot, symbolEl, sourceOldLayout,
        sourceLayout, targetLayout, group
    );

    if (symbolEl.__edge) {
        (symbolEl as ECElement).onHoverStateChange = function (toState) {
            if (toState !== 'blur') {
                // NOTE: Ensure the parent elements will been blurred firstly.
                // According to the return of getAncestorsIndices and getDescendantIndices
                // TODO: A bit tricky.
                const parentEl = node.parentNode
                    && data.getItemGraphicEl(node.parentNode.dataIndex);
                if (!(parentEl && (parentEl as ECElement).hoverState === HOVER_STATE_BLUR)) {
                    setStatesFlag(symbolEl.__edge, toState);
                }
            }
        };
    }
}

function drawEdge(
    seriesModel: TreeSeriesModel,
    node: TreeNode,
    virtualRoot: TreeNode,
    symbolEl: TreeSymbol,
    sourceOldLayout: TreeNodeLayout,
    sourceLayout: TreeNodeLayout,
    targetLayout: TreeNodeLayout,
    group: graphic.Group
) {
    const itemModel = node.getModel<TreeSeriesNodeItemOption>();
    const edgeShape = seriesModel.get('edgeShape');
    const layout = seriesModel.get('layout');
    const orient = seriesModel.getOrient();
    const curvature = seriesModel.get(['lineStyle', 'curveness']);
    const edgeForkPosition = seriesModel.get('edgeForkPosition');
    const lineStyle = itemModel.getModel('lineStyle').getLineStyle();
    let edge = symbolEl.__edge;
    if (edgeShape === 'curve') {
        if (node.parentNode && node.parentNode !== virtualRoot) {
            if (!edge) {
                edge = symbolEl.__edge = new graphic.BezierCurve({
                    shape: getEdgeShape(layout, orient, curvature, sourceOldLayout, sourceOldLayout)
                });
            }

            graphic.updateProps(edge as Path, {
                shape: getEdgeShape(layout, orient, curvature, sourceLayout, targetLayout)
            }, seriesModel);
        }
    }
    else if (edgeShape === 'polyline') {
        if (layout === 'orthogonal') {
            if (node !== virtualRoot && node.children && (node.children.length !== 0) && (node.isExpand === true)) {
                const children = node.children;
                const childPoints = [];
                for (let i = 0; i < children.length; i++) {
                    const childLayout = children[i].getLayout();
                    childPoints.push([childLayout.x, childLayout.y]);
                }

                if (!edge) {
                    edge = symbolEl.__edge = new TreePath({
                        shape: {
                            parentPoint: [targetLayout.x, targetLayout.y],
                            childPoints: [[targetLayout.x, targetLayout.y]],
                            orient: orient,
                            forkPosition: edgeForkPosition
                        }
                    });
                }
                graphic.updateProps(edge as Path, {
                    shape: {
                        parentPoint: [targetLayout.x, targetLayout.y],
                        childPoints: childPoints
                    }
                }, seriesModel);
            }
        }
        else {
            if (__DEV__) {
                throw new Error('The polyline edgeShape can only be used in orthogonal layout');
            }
        }
    }

    if (edge) {
        edge.useStyle(zrUtil.defaults({
            strokeNoScale: true, fill: null
        }, lineStyle));

        setStatesStylesFromModel(edge, itemModel, 'lineStyle');
        setDefaultStateProxy(edge);

        group.add(edge);
    }
}

function removeNodeEdge(
    node: TreeNode,
    data: List,
    group: graphic.Group,
    seriesModel: TreeSeriesModel,
    removeAnimationOpt: AnimationOption
) {
    const virtualRoot = data.tree.root;
    const { source, sourceLayout } = getSourceNode(virtualRoot, node);

    const symbolEl: TreeSymbol = data.getItemGraphicEl(node.dataIndex) as TreeSymbol;

    if (!symbolEl) {
        return;
    }

    const sourceSymbolEl = data.getItemGraphicEl(source.dataIndex) as TreeSymbol;
    const sourceEdge = sourceSymbolEl.__edge;

    // 1. when expand the sub tree, delete the children node should delete the edge of
    // the source at the same time. because the polyline edge shape is only owned by the source.
    // 2.when the node is the only children of the source, delete the node should delete the edge of
    // the source at the same time. the same reason as above.
    const edge = symbolEl.__edge
        || ((source.isExpand === false || source.children.length === 1) ? sourceEdge : undefined);

    const edgeShape = seriesModel.get('edgeShape');
    const layoutOpt = seriesModel.get('layout');
    const orient = seriesModel.get('orient');
    const curvature = seriesModel.get(['lineStyle', 'curveness']);

    if (edge) {
        if (edgeShape === 'curve') {
            graphic.removeElement(edge as Path, {
                shape: getEdgeShape(
                    layoutOpt,
                    orient,
                    curvature,
                    sourceLayout,
                    sourceLayout
                ),
                style: {
                    opacity: 0
                }
            }, seriesModel, {
                cb() {
                    group.remove(edge);
                },
                removeOpt: removeAnimationOpt
            });
        }
        else if (edgeShape === 'polyline' && seriesModel.get('layout') === 'orthogonal') {
            graphic.removeElement(edge as Path, {
                shape: {
                    parentPoint: [sourceLayout.x, sourceLayout.y],
                    childPoints: [[sourceLayout.x, sourceLayout.y]]
                },
                style: {
                    opacity: 0
                }
            }, seriesModel, {
                cb() {
                    group.remove(edge);
                },
                removeOpt: removeAnimationOpt
            });
        }
    }
}

function getSourceNode(virtualRoot: TreeNode, node: TreeNode): { source: TreeNode, sourceLayout: TreeNodeLayout } {
    let source = node.parentNode === virtualRoot ? node : node.parentNode || node;
    let sourceLayout;
    while (sourceLayout = source.getLayout(), sourceLayout == null) {
        source = source.parentNode === virtualRoot ? source : source.parentNode || source;
    }
    return {
        source,
        sourceLayout
    };
}

function removeNode(
    data: List,
    dataIndex: number,
    symbolEl: TreeSymbol,
    group: graphic.Group,
    seriesModel: TreeSeriesModel
) {
    const node = data.tree.getNodeByDataIndex(dataIndex);
    const virtualRoot = data.tree.root;

    const { sourceLayout } = getSourceNode(virtualRoot, node);

    // Use same duration and easing with update to have more consistent animation.
    const removeAnimationOpt = {
        duration: seriesModel.get('animationDurationUpdate') as number,
        easing: seriesModel.get('animationEasingUpdate')
    };

    graphic.removeElement(symbolEl, {
        x: sourceLayout.x + 1,
        y: sourceLayout.y + 1
    }, seriesModel, {
        cb() {
            group.remove(symbolEl);
            data.setItemGraphicEl(dataIndex, null);
        },
        removeOpt: removeAnimationOpt
    });

    symbolEl.fadeOut(null, {
        fadeLabel: true,
        animation: removeAnimationOpt
    });

    // remove edge as parent node
    node.children.forEach(childNode => {
        removeNodeEdge(childNode, data, group, seriesModel, removeAnimationOpt);
    });
    // remove edge as child node
    removeNodeEdge(node, data, group, seriesModel, removeAnimationOpt);
}

function getEdgeShape(
    layoutOpt: TreeSeriesOption['layout'],
    orient: TreeSeriesOption['orient'],
    curvature: number,
    sourceLayout: TreeNodeLayout,
    targetLayout: TreeNodeLayout
) {
    let cpx1: number;
    let cpy1: number;
    let cpx2: number;
    let cpy2: number;
    let x1: number;
    let x2: number;
    let y1: number;
    let y2: number;

    if (layoutOpt === 'radial') {
        x1 = sourceLayout.rawX;
        y1 = sourceLayout.rawY;
        x2 = targetLayout.rawX;
        y2 = targetLayout.rawY;

        const radialCoor1 = radialCoordinate(x1, y1);
        const radialCoor2 = radialCoordinate(x1, y1 + (y2 - y1) * curvature);
        const radialCoor3 = radialCoordinate(x2, y2 + (y1 - y2) * curvature);
        const radialCoor4 = radialCoordinate(x2, y2);

        return {
            x1: radialCoor1.x || 0,
            y1: radialCoor1.y || 0,
            x2: radialCoor4.x || 0,
            y2: radialCoor4.y || 0,
            cpx1: radialCoor2.x || 0,
            cpy1: radialCoor2.y || 0,
            cpx2: radialCoor3.x || 0,
            cpy2: radialCoor3.y || 0
        };
    }
    else {
        x1 = sourceLayout.x;
        y1 = sourceLayout.y;
        x2 = targetLayout.x;
        y2 = targetLayout.y;

        if (orient === 'LR' || orient === 'RL') {
            cpx1 = x1 + (x2 - x1) * curvature;
            cpy1 = y1;
            cpx2 = x2 + (x1 - x2) * curvature;
            cpy2 = y2;
        }
        if (orient === 'TB' || orient === 'BT') {
            cpx1 = x1;
            cpy1 = y1 + (y2 - y1) * curvature;
            cpx2 = x2;
            cpy2 = y2 + (y1 - y2) * curvature;
        }
    }

    return {
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        cpx1: cpx1,
        cpy1: cpy1,
        cpx2: cpx2,
        cpy2: cpy2
    };
}

export default TreeView;