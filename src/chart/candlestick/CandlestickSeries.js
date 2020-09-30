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
import SeriesModel from '../../model/Series';
import {seriesModelMixin} from '../helper/whiskerBoxCommon';

var CandlestickSeries = SeriesModel.extend({

    type: 'series.candlestick',

    dependencies: ['xAxis', 'yAxis', 'grid'],

    /**
     * @readOnly
     */
    defaultValueDimensions: [
        {name: 'open', defaultTooltip: true},
        {name: 'close', defaultTooltip: true},
        {name: 'lowest', defaultTooltip: true},
        {name: 'highest', defaultTooltip: true}
    ],

    /**
     * @type {Array.<string>}
     * @readOnly
     */
    dimensions: null,

    /**
     * @override
     */
    defaultOption: {
        zlevel: 0,
        z: 2,
        coordinateSystem: 'cartesian2d',
        legendHoverLink: true,

        hoverAnimation: true,

        // xAxisIndex: 0,
        // yAxisIndex: 0,

        layout: null, // 'horizontal' or 'vertical'

        clip: true,

        itemStyle: {
            color: '#c23531', // 阳线 positive
            color0: '#314656', // 阴线 negative     '#c23531', '#314656'
            color1: '#000',  // 十字星 neutral
            borderWidth: 1,
            // FIXME
            // ec2中使用的是lineStyle.color 和 lineStyle.color0
            borderColor: '#c23531',
            borderColor0: '#314656',
            borderColor1: '#000'
        },

        emphasis: {
            itemStyle: {
                borderWidth: 2
            }
        },

        barMaxWidth: null,
        barMinWidth: null,
        barWidth: null,

        large: true,
        largeThreshold: 600,

        progressive: 3e3,
        progressiveThreshold: 1e4,
        progressiveChunkMode: 'mod',

        animationUpdate: false,
        animationEasing: 'linear',
        animationDuration: 300
    },

    /**
     * Get dimension for shadow in dataZoom
     * @return {string} dimension name
     */
    getShadowDim: function () {
        return 'open';
    },

    brushSelector: function (dataIndex, data, selectors) {
        var itemLayout = data.getItemLayout(dataIndex);
        return itemLayout && selectors.rect(itemLayout.brushRect);
    }

});

zrUtil.mixin(CandlestickSeries, seriesModelMixin, true);

export default CandlestickSeries;
