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

import List from '../../data/List';
import * as numberUtil from '../../util/number';
import * as markerHelper from './markerHelper';
import LineDraw from '../../chart/helper/LineDraw';
import MarkerView from './MarkerView';
import { getStackedDimension } from '../../data/helper/dataStackHelper';
import { CoordinateSystem, isCoordinateSystemType } from '../../coord/CoordinateSystem';
import MarkLineModel, { MarkLine2DDataItemOption, MarkLineOption } from './MarkLineModel';
import { ScaleDataValue, ColorString } from '../../util/types';
import SeriesModel from '../../model/Series';
import { getECData } from '../../util/innerStore';
import ExtensionAPI from '../../core/ExtensionAPI';
import Cartesian2D from '../../coord/cartesian/Cartesian2D';
import GlobalModel from '../../model/Global';
import MarkerModel from './MarkerModel';
import {
    isArray,
    retrieve,
    retrieve2,
    clone,
    extend,
    logError,
    merge,
    map,
    defaults,
    curry,
    filter,
    HashMap
} from 'zrender/src/core/util';
import { makeInner } from '../../util/model';
import { LineDataVisual } from '../../visual/commonVisualTypes';
import { getVisualFromData } from '../../visual/helper';
import Axis2D from '../../coord/cartesian/Axis2D';

// Item option for configuring line and each end of symbol.
// Line option. be merged from configuration of two ends.
type MarkLineMergedItemOption = MarkLine2DDataItemOption[number];

const inner = makeInner<{
    // from data
    from: List<MarkLineModel>
    // to data
    to: List<MarkLineModel>
}, MarkLineModel>();

const markLineTransform = function (
    seriesModel: SeriesModel,
    coordSys: CoordinateSystem,
    mlModel: MarkLineModel,
    item: MarkLineOption['data'][number]
) {
    const data = seriesModel.getData();

    let itemArray: MarkLineMergedItemOption[];
    if (!isArray(item)) {
        // Special type markLine like 'min', 'max', 'average', 'median'
        const mlType = item.type;
        if (
            mlType === 'min' || mlType === 'max' || mlType === 'average' || mlType === 'median'
            // In case
            // data: [{
            //   yAxis: 10
            // }]
            || (item.xAxis != null || item.yAxis != null)
        ) {

            let valueAxis;
            let value;

            if (item.yAxis != null || item.xAxis != null) {
                valueAxis = coordSys.getAxis(item.yAxis != null ? 'y' : 'x');
                value = retrieve(item.yAxis, item.xAxis);
            }
            else {
                const axisInfo = markerHelper.getAxisInfo(item, data, coordSys, seriesModel);
                valueAxis = axisInfo.valueAxis;
                const valueDataDim = getStackedDimension(data, axisInfo.valueDataDim);
                value = markerHelper.numCalculate(data, valueDataDim, mlType);
            }
            const valueIndex = valueAxis.dim === 'x' ? 0 : 1;
            const baseIndex = 1 - valueIndex;

            // Normized to 2d data with start and end point
            const mlFrom = clone(item) as MarkLine2DDataItemOption[number];
            const mlTo = {
                coord: []
            } as MarkLine2DDataItemOption[number];

            mlFrom.type = null;

            mlFrom.coord = [];
            mlFrom.coord[baseIndex] = -Infinity;
            mlTo.coord[baseIndex] = Infinity;

            let precision = mlModel.get('precision');

            if (mlType === 'average' && precision === undefined) {
                precision = 2;
            }

            if (precision >= 0 && typeof value === 'number') {
                value = +value.toFixed(Math.min(precision, 20));
            }

            mlFrom.coord[valueIndex] = mlTo.coord[valueIndex] = value;

            itemArray = [mlFrom, mlTo, { // Extra option for tooltip and label
                type: mlType,
                valueIndex: item.valueIndex,
                // Force to use the value of calculated value.
                value: value
            }];
        }
        else {
            // Invalid data
            if (__DEV__) {
                logError('Invalid markLine data.');
            }
            itemArray = [];
        }
    }
    else {
        itemArray = item;
    }

    const normalizedItem = [
        markerHelper.dataTransform(seriesModel, itemArray[0]),
        markerHelper.dataTransform(seriesModel, itemArray[1]),
        extend({}, itemArray[2])
    ];

    // Avoid line data type is extended by from(to) data type
    normalizedItem[2].type = normalizedItem[2].type || null;

    // Merge from option and to option into line option
    merge(normalizedItem[2], normalizedItem[0]);
    merge(normalizedItem[2], normalizedItem[1]);

    return normalizedItem;
};

