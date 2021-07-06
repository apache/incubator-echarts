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
 * Grid is a region which contains at most 4 cartesian systems
 *
 * TODO Default cartesian
 */

import {isObject, each, indexOf, retrieve3} from 'zrender/src/core/util';
import {getLayoutRect, LayoutRect} from '../../util/layout';
import {
    createScaleByModel,
    ifAxisCrossZero,
    niceScaleExtent,
    estimateLabelUnionRect,
    getDataDimensionsOnAxis
} from '../../coord/axisHelper';
import IntervalScale from '../../scale/Interval';
import Cartesian2D, {cartesian2DDimensions} from './Cartesian2D';
import Axis2D from './Axis2D';
import {ParsedModelFinder, ParsedModelFinderKnown, SINGLE_REFERRING} from '../../util/model';

// Depends on GridModel, AxisModel, which performs preprocess.
import GridModel from './GridModel';
import CartesianAxisModel from './AxisModel';
import GlobalModel from '../../model/Global';
import ExtensionAPI from '../../core/ExtensionAPI';
import { Dictionary } from 'zrender/src/core/types';
import {CoordinateSystemMaster} from '../CoordinateSystem';
import { ScaleDataValue } from '../../util/types';
import List from '../../data/List';
import OrdinalScale from '../../scale/Ordinal';
import { isCartesian2DSeries, findAxisModels } from './cartesianAxisHelper';
import { round } from '../../util/number';


type Cartesian2DDimensionName = 'x' | 'y';

type FinderAxisIndex = {xAxisIndex?: number, yAxisIndex?: number};
type AxesMap = {x: Axis2D[], y: Axis2D[]};

class Grid implements CoordinateSystemMaster {

    // FIXME:TS where used (different from registered type 'cartesian2d')?
    readonly type: string = 'grid';

    private _coordsMap: Dictionary<Cartesian2D> = {};
    private _coordsList: Cartesian2D[] = [];
    private _axesMap: AxesMap = {} as AxesMap;
    private _axesList: Axis2D[] = [];
    private _rect: LayoutRect;

    readonly model: GridModel;
    readonly axisPointerEnabled = true;

    // Injected:
    name: string;

    // For deciding which dimensions to use when creating list data
    static dimensions = cartesian2DDimensions;
    readonly dimensions = cartesian2DDimensions;

    constructor(gridModel: GridModel, ecModel: GlobalModel, api: ExtensionAPI) {
        this._initCartesian(gridModel, ecModel, api);
        this.model = gridModel;
    }

    getRect(): LayoutRect {
        return this._rect;
    }

    calAxisNiceSplitNumber(axes: Axis2D[]): [number[], number] {
        const splitNumArr: number[] = [];
        const niceAxisExtents: number[] = [];
        let maxSplitNumber = 0;
        each(axes, axis => {
            niceScaleExtent(axis.scale, axis.model);
            if (axis.type !== 'value') {
                return;
            }
            const extent = axis.scale.getExtent();
            const interval = (axis.scale as IntervalScale).getInterval();
            const splitNumber = round(extent[1] - extent[0]) / interval;
            splitNumArr.push(splitNumber);
            maxSplitNumber = (splitNumber > maxSplitNumber) ? splitNumber : maxSplitNumber;
            const axisExtent = axis.getExtent();
            niceAxisExtents.push((axisExtent[1] - axisExtent[0]) * interval / extent[1]);
        });

        return [splitNumArr, maxSplitNumber];
    }

