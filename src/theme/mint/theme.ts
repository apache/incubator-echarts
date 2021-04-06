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
    '#8aedd5',
    '#93bc9e',
    '#cef1db',
    '#7fe579',
    '#a6d7c2',
    '#bef0bb',
    '#99e2vb',
    '#94f8a8',
    '#7de5b8',
    '#4dfb70'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#8aedd5'
        }
    },

    toolbox: {
        color: ['#8aedd5', '#8aedd5', '#8aedd5', '#8aedd5']
    },

    tooltip: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        axisPointer: {
            // Axis indicator, coordinate trigger effective
            type: 'line', // The default is a straight line： 'line' | 'shadow'
            lineStyle: {
                // Straight line indicator style settings
                color: '#8aedd5',
                type: 'dashed'
            },
            crossStyle: {
                color: '#8aedd5'
            },
            shadowStyle: {
                // Shadow indicator style settings
                color: 'rgba(200,200,200,0.3)'
            }
        }
    },

    // Area scaling controller
    dataZoom: {
        dataBackgroundColor: '#eee', // Data background color
        fillerColor: 'rgba(64,136,41,0.2)', // Fill the color
        handleColor: '#408829' // Handle color
    },

    dataRange: {
        color: ['#93bc92', '#bef0bb']
    },

    candlestick: {
        itemStyle: {
            color: '#8aedd5',
            color0: '#7fe579'
        },
        lineStyle: {
            width: 1,
            color: '#8aedd5',
            color0: '#7fe579'
        },
        areaStyle: {
            color: '#8aedd5',
            color0: '#93bc9e'
        }
    },

    graph: {
        itemStyle: {
            color: '#8aedd5'
        },
        linkStyle: {
            color: '#93bc9e'
        }
    },

    map: {
        itemStyle: {
            color: '#8aedd5'
        },
        areaStyle: {
            color: '#93bc9e'
        },
        label: {
            color: '#cef1db'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#93bc9e'],
                    [0.8, '#8aedd5'],
                    [1, '#a6d7c2']
                ],
                width: 8
            }
        }
    }
};