function isInifinity(val: ScaleDataValue) {
    return !isNaN(val as number) && !isFinite(val as number);
}

// If a markLine has one dim
function ifMarkLineHasOnlyDim(
    dimIndex: number,
    fromCoord: ScaleDataValue[],
    toCoord: ScaleDataValue[],
    coordSys: CoordinateSystem
) {
    const otherDimIndex = 1 - dimIndex;
    const dimName = coordSys.dimensions[dimIndex];
    return isInifinity(fromCoord[otherDimIndex]) && isInifinity(toCoord[otherDimIndex])
        && fromCoord[dimIndex] === toCoord[dimIndex] && coordSys.getAxis(dimName).containData(fromCoord[dimIndex]);
}

function markLineFilter(
    coordSys: CoordinateSystem,
    item: MarkLine2DDataItemOption
) {
    if (coordSys.type === 'cartesian2d') {
        const fromCoord = item[0].coord;
        const toCoord = item[1].coord;
        // In case
        // {
        //  markLine: {
        //    data: [{ yAxis: 2 }]
        //  }
        // }
        if (
            fromCoord && toCoord
            && (ifMarkLineHasOnlyDim(1, fromCoord, toCoord, coordSys)
                || ifMarkLineHasOnlyDim(0, fromCoord, toCoord, coordSys))
        ) {
            return true;
        }
    }
    return markerHelper.dataFilter(coordSys, item[0])
        && markerHelper.dataFilter(coordSys, item[1]);
}

function updateSingleMarkerEndLayout(
    data: List<MarkLineModel>,
    idx: number,
    isFrom: boolean,
    seriesModel: SeriesModel,
    api: ExtensionAPI
) {
    const coordSys = seriesModel.coordinateSystem;
    const itemModel = data.getItemModel<MarkLine2DDataItemOption[number]>(idx);

    let point;
    const xPx = numberUtil.parsePercent(itemModel.get('x'), api.getWidth());
    const yPx = numberUtil.parsePercent(itemModel.get('y'), api.getHeight());
    if (!isNaN(xPx) && !isNaN(yPx)) {
        point = [xPx, yPx];
    }
    else {
        // Chart like bar may have there own marker positioning logic
        if (seriesModel.getMarkerPosition) {
            // Use the getMarkerPoisition
            point = seriesModel.getMarkerPosition(
                data.getValues(data.dimensions, idx)
            );
        }
        else {
            const dims = coordSys.dimensions;
            const x = data.get(dims[0], idx);
            const y = data.get(dims[1], idx);
            point = coordSys.dataToPoint([x, y]);
        }
        // Expand line to the edge of grid if value on one axis is Inifnity
        // In case
        //  markLine: {
        //    data: [{
        //      yAxis: 2
        //      // or
        //      type: 'average'
        //    }]
        //  }
        if (isCoordinateSystemType<Cartesian2D>(coordSys, 'cartesian2d')) {
            // TODO: TYPE ts@4.1 may still infer it as Axis instead of Axis2D. Not sure if it's a bug
            const xAxis = coordSys.getAxis('x') as Axis2D;
            const yAxis = coordSys.getAxis('y') as Axis2D;
            const dims = coordSys.dimensions;
            if (isInifinity(data.get(dims[0], idx))) {
                point[0] = xAxis.toGlobalCoord(xAxis.getExtent()[isFrom ? 0 : 1]);
            }
            else if (isInifinity(data.get(dims[1], idx))) {
                point[1] = yAxis.toGlobalCoord(yAxis.getExtent()[isFrom ? 0 : 1]);
            }
        }

        // Use x, y if has any
        if (!isNaN(xPx)) {
            point[0] = xPx;
        }
        if (!isNaN(yPx)) {
            point[1] = yPx;
        }
    }

    data.setItemLayout(idx, point);
}

