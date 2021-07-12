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
import createListFromArray from '../helper/createListFromArray';
import CoordinateSystem from '../../core/CoordinateSystem';
import {
    SeriesOption,
    SeriesOnCartesianOptionMixin,
    SeriesOnGeoOptionMixin,
    ItemStyleOption,
    SeriesLabelOption,
    OptionDataValue,
    StatesOptionMixin,
    SeriesEncodeOptionMixin,
    SeriesOnCalendarOptionMixin,
    ColorByMixin
} from '../../util/types';
import GlobalModel from '../../model/Global';
import List from '../../data/List';
import type Geo from '../../coord/geo/Geo';
import type Cartesian2D from '../../coord/cartesian/Cartesian2D';
import type Calendar from '../../coord/calendar/Calendar';

type HeatmapDataValue = OptionDataValue[];

export interface HeatmapStateOption {
    // Available on cartesian2d coordinate system
    itemStyle?: ItemStyleOption
    label?: SeriesLabelOption
}

export interface HeatmapDataItemOption extends HeatmapStateOption, StatesOptionMixin<HeatmapStateOption> {
    value: HeatmapDataValue
}

export interface HeatmapSeriesOption extends SeriesOption<HeatmapStateOption>, HeatmapStateOption,
    ColorByMixin,
    SeriesOnCartesianOptionMixin, SeriesOnGeoOptionMixin, SeriesOnCalendarOptionMixin, SeriesEncodeOptionMixin {
    type?: 'heatmap'

    coordinateSystem?: 'cartesian2d' | 'geo' | 'calendar'

    // Available on geo coordinate system
    blurSize?: number
    pointSize?: number
    maxOpacity?: number
    minOpacity?: number

    data?: (HeatmapDataItemOption | HeatmapDataValue)[]
}

class HeatmapSeriesModel extends SeriesModel<HeatmapSeriesOption> {
    static readonly type = 'series.heatmap';
    readonly type = HeatmapSeriesModel.type;

    static readonly dependencies = ['grid', 'geo', 'calendar'];
    // @ts-ignore
    coordinateSystem: Cartesian2D | Geo | Calendar;

    getInitialData(option: HeatmapSeriesOption, ecModel: GlobalModel): List {
        return createListFromArray(this.getSource(), this, {
            generateCoord: 'value'
        });
    }

    preventIncremental() {
        const coordSysCreator = CoordinateSystem.get(this.get('coordinateSystem'));
        if (coordSysCreator && coordSysCreator.dimensions) {
            return coordSysCreator.dimensions[0] === 'lng' && coordSysCreator.dimensions[1] === 'lat';
        }
    }

    static defaultOption: HeatmapSeriesOption = {

        coordinateSystem: 'cartesian2d',

        zlevel: 0,

        z: 2,

        // Cartesian coordinate system
        // xAxisIndex: 0,
        // yAxisIndex: 0,

        // Geo coordinate system
        geoIndex: 0,

        blurSize: 30,

        pointSize: 20,

        maxOpacity: 1,

        minOpacity: 0,

        select: {
            itemStyle: {
                borderColor: '#212121'
            }
        }
    };
}

export default HeatmapSeriesModel;