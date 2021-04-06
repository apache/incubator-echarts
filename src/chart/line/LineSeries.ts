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

import createListFromArray from '../helper/createListFromArray';
import SeriesModel from '../../model/Series';
import {
    SeriesOnCartesianOptionMixin,
    SeriesOption,
    SeriesOnPolarOptionMixin,
    SeriesStackOptionMixin,
    SeriesLabelOption,
    LineStyleOption,
    ItemStyleOption,
    AreaStyleOption,
    OptionDataValue,
    SymbolOptionMixin,
    SeriesSamplingOptionMixin,
    StatesOptionMixin,
    SeriesEncodeOptionMixin,
    CallbackDataParams,
    DefaultEmphasisFocus
} from '../../util/types';
import List from '../../data/List';
import type Cartesian2D from '../../coord/cartesian/Cartesian2D';
import type Polar from '../../coord/polar/Polar';
import { BrushCommonSelectorsForSeries } from '../../component/brush/selector';

type LineDataValue = OptionDataValue | OptionDataValue[];

interface ExtraStateOption {
    emphasis?: {
        focus?: DefaultEmphasisFocus
        scale?: boolean
    }
}

export interface LineStateOption {
    itemStyle?: ItemStyleOption
    label?: SeriesLabelOption
}

export interface LineDataItemOption extends SymbolOptionMixin,
    LineStateOption, StatesOptionMixin<LineStateOption, ExtraStateOption> {
    name?: string

    value?: LineDataValue
}

export interface LineEndLabelOption extends SeriesLabelOption {
    valueAnimation: boolean
}


export interface LineSeriesOption extends SeriesOption<LineStateOption, ExtraStateOption & {
    emphasis?: {
        lineStyle?: LineStyleOption | {
            width?: 'bolder'
        }
        areaStyle?: AreaStyleOption
    }
    blur?: {
        lineStyle?: LineStyleOption
        areaStyle?: AreaStyleOption
    }
}>, LineStateOption,
    SeriesOnCartesianOptionMixin,
    SeriesOnPolarOptionMixin,
    SeriesStackOptionMixin,
    SeriesSamplingOptionMixin,
    SymbolOptionMixin<CallbackDataParams>,
    SeriesEncodeOptionMixin {
    type?: 'line'

    coordinateSystem?: 'cartesian2d' | 'polar'

    // If clip the overflow value
    clip?: boolean

    label?: SeriesLabelOption
    endLabel?: LineEndLabelOption

    lineStyle?: LineStyleOption

    areaStyle?: AreaStyleOption & {
        origin?: 'auto' | 'start' | 'end'
    }

    step?: false | 'start' | 'end' | 'middle'

    smooth?: boolean | number

    smoothMonotone?: 'x' | 'y' | 'none'

    connectNulls?: boolean

    showSymbol?: boolean
    // false | 'auto': follow the label interval strategy.
    // true: show all symbols.
    showAllSymbol?: 'auto'

    data?: (LineDataValue | LineDataItemOption)[]
}

class LineSeriesModel extends SeriesModel<LineSeriesOption> {
    static readonly type = 'series.line';
    type = LineSeriesModel.type;

    static readonly dependencies = ['grid', 'polar'];

    coordinateSystem: Cartesian2D | Polar;

    hasSymbolVisual = true;
    legendSymbol = 'line';

    getInitialData(option: LineSeriesOption): List {
        if (__DEV__) {
            const coordSys = option.coordinateSystem;
            if (coordSys !== 'polar' && coordSys !== 'cartesian2d') {
                throw new Error('Line not support coordinateSystem besides cartesian and polar');
            }
        }
        return createListFromArray(this.getSource(), this, {
            useEncodeDefaulter: true
        });
    }

    static defaultOption: LineSeriesOption = {
        zlevel: 0,
        z: 3,
        coordinateSystem: 'cartesian2d',
        legendHoverLink: true,

        clip: true,

        label: {
            position: 'top'
        },

        endLabel: {
            show: false,
            valueAnimation: true,
            distance: 8
        },

        lineStyle: {
            width: 2,
            type: 'solid'
        },

        emphasis: {
            scale: true,
            lineStyle: {
                width: 'bolder'
            }
        },
        // areaStyle: {
            // origin of areaStyle. Valid values:
            // `'auto'/null/undefined`: from axisLine to data
            // `'start'`: from min to data
            // `'end'`: from data to max
            // origin: 'auto'
        // },
        // false, 'start', 'end', 'middle'
        step: false,

        // Disabled if step is true
        smooth: false,
        smoothMonotone: null,
        symbol: 'emptyCircle',
        symbolSize: 4,
        symbolRotate: null,

        showSymbol: true,
        // `false`: follow the label interval strategy.
        // `true`: show all symbols.
        // `'auto'`: If possible, show all symbols, otherwise
        //           follow the label interval strategy.
        showAllSymbol: 'auto',

        // Whether to connect break point.
        connectNulls: false,

        // Sampling for large data. Can be: 'average', 'max', 'min', 'sum', 'lttb'.
        sampling: 'none',

        animationEasing: 'linear',

        // Disable progressive
        progressive: 0,
        hoverLayerThreshold: Infinity
    };

    brushSelector(dataIndex: number, data: List, selectors: BrushCommonSelectorsForSeries): boolean {
        const pts = data.getLayout('points')
        return selectors.point([pts[dataIndex * 2], pts[dataIndex * 2 + 1]]);
    }
}

export default LineSeriesModel;