class MarkLineView extends MarkerView {

    static type = 'markLine';
    type = MarkLineView.type;

    markerGroupMap: HashMap<LineDraw>;

    updateTransform(markLineModel: MarkLineModel, ecModel: GlobalModel, api: ExtensionAPI) {
        ecModel.eachSeries(function (seriesModel) {
            const mlModel = MarkerModel.getMarkerModelFromSeries(seriesModel, 'markLine') as MarkLineModel;
            if (mlModel) {
                const mlData = mlModel.getData();
                const fromData = inner(mlModel).from;
                const toData = inner(mlModel).to;
                // Update visual and layout of from symbol and to symbol
                fromData.each(function (idx) {
                    updateSingleMarkerEndLayout(fromData, idx, true, seriesModel, api);
                    updateSingleMarkerEndLayout(toData, idx, false, seriesModel, api);
                });
                // Update layout of line
                mlData.each(function (idx) {
                    mlData.setItemLayout(idx, [
                        fromData.getItemLayout(idx),
                        toData.getItemLayout(idx)
                    ]);
                });

                this.markerGroupMap.get(seriesModel.id).updateLayout();

            }
        }, this);
    }

    renderSeries(
        seriesModel: SeriesModel,
        mlModel: MarkLineModel,
        ecModel: GlobalModel,
        api: ExtensionAPI
    ) {
        const coordSys = seriesModel.coordinateSystem;
        const seriesId = seriesModel.id;
        const seriesData = seriesModel.getData();

        const lineDrawMap = this.markerGroupMap;
        const lineDraw = lineDrawMap.get(seriesId)
            || lineDrawMap.set(seriesId, new LineDraw());
        this.group.add(lineDraw.group);

        const mlData = createList(coordSys, seriesModel, mlModel);

        const fromData = mlData.from;
        const toData = mlData.to;
        const lineData = mlData.line as List<MarkLineModel, LineDataVisual>;

        inner(mlModel).from = fromData;
        inner(mlModel).to = toData;
        // Line data for tooltip and formatter
        mlModel.setData(lineData);

        // TODO
        // Functionally, `symbolSize` & `symbolOffset` can also be 2D array now.
        // But the related logic and type definition are not finished yet.
        // Finish it if required
        let symbolType = mlModel.get('symbol');
        let symbolSize = mlModel.get('symbolSize');
        let symbolRotate = mlModel.get('symbolRotate');
        let symbolOffset = mlModel.get('symbolOffset');
        // TODO: support callback function like markPoint
        if (!isArray(symbolType)) {
            symbolType = [symbolType, symbolType];
        }
        if (!isArray(symbolSize)) {
            symbolSize = [symbolSize, symbolSize];
        }
        if (!isArray(symbolRotate)) {
            symbolRotate = [symbolRotate, symbolRotate];
        }
        if (!isArray(symbolOffset)) {
            symbolOffset = [symbolOffset, symbolOffset];
        }

        // Update visual and layout of from symbol and to symbol
        mlData.from.each(function (idx) {
            updateDataVisualAndLayout(fromData, idx, true);
            updateDataVisualAndLayout(toData, idx, false);
        });

        // Update visual and layout of line
        lineData.each(function (idx) {
            const lineStyle = lineData.getItemModel<MarkLineMergedItemOption>(idx)
                .getModel('lineStyle').getLineStyle();
            // lineData.setItemVisual(idx, {
            //     color: lineColor || fromData.getItemVisual(idx, 'color')
            // });
            lineData.setItemLayout(idx, [
                fromData.getItemLayout(idx),
                toData.getItemLayout(idx)
            ]);

            if (lineStyle.stroke == null) {
                lineStyle.stroke = fromData.getItemVisual(idx, 'style').fill;
            }

            lineData.setItemVisual(idx, {
                fromSymbolKeepAspect: fromData.getItemVisual(idx, 'symbolKeepAspect'),
                fromSymbolOffset: fromData.getItemVisual(idx, 'symbolOffset'),
                fromSymbolRotate: fromData.getItemVisual(idx, 'symbolRotate'),
                fromSymbolSize: fromData.getItemVisual(idx, 'symbolSize') as number,
                fromSymbol: fromData.getItemVisual(idx, 'symbol'),
                toSymbolKeepAspect: toData.getItemVisual(idx, 'symbolKeepAspect'),
                toSymbolOffset: toData.getItemVisual(idx, 'symbolOffset'),
                toSymbolRotate: toData.getItemVisual(idx, 'symbolRotate'),
                toSymbolSize: toData.getItemVisual(idx, 'symbolSize') as number,
                toSymbol: toData.getItemVisual(idx, 'symbol'),
                style: lineStyle
            });
        });

        lineDraw.updateData(lineData);

        // Set host model for tooltip
        // FIXME
        mlData.line.eachItemGraphicEl(function (el, idx) {
            el.traverse(function (child) {
                getECData(child).dataModel = mlModel;
            });
        });

        function updateDataVisualAndLayout(
            data: List<MarkLineModel>,
            idx: number,
            isFrom: boolean
        ) {
            const itemModel = data.getItemModel<MarkLineMergedItemOption>(idx);

            updateSingleMarkerEndLayout(
                data, idx, isFrom, seriesModel, api
            );

            const style = itemModel.getModel('itemStyle').getItemStyle();
            if (style.fill == null) {
                style.fill = getVisualFromData(seriesData, 'color') as ColorString;
            }

            data.setItemVisual(idx, {
                symbolKeepAspect: itemModel.get('symbolKeepAspect'),
                // `0` should be considered as a valid value, so use `retrieve2` instead of `||`
                symbolOffset: retrieve2(
                    itemModel.get('symbolOffset', true),
                    (symbolOffset as (string | number)[])[isFrom ? 0 : 1]
                ),
                symbolRotate: retrieve2(
                    itemModel.get('symbolRotate', true),
                    (symbolRotate as number[])[isFrom ? 0 : 1]
                ),
                // TODO: when 2d array is supported, it should ignore parent
                symbolSize: retrieve2(
                    itemModel.get('symbolSize'),
                    (symbolSize as number[])[isFrom ? 0 : 1]
                ),
                symbol: retrieve2(
                    itemModel.get('symbol', true),
                    (symbolType as string[])[isFrom ? 0 : 1]
                ),
                style
            });
        }

        this.markKeep(lineDraw);

        lineDraw.group.silent = mlModel.get('silent') || seriesModel.get('silent');
    }
}

