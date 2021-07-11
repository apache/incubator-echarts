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

import MarkerModel, { MarkerOption, MarkerStatisticType, MarkerPositionOption } from './MarkerModel';
import GlobalModel from '../../model/Global';
import {
    LineStyleOption,
    SeriesLineLabelOption,
    SymbolOptionMixin,
    ItemStyleOption,
    StatesOptionMixin
} from '../../util/types';

interface MarkLineStateOption {
    lineStyle?: LineStyleOption
    /**
     * itemStyle for symbol
     */
    itemStyle?: ItemStyleOption
    label?: SeriesLineLabelOption
}
interface MarkLineDataItemOptionBase extends MarkLineStateOption, StatesOptionMixin<MarkLineStateOption> {
    name?: string
}

// 1D markLine for horizontal or vertical
export interface MarkLine1DDataItemOption extends MarkLineDataItemOptionBase {

    // On cartesian coordinate system
    xAxis?: number | string
    yAxis?: number | string

    // Use statistic method
    type?: MarkerStatisticType
    /**
     * When using statistic method with type.
     * valueIndex and valueDim can be specify which dim the statistic is used on.
     */
    valueIndex?: number
    valueDim?: string

    /**
     * Symbol for both two ends
     */
    symbol?: string[] | string
    symbolSize?: number[] | number
    symbolRotate?: number[] | number
    symbolOffset?: number | string | (number | string)[]
}

// 2D markLine on any direction
interface MarkLine2DDataItemDimOption extends
    MarkLineDataItemOptionBase,
    SymbolOptionMixin,
    MarkerPositionOption {
}

export type MarkLine2DDataItemOption = [
    // Start point
    MarkLine2DDataItemDimOption,
    // End point
    MarkLine2DDataItemDimOption
];

export interface MarkLineOption extends MarkerOption,
    MarkLineStateOption, StatesOptionMixin<MarkLineStateOption> {
    mainType?: 'markLine'

    symbol?: string[] | string
    symbolSize?: number[] | number
    symbolRotate?: number[] | number
    symbolOffset?: number | string | (number | string)[]

    /**
     * Precision used on statistic method
     */
    precision?: number

    data?: (MarkLine1DDataItemOption | MarkLine2DDataItemOption)[]
}

class MarkLineModel extends MarkerModel<MarkLineOption> {

    static type = 'markLine';
    type = MarkLineModel.type;

    createMarkerModelFromSeries(
        markerOpt: MarkLineOption,
        masterMarkerModel: MarkLineModel,
        ecModel: GlobalModel
    ) {
        return new MarkLineModel(markerOpt, masterMarkerModel, ecModel);
    }

    static defaultOption: MarkLineOption = {
        zlevel: 0,
        z: 5,

        symbol: ['circle', 'arrow'],
        symbolSize: [8, 16],

        //symbolRotate: 0,
        symbolOffset: 0,

        // precision: 2,
        tooltip: {
            trigger: 'item'
        },
        label: {
            show: true,
            position: 'end',
            distance: 5
        },
        lineStyle: {
            type: 'dashed'
        },
        emphasis: {
            label: {
                show: true
            },
            lineStyle: {
                width: 3
            }
        },
        animationEasing: 'linear'
    };
}

export default MarkLineModel;