    resetAxisExtent(axes: Axis2D[], splitNumber: number[], maxSplitNumber: number) {
        let finalSplitNum: number = 0;
        each(axes, function (axis, index) {
            if (axis.type !== 'value') {
                return;
            }

            if (!(maxSplitNumber - splitNumber[index])) {
                finalSplitNum = maxSplitNumber > finalSplitNum ? maxSplitNumber : finalSplitNum;
                return;
            };

            const extent = axis.scale.getExtent();
            const interval = (axis.scale as IntervalScale).getInterval();
            let splitNum = round(extent[1] - extent[0]) / interval;

            if ((Math.abs(Math.round(splitNum) - splitNum)) < 1e-8) {
                extent[1] = extent[1] + (maxSplitNumber - splitNumber[index]) * interval;
                niceScaleExtent(axis.scale, axis.model, extent, maxSplitNumber);
            }
            else {
                const extentRound = round(extent[1] - extent[0]);
                const preferredInterval = axis.model.get('interval')
                    || (extentRound - (extentRound % maxSplitNumber)) / maxSplitNumber;
                (axis.scale as IntervalScale).niceTicks(
                    maxSplitNumber + 1, null, null,
                    preferredInterval
                );
            }
            const finalScaleExtent = axis.scale.getExtent();
            const finalInterval = (axis.scale as IntervalScale).getInterval();
            splitNum = round(finalScaleExtent[1] - finalScaleExtent[0]) / finalInterval;
            finalSplitNum = splitNum > finalSplitNum ? splitNum : finalSplitNum;
        });

        return Math.ceil(finalSplitNum);
    }

    update(ecModel: GlobalModel, api: ExtensionAPI): void {

        const axesMap = this._axesMap;

        this._updateScale(ecModel, this.model);

        const [niceSplitNumX, maxNiceSplitNumX] = this.calAxisNiceSplitNumber(axesMap.x);
        const [niceSplitNumY, maxNiceSplitNumY] = this.calAxisNiceSplitNumber(axesMap.y);
        const finalSplitNumberY = this.resetAxisExtent(axesMap.y, niceSplitNumY, maxNiceSplitNumY);
        const finalSplitNumberX = this.resetAxisExtent(axesMap.x, niceSplitNumX, maxNiceSplitNumX);

        // Key: axisDim_axisIndex, value: boolean, whether onZero target.
        const onZeroRecords = {} as Dictionary<boolean>;

        each(axesMap.x, function (xAxis) {
            fixAxisOnZero(axesMap, 'y', xAxis, onZeroRecords);
        });
        each(axesMap.y, function (yAxis) {
            fixAxisOnZero(axesMap, 'x', yAxis, onZeroRecords);
        });

        // Resize again if containLabel is enabled
        // FIXME It may cause getting wrong grid size in data processing stage
        this.resize(this.model, api);

        this.adjustValueAxes(axesMap.y, finalSplitNumberY);
        this.adjustValueAxes(axesMap.x, finalSplitNumberX);
    }

    adjustValueAxes(axesList: Axis2D[], finalSplitNumber: number) {
        each(axesList, axis => {
            const isHorizontal = axis.isHorizontal();
            const gridExtent = isHorizontal ? this._rect.width : this._rect.height;
            axis.setGridExtent(0, gridExtent);
            if (axis.type !== 'value') {
                return;
            }
            const unionExtent = gridExtent / finalSplitNumber;
            const [extentStart, extentEnd] = axis.scale.getExtent();
            const [niceExtent] = (axis.scale as IntervalScale).getNiceExtent();
            const interval = (axis.scale as IntervalScale).getInterval();
            const offset = niceExtent === extentStart ? extentStart : niceExtent - interval;
            const start = unionExtent * ((extentStart - offset) / interval);
            const end = unionExtent * (extentEnd - offset) / interval;
            axis.setExtent(start, end);
        });
    }

