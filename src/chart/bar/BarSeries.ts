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

import BaseBarSeriesModel, {BaseBarSeriesOption} from './BaseBarSeries';
import {
    ItemStyleOption,
    OptionDataValue,
    SeriesStackOptionMixin,
    StatesOptionMixin,
    OptionDataItemObject,
    SeriesSamplingOptionMixin,
    SeriesLabelOption,
    SeriesEncodeOptionMixin
} from '../../util/types';
import type Cartesian2D from '../../coord/cartesian/Cartesian2D';
import createListFromArray from '../helper/createListFromArray';
import type Polar from '../../coord/polar/Polar';
import { inheritDefaultOption } from '../../util/component';
import List from '../../data/List';
import { BrushCommonSelectorsForSeries } from '../../component/brush/selector';

export type PolarBarLabelPosition = SeriesLabelOption['position']
    | 'start' | 'insideStart' | 'middle' | 'end' | 'insideEnd';

export type BarSeriesLabelOption = Omit<SeriesLabelOption, 'position'>
    & {position?: PolarBarLabelPosition | 'outside'};

export interface BarStateOption {
    itemStyle?: BarItemStyleOption
    label?: BarSeriesLabelOption
}

export interface BarItemStyleOption extends ItemStyleOption {
    // Border radius is not supported for bar on polar
    borderRadius?: number | number[]
}
export interface BarDataItemOption extends BarStateOption, StatesOptionMixin<BarStateOption>,
    OptionDataItemObject<OptionDataValue> {
    cursor?: string
}

export interface BarSeriesOption extends BaseBarSeriesOption<BarStateOption>, BarStateOption,
    SeriesStackOptionMixin, SeriesSamplingOptionMixin, SeriesEncodeOptionMixin {

    type?: 'bar'

    coordinateSystem?: 'cartesian2d' | 'polar'

    clip?: boolean

    /**
     * If use caps on two sides of bars
     * Only available on tangential polar bar
     */
    roundCap?: boolean

    showBackground?: boolean

    backgroundStyle?: ItemStyleOption & {
        borderRadius?: number | number[]
    }

    data?: (BarDataItemOption | OptionDataValue | OptionDataValue[])[]

    realtimeSort?: boolean
}

class BarSeriesModel extends BaseBarSeriesModel<BarSeriesOption> {
    static type = 'series.bar';
    type = BarSeriesModel.type;

    static dependencies = ['grid', 'polar'];

    coordinateSystem: Cartesian2D | Polar;

    getInitialData(): List {
        return createListFromArray(this.getSource(), this, {
            useEncodeDefaulter: true,
            createInvertedIndices: !!this.get('realtimeSort', true) || null
        });
    }

    /**
     * @override
     */
    getProgressive() {
        // Do not support progressive in normal mode.
        return this.get('large')
            ? this.get('progressive')
            : false;
    }

    /**
     * @override
     */
    getProgressiveThreshold() {
        // Do not support progressive in normal mode.
        let progressiveThreshold = this.get('progressiveThreshold');
        const largeThreshold = this.get('largeThreshold');
        if (largeThreshold > progressiveThreshold) {
            progressiveThreshold = largeThreshold;
        }
        return progressiveThreshold;
    }

    brushSelector(dataIndex: number, data: List, selectors: BrushCommonSelectorsForSeries): boolean {
        return selectors.rect(data.getItemLayout(dataIndex));
    }

    static defaultOption: BarSeriesOption = inheritDefaultOption(BaseBarSeriesModel.defaultOption, {
        // If clipped
        // Only available on cartesian2d
        clip: true,

        roundCap: false,

        showBackground: false,
        backgroundStyle: {
            color: 'rgba(180, 180, 180, 0.2)',
            borderColor: null,
            borderWidth: 0,
            borderType: 'solid',
            borderRadius: 0,
            shadowBlur: 0,
            shadowColor: null,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            opacity: 1
        },

        select: {
            itemStyle: {
                borderColor: '#212121'
            }
        },

        realtimeSort: false
    });

}

export default BarSeriesModel;