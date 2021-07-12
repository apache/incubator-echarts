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
import createListSimply from '../helper/createListSimply';
import {defaultEmphasis} from '../../util/model';
import {makeSeriesEncodeForNameBased} from '../../data/helper/sourceHelper';
import LegendVisualProvider from '../../visual/LegendVisualProvider';
import SeriesModel from '../../model/Series';
import {
    SeriesOption,
    BoxLayoutOptionMixin,
    HorizontalAlign,
    LabelOption,
    LabelLineOption,
    ItemStyleOption,
    OptionDataValueNumeric,
    StatesOptionMixin,
    OptionDataItemObject,
    LayoutOrient,
    VerticalAlign,
    SeriesLabelOption,
    SeriesEncodeOptionMixin,
    ColorByMixin
} from '../../util/types';
import GlobalModel from '../../model/Global';
import List from '../../data/List';

type FunnelLabelOption = Omit<SeriesLabelOption, 'position'> & {
    position?: LabelOption['position']
        | 'outer' | 'inner' | 'center' | 'rightTop' | 'rightBottom' | 'leftTop' | 'leftBottom'
};

export interface FunnelStateOption {
    itemStyle?: ItemStyleOption
    label?: FunnelLabelOption
    labelLine?: LabelLineOption
}

export interface FunnelDataItemOption
    extends FunnelStateOption, StatesOptionMixin<FunnelStateOption>,
    OptionDataItemObject<OptionDataValueNumeric> {

    itemStyle?: ItemStyleOption & {
        width?: number | string
        height?: number | string
    }
}

export interface FunnelSeriesOption extends SeriesOption<FunnelStateOption>, FunnelStateOption,
    ColorByMixin,
    BoxLayoutOptionMixin, SeriesEncodeOptionMixin {
    type?: 'funnel'

    min?: number
    max?: number

    /**
     * Absolute number or percent string
     */
    minSize?: number | string
    maxSize?: number | string

    sort?: 'ascending' | 'descending' | 'none'

    orient?: LayoutOrient

    gap?: number

    funnelAlign?: HorizontalAlign | VerticalAlign

    data?: (OptionDataValueNumeric | OptionDataValueNumeric[] | FunnelDataItemOption)[]
}

class FunnelSeriesModel extends SeriesModel<FunnelSeriesOption> {
    static type = 'series.funnel' as const;
    type = FunnelSeriesModel.type;

    init(option: FunnelSeriesOption) {
        super.init.apply(this, arguments as any);

        // Enable legend selection for each data item
        // Use a function instead of direct access because data reference may changed
        this.legendVisualProvider = new LegendVisualProvider(
            zrUtil.bind(this.getData, this), zrUtil.bind(this.getRawData, this)
        );
        // Extend labelLine emphasis
        this._defaultLabelLine(option);
    }

    getInitialData(this: FunnelSeriesModel, option: FunnelSeriesOption, ecModel: GlobalModel): List {
        return createListSimply(this, {
            coordDimensions: ['value'],
            encodeDefaulter: zrUtil.curry(makeSeriesEncodeForNameBased, this)
        });
    }

    _defaultLabelLine(option: FunnelSeriesOption) {
        // Extend labelLine emphasis
        defaultEmphasis(option, 'labelLine', ['show']);

        const labelLineNormalOpt = option.labelLine;
        const labelLineEmphasisOpt = option.emphasis.labelLine;
        // Not show label line if `label.normal.show = false`
        labelLineNormalOpt.show = labelLineNormalOpt.show
            && option.label.show;
        labelLineEmphasisOpt.show = labelLineEmphasisOpt.show
            && option.emphasis.label.show;
    }

    // Overwrite
    getDataParams(dataIndex: number) {
        const data = this.getData();
        const params = super.getDataParams(dataIndex);
        const valueDim = data.mapDimension('value');
        const sum = data.getSum(valueDim);
        // Percent is 0 if sum is 0
        params.percent = !sum ? 0 : +(data.get(valueDim, dataIndex) as number / sum * 100).toFixed(2);

        params.$vars.push('percent');
        return params;
    }

    static defaultOption: FunnelSeriesOption = {
        zlevel: 0,                  // 一级层叠
        z: 2,                       // 二级层叠
        legendHoverLink: true,
        colorBy: 'data',
        left: 80,
        top: 60,
        right: 80,
        bottom: 60,
        // width: {totalWidth} - left - right,
        // height: {totalHeight} - top - bottom,

        // 默认取数据最小最大值
        // min: 0,
        // max: 100,
        minSize: '0%',
        maxSize: '100%',
        sort: 'descending', // 'ascending', 'descending'
        orient: 'vertical',
        gap: 0,
        funnelAlign: 'center',
        label: {
            show: true,
            position: 'outer'
            // formatter: 标签文本格式器，同Tooltip.formatter，不支持异步回调
        },
        labelLine: {
            show: true,
            length: 20,
            lineStyle: {
                // color: 各异,
                width: 1
            }
        },
        itemStyle: {
            // color: 各异,
            borderColor: '#fff',
            borderWidth: 1
        },
        emphasis: {
            label: {
                show: true
            }
        },
        select: {
            itemStyle: {
                borderColor: '#212121'
            }
        }
    };

}

export default FunnelSeriesModel;