    /**
     * Resize the grid
     */
    resize(gridModel: GridModel, api: ExtensionAPI, ignoreContainLabel?: boolean): void {

        const boxLayoutParams = gridModel.getBoxLayoutParams();
        const isContainLabel = !ignoreContainLabel && gridModel.get('containLabel');

        const gridRect = getLayoutRect(
            boxLayoutParams, {
                width: api.getWidth(),
                height: api.getHeight()
            });

        this._rect = gridRect;

        const axesList = this._axesList;

        adjustAxes();

        // Minus label size
        if (isContainLabel) {
            each(axesList, function (axis) {
                if (!axis.model.get(['axisLabel', 'inside'])) {
                    const labelUnionRect = estimateLabelUnionRect(axis);
                    if (labelUnionRect) {
                        const dim: 'height' | 'width' = axis.isHorizontal() ? 'height' : 'width';
                        const margin = axis.model.get(['axisLabel', 'margin']);
                        gridRect[dim] -= labelUnionRect[dim] + margin;
                        if (axis.position === 'top') {
                            gridRect.y += labelUnionRect.height + margin;
                        }
                        else if (axis.position === 'left') {
                            gridRect.x += labelUnionRect.width + margin;
                        }
                    }
                }
            });

            adjustAxes();
        }

        each(this._coordsList, function (coord) {
            // Calculate affine matrix to accelerate the data to point transform.
            // If all the axes scales are time or value.
            coord.calcAffineTransform();
        });

        function adjustAxes() {
            each(axesList, function (axis) {
                const isHorizontal = axis.isHorizontal();
                const extent = isHorizontal ? [0, gridRect.width] : [0, gridRect.height];
                const idx = axis.inverse ? 1 : 0;
                axis.setExtent(extent[idx], extent[1 - idx]);
                updateAxisTransform(axis, isHorizontal ? gridRect.x : gridRect.y);
            });
        }
    }

    getAxis(dim: Cartesian2DDimensionName, axisIndex?: number): Axis2D {
        const axesMapOnDim = this._axesMap[dim];
        if (axesMapOnDim != null) {
            return axesMapOnDim[axisIndex || 0];
            // if (axisIndex == null) {
            //     Find first axis
            //     for (let name in axesMapOnDim) {
            //         if (axesMapOnDim.hasOwnProperty(name)) {
            //             return axesMapOnDim[name];
            //         }
            //     }
            // }
            // return axesMapOnDim[axisIndex];
        }
    }

    getAxes(): Axis2D[] {
        return this._axesList.slice();
    }

    /**
     * Usage:
     *      grid.getCartesian(xAxisIndex, yAxisIndex);
     *      grid.getCartesian(xAxisIndex);
     *      grid.getCartesian(null, yAxisIndex);
     *      grid.getCartesian({xAxisIndex: ..., yAxisIndex: ...});
     *
     * When only xAxisIndex or yAxisIndex given, find its first cartesian.
     */
    getCartesian(finder: FinderAxisIndex): Cartesian2D;
    getCartesian(xAxisIndex?: number, yAxisIndex?: number): Cartesian2D;
    getCartesian(xAxisIndex?: number | FinderAxisIndex, yAxisIndex?: number) {
        if (xAxisIndex != null && yAxisIndex != null) {
            const key = 'x' + xAxisIndex + 'y' + yAxisIndex;
            return this._coordsMap[key];
        }

        if (isObject(xAxisIndex)) {
            yAxisIndex = (xAxisIndex as FinderAxisIndex).yAxisIndex;
            xAxisIndex = (xAxisIndex as FinderAxisIndex).xAxisIndex;
        }
        for (let i = 0, coordList = this._coordsList; i < coordList.length; i++) {
            if (coordList[i].getAxis('x').index === xAxisIndex
                || coordList[i].getAxis('y').index === yAxisIndex
            ) {
                return coordList[i];
            }
        }
    }

    getCartesians(): Cartesian2D[] {
        return this._coordsList.slice();
    }

    /**
     * @implements
     */
    convertToPixel(
        ecModel: GlobalModel, finder: ParsedModelFinder, value: ScaleDataValue | ScaleDataValue[]
    ): number | number[] {
        const target = this._findConvertTarget(finder);

        return target.cartesian
            ? target.cartesian.dataToPoint(value as ScaleDataValue[])
            : target.axis
            ? target.axis.toGlobalCoord(target.axis.dataToCoord(value as ScaleDataValue))
            : null;
    }