function createList(coordSys: CoordinateSystem, seriesModel: SeriesModel, mlModel: MarkLineModel) {

    let coordDimsInfos;
    if (coordSys) {
        coordDimsInfos = map(coordSys && coordSys.dimensions, function (coordDim) {
            const info = seriesModel.getData().getDimensionInfo(
                seriesModel.getData().mapDimension(coordDim)
            ) || {};
            // In map series data don't have lng and lat dimension. Fallback to same with coordSys
            return defaults({ name: coordDim }, info);
        });
    }
    else {
        coordDimsInfos = [{
            name: 'value',
            type: 'float'
        }];
    }

    const fromData = new List(coordDimsInfos, mlModel);
    const toData = new List(coordDimsInfos, mlModel);
    // No dimensions
    const lineData = new List([], mlModel);

    let optData = map(mlModel.get('data'), curry(
        markLineTransform, seriesModel, coordSys, mlModel
    ));
    if (coordSys) {
        optData = filter(
            optData, curry(markLineFilter, coordSys)
        );
    }
    const dimValueGetter = coordSys ? markerHelper.dimValueGetter : function (item: MarkLineMergedItemOption) {
        return item.value;
    };
    fromData.initData(
        map(optData, function (item) {
            return item[0];
        }),
        null,
        dimValueGetter
    );
    toData.initData(
        map(optData, function (item) {
            return item[1];
        }),
        null,
        dimValueGetter
    );
    lineData.initData(
        map(optData, function (item) {
            return item[2];
        })
    );
    lineData.hasItemOption = true;

    return {
        from: fromData,
        to: toData,
        line: lineData
    };
}

export default MarkLineView;
