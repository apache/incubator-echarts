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
    DefaultEmphasisFocus,
    ColorByMixin
} from '../../util/types';
import List from '../../data/List';
import type Cartesian2D from '../../coord/cartesian/Cartesian2D';
import type Polar from '../../coord/polar/Polar';
import {createSymbol, ECSymbol} from '../../util/symbol';
import {Group} from '../../util/graphic';
import {LegendIconParams} from '../../component/legend/LegendModel';

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
    endLabel?: LineEndLabelOption
}

export interface LineDataItemOption extends SymbolOptionMixin,
    LineStateOption, StatesOptionMixin<LineStateOption, ExtraStateOption> {
    name?: string

    value?: LineDataValue
}

export interface LineEndLabelOption extends SeriesLabelOption {
    valueAnimation?: boolean
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
    ColorByMixin,
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

        // itemStyle: {
        // },

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
        hoverLayerThreshold: Infinity,

        universalTransition: {
            divideShape: 'clone'
        }
    };

    getLegendIcon(opt: LegendIconParams): ECSymbol | Group {
        const group = new Group();

        const line = createSymbol(
            'line',
            0,
            opt.itemHeight / 2,
            opt.itemWidth,
            0,
            opt.lineStyle.stroke,
            false
        );
        group.add(line);
        line.setStyle(opt.lineStyle);

        const visualType = this.getData().getVisual('symbol');
        const visualRotate = this.getData().getVisual('symbolRotate');
        const symbolType = visualType === 'none' ? 'circle' : visualType;

        // Symbol size is 80% when there is a line
        const size = opt.itemHeight * 0.8;
        const symbol = createSymbol(
            symbolType,
            (opt.itemWidth - size) / 2,
            (opt.itemHeight - size) / 2,
            size,
            size,
            opt.itemStyle.fill
        );
        group.add(symbol);

        symbol.setStyle(opt.itemStyle);

        const symbolRotate = opt.iconRotate === 'inherit'
            ? visualRotate
            : (opt.iconRotate || 0);
        symbol.rotation = symbolRotate * Math.PI / 180;
        symbol.setOrigin([opt.itemWidth / 2, opt.itemHeight / 2]);

        if (symbolType.indexOf('empty') > -1) {
            symbol.style.stroke = symbol.style.fill;
            symbol.style.fill = '#fff';
            symbol.style.lineWidth = 2;
        }

        return group;
    }
}

export default LineSeriesModel;
