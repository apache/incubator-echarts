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
    SeriesOption,
    SeriesOnPolarOptionMixin,
    SeriesOnCartesianOptionMixin,
    SeriesOnCalendarOptionMixin,
    SeriesOnGeoOptionMixin,
    SeriesOnSingleOptionMixin,
    SymbolOptionMixin,
    OptionDataValue,
    ItemStyleOption,
    SeriesLabelOption,
    StatesOptionMixin,
    SeriesEncodeOptionMixin,
    CallbackDataParams,
    ColorByMixin
} from '../../util/types';
import GlobalModel from '../../model/Global';
import List from '../../data/List';
import type { SymbolDrawItemModelOption } from '../helper/SymbolDraw';
import { BrushCommonSelectorsForSeries } from '../../component/brush/selector';

type ScatterDataValue = OptionDataValue | OptionDataValue[];

export interface EffectScatterStateOption {
    itemStyle?: ItemStyleOption
    label?: SeriesLabelOption
}

export interface EffectScatterDataItemOption extends SymbolOptionMixin,
    EffectScatterStateOption,
    StatesOptionMixin<EffectScatterStateOption> {
    name?: string

    value?: ScatterDataValue

    rippleEffect?: SymbolDrawItemModelOption['rippleEffect']
}

export interface EffectScatterSeriesOption extends SeriesOption<EffectScatterStateOption>, EffectScatterStateOption,
    ColorByMixin,
    SeriesOnCartesianOptionMixin, SeriesOnPolarOptionMixin, SeriesOnCalendarOptionMixin,
    SeriesOnGeoOptionMixin, SeriesOnSingleOptionMixin, SymbolOptionMixin<CallbackDataParams>,
    SeriesEncodeOptionMixin {

    type?: 'effectScatter'

    coordinateSystem?: string

    effectType?: 'ripple'

    /**
     * When to show the effect
     */
    showEffectOn?: 'render' | 'emphasis'
    clip?: boolean

    /**
     * Ripple effect config
     */
    rippleEffect?: SymbolDrawItemModelOption['rippleEffect']

    data?: (EffectScatterDataItemOption | ScatterDataValue)[]
}
class EffectScatterSeriesModel extends SeriesModel<EffectScatterSeriesOption> {
    static readonly type = 'series.effectScatter';
    type = EffectScatterSeriesModel.type;

    static readonly dependencies = ['grid', 'polar'];

    hasSymbolVisual = true;

    getInitialData(option: EffectScatterSeriesOption, ecModel: GlobalModel): List {
        return createListFromArray(this.getSource(), this, {useEncodeDefaulter: true});
    }

    brushSelector(dataIndex: number, data: List, selectors: BrushCommonSelectorsForSeries): boolean {
        return selectors.point(data.getItemLayout(dataIndex));
    }

    static defaultOption: EffectScatterSeriesOption = {
        coordinateSystem: 'cartesian2d',
        zlevel: 0,
        z: 2,
        legendHoverLink: true,

        effectType: 'ripple',

        progressive: 0,

        // When to show the effect, option: 'render'|'emphasis'
        showEffectOn: 'render',
        clip: true,

        // Ripple effect config
        rippleEffect: {
            period: 4,
            // Scale of ripple
            scale: 2.5,
            // Brush type can be fill or stroke
            brushType: 'fill'
        },

        universalTransition: {
            divideShape: 'clone'
        },
        // Cartesian coordinate system
        // xAxisIndex: 0,
        // yAxisIndex: 0,

        // Polar coordinate system
        // polarIndex: 0,

        // Geo coordinate system
        // geoIndex: 0,

        // symbol: null,        // 图形类型
        symbolSize: 10          // 图形大小，半宽（半径）参数，当图形为方向或菱形则总宽度为symbolSize * 2
        // symbolRotate: null,  // 图形旋转控制

        // itemStyle: {
        //     opacity: 1
        // }
    };
}

export default EffectScatterSeriesModel;