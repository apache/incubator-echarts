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
import createListSimply from '../helper/createListSimply';
import * as zrUtil from 'zrender/src/core/util';
import LegendVisualProvider from '../../visual/LegendVisualProvider';
import {
    SeriesOption,
    LineStyleOption,
    SeriesLabelOption,
    SymbolOptionMixin,
    ItemStyleOption,
    AreaStyleOption,
    OptionDataValue,
    StatesOptionMixin,
    OptionDataItemObject,
    SeriesEncodeOptionMixin,
    CallbackDataParams,
    ColorByMixin
} from '../../util/types';
import GlobalModel from '../../model/Global';
import List from '../../data/List';
import Radar from '../../coord/radar/Radar';
import {
    createTooltipMarkup, retrieveVisualColorForTooltipMarker
} from '../../component/tooltip/tooltipMarkup';

type RadarSeriesDataValue = OptionDataValue[];

export interface RadarSeriesStateOption {
    lineStyle?: LineStyleOption
    areaStyle?: AreaStyleOption
    label?: SeriesLabelOption
    itemStyle?: ItemStyleOption
}
export interface RadarSeriesDataItemOption extends SymbolOptionMixin,
    RadarSeriesStateOption, StatesOptionMixin<RadarSeriesStateOption>,
    OptionDataItemObject<RadarSeriesDataValue> {
}

export interface RadarSeriesOption extends SeriesOption<RadarSeriesStateOption>, RadarSeriesStateOption,
    ColorByMixin,
    SymbolOptionMixin<CallbackDataParams>, SeriesEncodeOptionMixin {
    type?: 'radar'
    coordinateSystem?: 'radar'

    radarIndex?: number
    radarId?: string

    data?: (RadarSeriesDataItemOption | RadarSeriesDataValue)[]
}

class RadarSeriesModel extends SeriesModel<RadarSeriesOption> {

    static readonly type = 'series.radar';
    readonly type = RadarSeriesModel.type;

    static dependencies = ['radar'];

    coordinateSystem: Radar;

    hasSymbolVisual = true;

    // Overwrite
    init(option: RadarSeriesOption) {
        super.init.apply(this, arguments as any);

        // Enable legend selection for each data item
        // Use a function instead of direct access because data reference may changed
        this.legendVisualProvider = new LegendVisualProvider(
            zrUtil.bind(this.getData, this), zrUtil.bind(this.getRawData, this)
        );

    }

    getInitialData(option: RadarSeriesOption, ecModel: GlobalModel): List {
        return createListSimply(this, {
            generateCoord: 'indicator_',
            generateCoordCount: Infinity
        });
    }

    formatTooltip(
        dataIndex: number,
        multipleSeries?: boolean,
        dataType?: string
    ) {
        const data = this.getData();
        const coordSys = this.coordinateSystem;
        const indicatorAxes = coordSys.getIndicatorAxes();
        const name = this.getData().getName(dataIndex);
        const nameToDisplay = name === '' ? this.name : name;
        const markerColor = retrieveVisualColorForTooltipMarker(this, dataIndex);

        return createTooltipMarkup('section', {
            header: nameToDisplay,
            sortBlocks: true,
            blocks: zrUtil.map(indicatorAxes, axis => {
                const val = data.get(data.mapDimension(axis.dim), dataIndex);
                return createTooltipMarkup('nameValue', {
                    markerType: 'subItem',
                    markerColor: markerColor,
                    name: axis.name,
                    value: val,
                    sortParam: val
                });
            })
        });
    }

    getTooltipPosition(dataIndex: number) {
        if (dataIndex != null) {
            const data = this.getData();
            const coordSys = this.coordinateSystem;
            const values = data.getValues(
                zrUtil.map(coordSys.dimensions, function (dim) {
                    return data.mapDimension(dim);
                }), dataIndex
            );

            for (let i = 0, len = values.length; i < len; i++) {
                if (!isNaN(values[i] as number)) {
                    const indicatorAxes = coordSys.getIndicatorAxes();
                    return coordSys.coordToPoint(indicatorAxes[i].dataToCoord(values[i]), i);
                }
            }
        }
    }

    static defaultOption: RadarSeriesOption = {
        zlevel: 0,
        z: 2,
        colorBy: 'data',
        coordinateSystem: 'radar',
        legendHoverLink: true,
        radarIndex: 0,
        lineStyle: {
            width: 2,
            type: 'solid'
        },
        label: {
            position: 'top'
        },
        // areaStyle: {
        // },
        // itemStyle: {}
        symbolSize: 8
        // symbolRotate: null
    };
}

export default RadarSeriesModel;