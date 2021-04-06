
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

const colorPalette = [
    '#E01F54',
    '#001852',
    '#f5e8c8',
    '#b8d2c7',
    '#c6b38e',
    '#a4d8c2',
    '#f3d999',
    '#d3758f',
    '#dcc392',
    '#2e4783',
    '#82b6e9',
    '#ff6347',
    '#a092f1',
    '#0a915d',
    '#eaf889',
    '#6699FF',
    '#ff6666',
    '#3cb371',
    '#d5b158',
    '#38b6b6'
];

export default {
    color: colorPalette,

    visualMap: {
        color: ['#e01f54', '#e7dbc3'],
        textStyle: {
            color: '#333'
        }
    },

    candlestick: {
        itemStyle: {
            color: '#e01f54',
            color0: '#001852'
        },
        lineStyle: {
            width: 1,
            color: '#f5e8c8',
            color0: '#b8d2c7'
        },
        areaStyle: {
            color: '#a4d8c2',
            color0: '#f3d999'
        }
    },

    graph: {
        itemStyle: {
            color: '#a4d8c2'
        },
        linkStyle: {
            color: '#f3d999'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#E01F54'],
                    [0.8, '#b8d2c7'],
                    [1, '#001852']
                ],
                width: 8
            }
        }
    }
};