    /**
     * @implements
     */
    convertFromPixel(
        ecModel: GlobalModel, finder: ParsedModelFinder, value: number | number[]
    ): number | number[] {
        const target = this._findConvertTarget(finder);

        return target.cartesian
            ? target.cartesian.pointToData(value as number[])
            : target.axis
            ? target.axis.coordToData(target.axis.toLocalCoord(value as number))
            : null;
    }

    private _findConvertTarget(finder: ParsedModelFinderKnown): {
        cartesian: Cartesian2D,
        axis: Axis2D
    } {
        const seriesModel = finder.seriesModel;
        const xAxisModel = finder.xAxisModel
            || (seriesModel && seriesModel.getReferringComponents('xAxis', SINGLE_REFERRING).models[0]);
        const yAxisModel = finder.yAxisModel
            || (seriesModel && seriesModel.getReferringComponents('yAxis', SINGLE_REFERRING).models[0]);
        const gridModel = finder.gridModel;
        const coordsList = this._coordsList;
        let cartesian: Cartesian2D;
        let axis;

        if (seriesModel) {
            cartesian = seriesModel.coordinateSystem as Cartesian2D;
            indexOf(coordsList, cartesian) < 0 && (cartesian = null);
        }
        else if (xAxisModel && yAxisModel) {
            cartesian = this.getCartesian(xAxisModel.componentIndex, yAxisModel.componentIndex);
        }
        else if (xAxisModel) {
            axis = this.getAxis('x', xAxisModel.componentIndex);
        }
        else if (yAxisModel) {
            axis = this.getAxis('y', yAxisModel.componentIndex);
        }
        // Lowest priority.
        else if (gridModel) {
            const grid = gridModel.coordinateSystem;
            if (grid === this) {
                cartesian = this._coordsList[0];
            }
        }

        return {cartesian: cartesian, axis: axis};
    }

    /**
     * @implements
     */
    containPoint(point: number[]): boolean {
        const coord = this._coordsList[0];
        if (coord) {
            return coord.containPoint(point);
        }
    }

    /**
     * Initialize cartesian coordinate systems
     */
    private _initCartesian(
        gridModel: GridModel, ecModel: GlobalModel, api: ExtensionAPI
    ): void {
        const grid = this;
        const axisPositionUsed = {
            left: false,
            right: false,
            top: false,
            bottom: false
        };

        const axesMap = {
            x: {},
            y: {}
        } as AxesMap;
        const axesCount = {
            x: 0,
            y: 0
        };

        /// Create axis
        ecModel.eachComponent('xAxis', createAxisCreator('x'), this);
        ecModel.eachComponent('yAxis', createAxisCreator('y'), this);

        if (!axesCount.x || !axesCount.y) {
            // Roll back when there no either x or y axis
            this._axesMap = {} as AxesMap;
            this._axesList = [];
            return;
        }

        this._axesMap = axesMap;

        /// Create cartesian2d
        each(axesMap.x, (xAxis, xAxisIndex) => {
            each(axesMap.y, (yAxis, yAxisIndex) => {
                const key = 'x' + xAxisIndex + 'y' + yAxisIndex;
                const cartesian = new Cartesian2D(key);

                cartesian.master = this;
                cartesian.model = gridModel;

                this._coordsMap[key] = cartesian;
                this._coordsList.push(cartesian);

                cartesian.addAxis(xAxis);
                cartesian.addAxis(yAxis);
            });
        });

        function createAxisCreator(dimName: Cartesian2DDimensionName) {
            return function (axisModel: CartesianAxisModel, idx: number): void {
                if (!isAxisUsedInTheGrid(axisModel, gridModel)) {
                    return;
                }

                let axisPosition = axisModel.get('position');
                if (dimName === 'x') {
                    // Fix position
                    if (axisPosition !== 'top' && axisPosition !== 'bottom') {
                        // Default bottom of X
                        axisPosition = axisPositionUsed.bottom ? 'top' : 'bottom';
                    }
                }
                else {
                    // Fix position
                    if (axisPosition !== 'left' && axisPosition !== 'right') {
                        // Default left of Y
                        axisPosition = axisPositionUsed.left ? 'right' : 'left';
                    }
                }
                axisPositionUsed[axisPosition] = true;

                const axis = new Axis2D(
                    dimName,
                    createScaleByModel(axisModel),
                    [0, 0],
                    axisModel.get('type'),
                    axisPosition
                );

                const isCategory = axis.type === 'category';
                axis.onBand = isCategory && axisModel.get('boundaryGap');
                axis.inverse = axisModel.get('inverse');

                // Inject axis into axisModel
                axisModel.axis = axis;

                // Inject axisModel into axis
                axis.model = axisModel;

                // Inject grid info axis
                axis.grid = grid;

                // Index of axis, can be used as key
                axis.index = idx;

                grid._axesList.push(axis);

                axesMap[dimName][idx] = axis;
                axesCount[dimName]++;
            };
        }
    }

    /**
     * Update cartesian properties from series.
     */
    private _updateScale(ecModel: GlobalModel, gridModel: GridModel): void {
        // Reset scale
        each(this._axesList, function (axis) {
            axis.scale.setExtent(Infinity, -Infinity);
            if (axis.type === 'category') {
                const categorySortInfo = axis.model.get('categorySortInfo');
                (axis.scale as OrdinalScale).setSortInfo(categorySortInfo);
            }
        });

        ecModel.eachSeries(function (seriesModel) {
            if (isCartesian2DSeries(seriesModel)) {
                const axesModelMap = findAxisModels(seriesModel);
                const xAxisModel = axesModelMap.xAxisModel;
                const yAxisModel = axesModelMap.yAxisModel;

                if (!isAxisUsedInTheGrid(xAxisModel, gridModel)
                    || !isAxisUsedInTheGrid(yAxisModel, gridModel)
                ) {
                    return;
                }

                const cartesian = this.getCartesian(
                    xAxisModel.componentIndex, yAxisModel.componentIndex
                );
                const data = seriesModel.getData();
                const xAxis = cartesian.getAxis('x');
                const yAxis = cartesian.getAxis('y');

                if (data.type === 'list') {
                    unionExtent(data, xAxis);
                    unionExtent(data, yAxis);
                }
            }
        }, this);

        function unionExtent(data: List, axis: Axis2D): void {
            each(getDataDimensionsOnAxis(data, axis.dim), function (dim) {
                axis.scale.unionExtentFromData(data, dim);
            });
        }
    }

    /**
     * @param dim 'x' or 'y' or 'auto' or null/undefined
     */
    getTooltipAxes(dim: Cartesian2DDimensionName | 'auto'): {
        baseAxes: Axis2D[], otherAxes: Axis2D[]
    } {
        const baseAxes = [] as Axis2D[];
        const otherAxes = [] as Axis2D[];

        each(this.getCartesians(), function (cartesian) {
            const baseAxis = (dim != null && dim !== 'auto')
                ? cartesian.getAxis(dim) : cartesian.getBaseAxis();
            const otherAxis = cartesian.getOtherAxis(baseAxis);
            indexOf(baseAxes, baseAxis) < 0 && baseAxes.push(baseAxis);
            indexOf(otherAxes, otherAxis) < 0 && otherAxes.push(otherAxis);
        });

        return {baseAxes: baseAxes, otherAxes: otherAxes};
    }


    static create(ecModel: GlobalModel, api: ExtensionAPI): Grid[] {
        const grids = [] as Grid[];
        ecModel.eachComponent('grid', function (gridModel: GridModel, idx) {
            const grid = new Grid(gridModel, ecModel, api);
            grid.name = 'grid_' + idx;
            // dataSampling requires axis extent, so resize
            // should be performed in create stage.
            grid.resize(gridModel, api, true);

            gridModel.coordinateSystem = grid;

            grids.push(grid);
        });

        // Inject the coordinateSystems into seriesModel
        ecModel.eachSeries(function (seriesModel) {
            if (!isCartesian2DSeries(seriesModel)) {
                return;
            }

            const axesModelMap = findAxisModels(seriesModel);
            const xAxisModel = axesModelMap.xAxisModel;
            const yAxisModel = axesModelMap.yAxisModel;

            const gridModel = xAxisModel.getCoordSysModel();

            if (__DEV__) {
                if (!gridModel) {
                    throw new Error(
                        'Grid "' + retrieve3(
                            xAxisModel.get('gridIndex'),
                            xAxisModel.get('gridId'),
                            0
                        ) + '" not found'
                    );
                }
                if (xAxisModel.getCoordSysModel() !== yAxisModel.getCoordSysModel()) {
                    throw new Error('xAxis and yAxis must use the same grid');
                }
            }

            const grid = gridModel.coordinateSystem as Grid;

            seriesModel.coordinateSystem = grid.getCartesian(
                xAxisModel.componentIndex, yAxisModel.componentIndex
            );
        });

        return grids;
    }

}

/**
 * Check if the axis is used in the specified grid.
 */
function isAxisUsedInTheGrid(axisModel: CartesianAxisModel, gridModel: GridModel): boolean {
    return axisModel.getCoordSysModel() === gridModel;
}

function fixAxisOnZero(
    axesMap: AxesMap,
    otherAxisDim: Cartesian2DDimensionName,
    axis: Axis2D,
    // Key: see `getOnZeroRecordKey`
    onZeroRecords: Dictionary<boolean>
): void {

    axis.getAxesOnZeroOf = function () {
        // TODO: onZero of multiple axes.
        return otherAxisOnZeroOf ? [otherAxisOnZeroOf] : [];
    };

    // onZero can not be enabled in these two situations:
    // 1. When any other axis is a category axis.
    // 2. When no axis is cross 0 point.
    const otherAxes = axesMap[otherAxisDim];

    let otherAxisOnZeroOf: Axis2D;
    const axisModel = axis.model;
    const onZero = axisModel.get(['axisLine', 'onZero']);
    const onZeroAxisIndex = axisModel.get(['axisLine', 'onZeroAxisIndex']);

    if (!onZero) {
        return;
    }

    // If target axis is specified.
    if (onZeroAxisIndex != null) {
        if (canOnZeroToAxis(otherAxes[onZeroAxisIndex])) {
            otherAxisOnZeroOf = otherAxes[onZeroAxisIndex];
        }
    }
    else {
        // Find the first available other axis.
        for (const idx in otherAxes) {
            if (otherAxes.hasOwnProperty(idx)
                && canOnZeroToAxis(otherAxes[idx])
                // Consider that two Y axes on one value axis,
                // if both onZero, the two Y axes overlap.
                && !onZeroRecords[getOnZeroRecordKey(otherAxes[idx])]
            ) {
                otherAxisOnZeroOf = otherAxes[idx];
                break;
            }
        }
    }

    if (otherAxisOnZeroOf) {
        onZeroRecords[getOnZeroRecordKey(otherAxisOnZeroOf)] = true;
    }

    function getOnZeroRecordKey(axis: Axis2D) {
        return axis.dim + '_' + axis.index;
    }
}

function canOnZeroToAxis(axis: Axis2D): boolean {
    return axis && axis.type !== 'category' && axis.type !== 'time' && ifAxisCrossZero(axis);
}

function updateAxisTransform(axis: Axis2D, coordBase: number) {
    const axisExtent = axis.getExtent();
    const axisExtentSum = axisExtent[0] + axisExtent[1];

    // Fast transform
    axis.toGlobalCoord = axis.dim === 'x'
        ? function (coord) {
            return coord + coordBase;
        }
        : function (coord) {
            return axisExtentSum - coord + coordBase;
        };
    axis.toLocalCoord = axis.dim === 'x'
        ? function (coord) {
            return coord - coordBase;
        }
        : function (coord) {
            return axisExtentSum - coord + coordBase;
        };
}

export default Grid;
